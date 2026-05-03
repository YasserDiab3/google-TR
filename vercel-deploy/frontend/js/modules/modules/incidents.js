/**
 * Incidents Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
// ===== Incidents Module (الحوادث) =====
const Incidents = {
    currentEditId: null,
    currentAttachments: [],
    reportPreviewModalId: 'incident-report-preview-modal',
    lastRenderedSignature: '',
    _i18nSectionObserver: null,
    _i18nBodyObserver: null,

    applyModuleI18n(root) {
        const target = root || document;
        const i18nCore = (window.AppI18n && typeof window.AppI18n.applyI18n === 'function')
            ? window.AppI18n
            : ((window.I18n && typeof window.I18n.applyI18n === 'function') ? window.I18n : null);
        if (!i18nCore) return;
        if (typeof i18nCore.applyI18n === 'function') i18nCore.applyI18n(target);
        if (typeof i18nCore.applyLiteralTranslations === 'function') i18nCore.applyLiteralTranslations(target);
    },

    ensureI18nObservers(section) {
        if (this._i18nSectionObserver) {
            this._i18nSectionObserver.disconnect();
            this._i18nSectionObserver = null;
        }

        if (section && typeof MutationObserver !== 'undefined') {
            this._i18nSectionObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node && node.nodeType === 1) {
                            this.applyModuleI18n(node);
                        }
                    });
                });
            });
            this._i18nSectionObserver.observe(section, { childList: true, subtree: true });
        }

        if (!this._i18nBodyObserver && typeof MutationObserver !== 'undefined') {
            this._i18nBodyObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (!node || node.nodeType !== 1) return;
                        if (node.classList?.contains('modal-overlay') || node.querySelector?.('.modal-overlay')) {
                            this.applyModuleI18n(node);
                        }
                    });
                });
            });
            this._i18nBodyObserver.observe(document.body, { childList: true, subtree: true });
        }
    },

    /**
     * Convert Arabic-Indic / Eastern-Arabic digits to Latin digits in a string.
     * Useful for parsing dates/times coming from localized UI.
     */
    normalizeLatinDigits(input) {
        if (input === null || input === undefined) return '';
        const str = String(input);
        const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
        const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';
        return str
            .replace(/[٠-٩]/g, d => String(arabicIndic.indexOf(d)))
            .replace(/[۰-۹]/g, d => String(easternArabicIndic.indexOf(d)));
    },

    /**
     * Parse various date formats safely (ISO, YYYY-MM-DD, DD/MM/YYYY, etc.).
     * Returns a valid Date or null.
     */
    parseFlexibleDate(value) {
        if (!value) return null;

        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value;
        }

        if (typeof value === 'number') {
            const d = new Date(value);
            return Number.isNaN(d.getTime()) ? null : d;
        }

        const raw = this.normalizeLatinDigits(value).trim();
        if (!raw) return null;

        // First attempt: native parsing
        let d = new Date(raw);
        if (!Number.isNaN(d.getTime())) return d;

        // Common variant: "YYYY-MM-DD HH:mm" -> "YYYY-MM-DDTHH:mm"
        if (raw.includes(' ') && !raw.includes('T')) {
            d = new Date(raw.replace(' ', 'T'));
            if (!Number.isNaN(d.getTime())) return d;
        }

        const buildDate = (year, month1to12, day, hour = 0, minute = 0, second = 0) => {
            const month = month1to12 - 1;
            const dt = new Date(year, month, day, hour, minute, second);
            // Validate components to avoid JS auto-correction (e.g., 32/13/2025)
            if (
                dt.getFullYear() === year &&
                dt.getMonth() === month &&
                dt.getDate() === day
            ) {
                return dt;
            }
            return null;
        };

        const parseTimeParts = (hh, mm, ss) => {
            const hour = hh ? parseInt(hh, 10) : 0;
            const minute = mm ? parseInt(mm, 10) : 0;
            const second = ss ? parseInt(ss, 10) : 0;
            return { hour, minute, second };
        };

        // DD/MM/YYYY or DD-MM-YYYY (optionally with time)
        let m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const month = parseInt(m[2], 10);
            const year = parseInt(m[3], 10);
            const { hour, minute, second } = parseTimeParts(m[4], m[5], m[6]);

            // Prefer DD/MM; if invalid, try MM/DD as fallback
            const ddmm = buildDate(year, month, day, hour, minute, second);
            if (ddmm) return ddmm;

            const mmdd = buildDate(year, day, month, hour, minute, second);
            if (mmdd) return mmdd;
        }

        // YYYY/MM/DD or YYYY-MM-DD (optionally with time)
        m = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
        if (m) {
            const year = parseInt(m[1], 10);
            const month = parseInt(m[2], 10);
            const day = parseInt(m[3], 10);
            const { hour, minute, second } = parseTimeParts(m[4], m[5], m[6]);
            const ymd = buildDate(year, month, day, hour, minute, second);
            if (ymd) return ymd;
        }

        return null;
    },

    getThreeYearConfig() {
        const currentYear = new Date().getFullYear();
        const earliestYear = currentYear - 2;
        return {
            currentYear,
            earliestYear,
            years: [currentYear, currentYear - 1, currentYear - 2]
        };
    },

    getIncidentDateValue(incident = {}) {
        const possibleDates = [
            incident.date,
            incident.incidentDate,
            incident.createdAt,
            incident.updatedAt
        ];

        for (const value of possibleDates) {
            if (!value) continue;
            const date = this.parseFlexibleDate(value);
            if (date) return date;
        }
        return null;
    },

    /**
     * Safely convert a date value to local datetime string format for datetime-local inputs
     * Returns empty string if date is invalid
     * تم إصلاح المشكلة: تحويل من UTC إلى التوقيت المحلي
     */
    safeDateToISOString(dateValue, sliceLength = 16) {
        if (!dateValue) return '';
        try {
            const date = this.parseFlexibleDate(dateValue);
            if (!date) return '';
            // تحويل من UTC إلى التوقيت المحلي للعرض في حقول datetime-local
            const offset = date.getTimezoneOffset();
            const localDate = new Date(date.getTime() - offset * 60000);
            return localDate.toISOString().slice(0, sliceLength);
        } catch (e) {
            return '';
        }
    },

    normalizeSeverity(value) {
        const severity = (value || '').toString().trim().toLowerCase();
        if (!severity) return 'other';

        if (['عالية', 'high', 'حرجة', 'critical'].includes(severity)) return 'high';
        if (['متوسطة', 'medium', 'moderate'].includes(severity)) return 'medium';
        if (['منخفضة', 'low', 'minor'].includes(severity)) return 'low';
        return 'other';
    },

    normalizeStatus(value) {
        const status = (value || '').toString().trim().toLowerCase();
        if (!status) return 'other';

        if (['مغلق', 'محلول', 'تم الاغلاق', 'تم الإغلاق', 'closed', 'resolved'].includes(status)) return 'closed';
        if (['قيد التحقيق', 'investigation', 'under investigation', 'in progress', 'قيد المتابعة'].includes(status)) return 'investigating';
        if (['مفتوح', 'open', 'new'].includes(status)) return 'open';
        return 'other';
    },

    getThreeYearIncidents() {
        const data = AppState?.appData?.incidents || [];
        const { earliestYear, currentYear } = this.getThreeYearConfig();

        return data.map((incident) => {
            const date = this.getIncidentDateValue(incident);
            if (!date) return null;
            const year = date.getFullYear();
            if (year < earliestYear || year > currentYear) return null;
            return {
                incident,
                date,
                year
            };
        }).filter(Boolean).sort((a, b) => b.date - a.date);
    },

    buildYearlyStats(collection = []) {
        const { years } = this.getThreeYearConfig();

        const stats = years.map((year) => {
            const yearItems = collection.filter((item) => item.year === year);
            const total = yearItems.length;

            const severityBuckets = { high: 0, medium: 0, low: 0, other: 0 };
            const statusBuckets = { open: 0, investigating: 0, closed: 0, other: 0 };

            yearItems.forEach(({ incident }) => {
                const severityKey = this.normalizeSeverity(incident?.severity);
                severityBuckets[severityKey] = (severityBuckets[severityKey] || 0) + 1;

                const statusKey = this.normalizeStatus(incident?.status);
                statusBuckets[statusKey] = (statusBuckets[statusKey] || 0) + 1;
            });

            const closed = statusBuckets.closed || 0;
            const closureRate = total > 0 ? parseFloat(((closed / total) * 100).toFixed(1)) : 0;

            return {
                year,
                total,
                closed,
                open: statusBuckets.open || 0,
                investigating: statusBuckets.investigating || 0,
                severity: severityBuckets,
                closureRate,
                improvementVsPrevious: null
            };
        });

        stats.forEach((entry, index) => {
            const previous = stats[index + 1];
            if (!previous || previous.total === 0) {
                entry.improvementVsPrevious = null;
            } else {
                const rate = ((previous.total - entry.total) / previous.total) * 100;
                entry.improvementVsPrevious = parseFloat(rate.toFixed(1));
            }
        });

        return stats;
    },

    buildThreeYearAnalytics() {
        const incidents = this.getThreeYearIncidents();
        const yearlyStats = this.buildYearlyStats(incidents);
        const { earliestYear, currentYear } = this.getThreeYearConfig();

        const totals = {
            totalIncidents: incidents.length,
            closedIncidents: incidents.filter(({ incident }) => this.normalizeStatus(incident?.status) === 'closed').length
        };

        totals.closureRate = totals.totalIncidents > 0
            ? parseFloat(((totals.closedIncidents / totals.totalIncidents) * 100).toFixed(1))
            : 0;

        totals.averagePerYear = parseFloat((totals.totalIncidents / 3).toFixed(1));
        totals.rangeLabel = `${earliestYear} - ${currentYear}`;

        const severityTotals = incidents.reduce((acc, { incident }) => {
            const key = this.normalizeSeverity(incident?.severity);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, { high: 0, medium: 0, low: 0, other: 0 });

        const currentImprovement = yearlyStats.length > 0 ? yearlyStats[0].improvementVsPrevious : null;

        return {
            incidents,
            yearlyStats,
            totals,
            severityTotals,
            currentImprovement
        };
    },

    formatImprovementValue(value) {
        if (value === null || Number.isNaN(value)) {
            return {
                label: 'غير متاح',
                className: 'text-gray-500',
                value: null
            };
        }

        if (value === 0) {
            return {
                label: '0%',
                className: 'text-gray-600',
                value: 0
            };
        }

        const formatted = `${value > 0 ? '+' : ''}${Math.abs(value).toFixed(1)}%`;
        return {
            label: formatted,
            className: value > 0 ? 'text-green-600' : 'text-red-600',
            value
        };
    },

    // ======= بيانات سجل الحوادث =======
    registryData: [],
    registryCurrentTab: 'registry', // 'registry' أو 'manual-entry'

    /**
     * تهيئة وتحميل بيانات السجل
     */
    initRegistry() {
        try {
            // تحميل من AppState
            if (AppState.appData && AppState.appData.incidentsRegistry) {
                this.registryData = AppState.appData.incidentsRegistry;
                return;
            }
            // تحميل من localStorage
            const savedData = localStorage.getItem('hse_incidents_registry');
            if (savedData) {
                this.registryData = JSON.parse(savedData);
                if (!AppState.appData) AppState.appData = {};
                AppState.appData.incidentsRegistry = this.registryData;
            } else {
                this.registryData = [];
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل بيانات سجل الحوادث:', error);
            this.registryData = [];
        }
    },

    /**
     * حفظ بيانات السجل
     */
    async saveRegistryData(options = {}) {
        try {
            const { sync = true } = options || {};
            if (!AppState.appData) AppState.appData = {};
            AppState.appData.incidentsRegistry = this.registryData;
            localStorage.setItem('hse_incidents_registry', Utils.safeStringify(this.registryData));

            // المزامنة مع Google Sheets
            if (sync && typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                await GoogleIntegration.autoSave('IncidentsRegistry', this.registryData);
            }
            return true;
        } catch (error) {
            Utils.safeError('❌ خطأ في حفظ بيانات السجل:', error);
            return false;
        }
    },

    /**
     * توليد رقم تسلسلي للسجل
     */
    generateRegistrySequentialNumber() {
        const currentYear = new Date().getFullYear();
        const yearRecords = this.registryData.filter(r => {
            if (!r.incidentDate) return false;
            const recordYear = new Date(r.incidentDate).getFullYear();
            return recordYear === currentYear;
        });
        return yearRecords.length + 1;
    },

    /**
     * حساب إجمالي أيام الإجازة من تاريخ بداية الإجازة حتى تاريخ العودة للعمل
     */
    calculateTotalLeaveDays(leaveStartDate, returnToWorkDate) {
        if (!leaveStartDate || !returnToWorkDate) return 0;
        try {
            const start = new Date(leaveStartDate);
            const end = new Date(returnToWorkDate);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return 0;
            }

            if (end < start) {
                return 0;
            }

            // حساب الفرق بالأيام (شامل تاريخ البدء وتاريخ العودة)
            const diffTime = end - start;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            return diffDays;
        } catch (error) {
            Utils.safeError('خطأ في حساب أيام الإجازة:', error);
            return 0;
        }
    },

    /**
     * الحصول على بيانات الموظف من كود الموظف
     */
    getEmployeeByCode(employeeCode) {
        if (!employeeCode) return null;
        try {
            const employees = AppState?.appData?.employees || [];
            const normalizedCode = String(employeeCode).trim().toLowerCase();

            const employee = employees.find(emp => {
                if (!emp) return false;
                // البحث في جميع الحقول الممكنة
                const codeFields = [
                    emp.employeeCode,
                    emp.employeeNumber,
                    emp.sapId,
                    emp.id,
                    emp.code,
                    emp.cardId
                ].filter(Boolean).map(f => String(f).trim().toLowerCase());

                return codeFields.some(field => field === normalizedCode);
            });

            return employee || null;
        } catch (error) {
            Utils.safeError('خطأ في البحث عن الموظف:', error);
            return null;
        }
    },

    /**
     * تحديد اسم اليوم
     */
    getDayName(date) {
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        return days[date.getDay()];
    },

    /**
     * تحديد الوردية من الوقت
     */
    determineShift(time) {
        if (!time) return 'أولى';
        try {
            const normalized = this.normalizeLatinDigits(time);
            const hourPart = (normalized.split(':')[0] || '').replace(/[^\d]/g, '');
            const hour = parseInt(hourPart, 10);
            if (Number.isNaN(hour)) return 'أولى';
            if (hour >= 6 && hour < 14) return 'أولى';
            if (hour >= 14 && hour < 22) return 'ثانية';
            return 'ثالثة';
        } catch {
            return 'أولى';
        }
    },

    /**
     * استخراج الجزء المصاب من الوصف
     */
    extractInjuredPart(description) {
        // يمكن تحسين هذا لاحقاً باستخدام AI أو قواعد محددة
        return 'غير محدد';
    },

    /**
     * استخراج المعدة المتسببة من الوصف
     */
    extractEquipmentCause(description) {
        // يمكن تحسين هذا لاحقاً باستخدام AI أو قواعد محددة
        return 'غير محدد';
    },

    /**
     * إنشاء سجل جديد من حادث
     */
    createRegistryEntry(incident) {
        if (!incident || !incident.id) return null;

        const sequentialNumber = this.generateRegistrySequentialNumber();
        const incidentDate = this.getIncidentDateValue(incident) || new Date();
        const incidentTime = incidentDate && !Number.isNaN(incidentDate.getTime())
            ? incidentDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            : '';
        const incidentDay = (incidentDate && !Number.isNaN(incidentDate.getTime()))
            ? this.getDayName(incidentDate)
            : 'غير محدد';

        // الحصول على بيانات الموظف
        let employeeCode = incident.affectedCode || incident.employeeCode || '';
        let employeeName = incident.affectedName || '';
        let employeeJob = incident.affectedJobTitle || '';
        let employeeDepartment = incident.affectedDepartment || '';

        if (employeeCode) {
            const employee = this.getEmployeeByCode(employeeCode);
            if (employee) {
                employeeName = employee.name || employeeName;
                employeeJob = employee.job || employeeJob;
                employeeDepartment = employee.department || employeeDepartment;
            }
        }

        // تعيين تواريخ الإجازة (افتراضي: تاريخ الحادث)
        const incidentIsoDate = (incidentDate && !Number.isNaN(incidentDate.getTime()))
            ? incidentDate.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
        const leaveStartDate = incident.leaveStartDate || incidentIsoDate;
        const returnToWorkDate = incident.returnToWorkDate || incidentIsoDate;

        // حساب إجمالي أيام الإجازة من تاريخ بداية الإجازة حتى تاريخ العودة
        const totalLeaveDays = this.calculateTotalLeaveDays(leaveStartDate, returnToWorkDate);

        return {
            id: Utils.generateId('INCR'),
            sequentialNumber: sequentialNumber,
            incidentId: incident.id,
            factory: incident.siteName || incident.location || 'غير محدد',
            incidentLocation: incident.sublocationName || incident.sublocation || incident.location || 'غير محدد',
            incidentDate: (incidentDate && !Number.isNaN(incidentDate.getTime())) ? incidentDate.toISOString() : new Date().toISOString(),
            incidentDay: incidentDay,
            incidentTime: incidentTime,
            shift: this.determineShift(incidentTime),
            employeeCode: employeeCode,
            employeeName: employeeName,
            employeeJob: employeeJob,
            employeeDepartment: employeeDepartment,
            incidentDetails: incident.description || 'غير محدد',
            injuredPart: this.extractInjuredPart(incident.description || ''),
            equipmentCause: this.extractEquipmentCause(incident.description || ''),
            leaveStartDate: leaveStartDate,
            returnToWorkDate: returnToWorkDate,
            totalLeaveDays: totalLeaveDays,
            status: incident.status || 'مفتوح',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    },

    /**
     * إضافة حادث للسجل (يُستدعى تلقائياً)
     */
    async addToRegistry(incident) {
        const existingEntry = this.registryData.find(r => r.incidentId === incident.id);
        if (existingEntry) {
            return this.updateRegistryEntry(incident);
        }
        const entry = this.createRegistryEntry(incident);
        if (entry) {
            this.registryData.push(entry);
            await this.saveRegistryData();
            Utils.safeLog(`✅ تم تسجيل الحادث #${entry.sequentialNumber} في السجل`);
        }
    },

    /**
     * تحديث سجل حادث
     */
    async updateRegistryEntry(incident) {
        const entryIndex = this.registryData.findIndex(r => r.incidentId === incident.id);
        if (entryIndex === -1) {
            return this.addToRegistry(incident);
        }

        const entry = this.registryData[entryIndex];
        const incidentDate = this.getIncidentDateValue(incident) || new Date();
        const incidentTime = incidentDate && !Number.isNaN(incidentDate.getTime())
            ? incidentDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            : '';

        // الحصول على بيانات الموظف
        let employeeCode = incident.affectedCode || incident.employeeCode || entry.employeeCode;
        let employeeName = incident.affectedName || entry.employeeName;
        let employeeJob = incident.affectedJobTitle || entry.employeeJob;
        let employeeDepartment = incident.affectedDepartment || entry.employeeDepartment;

        if (employeeCode) {
            const employee = this.getEmployeeByCode(employeeCode);
            if (employee) {
                employeeName = employee.name || employeeName;
                employeeJob = employee.job || employeeJob;
                employeeDepartment = employee.department || employeeDepartment;
            }
        }

        // تحديث البيانات
        entry.factory = incident.siteName || incident.location || entry.factory;
        entry.incidentLocation = incident.sublocationName || incident.sublocation || incident.location || entry.incidentLocation;
        entry.incidentDate = (incidentDate && !Number.isNaN(incidentDate.getTime())) ? incidentDate.toISOString() : (entry.incidentDate || new Date().toISOString());
        entry.incidentDay = (incidentDate && !Number.isNaN(incidentDate.getTime())) ? this.getDayName(incidentDate) : (entry.incidentDay || 'غير محدد');
        entry.incidentTime = incidentTime;
        entry.shift = this.determineShift(incidentTime);
        entry.employeeCode = employeeCode;
        entry.employeeName = employeeName;
        entry.employeeJob = employeeJob;
        entry.employeeDepartment = employeeDepartment;
        entry.incidentDetails = incident.description || entry.incidentDetails;
        entry.injuredPart = this.extractInjuredPart(incident.description || '');
        entry.equipmentCause = this.extractEquipmentCause(incident.description || '');

        // تحديث تواريخ الإجازة إذا كانت متوفرة في الحادث، وإلا نستخدم القيم الموجودة أو القيم الافتراضية
        const incidentIsoDate = (incidentDate && !Number.isNaN(incidentDate.getTime()))
            ? incidentDate.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
        const leaveStartDate = incident.leaveStartDate || entry.leaveStartDate || incidentIsoDate;
        const returnToWorkDate = incident.returnToWorkDate || entry.returnToWorkDate || incidentIsoDate;
        entry.leaveStartDate = leaveStartDate;
        entry.returnToWorkDate = returnToWorkDate;

        // حساب إجمالي أيام الإجازة من تاريخ بداية الإجازة حتى تاريخ العودة
        entry.totalLeaveDays = this.calculateTotalLeaveDays(leaveStartDate, returnToWorkDate);
        entry.status = incident.status || 'مفتوح';
        entry.updatedAt = new Date().toISOString();

        this.registryData[entryIndex] = entry;
        await this.saveRegistryData();
    },

    /**
     * حذف سجل حادث
     */
    async removeFromRegistry(incidentId) {
        const entryIndex = this.registryData.findIndex(r => r.incidentId === incidentId);
        if (entryIndex !== -1) {
            this.registryData.splice(entryIndex, 1);
            await this.saveRegistryData();
        }
    },

    /**
     * مزامنة السجل مع الحوادث الموجودة
     */
    async syncRegistryWithIncidents() {
        try {
            if (!AppState || !AppState.appData) {
                Utils.safeWarn('AppState غير متاح للمزامنة');
                return;
            }
            const incidents = AppState.appData.incidents || [];
            if (!Array.isArray(incidents)) {
                Utils.safeWarn('قائمة الحوادث غير صحيحة');
                return;
            }

            // مزامنة محدودة لتجنب التعطيل
            const maxSync = 50; // حد أقصى 50 حادث في المرة الواحدة
            const incidentsToSync = incidents.slice(0, maxSync);

            for (const incident of incidentsToSync) {
                if (!incident || !incident.id) continue;
                try {
                    const existingEntry = this.registryData.find(r => r.incidentId === incident.id);
                    if (!existingEntry) {
                        await this.addToRegistry(incident);
                    } else {
                        await this.updateRegistryEntry(incident);
                    }
                } catch (incidentError) {
                    Utils.safeWarn(`خطأ في مزامنة حادث ${incident.id}:`, incidentError);
                    continue;
                }
            }

            if (incidents.length > maxSync) {
                Utils.safeLog(`تمت مزامنة ${maxSync} من ${incidents.length} حادث`);
            }
        } catch (error) {
            Utils.safeError('خطأ في مزامنة السجل:', error);
        }
    },

    currentTab: 'annual-log',

    async load() {
        // إضافة مستمع لتغيير اللغة
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        try {
            const section = document.getElementById('incidents-section');
            if (!section) {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError(' قسم incidents-section غير موجود!');
                } else {
                    console.error(' قسم incidents-section غير موجود!');
                }
                return;
            }
            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ مديول Incidents يكتب في قسم: incidents-section');
            }

            // تهيئة بيانات السجل
            try {
                this.initRegistry();
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('خطأ في تهيئة السجل:', error);
                } else {
                    console.error('خطأ في تهيئة السجل:', error);
                }
                // المتابعة حتى لو فشلت التهيئة
                this.registryData = [];
            }

            // مزامنة السجل مع الحوادث الموجودة فوراً - تحسين المزامنة
            // استخدام requestAnimationFrame لتسريع البدء
            requestAnimationFrame(() => {
                this.syncRegistryWithIncidents().catch(error => {
                    if (typeof Utils !== 'undefined' && Utils.safeError) {
                        Utils.safeError('خطأ في مزامنة السجل:', error);
                    } else {
                        console.error('خطأ في مزامنة السجل:', error);
                    }
                });
            });

            // عرض المحتوى
            let mainViewContent = '';
            try {
                mainViewContent = await this.renderMainView();
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('خطأ في عرض الواجهة الرئيسية:', error);
                } else {
                    console.error('خطأ في عرض الواجهة الرئيسية:', error);
                }
                mainViewContent = '<div class="content-card"><div class="card-body"><p class="text-red-500">حدث خطأ في تحميل الواجهة. يرجى تحديث الصفحة.</p></div></div>';
            }

            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-exclamation-triangle ml-3"></i>
                                إدارة الحوادث
                            </h1>
                            <p class="section-subtitle">تسجيل ومتابعة حوادث السلامة المهنية</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button id="add-incident-notification-btn" class="btn-secondary">
                                <i class="fas fa-bell ml-2"></i>
                                إخطار عن حادث
                            </button>
                            <button id="open-investigation-form-btn" class="btn-primary">
                                <i class="fas fa-search ml-2"></i>
                                التحقيق في الحادث
                            </button>
                        </div>
                    </div>
                </div>
                <div id="incidents-content" class="mt-6">
                    ${mainViewContent}
                </div>
            `;
            this.applyModuleI18n(section);
            this.ensureI18nObservers(section);

            // إعداد المستمعين
            try {
                this.setupEventListeners();
                this.switchTab(this.currentTab);
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('خطأ في إعداد المستمعين:', error);
                } else {
                    console.error('خطأ في إعداد المستمعين:', error);
                }
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('خطأ فادح في تحميل مديول الحوادث:', error);
            } else {
                console.error('خطأ فادح في تحميل مديول الحوادث:', error);
            }
            const section = document.getElementById('incidents-section');
            if (section) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="text-center py-8">
                                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                                <h2 class="text-xl font-bold text-gray-800 mb-2">حدث خطأ في تحميل مديول الحوادث</h2>
                                <p class="text-gray-600 mb-4">${error.message || 'خطأ غير معروف'}</p>
                                <button onclick="location.reload()" class="btn-primary">
                                    <i class="fas fa-sync ml-2"></i>
                                    إعادة تحميل الصفحة
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                this.applyModuleI18n(section);
            }
        }
    },

    async renderMainView() {
        // الحصول على التبويبات المسموح بها للمستخدم
        const allowedTabs = this.getAllowedTabs();

        return `
            <div class="tabs-container">
                <div class="tabs-nav">
                    ${allowedTabs.includes('registry') ? `
                    <button class="tab-btn active" data-tab="registry" onclick="Incidents.switchTab('registry')">
                        <i class="fas fa-clipboard-list"></i>
                        سجل الحوادث
                    </button>
                    ` : ''}
                    ${allowedTabs.includes('detailed-log') ? `
                    <button class="tab-btn ${allowedTabs.includes('registry') ? '' : 'active'}" data-tab="detailed-log" onclick="Incidents.switchTab('detailed-log')">
                        <i class="fas fa-clipboard-list"></i>
                        سجل الحوادث التفصيلي
                    </button>
                    ` : ''}
                    ${allowedTabs.includes('incidents-list') ? `
                    <button class="tab-btn ${!allowedTabs.includes('registry') && !allowedTabs.includes('detailed-log') ? 'active' : ''}" data-tab="incidents-list" onclick="Incidents.switchTab('incidents-list')">
                        <i class="fas fa-list"></i>
                        قائمة الحوادث
                    </button>
                    ` : ''}
                    ${allowedTabs.includes('annual-log') ? `
                    <button class="tab-btn" data-tab="annual-log" onclick="Incidents.switchTab('annual-log')">
                        <i class="fas fa-calendar-alt"></i>
                        سجل الحوادث السنوي
                    </button>
                    ` : ''}
                    ${allowedTabs.includes('analysis') ? `
                    <button class="tab-btn" data-tab="analysis" onclick="Incidents.switchTab('analysis')">
                        <i class="fas fa-chart-line"></i>
                        تحليل الحوادث
                    </button>
                    ` : ''}
                    ${allowedTabs.includes('approvals') ? `
                    <button class="tab-btn" data-tab="approvals" onclick="Incidents.switchTab('approvals')">
                        <i class="fas fa-check-circle"></i>
                        الموافقات
                    </button>
                    ` : ''}
                    ${allowedTabs.includes('safety-alerts') ? `
                    <button class="tab-btn" data-tab="safety-alerts" onclick="Incidents.switchTab('safety-alerts')">
                        <i class="fas fa-exclamation-triangle"></i>
                        التنبيه عن حادث
                    </button>
                    ` : ''}
                </div>
            </div>
            <div id="incidents-tab-content" class="mt-6">
                ${await this.renderTabContent(allowedTabs[0] || 'incidents-list')}
            </div>
        `;
    },

    // الحصول على التبويبات المسموح بها للمستخدم
    getAllowedTabs() {
        const user = AppState.currentUser;
        if (!user) return ['incidents-list']; // افتراضي: قائمة الحوادث فقط

        // مدير النظام لديه صلاحيات كاملة
        if (user.role === 'admin' ||
            (user.permissions && (user.permissions.admin === true || user.permissions['manage-modules'] === true))) {
            return ['registry', 'detailed-log', 'incidents-list', 'annual-log', 'analysis', 'approvals', 'safety-alerts'];
        }

        // التحقق من وجود صلاحية الوصول للمديول أولاً
        if (typeof Permissions !== 'undefined' && !Permissions.hasAccess('incidents')) {
            return [];
        }

        // الحصول على الصلاحيات التفصيلية من نظام الصلاحيات الجديد
        const allowedTabs = [];
        const allTabs = ['registry', 'detailed-log', 'incidents-list', 'annual-log', 'analysis', 'approvals', 'safety-alerts'];

        allTabs.forEach(tab => {
            if (typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission('incidents', tab)) {
                allowedTabs.push(tab);
            }
        });

        // إذا لم توجد صلاحيات تفصيلية، نعطي الوصول الكامل (للتوافق مع المستخدمين القدامى)
        if (allowedTabs.length === 0) {
            return allTabs;
        }

        return allowedTabs;
    },

    async switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.tabs-nav .tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Render tab content
        const contentContainer = document.getElementById('incidents-tab-content');
        if (contentContainer) {
            contentContainer.innerHTML = await this.renderTabContent(tabName);
            this.applyModuleI18n(contentContainer);
            this.setupTabEventListeners(tabName);
        }
    },

    async renderTabContent(tabName) {
        try {
            // التحقق من الصلاحيات قبل عرض المحتوى
            const allowedTabs = this.getAllowedTabs();
            if (!allowedTabs.includes(tabName)) {
                return `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="text-center py-8">
                                <i class="fas fa-lock text-4xl text-gray-400 mb-4"></i>
                                <p class="text-gray-600">ليس لديك صلاحية للوصول إلى هذا التبويب.</p>
                                <p class="text-sm text-gray-500 mt-2">يرجى التواصل مع مدير النظام للحصول على الصلاحيات المطلوبة.</p>
                            </div>
                        </div>
                    </div>
                `;
            }

            switch (tabName) {
                case 'registry':
                    return await this.renderRegistryTab();
                case 'detailed-log':
                    return await this.renderDetailedLogTab();
                case 'incidents-list':
                    return await this.renderIncidentsListTab();
                case 'annual-log':
                    return await this.renderAnnualLogTab();
                case 'analysis':
                    return await this.renderAnalysisTab();
                case 'approvals':
                    return await this.renderApprovalsTab();
                case 'safety-alerts':
                    return await this.renderSafetyAlertsTab();
                default:
                    return await this.renderIncidentsListTab();
            }
        } catch (error) {
            Utils.safeError(`خطأ في عرض محتوى التبويب ${tabName}:`, error);
            return `
                <div class="content-card">
                    <div class="card-body">
                        <div class="text-center py-8">
                            <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                            <h2 class="text-xl font-bold text-gray-800 mb-2">حدث خطأ في تحميل المحتوى</h2>
                            <p class="text-gray-600">${error.message || 'خطأ غير معروف'}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    async renderAnnualLogTab() {
        const analytics = this.buildThreeYearAnalytics();
        const { yearlyStats, totals, severityTotals } = analytics;
        const improvementInfo = this.formatImprovementValue(analytics.currentImprovement);
        const hasIncidents = totals.totalIncidents > 0;

        const yearlyRows = yearlyStats.map((stat) => {
            const improvement = this.formatImprovementValue(stat.improvementVsPrevious);
            return `
                <tr>
                    <td>${stat.year}</td>
                    <td>${stat.total}</td>
                    <td>${stat.closed}</td>
                    <td>${stat.closureRate.toFixed(1)}%</td>
                    <td>
                        <div class="space-y-1 text-xs">
                            <div><span class="inline-block w-2 h-2 rounded-full bg-red-500 ml-1"></span>عالية: ${stat.severity.high}</div>
                            <div><span class="inline-block w-2 h-2 rounded-full bg-yellow-500 ml-1"></span>متوسطة: ${stat.severity.medium}</div>
                            <div><span class="inline-block w-2 h-2 rounded-full bg-blue-500 ml-1"></span>منخفضة: ${stat.severity.low}</div>
                            <div><span class="inline-block w-2 h-2 rounded-full bg-gray-500 ml-1"></span>أخرى: ${stat.severity.other}</div>
                        </div>
                    </td>
                    <td>
                        <span class="font-semibold ${improvement.className}">${improvement.label}</span>
                    </td>
                </tr>
            `;
        }).join('');

        const yearlyTableBody = hasIncidents
            ? yearlyRows
            : '<tr><td colspan="6" class="text-center text-gray-500 py-6">لا توجد بيانات مسجلة لآخر ٣ سنوات.</td></tr>';

        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between gap-3 flex-wrap">
                        <h2 class="card-title">
                            <i class="fas fa-calendar-alt ml-2"></i>
                            سجل الحوادث السنوي (آخر ٣ سنوات)
                        </h2>
                        <div class="flex items-center gap-2">
                            <button id="incidents-report-preview" class="btn-secondary">
                                <i class="fas fa-eye ml-2"></i>
                                معاينة التقرير
                            </button>
                            <button class="btn-primary" data-incidents-export="pdf">
                                <i class="fas fa-file-pdf ml-2"></i>
                                PDF
                            </button>
                            <button class="btn-primary" data-incidents-export="excel">
                                <i class="fas fa-file-excel ml-2"></i>
                                Excel
                            </button>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div class="border border-gray-200 rounded-lg p-4 bg-white">
                            <p class="text-xs text-gray-500 mb-1">إجمالي الحوادث</p>
                            <p class="text-3xl font-bold text-gray-900">${totals.totalIncidents}</p>
                            <p class="text-xs text-gray-400 mt-1">الفترة: ${totals.rangeLabel}</p>
                        </div>
                        <div class="border border-gray-200 rounded-lg p-4 bg-white">
                            <p class="text-xs text-gray-500 mb-1">معدل الإغلاق</p>
                            <p class="text-3xl font-bold text-green-600">${totals.closureRate.toFixed(1)}%</p>
                            <p class="text-xs text-gray-400 mt-1">عدد الحوادث المغلقة: ${totals.closedIncidents}</p>
                        </div>
                        <div class="border border-gray-200 rounded-lg p-4 bg-white">
                            <p class="text-xs text-gray-500 mb-1">معدل التحسين عن العام السابق</p>
                            <p class="text-3xl font-bold ${improvementInfo.className}">${improvementInfo.label}</p>
                            <p class="text-xs text-gray-400 mt-1">يعتمد على مقارنة ${yearlyStats[0]?.year || ''} مع ${yearlyStats[1]?.year || ''}</p>
                        </div>
                    </div>
                    <div class="table-wrapper" style="overflow-x: auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>السنة</th>
                                    <th>إجمالي الحوادث</th>
                                    <th>الحوادث المغلقة</th>
                                    <th>معدل الإغلاق</th>
                                    <th>توزيع الشدة</th>
                                    <th>معدل التحسين</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${yearlyTableBody}
                            </tbody>
                        </table>
                    </div>
                    <p class="text-xs text-gray-500 mt-3">
                        * يتم احتساب معدل التحسين بناءً على انخفاض عدد الحوادث الإجمالي مقارنة بالعام السابق (زيادة العدد تعني تراجع الأداء).
                    </p>
                </div>
            </div>
        `;
    },

    async renderDetailedLogTab() {
        const analytics = this.buildThreeYearAnalytics();
        const formatDate = (date) => {
            if (!date) return '-';
            try {
                if (typeof Utils !== 'undefined') {
                    if (typeof Utils.formatDateTime === 'function') {
                        return Utils.formatDateTime(date instanceof Date ? date.toISOString() : date);
                    }
                    if (typeof Utils.formatDate === 'function') {
                        return Utils.formatDate(date instanceof Date ? date.toISOString() : date);
                    }
                }
            } catch (error) {
                // تجاهل أي أخطاء تنسيق
            }
            const parsed = date instanceof Date ? date : new Date(date);
            if (Number.isNaN(parsed.getTime())) return '-';
            return parsed.toLocaleDateString('ar-SA');
        };

        const incidentRows = analytics.incidents.map(({ incident, date, year }) => {
            const severityClass = this.getSeverityBadgeClass(incident?.severity);
            const statusClass = this.getStatusBadgeClass(incident?.status);
            const incidentId = incident?.id || '';
            const actionsCell = incidentId ? `
                <div class="flex items-center gap-2 justify-end">
                    <button onclick="Incidents.viewIncident('${incidentId}')" class="btn-icon btn-icon-info" title="معاينة">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="Incidents.exportPDF('${incidentId}')" class="btn-icon btn-icon-primary" title="طباعة / PDF">
                        <i class="fas fa-print"></i>
                    </button>
                </div>
            ` : '<span class="text-xs text-gray-400">غير متاح</span>';
            return `
                <tr>
                    <td>${year}</td>
                    <td>${formatDate(date)}</td>
                    <td>${Utils.escapeHTML(incident?.title || '-')}</td>
                    <td>${Utils.escapeHTML(incident?.location || '-')}</td>
                    <td>
                        <span class="badge badge-${severityClass}">
                            ${Utils.escapeHTML(incident?.severity || '-')}
                        </span>
                    </td>
                    <td>
                        <span class="badge badge-${statusClass}">
                            ${Utils.escapeHTML(incident?.status || '-')}
                        </span>
                    </td>
                    <td>${actionsCell}</td>
                </tr>
            `;
        }).join('');

        const incidentTableBody = analytics.incidents.length === 0
            ? '<tr><td colspan="7" class="text-center text-gray-500 py-6">لا توجد حوادث مسجلة خلال آخر ٣ سنوات.</td></tr>'
            : incidentRows;

        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-clipboard-list ml-2"></i>
                            سجل الحوادث التفصيلي (آخر ٣ سنوات)
                        </h2>
                        <span class="text-xs text-gray-500">
                            ${analytics.incidents.length} حادث خلال الفترة
                        </span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-wrapper" style="overflow-x: auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>السنة</th>
                                    <th>التاريخ</th>
                                    <th>العنوان</th>
                                    <th>الموقع</th>
                                    <th>الشدة</th>
                                    <th>الحالة</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${incidentTableBody}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    async renderIncidentsListTab() {
        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-list ml-2"></i>
                            قائمة الحوادث
                        </h2>
                        <div class="flex items-center gap-4">
                            <input 
                                type="text" 
                                id="incidents-search" 
                                class="form-input" 
                                style="max-width: 300px;"
                                placeholder="البحث..."
                            >
                            <select id="incidents-filter-status" class="form-input" style="max-width: 200px;">
                                <option value="">جميع الحالات</option>
                                <option value="مفتوح">مفتوح</option>
                                <option value="قيد التحقيق">قيد التحقيق</option>
                                <option value="مكتمل">مكتمل</option>
                                <option value="مغلق">مغلق</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div id="incidents-table-container">
                        <div class="empty-state">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p class="text-gray-500">جاري التحميل...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async renderAnalysisTab() {
        // Get analysis settings from backend or use defaults
        const analysisSettings = await this.getAnalysisSettings();

        return `
            <div class="space-y-6">
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title">
                                <i class="fas fa-chart-line ml-2"></i>
                                تحليل الحوادث
                            </h2>
                            ${this.isAdmin() ? `
                                <button id="edit-analysis-settings-btn" class="btn-secondary">
                                    <i class="fas fa-cog ml-2"></i>
                                    إعدادات التحليل
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="card-body">
                        <div id="incident-analysis-content">
                            ${this.renderAnalysisContent(analysisSettings)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض تبويب سجل الحوادث
     */
    async renderRegistryTab() {
        try {
            return this.renderRegistryContent();
        } catch (error) {
            Utils.safeError('خطأ في عرض تبويب السجل:', error);
            return `
                <div class="content-card">
                    <div class="card-body">
                        <div class="text-center py-8">
                            <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                            <h2 class="text-xl font-bold text-gray-800 mb-2">حدث خطأ في تحميل سجل الحوادث</h2>
                            <p class="text-gray-600">${error.message || 'خطأ غير معروف'}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * عرض محتوى سجل الحوادث
     */
    renderRegistryContent() {
        const totalCount = this.registryData.length;
        const openCount = this.registryData.filter(r => r.status === 'مفتوح').length;
        const investigatingCount = this.registryData.filter(r => r.status === 'قيد التحقيق').length;
        const completedCount = this.registryData.filter(r => r.status === 'مكتمل').length;
        const closedCount = this.registryData.filter(r => r.status === 'مغلق').length;

        return `
            <!-- أزرار التصدير والإدخال -->
            <div class="flex justify-between items-center gap-2 mb-4">
                <button id="incidents-registry-add-manual" class="btn-success">
                    <i class="fas fa-plus-circle ml-2"></i>
                    إضافة حادث / Add Incident
                </button>
                <div class="flex gap-2">
                    <button id="incidents-registry-export-excel" class="btn-secondary">
                        <i class="fas fa-file-excel ml-2"></i>
                        تصدير Excel
                    </button>
                    <button id="incidents-registry-export-pdf" class="btn-primary">
                        <i class="fas fa-file-pdf ml-2"></i>
                        تصدير PDF
                    </button>
                </div>
            </div>
            
            <!-- بطاقات الإحصائيات -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="kpi-card kpi-info">
                    <div class="kpi-icon"><i class="fas fa-list-ol"></i></div>
                    <div class="kpi-content">
                        <h3 class="kpi-label">إجمالي السجلات</h3>
                        <p class="kpi-value">${totalCount}</p>
                    </div>
                </div>
                <div class="kpi-card kpi-primary">
                    <div class="kpi-icon"><i class="fas fa-folder-open"></i></div>
                    <div class="kpi-content">
                        <h3 class="kpi-label">حوادث مفتوحة</h3>
                        <p class="kpi-value">${openCount}</p>
                    </div>
                </div>
                        <div class="kpi-card kpi-warning">
                    <div class="kpi-icon"><i class="fas fa-search"></i></div>
                    <div class="kpi-content">
                        <h3 class="kpi-label">قيد التحقيق</h3>
                        <p class="kpi-value">${investigatingCount}</p>
                    </div>
                </div>
                <div class="kpi-card kpi-info">
                    <div class="kpi-icon"><i class="fas fa-check-double"></i></div>
                    <div class="kpi-content">
                        <h3 class="kpi-label">مكتملة</h3>
                        <p class="kpi-value">${completedCount}</p>
                    </div>
                </div>
                <div class="kpi-card kpi-success">
                    <div class="kpi-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="kpi-content">
                        <h3 class="kpi-label">حوادث مغلقة</h3>
                        <p class="kpi-value">${closedCount}</p>
                    </div>
                </div>
            </div>
            
            <!-- فلاتر البحث -->
            <div class="content-card mb-4">
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-search ml-2"></i>بحث
                            </label>
                            <input type="text" id="incidents-registry-search" class="form-input" placeholder="ابحث برقم السجل أو اسم الموظف...">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-filter ml-2"></i>الحالة
                            </label>
                            <select id="incidents-registry-filter-status" class="form-input">
                                <option value="">جميع الحالات</option>
                                <option value="مفتوح">مفتوح</option>
                                <option value="قيد التحقيق">قيد التحقيق</option>
                                <option value="مكتمل">مكتمل</option>
                                <option value="مغلق">مغلق</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-calendar ml-2"></i>من تاريخ
                            </label>
                            <input type="date" id="incidents-registry-filter-date-from" class="form-input">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-calendar ml-2"></i>إلى تاريخ
                            </label>
                            <input type="date" id="incidents-registry-filter-date-to" class="form-input">
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- جدول السجل -->
            <div class="content-card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-table ml-2"></i>
                        جدول سجل الحوادث (${totalCount} سجل)
                    </h2>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        ${this.renderRegistryTable()}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض جدول السجل
     */
    renderRegistryTable() {
        if (this.registryData.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد سجلات حتى الآن</p>
                    <p class="text-sm text-gray-400 mt-2">سيتم إضافة السجلات تلقائياً عند إنشاء حوادث جديدة</p>
                </div>
            `;
        }

        const sortedData = [...this.registryData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('ar-SA');
            } catch {
                return '-';
            }
        };

        let tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>مسلسل</th>
                        <th>المصنع</th>
                        <th>مكان الحادث</th>
                        <th>تاريخ الحادث</th>
                        <th>يوم الحادث</th>
                        <th>وقت الحادث</th>
                        <th>الوردية</th>
                        <th>كود الموظف</th>
                        <th>اسم الموظف</th>
                        <th>الوظيفة</th>
                        <th>الإدارة / القسم</th>
                        <th>تفاصيل الحادث</th>
                        <th>الجزء المصاب</th>
                        <th>المعدة المتسببة</th>
                        <th>إجمالي أيام الإجازة</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedData.forEach(entry => {
            const statusClass = entry.status === 'مفتوح' ? 'bg-blue-100 text-blue-800' : 
                               entry.status === 'قيد التحقيق' ? 'bg-yellow-100 text-yellow-800' :
                               entry.status === 'مكتمل' ? 'bg-green-100 text-green-800' :
                               'bg-gray-100 text-gray-800';

            tableHTML += `
                <tr>
                    <td>${entry.sequentialNumber || '-'}</td>
                    <td>${Utils.escapeHTML(entry.factory || '-')}</td>
                    <td>${Utils.escapeHTML(entry.incidentLocation || '-')}</td>
                    <td>${formatDate(entry.incidentDate)}</td>
                    <td>${Utils.escapeHTML(entry.incidentDay || '-')}</td>
                    <td>${Utils.escapeHTML(entry.incidentTime || '-')}</td>
                    <td>${Utils.escapeHTML(entry.shift || '-')}</td>
                    <td>${Utils.escapeHTML(entry.employeeCode || '-')}</td>
                    <td>${Utils.escapeHTML(entry.employeeName || '-')}</td>
                    <td>${Utils.escapeHTML(entry.employeeJob || '-')}</td>
                    <td>${Utils.escapeHTML(entry.employeeDepartment || '-')}</td>
                    <td>${Utils.escapeHTML((entry.incidentDetails || '-').substring(0, 50))}${(entry.incidentDetails || '').length > 50 ? '...' : ''}</td>
                    <td>${Utils.escapeHTML(entry.injuredPart || '-')}</td>
                    <td>${Utils.escapeHTML(entry.equipmentCause || '-')}</td>
                    <td>${entry.totalLeaveDays || 0} يوم</td>
                    <td>
                        <div class="flex items-center gap-2">
                            <button onclick="Incidents.viewRegistryEntry('${entry.id}')" class="btn-icon btn-icon-info" title="عرض التفاصيل">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${entry.incidentId ? `
                                <button onclick="Incidents.viewIncident('${entry.incidentId}')" class="btn-icon btn-icon-primary" title="عرض الحادث">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </button>
                                <button onclick="if(typeof Incidents !== 'undefined' && typeof Incidents.showInvestigationForm === 'function') { Incidents.showInvestigationForm('${entry.incidentId}'); } else { alert('نموذج التحقيق غير متاح'); }" class="btn-icon btn-icon-warning" title="التحقيق في الحادث">
                                    <i class="fas fa-search"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        return tableHTML;
    },

    /**
     * عرض تبويب التنبيهات عن الحوادث (Safety Alerts)
     */
    async renderSafetyAlertsTab() {
        try {
            // تحميل التنبيهات من Backend
            let alerts = [];
            
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.callAppsScript) {
                try {
                    const result = await GoogleIntegration.callAppsScript('getAllSafetyAlerts', {});
                    if (result && result.success && result.data) {
                        alerts = result.data;
                        if (!AppState.appData) AppState.appData = {};
                        AppState.appData.safetyAlerts = alerts;
                    }
                } catch (error) {
                    Utils.safeWarn('خطأ في تحميل التنبيهات من Backend:', error);
                }
            }

            // استخدام البيانات المحلية إذا لم تكن موجودة في Backend
            if (alerts.length === 0) {
                alerts = AppState.appData?.safetyAlerts || [];
            }

            // ترتيب التنبيهات حسب التاريخ (الأحدث أولاً)
            alerts.sort((a, b) => {
                const dateA = new Date(a.incidentDate || a.createdAt || 0);
                const dateB = new Date(b.incidentDate || b.createdAt || 0);
                return dateB - dateA;
            });

            const canCreate = this.canCreateSafetyAlert();

            return `
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-exclamation-circle ml-2"></i>
                            Safety Alerts
                        </h2>
                        <div class="flex items-center gap-2">
                            ${canCreate ? `
                            <button class="btn-primary" onclick="Incidents.showSafetyAlertForm()">
                                <i class="fas fa-plus ml-2"></i>
                                إنشاء Safety Alert
                            </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="card-body">
                        <p class="text-gray-600 mb-4">
                            Safety Alert هو أداة توعوية لنشر الوعي ومشاركة الدروس المستفادة ومنع تكرار الحوادث.
                        </p>
                        <div class="table-wrapper" style="overflow-x: auto;">
                            ${alerts.length > 0 ? `
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>رقم Safety Alert</th>
                                        <th>نوع الحادث</th>
                                        <th>تاريخ الحادث</th>
                                        <th>مكان الحادث</th>
                                        <th>الحالة</th>
                                        <th>إعداد</th>
                                        <th>اعتماد</th>
                                        <th>تاريخ الإصدار</th>
                                        <th>الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${alerts.map(alert => `
                                        <tr>
                                            <td>${Utils.escapeHTML(alert.alertNumber || alert.sequentialNumber || '')}</td>
                                            <td>${Utils.escapeHTML(alert.incidentType || '')}</td>
                                            <td>${alert.incidentDate ? new Date(alert.incidentDate).toLocaleDateString('ar-SA') : ''}</td>
                                            <td>${Utils.escapeHTML(alert.incidentLocation || '')}</td>
                                            <td>
                                                <span class="badge badge-${alert.status === 'معتمد' ? 'success' : 'warning'}">
                                                    ${Utils.escapeHTML(alert.status || 'مسودة')}
                                                </span>
                                            </td>
                                            <td>${Utils.escapeHTML(alert.preparedBy || '')}</td>
                                            <td>${Utils.escapeHTML(alert.approvedBy || '-')}</td>
                                            <td>${alert.issueDate ? new Date(alert.issueDate).toLocaleDateString('ar-SA') : '-'}</td>
                                            <td>
                                                <div class="flex items-center gap-2">
                                                    <button onclick="Incidents.viewSafetyAlert('${alert.id}')" class="btn-icon btn-icon-info" title="عرض">
                                                        <i class="fas fa-eye"></i>
                                                    </button>
                                                    ${alert.status !== 'معتمد' && canCreate ? `
                                                    <button onclick="Incidents.editSafetyAlert('${alert.id}')" class="btn-icon btn-icon-warning" title="تعديل">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                    ` : ''}
                                                    ${alert.status !== 'معتمد' && this.canApproveSafetyAlert() ? `
                                                    <button onclick="Incidents.approveSafetyAlert('${alert.id}')" class="btn-icon btn-icon-success" title="اعتماد">
                                                        <i class="fas fa-check"></i>
                                                    </button>
                                                    ` : ''}
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            ` : `
                            <div class="empty-state">
                                <i class="fas fa-exclamation-circle text-4xl text-gray-300 mb-4"></i>
                                <p class="text-gray-500">لا توجد Safety Alerts حتى الآن</p>
                                ${canCreate ? `
                                <button class="btn-primary mt-4" onclick="Incidents.showSafetyAlertForm()">
                                    <i class="fas fa-plus ml-2"></i>
                                    إنشاء Safety Alert جديد
                                </button>
                                ` : ''}
                            </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            Utils.safeError('خطأ في عرض تبويب Safety Alerts:', error);
            return `
                <div class="content-card">
                    <div class="card-body">
                        <div class="text-center py-8">
                            <i class="fas fa-exclamation-circle text-4xl text-red-500 mb-4"></i>
                            <h2 class="text-xl font-bold text-gray-800 mb-2">حدث خطأ في تحميل Safety Alerts</h2>
                            <p class="text-gray-600">${error.message || 'خطأ غير معروف'}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * عرض Safety Alert (المحدث)
     */
    async viewSafetyAlert(alertId) {
        const alert = (AppState.appData?.safetyAlerts || []).find(a => a.id === alertId);
        if (!alert) {
            Notification.error('Safety Alert غير موجود');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        // جلب اسم الشركة من الإعدادات
        const companyName = AppState?.companySettings?.name || AppState?.companyName || '';
        const companySecondaryNameRaw = AppState?.companySettings?.secondaryName;
        const companySecondaryName = (companySecondaryNameRaw !== undefined && companySecondaryNameRaw !== null)
            ? String(companySecondaryNameRaw).trim()
            : '';
        const companyLogo = AppState?.companyLogo || '';

        modal.innerHTML = `
            <style>
                .safety-alert-view-field {
                    background: white;
                    padding: 16px;
                    border-radius: 10px;
                    border: 2px solid #e5e7eb;
                    margin-bottom: 20px;
                    min-height: 60px;
                }
                .safety-alert-view-grey-bar {
                    background: #9ca3af;
                    height: 4px;
                    margin: 20px 0;
                    border-radius: 2px;
                }
                .safety-alert-view-grey-label {
                    background: #9ca3af;
                    color: white;
                    padding: 12px;
                    text-align: center;
                    font-weight: 600;
                    border-radius: 4px;
                }
                .safety-alert-view-yellow-box {
                    background: #fbbf24;
                    padding: 8px;
                    text-align: center;
                    border-radius: 6px;
                    border: 2px solid #f59e0b;
                    display: inline-block;
                    max-width: 100%;
                }
                .safety-alert-view-yellow-box img {
                    max-width: 100%;
                    max-height: 350px;
                    border-radius: 4px;
                    object-fit: contain;
                    display: block;
                }
                .safety-alert-view-header-box {
                    background: #9ca3af;
                    color: white;
                    padding: 16px;
                    text-align: center;
                    font-weight: 700;
                    font-size: 1.2rem;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                .safety-alert-view-number {
                    color: #dc2626;
                    font-weight: 700;
                    font-size: 1.5rem;
                    text-align: center;
                    margin: 10px 0;
                }
            </style>
            <div class="modal-content" style="max-width: 1200px; width: 95%; background: #f8f9fa;">
                <div class="modal-header" style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 24px 30px;">
                    <h2 class="modal-title" style="font-size: 1.75rem; font-weight: 700; color: white;">
                        <i class="fas fa-exclamation-circle ml-2"></i>
                        عرض Safety Alert
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white; font-size: 1.5rem;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 30px;">
                    <!-- Header Section with Company Logo and Name -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="flex: 1; text-align: right;">
                            ${companyLogo ? `
                                <img src="${companyLogo}" alt="شعار الشركة" style="max-height: 80px; max-width: 200px; object-fit: contain;">
                            ` : ''}
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="color: #dc2626; font-weight: 700; font-size: 0.75rem; margin-bottom: 2px;">No</div>
                            <div class="safety-alert-view-number" style="font-size: 12px;">${Utils.escapeHTML(alert.sequentialNumber || '001')}</div>
                            <div class="safety-alert-view-header-box" style="margin-top: 10px;">${Utils.escapeHTML(alert.incidentType || '')}</div>
                        </div>
                        <div style="flex: 1; text-align: left;">
                            <div style="font-size: 14px; font-weight: 700; color: #1f2937; line-height: 1.3;">
                                ${Utils.escapeHTML(companyName || '')}
                                ${companySecondaryName ? `<div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-top: 2px;">${Utils.escapeHTML(companySecondaryName)}</div>` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="safety-alert-view-grey-bar"></div>
                    <div class="grid grid-cols-3 gap-4 mb-4">
                        <div>
                            <div class="safety-alert-view-grey-label">أين</div>
                            <div class="safety-alert-view-field" style="margin-top: 10px;">
                                ${Utils.escapeHTML(alert.incidentLocation || '')}
                            </div>
                        </div>
                        <div>
                            <div class="safety-alert-view-grey-label">متى</div>
                            <div class="safety-alert-view-field" style="margin-top: 10px;">
                                ${alert.incidentDate ? new Date(alert.incidentDate).toLocaleDateString('ar-SA') : ''}
                            </div>
                        </div>
                        <div>
                            <div class="safety-alert-view-grey-label">من</div>
                            <div class="safety-alert-view-field" style="margin-top: 10px;">
                                ${Utils.escapeHTML(alert.who || '')}
                            </div>
                        </div>
                    </div>

                    ${alert.locationImage || alert.causesImage ? `
                    <div class="safety-alert-view-grey-bar"></div>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        ${alert.locationImage ? `
                        <div style="text-align: center;">
                            <div style="margin-bottom: 8px; font-size: 0.9rem; font-weight: 600; color: #374151;">صورة توضيحية لمكان الحادث</div>
                            <div class="safety-alert-view-yellow-box">
                                <img src="${this.convertGoogleDriveLinkToPrintable(alert.locationImage)}" alt="صورة المكان" style="max-width: 100%; max-height: 350px; border-radius: 4px; object-fit: contain;">
                            </div>
                        </div>
                        ` : '<div></div>'}
                        ${alert.causesImage ? `
                        <div style="text-align: center;">
                            <div style="margin-bottom: 8px; font-size: 0.9rem; font-weight: 600; color: #374151;">صورة توضيحية لأسباب الحادث</div>
                            <div class="safety-alert-view-yellow-box">
                                <img src="${this.convertGoogleDriveLinkToPrintable(alert.causesImage)}" alt="صورة الأسباب" style="max-width: 100%; max-height: 350px; border-radius: 4px; object-fit: contain;">
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}

                    <div class="safety-alert-view-grey-bar"></div>
                    <div class="safety-alert-view-field">
                        <label style="display: block; font-weight: 600; margin-bottom: 10px;">وصف الحادث :</label>
                        <div style="white-space: pre-wrap;">${Utils.escapeHTML(alert.description || '')}</div>
                    </div>

                    ${alert.facts ? `
                    <div class="safety-alert-view-grey-bar"></div>
                    <div class="safety-alert-view-field">
                        <label style="display: block; font-weight: 600; margin-bottom: 10px;">حقائق عن الحادث :</label>
                        <div style="white-space: pre-wrap;">${Utils.escapeHTML(alert.facts)}</div>
                    </div>
                    ` : ''}

                    ${alert.causes ? `
                    <div class="safety-alert-view-grey-bar"></div>
                    <div class="safety-alert-view-field">
                        <label style="display: block; font-weight: 600; margin-bottom: 10px;">الأسباب :</label>
                        <div style="white-space: pre-wrap;">${Utils.escapeHTML(alert.causes)}</div>
                    </div>
                    ` : ''}

                    <div class="safety-alert-view-grey-bar"></div>
                    <div class="safety-alert-view-field">
                        <label style="display: block; font-weight: 600; margin-bottom: 10px;">الدروس المستفادة :</label>
                        <div style="white-space: pre-wrap;">${Utils.escapeHTML(alert.lessonsLearned || '')}</div>
                    </div>

                    <div class="safety-alert-view-grey-bar"></div>
                    <div class="safety-alert-view-field">
                        <label style="display: block; font-weight: 600; margin-bottom: 10px;">إجراءات منع تكرار الحدث :</label>
                        <div style="white-space: pre-wrap;">${Utils.escapeHTML(alert.preventiveMeasures || '')}</div>
                    </div>

                    <div class="safety-alert-view-grey-bar"></div>
                    <div class="grid grid-cols-4 gap-4 mb-4">
                        <div>
                            <div class="safety-alert-view-grey-label">رقم الإشعار</div>
                            <div class="safety-alert-view-field" style="margin-top: 10px;">
                                ${Utils.escapeHTML(alert.notificationNumber || alert.sequentialNumber || '')}
                            </div>
                        </div>
                        <div>
                            <div class="safety-alert-view-grey-label">إعداد</div>
                            <div class="safety-alert-view-field" style="margin-top: 10px;">
                                ${Utils.escapeHTML(alert.preparedBy || '')}
                            </div>
                        </div>
                        <div>
                            <div class="safety-alert-view-grey-label">اعتماد</div>
                            <div class="safety-alert-view-field" style="margin-top: 10px;">
                                ${Utils.escapeHTML(alert.approvedBy || '-')}
                            </div>
                        </div>
                        <div>
                            <div class="safety-alert-view-grey-label">تاريخ الإصدار</div>
                            <div class="safety-alert-view-field" style="margin-top: 10px;">
                                ${alert.issueDate ? new Date(alert.issueDate).toLocaleDateString('ar-SA') : '-'}
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-4 pt-4">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                            إغلاق
                        </button>
                        <button type="button" class="btn-success" onclick="Incidents.exportSafetyAlertPDF('${alertId}')">
                            <i class="fas fa-file-pdf ml-2"></i>
                            تصدير PDF
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النموذج.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) modal.remove();
            }
        });
    },

    /**
     * حذف تنبيه
     */
    async deleteSafetyAlert(alertId) {
        try {
            if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
                Notification.error('ليس لديك صلاحية لحذف التنبيهات');
                return;
            }

            Loading.show('جاري حذف التنبيه...');
            
            const result = await GoogleIntegration.sendRequest({
                action: 'deleteSafetyAlert',
                data: { alertId }
            });

            Loading.hide();

            if (result && result.success) {
                Notification.success('تم حذف التنبيه بنجاح');
                // تحديث التبويب
                if (this.currentTab === 'safety-alerts') {
                    const contentContainer = document.getElementById('incidents-tab-content');
                    if (contentContainer) {
                        contentContainer.innerHTML = await this.renderSafetyAlertsTab();
                        this.setupTabEventListeners('safety-alerts');
                    }
                }
            } else {
                Notification.error(result?.message || 'فشل حذف التنبيه');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في حذف التنبيه:', error);
            Notification.error('حدث خطأ أثناء حذف التنبيه');
        }
    },

    /**
     * عرض نموذج Safety Alert (المحدث)
     */
    async showSafetyAlertForm(alertId = null, incidentId = null) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        // جلب بيانات التنبيه إذا كان تعديل
        let alertData = null;
        if (alertId) {
            alertData = (AppState.appData?.safetyAlerts || []).find(a => a.id === alertId);
        }
        
        // جلب بيانات الحادث إذا كان مرتبطاً
        let incident = null;
        if (incidentId) {
            incident = (AppState.appData?.incidents || []).find(inc => inc.id === incidentId);
        } else if (alertData?.incidentId) {
            incident = (AppState.appData?.incidents || []).find(inc => inc.id === alertData.incidentId);
        }

        const isEdit = !!alertId;
        const sequentialNumber = alertData?.sequentialNumber || this.generateSafetyAlertSequentialNumber();
        const companyName = AppState?.companySettings?.name || AppState?.companyName || '';
        const companySecondaryName = AppState?.companySettings?.secondaryName || '';
        const companyLogo = AppState?.companyLogo || '';

        modal.innerHTML = `
            <style>
                .safety-alert-grey-bar {
                    background: #9ca3af;
                    height: 4px;
                    margin: 20px 0;
                    border-radius: 2px;
                }
                .safety-alert-grey-label {
                    background: #9ca3af;
                    color: white;
                    padding: 12px;
                    text-align: center;
                    font-weight: 600;
                    border-radius: 4px;
                }
                .safety-alert-field {
                    background: white;
                    padding: 16px;
                    border-radius: 10px;
                    border: 2px solid #e5e7eb;
                    margin-top: 10px;
                }
                .safety-alert-yellow-box {
                    background: #fbbf24;
                    padding: 8px;
                    text-align: center;
                    border-radius: 6px;
                    border: 2px solid #f59e0b;
                    display: inline-block;
                    max-width: 100%;
                }
                .safety-alert-yellow-box img {
                    max-width: 100%;
                    max-height: 350px;
                    border-radius: 4px;
                    object-fit: contain;
                    display: block;
                }
                .incident-type-checkbox {
                    margin: 8px;
                }
            </style>
            <div class="modal-content" style="max-width: 1000px; width: 95%; max-height: 90vh; overflow-y: auto; background: #f8f9fa;">
                <div class="modal-header modal-header-centered" style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 24px 30px;">
                    <h2 class="modal-title" style="font-size: 1.75rem; font-weight: 700; color: white;">
                        <i class="fas fa-exclamation-circle ml-2"></i>
                        ${isEdit ? 'تعديل Safety Alert' : 'إنشاء Safety Alert'}
                    </h2>
                    <button class="modal-close" style="color: white; font-size: 1.5rem;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 30px;">
                    <form id="safety-alert-form">
                        <!-- Header with Company Logo and Name -->
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div style="flex: 1; text-align: right;">
                                ${companyLogo ? `
                                    <img src="${companyLogo}" alt="شعار الشركة" style="max-height: 80px; max-width: 200px; object-fit: contain;">
                                ` : ''}
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="color: #dc2626; font-weight: 700; font-size: 0.75rem; margin-bottom: 2px;">No</div>
                                <div style="color: #dc2626; font-weight: 700; font-size: 12px;" id="safety-alert-number-display">${sequentialNumber}</div>
                            </div>
                            <div style="flex: 1; text-align: left;">
                                <div style="font-size: 14px; font-weight: 700; color: #1f2937; line-height: 1.3;">
                                    ${Utils.escapeHTML(companyName || '')}
                                    ${companySecondaryName ? `<div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-top: 2px;">${Utils.escapeHTML(companySecondaryName)}</div>` : ''}
                                </div>
                            </div>
                        </div>

                        <input type="hidden" id="safety-alert-id" value="${alertId || ''}">
                        <input type="hidden" id="safety-alert-incident-id" value="${incidentId || alertData?.incidentId || incident?.id || ''}">
                        <input type="hidden" id="safety-alert-incident-type" value="${alertData?.incidentType || ''}">
                        <input type="hidden" id="safety-alert-status" value="${alertData?.status || 'مسودة'}">

                        <!-- Incident Type (Checkboxes) -->
                        <div class="safety-alert-grey-bar"></div>
                        <div class="safety-alert-grey-label">نوع الحادث</div>
                        <div class="safety-alert-field" style="margin-top: 10px;">
                            <div style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: center;">
                                <label class="incident-type-checkbox">
                                    <input type="checkbox" class="incident-type-checkbox" id="incident-type-general" 
                                        ${alertData?.incidentType === 'نوع الحادث' ? 'checked' : ''}>
                                    نوع الحادث
                                </label>
                                <label class="incident-type-checkbox">
                                    <input type="checkbox" class="incident-type-checkbox" id="incident-type-serious"
                                        ${alertData?.incidentType === 'حادث جسيم' ? 'checked' : ''}>
                                    حادث جسيم
                                </label>
                                <label class="incident-type-checkbox">
                                    <input type="checkbox" class="incident-type-checkbox" id="incident-type-fire"
                                        ${alertData?.incidentType === 'حادث حريق' ? 'checked' : ''}>
                                    حادث حريق
                                </label>
                                <label class="incident-type-checkbox">
                                    <input type="checkbox" class="incident-type-checkbox" id="incident-type-other"
                                        ${alertData?.incidentType && alertData.incidentType !== 'نوع الحادث' && alertData.incidentType !== 'حادث جسيم' && alertData.incidentType !== 'حادث حريق' ? 'checked' : ''}>
                                    اخرى
                                </label>
                            </div>
                            <div id="incident-type-other-input-container" style="margin-top: 15px; display: none;">
                                <input type="text" id="incident-type-other-input" class="form-input" 
                                    placeholder="حدد نوع الحادث الآخر"
                                    value="${alertData?.incidentType && alertData.incidentType !== 'نوع الحادث' && alertData.incidentType !== 'حادث جسيم' && alertData.incidentType !== 'حادث حريق' ? Utils.escapeHTML(alertData.incidentType) : ''}"
                                    style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                            </div>
                        </div>

                        <!-- Incident Details -->
                        <div class="safety-alert-grey-bar"></div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                            <div>
                                <div class="safety-alert-grey-label">أين</div>
                                <div class="safety-alert-field" style="margin-top: 10px;">
                                    <input type="text" id="safety-alert-location" class="form-input" 
                                        value="${Utils.escapeHTML(alertData?.incidentLocation || incident?.location || incident?.siteName || '')}" 
                                        placeholder="مكان الحادث"
                                        style="border: none; width: 100%;">
                                </div>
                            </div>
                            <div>
                                <div class="safety-alert-grey-label">متى</div>
                                <div class="safety-alert-field" style="margin-top: 10px;">
                                    <input type="date" id="safety-alert-date" class="form-input" 
                                        value="${this.safeDateToISOString(alertData?.incidentDate || incident?.date, 10)}"
                                        style="border: none; width: 100%;">
                                </div>
                            </div>
                            <div>
                                <div class="safety-alert-grey-label">من</div>
                                <div class="safety-alert-field" style="margin-top: 10px;">
                                    <input type="text" id="safety-alert-who" class="form-input" 
                                        value="${Utils.escapeHTML(alertData?.who || '')}" 
                                        placeholder="من"
                                        style="border: none; width: 100%;">
                                </div>
                            </div>
                        </div>

                        <!-- Images -->
                        <div class="safety-alert-grey-bar"></div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                            <div style="text-align: center;">
                                <div style="margin-bottom: 8px; font-size: 0.9rem; font-weight: 600; color: #374151;">صورة توضيحية لمكان الحادث</div>
                                <div class="safety-alert-yellow-box">
                                    <input type="file" id="safety-alert-location-image-input" accept="image/*" 
                                        onchange="Incidents.handleSafetyAlertImage(this, 'safety-alert-location-image-preview')" 
                                        style="display: none;">
                                    <input type="hidden" id="safety-alert-location-image" value="${alertData?.locationImage || ''}">
                                    ${alertData?.locationImage ? `
                                        <div id="safety-alert-location-image-preview">
                                            <img src="${this.convertGoogleDriveLinkToPrintable(alertData.locationImage)}" style="max-width: 100%; max-height: 350px; border-radius: 4px; object-fit: contain; display: block;">
                                        </div>
                                    ` : `
                                        <label for="safety-alert-location-image-input" style="cursor: pointer; display: block; padding: 10px;">
                                            <i class="fas fa-camera text-2xl text-gray-600 mb-2"></i>
                                            <div style="font-size: 0.85rem;">اضغط لرفع الصورة</div>
                                        </label>
                                        <div id="safety-alert-location-image-preview" style="display: none;"></div>
                                    `}
                                </div>
                            </div>
                            <div style="text-align: center;">
                                <div style="margin-bottom: 8px; font-size: 0.9rem; font-weight: 600; color: #374151;">صورة توضيحية لأسباب الحادث</div>
                                <div class="safety-alert-yellow-box">
                                    <input type="file" id="safety-alert-causes-image-input" accept="image/*" 
                                        onchange="Incidents.handleSafetyAlertImage(this, 'safety-alert-causes-image-preview')" 
                                        style="display: none;">
                                    <input type="hidden" id="safety-alert-causes-image" value="${alertData?.causesImage || ''}">
                                    ${alertData?.causesImage ? `
                                        <div id="safety-alert-causes-image-preview">
                                            <img src="${this.convertGoogleDriveLinkToPrintable(alertData.causesImage)}" style="max-width: 100%; max-height: 350px; border-radius: 4px; object-fit: contain; display: block;">
                                        </div>
                                    ` : `
                                        <label for="safety-alert-causes-image-input" style="cursor: pointer; display: block; padding: 10px;">
                                            <i class="fas fa-camera text-2xl text-gray-600 mb-2"></i>
                                            <div style="font-size: 0.85rem;">اضغط لرفع الصورة</div>
                                        </label>
                                        <div id="safety-alert-causes-image-preview" style="display: none;"></div>
                                    `}
                                </div>
                            </div>
                        </div>

                        <!-- Description -->
                        <div class="safety-alert-grey-bar"></div>
                        <div class="safety-alert-field">
                            <label style="display: block; font-weight: 600; margin-bottom: 10px;">وصف مختصر للحادث :</label>
                            <textarea id="safety-alert-description" class="form-input" rows="5"
                                placeholder="وصف مختصر للحادث"
                                style="border: none; width: 100%; resize: vertical;">${Utils.escapeHTML(alertData?.description || '')}</textarea>
                        </div>

                        <div class="safety-alert-grey-bar"></div>
                        <div class="safety-alert-field">
                            <label style="display: block; font-weight: 600; margin-bottom: 10px;">حقائق عن الحادث :</label>
                            <textarea id="safety-alert-facts" class="form-input" rows="5"
                                placeholder="الحقائق الأساسية عن الحادث"
                                style="border: none; width: 100%; resize: vertical;">${Utils.escapeHTML(alertData?.facts || '')}</textarea>
                        </div>

                        <div class="safety-alert-grey-bar"></div>
                        <div class="safety-alert-field">
                            <label style="display: block; font-weight: 600; margin-bottom: 10px;">الأسباب :</label>
                            <textarea id="safety-alert-causes" class="form-input" rows="5"
                                placeholder="الأسباب الرئيسية"
                                style="border: none; width: 100%; resize: vertical;">${Utils.escapeHTML(alertData?.causes || '')}</textarea>
                        </div>

                        <div class="safety-alert-grey-bar"></div>
                        <div class="safety-alert-field">
                            <label style="display: block; font-weight: 600; margin-bottom: 10px;">الدروس المستفادة :</label>
                            <textarea id="safety-alert-lessons" class="form-input" rows="5" required
                                placeholder="أهم الدروس المستفادة"
                                style="border: none; width: 100%; resize: vertical;">${Utils.escapeHTML(alertData?.lessonsLearned || '')}</textarea>
                        </div>

                        <div class="safety-alert-grey-bar"></div>
                        <div class="safety-alert-field">
                            <label style="display: block; font-weight: 600; margin-bottom: 10px;">إجراءات منع تكرار الحدث :</label>
                            <textarea id="safety-alert-preventive" class="form-input" rows="5" required
                                placeholder="إجراءات وقائية عامة"
                                style="border: none; width: 100%; resize: vertical;">${Utils.escapeHTML(alertData?.preventiveMeasures || '')}</textarea>
                        </div>

                        <!-- Footer Fields -->
                        <div class="safety-alert-grey-bar"></div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                            <div>
                                <div class="safety-alert-grey-label">رقم الإشعار</div>
                                <div class="safety-alert-field" style="margin-top: 10px;">
                                    <input type="text" id="safety-alert-notification-number" class="form-input" 
                                        value="${Utils.escapeHTML(alertData?.notificationNumber || alertData?.sequentialNumber || incident?.notificationNumber || sequentialNumber)}" 
                                        placeholder="رقم الإشعار"
                                        style="border: none; width: 100%;">
                                </div>
                            </div>
                            <div>
                                <div class="safety-alert-grey-label">إعداد</div>
                                <div class="safety-alert-field" style="margin-top: 10px;">
                                    <input type="text" id="safety-alert-prepared-by" class="form-input" 
                                        value="${Utils.escapeHTML(alertData?.preparedBy || AppState.currentUser?.name || '')}" 
                                        placeholder="إعداد"
                                        style="border: none; width: 100%;">
                                </div>
                            </div>
                            <div>
                                <div class="safety-alert-grey-label">اعتماد</div>
                                <div class="safety-alert-field" style="margin-top: 10px;">
                                    <input type="text" id="safety-alert-approved-by" class="form-input" 
                                        value="${Utils.escapeHTML(alertData?.approvedBy || '')}" 
                                        placeholder="اعتماد"
                                        style="border: none; width: 100%;" ${alertData?.status === 'معتمد' ? 'readonly' : ''}>
                                </div>
                            </div>
                            <div>
                                <div class="safety-alert-grey-label">تاريخ الإصدار</div>
                                <div class="safety-alert-field" style="margin-top: 10px;">
                                    <input type="date" id="safety-alert-issue-date" class="form-input" 
                                        value="${this.safeDateToISOString(alertData?.issueDate, 10)}"
                                        style="border: none; width: 100%;" ${alertData?.status === 'معتمد' ? 'readonly' : ''}>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-4 pt-4 form-actions-centered">
                            <button type="button" class="btn-secondary safety-alert-close-btn">
                                إغلاق
                            </button>
                            <button type="button" class="btn-secondary" onclick="Incidents.printSafetyAlert('${alertId || ''}')" title="طباعة Safety Alert">
                                <i class="fas fa-print ml-2"></i>
                                طباعة
                            </button>
                            <button type="button" class="btn-secondary" onclick="Incidents.exportSafetyAlertPDF('${alertId || ''}')" title="تصدير PDF">
                                <i class="fas fa-file-pdf ml-2"></i>
                                تصدير PDF
                            </button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>
                                حفظ
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Handle incident type checkboxes - single selection
        setTimeout(() => {
            const checkboxes = modal.querySelectorAll('.incident-type-checkbox');
            const hiddenInput = document.getElementById('safety-alert-incident-type');
            const otherInputContainer = document.getElementById('incident-type-other-input-container');
            const otherInput = document.getElementById('incident-type-other-input');
            const otherCheckbox = document.getElementById('incident-type-other');
            
            const updateIncidentType = () => {
                const checked = Array.from(checkboxes).find(cb => cb.checked);
                if (checked) {
                    const labels = {
                        'incident-type-general': 'نوع الحادث',
                        'incident-type-serious': 'حادث جسيم',
                        'incident-type-fire': 'حادث حريق',
                        'incident-type-other': 'اخرى'
                    };
                    
                    // Show/hide other input field
                    if (otherInputContainer) {
                        if (checked.id === 'incident-type-other') {
                            otherInputContainer.style.display = 'block';
                            if (otherInput) otherInput.focus();
                        } else {
                            otherInputContainer.style.display = 'none';
                            if (otherInput) otherInput.value = '';
                        }
                    }
                    
                    if (hiddenInput) {
                        if (checked.id === 'incident-type-other' && otherInput && otherInput.value.trim()) {
                            hiddenInput.value = otherInput.value.trim();
                        } else {
                            hiddenInput.value = labels[checked.id] || 'نوع الحادث';
                        }
                    }
                }
            };
            
            checkboxes.forEach(cb => {
                cb.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        checkboxes.forEach(other => {
                            if (other !== e.target) other.checked = false;
                        });
                    }
                    updateIncidentType();
                });
            });
            
            // Handle other input field changes
            if (otherInput) {
                otherInput.addEventListener('input', () => {
                    if (otherCheckbox && otherCheckbox.checked && hiddenInput) {
                        hiddenInput.value = otherInput.value.trim() || 'اخرى';
                    }
                });
            }
            
            // Initialize - show other input if already checked
            if (otherCheckbox && otherCheckbox.checked && otherInputContainer) {
                otherInputContainer.style.display = 'block';
            }

            // Auto-fill notification number with sequential number if empty
            const notificationNumberInput = document.getElementById('safety-alert-notification-number');
            const numberDisplay = document.getElementById('safety-alert-number-display');
            if (notificationNumberInput && numberDisplay && !notificationNumberInput.value) {
                const sequentialNum = numberDisplay.textContent.trim();
                notificationNumberInput.value = sequentialNum;
            }
        }, 100);

        // Track form changes for unsaved changes warning
        let formChanged = false;
        let originalFormData = null;
        
        // Get form and submit button references
        const form = modal.querySelector('#safety-alert-form');
        const submitBtn = form?.querySelector('button[type="submit"]');
        
        // Initialize original form data and track changes
        setTimeout(() => {
            if (form) {
                originalFormData = new FormData(form);
            }
            
            // Track form changes
            form?.addEventListener('input', () => {
                formChanged = true;
            });
            form?.addEventListener('change', () => {
                formChanged = true;
            });
        }, 100);

        // Handle form submission
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (submitBtn?.disabled) return; // Prevent double submission
            await this.handleSafetyAlertSubmit(modal, alertId, submitBtn);
        });

        // Close button handler with unsaved changes check
        const closeBtnHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (formChanged) {
                const ok = confirm('تنبيه: لديك تغييرات غير محفوظة.\nسيتم إغلاق النموذج وفقدان التغييرات.\n\nهل تريد المتابعة؟');
                if (ok) {
                    formChanged = false;
                    modal.remove();
                }
            } else {
                modal.remove();
            }
        };

        // Attach close handlers
        modal.querySelectorAll('.modal-close, .safety-alert-close-btn').forEach(btn => {
            btn.addEventListener('click', closeBtnHandler);
        });

        // Modal backdrop click handler
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (formChanged) {
                    const ok = confirm('تنبيه: لديك تغييرات غير محفوظة.\nسيتم إغلاق النموذج وفقدان التغييرات.\n\nهل تريد المتابعة؟');
                    if (ok) {
                        formChanged = false;
                        modal.remove();
                    }
                } else {
                    modal.remove();
                }
            }
        });
    },

    /**
     * معالجة إرسال نموذج Safety Alert (المحدث)
     */
    async handleSafetyAlertSubmit(modal, alertId, submitBtn = null) {
        try {
            const isEdit = !!alertId;
            
            // Disable submit button to prevent double submission
            let originalButtonText = null;
            if (submitBtn) {
                submitBtn.disabled = true;
                originalButtonText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الحفظ...';
            }
            
            // Helper to re-enable button
            const reEnableButton = () => {
                if (submitBtn && originalButtonText) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalButtonText;
                }
            };

            // Get incident type from hidden input (updated by checkboxes) or other input
            const incidentTypeInput = document.getElementById('safety-alert-incident-type');
            const otherInput = document.getElementById('incident-type-other-input');
            const otherCheckbox = document.getElementById('incident-type-other');
            let incidentType = incidentTypeInput?.value || 'نوع الحادث';
            
            // If "other" is selected, use the value from the other input field
            if (otherCheckbox && otherCheckbox.checked && otherInput && otherInput.value.trim()) {
                incidentType = otherInput.value.trim();
            }
            
            // Get sequential number
            const numberDisplay = document.getElementById('safety-alert-number-display');
            const sequentialNumber = numberDisplay ? numberDisplay.textContent.trim() : String((AppState.appData?.safetyAlerts || []).length + 1).padStart(3, '0');

            const alertData = {
                id: alertId || Utils.generateId('SA'),
                alertNumber: document.getElementById('safety-alert-notification-number')?.value || `SA-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String((AppState.appData?.safetyAlerts || []).length + 1).padStart(4, '0')}`,
                sequentialNumber: sequentialNumber,
                incidentId: document.getElementById('safety-alert-incident-id')?.value || '',
                incidentType: incidentType,
                incidentDate: document.getElementById('safety-alert-date')?.value || '',
                incidentLocation: document.getElementById('safety-alert-location')?.value || '',
                who: document.getElementById('safety-alert-who')?.value || '',
                description: document.getElementById('safety-alert-description')?.value || '',
                facts: document.getElementById('safety-alert-facts')?.value || '',
                causes: document.getElementById('safety-alert-causes')?.value || '',
                lessonsLearned: document.getElementById('safety-alert-lessons')?.value || '',
                preventiveMeasures: document.getElementById('safety-alert-preventive')?.value || '',
                locationImage: document.getElementById('safety-alert-location-image')?.value || '',
                causesImage: document.getElementById('safety-alert-causes-image')?.value || '',
                notificationNumber: document.getElementById('safety-alert-notification-number')?.value || sequentialNumber,
                preparedBy: document.getElementById('safety-alert-prepared-by')?.value || '',
                approvedBy: document.getElementById('safety-alert-approved-by')?.value || '',
                issueDate: document.getElementById('safety-alert-issue-date')?.value || '',
                status: document.getElementById('safety-alert-status')?.value || 'مسودة',
                createdAt: isEdit ? (AppState.appData?.safetyAlerts || []).find(a => a.id === alertId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: AppState.currentUser ? {
                    id: AppState.currentUser.id || '',
                    name: AppState.currentUser.name || AppState.currentUser.displayName || '',
                    email: AppState.currentUser.email || ''
                } : null
            };

            // Validation - more comprehensive
            const validationErrors = [];
            if (!alertData.lessonsLearned || !alertData.lessonsLearned.trim()) {
                validationErrors.push('الدروس المستفادة');
            }
            if (!alertData.preventiveMeasures || !alertData.preventiveMeasures.trim()) {
                validationErrors.push('إجراءات منع تكرار الحدث');
            }
            
            if (validationErrors.length > 0) {
                Notification.error(`يرجى ملء الحقول المطلوبة التالية:\n${validationErrors.join('، ')}`);
                reEnableButton();
                return;
            }

            Loading.show('جاري حفظ Safety Alert...');

            // Save to AppState
            if (!AppState.appData.safetyAlerts) {
                AppState.appData.safetyAlerts = [];
            }

            if (isEdit) {
                const index = AppState.appData.safetyAlerts.findIndex(a => a.id === alertId);
                if (index !== -1) {
                    AppState.appData.safetyAlerts[index] = alertData;
                } else {
                    AppState.appData.safetyAlerts.push(alertData);
                }
            } else {
                AppState.appData.safetyAlerts.push(alertData);
            }

            // Track save results
            let backendSaveSuccess = false;
            let backendSaveError = null;
            let googleSheetsSaveSuccess = false;
            
            // Save to Backend
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.callAppsScript) {
                try {
                    const result = isEdit 
                        ? await GoogleIntegration.callAppsScript('updateSafetyAlert', { alertId, updateData: alertData })
                        : await GoogleIntegration.callAppsScript('addSafetyAlert', { alertData });
                    
                    if (result && result.success) {
                        backendSaveSuccess = true;
                        // Sync with AppState
                        if (result.data) {
                            if (isEdit) {
                                const index = AppState.appData.safetyAlerts.findIndex(a => a.id === alertId);
                                if (index !== -1) {
                                    AppState.appData.safetyAlerts[index] = result.data;
                                } else {
                                    AppState.appData.safetyAlerts.push(result.data);
                                }
                            } else {
                                AppState.appData.safetyAlerts.push(result.data);
                            }
                        }
                    } else {
                        backendSaveError = result?.message || 'فشل حفظ Safety Alert في Backend';
                    }
                } catch (error) {
                    backendSaveError = error.message || 'حدث خطأ أثناء حفظ Safety Alert إلى Backend';
                    Utils.safeWarn('خطأ في حفظ Safety Alert إلى Backend:', error);
                }
            } else {
                // No backend available - treat as success for local-only saves
                backendSaveSuccess = true;
            }

            // Auto-save to Google Sheets if enabled
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                try {
                    await GoogleIntegration.autoSave('safetyAlerts', AppState.appData.safetyAlerts);
                    googleSheetsSaveSuccess = true;
                } catch (error) {
                    Utils.safeWarn('خطأ في حفظ Safety Alert إلى Google Sheets:', error);
                }
            } else {
                googleSheetsSaveSuccess = true; // Not enabled, treat as success
            }

            Loading.hide();

            // Determine success/failure and show appropriate message
            if (backendSaveError) {
                // Backend save failed - show warning but keep modal open
                Notification.warning(
                    `تم حفظ Safety Alert محلياً، ولكن فشل الحفظ في Backend:\n${backendSaveError}\n\nيمكنك المحاولة مرة أخرى أو إغلاق النموذج لحفظ التغييرات محلياً فقط.`
                );
                reEnableButton();
                return; // Don't close modal on backend error
            }

            // Success - show success message and close modal
            const successMessage = isEdit ? 'تم تحديث Safety Alert بنجاح' : 'تم إنشاء Safety Alert بنجاح';
            if (!googleSheetsSaveSuccess && backendSaveSuccess) {
                Notification.success(`${successMessage}\n(ملاحظة: تم الحفظ في Backend فقط)`);
            } else {
                Notification.success(successMessage);
            }
            
            modal.remove();

            // Refresh tab if open
            if (this.currentTab === 'safety-alerts') {
                const contentContainer = document.getElementById('incidents-tab-content');
                if (contentContainer) {
                    contentContainer.innerHTML = await this.renderSafetyAlertsTab();
                    this.setupTabEventListeners('safety-alerts');
                }
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في حفظ Safety Alert:', error);
            
            const errorMessage = error.message || 'حدث خطأ غير متوقع';
            Notification.error(`حدث خطأ أثناء حفظ Safety Alert:\n${errorMessage}`);
            
            // Re-enable submit button on error
            if (submitBtn) {
                submitBtn.disabled = false;
                if (submitBtn.innerHTML.includes('fa-spinner')) {
                    submitBtn.innerHTML = '<i class="fas fa-save ml-2"></i> حفظ';
                }
            }
        }
    },

    /**
     * معالجة رفع صورة Safety Alert
     */
    async handleSafetyAlertImage(input, previewId) {
        const file = input.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            Notification.error('حجم الصورة كبير جداً. الحد الأقصى 5MB');
            input.value = '';
            return;
        }

        try {
            const base64 = await this.convertFileToBase64(file);
            const hiddenInput = input.previousElementSibling;
            if (hiddenInput && hiddenInput.id.includes('safety-alert')) {
                hiddenInput.value = base64;
            }

            const preview = document.getElementById(previewId);
            if (preview) {
                preview.innerHTML = `<img src="${base64}" style="max-width: 100%; max-height: 350px; border-radius: 4px; object-fit: contain; display: block;">`;
                preview.style.display = 'block';
                
                // Hide the label placeholder
                const yellowBox = input.closest('.safety-alert-yellow-box');
                if (yellowBox) {
                    const label = yellowBox.querySelector('label[for]');
                    if (label) {
                        label.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            Utils.safeError('خطأ في معالجة الصورة:', error);
            Notification.error('فشل تحميل الصورة');
        }
    },

    /**
     * تحويل ملف إلى Base64
     */
    async convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * تعديل Safety Alert
     */
    editSafetyAlert(alertId) {
        this.showSafetyAlertForm(alertId);
    },

    /**
     * اعتماد Safety Alert
     */
    async approveSafetyAlert(alertId) {
        try {
            if (!this.canApproveSafetyAlert()) {
                Notification.error('ليس لديك صلاحية لاعتماد Safety Alert');
                return;
            }

            if (!confirm('هل أنت متأكد من اعتماد هذا Safety Alert؟')) {
                return;
            }

            Loading.show('جاري اعتماد Safety Alert...');

            const alert = (AppState.appData?.safetyAlerts || []).find(a => a.id === alertId);
            if (!alert) {
                Loading.hide();
                Notification.error('Safety Alert غير موجود');
                return;
            }

            const updateData = {
                status: 'معتمد',
                approvedBy: AppState.currentUser?.name || AppState.currentUser?.displayName || '',
                approvedAt: new Date().toISOString(),
                issueDate: new Date().toISOString().split('T')[0],
                updatedAt: new Date().toISOString()
            };

            // Update in AppState
            const index = AppState.appData.safetyAlerts.findIndex(a => a.id === alertId);
            if (index !== -1) {
                AppState.appData.safetyAlerts[index] = { ...alert, ...updateData };
            }

            // Update in Backend
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.callAppsScript) {
                try {
                    const result = await GoogleIntegration.callAppsScript('updateSafetyAlert', { alertId, updateData });
                    if (result && result.success && result.data) {
                        AppState.appData.safetyAlerts[index] = result.data;
                    }
                } catch (error) {
                    Utils.safeWarn('خطأ في اعتماد Safety Alert في Backend:', error);
                }
            }

            // Auto-save to Google Sheets
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                try {
                    await GoogleIntegration.autoSave('safetyAlerts', AppState.appData.safetyAlerts);
                } catch (error) {
                    Utils.safeWarn('خطأ في حفظ Safety Alert إلى Google Sheets:', error);
                }
            }

            Loading.hide();
            Notification.success('تم اعتماد Safety Alert بنجاح');

            // Refresh tab if open
            if (this.currentTab === 'safety-alerts') {
                const contentContainer = document.getElementById('incidents-tab-content');
                if (contentContainer) {
                    contentContainer.innerHTML = await this.renderSafetyAlertsTab();
                    this.setupTabEventListeners('safety-alerts');
                }
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في اعتماد Safety Alert:', error);
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    /**
     * عرض تبويب الموافقات
     */
    async renderApprovalsTab() {
        try {
            const incidents = (AppState.appData?.incidents || []).map(incident => {
                // نسخة للعرض دون تحوير AppState
                const item = { ...incident };
                if (item.investigation && typeof item.investigation === 'string') {
                    try {
                        item.investigation = JSON.parse(item.investigation);
                    } catch (e) {
                        Utils.safeWarn('خطأ في تحليل investigation:', e);
                        item.investigation = {};
                    }
                }
                return item;
            });

            const pendingApprovals = incidents.filter(incident => {
                // الحوادث التي تحتاج موافقة (مفتوحة أو قيد التحقيق أو تحتاج موافقة)
                return incident.status === 'مفتوح' || 
                       incident.status === 'قيد التحقيق' || 
                       incident.requiresApproval === true;
            });

            return `
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-check-circle ml-2"></i>
                            الموافقات
                        </h2>
                    </div>
                    <div class="card-body">
                        <div class="mb-4">
                            <div class="flex items-center justify-between mb-4">
                                <div>
                                    <h3 class="text-lg font-semibold text-gray-800">الحوادث المعلقة للموافقة</h3>
                                    <p class="text-sm text-gray-600">إجمالي: ${pendingApprovals.length} حادث</p>
                                </div>
                                <div class="flex gap-2">
                                    <input 
                                        type="text" 
                                        id="approvals-search" 
                                        class="form-input" 
                                        placeholder="ابحث عن حادث..."
                                        style="max-width: 300px;"
                                    >
                                </div>
                            </div>
                        </div>
                        <div class="table-wrapper" style="overflow-x: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>الكود</th>
                                        <th>العنوان</th>
                                        <th>التاريخ</th>
                                        <th>الحالة</th>
                                        <th>الشدة</th>
                                        <th>المبلغ</th>
                                        <th>الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody id="approvals-table-body">
                                    ${pendingApprovals.length > 0 ? pendingApprovals.map(incident => `
                                        <tr data-incident-id="${incident.id}">
                                            <td>${Utils.escapeHTML(incident.isoCode || incident.id || '')}</td>
                                            <td>${Utils.escapeHTML(incident.title || 'بدون عنوان')}</td>
                                            <td>${incident.date ? new Date(incident.date).toLocaleDateString('ar-SA') : ''}</td>
                                            <td>
                                                <span class="badge badge-${this.getStatusBadgeClass(incident.status)}">
                                                    ${Utils.escapeHTML(incident.status || 'مفتوح')}
                                                    ${incident.requiresApproval ? ' <i class="fas fa-clock ml-1" title="في انتظار الموافقة"></i>' : ''}
                                                </span>
                                            </td>
                                            <td>
                                                <span class="badge badge-${incident.severity === 'عالية' ? 'danger' : incident.severity === 'متوسطة' ? 'warning' : 'info'}">
                                                    ${Utils.escapeHTML(incident.severity || 'متوسطة')}
                                                </span>
                                            </td>
                                            <td>${Utils.escapeHTML(incident.reportedBy || '')}</td>
                                            <td>
                                                <div class="flex items-center gap-2">
                                                    <button 
                                                        onclick="Incidents.viewIncident('${incident.id}')" 
                                                        class="btn-icon btn-icon-info" 
                                                        title="عرض"
                                                    >
                                                        <i class="fas fa-eye"></i>
                                                    </button>
                                                    ${incident.investigation ? `
                                                        <button 
                                                            onclick="if(typeof Incidents !== 'undefined' && typeof Incidents.showInvestigationForm === 'function') { Incidents.showInvestigationForm('${incident.id}'); } else { alert('نموذج التحقيق غير متاح'); }" 
                                                            class="btn-icon btn-icon-warning" 
                                                            title="التحقيق"
                                                        >
                                                            <i class="fas fa-search"></i>
                                                        </button>
                                                    ` : `
                                                        <button 
                                                            onclick="if(typeof Incidents !== 'undefined' && typeof Incidents.showInvestigationForm === 'function') { Incidents.showInvestigationForm('${incident.id}'); } else { alert('نموذج التحقيق غير متاح'); }" 
                                                            class="btn-icon btn-icon-primary" 
                                                            title="بدء التحقيق"
                                                        >
                                                            <i class="fas fa-play"></i>
                                                        </button>
                                                    `}
                                                    ${incident.requiresApproval && this.canApproveIncident() ? `
                                                        <button 
                                                            onclick="Incidents.approveIncident('${incident.id}')" 
                                                            class="btn-icon btn-icon-success" 
                                                            title="الموافقة"
                                                        >
                                                            <i class="fas fa-check"></i>
                                                        </button>
                                                        <button 
                                                            onclick="Incidents.rejectIncident('${incident.id}')" 
                                                            class="btn-icon btn-icon-danger" 
                                                            title="رفض"
                                                        >
                                                            <i class="fas fa-times"></i>
                                                        </button>
                                                    ` : ''}
                                                    <button 
                                                        onclick="if(confirm('هل أنت متأكد من حذف هذا الحادث؟')) { Incidents.deleteIncident('${incident.id}'); }" 
                                                        class="btn-icon btn-icon-danger" 
                                                        title="حذف"
                                                    >
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('') : `
                                        <tr>
                                            <td colspan="7" class="text-center py-8 text-gray-500">
                                                <i class="fas fa-check-circle text-4xl mb-4"></i>
                                                <p>لا توجد حوادث معلقة للموافقة</p>
                                            </td>
                                        </tr>
                                    `}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            Utils.safeError('خطأ في عرض تبويب الموافقات:', error);
            return `
                <div class="content-card">
                    <div class="card-body">
                        <div class="text-center py-8">
                            <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                            <h2 class="text-xl font-bold text-gray-800 mb-2">حدث خطأ في تحميل الموافقات</h2>
                            <p class="text-gray-600">${error.message || 'خطأ غير معروف'}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * عرض تفاصيل سجل
     */
    viewRegistryEntry(entryId) {
        const entry = this.registryData.find(r => r.id === entryId);
        if (!entry) {
            Notification.error('السجل غير موجود');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title">تفاصيل سجل الحادث #${entry.sequentialNumber}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="grid grid-cols-2 gap-4">
                        <div><strong>المسلسل:</strong> ${entry.sequentialNumber}</div>
                        <div><strong>المصنع:</strong> ${Utils.escapeHTML(entry.factory || '-')}</div>
                        <div><strong>مكان الحادث:</strong> ${Utils.escapeHTML(entry.incidentLocation || '-')}</div>
                        <div><strong>تاريخ الحادث:</strong> ${entry.incidentDate ? new Date(entry.incidentDate).toLocaleDateString('ar-SA') : '-'}</div>
                        <div><strong>يوم الحادث:</strong> ${Utils.escapeHTML(entry.incidentDay || '-')}</div>
                        <div><strong>وقت الحادث:</strong> ${Utils.escapeHTML(entry.incidentTime || '-')}</div>
                        <div><strong>الوردية:</strong> ${Utils.escapeHTML(entry.shift || '-')}</div>
                        <div><strong>كود الموظف:</strong> ${Utils.escapeHTML(entry.employeeCode || '-')}</div>
                        <div><strong>اسم الموظف:</strong> ${Utils.escapeHTML(entry.employeeName || '-')}</div>
                        <div><strong>الوظيفة:</strong> ${Utils.escapeHTML(entry.employeeJob || '-')}</div>
                        <div><strong>الإدارة / القسم:</strong> ${Utils.escapeHTML(entry.employeeDepartment || '-')}</div>
                        <div class="col-span-2"><strong>تفاصيل الحادث:</strong> ${Utils.escapeHTML(entry.incidentDetails || '-')}</div>
                        <div><strong>الجزء المصاب:</strong> ${Utils.escapeHTML(entry.injuredPart || '-')}</div>
                        <div><strong>المعدة المتسببة:</strong> ${Utils.escapeHTML(entry.equipmentCause || '-')}</div>
                        <div><strong>تاريخ بداية الإجازة:</strong> ${entry.leaveStartDate ? new Date(entry.leaveStartDate + 'T00:00:00').toLocaleDateString('ar-SA') : '-'}</div>
                        <div><strong>تاريخ العودة للعمل:</strong> ${entry.returnToWorkDate ? new Date(entry.returnToWorkDate + 'T00:00:00').toLocaleDateString('ar-SA') : '-'}</div>
                        <div><strong>إجمالي أيام الإجازة:</strong> ${entry.totalLeaveDays || 0} يوم</div>
                        <div><strong>الحالة:</strong> <span class="badge badge-${entry.status === 'مفتوح' ? 'primary' : 'success'}">${entry.status}</span></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النموذج.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) modal.remove();
            }
        });
    },

    /**
     * عرض نموذج الإدخال اليدوي
     */
    showManualEntryForm() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">
                        <i class="fas fa-plus-circle ml-2"></i>
                        إضافة إخطار حادث / Incident Notification
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="incident-registry-manual-form" class="space-y-4">
                        <!-- معلومات أساسية -->
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    نوع الحادث / Incident Type *
                                </label>
                                <select id="manual-incident-type" class="form-input" required>
                                    <option value="">اختر نوع الحادث</option>
                                    <option value="اصابة">إصابة عمل (Work Injury)</option>
                                    <option value="معدة">معدة (Equipment)</option>
                                    <option value="حريق">حريق (Fire)</option>
                                    <option value="بيئة">بيئة (Environment)</option>
                                    <option value="وشك حادث">وشك حادث (Near Miss)</option>
                                    <option value="مركبة">مركبة (Vehicle)</option>
                                    <option value="أخرى">أخرى (Other)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    المصنع / Factory *
                                </label>
                                <select id="manual-factory" class="form-input" required>
                                    <option value="">اختر المصنع</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    الموقع / Location *
                                </label>
                                <select id="manual-incident-location" class="form-input" required>
                                    <option value="">اختر الموقع</option>
                                </select>
                            </div>
                        </div>

                        <!-- توقيت الحادث -->
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-3 rounded">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">تاريخ الحادث *</label>
                                <input type="date" id="manual-incident-date" class="form-input" required value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div>
                                <label for="manual-incident-time" class="block text-sm font-semibold text-gray-700 mb-2">وقت الحادث *</label>
                                <input type="time" id="manual-incident-time" class="form-input" required>
                            </div>
                            <div>
                                <label for="manual-incident-day" class="block text-sm font-semibold text-gray-700 mb-2">اليوم</label>
                                <input type="text" id="manual-incident-day" class="form-input" readonly style="background-color: #e5e7eb;">
                            </div>
                            <div>
                                <label for="manual-shift" class="block text-sm font-semibold text-gray-700 mb-2">الوردية *</label>
                                <select id="manual-shift" class="form-input" required>
                                    <option value="">اختر الوردية</option>
                                    <option value="أولى">أولى</option>
                                    <option value="ثانية">ثانية</option>
                                    <option value="ثالثة">ثالثة</option>
                                </select>
                            </div>
                        </div>

                        <!-- قسم بيانات المصاب (يظهر فقط عند اختيار إصابة) -->
                        <div id="manual-employee-section" class="border border-blue-200 bg-blue-50 p-4 rounded hidden">
                            <h4 class="text-blue-800 font-bold mb-3 flex items-center">
                                <i class="fas fa-user-injured ml-2"></i>
                                بيانات المصاب / Injured Person Details
                            </h4>
                            
                            <!-- حقل التبعية -->
                            <div class="mb-3">
                                <label for="manual-affiliation" class="block text-sm font-semibold text-gray-700 mb-2">
                                    التبعية / Affiliation (مرتبط ببيانات المصاب)
                                </label>
                                <select id="manual-affiliation" class="form-input">
                                    <option value="">اختر التبعية</option>
                                    <option value="شركة">شركة (Company)</option>
                                    <option value="عمالة يومية">عمالة يومية (Daily Labor)</option>
                                    <option value="مقاول">مقاول (Contractor)</option>
                                    <option value="زائر">زائر (Visitor)</option>
                                    <option value="لا يوجد">لا يوجد (None)</option>
                                </select>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                <div>
                                    <label for="manual-employee-code" class="block text-sm font-semibold text-gray-700 mb-2">كود الموظف *</label>
                                    <input type="text" id="manual-employee-code" class="form-input" placeholder="بحث بالكود...">
                                </div>
                                <div>
                                    <label for="manual-employee-name" class="block text-sm font-semibold text-gray-700 mb-2">اسم الموظف *</label>
                                    <input type="text" id="manual-employee-name" class="form-input" readonly style="background-color: #e5e7eb;">
                                </div>
                                <div>
                                    <label for="manual-employee-job" class="block text-sm font-semibold text-gray-700 mb-2">الوظيفة *</label>
                                    <input type="text" id="manual-employee-job" class="form-input" readonly style="background-color: #e5e7eb;">
                                </div>
                            </div>
                            
                            <!-- حقل الإدارة تابع للموظف -->
                            <div class="mb-3">
                                <label for="manual-employee-department" class="block text-sm font-semibold text-gray-700 mb-2">
                                    الإدارة / Department *
                                </label>
                                <input type="text" id="manual-employee-department" class="form-input" placeholder="الإدارة التابع لها">
                            </div>

                            <div class="mb-3">
                                <label for="manual-injury-description" class="block text-sm font-semibold text-gray-700 mb-2">وصف الاصابة / Injury Description</label>
                                <textarea id="manual-injury-description" class="form-input" rows="2" placeholder="وصف طبيعة ومكان الإصابة..."></textarea>
                            </div>
                            
                            <!-- الإجازات المرضية -->
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-blue-200 pt-3">
                                <div>
                                    <label for="manual-leave-start-date" class="block text-sm font-semibold text-gray-700 mb-2">تاريخ بداية الإجازة</label>
                                    <input type="date" id="manual-leave-start-date" class="form-input">
                                </div>
                                <div>
                                    <label for="manual-return-to-work-date" class="block text-sm font-semibold text-gray-700 mb-2">تاريخ العودة للعمل</label>
                                    <input type="date" id="manual-return-to-work-date" class="form-input">
                                </div>
                                <div>
                                    <label for="manual-total-leave-days" class="block text-sm font-semibold text-gray-700 mb-2">أيام الإجازة</label>
                                    <input type="text" id="manual-total-leave-days" class="form-input font-bold" readonly value="0 يوم">
                                </div>
                                <div>
                                    <label for="manual-treating-doctor" class="block text-sm font-semibold text-gray-700 mb-2">الطبيب المعالج</label>
                                    <input type="text" id="manual-treating-doctor" class="form-input" placeholder="اسم الطبيب (اختياري)">
                                </div>
                            </div>
                        </div>

                        <!-- الترتيب الجديد للحقول: الخسائر ثم الوصف المختصر ثم الإجراءات -->
                        
                        <!-- الخسائر -->
                         <div>
                            <label for="manual-losses" class="block text-sm font-semibold text-gray-700 mb-2">
                                الخسائر / Losses
                            </label>
                            <textarea id="manual-losses" class="form-input" rows="3" placeholder="وصف الخسائر المادية أو البشرية..."></textarea>
                        </div>

                        <!-- تفاصيل الحادث (وصف مختصر) -->
                        <div>
                            <label for="manual-brief-description" class="block text-sm font-semibold text-gray-700 mb-2">
                                وصف مختصر للحادث / Brief Description *
                            </label>
                            <textarea id="manual-brief-description" class="form-input" rows="3" required placeholder="وصف مختصر لما حدث..."></textarea>
                        </div>

                        <!-- الإجراءات المتخذة -->
                        <div>
                            <label for="manual-actions-taken" class="block text-sm font-semibold text-gray-700 mb-2">
                                الإجراءات المتخذة / Actions Taken
                            </label>
                            <textarea id="manual-actions-taken" class="form-input" rows="3" placeholder="الإجراءات الفورية التي تم اتخاذها..."></textarea>
                        </div>
                        
                        <!-- Auto generated -->
                         <div class="hidden">
                             <input type="text" id="manual-sequential-number" value="${this.generateRegistrySequentialNumber()}">
                         </div>

                    </form>
                </div>
                <div class="modal-footer form-actions-centered">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button type="button" class="btn-primary" onclick="Incidents.submitManualEntry()">
                        <i class="fas fa-save ml-2"></i>
                        حفظ
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // ملء قوائم المصانع والأماكن
        this.populateManualFormOptions(modal);

        // Incident Type Logic
        const typeSelect = modal.querySelector('#manual-incident-type');
        const empSection = modal.querySelector('#manual-employee-section');
        const empCode = modal.querySelector('#manual-employee-code');
        const empName = modal.querySelector('#manual-employee-name');
        const empJob = modal.querySelector('#manual-employee-job');
        const empDept = modal.querySelector('#manual-employee-department');
        const affiliationSelect = modal.querySelector('#manual-affiliation');

        const setReadOnly = (el, readOnly) => {
            if (!el) return;
            el.readOnly = !!readOnly;
            el.style.backgroundColor = readOnly ? '#e5e7eb' : '';
        };

        const updateManualAffiliationMode = () => {
            // Only relevant for injury type (employee section visible)
            if (!affiliationSelect) return;
            const affiliation = (affiliationSelect.value || '').trim();
            const isCompanyEmployee = !affiliation || affiliation === 'شركة';

            // Company employee: lookup by code, lock name/job (auto filled). Others: allow typing.
            setReadOnly(empName, isCompanyEmployee);
            setReadOnly(empJob, isCompanyEmployee);

            if (empCode) {
                if (isCompanyEmployee) {
                    empCode.setAttribute('required', 'true');
                    empCode.placeholder = 'بحث بالكود...';
                } else {
                    empCode.removeAttribute('required');
                    empCode.placeholder = 'الكود/رقم الهوية (اختياري)';
                }
            }

            // Department should be editable always (even for employees) to allow correction
            setReadOnly(empDept, false);
        };

        // تفعيل/تعطيل الحقول بناءً على النوع
        typeSelect.addEventListener('change', () => {
            if (typeSelect.value === 'اصابة') { // 'اصابة عمل' based on new value? No, value is 'اصابة' from options
                empSection.classList.remove('hidden');
                empCode.setAttribute('required', 'true');
                empName.setAttribute('required', 'true');
                if (empDept) empDept.setAttribute('required', 'true');
                updateManualAffiliationMode();
            } else {
                empSection.classList.add('hidden');
                empCode.removeAttribute('required');
                empName.removeAttribute('required');
                if (empDept) empDept.removeAttribute('required');

                // تفريغ الحقول عند الإخفاء
                empCode.value = '';
                empName.value = '';
                if (modal.querySelector('#manual-employee-job')) modal.querySelector('#manual-employee-job').value = '';
                if (modal.querySelector('#manual-employee-department')) modal.querySelector('#manual-employee-department').value = '';
                if (modal.querySelector('#manual-affiliation')) modal.querySelector('#manual-affiliation').value = '';
            }
        });

        if (affiliationSelect) {
            affiliationSelect.addEventListener('change', () => {
                updateManualAffiliationMode();
            });
            // initial mode
            updateManualAffiliationMode();
        }

        // ربط البحث عن الموظف
        const employeeCodeInput = modal.querySelector('#manual-employee-code');
        if (employeeCodeInput) {
            employeeCodeInput.addEventListener('blur', () => {
                this.loadEmployeeDataForManual(modal);
            });
            // إضافة مستمع للبحث أثناء الكتابة
            employeeCodeInput.addEventListener('input', () => {
                if (employeeCodeInput.value.trim().length >= 3) {
                    this.loadEmployeeDataForManual(modal);
                }
            });
        }

        // ربط تغيير المصنع لتحديث الأماكن
        const factorySelect = modal.querySelector('#manual-factory');
        if (factorySelect) {
            factorySelect.addEventListener('change', () => {
                this.updateManualFormPlaces(modal);
            });
        }

        // ربط تغيير التاريخ لحساب يوم الحادث تلقائياً
        const dateInput = modal.querySelector('#manual-incident-date');
        const dayInput = modal.querySelector('#manual-incident-day');
        if (dateInput && dayInput) {
            // حساب اليوم عند فتح النموذج
            const updateDay = () => {
                if (dateInput.value) {
                    try {
                        const date = new Date(dateInput.value);
                        if (!isNaN(date.getTime())) {
                            const dayName = this.getDayName(date);
                            dayInput.value = dayName;
                        }
                    } catch (e) {
                        dayInput.value = '';
                    }
                } else {
                    dayInput.value = '';
                }
            };

            dateInput.addEventListener('change', updateDay);
            // حساب اليوم عند فتح النموذج
            setTimeout(updateDay, 100);
        }

        // ربط تغيير الوقت لحساب الوردية تلقائياً
        const timeInput = modal.querySelector('#manual-incident-time');
        const shiftSelect = modal.querySelector('#manual-shift');
        const leaveStartDateInput = modal.querySelector('#manual-leave-start-date');
        const returnToWorkDateInput = modal.querySelector('#manual-return-to-work-date');
        const totalLeaveDaysInput = modal.querySelector('#manual-total-leave-days');

        // دالة حساب إجمالي أيام الإجازة من تاريخ البدء حتى تاريخ العودة
        const updateTotalLeaveDays = () => {
            if (leaveStartDateInput && returnToWorkDateInput && totalLeaveDaysInput) {
                const startDate = leaveStartDateInput.value;
                const returnDate = returnToWorkDateInput.value;

                if (startDate && returnDate) {
                    try {
                        const start = new Date(startDate);
                        const end = new Date(returnDate);

                        if (end >= start) {
                            // حساب الفرق بالأيام (شامل تاريخ البدء وتاريخ العودة)
                            const diffTime = end - start;
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                            totalLeaveDaysInput.value = `${diffDays} يوم`;
                        } else {
                            totalLeaveDaysInput.value = '0 يوم';
                        }
                    } catch (e) {
                        totalLeaveDaysInput.value = '0 يوم';
                    }
                } else {
                    totalLeaveDaysInput.value = '0 يوم';
                }
            }
        };

        // تعيين تاريخ بداية الإجازة من تاريخ الحادث عند تغيير تاريخ الحادث (فقط إذا كان إصابة)
        if (dateInput && leaveStartDateInput) {
            const updateLeaveStartDate = () => {
                if (dateInput.value && typeSelect.value === 'اصابة') {
                    if (!leaveStartDateInput.value) {
                        leaveStartDateInput.value = dateInput.value;
                        updateTotalLeaveDays();
                    }
                }
            };

            dateInput.addEventListener('change', updateLeaveStartDate);
        }

        // تحديث حساب أيام الإجازة عند تغيير التواريخ
        if (leaveStartDateInput) {
            leaveStartDateInput.addEventListener('change', updateTotalLeaveDays);
        }

        if (returnToWorkDateInput) {
            returnToWorkDateInput.addEventListener('change', updateTotalLeaveDays);
        }

        if (timeInput && shiftSelect) {
            timeInput.addEventListener('change', () => {
                if (timeInput.value) {
                    const shift = this.determineShift(timeInput.value);
                    shiftSelect.value = shift;
                }
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النموذج.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) modal.remove();
            }
        });
    },

    /**
     * ملء خيارات النموذج اليدوي
     */
    populateManualFormOptions(modal) {
        const factorySelect = modal.querySelector('#manual-factory');
        const locationSelect = modal.querySelector('#manual-incident-location');

        if (!factorySelect || !locationSelect) return;

        // الحصول على قائمة المصانع
        const sites = this.getSiteOptions();
        sites.forEach(site => {
            const option = document.createElement('option');
            option.value = site.id;
            option.textContent = site.name;
            factorySelect.appendChild(option);
        });
    },

    /**
     * تحديث قائمة الأماكن عند تغيير المصنع
     */
    updateManualFormPlaces(modal) {
        const factorySelect = modal.querySelector('#manual-factory');
        const locationSelect = modal.querySelector('#manual-incident-location');

        if (!factorySelect || !locationSelect) return;

        const siteId = factorySelect.value;
        locationSelect.innerHTML = '<option value="">اختر المكان</option>';

        if (siteId) {
            const places = this.getPlaceOptions(siteId);
            places.forEach(place => {
                const option = document.createElement('option');
                option.value = place.id;
                option.textContent = place.name;
                locationSelect.appendChild(option);
            });
        }
    },

    /**
     * تحميل بيانات الموظف في النموذج اليدوي
     */
    loadEmployeeDataForManual(modal) {
        const codeInput = modal.querySelector('#manual-employee-code');
        const nameInput = modal.querySelector('#manual-employee-name');
        const jobInput = modal.querySelector('#manual-employee-job');
        const deptInput = modal.querySelector('#manual-employee-department'); // Updated ID inside section
        const affiliationSelect = modal.querySelector('#manual-affiliation');

        if (!codeInput || !nameInput) return;

        const affiliation = (affiliationSelect?.value || '').trim();
        const isCompanyEmployee = !affiliation || affiliation === 'شركة';
        // If not company employee (contractor/daily labor/visitor), allow manual typing and skip lookup
        if (!isCompanyEmployee) {
            return;
        }

        const employeeCode = codeInput.value.trim();
        if (!employeeCode) {
            nameInput.value = '';
            if (jobInput) jobInput.value = '';
            if (deptInput) deptInput.value = '';
            return;
        }

        const employee = this.getEmployeeByCode(employeeCode);
        if (employee) {
            nameInput.value = employee.name || employee.fullName || '';
            // البحث عن الوظيفة في حقول مختلفة
            if (jobInput) {
                jobInput.value = employee.job ||
                    employee.position ||
                    employee.jobTitle ||
                    employee.title ||
                    '';
            }
            // البحث عن القسم في حقول مختلفة
            if (deptInput) {
                deptInput.value = employee.department ||
                    employee.section ||
                    employee.division ||
                    '';
            }
        } else {
            nameInput.value = '';
            if (jobInput) jobInput.value = '';
            // Do not clear deptInput to allow manual entry

            // إزالة الإشعار عند الكتابة (يظهر فقط عند blur)
            if (document.activeElement !== codeInput) {
                Notification.warning('لم يتم العثور على موظف بهذا الكود');
            }
        }
    },

    /**
     * حفظ الإدخال اليدوي
     */
    async submitManualEntry() {
        const modal = document.querySelector('.modal-overlay');
        if (!modal) return;
        if (this._manualEntrySubmitting) return;

        const form = modal.querySelector('#incident-registry-manual-form');
        if (!form) return;

        const typeSelect = modal.querySelector('#manual-incident-type');
        const factorySelect = modal.querySelector('#manual-factory');
        const locationSelect = modal.querySelector('#manual-incident-location');
        const dateInput = modal.querySelector('#manual-incident-date');
        const timeInput = modal.querySelector('#manual-incident-time');
        const shiftSelect = modal.querySelector('#manual-shift');
        const briefDescInput = modal.querySelector('#manual-brief-description');

        // Fields that might be optional based on type
        const affiliationInput = modal.querySelector('#manual-affiliation');
        const employeeCodeInput = modal.querySelector('#manual-employee-code');
        const employeeNameInput = modal.querySelector('#manual-employee-name');
        const employeeJobInput = modal.querySelector('#manual-employee-job');
        const employeeDeptInput = modal.querySelector('#manual-employee-department'); // Correct ID
        const injuryDescInput = modal.querySelector('#manual-injury-description');
        const lossesInput = modal.querySelector('#manual-losses');
        const actionsInput = modal.querySelector('#manual-actions-taken');

        const leaveStartDateInput = modal.querySelector('#manual-leave-start-date');
        const returnToWorkDateInput = modal.querySelector('#manual-return-to-work-date');
        const treatingDoctorInput = modal.querySelector('#manual-treating-doctor');

        // Validation - Basic Fields
        if (!typeSelect.value || !factorySelect.value || !locationSelect.value ||
            !dateInput.value || !timeInput.value || !shiftSelect.value ||
            !briefDescInput.value) {
            Notification.error('يرجى ملء جميع الحقول المطلوبة');
            return;
        }

        // Additional validation for Injury type
        if (typeSelect.value === 'اصابة') {
            const affiliation = (affiliationInput?.value || '').trim();
            const isCompanyEmployee = !affiliation || affiliation === 'شركة';

            // Require employee code only for company employees
            if (isCompanyEmployee && !employeeCodeInput?.value?.trim()) {
                Notification.error('كود الموظف مطلوب عند اختيار تبعية "شركة"');
                return;
            }

            // Require name + department for injury records (job remains optional to avoid blocking if HR data is incomplete)
            if (!employeeNameInput?.value?.trim() || !employeeDeptInput?.value?.trim()) {
                Notification.error('بيانات المصاب (الاسم، الإدارة) مطلوبة في حالة الإصابة');
                return;
            }
        }

        // Validate dates if present
        if (returnToWorkDateInput.value && leaveStartDateInput.value) {
            const startDate = new Date(leaveStartDateInput.value);
            const returnDate = new Date(returnToWorkDateInput.value);
            if (returnDate < startDate) {
                Notification.error('تاريخ العودة للعمل يجب أن يكون بعد تاريخ بداية الإجازة');
                return;
            }
        }

        // إنشاء سجل جديد
        const sequentialNumberInput = modal.querySelector('#manual-sequential-number');
        const sequentialNumber = sequentialNumberInput ? parseInt(sequentialNumberInput.value) || this.generateRegistrySequentialNumber() : this.generateRegistrySequentialNumber();
        const factoryName = factorySelect.options[factorySelect.selectedIndex]?.text || factorySelect.value;
        const locationName = locationSelect.options[locationSelect.selectedIndex]?.text || locationSelect.value;
        const incidentDateTime = new Date(dateInput.value + 'T' + timeInput.value);
        const dayInput = modal.querySelector('#manual-incident-day');
        const incidentDay = dayInput?.value || this.getDayName(incidentDateTime);

        // حساب إجمالي أيام الإجازة
        const totalLeaveDays = this.calculateTotalLeaveDays(leaveStartDateInput?.value, returnToWorkDateInput?.value);

        const entry = {
            id: Utils.generateId('INCR'),
            sequentialNumber: sequentialNumber.toString(),
            incidentId: null,
            incidentType: typeSelect.value, // New Field
            factory: factoryName,
            incidentLocation: locationName,
            incidentDate: incidentDateTime.toISOString(),
            incidentDay: incidentDay,
            incidentTime: timeInput.value,
            shift: shiftSelect.value,

            // Employee Info (Conditional)
            employeeAffiliation: affiliationInput?.value || '', // New
            employeeCode: employeeCodeInput?.value.trim() || '',
            employeeName: employeeNameInput?.value.trim() || '',
            employeeJob: employeeJobInput?.value.trim() || '',
            employeeDepartment: employeeDeptInput?.value.trim() || '', // Now linked to employee section

            // Details
            incidentDetails: briefDescInput.value.trim(), // Mapped from Brief Description
            injuryDescription: injuryDescInput?.value.trim() || '', // New Field
            losses: lossesInput?.value.trim() || '', // New Field
            actionsTaken: actionsInput?.value.trim() || '', // New Field

            incidentDetailsBrief: briefDescInput.value.trim(), // redundancy if needed or just use incidentDetails as main

            // Legacy/Optional mappings
            injuredPart: injuryDescInput?.value.trim() || 'غير محدد',
            equipmentCause: 'غير محدد', // Removed specific field in form, default to generic

            leaveStartDate: leaveStartDateInput?.value || '',
            returnToWorkDate: returnToWorkDateInput?.value || '',
            totalLeaveDays: totalLeaveDays,

            status: 'مفتوح',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // إنشاء حادث في قائمة الحوادث حتى يظهر للمدير في تبويب الموافقات (إرسال للاعتماد)
        const incidentId = typeof Utils.generateSequentialId === 'function'
            ? Utils.generateSequentialId('INC', AppState.appData?.incidents || [])
            : Utils.generateId('INC');
        const incident = {
            id: incidentId,
            isoCode: this.generateISOCode('INC'),
            title: (entry.incidentDetailsBrief || entry.incidentDetails || 'حادث من الإدخال اليدوي').substring(0, 200),
            description: entry.incidentDetails || '',
            location: entry.incidentLocation || entry.factory || '',
            date: entry.incidentDate,
            severity: 'متوسطة',
            incidentType: entry.incidentType || '',
            status: 'مفتوح',
            requiresApproval: true,
            reportedBy: entry.employeeName ? entry.employeeName + (entry.employeeCode ? ' (' + entry.employeeCode + ')' : '') : 'إدخال يدوي',
            department: entry.employeeDepartment || '',
            employeeCode: entry.employeeCode || '',
            employeeName: entry.employeeName || '',
            employeeJob: entry.employeeJob || '',
            employeeDepartment: entry.employeeDepartment || '',
            createdBy: AppState.currentUser ? {
                id: AppState.currentUser.id || '',
                name: AppState.currentUser.name || AppState.currentUser.displayName || '',
                email: AppState.currentUser.email || ''
            } : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        entry.incidentId = incident.id;

        Loading.show('جاري الحفظ...');
        try {
            this._manualEntrySubmitting = true;
            if (!AppState.appData.incidents) AppState.appData.incidents = [];
            AppState.appData.incidents.push(incident);
            this.registryData.push(entry);

            // حفظ محلي (قائمة الحوادث + السجل)
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }
            await this.saveRegistryData({ sync: false });

            Loading.hide();
            Notification.success('تم إضافة الحادث بنجاح. سيظهر للمدير في تبويب الموافقات للاعتماد.');
            modal.remove();

            // تحديث عرض السجل (بدون تعطيل واجهة المستخدم)
            setTimeout(async () => {
                try {
                    if (this.currentTab === 'registry') {
                        const contentContainer = document.getElementById('incidents-tab-content');
                        if (contentContainer) {
                            contentContainer.innerHTML = await this.renderRegistryTab();
                            this.setupTabEventListeners('registry');
                        }
                    }
                } catch (e) {
                    Utils.safeWarn('تعذر تحديث عرض السجل بعد الحفظ:', e);
                }
            }, 0);

            // المزامنة في الخلفية (Incidents + IncidentsRegistry + Clinic Sick Leave)
            setTimeout(() => {
                try {
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                        GoogleIntegration.autoSave('Incidents', AppState.appData.incidents).catch((err) => {
                            Utils.safeWarn('⚠️ فشل مزامنة الحوادث في الخلفية:', err);
                        });
                        GoogleIntegration.autoSave('IncidentsRegistry', this.registryData).catch((err) => {
                            Utils.safeWarn('⚠️ فشل مزامنة سجل الحوادث في الخلفية:', err);
                        });
                    }
                } catch (e) {
                    Utils.safeWarn('⚠️ خطأ أثناء مزامنة البيانات في الخلفية:', e);
                }
                try {
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                        GoogleIntegration.sendRequest({ action: 'addIncident', data: incident }).catch((err) => {
                            Utils.safeWarn('⚠️ فشل إرسال الحادث إلى الخادم:', err);
                        });
                    }
                } catch (e) {
                    Utils.safeWarn('⚠️ خطأ أثناء إرسال الحادث إلى الخادم:', e);
                }

                this.syncClinicSickLeaveFromRegistryEntry(entry, {
                    treatingDoctor: treatingDoctorInput?.value || '',
                    actions: actionsInput?.value || ''
                }).catch((e) => {
                    Utils.safeWarn('تعذر ربط الإجازة المرضية بالعيادة:', e);
                });
            }, 0);
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ أثناء الحفظ: ' + error.message);
            Utils.safeError('خطأ في حفظ الإدخال اليدوي:', error);
        } finally {
            this._manualEntrySubmitting = false;
        }
    },

    /**
     * ربط بيانات الإجازة المرضية من سجل الحوادث (الإدخال اليدوي) إلى موديول العيادة (سجل الإجازات المرضية)
     * - يسجل محلياً في AppState.appData.sickLeave
     * - ثم يرسل إلى Google Sheets في الخلفية عبر action:addSickLeave
     */
    async syncClinicSickLeaveFromRegistryEntry(entry, options = {}) {
        try {
            if (!entry) return false;

            // Only for company employees (has code) and when leave dates exist
            const employeeCode = (entry.employeeCode || '').toString().trim();
            const employeeName = (entry.employeeName || '').toString().trim();
            const employeeDepartment = (entry.employeeDepartment || '').toString().trim();
            const startDateStr = (entry.leaveStartDate || '').toString().trim();
            const endDateStr = (entry.returnToWorkDate || '').toString().trim();

            if (!employeeCode || !employeeName || !employeeDepartment) return false;
            if (!startDateStr || !endDateStr) return false;

            if (typeof Clinic === 'undefined' || typeof Clinic.normalizeSickLeaveRecord !== 'function') {
                return false;
            }

            // Ensure clinic data arrays exist & are normalized
            try { Clinic.ensureData?.(); } catch (e) { /* ignore */ }

            // Prevent duplicates if user saves multiple times
            const existing = (AppState.appData?.sickLeave || []).some((leave) => leave?.linkedRegistryId === entry.id);
            if (existing) return true;

            const safeDateToIso = (yyyyMmDd) => {
                try {
                    const d = new Date(`${yyyyMmDd}T00:00:00`);
                    if (Number.isNaN(d.getTime())) return null;
                    return d.toISOString();
                } catch {
                    return null;
                }
            };

            const startISO = safeDateToIso(startDateStr);
            const endISO = safeDateToIso(endDateStr);
            if (!startISO || !endISO) return false;

            const treatingDoctor = (options.treatingDoctor || '').toString().trim();
            const actions = (options.actions || entry.actionsTaken || '').toString().trim();

            const reasonParts = [];
            if (entry.injuryDescription) reasonParts.push(`تفاصيل الإجازة/الإصابة: ${entry.injuryDescription}`);
            if (entry.incidentDetails) reasonParts.push(`ملخص الحادث: ${entry.incidentDetails}`);
            const reason = reasonParts.join('\n') || 'إجازة مرضية مرتبطة بحادث';

            const createdBy = AppState.currentUser ? {
                id: AppState.currentUser.id || '',
                name: AppState.currentUser.name || AppState.currentUser.displayName || '',
                email: AppState.currentUser.email || ''
            } : null;

            const payload = Clinic.normalizeSickLeaveRecord({
                id: Utils.generateId('SICK_LEAVE'),
                personType: 'employee',
                employeeName,
                employeeCode,
                employeeNumber: employeeCode,
                employeePosition: entry.employeeJob || '',
                employeeDepartment,
                startDate: startISO,
                endDate: endISO,
                reason,
                medicalNotes: actions,
                treatingDoctor,
                createdAt: new Date().toISOString(),
                createdBy,
                createdById: createdBy?.id || AppState.currentUser?.id || '',
                updatedAt: new Date().toISOString()
            });

            // Link back to the registry entry (extra fields are safe to keep)
            payload.linkedRegistryId = entry.id || '';
            payload.sourceType = 'IncidentsRegistryManual';

            if (!AppState.appData) AppState.appData = {};
            if (!Array.isArray(AppState.appData.sickLeave)) AppState.appData.sickLeave = [];
            AppState.appData.sickLeave.push(payload);

            // Save locally
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            // Sync in background
            try {
                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                    await GoogleIntegration.sendRequest({ action: 'addSickLeave', data: payload });
                }
            } catch (syncError) {
                Utils.safeWarn('⚠️ فشل مزامنة الإجازة المرضية مع Google Sheets:', syncError);
            }

            return true;
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في ربط الإجازة المرضية:', error);
            return false;
        }
    },

    /**
     * تطبيق فلاتر السجل
     */
    applyRegistryFilters() {
        const searchTerm = document.getElementById('incidents-registry-search')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('incidents-registry-filter-status')?.value || '';
        const dateFrom = document.getElementById('incidents-registry-filter-date-from')?.value || '';
        const dateTo = document.getElementById('incidents-registry-filter-date-to')?.value || '';

        let filtered = [...this.registryData];

        if (searchTerm) {
            filtered = filtered.filter(entry =>
                (entry.sequentialNumber?.toString().includes(searchTerm)) ||
                (entry.employeeName?.toLowerCase().includes(searchTerm)) ||
                (entry.employeeCode?.toLowerCase().includes(searchTerm)) ||
                (entry.factory?.toLowerCase().includes(searchTerm)) ||
                (entry.incidentLocation?.toLowerCase().includes(searchTerm))
            );
        }

        if (statusFilter) {
            filtered = filtered.filter(entry => entry.status === statusFilter);
        }

        if (dateFrom) {
            filtered = filtered.filter(entry => {
                if (!entry.incidentDate) return false;
                const entryDate = this.safeDateToISOString(entry.incidentDate, 10);
                if (!entryDate) return false;
                return entryDate >= dateFrom;
            });
        }

        if (dateTo) {
            filtered = filtered.filter(entry => {
                if (!entry.incidentDate) return false;
                const entryDate = this.safeDateToISOString(entry.incidentDate, 10);
                if (!entryDate) return false;
                return entryDate <= dateTo;
            });
        }

        // تحديث الجدول
        this.renderFilteredRegistryTable(filtered);
    },

    /**
     * عرض جدول السجل المفلتر
     */
    renderFilteredRegistryTable(filteredData) {
        const tableContainer = document.querySelector('#incidents-tab-content .table-responsive');
        if (!tableContainer) return;

        if (filteredData.length === 0) {
            tableContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد نتائج للبحث</p>
                </div>
            `;
            return;
        }

        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('ar-SA');
            } catch {
                return '-';
            }
        };

        let tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>مسلسل</th>
                        <th>المصنع</th>
                        <th>مكان الحادث</th>
                        <th>تاريخ الحادث</th>
                        <th>يوم الحادث</th>
                        <th>وقت الحادث</th>
                        <th>الوردية</th>
                        <th>كود الموظف</th>
                        <th>اسم الموظف</th>
                        <th>الوظيفة</th>
                        <th>الإدارة / القسم</th>
                        <th>تفاصيل الحادث</th>
                        <th>الجزء المصاب</th>
                        <th>المعدة المتسببة</th>
                        <th>إجمالي أيام الإجازة</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
        `;

        filteredData.forEach(entry => {
            tableHTML += `
                <tr>
                    <td>${entry.sequentialNumber || '-'}</td>
                    <td>${Utils.escapeHTML(entry.factory || '-')}</td>
                    <td>${Utils.escapeHTML(entry.incidentLocation || '-')}</td>
                    <td>${formatDate(entry.incidentDate)}</td>
                    <td>${Utils.escapeHTML(entry.incidentDay || '-')}</td>
                    <td>${Utils.escapeHTML(entry.incidentTime || '-')}</td>
                    <td>${Utils.escapeHTML(entry.shift || '-')}</td>
                    <td>${Utils.escapeHTML(entry.employeeCode || '-')}</td>
                    <td>${Utils.escapeHTML(entry.employeeName || '-')}</td>
                    <td>${Utils.escapeHTML(entry.employeeJob || '-')}</td>
                    <td>${Utils.escapeHTML(entry.employeeDepartment || '-')}</td>
                    <td>${Utils.escapeHTML((entry.incidentDetails || '-').substring(0, 50))}${(entry.incidentDetails || '').length > 50 ? '...' : ''}</td>
                    <td>${Utils.escapeHTML(entry.injuredPart || '-')}</td>
                    <td>${Utils.escapeHTML(entry.equipmentCause || '-')}</td>
                    <td>${entry.totalLeaveDays || 0} يوم</td>
                    <td>
                        <div class="flex items-center gap-2">
                            <button onclick="Incidents.viewRegistryEntry('${entry.id}')" class="btn-icon btn-icon-info" title="عرض التفاصيل">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${entry.incidentId ? `
                                <button onclick="Incidents.viewIncident('${entry.incidentId}')" class="btn-icon btn-icon-primary" title="عرض الحادث">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        tableContainer.innerHTML = tableHTML;
    },

    /**
     * تصدير السجل إلى Excel
     */
    exportRegistryToExcel() {
        try {
            const data = this.registryData;
            if (data.length === 0) {
                Notification.warning('لا توجد بيانات للتصدير');
                return;
            }

            let csvContent = '\ufeff'; // BOM for UTF-8
            csvContent += 'مسلسل,المصنع,مكان الحادث,تاريخ الحادث,يوم الحادث,وقت الحادث,الوردية,كود الموظف,اسم الموظف,الوظيفة,الإدارة / القسم,تفاصيل الحادث,الجزء المصاب,المعدة المتسببة,إجمالي أيام الإجازة\n';

            data.forEach(entry => {
                const row = [
                    entry.sequentialNumber || '',
                    entry.factory || '',
                    entry.incidentLocation || '',
                    entry.incidentDate ? new Date(entry.incidentDate).toLocaleDateString('ar-SA') : '',
                    entry.incidentDay || '',
                    entry.incidentTime || '',
                    entry.shift || '',
                    entry.employeeCode || '',
                    entry.employeeName || '',
                    entry.employeeJob || '',
                    entry.employeeDepartment || '',
                    (entry.incidentDetails || '').replace(/,/g, ';'),
                    entry.injuredPart || '',
                    entry.equipmentCause || '',
                    entry.totalLeaveDays || 0
                ];
                csvContent += row.join(',') + '\n';
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `سجل_الحوادث_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 0);

            Notification.success('تم تصدير السجل بنجاح');
        } catch (error) {
            Notification.error('حدث خطأ أثناء التصدير: ' + error.message);
            Utils.safeError('خطأ في تصدير السجل:', error);
        }
    },

    /**
     * تصدير السجل إلى PDF
     */
    exportRegistryToPDF() {
        try {
            const data = this.registryData;
            if (data.length === 0) {
                Notification.warning('لا توجد بيانات للتصدير');
                return;
            }

            // استخدام نفس آلية تصدير PDF للحوادث
            const content = this.buildRegistryPDFContent(data);
            const htmlContent = `
                <html lang="ar" dir="rtl">
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            @page { size: A4 landscape; margin: 1cm; }
                            @media print {
                                @page { size: A4 landscape; margin: 1cm; }
                            }
                            body { font-family: 'Cairo', 'Tahoma', Arial, sans-serif; direction: rtl; text-align: right; padding: 20px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; page-break-inside: auto; }
                            th, td { border: 1px solid #ddd; padding: 6px; text-align: right; }
                            th { background-color: #f2f2f2; font-weight: bold; }
                            tr { page-break-inside: avoid; }
                            tr:nth-child(even) { background-color: #f9f9f9; }
                            thead { display: table-header-group; }
                        </style>
                    </head>
                    <body>
                        <h1>سجل الحوادث</h1>
                        <p>تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}</p>
                        ${content}
                    </body>
                </html>
            `;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                            Notification.success('تم تجهيز التقرير للطباعة/الحفظ كـ PDF');
                        }, 500);
                    }, 300);
                };
            } else {
                Notification.error('تعذر فتح نافذة التصدير. يرجى السماح بالنوافذ المنبثقة.');
            }
        } catch (error) {
            Notification.error('حدث خطأ أثناء التصدير: ' + error.message);
            Utils.safeError('خطأ في تصدير السجل:', error);
        }
    },

    /**
     * بناء محتوى PDF للسجل
     */
    buildRegistryPDFContent(data) {
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                return new Date(dateStr).toLocaleDateString('ar-SA');
            } catch {
                return '-';
            }
        };

        let tableRows = '';
        data.forEach(entry => {
            tableRows += `
                <tr>
                    <td>${entry.sequentialNumber || '-'}</td>
                    <td>${entry.factory || '-'}</td>
                    <td>${entry.incidentLocation || '-'}</td>
                    <td>${formatDate(entry.incidentDate)}</td>
                    <td>${entry.incidentDay || '-'}</td>
                    <td>${entry.incidentTime || '-'}</td>
                    <td>${entry.shift || '-'}</td>
                    <td>${entry.employeeCode || '-'}</td>
                    <td>${entry.employeeName || '-'}</td>
                    <td>${entry.employeeJob || '-'}</td>
                    <td>${entry.employeeDepartment || '-'}</td>
                    <td>${(entry.incidentDetails || '-').substring(0, 100)}</td>
                    <td>${entry.injuredPart || '-'}</td>
                    <td>${entry.equipmentCause || '-'}</td>
                    <td>${entry.totalLeaveDays || 0}</td>
                </tr>
            `;
        });

        return `
            <table>
                <thead>
                    <tr>
                        <th>مسلسل</th>
                        <th>المصنع</th>
                        <th>مكان الحادث</th>
                        <th>تاريخ الحادث</th>
                        <th>يوم الحادث</th>
                        <th>وقت الحادث</th>
                        <th>الوردية</th>
                        <th>كود الموظف</th>
                        <th>اسم الموظف</th>
                        <th>الوظيفة</th>
                        <th>الإدارة / القسم</th>
                        <th>تفاصيل الحادث</th>
                        <th>الجزء المصاب</th>
                        <th>المعدة المتسببة</th>
                        <th>إجمالي أيام الإجازة</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;
    },

    renderAnalysisContent(settings) {
        const analytics = this.buildThreeYearAnalytics();
        const { yearlyStats, totals, severityTotals } = analytics;

        // Render based on admin settings
        const enabledSections = settings?.enabledSections || ['summary', 'trends', 'severity', 'department'];

        let content = '';

        if (enabledSections.includes('summary')) {
            content += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-4">ملخص عام</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="border border-gray-200 rounded-lg p-4">
                            <p class="text-sm text-gray-600 mb-2">إجمالي الحوادث</p>
                            <p class="text-2xl font-bold">${totals.totalIncidents}</p>
                        </div>
                        <div class="border border-gray-200 rounded-lg p-4">
                            <p class="text-sm text-gray-600 mb-2">معدل الإغلاق</p>
                            <p class="text-2xl font-bold text-green-600">${totals.closureRate.toFixed(1)}%</p>
                        </div>
                        <div class="border border-gray-200 rounded-lg p-4">
                            <p class="text-sm text-gray-600 mb-2">متوسط سنوي</p>
                            <p class="text-2xl font-bold">${totals.averagePerYear.toFixed(1)}</p>
                        </div>
                    </div>
                </div>
            `;
        }

        if (enabledSections.includes('trends')) {
            content += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-4">الاتجاهات</h3>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>السنة</th>
                                    <th>عدد الحوادث</th>
                                    <th>الحوادث المغلقة</th>
                                    <th>معدل الإغلاق</th>
                                    <th>التغيير</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${yearlyStats.map((stat, index) => {
                const prevStat = yearlyStats[index + 1];
                const change = prevStat ? ((stat.total - prevStat.total) / prevStat.total * 100).toFixed(1) : '-';
                const changeClass = change !== '-' ? (change > 0 ? 'text-red-600' : 'text-green-600') : '';
                return `
                                        <tr>
                                            <td>${stat.year}</td>
                                            <td>${stat.total}</td>
                                            <td>${stat.closed}</td>
                                            <td>${stat.closureRate.toFixed(1)}%</td>
                                            <td class="${changeClass}">${change !== '-' ? (change > 0 ? '+' : '') + change + '%' : '-'}</td>
                                        </tr>
                                    `;
            }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        if (enabledSections.includes('severity')) {
            content += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-4">توزيع الحوادث حسب الشدة</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="border border-red-200 rounded-lg p-4 bg-red-50">
                            <p class="text-sm text-red-700 mb-1">عالية</p>
                            <p class="text-2xl font-bold text-red-600">${severityTotals.high || 0}</p>
                        </div>
                        <div class="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                            <p class="text-sm text-yellow-700 mb-1">متوسطة</p>
                            <p class="text-2xl font-bold text-yellow-600">${severityTotals.medium || 0}</p>
                        </div>
                        <div class="border border-blue-200 rounded-lg p-4 bg-blue-50">
                            <p class="text-sm text-blue-700 mb-1">منخفضة</p>
                            <p class="text-2xl font-bold text-blue-600">${severityTotals.low || 0}</p>
                        </div>
                        <div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <p class="text-sm text-gray-700 mb-1">أخرى</p>
                            <p class="text-2xl font-bold text-gray-600">${severityTotals.other || 0}</p>
                        </div>
                    </div>
                </div>
            `;
        }

        if (enabledSections.includes('department')) {
            // Group by department
            const departmentStats = {};
            analytics.incidents.forEach(({ incident }) => {
                const dept = incident?.department || 'غير محدد';
                departmentStats[dept] = (departmentStats[dept] || 0) + 1;
            });

            const deptRows = Object.entries(departmentStats)
                .sort((a, b) => b[1] - a[1])
                .map(([dept, count]) => `
                    <tr>
                        <td>${Utils.escapeHTML(dept)}</td>
                        <td>${count}</td>
                        <td>${totals.totalIncidents > 0 ? ((count / totals.totalIncidents) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                `).join('');

            content += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-4">توزيع الحوادث حسب الإدارة</h3>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>الإدارة</th>
                                    <th>عدد الحوادث</th>
                                    <th>النسبة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${deptRows || '<tr><td colspan="3" class="text-center text-gray-500">لا توجد بيانات</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        if (enabledSections.includes('location')) {
            // Group by location
            const locationStats = {};
            analytics.incidents.forEach(({ incident }) => {
                const loc = incident?.location || 'غير محدد';
                locationStats[loc] = (locationStats[loc] || 0) + 1;
            });

            const locRows = Object.entries(locationStats)
                .sort((a, b) => b[1] - a[1])
                .map(([loc, count]) => `
                    <tr>
                        <td>${Utils.escapeHTML(loc)}</td>
                        <td>${count}</td>
                        <td>${totals.totalIncidents > 0 ? ((count / totals.totalIncidents) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                `).join('');

            content += `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-4">توزيع الحوادث حسب الموقع</h3>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>الموقع</th>
                                    <th>عدد الحوادث</th>
                                    <th>النسبة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${locRows || '<tr><td colspan="3" class="text-center text-gray-500">لا توجد بيانات</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        return content || '<p class="text-gray-500 text-center py-8">لا توجد أقسام تحليل مفعلة حالياً.</p>';
    },

    async getAnalysisSettings() {
        try {
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.callAppsScript) {
                const result = await GoogleIntegration.callAppsScript('getIncidentAnalysisSettings');
                if (result && result.success) {
                    return result.data || {};
                }
            }
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في جلب إعدادات التحليل:', error);
        }

        // Fallback: try local storage
        try {
            const localSettings = localStorage.getItem('incident_analysis_settings');
            if (localSettings) {
                return JSON.parse(localSettings);
            }
        } catch (e) {
            // Ignore
        }

        // Default settings
        return {
            enabledSections: ['summary', 'trends', 'severity', 'department']
        };
    },

    isAdmin() {
        if (typeof Permissions !== 'undefined' && typeof Permissions.isCurrentUserAdmin === 'function') {
            return Permissions.isCurrentUserAdmin();
        }
        return (AppState.currentUser?.role || '').toLowerCase() === 'admin';
    },

    setupTabEventListeners(tabName) {
        if (tabName === 'incidents-list') {
            this.loadIncidentsList();
        } else if (tabName === 'analysis') {
            // Setup analysis tab event listeners
            const editSettingsBtn = document.getElementById('edit-analysis-settings-btn');
            if (editSettingsBtn) {
                editSettingsBtn.addEventListener('click', () => this.showAnalysisSettingsModal());
            }
        } else if (tabName === 'registry') {
            // Setup registry tab event listeners
            setTimeout(() => {
                const registryAddBtn = document.getElementById('incidents-registry-add-manual');
                if (registryAddBtn && !registryAddBtn.dataset.listenerAdded) {
                    registryAddBtn.addEventListener('click', () => this.showManualEntryForm());
                    registryAddBtn.dataset.listenerAdded = 'true';
                }

                const registrySearch = document.getElementById('incidents-registry-search');
                const registryFilterStatus = document.getElementById('incidents-registry-filter-status');
                const registryFilterDateFrom = document.getElementById('incidents-registry-filter-date-from');
                const registryFilterDateTo = document.getElementById('incidents-registry-filter-date-to');

                if (registrySearch && !registrySearch.dataset.listenerAdded) {
                    registrySearch.addEventListener('input', () => this.applyRegistryFilters());
                    registrySearch.dataset.listenerAdded = 'true';
                }
                if (registryFilterStatus && !registryFilterStatus.dataset.listenerAdded) {
                    registryFilterStatus.addEventListener('change', () => this.applyRegistryFilters());
                    registryFilterStatus.dataset.listenerAdded = 'true';
                }
                if (registryFilterDateFrom && !registryFilterDateFrom.dataset.listenerAdded) {
                    registryFilterDateFrom.addEventListener('change', () => this.applyRegistryFilters());
                    registryFilterDateFrom.dataset.listenerAdded = 'true';
                }
                if (registryFilterDateTo && !registryFilterDateTo.dataset.listenerAdded) {
                    registryFilterDateTo.addEventListener('change', () => this.applyRegistryFilters());
                    registryFilterDateTo.dataset.listenerAdded = 'true';
                }

                const registryExportExcel = document.getElementById('incidents-registry-export-excel');
                const registryExportPDF = document.getElementById('incidents-registry-export-pdf');
                if (registryExportExcel && !registryExportExcel.dataset.listenerAdded) {
                    registryExportExcel.addEventListener('click', () => this.exportRegistryToExcel());
                    registryExportExcel.dataset.listenerAdded = 'true';
                }
                if (registryExportPDF && !registryExportPDF.dataset.listenerAdded) {
                    registryExportPDF.addEventListener('click', () => this.exportRegistryToPDF());
                    registryExportPDF.dataset.listenerAdded = 'true';
                }
            }, 100);
        } else if (tabName === 'annual-log' || tabName === 'detailed-log') {
            // Setup export buttons for annual and detailed logs
            const previewBtn = document.getElementById('incidents-report-preview');
            if (previewBtn) {
                previewBtn.addEventListener('click', () => this.openReportPreview());
            }

            document.querySelectorAll('[data-incidents-export]').forEach((btn) => {
                const format = btn.getAttribute('data-incidents-export');
                btn.addEventListener('click', () => this.exportIncidentsReport(format));
            });
        } else if (tabName === 'approvals') {
            // Setup approvals tab event listeners
            setTimeout(() => {
                const approvalsSearch = document.getElementById('approvals-search');
                if (approvalsSearch && !approvalsSearch.dataset.listenerAdded) {
                    approvalsSearch.addEventListener('input', (e) => {
                        const searchTerm = e.target.value.toLowerCase();
                        const rows = document.querySelectorAll('#approvals-table-body tr[data-incident-id]');
                        rows.forEach(row => {
                            const text = row.textContent.toLowerCase();
                            row.style.display = text.includes(searchTerm) ? '' : 'none';
                        });
                    });
                    approvalsSearch.dataset.listenerAdded = 'true';
                }
            }, 100);
        }
    },

    async showAnalysisSettingsModal() {
        if (!this.isAdmin()) {
            Notification.error('ليس لديك صلاحية لتعديل إعدادات التحليل');
            return;
        }

        const currentSettings = await this.getAnalysisSettings();
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-cog ml-2"></i>
                        إعدادات تحليل الحوادث
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="analysis-settings-form" class="space-y-6">
                        <div>
                            <h3 class="text-base font-semibold text-gray-700 mb-4">الأقسام المعروضة</h3>
                            <p class="text-sm text-gray-600 mb-4">اختر الأقسام التي تريد عرضها في تبويب تحليل الحوادث:</p>
                            <div class="space-y-3">
                                <label class="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" name="enabledSections" value="summary" 
                                        ${(currentSettings.enabledSections || []).includes('summary') ? 'checked' : ''}
                                        class="form-checkbox">
                                    <div>
                                        <span class="font-medium">ملخص عام</span>
                                        <p class="text-xs text-gray-500">عرض إجمالي الحوادث، معدل الإغلاق، والمتوسط السنوي</p>
                                    </div>
                                </label>
                                <label class="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" name="enabledSections" value="trends" 
                                        ${(currentSettings.enabledSections || []).includes('trends') ? 'checked' : ''}
                                        class="form-checkbox">
                                    <div>
                                        <span class="font-medium">الاتجاهات</span>
                                        <p class="text-xs text-gray-500">عرض اتجاهات الحوادث على مر السنين</p>
                                    </div>
                                </label>
                                <label class="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" name="enabledSections" value="severity" 
                                        ${(currentSettings.enabledSections || []).includes('severity') ? 'checked' : ''}
                                        class="form-checkbox">
                                    <div>
                                        <span class="font-medium">توزيع الشدة</span>
                                        <p class="text-xs text-gray-500">عرض توزيع الحوادث حسب الشدة (عالية، متوسطة، منخفضة)</p>
                                    </div>
                                </label>
                                <label class="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" name="enabledSections" value="department" 
                                        ${(currentSettings.enabledSections || []).includes('department') ? 'checked' : ''}
                                        class="form-checkbox">
                                    <div>
                                        <span class="font-medium">توزيع الإدارات</span>
                                        <p class="text-xs text-gray-500">عرض توزيع الحوادث حسب الإدارة</p>
                                    </div>
                                </label>
                                <label class="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" name="enabledSections" value="location" 
                                        ${(currentSettings.enabledSections || []).includes('location') ? 'checked' : ''}
                                        class="form-checkbox">
                                    <div>
                                        <span class="font-medium">توزيع المواقع</span>
                                        <p class="text-xs text-gray-500">عرض توزيع الحوادث حسب الموقع</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button class="btn-primary" onclick="Incidents.saveAnalysisSettings(); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-save ml-2"></i>
                        حفظ الإعدادات
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النموذج.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) modal.remove();
            }
        });
    },

    async saveAnalysisSettings() {
        if (!this.isAdmin()) {
            Notification.error('ليس لديك صلاحية لتعديل إعدادات التحليل');
            return;
        }

        const form = document.getElementById('analysis-settings-form');
        if (!form) return;

        const checkboxes = form.querySelectorAll('input[name="enabledSections"]:checked');
        const enabledSections = Array.from(checkboxes).map(cb => cb.value);

        const settings = {
            enabledSections: enabledSections.length > 0 ? enabledSections : ['summary', 'trends', 'severity', 'department'],
            updatedAt: new Date().toISOString(),
            updatedBy: AppState.currentUser?.email || AppState.currentUser?.name || 'Unknown'
        };

        try {
            Loading.show();
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.callAppsScript) {
                const result = await GoogleIntegration.callAppsScript('saveIncidentAnalysisSettings', { settings });
                if (result && result.success) {
                    Notification.success('تم حفظ إعدادات التحليل بنجاح');
                    // Refresh analysis tab
                    if (this.currentTab === 'analysis') {
                        const contentContainer = document.getElementById('incidents-tab-content');
                        if (contentContainer) {
                            contentContainer.innerHTML = await this.renderTabContent('analysis');
                            this.setupTabEventListeners('analysis');
                        }
                    }
                } else {
                    Notification.error(result?.message || 'فشل حفظ الإعدادات');
                }
            } else {
                // Fallback: save to local storage
                localStorage.setItem('incident_analysis_settings', JSON.stringify(settings));
                Notification.success('تم حفظ الإعدادات محلياً');
                if (this.currentTab === 'analysis') {
                    const contentContainer = document.getElementById('incidents-tab-content');
                    if (contentContainer) {
                        contentContainer.innerHTML = await this.renderTabContent('analysis');
                        this.setupTabEventListeners('analysis');
                    }
                }
            }
            Loading.hide();
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في حفظ إعدادات التحليل:', error);
            Notification.error('حدث خطأ أثناء حفظ الإعدادات');
        }
    },

    renderAnalytics() {
        const analytics = this.buildThreeYearAnalytics();
        const { yearlyStats, totals, severityTotals } = analytics;
        const improvementInfo = this.formatImprovementValue(analytics.currentImprovement);
        const hasIncidents = totals.totalIncidents > 0;
        const formatDate = (date) => {
            if (!date) return '-';
            try {
                if (typeof Utils !== 'undefined') {
                    if (typeof Utils.formatDateTime === 'function') {
                        return Utils.formatDateTime(date instanceof Date ? date.toISOString() : date);
                    }
                    if (typeof Utils.formatDate === 'function') {
                        return Utils.formatDate(date instanceof Date ? date.toISOString() : date);
                    }
                }
            } catch (error) {
                // تجاهل أي أخطاء تنسيق
            }
            const parsed = date instanceof Date ? date : new Date(date);
            if (Number.isNaN(parsed.getTime())) return '-';
            return parsed.toLocaleDateString('ar-SA');
        };

        const severityChips = [
            { label: 'عالية', value: severityTotals.high || 0, color: 'bg-red-100 text-red-700 border-red-200' },
            { label: 'متوسطة', value: severityTotals.medium || 0, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
            { label: 'منخفضة', value: severityTotals.low || 0, color: 'bg-blue-100 text-blue-700 border-blue-200' },
            { label: 'أخرى', value: severityTotals.other || 0, color: 'bg-gray-100 text-gray-700 border-gray-200' }
        ].filter(chip => chip.value > 0 || hasIncidents);

        const severityChipsContent = severityChips.length > 0
            ? severityChips.map(chip => `
                <span class="px-3 py-1 text-xs font-medium border rounded-full ${chip.color}">
                    ${chip.label}: ${chip.value}
                </span>
            `).join('')
            : '<span class="text-xs text-gray-500">لا توجد بيانات متاحة.</span>';

        const incidentSampleLimit = 20;
        const incidentRows = analytics.incidents.slice(0, incidentSampleLimit).map(({ incident, date, year }) => {
            const severityClass = this.getSeverityBadgeClass(incident?.severity);
            const statusClass = this.getStatusBadgeClass(incident?.status);
            const incidentId = incident?.id || '';
            const actionsCell = incidentId ? `
                <div class="flex items-center gap-2 justify-end">
                    <button onclick="Incidents.viewIncident('${incidentId}')" class="btn-icon btn-icon-info" title="معاينة">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="Incidents.exportPDF('${incidentId}')" class="btn-icon btn-icon-primary" title="طباعة / PDF">
                        <i class="fas fa-print"></i>
                    </button>
                </div>
            ` : '<span class="text-xs text-gray-400">غير متاح</span>';
            return `
                <tr>
                    <td>${year}</td>
                    <td>${formatDate(date)}</td>
                    <td>${Utils.escapeHTML(incident?.title || '-')}</td>
                    <td>${Utils.escapeHTML(incident?.location || '-')}</td>
                    <td>
                        <span class="badge badge-${severityClass}">
                            ${Utils.escapeHTML(incident?.severity || '-')}
                        </span>
                    </td>
                    <td>
                        <span class="badge badge-${statusClass}">
                            ${Utils.escapeHTML(incident?.status || '-')}
                        </span>
                    </td>
                    <td>${actionsCell}</td>
                </tr>
            `;
        }).join('');

        const incidentTableBody = analytics.incidents.length === 0
            ? '<tr><td colspan="7" class="text-center text-gray-500 py-6">لا توجد حوادث مسجلة خلال آخر ٣ سنوات.</td></tr>'
            : incidentRows;

        const yearlyRows = yearlyStats.map((stat) => {
            const improvement = this.formatImprovementValue(stat.improvementVsPrevious);
            return `
                <tr>
                    <td>${stat.year}</td>
                    <td>${stat.total}</td>
                    <td>${stat.closed}</td>
                    <td>${stat.closureRate.toFixed(1)}%</td>
                    <td>
                        <div class="space-y-1 text-xs">
                            <div><span class="inline-block w-2 h-2 rounded-full bg-red-500 ml-1"></span>عالية: ${stat.severity.high}</div>
                            <div><span class="inline-block w-2 h-2 rounded-full bg-yellow-500 ml-1"></span>متوسطة: ${stat.severity.medium}</div>
                            <div><span class="inline-block w-2 h-2 rounded-full bg-blue-500 ml-1"></span>منخفضة: ${stat.severity.low}</div>
                            <div><span class="inline-block w-2 h-2 rounded-full bg-gray-500 ml-1"></span>أخرى: ${stat.severity.other}</div>
                        </div>
                    </td>
                    <td>
                        <span class="font-semibold ${improvement.className}">${improvement.label}</span>
                    </td>
                </tr>
            `;
        }).join('');

        const yearlyTableBody = hasIncidents
            ? yearlyRows
            : '<tr><td colspan="6" class="text-center text-gray-500 py-6">لا توجد بيانات مسجلة لآخر ٣ سنوات.</td></tr>';

        return `
            <div class="space-y-6">
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between gap-3 flex-wrap">
                            <h2 class="card-title">
                                <i class="fas fa-chart-column ml-2"></i>
                                ملخص الأداء لآخر ٣ سنوات
                            </h2>
                            <div class="flex items-center gap-2">
                                <button id="incidents-report-preview" class="btn-secondary">
                                    <i class="fas fa-eye ml-2"></i>
                                    معاينة التقرير
                                </button>
                                <button class="btn-primary" data-incidents-export="pdf">
                                    <i class="fas fa-file-pdf ml-2"></i>
                                    PDF
                                </button>
                                <button class="btn-primary" data-incidents-export="excel">
                                    <i class="fas fa-file-excel ml-2"></i>
                                    Excel
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="border border-gray-200 rounded-lg p-4 bg-white">
                                <p class="text-xs text-gray-500 mb-1">إجمالي الحوادث</p>
                                <p class="text-3xl font-bold text-gray-900">${totals.totalIncidents}</p>
                                <p class="text-xs text-gray-400 mt-1">الفترة: ${totals.rangeLabel}</p>
                            </div>
                            <div class="border border-gray-200 rounded-lg p-4 bg-white">
                                <p class="text-xs text-gray-500 mb-1">معدل الإغلاق</p>
                                <p class="text-3xl font-bold text-green-600">${totals.closureRate.toFixed(1)}%</p>
                                <p class="text-xs text-gray-400 mt-1">عدد الحوادث المغلقة: ${totals.closedIncidents}</p>
                            </div>
                            <div class="border border-gray-200 rounded-lg p-4 bg-white">
                                <p class="text-xs text-gray-500 mb-1">معدل التحسين عن العام السابق</p>
                                <p class="text-3xl font-bold ${improvementInfo.className}">${improvementInfo.label}</p>
                                <p class="text-xs text-gray-400 mt-1">يعتمد على مقارنة ${yearlyStats[0]?.year || ''} مع ${yearlyStats[1]?.year || ''}</p>
                            </div>
                        </div>
                        <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <p class="text-xs text-gray-500 mb-1">متوسط الحوادث السنوي</p>
                                <p class="text-2xl font-semibold text-gray-800">${totals.averagePerYear.toFixed(1)}</p>
                                <p class="text-xs text-gray-500 mt-1">يتم احتساب المتوسط على أساس ٣ سنوات.</p>
                            </div>
                            <div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <p class="text-xs text-gray-500 mb-2">توزيع الحوادث حسب الشدة</p>
                                <div class="flex flex-wrap gap-2">
                                    ${severityChipsContent}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-calendar-alt ml-2"></i>
                            سجل الحوادث السنوي (آخر ٣ سنوات)
                        </h2>
                    </div>
                    <div class="card-body">
                        <div class="table-wrapper" style="overflow-x: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>السنة</th>
                                        <th>إجمالي الحوادث</th>
                                        <th>الحوادث المغلقة</th>
                                        <th>معدل الإغلاق</th>
                                        <th>توزيع الشدة</th>
                                        <th>معدل التحسين</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${yearlyTableBody}
                                </tbody>
                            </table>
                        </div>
                        <p class="text-xs text-gray-500 mt-3">
                            * يتم احتساب معدل التحسين بناءً على انخفاض عدد الحوادث الإجمالي مقارنة بالعام السابق (زيادة العدد تعني تراجع الأداء).
                        </p>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title">
                                <i class="fas fa-clipboard-list ml-2"></i>
                                سجل الحوادث التفصيلي (آخر ٣ سنوات)
                            </h2>
                            <span class="text-xs text-gray-500">
                                ${analytics.incidents.length} حادث خلال الفترة
                            </span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-wrapper" style="overflow-x: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>السنة</th>
                                        <th>التاريخ</th>
                                        <th>العنوان</th>
                                        <th>الموقع</th>
                                        <th>الشدة</th>
                                        <th>الحالة</th>
                                        <th>الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${incidentTableBody}
                                </tbody>
                            </table>
                        </div>
                        ${analytics.incidents.length > incidentSampleLimit ? `
                            <p class="text-xs text-gray-500 mt-3">
                                * تم عرض أول ${incidentSampleLimit} حوادث فقط. يمكنك الرجوع لقائمة الحوادث الكاملة للاطلاع على جميع التفاصيل.
                            </p>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    refreshAnalytics() {
        const container = document.getElementById('incident-analytics-wrapper');
        if (container) {
            container.innerHTML = this.renderAnalytics();
        }
    },

    buildReportContent() {
        const analytics = this.buildThreeYearAnalytics();
        const { yearlyStats, totals, severityTotals } = analytics;
        const improvementInfo = this.formatImprovementValue(analytics.currentImprovement);
        const escape = (value = '') => {
            const str = value == null ? '' : String(value);
            if (typeof Utils !== 'undefined' && typeof Utils.escapeHTML === 'function') {
                return Utils.escapeHTML(str);
            }
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
        const formatDate = (date) => {
            if (!date) return '-';
            try {
                if (typeof Utils !== 'undefined') {
                    if (typeof Utils.formatDateTime === 'function') {
                        return Utils.formatDateTime(date instanceof Date ? date.toISOString() : date);
                    }
                    if (typeof Utils.formatDate === 'function') {
                        return Utils.formatDate(date instanceof Date ? date.toISOString() : date);
                    }
                }
            } catch (error) { }
            const parsed = date instanceof Date ? date : new Date(date);
            if (Number.isNaN(parsed.getTime())) return '-';
            return parsed.toLocaleDateString('ar-SA');
        };

        const headerSection = `
            <h1 style="font-size: 20px; margin-bottom: 8px;">تقرير الحوادث - آخر ٣ سنوات</h1>
            <p style="color: #6b7280; margin-bottom: 16px;">
                الفترة: ${totals.rangeLabel} • تم التوليد في ${formatDate(new Date())}
            </p>
        `;

        const summarySection = `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <thead>
                    <tr style="background: #f9fafb;">
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">المؤشر</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">القيمة</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">تفاصيل</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">إجمالي الحوادث</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${totals.totalIncidents}</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">عدد الحوادث المسجلة خلال الفترة المحددة</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">معدل الإغلاق</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${totals.closureRate.toFixed(1)}%</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">الحوادث المغلقة: ${totals.closedIncidents}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">متوسط الحوادث السنوي</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${totals.averagePerYear.toFixed(1)}</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">محسوب على أساس ثلاث سنوات</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">معدل التحسين (آخر سنة)</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${improvementInfo.label}</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${improvementInfo.value === null ? 'لا توجد بيانات للمقارنة' : improvementInfo.value > 0 ? 'انخفاض في عدد الحوادث مقارنة بالعام السابق' : 'زيادة في عدد الحوادث مقارنة بالعام السابق'}</td>
                    </tr>
                </tbody>
            </table>
        `;

        const severitySection = `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <thead>
                    <tr style="background: #f3f4f6;">
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">الشدة</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">عدد الحوادث</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">عالية</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${severityTotals.high || 0}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">متوسطة</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${severityTotals.medium || 0}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">منخفضة</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${severityTotals.low || 0}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">أخرى</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${severityTotals.other || 0}</td>
                    </tr>
                </tbody>
            </table>
        `;

        const yearlyRows = yearlyStats.map((stat) => {
            const improvement = this.formatImprovementValue(stat.improvementVsPrevious);
            return `
                <tr>
                    <td style="padding: 8px; border: 1px solid #e5e7eb;">${stat.year}</td>
                    <td style="padding: 8px; border: 1px solid #e5e7eb;">${stat.total}</td>
                    <td style="padding: 8px; border: 1px solid #e5e7eb;">${stat.closed}</td>
                    <td style="padding: 8px; border: 1px solid #e5e7eb;">${stat.closureRate.toFixed(1)}%</td>
                    <td style="padding: 8px; border: 1px solid #e5e7eb;">
                        عالية: ${stat.severity.high} • متوسطة: ${stat.severity.medium} • منخفضة: ${stat.severity.low} • أخرى: ${stat.severity.other}
                    </td>
                    <td style="padding: 8px; border: 1px solid #e5e7eb;">
                        ${improvement.label}
                    </td>
                </tr>
            `;
        }).join('');

        const yearlySection = `
            <h2 style="font-size: 16px; margin: 24px 0 12px;">ملخص سنوي</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <thead>
                    <tr style="background: #f9fafb;">
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">السنة</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">إجمالي الحوادث</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">الحوادث المغلقة</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">معدل الإغلاق</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">توزيع الشدة</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">معدل التحسين</th>
                    </tr>
                </thead>
                <tbody>
                    ${yearlyRows || '<tr><td colspan="6" style="text-align:center; padding: 12px; border: 1px solid #e5e7eb; color: #6b7280;">لا توجد بيانات سنوية متاحة.</td></tr>'}
                </tbody>
            </table>
        `;

        const incidentsRows = analytics.incidents.map(({ incident, date, year }) => `
            <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${year}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${formatDate(date)}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${escape(incident?.title || '-')}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${escape(incident?.location || '-')}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${escape(incident?.severity || '-')}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${escape(incident?.status || '-')}</td>
            </tr>
        `).join('');

        const detailsSection = `
            <h2 style="font-size: 16px; margin: 24px 0 12px;">السجل التفصيلي</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f3f4f6;">
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">السنة</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">التاريخ</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">العنوان</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">الموقع</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">الشدة</th>
                        <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${incidentsRows || '<tr><td colspan="6" style="text-align:center; padding: 12px; border: 1px solid #e5e7eb; color: #6b7280;">لا توجد حوادث مسجلة في السنوات الثلاث الماضية.</td></tr>'}
                </tbody>
            </table>
        `;

        return {
            headerSection,
            summarySection,
            severitySection,
            yearlySection,
            detailsSection
        };
    },

    openReportPreview() {
        const existingModal = document.getElementById(this.reportPreviewModalId);
        if (existingModal) existingModal.remove();

        const sections = this.buildReportContent();
        const modal = document.createElement('div');
        modal.id = this.reportPreviewModalId;
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">معاينة تقرير الحوادث</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                    <div class="prose prose-sm" style="direction: rtl; text-align: right;">
                        ${sections.headerSection}
                        ${sections.summarySection}
                        ${sections.severitySection}
                        ${sections.yearlySection}
                        ${sections.detailsSection}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                    <button class="btn-primary" onclick="Incidents.exportIncidentsReport('pdf'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    exportIncidentsReport(format = 'pdf') {
        const sections = this.buildReportContent();
        const content = `
            ${sections.headerSection}
            ${sections.summarySection}
            ${sections.severitySection}
            ${sections.yearlySection}
            ${sections.detailsSection}
        `;

        const filenameBase = `incidents-report-${new Date().toISOString().slice(0, 10)}`;

        if (format === 'pdf') {
            const styles = `
                <style>
                    body { font-family: 'Tahoma', Arial, sans-serif; direction: rtl; text-align: right; color: #111827; margin: 24px; }
                    h1, h2 { color: #1f2937; }
                    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
                    th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 13px; }
                    thead th { background-color: #f9fafb; font-weight: 600; }
                    tbody tr:nth-child(even) { background-color: #f9fafb; }
                </style>
            `;

            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML('INCIDENTS-REPORT', 'تقرير الحوادث - آخر ٣ سنوات', content, false, true, { version: '1.0' }, new Date().toISOString(), new Date().toISOString())
                : `<html><head>${styles}</head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                            Notification.success('تم تجهيز التقرير للطباعة/الحفظ كـ PDF');
                        }, 500);
                    }, 300);
                };
            } else {
                Notification.error('تعذر فتح نافذة التصدير. يرجى السماح بالنوافذ المنبثقة.');
            }
            return;
        }

        if (format === 'excel') {
            const excelContent = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office"
                      xmlns:x="urn:schemas-microsoft-com:office:excel"
                      xmlns="http://www.w3.org/TR/REC-html40">
                    <head>
                        <!--[if gte mso 9]><xml>
                        <x:ExcelWorkbook>
                            <x:ExcelWorksheets>
                                <x:ExcelWorksheet>
                                    <x:Name>Incidents</x:Name>
                                    <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                                </x:ExcelWorksheet>
                            </x:ExcelWorksheets>
                        </x:ExcelWorkbook>
                        </xml><![endif]-->
                    </head>
                    <body>
                        ${content}
                    </body>
                </html>
            `;

            const blob = new Blob(['\ufeff', excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filenameBase}.xls`;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 0);
            Notification.success('تم تصدير التقرير بصيغة Excel');
            return;
        }

        Notification.error('صيغة التصدير غير مدعومة.');
    },

    async renderList() {
        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-list ml-2"></i>
                            قائمة الحوادث
                        </h2>
                        <div class="flex items-center gap-4">
                            <input 
                                type="text" 
                                id="incidents-search" 
                                class="form-input" 
                                style="max-width: 300px;"
                                placeholder="البحث..."
                            >
                            <select id="incidents-filter-status" class="form-input" style="max-width: 200px;">
                                <option value="">جميع الحالات</option>
                                <option value="مفتوح">متوح</option>
                                <option value="قيد التحقيق">قيد التحقيق</option>
                                <option value="مغلق">مغلق</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div id="incidents-table-container">
                        <div class="empty-state">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p class="text-gray-500">جاري التحميل...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async loadIncidentsList() {
        const container = document.getElementById('incidents-table-container');
        if (!container) return;

        const incidents = (AppState.appData.incidents || []).filter((item) => item && typeof item === 'object');
        const signature = incidents.map((item) => `${item?.id || 'NA'}-${item?.updatedAt || item?.createdAt || 'NA'}`).join('|');
        if (this.lastRenderedSignature === signature && container.dataset.renderSignature === signature) {
            this.refreshAnalytics();
            return;
        }
        container.innerHTML = `
            <div class="empty-state">
                <div style="width: 300px; margin: 0 auto 16px;">
                    <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                    </div>
                </div>
                <p class="text-gray-500">جاري تحديث السجل...</p>
            </div>
        `;
        await new Promise((resolve) => {
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(() => resolve(), { timeout: 200 });
            } else if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => resolve());
            } else {
                setTimeout(() => resolve(), 0);
            }
        });

        if (incidents.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد حوادث مسجلة</p>
                    <button id="add-incident-empty-btn" class="btn-primary mt-4">
                        <i class="fas fa-plus ml-2"></i>
                        تسجيل حادث جديد
                    </button>
                </div>
            `;
            container.dataset.renderSignature = signature;
            this.lastRenderedSignature = signature;
            this.refreshAnalytics();
            return;
        }

        let tableHTML = '';
        try {
            tableHTML = `
                <div class="table-wrapper" style="overflow-x: auto;">
                    <table class="data-table table-header-red">
                        <thead>
                            <tr>
                                <th>العنوان</th>
                                <th>الموقع</th>
                                <th>التاريخ</th>
                                <th>الشدة</th>
                                <th>نوع الحادث</th>
                                <th>المبلغ</th>
                                <th>الأطراف المتأثرة</th>
                                <th>الحالة</th>
                                <th>حالة الاعتماد</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${incidents.map((incident) => {
                const id = incident?.id || '';
                return `
                                    <tr>
                                        <td>${Utils.escapeHTML(incident?.title || '')}</td>
                                        <td>${Utils.escapeHTML(incident?.location || '')}</td>
                                        <td>${incident?.date ? Utils.formatDate(incident.date) : '-'}</td>
                                        <td>
                                            <span class="badge badge-${this.getSeverityBadgeClass(incident?.severity)}">
                                                ${incident?.severity || '-'}
                                            </span>
                                        </td>
                                        <td>${Utils.escapeHTML(incident?.incidentType || '-')}</td>
                                        <td>
                                            ${Utils.escapeHTML(incident?.affectedName || incident?.reportedBy || '-')}
                                            ${incident?.affectedType ? `<div class="text-xs text-gray-500">${Utils.escapeHTML(incident.affectedType || '')}</div>` : ''}
                                            ${incident?.employeeCode ? `<div class="text-xs text-gray-400">${Utils.escapeHTML(incident.employeeCode || '')}</div>` : ''}
                                        </td>
                                        <td>
                                            <span class="badge badge-${this.getStatusBadgeClass(incident?.status)}">
                                                ${incident?.status || '-'}
                                            </span>
                                        </td>
                                        <td>
                                            ${this.renderWorkflowStatusBadge(incident)}
                                        </td>
                                        <td>
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <button onclick="Incidents.viewIncident('${id}')" class="btn-icon btn-icon-info" title="عرض">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                                <button onclick="if(typeof Incidents !== 'undefined' && typeof Incidents.showInvestigationForm === 'function') { Incidents.showInvestigationForm('${id}'); } else { console.error('Incidents.showInvestigationForm is not available'); alert('نموذج التحقيق غير متاح. يرجى إعادة تحميل الصفحة.'); }" class="btn-icon btn-icon-warning" title="التحقيق في الحادث">
                                                    <i class="fas fa-search"></i>
                                                </button>
                                                <button onclick="Incidents.editIncident('${id}')" class="btn-icon btn-icon-primary" title="تعديل">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                                <button onclick="Incidents.manageWorkflow('${id}')" class="btn-icon btn-icon-warning" title="إدارة التدفق">
                                                    <i class="fas fa-project-diagram"></i>
                                                </button>
                                                <button onclick="Incidents.exportPDF('${id}')" class="btn-icon btn-icon-secondary" title="تصدير / طباعة">
                                                    <i class="fas fa-print"></i>
                                                </button>
                                                <button onclick="Incidents.deleteIncident('${id}')" class="btn-icon btn-icon-danger" title="حذف">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            Utils.safeError('⚠️ تعذر توليد جدول الحوادث:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle text-4xl text-red-400 mb-4"></i>
                    <p class="text-gray-500">حدث خطأ أثناء تحميل السجل. يرجى إعادة المحاولة.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = tableHTML;
        container.dataset.renderSignature = signature;
        this.lastRenderedSignature = signature;
        this.refreshAnalytics();
    },

    getSeverityBadgeClass(severity) {
        const classes = {
            'عالية': 'danger',
            'متوسطة': 'warning',
            'منخفضة': 'info'
        };
        return classes[severity] || 'secondary';
    },

    getStatusBadgeClass(status) {
        const classes = {
            'مفتوح': 'info',
            'قيد التحقيق': 'warning',
            'مكتمل': 'success',
            'مغلق': 'success',
            'في انتظار الموافقة': 'warning'
        };
        return classes[status] || 'secondary';
    },

    renderWorkflowStatusBadge(incident) {
        // التحقق من وجود Workflow في البيانات
        if (!AppState.appData.workflows) {
            return '<span class="badge badge-secondary">مسودة</span>';
        }

        // البحث عن workflow مرتبط بهذا الحادث
        const workflow = AppState.appData.workflows.find(w =>
            w.module === 'incidents' && w.recordId === incident.id
        );

        if (!workflow) {
            return '<span class="badge badge-secondary">مسودة</span>';
        }

        const statusLabel = Workflow.getStatusLabel(workflow);
        let badgeClass = 'secondary';
        switch (workflow.status) {
            case Workflow.STATUSES.DRAFT:
                badgeClass = 'secondary';
                break;
            case Workflow.STATUSES.IN_REVIEW:
                badgeClass = 'info';
                break;
            case Workflow.STATUSES.AWAITING_APPROVAL:
                badgeClass = 'warning';
                break;
            case Workflow.STATUSES.APPROVED:
                badgeClass = 'success';
                break;
            case Workflow.STATUSES.REJECTED:
                badgeClass = 'danger';
                break;
            default:
                badgeClass = 'secondary';
        }

        return `<span class="badge badge-${badgeClass}">${Utils.escapeHTML(statusLabel)}</span>`;
    },

    setupEventListeners() {
        setTimeout(() => {
            const openInvestigationBtn = document.getElementById('open-investigation-form-btn');
            const addEmptyBtn = document.getElementById('add-incident-empty-btn');
            const addNotificationBtn = document.getElementById('add-incident-notification-btn');

            // زر التحقيق في الحادث - يفتح قائمة لاختيار حادث
            if (openInvestigationBtn) {
                openInvestigationBtn.addEventListener('click', () => {
                    this.showInvestigationFormSelector();
                });
            }
            if (addEmptyBtn) addEmptyBtn.addEventListener('click', () => this.showForm());
            if (addNotificationBtn) addNotificationBtn.addEventListener('click', () => this.showNotificationForm());

            // تطبيق الصلاحيات
            this.applyPermissions();

            const searchInput = document.getElementById('incidents-search');
            const filterStatus = document.getElementById('incidents-filter-status');

            if (searchInput) searchInput.addEventListener('input', (e) => this.filterIncidents(e.target.value, filterStatus?.value));
            if (filterStatus) filterStatus.addEventListener('change', (e) => this.filterIncidents(searchInput?.value, e.target.value));

            const form = document.getElementById('incident-form');
            if (form) form.addEventListener('submit', (e) => this.handleSubmit(e));
            const cancelBtn = document.getElementById('cancel-incident-btn');
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.switchTab('incidents-list'));

            const investigationBtn = document.getElementById('open-investigation-btn');
            if (investigationBtn && this.currentEditId) {
                investigationBtn.addEventListener('click', () => {
                    try {
                        Utils.safeLog('🔍 Investigation button clicked for incident:', this.currentEditId);
                        if (typeof this.showInvestigationForm === 'function') {
                            this.showInvestigationForm(this.currentEditId);
                        } else {
                            Utils.safeError('showInvestigationForm function not found');
                            Notification.error('نموذج التحقيق غير متاح. يرجى إعادة تحميل الصفحة.');
                        }
                    } catch (error) {
                        Utils.safeError('Error opening investigation form:', error);
                        Notification.error('حدث خطأ: ' + error.message);
                    }
                });
            } else if (investigationBtn && !this.currentEditId) {
                Utils.safeWarn('Investigation button found but currentEditId is null');
            }

            const addActionPlanBtn = document.getElementById('add-action-plan-row');
            if (addActionPlanBtn) addActionPlanBtn.addEventListener('click', () => this.addActionPlanRow());

            const affectedTypeSelect = document.getElementById('incident-affected-type');
            if (affectedTypeSelect) {
                affectedTypeSelect.addEventListener('change', (e) => this.handleAffectedTypeChange(e.target.value));
                this.handleAffectedTypeChange(affectedTypeSelect.value);
            }

            const attachmentsInput = document.getElementById('incident-attachments-input');
            if (attachmentsInput) {
                attachmentsInput.addEventListener('change', (e) => this.handleAttachmentsChange(e.target.files));
            }

            // Bind cloud upload buttons
            const availableServices = CloudStorageIntegration?.getAvailableServices() || [];
            availableServices.forEach(service => {
                const cloudBtn = document.getElementById(`incident-cloud-upload-${service}`);
                if (cloudBtn) {
                    cloudBtn.addEventListener('click', () => this.handleCloudUpload('incident', service));
                }
            });

            const previewBtn = document.getElementById('incidents-report-preview');
            if (previewBtn) previewBtn.addEventListener('click', () => this.openReportPreview());

            document.querySelectorAll('[data-incidents-export]').forEach((btn) => {
                const format = btn.getAttribute('data-incidents-export');
                btn.addEventListener('click', () => this.exportIncidentsReport(format));
            });

            // Event listeners للسجل (مع حماية من التكرار - التبويب يُحدّث عبر setupTabEventListeners عند التبديل)
            const registryAddBtn = document.getElementById('incidents-registry-add-manual');
            if (registryAddBtn && !registryAddBtn.dataset.listenerAdded) {
                registryAddBtn.addEventListener('click', () => this.showManualEntryForm());
                registryAddBtn.dataset.listenerAdded = 'true';
            }

            const registrySearch = document.getElementById('incidents-registry-search');
            const registryFilterStatus = document.getElementById('incidents-registry-filter-status');
            const registryFilterDateFrom = document.getElementById('incidents-registry-filter-date-from');
            const registryFilterDateTo = document.getElementById('incidents-registry-filter-date-to');

            if (registrySearch && !registrySearch.dataset.listenerAdded) {
                registrySearch.addEventListener('input', () => this.applyRegistryFilters());
                registrySearch.dataset.listenerAdded = 'true';
            }
            if (registryFilterStatus && !registryFilterStatus.dataset.listenerAdded) {
                registryFilterStatus.addEventListener('change', () => this.applyRegistryFilters());
                registryFilterStatus.dataset.listenerAdded = 'true';
            }
            if (registryFilterDateFrom && !registryFilterDateFrom.dataset.listenerAdded) {
                registryFilterDateFrom.addEventListener('change', () => this.applyRegistryFilters());
                registryFilterDateFrom.dataset.listenerAdded = 'true';
            }
            if (registryFilterDateTo && !registryFilterDateTo.dataset.listenerAdded) {
                registryFilterDateTo.addEventListener('change', () => this.applyRegistryFilters());
                registryFilterDateTo.dataset.listenerAdded = 'true';
            }

            const registryExportExcel = document.getElementById('incidents-registry-export-excel');
            const registryExportPDF = document.getElementById('incidents-registry-export-pdf');
            if (registryExportExcel && !registryExportExcel.dataset.listenerAdded) {
                registryExportExcel.addEventListener('click', () => this.exportRegistryToExcel());
                registryExportExcel.dataset.listenerAdded = 'true';
            }
            if (registryExportPDF && !registryExportPDF.dataset.listenerAdded) {
                registryExportPDF.addEventListener('click', () => this.exportRegistryToPDF());
                registryExportPDF.dataset.listenerAdded = 'true';
            }
        }, 100);
    },

    async showForm(incidentData = null) {
        if (typeof Permissions !== 'undefined' && Permissions.ensureFormSettingsState) {
            try { await Permissions.ensureFormSettingsState(); } catch (e) { /* ignore */ }
        }
        this.currentEditId = incidentData?.id || null;
        const attachments = Array.isArray(incidentData?.attachments) ? incidentData.attachments : [];
        this.currentAttachments = attachments
            .map(att => this.normalizeAttachment(att))
            .filter(Boolean);
        const content = document.getElementById('incidents-content');
        if (!content) return;

        content.innerHTML = await this.renderForm(incidentData);
        this.setupEventListeners();
        this.setupFormFields(incidentData);
        this.populateActionPlanRows(incidentData?.actionPlan || []);
        this.renderAttachmentsList();
        this.setupAffectedAutocomplete(incidentData);
    },

    async renderForm(incidentData = null) {
        const isEdit = !!incidentData;
        const isoCode = incidentData?.isoCode || this.generateISOCode('INC');
        const companyLogo = (typeof AppState !== 'undefined' && AppState.companyLogo) ? AppState.companyLogo : '';

        // استدعاء renderCloudStorageUploadButtons قبل template literal
        const cloudStorageButtons = this.renderCloudStorageUploadButtons ? this.renderCloudStorageUploadButtons('incident') : '';

        return `
            <div class="content-card">
                ${companyLogo ? `
                    <div class="mb-4 pb-4 border-b" style="direction: ltr; text-align: left;">
                        <img src="${companyLogo}" alt="شعار الشركة" style="max-height: 60px; max-width: 150px;">
                    </div>
                ` : ''}
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-${isEdit ? 'edit' : 'plus-circle'} ml-2"></i>
                        ${isEdit ? 'تعديل حادث' : 'تسجيل حادث جديد'}
                    </h2>
                </div>
                <div class="card-body">
                    <form id="incident-form" class="space-y-6">
                        <div class="grid grid-cols-2 gap-6">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-id-card ml-2"></i>
                                    الكود الوظيفي للمبلغ *
                                </label>
                                <input 
                                    type="text" 
                                    id="incident-employee-code" 
                                    required
                                    class="form-input"
                                    value="${incidentData?.employeeCode || incidentData?.employeeNumber || ''}"
                                    placeholder="الكود الوظيفي"
                                >
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-code ml-2"></i>
                                    كود ISO *
                                </label>
                                <input 
                                    type="text" 
                                    id="incident-iso-code" 
                                    class="form-input"
                                    value="${isoCode}"
                                    readonly
                                    style="background-color: #f3f4f6;"
                                >
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-heading ml-2"></i>
                                    العنوان *
                                </label>
                                <input 
                                    type="text" 
                                    id="incident-title" 
                                    required
                                    class="form-input"
                                    value="${incidentData?.title || ''}"
                                    placeholder="عنوان الحادث"
                                >
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-map-marker-alt ml-2"></i>
                                    الموقع *
                                </label>
                                <select 
                                    id="incident-location" 
                                    required
                                    class="form-input"
                                >
                                    <option value="">اختر الموقع</option>
                                </select>
                                <input 
                                    type="text" 
                                    id="incident-location-custom" 
                                    class="form-input mt-2 hidden"
                                    placeholder="أدخل الموقع يدوياً"
                                >
                                <button type="button" id="incident-location-toggle" class="btn-link text-xs mt-1 text-blue-600">
                                    <i class="fas fa-edit ml-1"></i>إدخال موقع مخصص
                                </button>
                            </div>
                            <div id="incident-sublocation-wrapper" style="display: none;">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-map-pin ml-2"></i>
                                    المكان الفرعي
                                </label>
                                <select 
                                    id="incident-sublocation" 
                                    class="form-input"
                                >
                                    <option value="">اختر المكان الفرعي</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-calendar ml-2"></i>
                                    التاريخ *
                                </label>
                                <input 
                                    type="datetime-local" 
                                    id="incident-date" 
                                    required
                                    class="form-input"
                                    value="${this.safeDateToISOString(incidentData?.date)}"
                                >
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-exclamation-circle ml-2"></i>
                                    الشدة *
                                </label>
                                <select id="incident-severity" required class="form-input">
                                    <option value="">اختر الشدة</option>
                                    <option value="عالية" ${incidentData?.severity === 'عالية' ? 'selected' : ''}>عالية</option>
                                    <option value="متوسطة" ${incidentData?.severity === 'متوسطة' ? 'selected' : ''}>متوسطة</option>
                                    <option value="منخفضة" ${incidentData?.severity === 'منخفضة' ? 'selected' : ''}>منخفضة</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-layer-group ml-2"></i>
                                    نوع الحادث *
                                </label>
                                <select id="incident-type" required class="form-input">
                                    <option value="">اختر نوع الحادث</option>
                                    <option value="إصابة عمل" ${incidentData?.incidentType === 'إصابة عمل' ? 'selected' : ''}>إصابة عمل</option>
                                    <option value="حادث معدات" ${incidentData?.incidentType === 'حادث معدات' ? 'selected' : ''}>حادث معدات</option>
                                    <option value="أضرار ممتلكات" ${incidentData?.incidentType === 'أضرار ممتلكات' ? 'selected' : ''}>أضرار ممتلكات</option>
                                    <option value="حادث بيئي" ${incidentData?.incidentType === 'حادث بيئي' ? 'selected' : ''}>حادث بيئي</option>
                                    <option value="آخر" ${incidentData?.incidentType === 'آخر' ? 'selected' : ''}>آخر</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-info-circle ml-2"></i>
                                    الحالة *
                                </label>
                                <select id="incident-status" required class="form-input">
                                    <option value="">اختر الحالة</option>
                                    <option value="مفتوح" ${incidentData?.status === 'مفتوح' ? 'selected' : ''}>مفتوح</option>
                                    <option value="قيد التحقيق" ${incidentData?.status === 'قيد التحقيق' ? 'selected' : ''}>قيد التحقيق</option>
                                    <option value="مكتمل" ${incidentData?.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
                                    <option value="مغلق" ${incidentData?.status === 'مغلق' ? 'selected' : ''}>مغلق</option>
                                </select>
                            </div>
                            <div class="col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-user ml-2"></i>
                                    المبلغ (اسم الموظف) *
                                </label>
                                <div class="relative">
                                    <input 
                                        type="text" 
                                        id="incident-reported-by" 
                                        required
                                        class="form-input"
                                        value="${incidentData?.reportedBy || ''}"
                                        placeholder="ابحث بالاسم أو الكود الوظيفي"
                                        autocomplete="off"
                                    >
                                    <div id="incident-reported-dropdown" class="hse-lookup-dropdown absolute z-50 hidden w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"></div>
                                </div>
                            </div>
                            <div class="col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-align-right ml-2"></i>
                                    الوصف *
                                </label>
                                <textarea 
                                    id="incident-description" 
                                    required
                                    class="form-input" 
                                    rows="4"
                                    placeholder="وصف تفصيلي للحادث"
                                >${incidentData?.description || ''}</textarea>
                            </div>
                        </div>

                        <div class="border-t pt-4">
                            <h3 class="text-base font-semibold text-gray-700 mb-4">
                                <i class="fas fa-users ml-2"></i>
                                بيانات الطرف المتضرر
                            </h3>
                            <div class="grid grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">النوع *</label>
                                    <select id="incident-affected-type" class="form-input">
                                        <option value="employee" ${incidentData?.affectedType === 'employee' ? 'selected' : ''}>موظف</option>
                                        <option value="contractor" ${incidentData?.affectedType === 'contractor' ? 'selected' : ''}>مقاول</option>
                                        <option value="visitor" ${incidentData?.affectedType === 'visitor' ? 'selected' : ''}>زائر</option>
                                        <option value="other" ${incidentData?.affectedType === 'other' ? 'selected' : ''}>طرف آخر</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">الكود الوظيفي</label>
                                    <input type="text" id="incident-affected-code" class="form-input" value="${incidentData?.affectedCode || ''}" placeholder="اكتب الكود عند اختيار موظف" autocomplete="off">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">اسم الطرف المتضرر *</label>
                                    <input type="text" id="incident-affected-name" required class="form-input" value="${incidentData?.affectedName || ''}" placeholder="اسم الطرف المتضرر">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">المسمى الوظيفي</label>
                                    <input type="text" id="incident-affected-job" class="form-input" value="${incidentData?.affectedJobTitle || ''}" placeholder="المسمى الوظيفي">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">القسم / الإدارة</label>
                                    <input type="text" id="incident-affected-department" class="form-input" value="${incidentData?.affectedDepartment || ''}" placeholder="القسم أو الإدارة">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">بيانات التواصل</label>
                                    <input type="text" id="incident-affected-contact" class="form-input" value="${incidentData?.affectedContact || ''}" placeholder="رقم الهاتف أو البريد الإلكتروني">
                                </div>
                            </div>
                        </div>

                        <div class="border-t pt-4">
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <div class="flex items-center gap-2 mb-2">
                                    <i class="fas fa-info-circle text-blue-600"></i>
                                    <h4 class="text-sm font-semibold text-blue-800">ملاحظة مهمة</h4>
                                </div>
                                <p class="text-sm text-blue-700">
                                    لتحليل الأسباب والإجراءات التصحيحية والوقائية، يرجى استخدام نموذج التحقيق المنفصل بعد حفظ الحادث.
                                    يمكنك الوصول إليه من صفحة عرض الحادث أو من قائمة الحوادث.
                                </p>
                            </div>
                        </div>

                        <div class="border-t pt-4">
                            <div class="flex items-center justify-between mb-3">
                                <h3 class="text-base font-semibold text-gray-700">
                                    <i class="fas fa-clipboard-check ml-2"></i>
                                    خطة الإجراءات التصحيحية والوقائية
                                </h3>
                                <button type="button" id="add-action-plan-row" class="btn-secondary">
                                    <i class="fas fa-plus ml-2"></i>
                                    إضافة إجراء
                                </button>
                            </div>
                            <div class="table-wrapper" style="overflow-x: auto;">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>نوع الإجراء</th>
                                            <th>وصف الإجراء</th>
                                            <th>المسؤول</th>
                                            <th>تاريخ الاستحقاق</th>
                                            <th>تاريخ الإغلاق</th>
                                            <th>الحالة</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody id="incident-action-plan-body"></tbody>
                                </table>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">تمثل كل خطة مساراً العمل ويتم تسجيلها في سجل التدقيق.</p>
                        </div>

                        <div class="border-t pt-4">
                            <h3 class="text-base font-semibold text-gray-700 mb-4">
                                <i class="fas fa-paperclip ml-2"></i>
                                المرفقات والدعم البصري
                            </h3>
                            <div class="grid grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-upload ml-2"></i>
                                        تحميل مرفقات إضافية
                                    </label>
                                    <input type="file" id="incident-attachments-input" class="form-input" accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx" multiple>
                                    <p class="text-xs text-gray-500 mt-2">الحد الأقصى لحجم كل ملف 5MB.</p>
                                    ${cloudStorageButtons}
                                    <div id="incident-attachments-list" class="mt-3 space-y-2"></div>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-image ml-2"></i>
                                        صورة توضيحية (غير إلزامي)
                                    </label>
                                    <input type="file" id="incident-image-input" accept="image/*" class="form-input">
                                    <div id="incident-image-preview" class="mt-2 ${incidentData?.image ? '' : 'hidden'}">
                                        <img src="${incidentData?.image ? this.convertGoogleDriveLinkToPrintable(incidentData.image) : ''}" alt="صورة الحادث" class="w-48 h-48 object-cover rounded border mt-2" id="incident-image-img">
                                        <button type="button" onclick="document.getElementById('incident-image-input').value=''; document.getElementById('incident-image-preview').classList.add('hidden');" class="mt-1 text-xs text-red-600">حذ الصورة</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-4 pt-4 border-t">
                            <button type="button" id="cancel-incident-btn" class="btn-secondary">
                                إلغاء
                            </button>
                            ${isEdit ? `
                            <button type="button" id="open-investigation-btn" class="btn-secondary">
                                <i class="fas fa-search ml-2"></i>
                                ${incidentData?.investigation ? 'عرض/تعديل التحقيق' : 'التحقيق في الحادث'}
                            </button>
                            ` : ''}
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>
                                ${isEdit ? 'حفظ التعديلات' : 'تسجيل الحادث'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    setupFormFields(incidentData = null) {
        // Setup employee autocomplete and location dropdown
        setTimeout(() => {
            // حفظ المرجع إلى this لتجنب مشاكل السياق
            const self = this;

            // ربط كود المبلغ عن الحادث بقاعدة بيانات الموظفين
            if (typeof EmployeeHelper !== 'undefined') {
                // ربط حقل الكود الوظيفي
                EmployeeHelper.setupEmployeeCodeSearch('incident-employee-code', 'incident-reported-by', (employee) => {
                    if (employee) {
                        const codeInput = document.getElementById('incident-employee-code');
                        const nameInput = document.getElementById('incident-reported-by');
                        if (codeInput) codeInput.value = employee.code || employee.employeeNumber || employee.sapId || '';
                        if (nameInput) nameInput.value = employee.name || employee.fullName || '';
                    }
                });

                // ربط حقل الاسم
                EmployeeHelper.setupAutocomplete('incident-reported-by', (employee) => {
                    if (employee) {
                        const codeInput = document.getElementById('incident-employee-code');
                        if (codeInput) codeInput.value = employee.code || employee.employeeNumber || employee.sapId || '';
                    }
                });
            }

            // ربط حقل الموقع بقائمة المواقع من إعدادات النماذج
            const locationSelect = document.getElementById('incident-location');
            const locationCustomInput = document.getElementById('incident-location-custom');
            const locationToggleBtn = document.getElementById('incident-location-toggle');
            const sublocationWrapper = document.getElementById('incident-sublocation-wrapper');
            const sublocationSelect = document.getElementById('incident-sublocation');

            // دالة لتحديث قائمة الأماكن الفرعية
            const updateSublocationOptions = (siteId) => {
                if (!sublocationSelect || !sublocationWrapper) return;

                // مسح القائمة الحالية
                sublocationSelect.innerHTML = '<option value="">اختر المكان الفرعي</option>';

                if (!siteId) {
                    sublocationWrapper.style.display = 'none';
                    return;
                }

                // الحصول على الأماكن الفرعية للموقع المحدد
                const placeOptions = self.getPlaceOptions(siteId);

                if (placeOptions && placeOptions.length > 0) {
                    placeOptions.forEach(place => {
                        const option = document.createElement('option');
                        option.value = place.id;
                        option.textContent = place.name;
                        // التحقق من البيانات المحفوظة
                        if (incidentData?.sublocationId === place.id ||
                            incidentData?.sublocation === place.id ||
                            (incidentData?.sublocationName === place.name)) {
                            option.selected = true;
                        }
                        sublocationSelect.appendChild(option);
                    });
                    sublocationWrapper.style.display = 'block';
                } else {
                    sublocationWrapper.style.display = 'none';
                }
            };

            if (locationSelect) {
                // التأكد من تحميل إعدادات النماذج
                const loadSites = async () => {
                    try {
                        if (typeof Permissions !== 'undefined' && typeof Permissions.ensureFormSettingsState === 'function') {
                            await Permissions.ensureFormSettingsState();
                        }

                        // الحصول على المواقع من إعدادات النماذج
                        const sites = self.getSiteOptions();

                        Utils.safeLog('Incidents: عدد المواقع المحملة:', sites.length);

                        // إضافة المواقع إلى القائمة المنسدلة
                        if (sites && sites.length > 0) {
                            sites.forEach(site => {
                                const option = document.createElement('option');
                                option.value = site.id;
                                option.textContent = site.name;
                                // التحقق من البيانات المحفوظة
                                if (incidentData?.siteId === site.id ||
                                    incidentData?.location === site.id ||
                                    (incidentData?.siteName === site.name) ||
                                    (incidentData?.location === site.name)) {
                                    option.selected = true;
                                    // تحديث قائمة الأماكن الفرعية عند التحميل
                                    setTimeout(() => updateSublocationOptions(site.id), 100);
                                }
                                locationSelect.appendChild(option);
                            });
                        } else {
                            Utils.safeWarn('⚠️ Incidents: لا توجد مواقع متاحة في إعدادات النماذج');
                        }
                    } catch (error) {
                        Utils.safeError('❌ خطأ في تحميل المواقع:', error);
                    }
                };

                // استدعاء الدالة مباشرة
                loadSites().then(() => {
                    // إذا كان الموقع موجوداً في البيانات ولكن غير موجود في القائمة
                    const sites = self.getSiteOptions();
                    if (incidentData?.location && !sites.find(s => s.id === incidentData.location || s.name === incidentData.location)) {
                        const customOption = document.createElement('option');
                        customOption.value = incidentData.location;
                        customOption.textContent = incidentData.location + ' (مخصص)';
                        customOption.selected = true;
                        locationSelect.appendChild(customOption);
                        sublocationWrapper.style.display = 'none';
                    }
                }).catch(error => {
                    Utils.safeError('❌ خطأ في معالجة المواقع:', error);
                });

                // إضافة event listener لتحديث الأماكن الفرعية عند تغيير الموقع
                locationSelect.addEventListener('change', (e) => {
                    const selectedSiteId = e.target.value;
                    updateSublocationOptions(selectedSiteId);
                });

                // تبديل بين القائمة المنسدلة والإدخال اليدوي
                if (locationToggleBtn && locationCustomInput) {
                    locationToggleBtn.addEventListener('click', () => {
                        if (locationCustomInput.classList.contains('hidden')) {
                            locationCustomInput.classList.remove('hidden');
                            locationSelect.classList.add('hidden');
                            sublocationWrapper.style.display = 'none';
                            locationToggleBtn.innerHTML = '<i class="fas fa-list ml-1"></i>استخدام القائمة';
                            if (locationSelect.value) {
                                locationCustomInput.value = locationSelect.options[locationSelect.selectedIndex]?.text || locationSelect.value;
                            }
                        } else {
                            locationCustomInput.classList.add('hidden');
                            locationSelect.classList.remove('hidden');
                            locationToggleBtn.innerHTML = '<i class="fas fa-edit ml-1"></i>إدخال موقع مخصص';
                            if (locationCustomInput.value) {
                                // البحث عن الموقع في القائمة
                                const matchingOption = Array.from(locationSelect.options).find(opt =>
                                    opt.text === locationCustomInput.value || opt.value === locationCustomInput.value
                                );
                                if (matchingOption) {
                                    locationSelect.value = matchingOption.value;
                                    updateSublocationOptions(matchingOption.value);
                                } else {
                                    // إضافة كخيار مخصص
                                    const customOption = document.createElement('option');
                                    customOption.value = locationCustomInput.value;
                                    customOption.textContent = locationCustomInput.value + ' (مخصص)';
                                    locationSelect.appendChild(customOption);
                                    locationSelect.value = customOption.value;
                                    sublocationWrapper.style.display = 'none';
                                }
                            }
                        }
                    });
                }
            }

            // Setup image preview
            const imageInput = document.getElementById('incident-image-input');
            const imagePreview = document.getElementById('incident-image-preview');
            const imageImg = document.getElementById('incident-image-img');
            if (imageInput && imagePreview && imageImg) {
                imageInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                            Notification.error('حجم الصورة كبير جداً. الحد الأقصى 5MB');
                            imageInput.value = '';
                            return;
                        }
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            imageImg.src = e.target.result;
                            imagePreview.classList.remove('hidden');
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        }, 100);
    },

    generateISOCode(prefix) {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const count = (AppState.appData.incidents || []).length + 1;
        return `${prefix}-${year}${month}-${String(count).padStart(4, '0')}`;
    },

    async convertImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    async handleSubmit(e) {
        e.preventDefault();

        // منع النقر المتكرر
        const submitBtn = e.target?.querySelector('button[type="submit"]') ||
            document.querySelector('#incident-form button[type="submit"]') ||
            e.target?.closest('form')?.querySelector('button[type="submit"]');

        if (submitBtn && submitBtn.disabled) {
            return; // النموذج قيد المعالجة
        }

        // تعطيل الزر لمنع النقر المتكرر
        let originalText = '';
        if (submitBtn) {
            originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الحفظ...';
        }

        // الحصول على البيانات القديمة إذا كانت موجودة (للتعديل)
        const incidentData = this.currentEditId ?
            AppState.appData.incidents.find(i => i.id === this.currentEditId) : null;

        // فحص العناصر قبل الاستخدام
        const employeeCodeEl = document.getElementById('incident-employee-code');
        const reportedByEl = document.getElementById('incident-reported-by');

        if (!employeeCodeEl || !reportedByEl) {
            Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            return;
        }

        const employeeCode = employeeCodeEl.value.trim();
        const reportedBy = reportedByEl.value.trim();

        // معالجة الصورة
        let imageBase64 = this.currentEditId
            ? (AppState.appData.incidents.find(i => i.id === this.currentEditId)?.image || '')
            : '';
        const imageInput = document.getElementById('incident-image-input');
        if (imageInput && imageInput.files.length > 0) {
            const file = imageInput.files[0];
            if (file.size > 5 * 1024 * 1024) {
                Notification.error('حجم الصورة كبير جداً. الحد الأقصى 5MB');
                return;
            }
            try {
                imageBase64 = await this.convertImageToBase64(file);
            } catch (error) {
                Notification.error('شل تحميل الصورة: ' + error.message);
                return;
            }
        }

        // الحصول على الموقع والمكان الفرعي (من القائمة المنسدلة أو الإدخال اليدوي)
        const locationSelect = document.getElementById('incident-location');
        const locationCustomInput = document.getElementById('incident-location-custom');
        const sublocationSelect = document.getElementById('incident-sublocation');

        let location = '';
        let siteId = '';
        let siteName = '';
        let sublocation = '';
        let sublocationId = '';
        let sublocationName = '';

        if (locationCustomInput && !locationCustomInput.classList.contains('hidden') && locationCustomInput.value.trim()) {
            // استخدام الإدخال اليدوي
            location = locationCustomInput.value.trim();
            siteName = location;
        } else if (locationSelect && locationSelect.value) {
            // استخدام القائمة المنسدلة
            siteId = locationSelect.value;
            siteName = locationSelect.options[locationSelect.selectedIndex]?.text || siteId;
            location = siteName;

            // الحصول على المكان الفرعي إذا كان محدداً
            if (sublocationSelect && sublocationSelect.value) {
                sublocationId = sublocationSelect.value;
                sublocationName = sublocationSelect.options[sublocationSelect.selectedIndex]?.text || sublocationId;
                sublocation = sublocationName;
            }
        }

        // جمع بيانات الطرف المتضرر
        const affectedType = document.getElementById('incident-affected-type')?.value || 'employee';
        const affectedCode = document.getElementById('incident-affected-code')?.value.trim() || '';
        const affectedName = document.getElementById('incident-affected-name')?.value.trim() || '';
        const affectedJob = document.getElementById('incident-affected-job')?.value.trim() || '';
        const affectedDept = document.getElementById('incident-affected-department')?.value.trim() || '';
        const affectedContact = document.getElementById('incident-affected-contact')?.value.trim() || '';

        // جمع خطة الإجراءات
        const actionPlan = this.collectActionPlanRows();

        // جمع المرفقات (مع معالجة الصور للرفع إلى Google Drive)
        let attachments = [...(this.currentAttachments || [])];

        // فحص العناصر قبل الاستخدام
        const isoCodeEl = document.getElementById('incident-iso-code');
        const titleEl = document.getElementById('incident-title');
        const dateEl = document.getElementById('incident-date');
        const severityEl = document.getElementById('incident-severity');
        const statusEl = document.getElementById('incident-status');
        const descriptionEl = document.getElementById('incident-description');

        if (!isoCodeEl || !titleEl || !dateEl || !severityEl || !statusEl || !descriptionEl) {
            Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            return;
        }

        const formData = {
            id: this.currentEditId || Utils.generateSequentialId('INC', AppState.appData?.incidents || []),
            isoCode: isoCodeEl.value.trim(),
            title: titleEl.value.trim(),
            location: location,
            siteId: siteId,
            siteName: siteName,
            sublocation: sublocation,
            sublocationId: sublocationId,
            sublocationName: sublocationName,
            date: (() => {
                try {
                    if (!dateEl.value) return new Date().toISOString();
                    const date = new Date(dateEl.value);
                    if (isNaN(date.getTime())) return new Date().toISOString();
                    return date.toISOString();
                } catch (e) {
                    return new Date().toISOString();
                }
            })(),
            severity: severityEl.value,
            incidentType: document.getElementById('incident-type')?.value || '',
            reportedBy: reportedBy,
            employeeCode: employeeCode,
            employeeNumber: employeeCode,
            status: statusEl.value,
            description: descriptionEl.value.trim(),
            // تم نقل تحليل الأسباب والإجراءات إلى نموذج التحقيق المنفصل
            // الاحتفاظ بالبيانات القديمة إذا كانت موجودة (للتوافق مع البيانات القديمة)
            rootCause: incidentData?.rootCause || '',
            correctiveAction: incidentData?.correctiveAction || '',
            preventiveAction: incidentData?.preventiveAction || '',
            // الاحتفاظ ببيانات التحقيق إذا كانت موجودة
            investigation: incidentData?.investigation || null,
            actionPlan: actionPlan,
            affectedType: affectedType,
            affectedCode: affectedCode,
            affectedName: affectedName,
            affectedJobTitle: affectedJob,
            affectedDepartment: affectedDept,
            affectedContact: affectedContact,
            image: imageBase64,
            attachments: attachments,
            // تم نقل closureDate و actionOwner إلى نموذج التحقيق المنفصل
            // الاحتفاظ بالبيانات القديمة فقط للتوافق
            closureDate: incidentData?.closureDate || null,
            actionOwner: incidentData?.actionOwner || '',
            createdAt: this.currentEditId
                ? AppState.appData.incidents.find(i => i.id === this.currentEditId)?.createdAt
                : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: AppState.currentUser ? {
                id: AppState.currentUser.id || '',
                name: AppState.currentUser.name || AppState.currentUser.displayName || '',
                email: AppState.currentUser.email || ''
            } : null
        };

        if (!formData.title || !formData.location || !formData.severity || !formData.status) {
            Notification.error('يرجى ملء جميع الحقول المطلوبة');
            // استعادة الزر عند فشل التحقق
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            return;
        }

        Loading.show('جاري حفظ البيانات...');
        try {
            // 1. حفظ البيانات فوراً في الذاكرة
            if (this.currentEditId) {
                const index = AppState.appData.incidents.findIndex(i => i.id === this.currentEditId);
                if (index !== -1) {
                    AppState.appData.incidents[index] = formData;
                }
                Notification.success('تم تحديث الحادث بنجاح');
            } else {
                AppState.appData.incidents.push(formData);
                Notification.success('تم تسجيل الحادث بنجاح');
            }

            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }

            // 2. إغلاق النموذج فوراً بعد الحفظ في الذاكرة
            this.switchTab('incidents-list');

            // 3. استعادة الزر بعد النجاح (إذا كان موجوداً)
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }

            // 4. تحديث Dashboard فوراً
            if (typeof Dashboard !== 'undefined' && Dashboard.refreshIncidents) {
                Dashboard.refreshIncidents();
            }

            // 5. معالجة المهام الخلفية في الخلفية
            Promise.all([
                // إضافة/تحديث السجل
                this.currentEditId
                    ? this.updateRegistryEntry(formData).catch(error => {
                        Utils.safeError('خطأ في تحديث السجل:', error);
                    })
                    : this.addToRegistry(formData).catch(error => {
                        Utils.safeError('خطأ في إضافة السجل:', error);
                    }),
                // معالجة الملفات والإجراءات الإضافية
                this.processIncidentBackgroundTasks(formData).catch(error => {
                    Utils.safeError('خطأ في معالجة المهام الخلفية:', error);
                })
            ]).catch(error => {
                Utils.safeError('خطأ في معالجة المهام الخلفية:', error);
            });

        } catch (error) {
            Utils.safeError('خطأ في حفظ الحادث:', error);
            Notification.error('حدث خطأ: ' + error.message);
            // استعادة الزر في حالة الخطأ
            if (submitBtn && originalText) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    },

    // معالجة المهام الخلفية بعد حفظ الحادث
    async processIncidentBackgroundTasks(formData) {
        try {
            // معالجة المرفقات ورفع الصور إلى Google Drive
            let needsUpdate = false;

            if (formData.attachments && Array.isArray(formData.attachments) && formData.attachments.length > 0) {
                try {
                    Utils.safeLog('Incidents: قبل processAttachments - عدد المرفقات: ' + formData.attachments.length);
                    const processedAttachments = await GoogleIntegration.processAttachments?.(
                        formData.attachments,
                        'Incidents'
                    ) || formData.attachments;

                    if (JSON.stringify(processedAttachments) !== JSON.stringify(formData.attachments)) {
                        formData.attachments = processedAttachments;
                        needsUpdate = true;
                        Utils.safeLog('Incidents: تم معالجة المرفقات بنجاح');
                    }
                } catch (uploadError) {
                    Utils.safeError('خطأ في رفع المرفقات:', uploadError);
                }
            }

            // معالجة الصورة الرئيسية ورفعها إلى Google Drive
            if (formData.image && typeof formData.image === 'string' && formData.image.startsWith('data:')) {
                try {
                    const uploadResult = await GoogleIntegration.uploadFileToDrive?.(
                        formData.image,
                        `incident_${formData.id}_${Date.now()}.jpg`,
                        'image/jpeg',
                        'Incidents'
                    );
                    if (uploadResult && uploadResult.success) {
                        formData.image = uploadResult.directLink || uploadResult.shareableLink || formData.image;
                        needsUpdate = true;
                        Utils.safeLog('Incidents: تم رفع الصورة بنجاح');
                    }
                } catch (imageError) {
                    Utils.safeError('خطأ في رفع الصورة:', imageError);
                }
            }

            // تحديث البيانات في حالة معالجة الملفات
            if (needsUpdate) {
                const index = AppState.appData.incidents.findIndex(i => i.id === formData.id);
                if (index !== -1) {
                    AppState.appData.incidents[index] = formData;
                }

                // حفظ البيانات المحدثة
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }
            }

            // حفظ تلقائي في Google Sheets
            await GoogleIntegration.autoSave('Incidents', AppState.appData.incidents);

            // إنشاء إجراءات تلقائية في Action Tracking إذا كانت هناك إجراءات في خطة الإجراءات
            if (formData.actionPlan && Array.isArray(formData.actionPlan) && formData.actionPlan.length > 0) {
                for (const action of formData.actionPlan) {
                    if (action.description && action.owner) {
                        try {
                            await GoogleIntegration.sendToAppsScript?.('createActionFromModule', {
                                sourceModule: 'Incidents',
                                sourceId: formData.id,
                                sourceData: {
                                    date: formData.date,
                                    description: action.description,
                                    correctiveAction: action.description,
                                    department: formData.affectedDepartment || '',
                                    location: formData.location || '',
                                    siteId: formData.siteId || '',
                                    siteName: formData.siteName || '',
                                    sublocation: formData.sublocation || '',
                                    sublocationId: formData.sublocationId || '',
                                    sublocationName: formData.sublocationName || '',
                                    severity: formData.severity || 'Medium',
                                    reportedBy: formData.reportedBy || '',
                                    owner: action.owner,
                                    dueDate: action.dueDate,
                                    actionType: action.actionType === 'preventive' ? 'Preventive' : 'Corrective',
                                    createdBy: formData.createdBy?.name || 'System',
                                    ...formData
                                }
                            });
                        } catch (actionError) {
                            Utils.safeError('خطأ في إنشاء إجراء تلقائي:', actionError);
                        }
                    }
                }
            }

            Utils.safeLog('Incidents: تم إكمال المهام الخلفية بنجاح');
        } catch (error) {
            Utils.safeError('خطأ في معالجة المهام الخلفية:', error);
        }
    },

    async showList() {
        this.currentEditId = null;
        const content = document.getElementById('incidents-content');
        if (content) {
            content.innerHTML = await this.renderMainView();
            this.setupEventListeners();
            this.loadIncidentsList();
        }
    },

    // نموذج إخطار عن حادث
    async showNotificationForm() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        const notificationNumber = `NOT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String((AppState.appData.incidentNotifications || []).length + 1).padStart(4, '0')}`;

        modal.innerHTML = `
            <style>
                .notification-field {
                    background: white;
                    padding: 16px;
                    border-radius: 10px;
                    border: 2px solid;
                    transition: all 0.3s ease;
                }
                .notification-field:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                .notification-field label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 10px;
                }
                .notification-field label i {
                    font-size: 1.2rem;
                }
                .notification-section-title {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 16px 24px;
                    border-radius: 12px 12px 0 0;
                    margin: 0 -24px 24px -24px;
                    font-size: 1.3rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
            </style>
            <div class="modal-content" style="max-width: 1200px; width: 95%; background: linear-gradient(to bottom, #f8f9fa, #ffffff);">
                <div class="modal-header modal-header-centered" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px 30px;">
                    <h2 class="modal-title" style="font-size: 1.75rem; font-weight: 700; color: white;">
                        <i class="fas fa-bell ml-2"></i>
                        إخطار عن حادث - Incident Notification
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white; font-size: 1.5rem;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 30px; background: #f8f9fa;">
                    <form id="incident-notification-form">
                        <!-- معلومات أساسية -->
                        <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                            <div class="notification-section-title">
                                <i class="fas fa-info-circle"></i>
                                <span>المعلومات الأساسية</span>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div class="notification-field" style="border-color: #667eea;">
                                    <label>
                                        <i class="fas fa-hashtag" style="color: #667eea;"></i>
                                        رقم الإخطار *
                                    </label>
                                    <input type="text" id="notification-number" class="form-input" value="${notificationNumber}" readonly style="background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 50%); font-weight: 700; border: 2px solid #667eea; color: #5145cd;">
                                </div>
                                <div class="notification-field" style="border-color: #667eea;">
                                    <label>
                                        <i class="fas fa-calendar-alt" style="color: #667eea;"></i>
                                        تاريخ ووقت الحادث *
                                    </label>
                                    <input type="datetime-local" id="notification-date" class="form-input" required value="${new Date().toISOString().slice(0, 16)}" style="border: 2px solid #667eea; font-weight: 500;">
                                </div>
                                <div class="notification-field" style="border-color: #667eea;">
                                    <label>
                                        <i class="fas fa-map-marker-alt" style="color: #667eea;"></i>
                                        مكان الحادث *
                                    </label>
                                    <select id="notification-location" class="form-input" required style="border: 2px solid #667eea;">
                                        <option value="">اختر الموقع</option>
                                    </select>
                                </div>
                                <div id="notification-sublocation-wrapper" style="display: none;">
                                    <div class="notification-field" style="border-color: #667eea;">
                                        <label>
                                            <i class="fas fa-map-pin" style="color: #667eea;"></i>
                                            المكان الفرعي
                                        </label>
                                        <select id="notification-sublocation" class="form-input" style="border: 2px solid #667eea;">
                                            <option value="">اختر المكان الفرعي</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- تفاصيل الحادث -->
                        <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                            <div class="notification-section-title">
                                <i class="fas fa-clipboard-list"></i>
                                <span>تفاصيل الحادث</span>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div class="notification-field" style="border-color: #f59e0b;">
                                    <label>
                                        <i class="fas fa-tag" style="color: #f59e0b;"></i>
                                        نوع الحادث *
                                    </label>
                                    <select id="notification-incident-type" class="form-input" required style="border: 2px solid #f59e0b;">
                                        <option value="">اختر نوع الحادث</option>
                                        <option value="إصابة عمل">إصابة عمل</option>
                                        <option value="حادث معدات">حادث معدات</option>
                                        <option value="أضرار ممتلكات">أضرار ممتلكات</option>
                                        <option value="حادث بيئي">حادث بيئي</option>
                                        <option value="آخر">آخر</option>
                                    </select>
                                </div>
                                <div class="notification-field" style="border-color: #f59e0b;">
                                    <label>
                                        <i class="fas fa-users" style="color: #f59e0b;"></i>
                                        التبعية
                                    </label>
                                    <select id="notification-affiliation" class="form-input" style="border: 2px solid #f59e0b;">
                                        <option value="">اختر التبعية</option>
                                        <option value="employee">موظف</option>
                                        <option value="daily-labor">عمالة يومية</option>
                                        <option value="contractor">مقاول</option>
                                        <option value="visitor">زائر</option>
                                        <option value="none">لا يوجد</option>
                                    </select>
                                </div>

                                <div id="notification-employee-code-wrapper" class="notification-field" style="border-color: #f59e0b; display: none;">
                                    <label>
                                        <i class="fas fa-id-badge" style="color: #f59e0b;"></i>
                                        كود الموظف *
                                    </label>
                                    <input type="text" id="notification-employee-code" class="form-input" placeholder="اكتب/ابحث بكود الموظف" style="border: 2px solid #f59e0b;" autocomplete="off">
                                </div>

                                <div class="notification-field" style="border-color: #f59e0b;">
                                    <label>
                                        <i class="fas fa-user" style="color: #f59e0b;"></i>
                                        اسم الموظف *
                                    </label>
                                    <input type="text" id="notification-employee-name" class="form-input" required placeholder="اسم الموظف" style="border: 2px solid #f59e0b;" autocomplete="off">
                                </div>
                                <div class="notification-field" style="border-color: #f59e0b;">
                                    <label>
                                        <i class="fas fa-briefcase" style="color: #f59e0b;"></i>
                                        الوظيفة *
                                    </label>
                                    <input type="text" id="notification-employee-job" class="form-input" required placeholder="الوظيفة" style="border: 2px solid #f59e0b;">
                                </div>
                                <div class="notification-field col-span-1 md:col-span-2" style="border-color: #f59e0b;">
                                    <label>
                                        <i class="fas fa-building" style="color: #f59e0b;"></i>
                                        الإدارة *
                                    </label>
                                    <input type="text" id="notification-employee-department" class="form-input" required placeholder="الإدارة" style="border: 2px solid #f59e0b;">
                                </div>

                                <div id="notification-contractor-name-wrapper" class="notification-field col-span-1 md:col-span-2" style="border-color: #f59e0b; display: none;">
                                    <label>
                                        <i class="fas fa-handshake" style="color: #f59e0b;"></i>
                                        اسم المقاول *
                                    </label>
                                    <input type="text" id="notification-contractor-name" class="form-input" placeholder="اسم المقاول" style="border: 2px solid #f59e0b;">
                                </div>
                            </div>
                            
                            <div class="notification-field mt-5" style="border-color: #f59e0b;">
                                <label>
                                    <i class="fas fa-heartbeat" style="color: #f59e0b;"></i>
                                    وصف الإصابة
                                </label>
                                <textarea id="notification-injury-description" class="form-input" rows="4" placeholder="وصف تفصيلي للإصابة..." style="border: 2px solid #f59e0b;"></textarea>
                            </div>
                            <div class="notification-field mt-5" style="border-color: #f59e0b;">
                                <label>
                                    <i class="fas fa-coins" style="color: #f59e0b;"></i>
                                    الخسائر
                                </label>
                                <textarea id="notification-losses" class="form-input" rows="4" placeholder="وصف الخسائر المادية أو البشرية..." style="border: 2px solid #f59e0b;"></textarea>
                            </div>
                            <div class="notification-field mt-5" style="border-color: #f59e0b;">
                                <label>
                                    <i class="fas fa-file-alt" style="color: #f59e0b;"></i>
                                    وصف مختصر للحادث *
                                </label>
                                <textarea id="notification-description" class="form-input" rows="5" required placeholder="وصف تفصيلي للحادث..." style="border: 2px solid #f59e0b; font-size: 1rem;"></textarea>
                            </div>
                            <div class="notification-field mt-5" style="border-color: #f59e0b;">
                                <label>
                                    <i class="fas fa-tasks" style="color: #f59e0b;"></i>
                                    الإجراءات المتخذة
                                </label>
                                <textarea id="notification-actions" class="form-input" rows="4" placeholder="وصف الإجراءات المتخذة..." style="border: 2px solid #f59e0b;"></textarea>
                            </div>
                        </div>

                        <!-- معلومات معد الإخطار -->
                        <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                            <div class="notification-section-title">
                                <i class="fas fa-user-edit"></i>
                                <span>معلومات معد الإخطار</span>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div class="notification-field" style="border-color: #10b981;">
                                    <label>
                                        <i class="fas fa-user" style="color: #10b981;"></i>
                                        اسم معد الإخطار *
                                    </label>
                                    <input type="text" id="notification-reporter-name" class="form-input" required placeholder="اسم معد الإخطار" style="border: 2px solid #10b981;">
                                </div>
                                <div class="notification-field" style="border-color: #10b981;">
                                    <label>
                                        <i class="fas fa-id-card" style="color: #10b981;"></i>
                                        كود معد الإخطار
                                    </label>
                                    <input type="text" id="notification-reporter-code" class="form-input" placeholder="الكود الوظيفي" style="border: 2px solid #10b981;">
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-4 pt-4 bg-white p-5 rounded-lg shadow-lg form-actions-centered" style="border-top: 3px solid #667eea;">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 12px 30px; font-size: 1.1rem;">
                                <i class="fas fa-times ml-2"></i>
                                إلغاء
                            </button>
                            <button type="button" class="btn-secondary" onclick="Incidents.printNotification()" title="طباعة الإخطار" style="padding: 12px 30px; font-size: 1.1rem;">
                                <i class="fas fa-print ml-2"></i>
                                طباعة
                            </button>
                            <button type="button" class="btn-secondary" onclick="Incidents.exportNotificationPDF()" title="تصدير PDF" style="padding: 12px 30px; font-size: 1.1rem;">
                                <i class="fas fa-file-pdf ml-2"></i>
                                تصدير PDF
                            </button>
                            <button type="submit" class="btn-primary" style="padding: 12px 30px; font-size: 1.1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                <i class="fas fa-paper-plane ml-2"></i>
                                إرسال الإخطار
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // ربط المواقع
        setTimeout(() => {
            const locationSelect = document.getElementById('notification-location');
            const sublocationWrapper = document.getElementById('notification-sublocation-wrapper');
            const sublocationSelect = document.getElementById('notification-sublocation');

            // دالة لتحديث قائمة الأماكن الفرعية
            const updateSublocationOptions = (siteId) => {
                if (!sublocationSelect || !sublocationWrapper) return;

                // مسح القائمة الحالية
                sublocationSelect.innerHTML = '<option value="">اختر المكان الفرعي</option>';

                if (!siteId) {
                    sublocationWrapper.style.display = 'none';
                    return;
                }

                // الحصول على الأماكن الفرعية للموقع المحدد
                const placeOptions = this.getPlaceOptions(siteId);

                if (placeOptions && placeOptions.length > 0) {
                    placeOptions.forEach(place => {
                        const option = document.createElement('option');
                        option.value = place.id;
                        option.textContent = place.name;
                        sublocationSelect.appendChild(option);
                    });
                    sublocationWrapper.style.display = 'block';
                } else {
                    sublocationWrapper.style.display = 'none';
                }
            };

            if (locationSelect) {
                // التأكد من تحميل إعدادات النماذج
                if (typeof Permissions !== 'undefined' && typeof Permissions.ensureFormSettingsState === 'function') {
                    Permissions.ensureFormSettingsState().then(() => {
                        // الحصول على المواقع من إعدادات النماذج
                        const sites = this.getSiteOptions();

                        // إضافة المواقع إلى القائمة المنسدلة
                        sites.forEach(site => {
                            const option = document.createElement('option');
                            option.value = site.id;
                            option.textContent = site.name;
                            locationSelect.appendChild(option);
                        });
                    });
                } else {
                    // الحصول على المواقع من إعدادات النماذج
                    const sites = this.getSiteOptions();

                    // إضافة المواقع إلى القائمة المنسدلة
                    sites.forEach(site => {
                        const option = document.createElement('option');
                        option.value = site.id;
                        option.textContent = site.name;
                        locationSelect.appendChild(option);
                    });
                }

                // إضافة event listener لتحديث الأماكن الفرعية عند تغيير الموقع
                locationSelect.addEventListener('change', (e) => {
                    const selectedSiteId = e.target.value;
                    updateSublocationOptions(selectedSiteId);
                });
            }

            // ربط كود معد الإخطار
            if (typeof EmployeeHelper !== 'undefined') {
                EmployeeHelper.setupEmployeeCodeSearch('notification-reporter-code', 'notification-reporter-name', (employee) => {
                    if (employee) {
                        const codeInput = document.getElementById('notification-reporter-code');
                        const nameInput = document.getElementById('notification-reporter-name');
                        if (codeInput) codeInput.value = employee.code || employee.employeeNumber || employee.sapId || '';
                        if (nameInput) nameInput.value = employee.name || employee.fullName || '';
                    }
                });
            }

            // Toggle employee/contractor behavior based on affiliation selection
            const notificationAffiliationSelect = document.getElementById('notification-affiliation');
            const employeeCodeWrapper = document.getElementById('notification-employee-code-wrapper');
            const employeeCodeInput = document.getElementById('notification-employee-code');
            const employeeNameInput = document.getElementById('notification-employee-name');
            const employeeJobInput = document.getElementById('notification-employee-job');
            const employeeDepartmentInput = document.getElementById('notification-employee-department');

            const contractorNameWrapper = document.getElementById('notification-contractor-name-wrapper');
            const contractorNameInput = document.getElementById('notification-contractor-name');

            const isEmployeeAffiliation = () => {
                const v = (notificationAffiliationSelect?.value || '').toString().trim();
                return v === 'employee' || v === 'company'; // backward compatibility
            };

            const setEmployeeFieldsEditable = (editable) => {
                const inputs = [employeeNameInput, employeeJobInput, employeeDepartmentInput];
                inputs.forEach((el) => {
                    if (!el) return;
                    el.readOnly = !editable;
                    el.style.background = editable ? '' : '#fff7ed';
                    el.style.fontWeight = editable ? '' : '600';
                });
            };

            const updateAffiliationUI = () => {
                const isEmployee = isEmployeeAffiliation();
                const isContractor = (notificationAffiliationSelect?.value || '') === 'contractor';

                // Employee code field
                if (employeeCodeWrapper) employeeCodeWrapper.style.display = isEmployee ? 'block' : 'none';
                if (employeeCodeInput) {
                    employeeCodeInput.required = isEmployee;
                    if (!isEmployee) employeeCodeInput.value = '';
                }

                // Lock/unlock employee fields
                setEmployeeFieldsEditable(!isEmployee);

                // Contractor name field
                if (contractorNameWrapper) contractorNameWrapper.style.display = isContractor ? 'block' : 'none';
                if (contractorNameInput) {
                    contractorNameInput.required = isContractor;
                    if (!isContractor) contractorNameInput.value = '';
                }
            };

            if (notificationAffiliationSelect) {
                notificationAffiliationSelect.addEventListener('change', updateAffiliationUI);
                updateAffiliationUI(); // initial state
            }

            // Employee auto-fill (only when affiliation is employee)
            if (typeof EmployeeHelper !== 'undefined') {
                EmployeeHelper.setupEmployeeCodeSearch('notification-employee-code', 'notification-employee-name', (employee) => {
                    if (!employee || !isEmployeeAffiliation()) return;
                    if (employeeCodeInput) employeeCodeInput.value = employee.code || employee.employeeNumber || employee.sapId || employee.id || '';
                    if (employeeNameInput) employeeNameInput.value = employee.name || employee.fullName || '';
                    if (employeeJobInput) employeeJobInput.value = employee.job || employee.jobTitle || employee.position || '';
                    if (employeeDepartmentInput) employeeDepartmentInput.value = employee.department || employee.dept || employee.departmentName || '';
                });

                EmployeeHelper.setupAutocomplete('notification-employee-name', (employee) => {
                    if (!employee || !isEmployeeAffiliation()) return;
                    if (employeeCodeInput) employeeCodeInput.value = employee.code || employee.employeeNumber || employee.sapId || employee.id || '';
                    if (employeeJobInput) employeeJobInput.value = employee.job || employee.jobTitle || employee.position || '';
                    if (employeeDepartmentInput) employeeDepartmentInput.value = employee.department || employee.dept || employee.departmentName || '';
                });
            } else if (employeeCodeInput) {
                // Fallback: basic lookup by code if EmployeeHelper isn't available
                const tryFillByCode = () => {
                    if (!isEmployeeAffiliation()) return;
                    const code = (employeeCodeInput.value || '').toString().trim();
                    if (!code) return;
                    const employee = this.getEmployeeByCode(code);
                    if (!employee) return;
                    if (employeeNameInput) employeeNameInput.value = employee.name || employee.fullName || '';
                    if (employeeJobInput) employeeJobInput.value = employee.job || employee.jobTitle || employee.position || '';
                    if (employeeDepartmentInput) employeeDepartmentInput.value = employee.department || employee.dept || employee.departmentName || '';
                };
                employeeCodeInput.addEventListener('blur', tryFillByCode);
                employeeCodeInput.addEventListener('change', tryFillByCode);
            }
        }, 100);

        // معالجة إرسال النموذج
        modal.querySelector('#incident-notification-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleNotificationSubmit(modal, notificationNumber);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النموذج.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) modal.remove();
            }
        });
    },

    async handleNotificationSubmit(modal, notificationNumber) {
        try {
            Loading.show('جاري إرسال الإخطار...');

            // الحصول على بيانات الموقع والمكان الفرعي
            const locationSelect = document.getElementById('notification-location');
            const sublocationSelect = document.getElementById('notification-sublocation');

            const siteId = locationSelect?.value || '';
            const siteName = locationSelect?.options[locationSelect?.selectedIndex]?.text || siteId;
            const sublocationId = sublocationSelect?.value || '';
            const sublocationName = sublocationSelect?.options[sublocationSelect?.selectedIndex]?.text || sublocationId;

            // فحص العناصر قبل الاستخدام
            const dateEl = document.getElementById('notification-date');
            const incidentTypeEl = document.getElementById('notification-incident-type');
            const affiliationEl = document.getElementById('notification-affiliation');
            const contractorNameEl = document.getElementById('notification-contractor-name');
            const employeeCodeEl = document.getElementById('notification-employee-code');
            const employeeNameEl = document.getElementById('notification-employee-name');
            const employeeJobEl = document.getElementById('notification-employee-job');
            const employeeDepartmentEl = document.getElementById('notification-employee-department');
            const injuryDescriptionEl = document.getElementById('notification-injury-description');
            const descriptionEl = document.getElementById('notification-description');
            const lossesEl = document.getElementById('notification-losses');
            const actionsEl = document.getElementById('notification-actions');
            const reporterNameEl = document.getElementById('notification-reporter-name');
            const reporterCodeEl = document.getElementById('notification-reporter-code');

            // Validate contractor name if affiliation is "contractor"
            if (affiliationEl && affiliationEl.value === 'contractor') {
                if (!contractorNameEl || !contractorNameEl.value.trim()) {
                    Loading.hide();
                    Notification.error('اسم المقاول مطلوب عند اختيار مقاول');
                    return;
                }
            }

            const affiliationValue = (affiliationEl?.value || '').toString().trim();
            const isEmployeeAffiliation = affiliationValue === 'employee' || affiliationValue === 'company';

            // Validate employee fields (always required in the new form)
            if (!employeeNameEl || !employeeNameEl.value.trim()) {
                Loading.hide();
                Notification.error('اسم الموظف مطلوب');
                return;
            }
            if (!employeeJobEl || !employeeJobEl.value.trim()) {
                Loading.hide();
                Notification.error('الوظيفة مطلوبة');
                return;
            }
            if (!employeeDepartmentEl || !employeeDepartmentEl.value.trim()) {
                Loading.hide();
                Notification.error('الإدارة مطلوبة');
                return;
            }

            // Validate employee code only if affiliation is employee
            if (isEmployeeAffiliation) {
                if (!employeeCodeEl || !employeeCodeEl.value.trim()) {
                    Loading.hide();
                    Notification.error('كود الموظف مطلوب عند اختيار موظف');
                    return;
                }
            }

            if (!dateEl || !incidentTypeEl || !descriptionEl || !reporterNameEl) {
                Loading.hide();
                Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
                return;
            }

            const notificationData = {
                id: Utils.generateId('NOTIF'),
                notificationNumber: notificationNumber,
                date: (() => {
                    try {
                        if (!dateEl.value) return new Date().toISOString();
                        const date = new Date(dateEl.value);
                        if (isNaN(date.getTime())) return new Date().toISOString();
                        return date.toISOString();
                    } catch (e) {
                        return new Date().toISOString();
                    }
                })(),
                location: siteName || siteId,
                siteId: siteId,
                siteName: siteName,
                sublocation: sublocationName || sublocationId,
                sublocationId: sublocationId,
                sublocationName: sublocationName,
                department: employeeDepartmentEl?.value || '',
                incidentType: incidentTypeEl.value,
                affiliation: affiliationValue,
                contractorName: contractorNameEl?.value || '',
                // Employee fields (for work injury)
                employeeName: employeeNameEl?.value || '',
                employeeJob: employeeJobEl?.value || '',
                employeeDepartment: employeeDepartmentEl?.value || '',
                employeeCode: employeeCodeEl?.value || '',
                // Description fields
                description: descriptionEl.value,
                injuryDescription: injuryDescriptionEl?.value || '',
                losses: lossesEl?.value || '',
                actions: actionsEl?.value || '',
                reporterName: reporterNameEl.value,
                reporterCode: reporterCodeEl?.value || '',
                createdAt: new Date().toISOString(),
                createdBy: AppState.currentUser ? {
                    id: AppState.currentUser.id || '',
                    name: AppState.currentUser.name || AppState.currentUser.displayName || '',
                    email: AppState.currentUser.email || ''
                } : null
            };

            // حفظ الإخطار في Google Sheets
            if (!AppState.appData.incidentNotifications) {
                AppState.appData.incidentNotifications = [];
            }
            AppState.appData.incidentNotifications.push(notificationData);

            // إنشاء حادث جديد من الإخطار (سيتم إضافة التحقيق لاحقاً عبر النموذج الجديد)
            const investigationData = {
                id: Utils.generateId('INCIDENT'),
                notificationId: notificationData.id,
                notificationNumber: notificationNumber,
                title: `حادث - ${notificationData.incidentType}`,
                location: notificationData.location,
                siteId: notificationData.siteId,
                siteName: notificationData.siteName,
                sublocation: notificationData.sublocation,
                sublocationId: notificationData.sublocationId,
                sublocationName: notificationData.sublocationName,
                date: notificationData.date,
                department: notificationData.department,
                incidentType: notificationData.incidentType,
                affiliation: notificationData.affiliation,
                contractorName: notificationData.contractorName,
                // Compatibility fields for the main incident form/registry
                affectedType: (notificationData.affiliation === 'employee' || notificationData.affiliation === 'company') ? 'employee' : (notificationData.affiliation || 'other'),
                affectedCode: notificationData.employeeCode || '',
                affectedName: notificationData.employeeName || '',
                affectedJobTitle: notificationData.employeeJob || '',
                affectedDepartment: notificationData.employeeDepartment || '',
                employeeName: notificationData.employeeName,
                employeeJob: notificationData.employeeJob,
                employeeDepartment: notificationData.employeeDepartment,
                employeeAffectedCode: notificationData.employeeCode || '',
                description: notificationData.description,
                injuryDescription: notificationData.injuryDescription,
                losses: notificationData.losses,
                actionsTaken: notificationData.actions,
                reportedBy: notificationData.reporterName,
                employeeCode: notificationData.reporterCode,
                employeeNumber: notificationData.reporterCode,
                status: 'مفتوح', // سيتم تحديثه إلى "قيد التحقيق" عند فتح نموذج التحقيق
                severity: 'متوسطة',
                // تم نقل تحليل الأسباب والإجراءات إلى نموذج التحقيق المنفصل
                rootCause: '',
                correctiveAction: '',
                preventiveAction: '',
                // سيتم إضافة investigation عند فتح نموذج التحقيق
                investigation: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: notificationData.createdBy
            };

            if (!AppState.appData.incidents) {
                AppState.appData.incidents = [];
            }
            AppState.appData.incidents.push(investigationData);

            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }

            // تحديث Dashboard
            if (typeof Dashboard !== 'undefined' && Dashboard.refreshIncidents) {
                Dashboard.refreshIncidents();
            }

            // إغلاق النموذج فوراً
            Loading.hide();
            Notification.success('تم إرسال الإخطار وإنشاء تحقيق تلقائي بنجاح');
            modal.remove();

            // معالجة المهام الخلفية بدون تعطيل واجهة المستخدم
            this.processNotificationBackgroundTasks(notificationData, investigationData).catch(error => {
                Utils.safeError('خطأ في معالجة المهام الخلفية:', error);
            });

            // فتح نموذج التحقيق الجديد للمستخدم
            setTimeout(() => {
                if (typeof this.showInvestigationForm === 'function') {
                    this.showInvestigationForm(investigationData.id);
                } else {
                    // Fallback: فتح نموذج التعديل إذا لم يكن النموذج الجديد متاحاً
                    this.editIncident(investigationData.id);
                }
            }, 500);

        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في إرسال الإخطار:', error);
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    // جمع بيانات نموذج الإخطار للطباعة/التصدير
    getNotificationFormData() {
        const modal = document.querySelector('.modal-overlay');
        if (!modal) {
            return null;
        }

        const locationSelect = document.getElementById('notification-location');
        const sublocationSelect = document.getElementById('notification-sublocation');
        const notificationNumberEl = document.getElementById('notification-number');
        const dateEl = document.getElementById('notification-date');
        const incidentTypeEl = document.getElementById('notification-incident-type');
        const affiliationEl = document.getElementById('notification-affiliation');
        const contractorNameEl = document.getElementById('notification-contractor-name');
        const employeeCodeEl = document.getElementById('notification-employee-code');
        const employeeNameEl = document.getElementById('notification-employee-name');
        const employeeJobEl = document.getElementById('notification-employee-job');
        const employeeDepartmentEl = document.getElementById('notification-employee-department');
        const injuryDescriptionEl = document.getElementById('notification-injury-description');
        const descriptionEl = document.getElementById('notification-description');
        const lossesEl = document.getElementById('notification-losses');
        const actionsEl = document.getElementById('notification-actions');
        const reporterNameEl = document.getElementById('notification-reporter-name');
        const reporterCodeEl = document.getElementById('notification-reporter-code');

        if (!notificationNumberEl || !dateEl || !incidentTypeEl || !descriptionEl || !reporterNameEl) {
            return null;
        }

        const siteId = locationSelect?.value || '';
        const siteName = locationSelect?.options[locationSelect?.selectedIndex]?.text || siteId;
        const sublocationId = sublocationSelect?.value || '';
        const sublocationName = sublocationSelect?.options[sublocationSelect?.selectedIndex]?.text || sublocationId;

        return {
            notificationNumber: notificationNumberEl.value,
            date: dateEl.value,
            location: siteName || siteId,
            siteId: siteId,
            siteName: siteName,
            sublocation: sublocationName || sublocationId,
            sublocationId: sublocationId,
            sublocationName: sublocationName,
            incidentType: incidentTypeEl.value,
            affiliation: affiliationEl?.value || '',
            contractorName: contractorNameEl?.value || '',
            employeeCode: employeeCodeEl?.value || '',
            employeeName: employeeNameEl?.value || '',
            employeeJob: employeeJobEl?.value || '',
            employeeDepartment: employeeDepartmentEl?.value || '',
            department: employeeDepartmentEl?.value || '',
            description: descriptionEl.value,
            injuryDescription: injuryDescriptionEl?.value || '',
            losses: lossesEl?.value || '',
            actions: actionsEl?.value || '',
            reporterName: reporterNameEl.value,
            reporterCode: reporterCodeEl?.value || ''
        };
    },

    // طباعة إخطار الحادث
    printNotification() {
        try {
            // جمع البيانات من النموذج المفتوح
            const notificationData = this.getNotificationFormData();
            
            if (!notificationData) {
                Notification.warning('لا توجد بيانات للطباعة. يرجى فتح النموذج أولاً.');
                return;
            }

            if (!notificationData.notificationNumber && !notificationData.description) {
                Notification.warning('لا توجد بيانات للطباعة');
                return;
            }

            Loading.show('جاري إعداد الطباعة...');

            // استخدام دالة exportNotificationPDF لكن مع البيانات المباشرة
            this.exportNotificationPDFWithData(notificationData);
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في طباعة الإخطار:', error);
            Notification.error('فشل الطباعة: ' + error.message);
        }
    },

    // بناء محتوى HTML للطباعة
    buildNotificationPrintContent(notificationData) {
        const companyName = AppState?.companySettings?.name || AppState?.companyName || '';
        const companySecondaryName = AppState?.companySettings?.secondaryName || '';
        const companyLogo = AppState?.companyLogo || '';
        
        const formatDate = (dateStr) => {
            if (!dateStr) return 'غير محدد';
            try {
                const date = new Date(dateStr);
                return date.toLocaleString('ar-SA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch {
                return dateStr;
            }
        };

        const affiliationNames = {
            'company': 'شركة',
            'employee': 'موظف',
            'daily-labor': 'عمالة يومية',
            'contractor': 'مقاول',
            'visitor': 'زائر',
            'none': 'لا يوجد'
        };

        return `
            <div style="direction: rtl; text-align: right; font-family: 'Tahoma', Arial, sans-serif;">
                <!-- Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #667eea;">
                    <div style="flex: 0 0 auto; text-align: right; padding-left: 20px;">
                        ${companyLogo ? `<img src="${companyLogo}" alt="شعار الشركة" style="max-height: 60px; max-width: 150px; object-fit: contain;">` : ''}
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: #667eea; margin-bottom: 5px;">إخطار عن حادث</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #764ba2;">Incident Notification</div>
                    </div>
                    <div style="flex: 0 0 auto; text-align: left; padding-right: 20px;">
                        <div style="font-size: 14px; font-weight: 700; color: #1f2937; line-height: 1.3;">
                            ${Utils.escapeHTML(companyName || '')}
                            ${companySecondaryName ? `<div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-top: 2px;">${Utils.escapeHTML(companySecondaryName)}</div>` : ''}
                        </div>
                    </div>
                </div>

                <!-- المعلومات الأساسية -->
                <div style="margin-bottom: 25px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 20px; border-radius: 8px 8px 0 0; font-weight: 700; font-size: 1.1rem; margin-bottom: 15px;">
                        <i class="fas fa-info-circle"></i> المعلومات الأساسية
                    </div>
                    <table style="width: 100%; border-collapse: collapse; background: white; border: 2px solid #667eea; border-radius: 0 0 8px 8px;">
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #e0e7ff; text-align: right; width: 30%;">رقم الإخطار</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${Utils.escapeHTML(notificationData.notificationNumber || 'غير محدد')}</td>
                        </tr>
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #e0e7ff; text-align: right;">تاريخ ووقت الحادث</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${formatDate(notificationData.date)}</td>
                        </tr>
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #e0e7ff; text-align: right;">مكان الحادث</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${Utils.escapeHTML(notificationData.siteName || notificationData.location || 'غير محدد')}</td>
                        </tr>
                        ${notificationData.sublocationName ? `
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #e0e7ff; text-align: right;">المكان الفرعي</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${Utils.escapeHTML(notificationData.sublocationName)}</td>
                        </tr>
                        ` : ''}
                    </table>
                </div>

                <!-- تفاصيل الحادث -->
                <div style="margin-bottom: 25px;">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; padding: 12px 20px; border-radius: 8px 8px 0 0; font-weight: 700; font-size: 1.1rem; margin-bottom: 15px;">
                        <i class="fas fa-clipboard-list"></i> تفاصيل الحادث
                    </div>
                    <table style="width: 100%; border-collapse: collapse; background: white; border: 2px solid #f59e0b; border-radius: 0 0 8px 8px;">
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #fef3c7; text-align: right;">نوع الحادث</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${Utils.escapeHTML(notificationData.incidentType || 'غير محدد')}</td>
                        </tr>
                        ${notificationData.affiliation ? `
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #fef3c7; text-align: right;">التبعية</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${affiliationNames[notificationData.affiliation] || notificationData.affiliation}</td>
                        </tr>
                        ` : ''}
                        ${notificationData.employeeCode ? `
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #fef3c7; text-align: right;">كود الموظف</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${Utils.escapeHTML(notificationData.employeeCode)}</td>
                        </tr>
                        ` : ''}
                        ${notificationData.contractorName ? `
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #fef3c7; text-align: right;">اسم المقاول</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${Utils.escapeHTML(notificationData.contractorName)}</td>
                        </tr>
                        ` : ''}
                        ${notificationData.employeeName ? `
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #fef3c7; text-align: right;">اسم الموظف</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${Utils.escapeHTML(notificationData.employeeName)}</td>
                        </tr>
                        ` : ''}
                        ${notificationData.employeeJob ? `
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #fef3c7; text-align: right;">الوظيفة</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${Utils.escapeHTML(notificationData.employeeJob)}</td>
                        </tr>
                        ` : ''}
                        ${notificationData.employeeDepartment ? `
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #fef3c7; text-align: right;">الإدارة</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${Utils.escapeHTML(notificationData.employeeDepartment)}</td>
                        </tr>
                        ` : ''}
                    </table>
                    
                    ${notificationData.description ? `
                    <div style="background: white; padding: 15px; border: 2px solid #f59e0b; border-radius: 8px; margin-top: 15px;">
                        <div style="font-weight: 700; margin-bottom: 10px; color: #f59e0b; font-size: 1rem;">وصف مختصر للحادث:</div>
                        <div style="white-space: pre-wrap; line-height: 1.6;">${Utils.escapeHTML(notificationData.description)}</div>
                    </div>
                    ` : ''}
                    
                    ${notificationData.injuryDescription ? `
                    <div style="background: white; padding: 15px; border: 2px solid #f59e0b; border-radius: 8px; margin-top: 15px;">
                        <div style="font-weight: 700; margin-bottom: 10px; color: #f59e0b; font-size: 1rem;">وصف الإصابة:</div>
                        <div style="white-space: pre-wrap; line-height: 1.6;">${Utils.escapeHTML(notificationData.injuryDescription)}</div>
                    </div>
                    ` : ''}
                    
                    ${notificationData.losses ? `
                    <div style="background: white; padding: 15px; border: 2px solid #f59e0b; border-radius: 8px; margin-top: 15px;">
                        <div style="font-weight: 700; margin-bottom: 10px; color: #f59e0b; font-size: 1rem;">الخسائر:</div>
                        <div style="white-space: pre-wrap; line-height: 1.6;">${Utils.escapeHTML(notificationData.losses)}</div>
                    </div>
                    ` : ''}
                    
                    ${notificationData.actions ? `
                    <div style="background: white; padding: 15px; border: 2px solid #f59e0b; border-radius: 8px; margin-top: 15px;">
                        <div style="font-weight: 700; margin-bottom: 10px; color: #f59e0b; font-size: 1rem;">الإجراءات المتخذة:</div>
                        <div style="white-space: pre-wrap; line-height: 1.6;">${Utils.escapeHTML(notificationData.actions)}</div>
                    </div>
                    ` : ''}
                </div>

                <!-- معلومات معد الإخطار -->
                <div style="margin-bottom: 25px;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 20px; border-radius: 8px 8px 0 0; font-weight: 700; font-size: 1.1rem; margin-bottom: 15px;">
                        <i class="fas fa-user-edit"></i> معلومات معد الإخطار
                    </div>
                    <table style="width: 100%; border-collapse: collapse; background: white; border: 2px solid #10b981; border-radius: 0 0 8px 8px;">
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #d1fae5; text-align: right; width: 30%;">اسم معد الإخطار</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${Utils.escapeHTML(notificationData.reporterName || 'غير محدد')}</td>
                        </tr>
                        ${notificationData.reporterCode ? `
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd; background-color: #d1fae5; text-align: right;">كود معد الإخطار</th>
                            <td style="padding: 12px; border: 1px solid #ddd;">${Utils.escapeHTML(notificationData.reporterCode)}</td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
            </div>
        `;
    },

    // تصدير إخطار الحادث إلى PDF باستخدام البيانات المباشرة
    exportNotificationPDFWithData(notificationData) {
        try {
            Loading.show('جاري تحضير PDF...');

            const content = this.buildNotificationPrintContent(notificationData);

            const formCode = notificationData.notificationNumber || `NOT-${new Date().toISOString().slice(0, 10)}`;
            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(
                    formCode,
                    'إخطار عن حادث - Incident Notification',
                    content,
                    false,
                    true,
                    { version: '1.0' },
                    new Date().toISOString(),
                    new Date().toISOString()
                )
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>body { font-family: 'Tahoma', Arial, sans-serif; direction: rtl; text-align: right; padding: 20px; } @media print { body { margin: 0; padding: 15px; } }</style></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                            Loading.hide();
                            Notification.success('تم تجهيز التقرير للطباعة/الحفظ كـ PDF');
                        }, 800);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error('فشل تصدير PDF: ' + error.message);
        }
    },

    // تصدير إخطار الحادث إلى PDF
    exportNotificationPDF() {
        // استخدام نفس دالة الطباعة حيث أن exportPDF تقوم بفتح نافذة طباعة يمكن حفظها كـ PDF
        this.printNotification();
    },

    // معالجة المهام الخلفية بعد حفظ الإخطار
    async processNotificationBackgroundTasks(notificationData, investigationData) {
        try {
            // حفظ الإخطار في Google Sheets عبر Backend
            const notificationResult = await GoogleIntegration.sendRequest({
                action: 'addIncidentNotification',
                data: notificationData
            });

            if (notificationResult && notificationResult.success) {
                Utils.safeLog('✅ تم حفظ الإخطار في Google Sheets بنجاح');
            } else {
                Utils.safeWarn('⚠️ فشل حفظ الإخطار في Google Sheets، سيتم المحاولة عبر autoSave');
                // Fallback: استخدام autoSave
                await GoogleIntegration.autoSave('IncidentNotifications', AppState.appData.incidentNotifications);
            }

            // إضافة التحقيق إلى Google Sheets
            await GoogleIntegration.sendRequest({
                action: 'addIncident',
                data: investigationData
            });

            // إنشاء Action Record تلقائي
            if (notificationData.actions) {
                try {
                    await GoogleIntegration.sendToAppsScript?.('createActionFromModule', {
                        sourceModule: 'IncidentNotification',
                        sourceId: notificationData.id,
                        sourceData: {
                            date: notificationData.date,
                            description: notificationData.description,
                            correctiveAction: notificationData.actions,
                            department: notificationData.department,
                            location: notificationData.location,
                            siteId: notificationData.siteId,
                            siteName: notificationData.siteName,
                            sublocation: notificationData.sublocation,
                            sublocationId: notificationData.sublocationId,
                            sublocationName: notificationData.sublocationName,
                            severity: 'Medium',
                            reportedBy: notificationData.reporterName,
                            createdBy: notificationData.createdBy?.name || 'System',
                            ...notificationData
                        }
                    });
                } catch (actionError) {
                    Utils.safeError('خطأ في إنشاء Action Record:', actionError);
                }
            }

            Utils.safeLog('Incidents: تم إكمال المهام الخلفية للإخطار بنجاح');
        } catch (error) {
            Utils.safeError('خطأ في معالجة المهام الخلفية للإخطار:', error);
        }
    },

    async editIncident(id) {
        // التحقق من الصلاحيات
        const isAdmin = AppState.currentUser?.role === 'admin' ||
            (AppState.currentUser?.permissions && (
                AppState.currentUser.permissions.admin === true ||
                AppState.currentUser.permissions['manage-modules'] === true
            ));

        if (!isAdmin) {
            Notification.error('ليس لديك صلاحية لتعديل الحوادث. يجب أن تكون مدير النظام.');
            return;
        }

        const incident = AppState.appData.incidents.find(i => i.id === id);
        if (incident) await this.showForm(incident);
    },

    async viewIncident(id) {
        const incident = AppState.appData.incidents.find(i => i.id === id);
        if (!incident) return;

        // معالجة investigation - تحويل من JSON string إلى object إذا لزم الأمر
        if (incident.investigation && typeof incident.investigation === 'string') {
            try {
                incident.investigation = JSON.parse(incident.investigation);
            } catch (e) {
                Utils.safeWarn('خطأ في تحليل investigation:', e);
                incident.investigation = {};
            }
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title">تفاصيل الحادث</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-sm font-semibold text-gray-600">كود ISO:</label>
                                <p class="text-gray-800 font-mono">${Utils.escapeHTML(incident.isoCode || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">العنوان:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(incident.title || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الموقع:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(incident.location || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">التاريخ:</label>
                                <p class="text-gray-800">${incident.date ? Utils.formatDate(incident.date) : '-'}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الشدة:</label>
                                <span class="badge badge-${this.getSeverityBadgeClass(incident.severity)}">
                                    ${incident.severity || '-'}
                                </span>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">المبلغ:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(incident.reportedBy || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الكود الوظيفي:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(incident.employeeCode || incident.employeeNumber || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الحالة:</label>
                                <span class="badge badge-${this.getStatusBadgeClass(incident.status)}">
                                    ${incident.status || '-'}
                                </span>
                            </div>
                            <div class="col-span-2">
                                <label class="text-sm font-semibold text-gray-600">الوصف:</label>
                                <p class="text-gray-800 whitespace-pre-wrap">${Utils.escapeHTML(incident.description || '')}</p>
                            </div>
                            ${incident.image ? `
                            <div class="col-span-2">
                                <label class="text-sm font-semibold text-gray-600">صورة توضيحية:</label>
                                <div class="mt-2">
                                    <img src="${this.convertGoogleDriveLinkToPrintable(incident.image)}" alt="صورة الحادث" class="max-w-full h-auto rounded border" style="max-height: 400px;"
                                         onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';">
                                </div>
                            </div>
                            ` : ''}
                            ${incident.correctiveAction ? `
                            <div class="col-span-2">
                                <label class="text-sm font-semibold text-gray-600">الخطة التصحيحية:</label>
                                <p class="text-gray-800 whitespace-pre-wrap bg-gray-50 p-4 rounded border">${Utils.escapeHTML(incident.correctiveAction || '')}</p>
                            </div>
                            ` : ''}
                            ${incident.investigation ? `
                            <div class="col-span-2 border-t pt-4 mt-4">
                                <h3 class="text-base font-semibold text-gray-700 mb-3">
                                    <i class="fas fa-search ml-2"></i>
                                    بيانات التحقيق
                                </h3>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="text-sm font-semibold text-gray-600">رقم التحقيق:</label>
                                        <p class="text-gray-800">${Utils.escapeHTML(incident.investigation.investigationNumber || '-')}</p>
                                    </div>
                                    <div>
                                        <label class="text-sm font-semibold text-gray-600">تاريخ التحقيق:</label>
                                        <p class="text-gray-800">${incident.investigation.investigationDateTime ? Utils.formatDate(incident.investigation.investigationDateTime) : '-'}</p>
                                    </div>
                                    <div>
                                        <label class="text-sm font-semibold text-gray-600">المصنع:</label>
                                        <p class="text-gray-800">${Utils.escapeHTML(incident.investigation.factoryName || '-')}</p>
                                    </div>
                                    <div>
                                        <label class="text-sm font-semibold text-gray-600">موقع الحادث:</label>
                                        <p class="text-gray-800">${Utils.escapeHTML(incident.investigation.locationName || '-')}</p>
                                    </div>
                                    ${incident.investigation.riskResult ? `
                                    <div>
                                        <label class="text-sm font-semibold text-gray-600">نتيجة التقييم:</label>
                                        <span class="badge badge-${incident.investigation.riskResult === 'high' ? 'danger' : incident.investigation.riskResult === 'medium' ? 'warning' : 'info'}">
                                            ${incident.investigation.riskResult === 'high' ? 'عالي' : incident.investigation.riskResult === 'medium' ? 'متوسط' : 'منخفض'}
                                        </span>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                    <button class="btn-secondary" onclick="Incidents.exportPDF('${incident.id}');">
                        <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                    </button>
                    ${incident.requiresApproval && incident.investigation && this.canApproveIncident() ? `
                    <button class="btn-success" onclick="Incidents.approveIncident('${incident.id}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-check ml-2"></i>اعتماد التحقيق
                    </button>
                    ` : ''}
                    ${incident.investigation ? `
                    <button class="btn-secondary" onclick="if(typeof Incidents !== 'undefined' && typeof Incidents.showInvestigationForm === 'function') { Incidents.showInvestigationForm('${incident.id}'); this.closest('.modal-overlay').remove(); } else { console.error('Incidents.showInvestigationForm is not available'); alert('نموذج التحقيق غير متاح. يرجى إعادة تحميل الصفحة.'); }">
                        <i class="fas fa-search ml-2"></i>عرض/تعديل التحقيق
                    </button>
                    ` : `
                    <button class="btn-secondary" onclick="if(typeof Incidents !== 'undefined' && typeof Incidents.showInvestigationForm === 'function') { Incidents.showInvestigationForm('${incident.id}'); this.closest('.modal-overlay').remove(); } else { console.error('Incidents.showInvestigationForm is not available'); alert('نموذج التحقيق غير متاح. يرجى إعادة تحميل الصفحة.'); }">
                        <i class="fas fa-search ml-2"></i>التحقيق في الحادث
                    </button>
                    `}
                    <button class="btn-primary" onclick="Incidents.editIncident('${incident.id}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>تعديل
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async deleteIncident(id) {
        // التحقق من الصلاحيات
        const isAdmin = AppState.currentUser?.role === 'admin' ||
            (AppState.currentUser?.permissions && (
                AppState.currentUser.permissions.admin === true ||
                AppState.currentUser.permissions['manage-modules'] === true ||
                AppState.currentUser.permissions['incidents-manage'] === true
            ));

        if (!isAdmin) {
            Notification.error('ليس لديك صلاحية لحذف الحوادث. يجب أن تكون مدير النظام فقط.');
            return;
        }

        if (!confirm('هل أنت متأكد من حذف هذا الحادث؟')) return;
        Loading.show();
        try {
            const deletedIncident = AppState.appData.incidents.find(i => i.id === id);
            AppState.appData.incidents = (AppState.appData.incidents || []).filter(i => i.id !== id);
            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }

            // حذف من Google Sheets
            if (deletedIncident) {
                // إرسال بيانات المستخدم للتحقق من الصلاحيات في Backend
                const userData = {
                    id: AppState.currentUser?.id || '',
                    email: AppState.currentUser?.email || '',
                    name: AppState.currentUser?.name || '',
                    role: AppState.currentUser?.role || '',
                    permissions: AppState.currentUser?.permissions || {}
                };

                const deleteResult = await GoogleIntegration.sendRequest({
                    action: 'deleteIncident',
                    data: {
                        incidentId: id,
                        userData: userData
                    }
                });

                // التحقق من استجابة Backend
                if (deleteResult && deleteResult.success === false) {
                    // استعادة الحادث المحذوف محلياً إذا فشل الحذف في Backend
                    AppState.appData.incidents.push(deletedIncident);
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                        window.DataManager.save();
                    }
                    throw new Error(deleteResult.message || 'فشل حذف الحادث في Backend');
                }

                // حذف من السجل فقط عند نجاح الحذف في Backend
                if (deletedIncident) {
                    await this.removeFromRegistry(id);
                }
            }

            // تحديث Dashboard
            if (typeof Dashboard !== 'undefined' && Dashboard.refreshIncidents) {
                Dashboard.refreshIncidents();
            }

            Loading.hide();
            Notification.success('تم حذف الحادث بنجاح');
            this.loadIncidentsList();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    // نموذج التحقيق في الحادث - Incident Investigation
    async showInvestigationForm(incidentId) {
        try {
            if (AppState.debugMode) Utils.safeLog('🔍 showInvestigationForm called with incidentId:', incidentId);

            if (!incidentId) {
                if (AppState.debugMode) Utils.safeError('❌ incidentId is missing');
                Notification.error('معرف الحادث غير موجود');
                return;
            }

            if (!AppState || !AppState.appData || !AppState.appData.incidents) {
                if (AppState.debugMode) Utils.safeError('❌ AppState.appData.incidents is not available');
                Notification.error('بيانات الحوادث غير متاحة');
                Utils.safeError('AppState.appData.incidents is not available');
                return;
            }

            if (AppState.debugMode) Utils.safeLog('✅ AppState check passed, incidents count:', AppState.appData.incidents.length);

            const incident = AppState.appData.incidents.find(i => i.id === incidentId);
            if (!incident) {
                if (AppState.debugMode) {
                    Utils.safeError('❌ Incident not found with id:', incidentId);
                    Utils.safeLog('Available incident IDs:', AppState.appData.incidents.map(i => i.id));
                }
                Notification.error('الحادث غير موجود');
                Utils.safeError('Incident not found with id:', incidentId);
                return;
            }

            if (AppState.debugMode) Utils.safeLog('✅ Incident found:', incident.title || incident.id);

            // التحقق من الصلاحيات (مرن - يسمح للمستخدمين العاديين بالعرض)
            const isAdmin = AppState.currentUser?.role === 'admin' ||
                (AppState.currentUser?.permissions && (
                    AppState.currentUser.permissions.admin === true ||
                    AppState.currentUser.permissions['manage-modules'] === true
                ));

            // التحقق من صلاحية مسئول السلامة لاستكمال التحقيق
            const isSafetyOfficer = AppState.currentUser?.role === 'safety_officer' ||
                (AppState.currentUser?.permissions &&
                    AppState.currentUser.permissions['incidents-complete-investigation'] === true);

            // التحقق من أن الحادث تم إنشاؤه من إخطار (يحتوي على notificationId)
            const isFromNotification = !!incident.notificationId;

            // السماح بالتعديل إذا كان:
            // 1. مدير النظام (صلاحيات كاملة)
            // 2. مسئول السلامة مع صلاحية استكمال التحقيق (يمكنه حفظ التحقيق لكن يحتاج موافقة)
            const canEdit = isAdmin || isSafetyOfficer;

            // معالجة investigation - تحويل من JSON string إلى object إذا لزم الأمر
            let investigationData = incident.investigation || {};
            if (typeof investigationData === 'string') {
                try {
                    investigationData = JSON.parse(investigationData);
                } catch (e) {
                    Utils.safeWarn('خطأ في تحليل investigation:', e);
                    investigationData = {};
                }
            }

            const isEdit = !!investigationData.investigationNumber;

            // توليد رقم التحقيق تلقائياً إذا لم يكن موجوداً
            const investigationNumber = investigationData.investigationNumber ||
                `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String((AppState.appData.incidents || []).filter(i => i.investigation?.investigationNumber).length + 1).padStart(4, '0')}`;

            // التواريخ - تحميل تلقائي من بيانات الحادث إذا لم تكن موجودة
            const investigationDateTime = investigationData.investigationDateTime ?
                this.safeDateToISOString(investigationData.investigationDateTime) :
                (isEdit ? '' : Utils.toDateTimeLocalString(new Date()));
            const incidentDateTime = investigationData.incidentDateTime ?
                this.safeDateToISOString(investigationData.incidentDateTime) :
                this.safeDateToISOString(incident.date);

            // تحميل بيانات الحادث تلقائياً في حقول التحقيق إذا لم تكن موجودة
            const factoryId = investigationData.factoryId || incident.siteId || '';
            const locationId = investigationData.locationId || incident.sublocationId || '';
            const description = investigationData.description || incident.description || '';
            const affectedName = investigationData.affectedName || incident.affectedName || '';
            const affectedJob = investigationData.affectedJob || incident.affectedJobTitle || '';
            const affectedDepartment = investigationData.affectedDepartment || incident.affectedDepartment || '';

            // توليد صفوف خطة العمل قبل template literal لتجنب مشكلة this
            const actionPlanRows = this.renderInvestigationActionPlanRows(investigationData.actionPlan || []);

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            // إضافة styles مباشرة لضمان ظهور النموذج
            modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 10000; align-items: center; justify-content: center;';
            modal.innerHTML = `
            <style>
                .investigation-section {
                    border-radius: 12px;
                    padding: 24px;
                    margin-bottom: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    border: 2px solid;
                    transition: all 0.3s ease;
                }
                .investigation-section:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                    transform: translateY(-2px);
                }
                .investigation-section h3 {
                    font-size: 1.25rem;
                    font-weight: 700;
                    margin-bottom: 20px;
                    padding-bottom: 12px;
                    border-bottom: 3px solid;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .investigation-section h3 i {
                    font-size: 1.5rem;
                    padding: 10px;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.3);
                }
                .section-1 { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-color: #2196F3; }
                .section-1 h3 { color: #1565C0; border-color: #2196F3; }
                .section-1 h3 i { color: #1976D2; background: rgba(33, 150, 243, 0.1); }
                
                .section-2 { background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); border-color: #9C27B0; }
                .section-2 h3 { color: #6A1B9A; border-color: #9C27B0; }
                .section-2 h3 i { color: #7B1FA2; background: rgba(156, 39, 176, 0.1); }
                
                .section-3 { background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-color: #FF9800; }
                .section-3 h3 { color: #E65100; border-color: #FF9800; }
                .section-3 h3 i { color: #F57C00; background: rgba(255, 152, 0, 0.1); }
                
                .section-4 { background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%); border-color: #E91E63; }
                .section-4 h3 { color: #AD1457; border-color: #E91E63; }
                .section-4 h3 i { color: #C2185B; background: rgba(233, 30, 99, 0.1); }
                
                .section-5 { background: linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%); border-color: #009688; }
                .section-5 h3 { color: #00695C; border-color: #009688; }
                .section-5 h3 i { color: #00796B; background: rgba(0, 150, 136, 0.1); }
                
                .section-6 { background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-color: #4CAF50; }
                .section-6 h3 { color: #2E7D32; border-color: #4CAF50; }
                .section-6 h3 i { color: #388E3C; background: rgba(76, 175, 80, 0.1); }
                
                .section-7 { background: linear-gradient(135deg, #fff9c4 0%, #fff59d 100%); border-color: #FFC107; }
                .section-7 h3 { color: #F57F17; border-color: #FFC107; }
                .section-7 h3 i { color: #F9A825; background: rgba(255, 193, 7, 0.1); }
            </style>
            <div class="modal-content" style="max-width: 1500px; width: 98%; max-height: 95vh; overflow-y: auto; padding: 0;">
                <div class="modal-header modal-header-centered" style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 20px 30px;">
                    <h2 class="modal-title" style="font-size: 1.75rem; font-weight: 700; color: white;">
                        <i class="fas fa-search ml-2"></i>
                        التحقيق في الحادث – Incident Investigation
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white; font-size: 1.5rem;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 30px; max-height: calc(95vh - 180px); overflow-y: auto; background: #f5f7fa;">
                    <form id="investigation-form">
                        <!-- 1) بيانات الحادث الأساسية -->
                        <div class="investigation-section section-1">
                            <h3>
                                <i class="fas fa-info-circle"></i>
                                <span>1) بيانات الحادث الأساسية</span>
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-calendar-alt ml-2 text-blue-600"></i>
                                        تاريخ ووقت التحقيق *
                                    </label>
                                    <input type="datetime-local" id="investigation-datetime" required class="form-input" 
                                        value="${investigationDateTime}" style="border: 2px solid #2196F3; font-weight: 500;">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-calendar-check ml-2 text-blue-600"></i>
                                        تاريخ ووقت الحادث *
                                    </label>
                                    <input type="datetime-local" id="incident-datetime" required class="form-input" 
                                        value="${incidentDateTime}" style="border: 2px solid #2196F3; font-weight: 500;">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-industry ml-2 text-blue-600"></i>
                                        المصنع *
                                    </label>
                                    <select id="investigation-factory" required class="form-input" style="border: 2px solid #2196F3;">
                                        <option value="">اختر المصنع</option>
                                        ${factoryId ? `<option value="${factoryId}" selected>${Utils.escapeHTML(incident.siteName || incident.location || '')}</option>` : ''}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-map-marker-alt ml-2 text-blue-600"></i>
                                        موقع الحادث بالضبط *
                                    </label>
                                    <select id="investigation-location" required class="form-input" style="border: 2px solid #2196F3;">
                                        <option value="">اختر موقع الحادث</option>
                                        ${locationId ? `<option value="${locationId}" selected>${Utils.escapeHTML(incident.sublocationName || incident.sublocation || '')}</option>` : ''}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-hashtag ml-2 text-blue-600"></i>
                                        رقم التحقيق
                                    </label>
                                    <input type="text" id="investigation-number" class="form-input" 
                                        value="${investigationNumber}" readonly style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%); font-weight: 700; border: 2px solid #1976D2; color: #0D47A1;">
                                </div>
                            </div>
                        </div>

                        <!-- 2) نوع الحادث -->
                        <div class="investigation-section section-2">
                            <h3>
                                <i class="fas fa-tags"></i>
                                <span>2) نوع الحادث</span>
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <label class="flex items-center p-3 bg-white rounded-lg border-2 border-purple-300 hover:bg-purple-50 cursor-pointer transition-all">
                                    <input type="checkbox" id="incident-type-nearmiss" class="form-checkbox ml-2 text-purple-600" 
                                        ${investigationData.incidentTypes?.includes('nearmiss') ? 'checked' : ''}>
                                    <span class="font-semibold text-gray-700">حادث وشيك</span>
                                </label>
                                <label class="flex items-center p-3 bg-white rounded-lg border-2 border-purple-300 hover:bg-purple-50 cursor-pointer transition-all">
                                    <input type="checkbox" id="incident-type-property" class="form-checkbox ml-2 text-purple-600"
                                        ${investigationData.incidentTypes?.includes('property') ? 'checked' : ''}>
                                    <span class="font-semibold text-gray-700">تلف ممتلكات</span>
                                </label>
                                <label class="flex items-center p-3 bg-white rounded-lg border-2 border-purple-300 hover:bg-purple-50 cursor-pointer transition-all">
                                    <input type="checkbox" id="incident-type-injury-no-lost" class="form-checkbox ml-2 text-purple-600"
                                        ${investigationData.incidentTypes?.includes('injury-no-lost') ? 'checked' : ''}>
                                    <span class="font-semibold text-gray-700">إصابة بدون فقد أيام عمل</span>
                                </label>
                                <label class="flex items-center p-3 bg-white rounded-lg border-2 border-purple-300 hover:bg-purple-50 cursor-pointer transition-all">
                                    <input type="checkbox" id="incident-type-injury-lost" class="form-checkbox ml-2 text-purple-600"
                                        ${investigationData.incidentTypes?.includes('injury-lost') ? 'checked' : ''}>
                                    <span class="font-semibold text-gray-700">إصابة مع فقد أيام عمل</span>
                                </label>
                                <label class="flex items-center p-3 bg-white rounded-lg border-2 border-purple-300 hover:bg-purple-50 cursor-pointer transition-all">
                                    <input type="checkbox" id="incident-type-fatality" class="form-checkbox ml-2 text-purple-600"
                                        ${investigationData.incidentTypes?.includes('fatality') ? 'checked' : ''}>
                                    <span class="font-semibold text-gray-700">وفاة</span>
                                </label>
                            </div>
                        </div>

                        <!-- 3) وصف وقائع وظروف الحادث -->
                        <div class="investigation-section section-3">
                            <h3>
                                <i class="fas fa-align-left"></i>
                                <span>3) وصف وقائع وظروف الحادث</span>
                            </h3>
                            <div class="space-y-5">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-file-alt ml-2 text-orange-600"></i>
                                        الوصف الرئيسي *
                                    </label>
                                    <textarea id="investigation-description" required class="form-input" rows="6" 
                                        placeholder="وصف تفصيلي لوقائع وظروف الحادث..." style="border: 2px solid #FF9800; font-size: 1rem;">${Utils.escapeHTML(description)}</textarea>
                                </div>
                                <div id="nearmiss-description-wrapper" style="display: none;">
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-exclamation-triangle ml-2 text-orange-600"></i>
                                        وصف الحالة الوشيكة
                                    </label>
                                    <textarea id="investigation-nearmiss-description" class="form-input" rows="4" 
                                        placeholder="وصف تفصيلي للحالة الوشيكة..." style="border: 2px solid #FF9800;">${Utils.escapeHTML(investigationData.nearmissDescription || '')}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- 4) بيانات المصاب -->
                        <div class="investigation-section section-4">
                            <h3>
                                <i class="fas fa-user-injured"></i>
                                <span>4) بيانات المصاب</span>
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">تبعية المصاب</label>
                                    <select id="investigation-affected-affiliation" class="form-input">
                                        <option value="">اختر التبعية</option>
                                        <option value="company" ${investigationData.affectedAffiliation === 'company' ? 'selected' : ''}>شركة</option>
                                        <option value="daily-labor" ${investigationData.affectedAffiliation === 'daily-labor' ? 'selected' : ''}>عمالة يومية</option>
                                        <option value="contractor" ${investigationData.affectedAffiliation === 'contractor' ? 'selected' : ''}>مقاول</option>
                                        <option value="visitor" ${investigationData.affectedAffiliation === 'visitor' ? 'selected' : ''}>زائر</option>
                                        <option value="none" ${investigationData.affectedAffiliation === 'none' ? 'selected' : ''}>لا يوجد</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">الاسم</label>
                                    <input type="text" id="investigation-affected-name" class="form-input" 
                                        value="${Utils.escapeHTML(affectedName)}" 
                                        placeholder="اسم المصاب">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">الوظيفة</label>
                                    <input type="text" id="investigation-affected-job" class="form-input" 
                                        value="${Utils.escapeHTML(affectedJob)}" 
                                        placeholder="الوظيفة">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">السن</label>
                                    <input type="number" id="investigation-affected-age" class="form-input" 
                                        value="${investigationData.affectedAge || ''}" 
                                        placeholder="السن" min="1" max="100">
                                </div>
                                <div class="col-span-2">
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">الجهة التابع لها</label>
                                    <input type="text" id="investigation-affected-department" class="form-input" 
                                        value="${Utils.escapeHTML(affectedDepartment)}" 
                                        placeholder="الجهة التابع لها">
                                </div>
                            </div>
                        </div>

                        <!-- 5) الجزء الخاص بالمحقق -->
                        <div class="investigation-section section-5">
                            <h3>
                                <i class="fas fa-user-shield"></i>
                                <span>5) الجزء الخاص بالمحقق</span>
                            </h3>
                            <div class="space-y-4">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">سلوك غير آمن</label>
                                        <select id="investigation-unsafe-behavior" class="form-input">
                                            <option value="">اختر</option>
                                            <option value="yes" ${investigationData.unsafeBehavior === 'yes' ? 'selected' : ''}>نعم</option>
                                            <option value="no" ${investigationData.unsafeBehavior === 'no' ? 'selected' : ''}>لا</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">وضع غير آمن</label>
                                        <select id="investigation-unsafe-condition" class="form-input">
                                            <option value="">اختر</option>
                                            <option value="yes" ${investigationData.unsafeCondition === 'yes' ? 'selected' : ''}>نعم</option>
                                            <option value="no" ${investigationData.unsafeCondition === 'no' ? 'selected' : ''}>لا</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <!-- مصفوفة تقييم المخاطر التفاعلية -->
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-3">
                                        <i class="fas fa-th ml-2 text-teal-600"></i>
                                        مصفوفة تقييم المخاطر - اضغط على الخلية لتحديد مستوى الخطر
                                    </label>
                                    <div class="bg-white rounded-lg p-4 border-2 border-teal-300">
                                        <div id="investigation-risk-matrix">
                                            ${typeof RiskMatrix !== 'undefined' ? RiskMatrix.generate('investigation-risk-matrix', {
                                                selectedLikelihood: investigationData.riskProbability ? parseInt(investigationData.riskProbability) : null,
                                                selectedConsequence: investigationData.riskSeverity ? parseInt(investigationData.riskSeverity) : null,
                                                interactive: true
                                            }) : `
                                                <div class="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                                    <i class="fas fa-exclamation-triangle text-4xl text-gray-400 mb-3"></i>
                                                    <p class="text-gray-600 font-semibold mb-2">مصفوفة تقييم المخاطر غير متاحة حالياً</p>
                                                    <p class="text-sm text-gray-500">يرجى التأكد من تحميل مكون RiskMatrix</p>
                                                </div>
                                            `}
                                        </div>
                                        
                                        <!-- حقول مخفية لحفظ القيم المختارة -->
                                        <input type="hidden" id="investigation-risk-probability" value="${investigationData.riskProbability || ''}">
                                        <input type="hidden" id="investigation-risk-severity" value="${investigationData.riskSeverity || ''}">
                                        <input type="hidden" id="investigation-risk-level" value="${investigationData.riskLevel || ''}">
                                    </div>
                                    
                                    ${investigationData.riskProbability && investigationData.riskSeverity ? `
                                        <script>
                                            (function() {
                                                const probability = ${investigationData.riskProbability ? parseInt(investigationData.riskProbability) : 'null'};
                                                const severity = ${investigationData.riskSeverity ? parseInt(investigationData.riskSeverity) : 'null'};
                                                setTimeout(() => {
                                                    if (typeof RiskMatrix !== 'undefined') {
                                                        const matrixContainer = document.getElementById('investigation-risk-matrix');
                                                        if (matrixContainer) {
                                                            const cells = matrixContainer.querySelectorAll('.risk-cell');
                                                            cells.forEach(cell => {
                                                                const cellLikelihood = parseInt(cell.getAttribute('data-likelihood'));
                                                                const cellConsequence = parseInt(cell.getAttribute('data-consequence'));
                                                                if (probability !== null && severity !== null &&
                                                                    cellLikelihood === probability && 
                                                                    cellConsequence === severity) {
                                                                    cell.classList.add('selected');
                                                                }
                                                            });
                                                        }
                                                    }
                                                }, 100);
                                            })();
                                        </script>
                                    ` : ''}
                                </div>

                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-chart-line ml-2 text-teal-600"></i>
                                        نتيجة التقييم (يتم التحديث تلقائياً)
                                    </label>
                                    <input type="text" id="investigation-risk-result" class="form-input" 
                                        value="${investigationData.riskResult || ''}" 
                                        readonly style="background-color: #f0fdfa; border-color: #14b8a6; font-weight: 600; font-size: 1.1rem; text-align: center;">
                                </div>

                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-comment-alt ml-2 text-teal-600"></i>
                                        شرح الخطر (يتم التحديث تلقائياً)
                                    </label>
                                    <textarea id="investigation-risk-explanation" class="form-input" rows="6" 
                                        placeholder="سيتم ملء هذا الحقل تلقائياً عند اختيار خلية من المصفوفة..."
                                        style="background-color: #f0fdfa; border-color: #14b8a6;">${Utils.escapeHTML(investigationData.riskExplanation || '')}</textarea>
                                    <p class="text-xs text-gray-500 mt-1">
                                        <i class="fas fa-info-circle ml-1"></i>
                                        يمكنك تعديل الشرح بعد التحديث التلقائي لإضافة ملاحظات إضافية
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- 6) خطة العمل -->
                        <div class="investigation-section section-6">
                            <h3>
                                <i class="fas fa-clipboard-list"></i>
                                <span>6) خطة العمل</span>
                            </h3>
                            <div class="bg-white p-4 rounded-lg border-2 border-green-300" style="width: 100%; box-sizing: border-box;">
                                <div class="table-wrapper" style="width: 100%; overflow-x: auto; overflow-y: visible; box-sizing: border-box;">
                                    <table class="data-table" style="width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 100%;">
                                        <thead>
                                            <tr style="background: linear-gradient(135deg, #388E3C 0%, #4CAF50 100%); color: white;">
                                                <th style="padding: 14px; width: 35%; text-align: right; border: 1px solid #2E7D32; box-sizing: border-box;">
                                                    <i class="fas fa-tasks ml-2"></i>
                                                    الإجراء التصحيحي
                                                </th>
                                                <th style="padding: 14px; width: 15%; text-align: center; border: 1px solid #2E7D32; box-sizing: border-box;">
                                                    <i class="fas fa-calendar-alt ml-2"></i>
                                                    التاريخ المخطط
                                                </th>
                                                <th style="padding: 14px; width: 25%; text-align: center; border: 1px solid #2E7D32; box-sizing: border-box;">
                                                    <i class="fas fa-user-check ml-2"></i>
                                                    مسئول التنفيذ
                                                </th>
                                                <th style="padding: 14px; width: 25%; text-align: center; border: 1px solid #2E7D32; box-sizing: border-box;">
                                                    <i class="fas fa-user-clock ml-2"></i>
                                                    المتابعة
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody id="investigation-action-plan-body" style="background: #f9fff9; width: 100%;">
                                            ${actionPlanRows}
                                        </tbody>
                                    </table>
                                </div>
                                <div class="mt-4 text-center" style="width: 100%; box-sizing: border-box;">
                                    <button type="button" class="btn-secondary" onclick="Incidents.addInvestigationActionPlanRow()" style="padding: 10px 24px; background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%); color: white; border: none; cursor: pointer;">
                                        <i class="fas fa-plus ml-2"></i>
                                        إضافة إجراء جديد
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- 7) التوقيعات -->
                        <div class="investigation-section section-7">
                            <h3>
                                <i class="fas fa-signature"></i>
                                <span>7) التوقيعات</span>
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">مسئول المنطقة</label>
                                    <input type="text" id="investigation-signature-area-manager" class="form-input mb-2" 
                                        value="${Utils.escapeHTML(investigationData.signatureAreaManager?.name || '')}" 
                                        placeholder="الاسم">
                                    <input type="date" id="investigation-signature-area-manager-date" class="form-input mb-2" 
                                        value="${investigationData.signatureAreaManager?.date || ''}">
                                    <div class="border border-gray-300 rounded p-2" style="min-height: 60px; background: #f9fafb;">
                                        ${investigationData.signatureAreaManager?.signature ?
                    `<img src="${investigationData.signatureAreaManager.signature}" alt="توقيع" style="max-height: 50px;">` :
                    '<span class="text-gray-400 text-sm">التوقيع</span>'}
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">مسئول السلامة والصحة</label>
                                    <input type="text" id="investigation-signature-safety-manager" class="form-input mb-2" 
                                        value="${Utils.escapeHTML(investigationData.signatureSafetyManager?.name || '')}" 
                                        placeholder="الاسم">
                                    <input type="date" id="investigation-signature-safety-manager-date" class="form-input mb-2" 
                                        value="${investigationData.signatureSafetyManager?.date || ''}">
                                    <div class="border border-gray-300 rounded p-2" style="min-height: 60px; background: #f9fafb;">
                                        ${investigationData.signatureSafetyManager?.signature ?
                    `<img src="${investigationData.signatureSafetyManager.signature}" alt="توقيع" style="max-height: 50px;">` :
                    '<span class="text-gray-400 text-sm">التوقيع</span>'}
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">مدير السلامة والصحة</label>
                                    <input type="text" id="investigation-signature-safety-director" class="form-input mb-2" 
                                        value="${Utils.escapeHTML(investigationData.signatureSafetyDirector?.name || '')}" 
                                        placeholder="الاسم">
                                    <input type="date" id="investigation-signature-safety-director-date" class="form-input mb-2" 
                                        value="${investigationData.signatureSafetyDirector?.date || ''}">
                                    <div class="border border-gray-300 rounded p-2" style="min-height: 60px; background: #f9fafb;">
                                        ${investigationData.signatureSafetyDirector?.signature ?
                    `<img src="${investigationData.signatureSafetyDirector.signature}" alt="توقيع" style="max-height: 50px;">` :
                    '<span class="text-gray-400 text-sm">التوقيع</span>'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-4 pt-4 form-actions-centered">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                                إغلاق
                            </button>
                            <button type="button" class="btn-secondary" onclick="Incidents.printInvestigation('${incidentId}')" title="طباعة التحقيق">
                                <i class="fas fa-print ml-2"></i>
                                طباعة
                            </button>
                            <button type="button" class="btn-secondary" onclick="Incidents.exportInvestigationPDF('${incidentId}')" title="تصدير PDF">
                                <i class="fas fa-file-pdf ml-2"></i>
                                تصدير PDF
                            </button>
                            <button type="submit" class="btn-primary" id="investigation-submit-btn">
                                <i class="fas fa-save ml-2"></i>
                                ${isEdit ? 'حفظ التعديلات' : 'حفظ التحقيق'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

            document.body.appendChild(modal);
            Utils.safeLog('✅ Investigation modal added to DOM');

            // التأكد من ظهور النموذج
            requestAnimationFrame(() => {
                modal.style.display = 'flex';
                modal.style.opacity = '1';
                Utils.safeLog('✅ Investigation modal displayed');
            });

            // Setup event listeners
            setTimeout(() => {
                try {
                    Utils.safeLog('🔧 Setting up investigation form listeners...');
                    this.setupInvestigationFormListeners(modal, incidentId, canEdit);
                    this.loadInvestigationFormData(incident);
                    Utils.safeLog('✅ Investigation form setup complete');
                } catch (error) {
                    Utils.safeError('خطأ في إعداد نموذج التحقيق:', error);
                    Notification.error('حدث خطأ في تحميل النموذج: ' + error.message);
                }
            }, 100);

            // إضافة event listener لإغلاق النموذج عند النقر خارج المحتوى
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    const ok = confirm('تنبيه: سيتم إغلاق النموذج.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                    if (ok) modal.remove();
                }
            });

        } catch (error) {
            Utils.safeError('خطأ في فتح نموذج التحقيق:', error);
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    // عرض قائمة لاختيار حادث للتحقيق
    showInvestigationFormSelector() {
        try {
            const incidents = AppState.appData?.incidents || [];

            if (incidents.length === 0) {
                Notification.warning('لا توجد حوادث متاحة. يرجى تسجيل حادث أولاً.');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 10000; align-items: center; justify-content: center;';

            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h2 class="modal-title">
                            <i class="fas fa-search ml-2"></i>
                            اختر حادث للتحقيق
                        </h2>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-4">
                            <input 
                                type="text" 
                                id="investigation-incident-search" 
                                class="form-input" 
                                placeholder="ابحث عن حادث بالعنوان أو الكود..."
                            >
                        </div>
                        <div class="table-wrapper" style="max-height: 400px; overflow-y: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>الكود</th>
                                        <th>العنوان</th>
                                        <th>التاريخ</th>
                                        <th>الحالة</th>
                                        <th>الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody id="investigation-incidents-list">
                                    ${incidents.map(incident => `
                                        <tr data-incident-id="${incident.id}">
                                            <td>${Utils.escapeHTML(incident.isoCode || incident.id || '')}</td>
                                            <td>${Utils.escapeHTML(incident.title || 'بدون عنوان')}</td>
                                            <td>${incident.date ? new Date(incident.date).toLocaleDateString('ar-SA') : ''}</td>
                                            <td>
                                                <span class="badge badge-${incident.status === 'مغلق' ? 'success' : incident.status === 'قيد التحقيق' ? 'warning' : 'info'}">
                                                    ${Utils.escapeHTML(incident.status || 'مفتوح')}
                                                </span>
                                            </td>
                                            <td>
                                                <button 
                                                    class="btn-primary btn-sm" 
                                                    onclick="if(typeof Incidents !== 'undefined' && typeof Incidents.showInvestigationForm === 'function') { 
                                                        Incidents.showInvestigationForm('${incident.id}'); 
                                                        this.closest('.modal-overlay').remove(); 
                                                    } else { 
                                                        alert('نموذج التحقيق غير متاح'); 
                                                    }"
                                                >
                                                    <i class="fas fa-search ml-1"></i>
                                                    التحقيق
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ${incidents.length === 0 ? '<p class="text-center text-gray-500 py-4">لا توجد حوادث متاحة</p>' : ''}
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // إضافة البحث
            const searchInput = modal.querySelector('#investigation-incident-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const searchTerm = e.target.value.toLowerCase();
                    const rows = modal.querySelectorAll('#investigation-incidents-list tr');
                    rows.forEach(row => {
                        const text = row.textContent.toLowerCase();
                        row.style.display = text.includes(searchTerm) ? '' : 'none';
                    });
                });
            }

            // إغلاق عند النقر خارج المحتوى
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });

        } catch (error) {
            Utils.safeError('خطأ في عرض قائمة الحوادث:', error);
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    renderInvestigationActionPlanRows(actionPlan) {
        if (!actionPlan || actionPlan.length === 0) {
            // إرجاع 3 صفوف فارغة
            return Array(3).fill(0).map((_, idx) => `
                <tr data-action-row="${idx}" style="border-bottom: 1px solid #c8e6c9;">
                    <td style="padding: 12px; border: 1px solid #c8e6c9; vertical-align: top; box-sizing: border-box;">
                        <textarea class="form-input" rows="3" placeholder="اكتب الإجراء التصحيحي هنا..." style="width: 100%; resize: vertical; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; min-height: 80px; box-sizing: border-box; display: block;"></textarea>
                    </td>
                    <td style="padding: 12px; border: 1px solid #c8e6c9; text-align: center; vertical-align: top; box-sizing: border-box;">
                        <input type="date" class="form-input" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; text-align: center; box-sizing: border-box; display: block;">
                    </td>
                    <td style="padding: 12px; border: 1px solid #c8e6c9; vertical-align: top; box-sizing: border-box;">
                        <input type="text" class="form-input mb-2" placeholder="اسم مسئول التنفيذ" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; box-sizing: border-box; display: block;">
                        <input type="date" class="form-input" placeholder="تاريخ التنفيذ" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; box-sizing: border-box; display: block;">
                    </td>
                    <td style="padding: 12px; border: 1px solid #c8e6c9; vertical-align: top; box-sizing: border-box;">
                        <input type="text" class="form-input mb-2" placeholder="اسم المتابع" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; box-sizing: border-box; display: block;">
                        <input type="date" class="form-input" placeholder="تاريخ المتابعة" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; box-sizing: border-box; display: block;">
                    </td>
                </tr>
            `).join('');
        }

        // ملء الصفوف الموجودة وإضافة صفوف فارغة حتى 3
        const rows = [];
        for (let i = 0; i < Math.max(3, actionPlan.length); i++) {
            const action = actionPlan[i] || {};
            rows.push(`
                <tr data-action-row="${i}" style="border-bottom: 1px solid #c8e6c9;">
                    <td style="padding: 12px; border: 1px solid #c8e6c9; vertical-align: top; box-sizing: border-box;">
                        <textarea class="form-input" rows="3" placeholder="اكتب الإجراء التصحيحي هنا..." style="width: 100%; resize: vertical; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; min-height: 80px; box-sizing: border-box; display: block;">${Utils.escapeHTML(action.correctiveAction || '')}</textarea>
                    </td>
                    <td style="padding: 12px; border: 1px solid #c8e6c9; text-align: center; vertical-align: top; box-sizing: border-box;">
                        <input type="date" class="form-input" value="${action.plannedDate || ''}" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; text-align: center; box-sizing: border-box; display: block;">
                    </td>
                    <td style="padding: 12px; border: 1px solid #c8e6c9; vertical-align: top; box-sizing: border-box;">
                        <input type="text" class="form-input mb-2" placeholder="اسم مسئول التنفيذ" value="${Utils.escapeHTML(action.responsibleName || '')}" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; box-sizing: border-box; display: block;">
                        <input type="date" class="form-input" placeholder="تاريخ التنفيذ" value="${action.responsibleDate || ''}" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; box-sizing: border-box; display: block;">
                    </td>
                    <td style="padding: 12px; border: 1px solid #c8e6c9; vertical-align: top; box-sizing: border-box;">
                        <input type="text" class="form-input mb-2" placeholder="اسم المتابع" value="${Utils.escapeHTML(action.followUpName || '')}" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; box-sizing: border-box; display: block;">
                        <input type="date" class="form-input" placeholder="تاريخ المتابعة" value="${action.followUpDate || ''}" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; box-sizing: border-box; display: block;">
                    </td>
                </tr>
            `);
        }
        return rows.join('');
    },

    async exportPDF(id) {
        const incident = AppState.appData.incidents.find(i => i.id === id);
        if (!incident) {
            Notification.error('الحادث غير موجود');
            return;
        }

        try {
            Loading.show();

            const formCode = incident.isoCode || incident.id?.substring(0, 12) || 'INCIDENT-UNKNOWN';
            const formTitle = 'تقرير الحادث';

            // جمع الصور من attachments و image (حد أقصى صورتين)
            const images = [];
            if (incident.attachments && Array.isArray(incident.attachments)) {
                incident.attachments.forEach(att => {
                    if (images.length < 2 && att && (att.type?.startsWith('image/') || att.name?.match(/\.(jpg|jpeg|png|gif)$/i))) {
                        const imgSrc = att.directLink || att.shareableLink || att.cloudLink?.url || att.data || '';
                        if (imgSrc) images.push(imgSrc);
                    }
                });
            }
            if (images.length < 2 && incident.image) {
                const imgSrc = incident.image.startsWith('http') ? incident.image : incident.image;
                if (imgSrc) images.push(imgSrc);
            }

            // بناء قسم الصور بشكل منسق (مربعات) - حد أقصى صورتين
            let imagesSection = '';
            if (images.length > 0) {
                const maxImages = Math.min(images.length, 2); // حد أقصى صورتين
                const imageContainerStyle = 'display: inline-block; width: 48%; max-width: 350px; margin: 1%; vertical-align: top; text-align: center;';
                const imageFrameStyle = 'width: 100%; height: 300px; border: 3px solid #003865; border-radius: 12px; padding: 8px; background: #f8f9fa; box-shadow: 0 4px 8px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; overflow: hidden;';
                const imageStyle = 'max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;';
                imagesSection = `
                    <div class="section-title" style="margin-top: 30px; margin-bottom: 20px; font-weight: bold; font-size: 18px; color: #003865; border-bottom: 2px solid #003865; padding-bottom: 10px;">الصور المرفقة:</div>
                    <div style="text-align: center; margin: 20px 0; direction: rtl; display: flex; flex-wrap: wrap; justify-content: center; gap: 20px;">
                        ${images.slice(0, maxImages).map((img, idx) => `
                            <div style="${imageContainerStyle}">
                                <div style="${imageFrameStyle}">
                                    <img src="${this.convertGoogleDriveLinkToPrintable(img)}" alt="صورة ${idx + 1}" style="${imageStyle}" onerror="this.parentElement.innerHTML='<div style=\\'color: #999; font-size: 14px;\\'>فشل تحميل الصورة</div>';">
                                </div>
                                <div style="margin-top: 10px; font-size: 13px; color: #555; font-weight: 600;">صورة ${idx + 1}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // بناء خطة الإجراءات
            let actionPlanSection = '';
            if (incident.actionPlan && Array.isArray(incident.actionPlan) && incident.actionPlan.length > 0) {
                const actionRows = incident.actionPlan.map(action => `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(action.actionType === 'corrective' ? 'إجراء تصحيحي' : 'إجراء وقائي')}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(action.description || '')}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(action.owner || '')}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${action.dueDate ? Utils.formatDate(action.dueDate) : ''}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${action.closedDate ? Utils.formatDate(action.closedDate) : ''}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(action.status === 'completed' ? 'تم إنجازه' : action.status === 'in_progress' ? 'تحت التنفيذ' : 'جار')}</td>
                    </tr>
                `).join('');
                actionPlanSection = `
                    <div class="section-title" style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; font-size: 16px;">خطة الإجراءات التصحيحية والوقائية:</div>
                    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                        <thead>
                            <tr style="background-color: #f5f5f5;">
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">نوع الإجراء</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">وصف الإجراء</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">المسؤول</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">تاريخ الاستحقاق</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">تاريخ الإغلاق</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${actionRows}
                        </tbody>
                    </table>
                `;
            }

            const content = `
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr><th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5; text-align: right;">كود ISO</th><td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(incident.isoCode || 'N/A')}</td></tr>
                    <tr><th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5; text-align: right;">العنوان</th><td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(incident.title || 'N/A')}</td></tr>
                    <tr><th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5; text-align: right;">الموقع</th><td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(incident.location || 'N/A')}</td></tr>
                    <tr><th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5; text-align: right;">التاريخ</th><td style="padding: 8px; border: 1px solid #ddd;">${incident.date ? Utils.formatDate(incident.date) : 'N/A'}</td></tr>
                    <tr><th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5; text-align: right;">الشدة</th><td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(incident.severity || 'N/A')}</td></tr>
                    <tr><th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5; text-align: right;">المبلغ</th><td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(incident.reportedBy || 'N/A')}</td></tr>
                    <tr><th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5; text-align: right;">الكود الوظيفي</th><td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(incident.employeeCode || incident.employeeNumber || 'N/A')}</td></tr>
                    <tr><th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5; text-align: right;">الحالة</th><td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(incident.status || 'N/A')}</td></tr>
                    ${incident.affectedName ? `<tr><th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5; text-align: right;">الطرف المتضرر</th><td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(incident.affectedName || 'N/A')}</td></tr>` : ''}
                    ${incident.incidentType ? `<tr><th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5; text-align: right;">نوع الحادث</th><td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(incident.incidentType || 'N/A')}</td></tr>` : ''}
                </table>
                <div class="section-title" style="margin-top: 20px; margin-bottom: 10px; font-weight: bold; font-size: 16px;">الوصف:</div>
                <div class="description" style="padding: 15px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 20px; white-space: pre-wrap;">${Utils.escapeHTML(incident.description || 'N/A')}</div>
                ${incident.rootCause ? `
                <div class="section-title" style="margin-top: 20px; margin-bottom: 10px; font-weight: bold; font-size: 16px;">الأسباب الجذرية:</div>
                <div class="description" style="padding: 15px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 20px; white-space: pre-wrap;">${Utils.escapeHTML(incident.rootCause || '')}</div>
                ` : ''}
                ${incident.correctiveAction ? `
                <div class="section-title" style="margin-top: 20px; margin-bottom: 10px; font-weight: bold; font-size: 16px;">الإجراءات التصحيحية الفورية:</div>
                <div class="description" style="padding: 15px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 20px; white-space: pre-wrap;">${Utils.escapeHTML(incident.correctiveAction || '')}</div>
                ` : ''}
                ${incident.preventiveAction ? `
                <div class="section-title" style="margin-top: 20px; margin-bottom: 10px; font-weight: bold; font-size: 16px;">الإجراءات الوقائية:</div>
                <div class="description" style="padding: 15px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 20px; white-space: pre-wrap;">${Utils.escapeHTML(incident.preventiveAction || '')}</div>
                ` : ''}
                ${actionPlanSection}
                ${imagesSection}
            `;

            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(formCode, formTitle, content, false, true, { version: '1.0' }, incident.createdAt, incident.updatedAt)
                : `<html><head><style>body { font-family: 'Tahoma', Arial, sans-serif; direction: rtl; text-align: right; padding: 20px; } @media print { body { margin: 0; padding: 15px; } }</style></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                            Loading.hide();
                            Notification.success('تم تجهيز التقرير للطباعة/الحفظ كـ PDF');
                        }, 1000);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error('فشل تصدير PDF: ' + error.message);
        }
    },

    // تطبيق نظام الصلاحيات
    applyPermissions() {
        const isAdmin = AppState.currentUser?.role === 'admin' ||
            (AppState.currentUser?.permissions && (
                AppState.currentUser.permissions.admin === true ||
                AppState.currentUser.permissions['manage-modules'] === true
            ));

        // إخفاء/تعطيل عناصر للمستخدمين العاديين
        if (!isAdmin) {
            // إخفاء أزرار التعديل والحذف من الجدول
            document.querySelectorAll('[onclick*="editIncident"], [onclick*="deleteIncident"]').forEach(btn => {
                btn.style.display = 'none';
            });

            // تعطيل تعديل إعدادات المواقع (يتم التحقق في Backend أيضاً)
            const locationToggleBtn = document.getElementById('incident-location-toggle');
            if (locationToggleBtn) {
                locationToggleBtn.style.display = 'none';
            }
        } else {
            // إظهار جميع العناصر للمدير
            document.querySelectorAll('[onclick*="editIncident"], [onclick*="deleteIncident"]').forEach(btn => {
                btn.style.display = '';
            });
        }

        // التحقق من صلاحيات إضافة الإجراءات
        const addActionBtn = document.getElementById('add-action-plan-row');
        if (addActionBtn) {
            const canAddActions = isAdmin ||
                (AppState.currentUser?.permissions &&
                    AppState.currentUser.permissions['incidents-add-actions'] === true);
            if (!canAddActions) {
                addActionBtn.disabled = true;
                addActionBtn.title = 'ليس لديك صلاحية لإضافة إجراءات';
            }
        }
    },

    filterIncidents(searchTerm = '', statusFilter = '') {
        const incidents = AppState.appData.incidents || [];
        let filtered = incidents;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(incident =>
                incident.title?.toLowerCase().includes(term) ||
                incident.location?.toLowerCase().includes(term) ||
                incident.reportedBy?.toLowerCase().includes(term) ||
                incident.isoCode?.toLowerCase().includes(term)
            );
        }

        if (statusFilter) {
            filtered = filtered.filter(incident => incident.status === statusFilter);
        }

        const tbody = document.querySelector('#incidents-table-container tbody');
        if (tbody) {
            tbody.innerHTML = filtered.length === 0 ?
                '<tr><td colspan="10" class="text-center text-gray-500 py-8">لا توجد نتائج</td></tr>' :
                filtered.map(incident => `
                    <tr>
                        <td>${Utils.escapeHTML(incident.title || '')}</td>
                        <td>${Utils.escapeHTML(incident.location || '')}</td>
                        <td>${incident.date ? Utils.formatDate(incident.date) : '-'}</td>
                        <td>
                            <span class="badge badge-${this.getSeverityBadgeClass(incident.severity)}">
                                ${incident.severity || '-'}
                            </span>
                        </td>
                        <td>${Utils.escapeHTML(incident.incidentType || '-')}</td>
                        <td>
                            ${Utils.escapeHTML(incident.affectedName || incident.reportedBy || '-')}
                            ${incident.affectedType ? `<div class="text-xs text-gray-500">${Utils.escapeHTML(incident.affectedType || '')}</div>` : ''}
                            ${incident.employeeCode ? `<div class="text-xs text-gray-400">${Utils.escapeHTML(incident.employeeCode || '')}</div>` : ''}
                        </td>
                        <td>
                            <span class="badge badge-${this.getStatusBadgeClass(incident.status)}">
                                ${incident.status || '-'}
                            </span>
                        </td>
                        <td>${this.renderWorkflowStatusBadge(incident)}</td>
                        <td>
                            <div class="flex items-center gap-2">
                                <button onclick="Incidents.viewIncident('${incident.id}')" class="btn-icon btn-icon-info">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button onclick="Incidents.editIncident('${incident.id}')" class="btn-icon btn-icon-primary">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="Incidents.manageWorkflow('${incident.id}')" class="btn-icon btn-icon-warning">
                                    <i class="fas fa-project-diagram"></i>
                                </button>
                                <button onclick="Incidents.deleteIncident('${incident.id}')" class="btn-icon btn-icon-danger">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
        }
    },

    setupAffectedAutocomplete(incidentData = null) {
        setTimeout(() => {
            if (typeof EmployeeHelper !== 'undefined') {
                EmployeeHelper.setupEmployeeCodeSearch('incident-affected-code', 'incident-affected-name', (employee) => {
                    if (!employee) return;
                    const nameInput = document.getElementById('incident-affected-name');
                    const jobInput = document.getElementById('incident-affected-job');
                    const deptInput = document.getElementById('incident-affected-department');
                    const contactInput = document.getElementById('incident-affected-contact');
                    const affectedTypeSelect = document.getElementById('incident-affected-type');

                    if (affectedTypeSelect) affectedTypeSelect.value = 'employee';
                    if (nameInput) nameInput.value = employee.name || employee.fullName || '';
                    if (jobInput) jobInput.value = employee.position || employee.jobTitle || '';
                    if (deptInput) deptInput.value = employee.department || employee.section || '';
                    if (contactInput) {
                        contactInput.value = employee.phone || employee.mobile || employee.email || '';
                    }
                });

                EmployeeHelper.setupAutocomplete('incident-affected-name', (employee) => {
                    if (!employee) return;
                    const codeInput = document.getElementById('incident-affected-code');
                    const jobInput = document.getElementById('incident-affected-job');
                    const deptInput = document.getElementById('incident-affected-department');
                    const contactInput = document.getElementById('incident-affected-contact');
                    const affectedTypeSelect = document.getElementById('incident-affected-type');

                    if (affectedTypeSelect) affectedTypeSelect.value = 'employee';
                    if (codeInput) codeInput.value = employee.code || '';
                    if (jobInput) jobInput.value = employee.position || employee.jobTitle || '';
                    if (deptInput) deptInput.value = employee.department || employee.section || '';
                    if (contactInput) {
                        contactInput.value = employee.phone || employee.mobile || employee.email || '';
                    }
                });
            }

            const initialType = incidentData?.affectedType || 'employee';
            this.handleAffectedTypeChange(initialType);
        }, 200);
    },

    handleAffectedTypeChange(selectedType = 'employee') {
        const codeInput = document.getElementById('incident-affected-code');
        const nameInput = document.getElementById('incident-affected-name');
        const jobInput = document.getElementById('incident-affected-job');
        const deptInput = document.getElementById('incident-affected-department');
        const contactInput = document.getElementById('incident-affected-contact');

        if (!nameInput) return;

        if (selectedType === 'employee') {
            if (codeInput) {
                codeInput.disabled = false;
                codeInput.placeholder = 'ادخل الكود الوظيفي';
            }
            nameInput.readOnly = true;
            if (jobInput) jobInput.readOnly = true;
            if (deptInput) deptInput.readOnly = true;
        } else {
            if (codeInput) {
                codeInput.disabled = true;
                codeInput.value = '';
                codeInput.placeholder = 'لا يتطلب كوداً';
            }
            nameInput.readOnly = false;
            if (jobInput) jobInput.readOnly = false;
            if (deptInput) deptInput.readOnly = false;
        }

        if (selectedType !== 'employee') {
            if (jobInput && !jobInput.value) jobInput.value = '';
            if (deptInput && !deptInput.value) deptInput.value = '';
            if (contactInput && !contactInput.value) contactInput.value = '';
        }
    },

    populateActionPlanRows(plan = []) {
        const tbody = document.getElementById('incident-action-plan-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!Array.isArray(plan) || plan.length === 0) {
            this.addActionPlanRow();
            return;
        }

        plan.forEach(item => this.addActionPlanRow(item));
    },

    addActionPlanRow(data = {}) {
        const tbody = document.getElementById('incident-action-plan-body');
        if (!tbody) return;

        const rowId = data.id || Utils.generateId('ACTPLAN');
        const tr = document.createElement('tr');
        tr.className = 'incident-action-row';
        tr.setAttribute('data-row-id', rowId);
        tr.innerHTML = `
            <td style="padding: 8px;">
                <select class="form-input" name="action-type" style="width: 100%;">
                    <option value="corrective" ${data.actionType === 'corrective' ? 'selected' : ''}>إجراء تصحيحي</option>
                    <option value="preventive" ${data.actionType === 'preventive' ? 'selected' : ''}>إجراء وقائي</option>
                </select>
            </td>
            <td style="padding: 8px;">
                <input type="text" class="form-input" name="action-description" value="${Utils.escapeHTML(data.description || '')}" placeholder="وصف الإجراء" style="width: 100%;">
            </td>
            <td style="padding: 8px;">
                <input type="text" class="form-input" name="action-owner" value="${Utils.escapeHTML(data.owner || '')}" placeholder="اسم المسؤول" style="width: 100%;">
            </td>
            <td style="padding: 8px;">
                <input type="date" class="form-input" name="action-due" value="${this.safeDateToISOString(data.dueDate, 10)}" style="width: 100%;">
            </td>
            <td style="padding: 8px;">
                <input type="date" class="form-input" name="action-closed" value="${this.safeDateToISOString(data.closedDate, 10)}" style="width: 100%;">
            </td>
            <td style="padding: 8px;">
                <select class="form-input" name="action-status" style="width: 100%;">
                    <option value="pending" ${data.status === 'pending' ? 'selected' : ''}>جار</option>
                    <option value="in_progress" ${data.status === 'in_progress' ? 'selected' : ''}>تحت التنفيذ</option>
                    <option value="completed" ${data.status === 'completed' ? 'selected' : ''}>تم إنجازه</option>
                </select>
            </td>
            <td style="padding: 8px; text-align: center;">
                <div class="flex items-center justify-center gap-2">
                    <button type="button" class="btn-icon btn-icon-primary" data-edit-action="${rowId}" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn-icon btn-icon-danger" data-remove-action="${rowId}" title="حذف">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);

        const removeBtn = tr.querySelector(`[data-remove-action="${rowId}"]`);
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeActionPlanRow(rowId));
        }

        // التأكد من أن الصف الجديد يظهر بشكل صحيح
        tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    removeActionPlanRow(rowId) {
        const tbody = document.getElementById('incident-action-plan-body');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('.incident-action-row');
        if (rows.length <= 1) {
            Notification.warning('لا يمكن حذف الصف الأخير من خطة الإجراءات.');
            return;
        }

        const row = tbody.querySelector(`.incident-action-row[data-row-id="${rowId}"]`);
        if (row) {
            row.remove();
        }
    },

    collectActionPlanRows() {
        const rows = Array.from(document.querySelectorAll('#incident-action-plan-body .incident-action-row'));
        return rows.map(row => {
            const id = row.getAttribute('data-row-id') || Utils.generateId('ACTPLAN');
            const type = row.querySelector('[name="action-type"]')?.value || 'corrective';
            const description = row.querySelector('[name="action-description"]')?.value?.trim() || '';
            const owner = row.querySelector('[name="action-owner"]')?.value?.trim() || '';
            const dueDate = row.querySelector('[name="action-due"]')?.value || '';
            const closedDate = row.querySelector('[name="action-closed"]')?.value || '';
            const status = row.querySelector('[name="action-status"]')?.value || 'pending';

            return {
                id,
                actionType: type,
                description,
                owner,
                dueDate: dueDate ? this.safeDateToISOString(dueDate) || null : null,
                closedDate: closedDate ? this.safeDateToISOString(closedDate) || null : null,
                status,
                updatedAt: new Date().toISOString()
            };
        }).filter(item => item.description || item.owner || item.dueDate);
    },

    async handleAttachmentsChange(fileList) {
        if (!fileList || fileList.length === 0) return;

        const files = Array.from(fileList);
        const validFiles = [];

        for (const file of files) {
            if (file.size > 5 * 1024 * 1024) {
                Notification.error(`الملف ${file.name} يتجاوز الحد الأقصى (5MB)`);
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length === 0) {
            return;
        }

        Loading.show('جاري معالجة المرفقات...');
        try {
            for (const file of validFiles) {
                const base64 = await this.readFileAsBase64(file);
                const attachment = this.normalizeAttachment({
                    id: Utils.generateId('ATT'),
                    name: file.name,
                    type: file.type,
                    data: base64,
                    size: Math.round(file.size / 1024)
                });
                this.currentAttachments.push(attachment);
            }
            this.renderAttachmentsList();
            const input = document.getElementById('incident-attachments-input');
            if (input) input.value = '';
        } catch (error) {
            Notification.error('فشل تحميل المرفقات: ' + error.message);
        } finally {
            Loading.hide();
        }
    },

    async readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    },

    normalizeAttachment(attachment) {
        if (!attachment) return null;
        const data = attachment.data || attachment.base64 || '';
        const size = attachment.size || (data ? Math.round((data.length * 3) / 4 / 1024) : 0);
        return {
            id: attachment.id || Utils.generateId('ATT'),
            name: attachment.name || 'attachment',
            type: attachment.type || 'application/octet-stream',
            data,
            size,
            createdAt: attachment.createdAt || new Date().toISOString()
        };
    },

    renderCloudStorageUploadButtons(prefix) {
        const availableServices = CloudStorageIntegration?.getAvailableServices() || [];
        if (availableServices.length === 0) {
            return '';
        }

        return `
            <div class="mt-3 mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                <label class="block text-xs font-semibold text-gray-700 mb-2">
                    <i class="fas fa-cloud ml-1"></i>
                    رفع إلى التخزين السحابي
                </label>
                <div class="flex items-center gap-2 flex-wrap">
                    ${availableServices.map(service => `
                        <button type="button" 
                                class="btn-secondary text-xs px-2 py-1" 
                                id="${prefix}-cloud-upload-${service}"
                                data-service="${service}"
                                title="رفع إلى ${CloudStorageIntegration.getServiceName(service)}">
                            <i class="fas fa-cloud-upload-alt ml-1"></i>
                            ${CloudStorageIntegration.getServiceName(service)}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    },

    async handleCloudUpload(prefix, service) {
        const input = document.getElementById(`${prefix}-attachments-input`);
        if (!input || !input.files || input.files.length === 0) {
            Notification.warning('يرجى اختيار ملف أولاً');
            return;
        }

        const file = input.files[0];
        try {
            const result = await CloudStorageIntegration.uploadFile(service, file, file.name);

            // Add cloud link to attachments
            const attachment = {
                id: Utils.generateId('ATT'),
                name: file.name,
                type: file.type,
                size: Math.round(file.size / 1024),
                cloudLink: {
                    id: result.id,
                    url: result.url,
                    service: result.service,
                    fileName: result.fileName,
                    uploadedAt: result.uploadedAt
                },
                isCloud: true,
                createdAt: new Date().toISOString()
            };

            if (!this.currentAttachments) {
                this.currentAttachments = [];
            }
            this.currentAttachments.push(attachment);
            this.renderAttachmentsList();
            input.value = '';

            Notification.success(`تم رفع الملف إلى ${CloudStorageIntegration.getServiceName(service)} بنجاح`);
        } catch (error) {
            Utils.safeError('Cloud upload error:', error);
            Notification.error(error.message || 'فشل رفع الملف إلى السحابة');
        }
    },

    renderAttachmentsList() {
        const container = document.getElementById('incident-attachments-list');
        if (!container) return;

        if (!this.currentAttachments || this.currentAttachments.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500">لا توجد مرفقات مضافة.</p>';
            return;
        }

        container.innerHTML = this.currentAttachments.map((attachment, index) => {
            const isCloud = attachment.cloudLink || attachment.isCloud;
            const cloudBadge = isCloud ? `
                <span class="badge badge-info text-xs">
                    <i class="fas fa-cloud ml-1"></i>
                    ${CloudStorageIntegration?.getServiceName(attachment.cloudLink?.service) || 'سحابي'}
                </span>
            ` : '';

            return `
                <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2" data-attachment-index="${index}">
                    <div class="flex items-center gap-2">
                        <i class="fas ${isCloud ? 'fa-cloud' : 'fa-paperclip'} text-blue-500"></i>
                        <div>
                            <div class="flex items-center gap-2">
                                <div class="text-sm font-medium text-gray-700">${Utils.escapeHTML(attachment.name || 'attachment')}</div>
                                ${cloudBadge}
                            </div>
                            <div class="text-xs text-gray-500">
                                ${attachment.size || 0} KB
                                ${isCloud && attachment.cloudLink?.url ? `
                                    <a href="${attachment.cloudLink.url}" target="_blank" class="text-blue-600 hover:underline mr-2">
                                        <i class="fas fa-external-link-alt ml-1"></i>فتح
                                    </a>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${isCloud ? `
                            <button type="button" class="btn-icon btn-icon-info" title="تحميل من السحابة" data-attachment-cloud-download="${index}">
                                <i class="fas fa-cloud-download-alt"></i>
                            </button>
                        ` : ''}
                        <button type="button" class="btn-icon btn-icon-success" title="تحميل" data-attachment-download="${index}">
                            <i class="fas fa-download"></i>
                        </button>
                        <button type="button" class="btn-icon btn-icon-danger" title="حذف" data-attachment-remove="${index}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('[data-attachment-remove]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-attachment-remove'), 10);
                this.removeAttachment(idx);
            });
        });

        container.querySelectorAll('[data-attachment-download]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-attachment-download'), 10);
                this.downloadAttachment(idx);
            });
        });

        container.querySelectorAll('[data-attachment-cloud-download]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const idx = parseInt(btn.getAttribute('data-attachment-cloud-download'), 10);
                const attachment = this.currentAttachments?.[idx];
                if (attachment && attachment.cloudLink) {
                    try {
                        await CloudStorageIntegration.downloadFile(attachment.cloudLink);
                        Notification.success('تم تحميل الملف بنجاح');
                    } catch (error) {
                        Notification.error(error.message || 'فشل تحميل الملف من السحابة');
                    }
                }
            });
        });
    },

    removeAttachment(index) {
        if (!this.currentAttachments) return;
        this.currentAttachments.splice(index, 1);
        this.renderAttachmentsList();
    },

    downloadAttachment(index) {
        const attachment = this.currentAttachments?.[index];
        if (!attachment || !attachment.data) return;

        const link = document.createElement('a');
        link.href = attachment.data;
        link.download = attachment.name || `attachment-${index + 1}`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => link.remove(), 0);
    },

    // الحصول على قائمة المواقع من الإعدادات
    getSiteOptions() {
        try {
            // محاولة الحصول من Permissions.formSettingsState
            if (typeof Permissions !== 'undefined' && Permissions.formSettingsState && Permissions.formSettingsState.sites) {
                return Permissions.formSettingsState.sites.map(site => ({
                    id: site.id,
                    name: site.name
                }));
            }

            // محاولة الحصول من AppState.appData.observationSites
            if (Array.isArray(AppState.appData?.observationSites) && AppState.appData.observationSites.length > 0) {
                return AppState.appData.observationSites.map(site => ({
                    id: site.id || site.siteId || Utils.generateId('SITE'),
                    name: site.name || site.title || site.label || 'موقع غير محدد'
                }));
            }

            // محاولة الحصول من DailyObservations
            if (typeof DailyObservations !== 'undefined' && Array.isArray(DailyObservations.DEFAULT_SITES)) {
                return DailyObservations.DEFAULT_SITES.map((site, index) => ({
                    id: site.id || site.siteId || Utils.generateId('SITE'),
                    name: site.name || site.title || site.label || `موقع ${index + 1}`
                }));
            }

            return [];
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في الحصول على قائمة المواقع:', error);
            return [];
        }
    },

    refreshSiteDropdowns() {
        try {
            var sites = this.getSiteOptions();
            var esc = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML : function(s) { return String(s == null ? '' : s); };
            var opts = '<option value="">اختر الموقع</option>' + (sites || []).map(function(s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
            var loc = document.getElementById('incident-location');
            if (loc && loc.tagName === 'SELECT') { var v = loc.value; loc.innerHTML = opts; if (v) loc.value = v; }
            var sub = document.getElementById('incident-sublocation');
            if (sub && sub.tagName === 'SELECT') {
                var locId = (document.getElementById('incident-location') || {}).value;
                var places = this.getPlaceOptions(locId);
                sub.innerHTML = '<option value="">اختر المكان الفرعي</option>' + (places || []).map(function(p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');
            }
        } catch (e) { if (typeof Utils !== 'undefined' && Utils.safeWarn) Utils.safeWarn('⚠️ Incidents.refreshSiteDropdowns:', e); }
    },

    // الحصول على قائمة الأماكن الفرعية لموقع محدد
    getPlaceOptions(siteId) {
        try {
            if (!siteId) return [];

            const sites = this.getSiteOptions();
            const selectedSite = sites.find(s => s.id === siteId);
            if (!selectedSite) return [];

            // محاولة الحصول من Permissions.formSettingsState
            if (typeof Permissions !== 'undefined' && Permissions.formSettingsState && Permissions.formSettingsState.sites) {
                const site = Permissions.formSettingsState.sites.find(s => s.id === siteId);
                if (site && Array.isArray(site.places)) {
                    return site.places.map(place => ({
                        id: place.id,
                        name: place.name
                    }));
                }
            }

            // محاولة الحصول من AppState.appData.observationSites
            if (Array.isArray(AppState.appData?.observationSites)) {
                const site = AppState.appData.observationSites.find(s => (s.id || s.siteId) === siteId);
                if (site) {
                    const placesSource = Array.isArray(site.places)
                        ? site.places
                        : Array.isArray(site.locations)
                            ? site.locations
                            : Array.isArray(site.children)
                                ? site.children
                                : Array.isArray(site.areas)
                                    ? site.areas
                                    : [];
                    return placesSource.map((place, idx) => ({
                        id: place.id || place.placeId || place.value || Utils.generateId('PLACE'),
                        name: place.name || place.placeName || place.title || place.label || place.locationName || `مكان ${idx + 1}`
                    }));
                }
            }

            // محاولة الحصول من DailyObservations
            if (typeof DailyObservations !== 'undefined' && Array.isArray(DailyObservations.DEFAULT_SITES)) {
                const site = DailyObservations.DEFAULT_SITES.find(s => (s.id || s.siteId) === siteId);
                if (site) {
                    const placesSource = Array.isArray(site.places)
                        ? site.places
                        : Array.isArray(site.locations)
                            ? site.locations
                            : Array.isArray(site.children)
                                ? site.children
                                : Array.isArray(site.areas)
                                    ? site.areas
                                    : [];
                    return placesSource.map((place, idx) => ({
                        id: place.id || place.placeId || place.value || Utils.generateId('PLACE'),
                        name: place.name || place.placeName || place.title || place.label || place.locationName || `مكان ${idx + 1}`
                    }));
                }
            }

            return [];
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في الحصول على قائمة الأماكن:', error);
            return [];
        }
    },

    setupInvestigationFormListeners(modal, incidentId, canEdit = true) {
        const self = this;

        // Form submit
        const form = modal.querySelector('#investigation-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!canEdit) {
                    Notification.warning('ليس لديك صلاحية لتعديل التحقيق. يجب أن تكون مسئول السلامة مع صلاحية "استكمال التحقيق" أو مدير النظام.');
                    return;
                }
                this.handleInvestigationSubmit(incidentId);
            });

            // تعطيل الحقول إذا لم يكن للمستخدم صلاحية التعديل
            if (!canEdit) {
                const inputs = form.querySelectorAll('input, textarea, select, button[type="submit"]');
                inputs.forEach(input => {
                    if (input.type !== 'button' && input.id !== 'investigation-number') {
                        input.disabled = true;
                    }
                });
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
        }

        // Toggle near miss description
        const nearMissCheckbox = modal.querySelector('#incident-type-nearmiss');
        const nearMissWrapper = modal.querySelector('#nearmiss-description-wrapper');
        if (nearMissCheckbox && nearMissWrapper) {
            nearMissCheckbox.addEventListener('change', (e) => {
                nearMissWrapper.style.display = e.target.checked ? 'block' : 'none';
            });
            // Set initial state
            nearMissWrapper.style.display = nearMissCheckbox.checked ? 'block' : 'none';
        }

        // Risk level calculation
        const riskProbability = modal.querySelector('#investigation-risk-probability');
        const riskSeverity = modal.querySelector('#investigation-risk-severity');
        const riskLevel = modal.querySelector('#investigation-risk-level');

        const calculateRiskLevel = () => {
            const prob = parseInt(riskProbability?.value || 0);
            const sev = parseInt(riskSeverity?.value || 0);
            if (prob > 0 && sev > 0) {
                const level = prob * sev;
                if (riskLevel) {
                    riskLevel.value = level.toString();
                }
            } else if (riskLevel) {
                riskLevel.value = '';
            }
        };

        if (riskProbability) riskProbability.addEventListener('change', calculateRiskLevel);
        if (riskSeverity) riskSeverity.addEventListener('change', calculateRiskLevel);

        // Load factory and location options
        this.loadInvestigationFormOptions(modal);
    },

    async loadInvestigationFormOptions(modal) {
        const factorySelect = modal.querySelector('#investigation-factory');
        const locationSelect = modal.querySelector('#investigation-location');

        // Load factories (using sites as factories) - إزالة التكرارات
        if (factorySelect) {
            const sites = this.getSiteOptions();
            const seenFactoryIds = new Set();
            const seenFactoryNames = new Set();

            // إزالة الخيارات الموجودة مسبقاً (باستثناء الخيار الافتراضي)
            const defaultOption = factorySelect.querySelector('option[value=""]');
            factorySelect.innerHTML = '';
            if (defaultOption) {
                factorySelect.appendChild(defaultOption);
            }

            sites.forEach(site => {
                // التحقق من عدم تكرار ID أو الاسم
                if (!site.id || seenFactoryIds.has(site.id)) {
                    return; // تخطي إذا كان ID مكرر
                }
                if (site.name && seenFactoryNames.has(site.name.trim())) {
                    return; // تخطي إذا كان الاسم مكرر
                }

                seenFactoryIds.add(site.id);
                if (site.name) {
                    seenFactoryNames.add(site.name.trim());
                }

                const option = document.createElement('option');
                option.value = site.id;
                option.textContent = site.name || site.id;
                factorySelect.appendChild(option);
            });
        }

        // إعداد فلترة المواقع الفرعية حسب المصنع المحدد
        if (factorySelect && locationSelect) {
            const updateLocationOptions = () => {
                const selectedFactoryId = factorySelect.value;
                const currentLocationValue = locationSelect.value;

                // إزالة جميع الخيارات الحالية (باستثناء الخيار الافتراضي)
                const defaultLocationOption = locationSelect.querySelector('option[value=""]');
                locationSelect.innerHTML = '';
                if (defaultLocationOption) {
                    locationSelect.appendChild(defaultLocationOption);
                }

                if (selectedFactoryId) {
                    const places = this.getPlaceOptions(selectedFactoryId);
                    const seenLocationIds = new Set();
                    const seenLocationNames = new Set();

                    places.forEach(place => {
                        // التحقق من عدم تكرار ID أو الاسم
                        if (!place.id || seenLocationIds.has(place.id)) {
                            return; // تخطي إذا كان ID مكرر
                        }
                        if (place.name && seenLocationNames.has(place.name.trim())) {
                            return; // تخطي إذا كان الاسم مكرر
                        }

                        seenLocationIds.add(place.id);
                        if (place.name) {
                            seenLocationNames.add(place.name.trim());
                        }

                        const option = document.createElement('option');
                        option.value = place.id;
                        option.textContent = place.name || place.id;
                        locationSelect.appendChild(option);
                    });

                    // استعادة القيمة المحددة إذا كانت موجودة
                    if (currentLocationValue && locationSelect.querySelector(`option[value="${currentLocationValue}"]`)) {
                        locationSelect.value = currentLocationValue;
                    }
                }
            };

            // إضافة مستمع لتغيير المصنع
            factorySelect.addEventListener('change', updateLocationOptions);

            // تحديث المواقع الفرعية عند التحميل الأولي
            updateLocationOptions();
        } else if (locationSelect) {
            // إذا لم يكن هناك حقل مصنع، قم بتحميل جميع المواقع مع إزالة التكرارات
            const sites = this.getSiteOptions();
            const seenLocationIds = new Set();
            const seenLocationNames = new Set();

            // إزالة الخيارات الموجودة مسبقاً (باستثناء الخيار الافتراضي)
            const defaultLocationOption = locationSelect.querySelector('option[value=""]');
            locationSelect.innerHTML = '';
            if (defaultLocationOption) {
                locationSelect.appendChild(defaultLocationOption);
            }

            sites.forEach(site => {
                const places = this.getPlaceOptions(site.id);
                places.forEach(place => {
                    // التحقق من عدم تكرار ID أو الاسم
                    if (!place.id || seenLocationIds.has(place.id)) {
                        return; // تخطي إذا كان ID مكرر
                    }
                    if (place.name && seenLocationNames.has(place.name.trim())) {
                        return; // تخطي إذا كان الاسم مكرر
                    }

                    seenLocationIds.add(place.id);
                    if (place.name) {
                        seenLocationNames.add(place.name.trim());
                    }

                    const option = document.createElement('option');
                    option.value = place.id;
                    option.textContent = `${site.name} - ${place.name}`;
                    locationSelect.appendChild(option);
                });
            });
        }
    },

    loadInvestigationFormData(incident) {
        // Load data from incident if available
        setTimeout(() => {
            // معالجة investigation - تحويل من JSON string إلى object إذا لزم الأمر
            let investigation = incident.investigation;
            if (investigation && typeof investigation === 'string') {
                try {
                    investigation = JSON.parse(investigation);
                } catch (e) {
                    Utils.safeWarn('خطأ في تحليل investigation:', e);
                    investigation = {};
                }
            }

            if (investigation) {
                const inv = investigation;

                // Set factory and location if available
                if (inv.factoryId) {
                    const factorySelect = document.querySelector('#investigation-factory');
                    if (factorySelect) {
                        // التحقق من وجود الخيار في القائمة
                        const matchingOption = Array.from(factorySelect.options).find(opt => opt.value === inv.factoryId);
                        if (matchingOption) {
                            factorySelect.value = inv.factoryId;
                            // Trigger change event to update dependent fields (location options)
                            factorySelect.dispatchEvent(new Event('change', { bubbles: true }));

                            // انتظار قليل لضمان تحديث خيارات الموقع الفرعي
                            setTimeout(() => {
                                if (inv.locationId) {
                                    const locationSelect = document.querySelector('#investigation-location');
                                    if (locationSelect) {
                                        // البحث عن الخيار المطابق في القائمة المحدثة
                                        const locationOption = Array.from(locationSelect.options).find(opt => opt.value === inv.locationId);
                                        if (locationOption) {
                                            locationSelect.value = inv.locationId;
                                        }
                                    }
                                }
                            }, 100);
                        }
                    }
                } else if (inv.locationId) {
                    // إذا لم يكن هناك factoryId، حاول تعيين الموقع مباشرة
                    const locationSelect = document.querySelector('#investigation-location');
                    if (locationSelect) {
                        const locationOption = Array.from(locationSelect.options).find(opt => opt.value === inv.locationId);
                        if (locationOption) {
                            locationSelect.value = inv.locationId;
                        }
                    }
                }
            } else if (incident.siteId) {
                // If no investigation data, try to pre-fill from incident data
                const factorySelect = document.querySelector('#investigation-factory');
                const locationSelect = document.querySelector('#investigation-location');

                if (factorySelect && incident.siteId) {
                    // البحث عن الخيار المطابق في القائمة (بدون تكرار)
                    const matchingOption = Array.from(factorySelect.options).find(opt =>
                        opt.value === incident.siteId ||
                        (incident.siteName && opt.text.trim() === incident.siteName.trim()) ||
                        (incident.location && opt.text.trim() === incident.location.trim())
                    );
                    if (matchingOption) {
                        factorySelect.value = matchingOption.value;
                        // Trigger change event to update location options
                        factorySelect.dispatchEvent(new Event('change', { bubbles: true }));

                        // انتظار قليل لضمان تحديث خيارات الموقع الفرعي
                        setTimeout(() => {
                            if (locationSelect && incident.sublocationId) {
                                // البحث عن الخيار المطابق في القائمة المحدثة (بدون تكرار)
                                const locationMatchingOption = Array.from(locationSelect.options).find(opt =>
                                    opt.value === incident.sublocationId ||
                                    (incident.sublocationName && opt.text.trim() === incident.sublocationName.trim()) ||
                                    (incident.sublocation && opt.text.trim() === incident.sublocation.trim())
                                );
                                if (locationMatchingOption) {
                                    locationSelect.value = locationMatchingOption.value;
                                }
                            }
                        }, 100);
                    }
                } else if (locationSelect && incident.sublocationId) {
                    // إذا لم يكن هناك factorySelect، حاول تعيين الموقع مباشرة
                    const locationMatchingOption = Array.from(locationSelect.options).find(opt =>
                        opt.value === incident.sublocationId ||
                        (incident.sublocationName && opt.text.trim() === incident.sublocationName.trim()) ||
                        (incident.sublocation && opt.text.trim() === incident.sublocation.trim())
                    );
                    if (locationMatchingOption) {
                        locationSelect.value = locationMatchingOption.value;
                    }
                }
            }

            // Load affiliation from notification if available
            if (investigation) {
                const inv = investigation;
                const affectedAffiliationEl = document.querySelector('#investigation-affected-affiliation');
                if (affectedAffiliationEl) {
                    if (inv.affectedAffiliation) {
                        affectedAffiliationEl.value = inv.affectedAffiliation;
                    } else if (incident.affiliation) {
                        // Link affiliation from notification to investigation
                        affectedAffiliationEl.value = incident.affiliation;
                    }
                }
            } else if (incident.affiliation) {
                // If no investigation data, load affiliation from incident
                const affectedAffiliationEl = document.querySelector('#investigation-affected-affiliation');
                if (affectedAffiliationEl) {
                    affectedAffiliationEl.value = incident.affiliation;
                }
            }
        }, 300);
    },

    async handleInvestigationSubmit(incidentId) {
        const modal = document.querySelector('.modal-overlay');
        if (!modal) return;
        if (this._investigationSubmitting) return;

        // فحص العناصر قبل الاستخدام
        const investigationNumberEl = document.getElementById('investigation-number');
        const investigationDateTimeEl = document.getElementById('investigation-datetime');
        const incidentDateTimeEl = document.getElementById('incident-datetime');
        const factoryEl = document.getElementById('investigation-factory');
        const locationEl = document.getElementById('investigation-location');
        const descriptionEl = document.getElementById('investigation-description');
        const nearmissDescriptionEl = document.getElementById('investigation-nearmiss-description');
        const affectedAffiliationEl = document.getElementById('investigation-affected-affiliation');
        const affectedNameEl = document.getElementById('investigation-affected-name');
        const affectedJobEl = document.getElementById('investigation-affected-job');
        const affectedAgeEl = document.getElementById('investigation-affected-age');
        const affectedDepartmentEl = document.getElementById('investigation-affected-department');
        const unsafeBehaviorEl = document.getElementById('investigation-unsafe-behavior');
        const unsafeConditionEl = document.getElementById('investigation-unsafe-condition');
        const riskProbabilityEl = document.getElementById('investigation-risk-probability');
        const riskSeverityEl = document.getElementById('investigation-risk-severity');
        const riskLevelEl = document.getElementById('investigation-risk-level');
        const riskResultEl = document.getElementById('investigation-risk-result');
        const riskExplanationEl = document.getElementById('investigation-risk-explanation');
        const signatureAreaManagerEl = document.getElementById('investigation-signature-area-manager');
        const signatureAreaManagerDateEl = document.getElementById('investigation-signature-area-manager-date');
        const signatureSafetyManagerEl = document.getElementById('investigation-signature-safety-manager');
        const signatureSafetyManagerDateEl = document.getElementById('investigation-signature-safety-manager-date');
        const signatureSafetyDirectorEl = document.getElementById('investigation-signature-safety-director');
        const signatureSafetyDirectorDateEl = document.getElementById('investigation-signature-safety-director-date');

        if (!investigationNumberEl || !investigationDateTimeEl || !incidentDateTimeEl || !factoryEl ||
            !locationEl || !descriptionEl || !affectedAffiliationEl || !affectedNameEl ||
            !affectedJobEl || !affectedAgeEl || !affectedDepartmentEl || !unsafeBehaviorEl ||
            !unsafeConditionEl || !riskProbabilityEl || !riskSeverityEl || !riskLevelEl ||
            !riskResultEl || !riskExplanationEl || !signatureAreaManagerEl || !signatureAreaManagerDateEl ||
            !signatureSafetyManagerEl || !signatureSafetyManagerDateEl) {
            Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
            return;
        }

        // Collect form data
        // ✅ إصلاح: تحويل datetime-local إلى ISO بشكل صحيح
        const investigationData = {
            investigationNumber: investigationNumberEl.value,
            investigationDateTime: Utils.dateTimeLocalToISO(investigationDateTimeEl.value) || investigationDateTimeEl.value,
            incidentDateTime: Utils.dateTimeLocalToISO(incidentDateTimeEl.value) || incidentDateTimeEl.value,
            factoryId: factoryEl.value,
            factoryName: factoryEl.options[factoryEl.selectedIndex]?.text || '',
            locationId: locationEl.value,
            locationName: locationEl.options[locationEl.selectedIndex]?.text || '',

            // Incident types
            incidentTypes: [],

            // Description
            description: descriptionEl.value,
            nearmissDescription: nearmissDescriptionEl?.value || '',

            // Affected person
            affectedAffiliation: affectedAffiliationEl.value,
            affectedName: affectedNameEl.value,
            affectedJob: affectedJobEl.value,
            affectedAge: affectedAgeEl.value,
            affectedDepartment: affectedDepartmentEl.value,

            // Investigator section
            unsafeBehavior: unsafeBehaviorEl.value,
            unsafeCondition: unsafeConditionEl.value,
            riskProbability: parseInt(riskProbabilityEl.value) || 0,
            riskSeverity: parseInt(riskSeverityEl.value) || 0,
            riskLevel: riskLevelEl.value,
            riskResult: riskResultEl.value,
            riskExplanation: riskExplanationEl.value,

            // Action plan
            actionPlan: this.collectInvestigationActionPlan(),

            // Signatures
            signatureAreaManager: {
                name: signatureAreaManagerEl.value,
                date: signatureAreaManagerDateEl.value,
                signature: '' // Note: Signature capture feature can be added in future updates
            },
            signatureSafetyManager: {
                name: signatureSafetyManagerEl.value,
                date: signatureSafetyManagerDateEl.value,
                signature: '' // Note: Signature capture feature can be added in future updates
            },
            signatureSafetyDirector: {
                name: signatureSafetyDirectorEl?.value || '',
                date: signatureSafetyDirectorDateEl?.value || '',
                signature: '' // Note: Signature capture feature can be added in future updates
            },

            updatedAt: new Date().toISOString(),
            updatedBy: AppState.currentUser ? {
                id: AppState.currentUser.id || '',
                name: AppState.currentUser.name || AppState.currentUser.displayName || '',
                email: AppState.currentUser.email || ''
            } : null
        };

        // Collect incident types
        if (document.getElementById('incident-type-nearmiss')?.checked) investigationData.incidentTypes.push('nearmiss');
        if (document.getElementById('incident-type-property')?.checked) investigationData.incidentTypes.push('property');
        if (document.getElementById('incident-type-injury-no-lost')?.checked) investigationData.incidentTypes.push('injury-no-lost');
        if (document.getElementById('incident-type-injury-lost')?.checked) investigationData.incidentTypes.push('injury-lost');
        if (document.getElementById('incident-type-fatality')?.checked) investigationData.incidentTypes.push('fatality');

        // Validation
        if (!investigationData.investigationDateTime || !investigationData.incidentDateTime ||
            !investigationData.factoryId || !investigationData.locationId || !investigationData.description) {
            Notification.error('يرجى ملء جميع الحقول المطلوبة');
            return;
        }

        Loading.show('جاري حفظ التحقيق...');
        try {
            this._investigationSubmitting = true;
            // Update incident with investigation data
            const incident = AppState.appData.incidents.find(i => i.id === incidentId);
            if (incident) {
                // معالجة investigation القديم - تحويل من JSON string إلى object إذا لزم الأمر
                if (incident.investigation && typeof incident.investigation === 'string') {
                    try {
                        incident.investigation = JSON.parse(incident.investigation);
                    } catch (e) {
                        Utils.safeWarn('خطأ في تحليل investigation القديم:', e);
                        incident.investigation = {};
                    }
                }

                // دمج بيانات التحقيق الجديدة مع القديمة (إن وجدت)
                incident.investigation = { ...(incident.investigation || {}), ...investigationData };
                incident.updatedAt = new Date().toISOString();

                // التحقق من صلاحيات المستخدم
                const isAdmin = AppState.currentUser?.role === 'admin' ||
                    (AppState.currentUser?.permissions && (
                        AppState.currentUser.permissions.admin === true ||
                        AppState.currentUser.permissions['manage-modules'] === true
                    ));

                // التحقق من صلاحية مسئول السلامة
                const isSafetyOfficer = AppState.currentUser?.role === 'safety_officer' ||
                    (AppState.currentUser?.permissions &&
                        AppState.currentUser.permissions['incidents-complete-investigation'] === true);

                // تحديث حالة الحادث:
                // - إذا كان مدير النظام: يبقى "قيد التحقيق" أو الحالة الحالية
                // - إذا كان مسئول السلامة: يبقى "قيد التحقيق" (حالة تحتاج موافقة)
                if (!isAdmin && isSafetyOfficer) {
                    // مسئول السلامة: الحادث يحتاج موافقة مدير النظام
                    incident.status = 'قيد التحقيق';
                    incident.requiresApproval = true;
                    incident.approvedBy = null;
                } else if (isAdmin) {
                    // مدير النظام: يمكنه الموافقة مباشرة
                    if (incident.status !== 'قيد التحقيق' && incident.status !== 'مغلق') {
                        incident.status = 'قيد التحقيق';
                    }
                    incident.requiresApproval = false;
                } else {
                    // حالة افتراضية
                    if (incident.status !== 'قيد التحقيق') {
                        incident.status = 'قيد التحقيق';
                    }
                }

                // Save data
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                Loading.hide();
                
                // رسالة مختلفة حسب نوع المستخدم
                if (!isAdmin && isSafetyOfficer) {
                    Notification.success('تم حفظ التحقيق بنجاح. سيتم مراجعته من قبل مدير النظام للموافقة.');
                } else {
                    Notification.success('تم حفظ التحقيق بنجاح');
                }
                
                modal.remove();

                // Refresh list if visible
                if (document.getElementById('incidents-content')) {
                    this.loadIncidentsList();
                }

                // مزامنة في الخلفية بدون تعطيل واجهة المستخدم
                const safeIncidentDateIso = (this.getIncidentDateValue(incident) || new Date()).toISOString();
                const updatePayload = {
                    // بيانات الحادث الأساسية (مطلوبة في حالة عدم وجود الحادث في Google Sheets)
                    id: incident.id,
                    title: incident.title || 'حادث بدون عنوان',
                    description: incident.description || '',
                    date: safeIncidentDateIso,
                    status: incident.status,
                    severity: incident.severity || 'متوسطة',
                    location: incident.location || '',
                    siteId: incident.siteId || '',
                    siteName: incident.siteName || '',
                    sublocationId: incident.sublocationId || '',
                    sublocationName: incident.sublocationName || '',
                    // بيانات التحقيق
                    investigation: investigationData,
                    // بيانات إضافية
                    updatedAt: incident.updatedAt,
                    createdAt: incident.createdAt || new Date().toISOString(),
                    requiresApproval: incident.requiresApproval || false,
                    approvedBy: incident.approvedBy || null,
                    approvedAt: incident.approvedAt || null,
                    createdBy: incident.createdBy || (AppState.currentUser ? {
                        id: AppState.currentUser.id || '',
                        name: AppState.currentUser.name || AppState.currentUser.displayName || '',
                        email: AppState.currentUser.email || ''
                    } : null),
                    userData: AppState.currentUser ? {
                        id: AppState.currentUser.id || '',
                        name: AppState.currentUser.name || AppState.currentUser.displayName || '',
                        email: AppState.currentUser.email || '',
                        role: AppState.currentUser.role || '',
                        permissions: AppState.currentUser.permissions || {}
                    } : null
                };

                setTimeout(() => {
                    try {
                        if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                            GoogleIntegration.autoSave('Incidents', AppState.appData.incidents).catch((err) => {
                                Utils.safeWarn('⚠️ فشل autoSave للحوادث في الخلفية:', err);
                            });
                        }
                    } catch (e) {
                        Utils.safeWarn('⚠️ خطأ أثناء autoSave للحوادث:', e);
                    }

                    try {
                        if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                            GoogleIntegration.sendRequest({
                                action: 'updateIncident',
                                data: { incidentId: incidentId, updateData: updatePayload }
                            }).catch((err) => {
                                Utils.safeWarn('⚠️ فشل تحديث الحادث في الخلفية (Backend):', err);
                            });
                        }
                    } catch (e) {
                        Utils.safeWarn('⚠️ خطأ أثناء تحديث الحادث في الخلفية (Backend):', e);
                    }

                    this.updateRegistryEntry(incident).catch((err) => {
                        Utils.safeWarn('⚠️ فشل تحديث سجل الحوادث في الخلفية:', err);
                    });

                    // Refresh approvals tab if currently open
                    if (this.currentTab === 'approvals') {
                        (async () => {
                            try {
                                const container = document.getElementById('incidents-tab-content');
                                if (container) {
                                    container.innerHTML = await this.renderApprovalsTab();
                                    this.setupTabEventListeners('approvals');
                                }
                            } catch (e) {
                                Utils.safeWarn('تعذر تحديث تبويب الموافقات بعد حفظ التحقيق:', e);
                            }
                        })();
                    }
                }, 0);
            } else {
                throw new Error('الحادث غير موجود');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في حفظ التحقيق:', error);
            Notification.error('حدث خطأ: ' + error.message);
        } finally {
            this._investigationSubmitting = false;
        }
    },

    collectInvestigationActionPlan() {
        const actionPlan = [];
        const rows = document.querySelectorAll('#investigation-action-plan-body tr');

        rows.forEach((row, idx) => {
            const inputs = row.querySelectorAll('textarea, input[type="date"], input[type="text"]');
            if (inputs.length >= 6) {
                const correctiveAction = inputs[0].value.trim();
                const plannedDate = inputs[1].value;
                const responsibleName = inputs[2].value.trim();
                const responsibleDate = inputs[3].value;
                const followUpName = inputs[4].value.trim();
                const followUpDate = inputs[5].value;

                if (correctiveAction || plannedDate || responsibleName || followUpName) {
                    actionPlan.push({
                        correctiveAction,
                        plannedDate,
                        responsibleName,
                        responsibleDate,
                        followUpName,
                        followUpDate
                    });
                }
            }
        });

        return actionPlan;
    },

    addInvestigationActionPlanRow(data = {}) {
        const tbody = document.getElementById('investigation-action-plan-body');
        if (!tbody) {
            Notification.error('جدول خطة العمل غير موجود');
            return;
        }

        const rowIndex = tbody.querySelectorAll('tr').length;
        const tr = document.createElement('tr');
        tr.setAttribute('data-action-row', rowIndex);
        tr.style.borderBottom = '1px solid #c8e6c9';

        tr.innerHTML = `
            <td style="padding: 12px; border: 1px solid #c8e6c9; vertical-align: top;">
                <textarea class="form-input" rows="3" placeholder="اكتب الإجراء التصحيحي هنا..." style="width: 100%; resize: vertical; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; min-height: 80px; box-sizing: border-box;">${Utils.escapeHTML(data.correctiveAction || '')}</textarea>
            </td>
            <td style="padding: 12px; border: 1px solid #c8e6c9; text-align: center; vertical-align: top;">
                <input type="date" class="form-input" value="${data.plannedDate || ''}" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; text-align: center; box-sizing: border-box;">
            </td>
            <td style="padding: 12px; border: 1px solid #c8e6c9; vertical-align: top;">
                <input type="text" class="form-input mb-2" placeholder="اسم مسئول التنفيذ" value="${Utils.escapeHTML(data.responsibleName || '')}" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; box-sizing: border-box;">
                <input type="date" class="form-input" placeholder="تاريخ التنفيذ" value="${data.responsibleDate || ''}" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; box-sizing: border-box;">
            </td>
            <td style="padding: 12px; border: 1px solid #c8e6c9; vertical-align: top;">
                <input type="text" class="form-input mb-2" placeholder="اسم المتابع" value="${Utils.escapeHTML(data.followUpName || '')}" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; box-sizing: border-box;">
                <input type="date" class="form-input" placeholder="تاريخ المتابعة" value="${data.followUpDate || ''}" style="width: 100%; border: 2px solid #4CAF50; border-radius: 6px; padding: 8px; box-sizing: border-box;">
            </td>
        `;

        tbody.appendChild(tr);
    },

    // جمع بيانات نموذج التحقيق للطباعة/التصدير
    getInvestigationFormData() {
        const modal = document.querySelector('.modal-overlay');
        if (!modal) {
            return null;
        }

        const investigationNumberEl = document.getElementById('investigation-number');
        const investigationDateTimeEl = document.getElementById('investigation-datetime');
        const incidentDateTimeEl = document.getElementById('incident-datetime');
        const factoryEl = document.getElementById('investigation-factory');
        const locationEl = document.getElementById('investigation-location');
        const descriptionEl = document.getElementById('investigation-description');
        const nearmissDescriptionEl = document.getElementById('investigation-nearmiss-description');
        const affectedAffiliationEl = document.getElementById('investigation-affected-affiliation');
        const affectedNameEl = document.getElementById('investigation-affected-name');
        const affectedJobEl = document.getElementById('investigation-affected-job');
        const affectedAgeEl = document.getElementById('investigation-affected-age');
        const affectedDepartmentEl = document.getElementById('investigation-affected-department');
        const unsafeBehaviorEl = document.getElementById('investigation-unsafe-behavior');
        const unsafeConditionEl = document.getElementById('investigation-unsafe-condition');
        const riskProbabilityEl = document.getElementById('investigation-risk-probability');
        const riskSeverityEl = document.getElementById('investigation-risk-severity');
        const riskLevelEl = document.getElementById('investigation-risk-level');
        const riskResultEl = document.getElementById('investigation-risk-result');
        const riskExplanationEl = document.getElementById('investigation-risk-explanation');
        const signatureAreaManagerEl = document.getElementById('investigation-signature-area-manager');
        const signatureAreaManagerDateEl = document.getElementById('investigation-signature-area-manager-date');
        const signatureSafetyManagerEl = document.getElementById('investigation-signature-safety-manager');
        const signatureSafetyManagerDateEl = document.getElementById('investigation-signature-safety-manager-date');
        const signatureSafetyDirectorEl = document.getElementById('investigation-signature-safety-director');
        const signatureSafetyDirectorDateEl = document.getElementById('investigation-signature-safety-director-date');

        if (!investigationNumberEl || !investigationDateTimeEl || !incidentDateTimeEl || !factoryEl ||
            !locationEl || !descriptionEl || !affectedAffiliationEl || !affectedNameEl ||
            !affectedJobEl || !affectedAgeEl || !affectedDepartmentEl || !unsafeBehaviorEl ||
            !unsafeConditionEl || !riskProbabilityEl || !riskSeverityEl || !riskLevelEl ||
            !riskResultEl || !riskExplanationEl || !signatureAreaManagerEl || !signatureAreaManagerDateEl ||
            !signatureSafetyManagerEl || !signatureSafetyManagerDateEl) {
            return null;
        }

        // Collect incident types
        const incidentTypes = [];
        if (document.getElementById('incident-type-nearmiss')?.checked) incidentTypes.push('nearmiss');
        if (document.getElementById('incident-type-property')?.checked) incidentTypes.push('property');
        if (document.getElementById('incident-type-injury-no-lost')?.checked) incidentTypes.push('injury-no-lost');
        if (document.getElementById('incident-type-injury-lost')?.checked) incidentTypes.push('injury-lost');
        if (document.getElementById('incident-type-fatality')?.checked) incidentTypes.push('fatality');

        // ✅ إصلاح: تحويل datetime-local إلى ISO بشكل صحيح
        return {
            investigationNumber: investigationNumberEl.value,
            investigationDateTime: Utils.dateTimeLocalToISO(investigationDateTimeEl.value) || investigationDateTimeEl.value,
            incidentDateTime: Utils.dateTimeLocalToISO(incidentDateTimeEl.value) || incidentDateTimeEl.value,
            factoryId: factoryEl.value,
            factoryName: factoryEl.options[factoryEl.selectedIndex]?.text || '',
            locationId: locationEl.value,
            locationName: locationEl.options[locationEl.selectedIndex]?.text || '',
            incidentTypes: incidentTypes,
            description: descriptionEl.value,
            nearmissDescription: nearmissDescriptionEl?.value || '',
            affectedAffiliation: affectedAffiliationEl.value,
            affectedName: affectedNameEl.value,
            affectedJob: affectedJobEl.value,
            affectedAge: affectedAgeEl.value,
            affectedDepartment: affectedDepartmentEl.value,
            unsafeBehavior: unsafeBehaviorEl.value,
            unsafeCondition: unsafeConditionEl.value,
            riskProbability: parseInt(riskProbabilityEl.value) || 0,
            riskSeverity: parseInt(riskSeverityEl.value) || 0,
            riskLevel: riskLevelEl.value,
            riskResult: riskResultEl.value,
            riskExplanation: riskExplanationEl.value,
            actionPlan: this.collectInvestigationActionPlan(),
            signatureAreaManager: {
                name: signatureAreaManagerEl.value,
                date: signatureAreaManagerDateEl.value
            },
            signatureSafetyManager: {
                name: signatureSafetyManagerEl.value,
                date: signatureSafetyManagerDateEl.value
            },
            signatureSafetyDirector: {
                name: signatureSafetyDirectorEl?.value || '',
                date: signatureSafetyDirectorDateEl?.value || ''
            }
        };
    },

    // طباعة نموذج التحقيق
    printInvestigation(incidentId) {
        try {
            const incident = AppState.appData.incidents.find(i => i.id === incidentId);
            if (!incident) {
                Notification.error('الحادث غير موجود');
                return;
            }

            // جمع البيانات من النموذج المفتوح أو من البيانات المحفوظة
            let investigationData = this.getInvestigationFormData();
            if (!investigationData) {
                // إذا لم يكن النموذج مفتوحاً، استخدم البيانات المحفوظة
                investigationData = incident.investigation || {};
                if (typeof investigationData === 'string') {
                    try {
                        investigationData = JSON.parse(investigationData);
                    } catch (e) {
                        investigationData = {};
                    }
                }
            }

            if (!investigationData.investigationNumber && !investigationData.description) {
                Notification.warning('لا توجد بيانات تحقيق للطباعة');
                return;
            }

            Loading.show('جاري إعداد الطباعة...');

            // بناء محتوى HTML للطباعة
            const content = this.buildInvestigationPrintContent(incident, investigationData);

            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(
                    investigationData.investigationNumber || `INV-${incidentId.substring(0, 8)}`,
                    'نموذج التحقيق في الحادث',
                    content,
                    false,
                    true,
                    { version: '1.0' },
                    incident.createdAt,
                    investigationData.updatedAt || incident.updatedAt
                )
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>body { font-family: 'Tahoma', Arial, sans-serif; direction: rtl; text-align: right; padding: 20px; } @media print { body { margin: 0; padding: 15px; } }</style></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                            Loading.hide();
                            Notification.success('تم تجهيز التقرير للطباعة');
                        }, 800);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في طباعة التحقيق:', error);
            Notification.error('فشل الطباعة: ' + error.message);
        }
    },

    // تصدير نموذج التحقيق إلى PDF
    exportInvestigationPDF(incidentId) {
        // استخدام نفس دالة الطباعة حيث أن exportPDF تقوم بفتح نافذة طباعة يمكن حفظها كـ PDF
        this.printInvestigation(incidentId);
    },

    // بناء محتوى HTML للطباعة
    buildInvestigationPrintContent(incident, investigationData) {
        const formatDate = (dateStr) => {
            if (!dateStr) return 'غير محدد';
            try {
                const date = new Date(dateStr);
                return date.toLocaleString('ar-SA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch {
                return dateStr;
            }
        };

        const incidentTypeNames = {
            'nearmiss': 'حادث وشيك',
            'property': 'تلف ممتلكات',
            'injury-no-lost': 'إصابة بدون فقد أيام عمل',
            'injury-lost': 'إصابة مع فقد أيام عمل',
            'fatality': 'وفاة'
        };

        const riskResultNames = {
            'low': 'منخفض',
            'medium': 'متوسط',
            'high': 'عالي'
        };

        const affiliationNames = {
            'company': 'شركة',
            'daily-labor': 'عمالة يومية',
            'contractor': 'مقاول',
            'visitor': 'زائر',
            'none': 'لا يوجد'
        };

        const unsafeBehaviorNames = {
            'yes': 'نعم',
            'no': 'لا'
        };

        // بناء جدول خطة العمل
        let actionPlanHTML = '';
        if (investigationData.actionPlan && Array.isArray(investigationData.actionPlan) && investigationData.actionPlan.length > 0) {
            const actionRows = investigationData.actionPlan.map(action => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(action.correctiveAction || '')}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${action.plannedDate ? formatDate(action.plannedDate) : ''}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">
                        ${Utils.escapeHTML(action.responsibleName || '')}
                        ${action.responsibleDate ? '<br>' + formatDate(action.responsibleDate) : ''}
                    </td>
                    <td style="padding: 8px; border: 1px solid #ddd;">
                        ${Utils.escapeHTML(action.followUpName || '')}
                        ${action.followUpDate ? '<br>' + formatDate(action.followUpDate) : ''}
                    </td>
                </tr>
            `).join('');

            actionPlanHTML = `
                <div style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; font-size: 18px; color: #2E7D32; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
                    6) خطة العمل
                </div>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #388E3C 0%, #4CAF50 100%); color: white;">
                            <th style="padding: 12px; border: 1px solid #2E7D32; text-align: right;">الإجراء التصحيحي</th>
                            <th style="padding: 12px; border: 1px solid #2E7D32; text-align: center;">التاريخ المخطط</th>
                            <th style="padding: 12px; border: 1px solid #2E7D32; text-align: center;">مسئول التنفيذ</th>
                            <th style="padding: 12px; border: 1px solid #2E7D32; text-align: center;">المتابعة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${actionRows}
                    </tbody>
                </table>
            `;
        }

        const content = `
            <div style="margin-bottom: 30px;">
                <div style="margin-bottom: 20px; font-weight: bold; font-size: 20px; color: #1565C0; border-bottom: 3px solid #2196F3; padding-bottom: 10px;">
                    1) بيانات الحادث الأساسية
                </div>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #e3f2fd; text-align: right; width: 30%;">رقم التحقيق</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${Utils.escapeHTML(investigationData.investigationNumber || 'غير محدد')}</td>
                    </tr>
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #e3f2fd; text-align: right;">تاريخ ووقت التحقيق</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${formatDate(investigationData.investigationDateTime)}</td>
                    </tr>
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #e3f2fd; text-align: right;">تاريخ ووقت الحادث</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${formatDate(investigationData.incidentDateTime)}</td>
                    </tr>
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #e3f2fd; text-align: right;">المصنع</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${Utils.escapeHTML(investigationData.factoryName || 'غير محدد')}</td>
                    </tr>
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #e3f2fd; text-align: right;">موقع الحادث بالضبط</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${Utils.escapeHTML(investigationData.locationName || 'غير محدد')}</td>
                    </tr>
                    ${incident.isoCode ? `
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #e3f2fd; text-align: right;">كود الحادث</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${Utils.escapeHTML(incident.isoCode)}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>

            ${investigationData.incidentTypes && investigationData.incidentTypes.length > 0 ? `
            <div style="margin-bottom: 30px;">
                <div style="margin-bottom: 20px; font-weight: bold; font-size: 20px; color: #6A1B9A; border-bottom: 3px solid #9C27B0; padding-bottom: 10px;">
                    2) نوع الحادث
                </div>
                <div style="padding: 15px; background-color: #f3e5f5; border: 2px solid #9C27B0; border-radius: 8px;">
                    ${investigationData.incidentTypes.map(type => `<div style="padding: 5px 0;">• ${incidentTypeNames[type] || type}</div>`).join('')}
                </div>
            </div>
            ` : ''}

            <div style="margin-bottom: 30px;">
                <div style="margin-bottom: 20px; font-weight: bold; font-size: 20px; color: #E65100; border-bottom: 3px solid #FF9800; padding-bottom: 10px;">
                    3) وصف وقائع وظروف الحادث
                </div>
                <div style="padding: 15px; background-color: #fff3e0; border: 2px solid #FF9800; border-radius: 8px; white-space: pre-wrap;">
                    ${Utils.escapeHTML(investigationData.description || 'غير محدد')}
                </div>
                ${investigationData.nearmissDescription ? `
                <div style="margin-top: 15px;">
                    <div style="font-weight: bold; margin-bottom: 10px;">وصف الحالة الوشيكة:</div>
                    <div style="padding: 15px; background-color: #fff3e0; border: 2px solid #FF9800; border-radius: 8px; white-space: pre-wrap;">
                        ${Utils.escapeHTML(investigationData.nearmissDescription)}
                    </div>
                </div>
                ` : ''}
            </div>

            ${investigationData.affectedAffiliation || investigationData.affectedName ? `
            <div style="margin-bottom: 30px;">
                <div style="margin-bottom: 20px; font-weight: bold; font-size: 20px; color: #AD1457; border-bottom: 3px solid #E91E63; padding-bottom: 10px;">
                    4) بيانات المصاب
                </div>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    ${investigationData.affectedAffiliation ? `
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #fce4ec; text-align: right; width: 30%;">تبعية المصاب</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${affiliationNames[investigationData.affectedAffiliation] || investigationData.affectedAffiliation}</td>
                    </tr>
                    ` : ''}
                    ${investigationData.affectedName ? `
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #fce4ec; text-align: right;">الاسم</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${Utils.escapeHTML(investigationData.affectedName)}</td>
                    </tr>
                    ` : ''}
                    ${investigationData.affectedJob ? `
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #fce4ec; text-align: right;">الوظيفة</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${Utils.escapeHTML(investigationData.affectedJob)}</td>
                    </tr>
                    ` : ''}
                    ${investigationData.affectedAge ? `
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #fce4ec; text-align: right;">السن</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${Utils.escapeHTML(investigationData.affectedAge)}</td>
                    </tr>
                    ` : ''}
                    ${investigationData.affectedDepartment ? `
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #fce4ec; text-align: right;">الجهة التابع لها</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${Utils.escapeHTML(investigationData.affectedDepartment)}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>
            ` : ''}

            <div style="margin-bottom: 30px;">
                <div style="margin-bottom: 20px; font-weight: bold; font-size: 20px; color: #00695C; border-bottom: 3px solid #009688; padding-bottom: 10px;">
                    5) الجزء الخاص بالمحقق
                </div>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    ${investigationData.unsafeBehavior ? `
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #e0f2f1; text-align: right; width: 30%;">سلوك غير آمن</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${unsafeBehaviorNames[investigationData.unsafeBehavior] || investigationData.unsafeBehavior}</td>
                    </tr>
                    ` : ''}
                    ${investigationData.unsafeCondition ? `
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #e0f2f1; text-align: right;">وضع غير آمن</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${unsafeBehaviorNames[investigationData.unsafeCondition] || investigationData.unsafeCondition}</td>
                    </tr>
                    ` : ''}
                    ${investigationData.riskProbability || investigationData.riskSeverity || investigationData.riskLevel ? `
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #e0f2f1; text-align: right;">جدول تقييم الخطر</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">
                            الاحتمالية: ${investigationData.riskProbability || 'غير محدد'} | 
                            الشدة: ${investigationData.riskSeverity || 'غير محدد'} | 
                            مستوى الخطر: ${Utils.escapeHTML(investigationData.riskLevel || 'غير محدد')}
                        </td>
                    </tr>
                    ` : ''}
                    ${investigationData.riskResult ? `
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #e0f2f1; text-align: right;">نتيجة التقييم</th>
                        <td style="padding: 10px; border: 1px solid #ddd;">${riskResultNames[investigationData.riskResult] || investigationData.riskResult}</td>
                    </tr>
                    ` : ''}
                    ${investigationData.riskExplanation ? `
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #e0f2f1; text-align: right;">شرح الخطر</th>
                        <td style="padding: 10px; border: 1px solid #ddd; white-space: pre-wrap;">${Utils.escapeHTML(investigationData.riskExplanation)}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>

            ${actionPlanHTML}

            <div style="margin-top: 30px;">
                <div style="margin-bottom: 20px; font-weight: bold; font-size: 20px; color: #F57F17; border-bottom: 3px solid #FFC107; padding-bottom: 10px;">
                    7) التوقيعات
                </div>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #fff9c4; text-align: center; width: 33%;">مسئول المنطقة</th>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #fff9c4; text-align: center; width: 33%;">مسئول السلامة والصحة</th>
                        <th style="padding: 10px; border: 1px solid #ddd; background-color: #fff9c4; text-align: center; width: 33%;">مدير السلامة والصحة</th>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: center; vertical-align: top;">
                            ${Utils.escapeHTML(investigationData.signatureAreaManager?.name || '')}
                            ${investigationData.signatureAreaManager?.date ? '<br>' + formatDate(investigationData.signatureAreaManager.date) : ''}
                        </td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: center; vertical-align: top;">
                            ${Utils.escapeHTML(investigationData.signatureSafetyManager?.name || '')}
                            ${investigationData.signatureSafetyManager?.date ? '<br>' + formatDate(investigationData.signatureSafetyManager.date) : ''}
                        </td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: center; vertical-align: top;">
                            ${Utils.escapeHTML(investigationData.signatureSafetyDirector?.name || '')}
                            ${investigationData.signatureSafetyDirector?.date ? '<br>' + formatDate(investigationData.signatureSafetyDirector.date) : ''}
                        </td>
                    </tr>
                </table>
            </div>
        `;

        return content;
    },

    // ===== Safety Alert Helper Functions =====
    
    /**
     * توليد رقم تسلسلي لـ Safety Alert
     */
    generateSafetyAlertSequentialNumber() {
        const alerts = AppState.appData?.safetyAlerts || [];
        const maxNumber = alerts.reduce((max, alert) => {
            const num = parseInt(alert.sequentialNumber) || 0;
            return num > max ? num : max;
        }, 0);
        return String(maxNumber + 1).padStart(3, '0');
    },

    /**
     * التحقق من صلاحية إنشاء Safety Alert
     */
    canCreateSafetyAlert() {
        const user = AppState.currentUser;
        if (!user) return false;
        if (user.role === 'admin') return true;
        // Safety Team أو System Manager
        return user.permissions?.canCreateSafetyAlert === true || 
               user.permissions?.safetyTeam === true;
    },

    /**
     * التحقق من صلاحية اعتماد Safety Alert
     */
    canApproveSafetyAlert() {
        const user = AppState.currentUser;
        if (!user) return false;
        if (user.role === 'admin') return true;
        // System Manager فقط
        return user.permissions?.canApproveSafetyAlert === true || 
               user.role === 'system-manager';
    },

    canApproveIncident() {
        const user = AppState.currentUser;
        if (!user) return false;
        // مدير النظام فقط يمكنه الموافقة
        if (user.role === 'admin') return true;
        return user.permissions?.admin === true || 
               user.permissions?.['manage-modules'] === true ||
               user.permissions?.['incidents-manage'] === true;
    },

    async approveIncident(incidentId) {
        try {
            const incident = AppState.appData.incidents.find(i => i.id === incidentId);
            if (!incident) {
                Notification.error('الحادث غير موجود');
                return;
            }

            if (!this.canApproveIncident()) {
                Notification.error('ليس لديك صلاحية للموافقة على الحوادث');
                return;
            }

            if (!confirm('هل أنت متأكد من الموافقة على هذا الحادث؟')) {
                return;
            }

            Loading.show('جاري الموافقة على الحادث...');

            // تحديث الحالة
            incident.status = 'مكتمل';
            incident.requiresApproval = false;
            incident.approvedBy = AppState.currentUser ? {
                id: AppState.currentUser.id || '',
                name: AppState.currentUser.name || AppState.currentUser.displayName || '',
                email: AppState.currentUser.email || ''
            } : null;
            incident.approvedAt = new Date().toISOString();
            incident.updatedAt = new Date().toISOString();

            // حفظ البيانات محلياً
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            Loading.hide();
            Notification.success('تم الموافقة على الحادث بنجاح');

            // تحديث الواجهة حسب التبويب الحالي
            setTimeout(async () => {
                try {
                    if (document.getElementById('incidents-content')) {
                        this.loadIncidentsList();
                    }
                    const container = document.getElementById('incidents-tab-content');
                    if (container) {
                        if (this.currentTab === 'approvals') {
                            container.innerHTML = await this.renderApprovalsTab();
                            this.setupTabEventListeners('approvals');
                        } else if (this.currentTab === 'registry') {
                            container.innerHTML = await this.renderRegistryTab();
                            this.setupTabEventListeners('registry');
                        }
                    }
                } catch (e) {
                    Utils.safeWarn('تعذر تحديث الواجهة بعد الموافقة:', e);
                }
            }, 0);

            // مزامنة في الخلفية (بدون تعطيل الواجهة)
            const updateData = {
                status: incident.status,
                requiresApproval: incident.requiresApproval,
                approvedBy: incident.approvedBy,
                approvedAt: incident.approvedAt,
                updatedAt: incident.updatedAt,
                userData: AppState.currentUser ? {
                    id: AppState.currentUser.id || '',
                    name: AppState.currentUser.name || AppState.currentUser.displayName || '',
                    email: AppState.currentUser.email || '',
                    role: AppState.currentUser.role || '',
                    permissions: AppState.currentUser.permissions || {}
                } : null
            };

            setTimeout(() => {
                try {
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                        GoogleIntegration.autoSave('Incidents', AppState.appData.incidents).catch((err) => {
                            Utils.safeWarn('⚠️ فشل autoSave للحوادث بعد الموافقة:', err);
                        });
                    }
                } catch (e) {
                    Utils.safeWarn('⚠️ خطأ أثناء autoSave بعد الموافقة:', e);
                }

                try {
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                        GoogleIntegration.sendRequest({
                            action: 'updateIncident',
                            data: { incidentId: incidentId, updateData }
                        }).catch((err) => {
                            Utils.safeWarn('⚠️ فشل تحديث الحادث (Backend) بعد الموافقة:', err);
                        });
                    }
                } catch (e) {
                    Utils.safeWarn('⚠️ خطأ أثناء تحديث الحادث (Backend) بعد الموافقة:', e);
                }

                this.updateRegistryEntry(incident).catch((err) => {
                    Utils.safeWarn('⚠️ فشل تحديث سجل الحوادث بعد الموافقة:', err);
                });
            }, 0);
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في الموافقة على الحادث:', error);
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    async rejectIncident(incidentId) {
        try {
            const incident = AppState.appData.incidents.find(i => i.id === incidentId);
            if (!incident) {
                Notification.error('الحادث غير موجود');
                return;
            }

            if (!this.canApproveIncident()) {
                Notification.error('ليس لديك صلاحية لرفض الحوادث');
                return;
            }

            const reason = prompt('يرجى إدخال سبب الرفض:');
            if (!reason || reason.trim() === '') {
                Notification.warning('يجب إدخال سبب الرفض');
                return;
            }

            if (!confirm('هل أنت متأكد من رفض هذا الحادث؟')) {
                return;
            }

            Loading.show('جاري رفض الحادث...');

            // تحديث الحالة
            incident.status = 'قيد التحقيق';
            incident.requiresApproval = false;
            incident.rejectedBy = AppState.currentUser ? {
                id: AppState.currentUser.id || '',
                name: AppState.currentUser.name || AppState.currentUser.displayName || '',
                email: AppState.currentUser.email || ''
            } : null;
            incident.rejectedAt = new Date().toISOString();
            incident.rejectionReason = reason.trim();
            incident.updatedAt = new Date().toISOString();

            // حفظ البيانات محلياً
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            Loading.hide();
            Notification.success('تم رفض الحادث بنجاح');

            // تحديث الواجهة حسب التبويب الحالي
            setTimeout(async () => {
                try {
                    if (document.getElementById('incidents-content')) {
                        this.loadIncidentsList();
                    }
                    const container = document.getElementById('incidents-tab-content');
                    if (container) {
                        if (this.currentTab === 'approvals') {
                            container.innerHTML = await this.renderApprovalsTab();
                            this.setupTabEventListeners('approvals');
                        } else if (this.currentTab === 'registry') {
                            container.innerHTML = await this.renderRegistryTab();
                            this.setupTabEventListeners('registry');
                        }
                    }
                } catch (e) {
                    Utils.safeWarn('تعذر تحديث الواجهة بعد الرفض:', e);
                }
            }, 0);

            // مزامنة في الخلفية (بدون تعطيل الواجهة)
            const updateData = {
                status: incident.status,
                requiresApproval: incident.requiresApproval,
                rejectedBy: incident.rejectedBy,
                rejectedAt: incident.rejectedAt,
                rejectionReason: incident.rejectionReason,
                updatedAt: incident.updatedAt,
                userData: AppState.currentUser ? {
                    id: AppState.currentUser.id || '',
                    name: AppState.currentUser.name || AppState.currentUser.displayName || '',
                    email: AppState.currentUser.email || '',
                    role: AppState.currentUser.role || '',
                    permissions: AppState.currentUser.permissions || {}
                } : null
            };

            setTimeout(() => {
                try {
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                        GoogleIntegration.autoSave('Incidents', AppState.appData.incidents).catch((err) => {
                            Utils.safeWarn('⚠️ فشل autoSave للحوادث بعد الرفض:', err);
                        });
                    }
                } catch (e) {
                    Utils.safeWarn('⚠️ خطأ أثناء autoSave بعد الرفض:', e);
                }

                try {
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                        GoogleIntegration.sendRequest({
                            action: 'updateIncident',
                            data: { incidentId: incidentId, updateData }
                        }).catch((err) => {
                            Utils.safeWarn('⚠️ فشل تحديث الحادث (Backend) بعد الرفض:', err);
                        });
                    }
                } catch (e) {
                    Utils.safeWarn('⚠️ خطأ أثناء تحديث الحادث (Backend) بعد الرفض:', e);
                }

                this.updateRegistryEntry(incident).catch((err) => {
                    Utils.safeWarn('⚠️ فشل تحديث سجل الحوادث بعد الرفض:', err);
                });
            }, 0);
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في رفض الحادث:', error);
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    /**
     * تصدير Safety Alert إلى PDF (المحدث)
     */
    // جمع بيانات نموذج Safety Alert للطباعة/التصدير
    getSafetyAlertFormData() {
        const modal = document.querySelector('.modal-overlay');
        if (!modal) {
            return null;
        }

        // Get incident type from hidden input (updated by checkboxes) or other input
        const incidentTypeInput = document.getElementById('safety-alert-incident-type');
        const otherInput = document.getElementById('incident-type-other-input');
        const otherCheckbox = document.getElementById('incident-type-other');
        let incidentType = incidentTypeInput?.value || 'نوع الحادث';
        
        // If "other" is selected, use the value from the other input field
        if (otherCheckbox && otherCheckbox.checked && otherInput && otherInput.value.trim()) {
            incidentType = otherInput.value.trim();
        }
        
        // Get sequential number
        const numberDisplay = document.getElementById('safety-alert-number-display');
        const sequentialNumber = numberDisplay ? numberDisplay.textContent.trim() : String((AppState.appData?.safetyAlerts || []).length + 1).padStart(3, '0');

        return {
            sequentialNumber: sequentialNumber,
            incidentType: incidentType,
            incidentDate: document.getElementById('safety-alert-date')?.value || '',
            incidentLocation: document.getElementById('safety-alert-location')?.value || '',
            who: document.getElementById('safety-alert-who')?.value || '',
            description: document.getElementById('safety-alert-description')?.value || '',
            facts: document.getElementById('safety-alert-facts')?.value || '',
            causes: document.getElementById('safety-alert-causes')?.value || '',
            lessonsLearned: document.getElementById('safety-alert-lessons')?.value || '',
            preventiveMeasures: document.getElementById('safety-alert-preventive')?.value || '',
            locationImage: document.getElementById('safety-alert-location-image')?.value || '',
            causesImage: document.getElementById('safety-alert-causes-image')?.value || '',
            notificationNumber: document.getElementById('safety-alert-notification-number')?.value || sequentialNumber,
            preparedBy: document.getElementById('safety-alert-prepared-by')?.value || '',
            approvedBy: document.getElementById('safety-alert-approved-by')?.value || '',
            issueDate: document.getElementById('safety-alert-issue-date')?.value || ''
        };
    },

    // طباعة Safety Alert
    printSafetyAlert(alertId) {
        try {
            // جمع البيانات من النموذج المفتوح أو من البيانات المحفوظة
            let alertData = this.getSafetyAlertFormData();
            
            if (!alertData) {
                // إذا لم يكن النموذج مفتوحاً، استخدم البيانات المحفوظة
                if (!alertId) {
                    Notification.warning('لا توجد بيانات للطباعة. يرجى فتح النموذج أولاً.');
                    return;
                }
                alertData = (AppState.appData?.safetyAlerts || []).find(a => a.id === alertId);
                if (!alertData) {
                    Notification.error('Safety Alert غير موجود');
                    return;
                }
            }

            if (!alertData.sequentialNumber && !alertData.description) {
                Notification.warning('لا توجد بيانات للطباعة');
                return;
            }

            Loading.show('جاري إعداد الطباعة...');

            // استخدام دالة exportSafetyAlertPDF لكن مع البيانات المباشرة
            this.exportSafetyAlertPDFWithData(alertData);
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في طباعة Safety Alert:', error);
            Notification.error('فشل الطباعة: ' + error.message);
        }
    },

    /**
     * تحويل رابط Google Drive إلى رابط قابل للطباعة
     */
    convertGoogleDriveLinkToPrintable(link) {
        if (!link) return '';
        if (typeof window.__convertGoogleDriveUrl === 'function') {
            link = window.__convertGoogleDriveUrl(link);
        }
        // إذا كان base64، استخدمه مباشرة
        if (link.startsWith('data:image/')) {
            return link;
        }
        // تطبيع روابط thumbnail المخزنة قديماً إلى صيغة uc/view الأكثر استقراراً
        if (link.includes('drive.google.com/thumbnail')) {
            const m = link.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/i);
            if (m && m[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
        }
        // إذا كان رابط Google Drive، استخدم صيغة uc/view
        if (link.includes('drive.google.com')) {
            const fileIdMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/) || link.match(/id=([a-zA-Z0-9_-]+)/);
            if (fileIdMatch && fileIdMatch[1]) {
                return `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`;
            }
        }
        return link;
    },

    // بناء محتوى HTML للطباعة
    buildSafetyAlertPrintContent(alertData) {
        const companyName = AppState?.companySettings?.name || AppState?.companyName || '';
        const companySecondaryName = AppState?.companySettings?.secondaryName || '';
        const companyLogo = AppState?.companyLogo || '';
        const sequentialNumber = alertData.sequentialNumber || '001';
        const notificationNumber = alertData.notificationNumber || sequentialNumber;
        
        // معالجة الصور للتأكد من ظهورها بشكل صحيح
        const locationImageSrc = alertData.locationImage ? this.convertGoogleDriveLinkToPrintable(alertData.locationImage) : '';
        const causesImageSrc = alertData.causesImage ? this.convertGoogleDriveLinkToPrintable(alertData.causesImage) : '';
        const logoSrc = companyLogo ? this.convertGoogleDriveLinkToPrintable(companyLogo) : '';
        
        return `
            <div style="direction: rtl; text-align: right; font-family: 'Tahoma', Arial, sans-serif; page-break-inside: avoid;">
                <!-- Top Header with Logo and Company Name -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 3px solid #003865;">
                    <div style="flex: 0 0 auto; text-align: right; padding-left: 20px;">
                        ${logoSrc ? `<img src="${logoSrc}" alt="شعار الشركة" style="max-height: 60px; max-width: 150px; object-fit: contain; display: block;" onerror="this.style.display='none';">` : ''}
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: #003865; margin-bottom: 5px;">تنبيه - Safety Alert</div>
                        <div style="font-size: 1.3rem; font-weight: 700; color: #003865;">السلامة</div>
                    </div>
                    <div style="flex: 0 0 auto; text-align: left; padding-right: 20px;">
                        <div style="background: #e0f2fe; padding: 8px 16px; border-radius: 8px; font-weight: 600; color: #003865; font-size: 0.95rem;">
                            كود التقرير: SAFETY-ALERT
                        </div>
                        <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-top: 8px; line-height: 1.3;">
                            ${Utils.escapeHTML(companyName || '')}
                            ${companySecondaryName ? `<div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-top: 2px;">${Utils.escapeHTML(companySecondaryName)}</div>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Incident Number and Type Section -->
                <div style="text-align: center; margin: 15px 0 20px 0;">
                    <div style="color: #dc2626; font-weight: 700; font-size: 0.75rem; margin-bottom: 2px;">No</div>
                    <div style="color: #dc2626; font-weight: 700; font-size: 12px; margin-bottom: 15px;">${Utils.escapeHTML(sequentialNumber)}</div>
                    <div style="background: #9ca3af; color: white; padding: 14px 20px; text-align: center; font-weight: 700; font-size: 1.15rem; border-radius: 8px; display: inline-block; min-width: 200px;">
                        ${Utils.escapeHTML(alertData.incidentType || '')}
                    </div>
                </div>

                <!-- Incident Details -->
                <div style="background: #9ca3af; height: 4px; margin: 20px 0 15px 0; border-radius: 2px;"></div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px;">
                    <div>
                        <div style="background: #9ca3af; color: white; padding: 10px; text-align: center; font-weight: 600; border-radius: 4px; font-size: 0.95rem;">أين</div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #e5e7eb; margin-top: 8px; min-height: 70px; font-size: 0.9rem;">
                            ${Utils.escapeHTML(alertData.incidentLocation || '')}
                        </div>
                    </div>
                    <div>
                        <div style="background: #9ca3af; color: white; padding: 10px; text-align: center; font-weight: 600; border-radius: 4px; font-size: 0.95rem;">متى</div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #e5e7eb; margin-top: 8px; min-height: 70px; font-size: 0.9rem;">
                            ${alertData.incidentDate ? new Date(alertData.incidentDate).toLocaleDateString('ar-SA') : ''}
                        </div>
                    </div>
                    <div>
                        <div style="background: #9ca3af; color: white; padding: 10px; text-align: center; font-weight: 600; border-radius: 4px; font-size: 0.95rem;">من</div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #e5e7eb; margin-top: 8px; min-height: 70px; font-size: 0.9rem;">
                            ${Utils.escapeHTML(alertData.who || '')}
                        </div>
                    </div>
                </div>

                <!-- Images -->
                ${locationImageSrc || causesImageSrc ? `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 18px; page-break-inside: avoid;">
                    ${locationImageSrc ? `
                    <div style="text-align: center;">
                        <div style="margin-bottom: 6px; font-size: 0.85rem; font-weight: 600; color: #374151;">صورة توضيحية لمكان الحادث</div>
                        <div style="background: #fbbf24; padding: 8px; text-align: center; border-radius: 6px; border: 2px solid #f59e0b; display: inline-block; max-width: 100%; width: 100%; box-sizing: border-box;">
                            <img src="${locationImageSrc}" alt="صورة المكان" 
                                style="max-width: 100%; max-height: 350px; width: auto; height: auto; border-radius: 4px; object-fit: contain; display: block; margin: 0 auto;"
                                onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'padding: 20px; color: #666;\\'>فشل تحميل الصورة</div>';">
                        </div>
                    </div>
                    ` : '<div></div>'}
                    ${causesImageSrc ? `
                    <div style="text-align: center;">
                        <div style="margin-bottom: 6px; font-size: 0.85rem; font-weight: 600; color: #374151;">صورة توضيحية لأسباب الحادث</div>
                        <div style="background: #fbbf24; padding: 8px; text-align: center; border-radius: 6px; border: 2px solid #f59e0b; display: inline-block; max-width: 100%; width: 100%; box-sizing: border-box;">
                            <img src="${causesImageSrc}" alt="صورة الأسباب" 
                                style="max-width: 100%; max-height: 350px; width: auto; height: auto; border-radius: 4px; object-fit: contain; display: block; margin: 0 auto;"
                                onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'padding: 20px; color: #666;\\'>فشل تحميل الصورة</div>';">
                        </div>
                    </div>
                    ` : ''}
                </div>
                ` : ''}

                <!-- Description -->
                <div style="background: #9ca3af; height: 4px; margin: 18px 0 12px 0; border-radius: 2px;"></div>
                <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #e5e7eb; margin-bottom: 15px; page-break-inside: avoid;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.95rem;">وصف الحادث :</label>
                    <div style="white-space: pre-wrap; font-size: 0.85rem; line-height: 1.6;">${Utils.escapeHTML(alertData.description || '')}</div>
                </div>

                ${alertData.facts ? `
                <div style="background: #9ca3af; height: 4px; margin: 15px 0 12px 0; border-radius: 2px;"></div>
                <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #e5e7eb; margin-bottom: 15px; page-break-inside: avoid;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.95rem;">حقائق عن الحادث :</label>
                    <div style="white-space: pre-wrap; font-size: 0.85rem; line-height: 1.6;">${Utils.escapeHTML(alertData.facts)}</div>
                </div>
                ` : ''}

                ${alertData.causes ? `
                <div style="background: #9ca3af; height: 4px; margin: 15px 0 12px 0; border-radius: 2px;"></div>
                <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #e5e7eb; margin-bottom: 15px; page-break-inside: avoid;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.95rem;">الأسباب :</label>
                    <div style="white-space: pre-wrap; font-size: 0.85rem; line-height: 1.6;">${Utils.escapeHTML(alertData.causes)}</div>
                </div>
                ` : ''}

                <div style="background: #9ca3af; height: 4px; margin: 15px 0 12px 0; border-radius: 2px;"></div>
                <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #e5e7eb; margin-bottom: 15px; page-break-inside: avoid;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.95rem;">الدروس المستفادة :</label>
                    <div style="white-space: pre-wrap; font-size: 0.85rem; line-height: 1.6;">${Utils.escapeHTML(alertData.lessonsLearned || '')}</div>
                </div>

                <div style="background: #9ca3af; height: 4px; margin: 15px 0 12px 0; border-radius: 2px;"></div>
                <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #e5e7eb; margin-bottom: 15px; page-break-inside: avoid;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.95rem;">إجراءات منع تكرار الحدث :</label>
                    <div style="white-space: pre-wrap; font-size: 0.85rem; line-height: 1.6;">${Utils.escapeHTML(alertData.preventiveMeasures || '')}</div>
                </div>

                <!-- Footer -->
                <div style="background: #9ca3af; height: 4px; margin: 15px 0 12px 0; border-radius: 2px;"></div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 10px;">
                    <div>
                        <div style="background: #9ca3af; color: white; padding: 10px; text-align: center; font-weight: 600; border-radius: 4px; font-size: 0.9rem;">رقم الإشعار</div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #e5e7eb; margin-top: 8px; font-size: 0.85rem; min-height: 50px;">
                            ${Utils.escapeHTML(notificationNumber)}
                        </div>
                    </div>
                    <div>
                        <div style="background: #9ca3af; color: white; padding: 10px; text-align: center; font-weight: 600; border-radius: 4px; font-size: 0.9rem;">إعداد</div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #e5e7eb; margin-top: 8px; font-size: 0.85rem; min-height: 50px;">
                            ${Utils.escapeHTML(alertData.preparedBy || '')}
                        </div>
                    </div>
                    <div>
                        <div style="background: #9ca3af; color: white; padding: 10px; text-align: center; font-weight: 600; border-radius: 4px; font-size: 0.9rem;">اعتماد</div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #e5e7eb; margin-top: 8px; font-size: 0.85rem; min-height: 50px;">
                            ${Utils.escapeHTML(alertData.approvedBy || '-')}
                        </div>
                    </div>
                    <div>
                        <div style="background: #9ca3af; color: white; padding: 10px; text-align: center; font-weight: 600; border-radius: 4px; font-size: 0.9rem;">تاريخ الإصدار</div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #e5e7eb; margin-top: 8px; font-size: 0.85rem; min-height: 50px;">
                            ${alertData.issueDate ? new Date(alertData.issueDate).toLocaleDateString('ar-SA') : '-'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // تصدير Safety Alert إلى PDF باستخدام البيانات المباشرة
    exportSafetyAlertPDFWithData(alertData) {
        try {
            Loading.show('جاري تحضير PDF...');

            const content = this.buildSafetyAlertPrintContent(alertData);

            // استخدام نفس HTML template من exportSafetyAlertPDF
            const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Safety Alert - تنبيه السلامة</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 12mm 15mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        body {
            font-family: 'Tahoma', Arial, sans-serif;
            direction: rtl;
            text-align: right;
            background: white;
            color: #1f2937;
            font-size: 11px;
            line-height: 1.4;
            padding: 0;
            margin: 0;
        }
        .content-wrapper {
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
            padding: 5px;
            page-break-inside: avoid;
            overflow: hidden;
        }
        img {
            max-width: 100%;
            height: auto;
            object-fit: contain;
            display: block;
        }
        .safety-alert-image-container {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .safety-alert-image-container img {
            max-width: 100%;
            max-height: 350px;
            width: auto;
            height: auto;
            object-fit: contain;
            display: block;
            margin: 0 auto;
        }
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            .safety-alert-image-container {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            img {
                max-width: 100%;
                max-height: 350px;
                object-fit: contain;
            }
        }
    </style>
</head>
<body>
    <div class="content-wrapper">
        ${content}
    </div>
</body>
</html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    // انتظار تحميل جميع الصور قبل الطباعة
                    const images = printWindow.document.querySelectorAll('img');
                    let imagesLoaded = 0;
                    const totalImages = images.length;
                    
                    if (totalImages === 0) {
                        // لا توجد صور، اطبع مباشرة
                        setTimeout(() => {
                            printWindow.print();
                            setTimeout(() => {
                                URL.revokeObjectURL(url);
                                Loading.hide();
                                Notification.success('تم تجهيز التقرير للطباعة/الحفظ كـ PDF');
                            }, 800);
                        }, 500);
                        return;
                    }
                    
                    // معالجة تحميل الصور
                    const checkAllImagesLoaded = () => {
                        imagesLoaded++;
                        if (imagesLoaded >= totalImages) {
                            // جميع الصور تم تحميلها
                            setTimeout(() => {
                                printWindow.print();
                                setTimeout(() => {
                                    URL.revokeObjectURL(url);
                                    Loading.hide();
                                    Notification.success('تم تجهيز التقرير للطباعة/الحفظ كـ PDF');
                                }, 800);
                            }, 500);
                        }
                    };
                    
                    // إضافة معالجات للأحداث لكل صورة
                    images.forEach((img) => {
                        if (img.complete) {
                            checkAllImagesLoaded();
                        } else {
                            img.onload = checkAllImagesLoaded;
                            img.onerror = () => {
                                // في حالة فشل تحميل الصورة، استمر في الطباعة
                                console.warn('فشل تحميل صورة:', img.src);
                                checkAllImagesLoaded();
                            };
                        }
                    });
                    
                    // timeout احتياطي - اطبع بعد 3 ثوانٍ حتى لو لم يتم تحميل جميع الصور
                    setTimeout(() => {
                        if (imagesLoaded < totalImages) {
                            console.warn('بعض الصور لم يتم تحميلها، لكن سيتم المتابعة مع الطباعة');
                            printWindow.print();
                            setTimeout(() => {
                                URL.revokeObjectURL(url);
                                Loading.hide();
                                Notification.success('تم تجهيز التقرير للطباعة/الحفظ كـ PDF');
                            }, 800);
                        }
                    }, 3000);
                };
            } else {
                Loading.hide();
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error('فشل تصدير PDF: ' + error.message);
        }
    },

    async exportSafetyAlertPDF(alertId) {
        try {
            let alert = null;
            
            // إذا كان alertId فارغاً، حاول جمع البيانات من النموذج المفتوح
            if (!alertId || alertId === '') {
                const formData = this.getSafetyAlertFormData();
                if (formData) {
                    // استخدام البيانات من النموذج
                    this.exportSafetyAlertPDFWithData(formData);
                    return;
                } else {
                    Notification.error('لا توجد بيانات للتصدير. يرجى فتح النموذج أولاً.');
                    return;
                }
            }
            
            // إذا كان هناك alertId، استخدم البيانات المحفوظة
            alert = (AppState.appData?.safetyAlerts || []).find(a => a.id === alertId);
            if (!alert) {
                Notification.error('Safety Alert غير موجود');
                return;
            }

            // استخدام البيانات المحفوظة
            this.exportSafetyAlertPDFWithData(alert);
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error('فشل تصدير PDF: ' + error.message);
        }
    }
};
// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof Incidents !== 'undefined') {
            window.Incidents = Incidents;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ Incidents module loaded and available on window.Incidents');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير Incidents:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof Incidents !== 'undefined') {
            try {
                window.Incidents = Incidents;
            } catch (e) {
                console.error('❌ فشل تصدير Incidents:', e);
            }
        }
    }
})();