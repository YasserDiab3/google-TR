/**
 * Clinic Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ …Ù† app-modules.js
 */
const Clinic = {
    state: {
        activeTab: 'medications',
        activeVisitType: 'employees',
        activeInjuryType: 'employees',
        filters: {
            medications: { search: '', status: 'all', dateFrom: '', dateTo: '' },
            visits: { search: '' },
            sickLeave: { search: '', department: '', dateFrom: '', dateTo: '' },
            injuries: { search: '', status: 'all', department: '', injuryType: 'all', injuryBodyPart: 'all', dateFrom: '', dateTo: '' }
        },
        currentInjuryAttachments: [],
        medicationAlertsNotified: new Set(),
        initialized: false
    },

    /**
     * معالجة روابط المرفقات (تحويل روابط Google Drive القديمة)
     */
    processAttachmentUrl(url) {
        if (!url || typeof url !== 'string') return null;
        
        let trimmed = url.trim();
        
        // تحويل روابط Google Drive القديمة
        const oldDrivePattern = /https?:\/\/drive\.google\.com\/uc\?export=view&id=([a-zA-Z0-9_-]+)/;
        const oldDriveMatch = trimmed.match(oldDrivePattern);
        if (oldDriveMatch) {
            const fileId = oldDriveMatch[1];
            trimmed = 'https://lh3.googleusercontent.com/d/' + fileId;
        }
        
        return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') ? trimmed : null;
    },

    /**
     * الحصول على اللغة الحالية
     */
    getCurrentLanguage() {
        try {
            return localStorage.getItem('language') || (typeof AppState !== 'undefined' && AppState?.currentLanguage) || 'ar';
        } catch (error) {
            // في حالة فشل الوصول إلى localStorage، نعيد اللغة الافتراضية
            return 'ar';
        }
    },

    applyModuleI18n(root) {
        const i18nCore = (window.AppI18n && typeof window.AppI18n.applyI18n === 'function')
            ? window.AppI18n
            : ((window.I18n && typeof window.I18n.applyI18n === 'function') ? window.I18n : null);
        if (!i18nCore) return;
        const target = root || document.getElementById('clinic-section') || document;
        i18nCore.applyI18n(target);
        if (typeof i18nCore.applyLiteralTranslations === 'function') {
            i18nCore.applyLiteralTranslations(target);
        }
    },

    /**
     * الحصول على الترجمات حسب اللغة الحالية
     */
    getTranslations() {
        const lang = this.getCurrentLanguage();
        const isRTL = lang === 'ar';

        const translations = {
            ar: {
                // Table Headers - Visits Tab
                'table.employeeCode': 'الكود الوظيفي',
                'table.contractorName': 'اسم المقاول',
                'table.name': 'الاسم',
                'table.jobTitle': 'الوظيفة',
                'table.factory': 'المصنع',
                'table.workplace': 'مكان العمل',
                'table.entryTime': 'وقت الدخول',
                'table.exitTime': 'وقت الخروج',
                'table.totalTime': 'إجمالي الوقت',
                'table.reason': 'سبب الزيارة',
                'table.diagnosis': 'التشخيص',
                'table.medications': 'الأدوية المنصرفة',
                'table.medicationType': 'نوع الدواء',
                'table.quantity': 'الكمية المنصرفة',
                'table.dispenseDate': 'تاريخ الصرف',
                'table.patientName': 'اسم المريض',
                'table.department': 'الإدارة',
                'table.medicationStatus': 'حالة الدواء',
                'table.notes': 'ملاحظات',
                'table.actions': 'الإجراءات',
                'table.notRecorded': 'لم يتم تسجيله',
                
                // Buttons
                'btn.registerVisit': 'تسجيل زيارة',
                'btn.refresh': 'تحديث',
                'btn.exportExcel': 'تصدير Excel',
                'btn.exportPDF': 'تصدير PDF',
                'btn.reset': 'إعادة تعيين',
                'btn.view': 'عرض التفاصيل',
                'btn.edit': 'تعديل الزيارة',
                
                // Tabs
                'tab.visits': 'سجل التردد على العيادة',
                'tab.employees': 'الموظفين',
                'tab.contractors': 'المقاولين',
                'tab.dispensedLog': 'سجل الأدوية المنصرفة',
                
                // Filters
                'filter.search': 'البحث',
                'filter.factory': 'المصنع',
                'filter.jobTitle': 'الوظيفة',
                'filter.workplace': 'مكان العمل',
                'filter.all': 'الكل',
                'filter.searchPlaceholder': 'ابحث في جميع البيانات...',
                
                // Empty States
                'empty.noResults': 'لا توجد نتائج مطابقة لبحثك.',
                'empty.noEmployeeVisits': 'لا توجد زيارات موظفين مسجلة.',
                'empty.noContractorVisits': 'لا توجد زيارات مقاولين مسجلة.',
                
                // Time
                'time.lessThanMinute': 'أقل من دقيقة',
                'time.minutes': 'دقيقة',
                'time.hours': 'ساعة',
                'time.days': 'يوم'
            },
            en: {
                // Table Headers - Visits Tab
                'table.employeeCode': 'Employee Code',
                'table.contractorName': 'Contractor Name',
                'table.name': 'Name',
                'table.jobTitle': 'Job Title',
                'table.factory': 'Factory',
                'table.workplace': 'Workplace',
                'table.entryTime': 'Entry Time',
                'table.exitTime': 'Exit Time',
                'table.totalTime': 'Total Time',
                'table.reason': 'Reason for Visit',
                'table.diagnosis': 'Diagnosis',
                'table.medications': 'Dispensed Medications',
                'table.medicationType': 'Medication Type',
                'table.quantity': 'Dispensed Quantity',
                'table.dispenseDate': 'Dispense Date',
                'table.patientName': 'Patient Name',
                'table.department': 'Department',
                'table.medicationStatus': 'Medication Status',
                'table.notes': 'Notes',
                'table.actions': 'Actions',
                'table.notRecorded': 'Not Recorded',
                
                // Buttons
                'btn.registerVisit': 'Register Visit',
                'btn.refresh': 'Refresh',
                'btn.exportExcel': 'Export Excel',
                'btn.exportPDF': 'Export PDF',
                'btn.reset': 'Reset',
                'btn.view': 'View Details',
                'btn.edit': 'Edit Visit',
                
                // Tabs
                'tab.visits': 'Clinic Attendance Record',
                'tab.employees': 'Employees',
                'tab.contractors': 'Contractors',
                'tab.dispensedLog': 'Dispensed Medications Log',
                
                // Filters
                'filter.search': 'Search',
                'filter.factory': 'Factory',
                'filter.jobTitle': 'Job Title',
                'filter.workplace': 'Workplace',
                'filter.all': 'All',
                'filter.searchPlaceholder': 'Search all data...',
                
                // Empty States
                'empty.noResults': 'No results match your search.',
                'empty.noEmployeeVisits': 'No employee visits recorded.',
                'empty.noContractorVisits': 'No contractor visits recorded.',
                
                // Time
                'time.lessThanMinute': 'Less than a minute',
                'time.minutes': 'minute',
                'time.hours': 'hour',
                'time.days': 'day'
            }
        };

        return {
            t: (key) => translations[lang]?.[key] || key,
            isRTL,
            lang
        };
    },

    // ===== Configurable Data Analysis (like DailyObservations) =====
    clinicAnalysisCharts: null,

    getClinicAnalysisStorageKeys() {
        return {
            cards: 'clinic_infoCards',
            items: 'clinic_analysisItems'
        };
    },

    getClinicDefaultAnalysisCards() {
        return [
            {
                id: 'card_total_visits',
                title: 'إجمالي الزيارات',
                icon: 'fas fa-hospital-user',
                color: 'blue',
                description: 'إجمالي عدد زيارات العيادة المسجلة',
                enabled: true,
                mode: 'metric',
                metric: 'totalVisits'
            },
            {
                id: 'card_total_dispensed_qty',
                title: 'إجمالي المنصرف',
                icon: 'fas fa-prescription-bottle-alt',
                color: 'green',
                description: 'إجمالي الكمية المصروفة من الأدوية عبر الزيارات',
                enabled: true,
                mode: 'metric',
                metric: 'totalDispensedQty'
            },
            {
                id: 'card_expired_meds',
                title: 'أدوية منتهية',
                icon: 'fas fa-exclamation-triangle',
                color: 'red',
                description: 'عدد الأدوية المنتهية الصلاحية',
                enabled: true,
                mode: 'metric',
                metric: 'expiredMedications'
            },
            {
                id: 'card_low_stock',
                title: 'مخزون منخفض',
                icon: 'fas fa-box-open',
                color: 'orange',
                description: 'عدد الأدوية ذات الرصيد المنخفض (≤ 10)',
                enabled: true,
                mode: 'metric',
                metric: 'lowStockMedications'
            }
        ];
    },

    getClinicDefaultAnalysisItems() {
        return [
            { id: 'visits_by_reason', label: 'زيارات حسب سبب الزيارة', enabled: true, dataset: 'visits', field: 'reason', chartType: 'auto' },
            { id: 'visits_by_personType', label: 'زيارات حسب النوع (موظف/مقاول/خارجي)', enabled: true, dataset: 'visits', field: 'personType', chartType: 'auto' },
            { id: 'visits_by_factory', label: 'زيارات حسب المصنع', enabled: false, dataset: 'visits', field: 'factoryName', chartType: 'bar' },
            { id: 'meds_by_status', label: 'الأدوية حسب الحالة', enabled: true, dataset: 'medications', field: 'status', chartType: 'doughnut' },
            { id: 'meds_by_type', label: 'الأدوية حسب النوع', enabled: false, dataset: 'medications', field: 'type', chartType: 'bar' },
            { id: 'injuries_by_type', label: 'الإصابات حسب النوع', enabled: false, dataset: 'injuries', field: 'injuryType', chartType: 'bar' },
            { id: 'sickleave_by_status', label: 'الإجازات المرضية حسب الحالة', enabled: false, dataset: 'sickLeave', field: 'status', chartType: 'doughnut' },
            { id: 'supply_by_status', label: 'طلبات الاحتياجات حسب الحالة', enabled: false, dataset: 'supplyRequests', field: 'status', chartType: 'doughnut' }
        ];
    },

    /**
     * التأكد من تحميل Chart.js (بنفس منطق DailyObservations)
     */
    async ensureChartJSLoaded() {
        if (typeof Chart !== 'undefined') return true;

        const existingScript = document.querySelector('script[src*="chart.js"], script[src*="chartjs"]');
        if (existingScript) {
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (typeof Chart !== 'undefined') {
                        clearInterval(checkInterval);
                        resolve(true);
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve(typeof Chart !== 'undefined');
                }, 5000);
            });
        }

        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
            script.crossOrigin = 'anonymous';

            let done = false;
            const finish = (ok) => {
                if (done) return;
                done = true;
                resolve(!!ok);
            };

            script.onload = () => setTimeout(() => finish(typeof Chart !== 'undefined'), 400);
            script.onerror = () => {
                const fallback = document.createElement('script');
                fallback.type = 'text/javascript';
                fallback.async = true;
                fallback.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
                fallback.crossOrigin = 'anonymous';
                fallback.onload = () => setTimeout(() => finish(typeof Chart !== 'undefined'), 400);
                fallback.onerror = () => finish(false);
                document.head.appendChild(fallback);
            };

            setTimeout(() => finish(typeof Chart !== 'undefined'), 8000);

            try {
                document.head.appendChild(script);
            } catch (e) {
                finish(false);
            }
        });
    },

    /**
     * حقن أنماط CSS لشريط التمرير في جداول العيادة
     */
    injectTableScrollbarStyles() {
        const styleId = 'clinic-table-scrollbar-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* شريط التمرير لجداول العيادة */
            .clinic-table-wrapper {
                position: relative;
                overflow-x: auto;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                scroll-behavior: smooth;
                max-height: 70vh;
                width: 100%;
            }

            /* دعم LTR للجداول */
            [dir="ltr"] .clinic-table-wrapper table,
            [dir="ltr"] .clinic-table-wrapper {
                direction: ltr;
            }

            [dir="ltr"] .clinic-table-wrapper table th,
            [dir="ltr"] .clinic-table-wrapper table td {
                text-align: left;
            }

            [dir="ltr"] .clinic-table-wrapper table th.text-center,
            [dir="ltr"] .clinic-table-wrapper table td.text-center {
                text-align: center;
            }

            /* دعم RTL للجداول */
            [dir="rtl"] .clinic-table-wrapper table,
            [dir="rtl"] .clinic-table-wrapper {
                direction: rtl;
            }

            [dir="rtl"] .clinic-table-wrapper table th,
            [dir="rtl"] .clinic-table-wrapper table td {
                text-align: right;
            }

            [dir="rtl"] .clinic-table-wrapper table th.text-center,
            [dir="rtl"] .clinic-table-wrapper table td.text-center {
                text-align: center;
            }

            /* تخصيص شريط التمرير الأفقي (الأسفل) */
            .clinic-table-wrapper::-webkit-scrollbar:horizontal {
                height: 12px;
            }

            .clinic-table-wrapper::-webkit-scrollbar-track:horizontal {
                background: var(--bg-secondary, #f3f4f6);
                border-radius: 6px;
                margin: 0 10px;
            }

            .clinic-table-wrapper::-webkit-scrollbar-thumb:horizontal {
                background: var(--primary-color, #3b82f6);
                border-radius: 6px;
                border: 2px solid var(--bg-secondary, #f3f4f6);
            }

            .clinic-table-wrapper::-webkit-scrollbar-thumb:horizontal:hover {
                background: var(--primary-color-dark, #2563eb);
            }

            /* تخصيص شريط التمرير العمودي (الجانبي) */
            .clinic-table-wrapper::-webkit-scrollbar:vertical {
                width: 12px;
            }

            .clinic-table-wrapper::-webkit-scrollbar-track:vertical {
                background: var(--bg-secondary, #f3f4f6);
                border-radius: 6px;
                margin: 10px 0;
            }

            .clinic-table-wrapper::-webkit-scrollbar-thumb:vertical {
                background: var(--primary-color, #3b82f6);
                border-radius: 6px;
                border: 2px solid var(--bg-secondary, #f3f4f6);
            }

            .clinic-table-wrapper::-webkit-scrollbar-thumb:vertical:hover {
                background: var(--primary-color-dark, #2563eb);
            }

            /* شريط التمرير العام (للتوافق مع المتصفحات) */
            .clinic-table-wrapper::-webkit-scrollbar {
                width: 12px;
                height: 12px;
            }

            .clinic-table-wrapper::-webkit-scrollbar-track {
                background: var(--bg-secondary, #f3f4f6);
                border-radius: 6px;
            }

            .clinic-table-wrapper::-webkit-scrollbar-thumb {
                background: var(--primary-color, #3b82f6);
                border-radius: 6px;
                border: 2px solid var(--bg-secondary, #f3f4f6);
            }

            .clinic-table-wrapper::-webkit-scrollbar-thumb:hover {
                background: var(--primary-color-dark, #2563eb);
            }

            /* للوضع الداكن */
            [data-theme="dark"] .clinic-table-wrapper::-webkit-scrollbar-track {
                background: var(--bg-secondary, #1f2937);
            }

            [data-theme="dark"] .clinic-table-wrapper::-webkit-scrollbar-thumb {
                background: var(--primary-color, #60a5fa);
                border-color: var(--bg-secondary, #1f2937);
            }

            [data-theme="dark"] .clinic-table-wrapper::-webkit-scrollbar-thumb:hover {
                background: var(--primary-color-dark, #3b82f6);
            }

            /* تحسينات للجوال */
            @media (max-width: 768px) {
                .clinic-table-wrapper {
                    max-height: 60vh;
                }

                .clinic-table-wrapper::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }

                .clinic-table-wrapper::-webkit-scrollbar-thumb {
                    border-width: 1px;
                }
            }

            /* إضافة ظلال عند التمرير */
            .clinic-table-wrapper {
                position: relative;
            }

            .clinic-table-wrapper::before,
            .clinic-table-wrapper::after {
                content: '';
                position: sticky;
                pointer-events: none;
                z-index: 10;
                opacity: 0;
                transition: opacity 0.3s;
            }

            .clinic-table-wrapper::before {
                top: 0;
                left: 0;
                right: 0;
                height: 20px;
                background: linear-gradient(to bottom, rgba(0, 0, 0, 0.1), transparent);
            }

            .clinic-table-wrapper::after {
                bottom: 0;
                left: 0;
                right: 0;
                height: 20px;
                background: linear-gradient(to top, rgba(0, 0, 0, 0.1), transparent);
            }

            .clinic-table-wrapper.scrolled-top::before {
                opacity: 0;
            }

            .clinic-table-wrapper:not(.scrolled-top)::before {
                opacity: 1;
            }

            .clinic-table-wrapper.scrolled-bottom::after {
                opacity: 0;
            }

            .clinic-table-wrapper:not(.scrolled-bottom)::after {
                opacity: 1;
            }
            
            /* ✅ أنماط الفلاتر الاحترافية لسجل التردد */
            .visits-filters-row {
                position: relative;
            }
            .visits-filters-row .filters-grid {
                width: 100%;
            }
            .visits-filters-row .filter-field {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .visits-filters-row .filter-label {
                font-size: 12px;
                font-weight: 600;
                color: #4a5568;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .visits-filters-row .filter-label i {
                font-size: 11px;
                color: #667eea;
            }
            .visits-filters-row .filter-input {
                width: 100%;
                padding: 10px 12px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: white;
                font-size: 14px;
                color: #2d3748;
                transition: all 0.2s ease;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            }
            .visits-filters-row .filter-input:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            .visits-filters-row .filter-input:hover {
                border-color: #cbd5e0;
            }
            .visits-filters-row .filter-reset-btn {
                width: 100%;
                padding: 10px 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .visits-filters-row .filter-reset-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
            }
            .visits-filters-row .filter-reset-btn:active {
                transform: translateY(0);
            }
            
            /* ✅ شارة العدد على الفلاتر */
            .filter-count-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 24px;
                height: 20px;
                padding: 2px 8px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 700;
                margin-right: 4px;
                box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
            }
            
            @media (max-width: 1200px) {
                .visits-filters-row .filters-grid {
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                }
            }
            @media (max-width: 768px) {
                .visits-filters-row .filters-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                .visits-filters-row {
                    padding: 12px 16px;
                    margin: 0 -16px 0 -16px;
                    width: calc(100% + 32px);
                }
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * إعداد مستمعي التمرير للجدول
     */
    setupTableScrollListeners(wrapper) {
        if (!wrapper) return;

        const updateScrollState = () => {
            const scrollTop = wrapper.scrollTop;
            const scrollLeft = wrapper.scrollLeft;
            const scrollHeight = wrapper.scrollHeight;
            const scrollWidth = wrapper.scrollWidth;
            const clientHeight = wrapper.clientHeight;
            const clientWidth = wrapper.clientWidth;

            // إدارة حالة التمرير العمودي
            if (scrollTop === 0) {
                wrapper.classList.add('scrolled-top');
            } else {
                wrapper.classList.remove('scrolled-top');
            }

            if (scrollTop + clientHeight >= scrollHeight - 1) {
                wrapper.classList.add('scrolled-bottom');
            } else {
                wrapper.classList.remove('scrolled-bottom');
            }

            // إدارة حالة التمرير الأفقي
            if (scrollLeft === 0) {
                wrapper.classList.add('scrolled-left');
            } else {
                wrapper.classList.remove('scrolled-left');
            }

            if (scrollLeft + clientWidth >= scrollWidth - 1) {
                wrapper.classList.add('scrolled-right');
            } else {
                wrapper.classList.remove('scrolled-right');
            }
        };

        // تحديث الحالة عند التمرير
        wrapper.addEventListener('scroll', updateScrollState);
        
        // تحديث الحالة عند تغيير الحجم
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(() => {
                updateScrollState();
            });
            resizeObserver.observe(wrapper);
        }

        // تحديث الحالة الأولية
        updateScrollState();
    },

    loadClinicDataAnalysis() {
        if (!this.isCurrentUserAdmin()) return;

        // كروت
        this.loadClinicInfoCards();

        // بنود التحليل
        const keys = this.getClinicAnalysisStorageKeys();
        const raw = localStorage.getItem(keys.items) || '[]';
        let items = [];
        try { items = JSON.parse(raw) || []; } catch (e) { items = []; }

        if (!Array.isArray(items) || items.length === 0) {
            localStorage.setItem(keys.items, JSON.stringify(this.getClinicDefaultAnalysisItems()));
            items = this.getClinicDefaultAnalysisItems();
        }

        const itemsList = document.getElementById('clinic-analysis-items-list');
        if (itemsList) {
            itemsList.innerHTML = items.map(item => `
                <div class="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
                    <label class="flex items-center cursor-pointer flex-1">
                        <input type="checkbox" class="clinic-analysis-item-checkbox mr-2" data-item-id="${item.id}" ${item.enabled ? 'checked' : ''}>
                        <span>${Utils.escapeHTML(item.label || item.id)}</span>
                    </label>
                    <button class="btn-icon btn-icon-danger ml-2" onclick="Clinic.removeClinicAnalysisItem('${item.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');

            itemsList.querySelectorAll('.clinic-analysis-item-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const id = e.target.getAttribute('data-item-id');
                    this.toggleClinicAnalysisItem(id, e.target.checked);
                });
            });
        }

        // ربط إدارة الكروت (باستخدام onclick لتجنب تكرار الربط عند إعادة العرض)
        const manageBtn = document.getElementById('clinic-manage-cards-btn');
        if (manageBtn) manageBtn.onclick = () => this.showManageClinicCardsModal();

        // ربط إضافة بند جديد
        const addItemBtn = document.getElementById('clinic-add-analysis-item-btn');
        if (addItemBtn) addItemBtn.onclick = () => this.addClinicAnalysisItemFromUI();

        const datasetSelect = document.getElementById('clinic-new-analysis-dataset');
        const fieldSelect = document.getElementById('clinic-new-analysis-field');
        const customFieldWrap = document.getElementById('clinic-custom-field-wrap');
        const customFieldInput = document.getElementById('clinic-new-analysis-custom-field');

        const renderFieldsForDataset = () => {
            if (!fieldSelect || !datasetSelect) return;
            const ds = datasetSelect.value;
            const optionsMap = this.getClinicAnalysisFieldsMap();
            const fields = optionsMap[ds] || [];
            fieldSelect.innerHTML = fields.map(f => `<option value="${f.value}">${Utils.escapeHTML(f.label)}</option>`).join('') +
                `<option value="__custom__">حقل مخصص...</option>`;
            if (customFieldWrap) customFieldWrap.style.display = 'none';
            if (customFieldInput) customFieldInput.value = '';
        };

        if (datasetSelect) {
            datasetSelect.onchange = () => renderFieldsForDataset();
        }

        if (fieldSelect) {
            fieldSelect.onchange = () => {
                const isCustom = fieldSelect.value === '__custom__';
                if (customFieldWrap) customFieldWrap.style.display = isCustom ? 'block' : 'none';
                if (!isCustom && customFieldInput) customFieldInput.value = '';
            };
        }

        // تهيئة الحقول أول مرة
        if (datasetSelect && fieldSelect && fieldSelect.options.length === 0) {
            renderFieldsForDataset();
        }

        this.updateClinicAnalysisResults();
    },

    getClinicAnalysisFieldsMap() {
        return {
            visits: [
                { value: 'reason', label: 'سبب الزيارة' },
                { value: 'diagnosis', label: 'التشخيص' },
                { value: 'personType', label: 'النوع (موظف/مقاول/خارجي)' },
                { value: 'employeeDepartment', label: 'الإدارة/القسم' },
                { value: 'employeePosition', label: 'الوظيفة' },
                { value: 'factoryName', label: 'المصنع' },
                { value: 'workplace', label: 'مكان العمل' },
                { value: 'byMonth', label: 'حسب الشهر' }
            ],
            medications: [
                { value: 'status', label: 'الحالة' },
                { value: 'type', label: 'نوع الدواء' },
                { value: 'location', label: 'موقع التخزين' }
            ],
            sickLeave: [
                { value: 'status', label: 'الحالة' },
                { value: 'employeeDepartment', label: 'الإدارة/القسم' },
                { value: 'personType', label: 'النوع (موظف/مقاول)' },
                { value: 'byMonth', label: 'حسب الشهر' }
            ],
            injuries: [
                { value: 'status', label: 'الحالة' },
                { value: 'injuryType', label: 'نوع الإصابة' },
                { value: 'injuryLocation', label: 'موقع الإصابة' },
                { value: 'employeeDepartment', label: 'الإدارة/القسم' },
                { value: 'personType', label: 'النوع (موظف/مقاول)' },
                { value: 'byMonth', label: 'حسب الشهر' }
            ],
            supplyRequests: [
                { value: 'status', label: 'الحالة' },
                { value: 'type', label: 'نوع الطلب' },
                { value: 'priority', label: 'الأولوية' },
                { value: 'byMonth', label: 'حسب الشهر' }
            ]
        };
    },

    getClinicDatasetForAnalysis(dataset) {
        this.ensureData();
        switch (dataset) {
            case 'visits':
                return Array.isArray(AppState.appData.clinicVisits) ? AppState.appData.clinicVisits : [];
            case 'medications':
                return (Array.isArray(AppState.appData.clinicMedications) ? AppState.appData.clinicMedications : []).map(m => this.normalizeMedicationRecord(m));
            case 'sickLeave':
                return Array.isArray(AppState.appData.sickLeave) ? AppState.appData.sickLeave : [];
            case 'injuries':
                return Array.isArray(AppState.appData.injuries) ? AppState.appData.injuries : [];
            case 'supplyRequests':
                return Array.isArray(AppState.appData.clinicSupplyRequests) ? AppState.appData.clinicSupplyRequests : [];
            default:
                return [];
        }
    },

    getClinicAnalysisValue(dataset, field, record) {
        if (!record || typeof record !== 'object') return 'غير محدد';

        if (field === 'byMonth') {
            const dateStr =
                dataset === 'visits' ? (record.visitDate || record.createdAt) :
                    dataset === 'sickLeave' ? (record.startDate || record.createdAt) :
                        dataset === 'injuries' ? (record.injuryDate || record.createdAt) :
                            dataset === 'supplyRequests' ? (record.createdAt || record.requestDate) :
                                (record.createdAt || '');
            if (!dateStr) return 'غير محدد';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'غير محدد';
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        if (field === 'personType') {
            const raw = (record.personType || '').toString().toLowerCase();
            if (raw === 'contractor') return 'مقاول';
            if (raw === 'external') return 'خارجي';
            if (raw === 'employee' || raw === '') return 'موظف';
            // إذا كانت قيم عربية بالفعل
            if (raw.includes('مقاول')) return 'مقاول';
            if (raw.includes('خار')) return 'خارجي';
            if (raw.includes('موظ')) return 'موظف';
            return record.personType || 'غير محدد';
        }

        if (dataset === 'visits' && field === 'workplace') {
            return record.employeeLocation || record.workArea || 'غير محدد';
        }

        // direct read (supports custom fields too)
        const v = record[field];
        const value = (v === null || v === undefined || v === '') ? 'غير محدد' : String(v).trim();
        return value && value !== 'null' && value !== 'undefined' ? value : 'غير محدد';
    },

    analyzeClinicByItem(item) {
        const dataset = item.dataset;
        const field = item.field;
        const records = this.getClinicDatasetForAnalysis(dataset);
        const counts = {};
        let total = 0;

        records.forEach(rec => {
            const value = this.getClinicAnalysisValue(dataset, field, rec);
            counts[value] = (counts[value] || 0) + 1;
            total++;
        });

        return Object.entries(counts)
            .map(([label, count]) => ({
                label,
                count,
                percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
            }))
            .sort((a, b) => b.count - a.count);
    },

    async updateClinicAnalysisResults() {
        const resultsContainer = document.getElementById('clinic-analysis-results');
        if (!resultsContainer) return;

        const keys = this.getClinicAnalysisStorageKeys();
        let items = [];
        try { items = JSON.parse(localStorage.getItem(keys.items) || '[]') || []; } catch (e) { items = []; }
        const enabledItems = (Array.isArray(items) ? items : []).filter(i => i.enabled);

        if (enabledItems.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <p class="text-gray-500">لا توجد بنود مفعلة للتحليل.</p>
                </div>
            `;
            return;
        }

        // تحديث قيم الكروت
        this.calculateClinicCardValues();

        let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">';
        enabledItems.forEach((item, index) => {
            const analysis = this.analyzeClinicByItem(item);
            const chartId = `clinic-chart-${item.id}-${index}`;
            const chartContainerId = `clinic-chart-container-${item.id}-${index}`;
            html += `
                <div class="content-card">
                    <div class="card-header">
                        <h4 class="font-semibold text-lg">
                            <i class="fas fa-chart-bar ml-2"></i>
                            ${Utils.escapeHTML(item.label || item.id)}
                        </h4>
                        <p class="text-xs text-gray-500 mt-1">${Utils.escapeHTML(item.dataset)} • ${Utils.escapeHTML(item.field)}</p>
                    </div>
                    <div class="card-body">
                        <div id="${chartContainerId}" style="position: relative; height: 300px; margin-bottom: 20px;">
                            <canvas id="${chartId}"></canvas>
                        </div>
                        <div class="border-t pt-4">
                            <h5 class="font-semibold mb-3 text-sm text-gray-700">التفاصيل:</h5>
                            <div class="space-y-2">
                                ${analysis.slice(0, 20).map(stat => `
                                    <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                                        <span class="text-sm">${Utils.escapeHTML(stat.label)}</span>
                                        <div class="flex items-center gap-3">
                                            <span class="font-semibold">${stat.count}</span>
                                            <span class="text-xs text-gray-500">(${stat.percentage}%)</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        resultsContainer.innerHTML = html;

        setTimeout(async () => {
            const chartLoaded = await this.ensureChartJSLoaded();
            if (chartLoaded && typeof Chart !== 'undefined') {
                this.renderClinicAnalysisCharts(enabledItems);
            } else {
                const msg = document.createElement('div');
                msg.className = 'bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4';
                msg.innerHTML = `
                    <div class="flex items-center gap-2">
                        <i class="fas fa-exclamation-triangle text-yellow-600"></i>
                        <p class="text-sm text-yellow-800">
                            <strong>ملاحظة:</strong> تعذر تحميل مكتبة الرسوم البيانية حالياً. البيانات متاحة في القوائم أدناه.
                        </p>
                    </div>
                `;
                resultsContainer.prepend(msg);
            }
        }, 250);
    },

    renderClinicAnalysisCharts(enabledItems) {
        if (typeof Chart === 'undefined') return;

        // destroy old charts
        if (this.clinicAnalysisCharts) {
            Object.values(this.clinicAnalysisCharts).forEach(ch => {
                if (ch && typeof ch.destroy === 'function') ch.destroy();
            });
        }
        this.clinicAnalysisCharts = {};

        const palette = [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(20, 184, 166, 0.8)',
            'rgba(251, 146, 60, 0.8)'
        ];

        enabledItems.forEach((item, index) => {
            const chartId = `clinic-chart-${item.id}-${index}`;
            const canvas = document.getElementById(chartId);
            if (!canvas) return;

            const analysis = this.analyzeClinicByItem(item);
            const labels = analysis.slice(0, 12).map(s => s.label);
            const data = analysis.slice(0, 12).map(s => s.count);
            const bg = labels.map((_, i) => palette[i % palette.length]);

            const type = item.chartType === 'auto'
                ? (labels.length > 6 ? 'bar' : 'doughnut')
                : (item.chartType || 'bar');

            try {
                const chart = new Chart(canvas, {
                    type,
                    data: {
                        labels,
                        datasets: [{
                            label: item.label || item.id,
                            data,
                            backgroundColor: bg,
                            borderColor: bg.map(c => c.replace('0.8', '1')),
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { padding: 12, usePointStyle: true }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        const label = context.label || '';
                                        const value = context.parsed || 0;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        return `${label}: ${value} (${percentage}%)`;
                                    }
                                }
                            }
                        },
                        ...(type === 'bar' ? {
                            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                        } : {})
                    }
                });

                this.clinicAnalysisCharts[chartId] = chart;
            } catch (e) {
                // ignore
            }
        });
    },

    loadClinicInfoCards() {
        const container = document.getElementById('clinic-info-cards-container');
        if (!container) return;

        const keys = this.getClinicAnalysisStorageKeys();
        let cards = [];
        try { cards = JSON.parse(localStorage.getItem(keys.cards) || '[]') || []; } catch (e) { cards = []; }

        if (!Array.isArray(cards) || cards.length === 0) {
            localStorage.setItem(keys.cards, JSON.stringify(this.getClinicDefaultAnalysisCards()));
            cards = this.getClinicDefaultAnalysisCards();
        }

        const enabledCards = cards.filter(c => c.enabled);
        if (enabledCards.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">لا توجد كروت مفعلة. استخدم زر "إدارة الكروت" لإضافة كروت جديدة.</p>';
            return;
        }

        const colorClasses = {
            blue: 'bg-blue-50 border-blue-200 text-blue-800',
            green: 'bg-green-50 border-green-200 text-green-800',
            red: 'bg-red-50 border-red-200 text-red-800',
            orange: 'bg-orange-50 border-orange-200 text-orange-800',
            purple: 'bg-purple-50 border-purple-200 text-purple-800',
            yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800'
        };

        container.innerHTML = enabledCards.map(card => {
            const cc = colorClasses[card.color] || colorClasses.blue;
            const iconColor = card.color || 'blue';
            return `
                <div class="content-card border-2 ${cc}">
                    <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <i class="${card.icon || 'fas fa-info-circle'} text-${iconColor}-600 text-xl"></i>
                            <h4 class="font-semibold">${Utils.escapeHTML(card.title || '')}</h4>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 mb-2">${Utils.escapeHTML(card.description || '')}</p>
                    <div class="mt-3 pt-3 border-t border-gray-200">
                        <div id="clinic-card-value-${card.id}" class="text-2xl font-bold text-${iconColor}-700">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.calculateClinicCardValues();
    },

    calculateClinicCardValues() {
        const keys = this.getClinicAnalysisStorageKeys();
        let cards = [];
        try { cards = JSON.parse(localStorage.getItem(keys.cards) || '[]') || []; } catch (e) { cards = []; }
        const enabledCards = (Array.isArray(cards) ? cards : []).filter(c => c.enabled);

        // Precompute base metrics
        this.ensureData();
        const visits = Array.isArray(AppState.appData.clinicVisits) ? AppState.appData.clinicVisits : [];
        const meds = (Array.isArray(AppState.appData.clinicMedications) ? AppState.appData.clinicMedications : []).map(m => this.normalizeMedicationRecord(m));

        const totalVisits = visits.length;
        const totalDispensedQty = visits.reduce((sum, v) => {
            const arr = this.normalizeVisitMedications(v.medications);
            return sum + arr.reduce((s, m) => s + (parseInt(m.quantity, 10) || 0), 0);
        }, 0);

        const expiredMedications = meds.filter(m => (m.status || '') === 'منتهي').length;
        const lowStockMedications = meds.filter(m => (m.remainingQuantity ?? 0) <= 10 && (m.remainingQuantity ?? 0) > 0).length;
        const totalMedications = meds.length;

        const metricMap = {
            totalVisits,
            totalDispensedQty,
            expiredMedications,
            lowStockMedications,
            totalMedications
        };

        enabledCards.forEach(card => {
            const el = document.getElementById(`clinic-card-value-${card.id}`);
            if (!el) return;

            let value = 0;
            if (card.mode === 'metric' && card.metric) {
                value = metricMap[card.metric] ?? 0;
            } else if (card.mode === 'countByField') {
                const ds = card.dataset || 'visits';
                const field = card.field || '';
                const fieldValue = (card.fieldValue || '').toString().trim();
                const records = this.getClinicDatasetForAnalysis(ds);
                value = records.filter(r => {
                    const v = this.getClinicAnalysisValue(ds, field, r);
                    if (!fieldValue) return v && v !== 'غير محدد';
                    return v === fieldValue;
                }).length;
            }

            el.textContent = Number(value || 0).toLocaleString('en-US');
        });
    },

    showManageClinicCardsModal() {
        if (!this.isCurrentUserAdmin()) {
            Notification?.error?.('ليس لديك صلاحية للوصول إلى هذه الميزة');
            return;
        }

        const keys = this.getClinicAnalysisStorageKeys();
        let cards = [];
        try { cards = JSON.parse(localStorage.getItem(keys.cards) || '[]') || []; } catch (e) { cards = []; }
        if (!Array.isArray(cards) || cards.length === 0) {
            cards = this.getClinicDefaultAnalysisCards();
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 980px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">
                        <i class="fas fa-edit ml-2"></i>
                        إدارة كروت تحليل العيادة
                    </h2>
                    <button class="modal-close" title="إغلاق"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <div class="mb-4 flex justify-between items-center">
                        <button id="clinic-add-new-card-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>إضافة كرت جديد
                        </button>
                        <div class="text-sm text-gray-500">يمكنك اختيار "مؤشر جاهز" أو "عدد حسب حقل"</div>
                    </div>
                    <div id="clinic-cards-list-container" class="space-y-3">
                        ${cards.map((c, idx) => this.renderClinicCardEditForm(c, idx)).join('')}
                    </div>
                </div>
                <div class="modal-footer form-actions-centered">
                    <button type="button" class="btn-secondary" data-action="close">إغلاق</button>
                    <button type="button" id="clinic-save-cards-btn" class="btn-primary">
                        <i class="fas fa-save ml-2"></i>حفظ التغييرات
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('.modal-close')?.addEventListener('click', close);
        modal.querySelector('[data-action="close"]')?.addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النافذة.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) close();
            }
        });

        const list = modal.querySelector('#clinic-cards-list-container');

        const addNew = () => {
            const newCard = {
                id: `card_${Date.now()}`,
                title: 'كرت جديد',
                icon: 'fas fa-info-circle',
                color: 'blue',
                description: '',
                enabled: true,
                mode: 'metric',
                metric: 'totalVisits'
            };
            const wrapper = document.createElement('div');
            wrapper.innerHTML = this.renderClinicCardEditForm(newCard, (list?.children?.length || 0));
            list?.appendChild(wrapper.firstElementChild);
            this.bindClinicCardEditEvents(modal);
        };

        modal.querySelector('#clinic-add-new-card-btn')?.addEventListener('click', addNew);

        modal.querySelector('#clinic-save-cards-btn')?.addEventListener('click', () => {
            const forms = modal.querySelectorAll('.clinic-card-edit-form');
            const updated = [];
            forms.forEach(form => {
                const id = form.getAttribute('data-card-id');
                const enabled = form.querySelector('[name="enabled"]')?.checked;
                const title = form.querySelector('[name="title"]')?.value || '';
                const description = form.querySelector('[name="description"]')?.value || '';
                const icon = form.querySelector('[name="icon"]')?.value || 'fas fa-info-circle';
                const color = form.querySelector('[name="color"]')?.value || 'blue';
                const mode = form.querySelector('[name="mode"]')?.value || 'metric';
                const metric = form.querySelector('[name="metric"]')?.value || 'totalVisits';
                const dataset = form.querySelector('[name="dataset"]')?.value || 'visits';
                const field = form.querySelector('[name="field"]')?.value || '';
                const fieldValue = form.querySelector('[name="fieldValue"]')?.value || '';

                updated.push({ id, enabled, title, description, icon, color, mode, metric, dataset, field, fieldValue });
            });
            localStorage.setItem(keys.cards, JSON.stringify(updated));
            close();
            this.loadClinicInfoCards();
            this.calculateClinicCardValues();
            Notification?.success?.('تم حفظ الكروت بنجاح');
        });

        this.bindClinicCardEditEvents(modal);
    },

    renderClinicCardEditForm(card, index) {
        const safe = (v) => Utils.escapeHTML(v || '');
        const metricOptions = [
            { value: 'totalVisits', label: 'إجمالي الزيارات' },
            { value: 'totalDispensedQty', label: 'إجمالي المنصرف' },
            { value: 'totalMedications', label: 'إجمالي الأدوية' },
            { value: 'expiredMedications', label: 'أدوية منتهية' },
            { value: 'lowStockMedications', label: 'مخزون منخفض (≤10)' }
        ];

        const datasets = [
            { value: 'visits', label: 'زيارات' },
            { value: 'medications', label: 'أدوية' },
            { value: 'sickLeave', label: 'إجازات مرضية' },
            { value: 'injuries', label: 'إصابات' },
            { value: 'supplyRequests', label: 'طلبات احتياجات' }
        ];

        return `
            <div class="clinic-card-edit-form border rounded-lg p-4 bg-white" data-card-id="${safe(card.id)}">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2 text-sm font-semibold">
                            <input type="checkbox" name="enabled" ${card.enabled ? 'checked' : ''}>
                            تفعيل
                        </label>
                        <span class="text-xs text-gray-500">#${index + 1}</span>
                    </div>
                    <button type="button" class="btn-icon btn-icon-danger clinic-remove-card-btn" data-card-id="${safe(card.id)}" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label for="clinic-card-${safe(card.id)}-title" class="block text-sm font-medium mb-2">العنوان</label>
                        <input type="text" id="clinic-card-${safe(card.id)}-title" name="title" class="form-input" value="${safe(card.title)}">
                    </div>
                    <div>
                        <label for="clinic-card-${safe(card.id)}-icon" class="block text-sm font-medium mb-2">الأيقونة (FontAwesome class)</label>
                        <input type="text" id="clinic-card-${safe(card.id)}-icon" name="icon" class="form-input" value="${safe(card.icon || 'fas fa-info-circle')}">
                    </div>
                    <div class="md:col-span-2">
                        <label for="clinic-card-${safe(card.id)}-description" class="block text-sm font-medium mb-2">الوصف</label>
                        <input type="text" id="clinic-card-${safe(card.id)}-description" name="description" class="form-input" value="${safe(card.description)}">
                    </div>
                    <div>
                        <label for="clinic-card-${safe(card.id)}-color" class="block text-sm font-medium mb-2">اللون</label>
                        <select id="clinic-card-${safe(card.id)}-color" name="color" class="form-input">
                            ${['blue', 'green', 'red', 'orange', 'purple', 'yellow'].map(c => `<option value="${c}" ${card.color === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label for="clinic-card-${safe(card.id)}-mode" class="block text-sm font-medium mb-2">نوع الكرت</label>
                        <select id="clinic-card-${safe(card.id)}-mode" name="mode" class="form-input clinic-card-mode">
                            <option value="metric" ${card.mode === 'metric' ? 'selected' : ''}>مؤشر جاهز</option>
                            <option value="countByField" ${card.mode === 'countByField' ? 'selected' : ''}>عدد حسب حقل</option>
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 clinic-card-metric-wrap" style="display:${card.mode === 'metric' ? 'grid' : 'none'}">
                    <div class="md:col-span-2">
                        <label for="clinic-card-${safe(card.id)}-metric" class="block text-sm font-medium mb-2">المؤشر</label>
                        <select id="clinic-card-${safe(card.id)}-metric" name="metric" class="form-input">
                            ${metricOptions.map(o => `<option value="${o.value}" ${card.metric === o.value ? 'selected' : ''}>${safe(o.label)}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 clinic-card-field-wrap" style="display:${card.mode === 'countByField' ? 'grid' : 'none'}">
                    <div>
                        <label for="clinic-card-${safe(card.id)}-dataset" class="block text-sm font-medium mb-2">المجموعة</label>
                        <select id="clinic-card-${safe(card.id)}-dataset" name="dataset" class="form-input">
                            ${datasets.map(d => `<option value="${d.value}" ${card.dataset === d.value ? 'selected' : ''}>${safe(d.label)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label for="clinic-card-${safe(card.id)}-field" class="block text-sm font-medium mb-2">الحقل</label>
                        <input type="text" id="clinic-card-${safe(card.id)}-field" name="field" class="form-input" placeholder="مثال: status / reason" value="${safe(card.field)}">
                    </div>
                    <div>
                        <label for="clinic-card-${safe(card.id)}-fieldValue" class="block text-sm font-medium mb-2">القيمة (اختياري)</label>
                        <input type="text" id="clinic-card-${safe(card.id)}-fieldValue" name="fieldValue" class="form-input" placeholder="إذا تُرك فارغًا = أي قيمة" value="${safe(card.fieldValue)}">
                    </div>
                </div>
            </div>
        `;
    },

    bindClinicCardEditEvents(modal) {
        modal.querySelectorAll('.clinic-remove-card-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cardId = btn.getAttribute('data-card-id');
                if (confirm('هل أنت متأكد من حذف هذا الكرت؟')) {
                    modal.querySelector(`.clinic-card-edit-form[data-card-id="${cardId}"]`)?.remove();
                }
            });
        });

        modal.querySelectorAll('.clinic-card-mode').forEach(sel => {
            sel.addEventListener('change', () => {
                const form = sel.closest('.clinic-card-edit-form');
                if (!form) return;
                const metricWrap = form.querySelector('.clinic-card-metric-wrap');
                const fieldWrap = form.querySelector('.clinic-card-field-wrap');
                const mode = sel.value;
                if (metricWrap) metricWrap.style.display = mode === 'metric' ? 'grid' : 'none';
                if (fieldWrap) fieldWrap.style.display = mode === 'countByField' ? 'grid' : 'none';
            });
        });
    },

    addClinicAnalysisItemFromUI() {
        if (!this.isCurrentUserAdmin()) {
            Notification?.error?.('ليس لديك صلاحية لإضافة بنود التحليل');
            return;
        }

        const datasetEl = document.getElementById('clinic-new-analysis-dataset');
        const fieldEl = document.getElementById('clinic-new-analysis-field');
        const customFieldEl = document.getElementById('clinic-new-analysis-custom-field');
        const labelEl = document.getElementById('clinic-new-analysis-label');
        const chartTypeEl = document.getElementById('clinic-new-analysis-charttype');

        const dataset = datasetEl?.value || 'visits';
        let field = fieldEl?.value || '';
        if (field === '__custom__') {
            field = (customFieldEl?.value || '').trim();
        }
        const label = (labelEl?.value || '').trim();
        const chartType = chartTypeEl?.value || 'auto';

        if (!field) {
            Notification?.warning?.('يرجى اختيار/إدخال الحقل');
            return;
        }
        if (!label) {
            Notification?.warning?.('يرجى إدخال اسم البند');
            return;
        }

        const keys = this.getClinicAnalysisStorageKeys();
        let items = [];
        try { items = JSON.parse(localStorage.getItem(keys.items) || '[]') || []; } catch (e) { items = []; }
        if (!Array.isArray(items)) items = [];

        const newItem = {
            id: `custom_${Date.now()}`,
            label,
            enabled: true,
            dataset,
            field,
            chartType
        };
        items.push(newItem);
        localStorage.setItem(keys.items, JSON.stringify(items));

        if (labelEl) labelEl.value = '';
        if (customFieldEl) customFieldEl.value = '';
        Notification?.success?.('تم إضافة البند بنجاح');
        this.loadClinicDataAnalysis();
    },

    toggleClinicAnalysisItem(itemId, enabled) {
        if (!this.isCurrentUserAdmin()) return;
        const keys = this.getClinicAnalysisStorageKeys();
        let items = [];
        try { items = JSON.parse(localStorage.getItem(keys.items) || '[]') || []; } catch (e) { items = []; }
        const item = (Array.isArray(items) ? items : []).find(i => i.id === itemId);
        if (item) {
            item.enabled = enabled;
            localStorage.setItem(keys.items, JSON.stringify(items));
            this.updateClinicAnalysisResults();
        }
    },

    removeClinicAnalysisItem(itemId) {
        if (!this.isCurrentUserAdmin()) return;
        if (!confirm('هل أنت متأكد من حذف هذا البند؟')) return;
        const keys = this.getClinicAnalysisStorageKeys();
        let items = [];
        try { items = JSON.parse(localStorage.getItem(keys.items) || '[]') || []; } catch (e) { items = []; }
        const filtered = (Array.isArray(items) ? items : []).filter(i => i.id !== itemId);
        localStorage.setItem(keys.items, JSON.stringify(filtered));
        this.loadClinicDataAnalysis();
        Notification?.success?.('تم حذف البند بنجاح');
    },

    calculateMedicationStatus(record) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // ✅ إصلاح: معالجة expiryDate بشكل صحيح سواء كان ISO string أو تاريخ عادي
        let expiryDate = null;
        if (record.expiryDate) {
            expiryDate = new Date(record.expiryDate);
            // إذا كان التاريخ غير صالح، حاول تفسيره كـ ISO string
            if (Number.isNaN(expiryDate.getTime())) {
                expiryDate = new Date(record.expiryDate);
            }
            expiryDate.setHours(0, 0, 0, 0);
        }

        // حساب الرصيد المتبقي
        const remainingQuantity = parseFloat(record.remainingQuantity ?? record.quantity ?? 0);
        const hasStock = remainingQuantity > 0;

        let status = 'ساري';
        let daysRemaining = null;

        if (expiryDate && !Number.isNaN(expiryDate.getTime())) {
            const diffTime = expiryDate.getTime() - today.getTime();
            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysRemaining < 0) {
                status = 'منتهي';
            } else if (daysRemaining <= 30) {
                // ✅ مهم: عرض "قريب الانتهاء" فقط إذا كان هناك رصيد متبقي
                // إذا كان الرصيد صفر، نعرضه كـ "ساري" لأنه لا يوجد مخزون لينتهي
                status = hasStock ? 'قريب الانتهاء' : 'ساري';
            }
        }

        return {
            status,
            daysRemaining
        };
    },

    getMedicationStatusClasses(status) {
        if (status === 'منتهي') {
            return 'bg-red-100 text-red-700';
        }
        if (status === 'قريب الانتهاء') {
            return 'bg-yellow-100 text-yellow-700';
        }
        return 'bg-green-100 text-green-700';
    },

    getMedicationStatusHint(info = {}) {
        if (!info || info.daysRemaining === null || info.daysRemaining === undefined) {
            return 'لم يتم تحديد تاريخ انتهاء الصلاحية للدواء';
        }
        if (info.daysRemaining < 0) {
            return 'انتهت صلاحية الدواء، يرجى اتخاذ الإجراء المناسب فوراً';
        }
        if (info.daysRemaining === 0) {
            return 'ينتهي الدواء اليوم، يرجى استخدامه أو التخلص منه حسب الإجراءات المعتمدة';
        }
        if (info.daysRemaining <= 30) {
            return `تبقى ${info.daysRemaining} يوم${info.daysRemaining === 1 ? '' : 'اً'} على انتهاء الصلاحية`;
        }
        return `الصلاحية سارية، يتبقى ${info.daysRemaining} يومًا تقريبًا`;
    },

    getInjuryStatusBadgeClass(status) {
        if (status === 'تم الشفاء') return 'badge-success';
        if (status === 'مغلق') return 'badge-info';
        return 'badge-warning';
    },

    getInjuryRowClass(status) {
        if (status === 'تم الشفاء') {
            return 'bg-green-50';
        }
        if (status === 'مغلق') {
            return 'bg-gray-50';
        }
        return 'bg-red-50';
    },

    viewInjuryRecord(id) {
        const record = this.getInjuries().find((item) => item.id === id);
        if (!record) {
            Notification?.error?.('تعذر العثور على سجل الإصابة');
            return;
        }

        const personType = String(record.personType || 'employee').toLowerCase();
        const isContractor = personType === 'contractor' || personType === 'external';
        const name = record.employeeName || record.personName || '';
        const contractorName = record.contractorName || '';
        const employeeCode = record.employeeCode || record.employeeNumber || '';
        const position = record.employeePosition || record.contractorPosition || '—';
        const department = record.department || record.employeeDepartment || '—';
        const factory = record.factoryName || record.factory || '—';
        const subLocation = record.subLocationName || record.subLocation || '—';
        const status = record.status || 'قيد المتابعة';
        const attachments = Array.isArray(record.attachments) ? record.attachments : [];

        const attachmentsHtml = attachments.length
            ? attachments.map((attachment, index) => {
                // التحقق مما إذا كان المرفق صورة
                const isImage = attachment.type && (attachment.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(attachment.name || ''));
                const attachmentUrl = this.processAttachmentUrl(attachment.data);
                
                if (isImage && attachmentUrl) {
                    return `
                        <div class="bg-white border border-blue-100 rounded-xl p-3 shadow-sm">
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center gap-2">
                                    <i class="fas fa-image text-blue-500"></i>
                                    <div>
                                        <div class="text-sm font-medium text-gray-700">${Utils.escapeHTML(attachment.name || `صورة ${index + 1}`)}</div>
                                        <div class="text-xs text-gray-500">${attachment.size || 0} KB</div>
                                    </div>
                                </div>
                                <a href="${attachmentUrl}" download="${Utils.escapeHTML(attachment.name || `attachment-${index + 1}`)}" class="btn-icon btn-icon-primary" title="تحميل">
                                    <i class="fas fa-download"></i>
                                </a>
                            </div>
                            <img src="${Utils.escapeHTML(attachmentUrl)}" alt="${Utils.escapeHTML(attachment.name || '')}" class="max-w-full h-auto rounded border" style="max-height: 250px;"
                                 onerror="this.onerror=null; this.style.display='none';">
                        </div>
                    `;
                } else {
                    return `
                        <div class="flex items-center justify-between bg-white border border-blue-100 rounded-xl px-3 py-2 shadow-sm">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-paperclip text-blue-500"></i>
                                <div>
                                    <div class="text-sm font-medium text-gray-700">${Utils.escapeHTML(attachment.name || `ملف ${index + 1}`)}</div>
                                    <div class="text-xs text-gray-500">${attachment.size || 0} KB</div>
                                </div>
                            </div>
                            <a href="${attachmentUrl || attachment.data}" download="${Utils.escapeHTML(attachment.name || `attachment-${index + 1}`)}" class="btn-icon btn-icon-primary" title="تحميل">
                                <i class="fas fa-download"></i>
                            </a>
                        </div>
                    `;
                }
            }).join('')
            : '<div class="text-sm text-gray-500 bg-white border border-dashed border-gray-300 rounded-xl p-3">لا توجد مرفقات للحالة.</div>';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 920px; border-radius: 16px; overflow: hidden;">
                <div class="modal-header modal-header-centered" style="background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%); color: white; padding: 16px 20px;">
                    <h2 class="modal-title" style="color: white; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-notes-medical"></i>
                        تفاصيل الإصابة الطبية
                    </h2>
                    <button type="button" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4" style="background: #f8fafc; padding: 18px;">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
                            <span class="text-xs font-semibold text-blue-700">نوع الشخص</span>
                            <p class="text-gray-900 font-semibold mt-1">${isContractor ? 'مقاول / خارجي' : 'موظف'}</p>
                        </div>
                        <div class="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
                            <span class="text-xs font-semibold text-blue-700">${isContractor ? 'اسم المقاول' : 'الكود الوظيفي'}</span>
                            <p class="text-gray-900 font-semibold mt-1">${Utils.escapeHTML(isContractor ? (contractorName || '—') : (employeeCode || '—'))}</p>
                        </div>
                        <div class="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
                            <span class="text-xs font-semibold text-blue-700">اسم المصاب</span>
                            <p class="text-gray-900 font-semibold mt-1">${Utils.escapeHTML(name)}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                            <span class="text-xs font-semibold text-gray-600">الإدارة / القسم</span>
                            <p class="text-gray-900 mt-1">${Utils.escapeHTML(department)}</p>
                        </div>
                        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                            <span class="text-xs font-semibold text-gray-600">الوظيفة</span>
                            <p class="text-gray-900 mt-1">${Utils.escapeHTML(position)}</p>
                        </div>
                        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                            <span class="text-xs font-semibold text-gray-600">تاريخ الإصابة</span>
                            <p class="text-gray-900 mt-1">${this.formatDate(record.injuryDate, true)}</p>
                        </div>
                        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                            <span class="text-xs font-semibold text-gray-600">المصنع / الموقع</span>
                            <p class="text-gray-900 mt-1">${Utils.escapeHTML(factory)}</p>
                        </div>
                        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                            <span class="text-xs font-semibold text-gray-600">الموقع الفرعي</span>
                            <p class="text-gray-900 mt-1">${Utils.escapeHTML(subLocation)}</p>
                        </div>
                        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                            <span class="text-xs font-semibold text-gray-600">الحالة</span>
                            <p class="mt-1">
                                <span class="badge ${this.getInjuryStatusBadgeClass(status)}">${Utils.escapeHTML(status)}</span>
                            </p>
                        </div>
                        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                            <span class="text-xs font-semibold text-gray-600">نوع الإصابة</span>
                            <p class="text-gray-900 mt-1">${Utils.escapeHTML(record.injuryType || '—')}</p>
                        </div>
                        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                            <span class="text-xs font-semibold text-gray-600">مكان الإصابة (بالجسم)</span>
                            <p class="text-gray-900 mt-1">${Utils.escapeHTML(record.injuryBodyPart || '—')}</p>
                        </div>
                        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:col-span-2">
                            <span class="text-xs font-semibold text-gray-600">مكان الإصابة</span>
                            <p class="text-gray-900 mt-1">${Utils.escapeHTML(record.injuryLocation || '—')}</p>
                        </div>
                    </div>

                    <div class="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
                        <span class="text-sm font-semibold text-red-700 block mb-1">وصف الإصابة</span>
                        <p class="text-gray-800 whitespace-pre-line leading-7">${Utils.escapeHTML(record.injuryDescription || '—')}</p>
                    </div>

                    ${record.actionsTaken ? `
                        <div class="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                            <span class="text-sm font-semibold text-amber-700 block mb-1">الإجراءات المتخذة</span>
                            <p class="text-gray-800 whitespace-pre-line leading-7">${Utils.escapeHTML(record.actionsTaken || '')}</p>
                    </div>
                    ` : ''}
                    ${record.treatment ? `
                        <div class="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
                            <span class="text-sm font-semibold text-emerald-700 block mb-1">العلاج</span>
                            <p class="text-gray-800 whitespace-pre-line leading-7">${Utils.escapeHTML(record.treatment || '')}</p>
                        </div>
                    ` : ''}

                    <div class="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                        <span class="text-sm font-semibold text-blue-700 mb-2 block">المرفقات</span>
                        <div class="space-y-2">
                            ${attachmentsHtml}
                        </div>
                    </div>

                    <div class="text-sm text-gray-500 border-t border-gray-200 pt-3">
                        ${record.createdBy?.name ? `<span class="font-medium">تم التسجيل بواسطة:</span> ${Utils.escapeHTML(record.createdBy.name)}` : ''}
                        ${record.createdAt ? `<span class="ml-2">بتاريخ ${this.formatDate(record.createdAt, true)}</span>` : ''}
                    </div>
                </div>
                <div class="modal-footer form-actions-centered" style="background: #f8fafc;">
                    <button type="button" class="btn-secondary modal-close-btn">إغلاق</button>
                    <button type="button" class="btn-primary modal-edit-btn">
                        <i class="fas fa-edit ml-2"></i>تعديل
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const closeModal = () => modal.remove();

        modal.querySelectorAll('.modal-close, .modal-close-btn').forEach((btn) => btn.addEventListener('click', closeModal));
        modal.querySelector('.modal-edit-btn')?.addEventListener('click', () => {
            closeModal();
            this.showInjuryForm(record);
        });
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النافذة.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) closeModal();
            }
        });
    },

    editInjury(id) {
        const record = this.getInjuries().find((item) => item.id === id);
        if (!record) {
            Notification?.error?.('تعذر العثور على السجل المطلوب');
            return;
        }
        this.showInjuryForm(record);
    },

    exportInjuriesToExcel() {
        const injuries = this.getFilteredInjuries();
        if (injuries.length === 0) {
            Notification?.info?.('لا توجد بيانات لتصديرها');
            return;
        }
        if (typeof XLSX === 'undefined') {
            Notification?.error?.('مكتبة Excel غير متوفرة');
            return;
        }

        const excelData = injuries.map((item) => ({
            'اسم المصاب': item.employeeName || item.personName || '',
            'القسم': item.department || item.employeeDepartment || '',
            'تاريخ الإصابة': this.formatDate(item.injuryDate, true),
            'نوع الإصابة': item.injuryType || '',
            'مكان الإصابة': item.injuryLocation || '',
            'الحالة': item.status || '',
            'عدد المرفقات': Array.isArray(item.attachments) ? item.attachments.length : 0,
            'الإجراءات المتخذة': item.actionsTaken || '',
            'العلاج': item.treatment || ''
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Injuries');
        const fileName = `Clinic_Injuries_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    },

    exportInjuriesToPDF() {
        const injuries = this.getFilteredInjuries();
        if (injuries.length === 0) {
            Notification?.info?.('لا توجد بيانات لتصديرها');
            return;
        }

        const rows = injuries.map((item) => `
            <tr>
                <td>${Utils.escapeHTML(item.employeeName || item.personName || '')}</td>
                <td>${Utils.escapeHTML(item.department || item.employeeDepartment || '')}</td>
                <td>${this.formatDate(item.injuryDate, true)}</td>
                <td>${Utils.escapeHTML(item.injuryType || '')}</td>
                <td>${Utils.escapeHTML(item.status || '')}</td>
                <td>${Array.isArray(item.attachments) ? item.attachments.length : 0}</td>
            </tr>
        `).join('');

        const content = `
            <table>
                <thead>
                    <tr>
                        <th>اسم المصاب</th>
                        <th>الإدارة / القسم</th>
                        <th>تاريخ الإصابة</th>
                        <th>نوع الإصابة</th>
                        <th>الحالة</th>
                        <th>عدد المرفقات</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;

        const formCode = `INJURIES-REPORT-${new Date().toISOString().slice(0, 10)}`;
        const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
            ? FormHeader.generatePDFHTML(formCode, 'تقرير الإصابات الطبية', content, false, true)
            : `<html><body>${content}</body></html>`;

        try {
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }, 400);
                };
            } else {
                Notification?.error?.('يرجى السماح للنوافذ المنبثقة لتصدير PDF');
            }
        } catch (error) {
            Utils.safeError('فشل تصدير تقرير الإصابات الطبية:', error);
            Notification?.error?.('تعذر تصدير تقرير الإصابات الطبية');
        }
    },

    normalizeMedicationRecord(record = {}) {
        const toNumber = (value, fallback = 0) => {
            if (value === null || value === undefined) return fallback;
            if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
            if (typeof value === 'string') {
                const s = value.trim();
                if (!s) return fallback;
                // allow "1,234" or "1 234"
                const normalized = s.replace(/[, ]+/g, '');
                const n = Number(normalized);
                return Number.isFinite(n) ? n : fallback;
            }
            return fallback;
        };

        const id = record.id || Utils.generateId('MED');
        const name = record.name || record.medicationName || '';
        const type = record.type || record.medicationType || record.category || '';
        const purchaseDate = record.purchaseDate || record.buyDate || record.createdAt || new Date().toISOString();
        const expiryDate = record.expiryDate || record.endDate || '';
        const quantityAdded = record.quantityAdded !== undefined && record.quantityAdded !== null
            ? toNumber(record.quantityAdded, 0)
            : (record.initialQuantity !== undefined && record.initialQuantity !== null
                ? toNumber(record.initialQuantity, 0)
                : toNumber(record.quantity, 0));
        const remainingQuantity = record.remainingQuantity !== undefined && record.remainingQuantity !== null
            ? toNumber(record.remainingQuantity, 0)
            : (record.quantityRemaining !== undefined && record.quantityRemaining !== null
                ? toNumber(record.quantityRemaining, 0)
                : toNumber(record.quantity, 0));
        const location = record.location || record.storageLocation || '';
        const createdAt = record.createdAt || new Date().toISOString();
        const updatedAt = record.updatedAt || createdAt;
        const createdBy = (typeof record.createdBy === 'string' && record.createdBy.trim() !== '')
            ? { id: record.createdById || '', name: record.createdBy.trim() }
            : (record.createdBy || this.getCurrentUserSummary(record.createdBy));
        const createdById = record.createdById || createdBy?.id || AppState.currentUser?.id || '';
        const updatedBy = record.updatedBy || this.getCurrentUserSummary(record.updatedBy);
        const notes = record.notes || record.description || '';
        const usage = record.usage || '';
        const statusInfo = this.calculateMedicationStatus({ expiryDate });

        return {
            id,
            name,
            type,
            usage,
            purchaseDate,
            expiryDate,
            quantityAdded: toNumber(quantityAdded, 0),
            remainingQuantity: toNumber(remainingQuantity, 0),
            location,
            notes,
            createdBy,
            createdById,
            createdAt,
            updatedAt,
            updatedBy,
            status: record.status || statusInfo.status,
            daysRemaining: record.daysRemaining !== undefined ? record.daysRemaining : statusInfo.daysRemaining
        };
    },

    normalizeSickLeaveRecord(record = {}) {
        const id = record.id || Utils.generateId('SICK_LEAVE');
        const personType = record.personType || 'employee';
        const startDate = record.startDate ? new Date(record.startDate).toISOString() : new Date().toISOString();
        const endDate = record.endDate ? new Date(record.endDate).toISOString() : startDate;
        const createdAt = record.createdAt || new Date().toISOString();
        const updatedAt = record.updatedAt || createdAt;
        const createdBy = record.createdBy || this.getCurrentUserSummary(record.createdBy);
        const createdById = record.createdById || createdBy?.id || AppState.currentUser?.id || '';
        const updatedBy = record.updatedBy || this.getCurrentUserSummary(record.updatedBy);

        const daysCount = this.calculateSickLeaveDays(startDate, endDate);

        return {
            id,
            personType,
            employeeName: record.employeeName || record.personName || '',
            employeeCode: record.employeeCode || record.employeeNumber || '',
            employeeNumber: record.employeeNumber || record.employeeCode || '',
            employeePosition: record.employeePosition || record.position || '',
            employeeDepartment: record.employeeDepartment || record.department || '',
            reason: record.reason || '',
            medicalNotes: record.medicalNotes || record.notes || '',
            treatingDoctor: record.treatingDoctor || record.doctor || '',
            startDate,
            endDate,
            daysCount,
            createdBy,
            createdById,
            createdAt,
            updatedAt,
            updatedBy
        };
    },

    normalizeInjuryRecord(record = {}) {
        const id = record.id || Utils.generateId('INJURY');
        const personType = record.personType || 'employee';
        const injuryDate = record.injuryDate ? new Date(record.injuryDate).toISOString() : new Date().toISOString();
        const createdAt = record.createdAt || new Date().toISOString();
        const updatedAt = record.updatedAt || createdAt;
        const createdBy = record.createdBy || this.getCurrentUserSummary(record.createdBy);
        const createdById = record.createdById || createdBy?.id || AppState.currentUser?.id || '';
        const updatedBy = record.updatedBy || this.getCurrentUserSummary(record.updatedBy);

        const attachments = Array.isArray(record.attachments)
            ? record.attachments.map((attachment) => this.normalizeAttachment(attachment)).filter(Boolean)
            : [];

        return {
            id,
            personType,
            employeeName: record.employeeName || '',
            contractorName: record.contractorName || '',
            personName: record.personName || record.employeeName || '',
            employeeCode: record.employeeCode || record.employeeNumber || '',
            employeeNumber: record.employeeNumber || record.employeeCode || '',
            employeePosition: record.employeePosition || record.contractorPosition || record.position || '',
            contractorPosition: record.contractorPosition || record.employeePosition || record.position || '',
            employeeDepartment: record.employeeDepartment || record.department || '',
            department: record.department || record.employeeDepartment || '',
            factory: record.factory || '',
            factoryName: record.factoryName || '',
            subLocation: record.subLocation || record.subLocationName || '',
            subLocationName: record.subLocationName || record.subLocation || '',
            injuryDate,
            injuryType: record.injuryType || record.type || '',
            injuryBodyPart: record.injuryBodyPart || '',
            injuryLocation: record.injuryLocation || record.location || '',
            injuryDescription: record.injuryDescription || record.description || '',
            actionsTaken: record.actionsTaken || record.actions || '',
            treatment: record.treatment || '',
            status: record.status || 'قيد المتابعة',
            attachments,
            createdBy,
            createdById,
            createdAt,
            updatedAt,
            updatedBy
        };
    },

    normalizeAttachment(attachment) {
        if (!attachment) return null;
        const data = attachment.data || attachment.base64 || '';
        if (!data) return null;
        const size = attachment.size || Math.round((data.length * 3) / 4 / 1024);
        return {
            id: attachment.id || Utils.generateId('ATT'),
            name: attachment.name || attachment.fileName || 'attachment',
            type: attachment.type || attachment.mimeType || 'application/octet-stream',
            data,
            size,
            uploadedAt: attachment.uploadedAt || new Date().toISOString()
        };
    },

    calculateSickLeaveDays(startISO, endISO) {
        try {
            const startDate = new Date(startISO);
            const endDate = new Date(endISO);
            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                return 1;
            }
            const diff = endDate.getTime() - startDate.getTime();
            return diff >= 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) + 1 : 1;
        } catch {
            return 1;
        }
    },

    formatDate(dateISO, withTime = false) {
        if (!dateISO) return '-';
        try {
            if (withTime) {
                return Utils.formatDateTime(dateISO);
            }
            return Utils.formatDate(dateISO);
        } catch {
            return '-';
        }
    },

    getMedications() {
        // محاولة الحصول من medications أولاً، ثم clinicMedications، ثم clinicInventory
        if (Array.isArray(AppState.appData?.medications) && AppState.appData.medications.length > 0) {
            return AppState.appData.medications;
        }
        if (Array.isArray(AppState.appData?.clinicMedications) && AppState.appData.clinicMedications.length > 0) {
            return AppState.appData.clinicMedications;
        }
        if (Array.isArray(AppState.appData?.clinicInventory) && AppState.appData.clinicInventory.length > 0) {
            return AppState.appData.clinicInventory;
        }
        return [];
    },

    getSickLeaves() {
        return Array.isArray(AppState.appData?.sickLeave) ? AppState.appData.sickLeave : [];
    },

    getInjuries() {
        return Array.isArray(AppState.appData?.injuries) ? AppState.appData.injuries : [];
    },

    // الحصول على قائمة المواقع (المصانع) من الإعدادات
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

    /** المواقع الفرعية للمصنع المختار (نفس منطق التدريب/التصاريح) */
    getPlaceOptions(siteId) {
        try {
            if (!siteId) return [];

            const sites = this.getSiteOptions();
            const selectedSite = sites.find(s => s.id === siteId);
            if (!selectedSite) return [];

            if (typeof Permissions !== 'undefined' && Permissions.formSettingsState && Permissions.formSettingsState.sites) {
                const site = Permissions.formSettingsState.sites.find(s => s.id === siteId);
                if (site && Array.isArray(site.places)) {
                    return site.places.map(place => ({
                        id: place.id,
                        name: place.name
                    }));
                }
            }

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
            Utils.safeWarn('⚠️ خطأ في الحصول على قائمة الأماكن الفرعية (العيادة):', error);
            return [];
        }
    },

    /**
     * ربط المصنع بحقل مكان العمل: تعبئة datalist بالمواقع الفرعية + بحث أثناء الكتابة + إدخال يدوي حر.
     * @param {string} factorySelectId
     * @param {string} locationInputId
     * @param {string} datalistId
     * @param {{ clearOnFactoryChange?: boolean }} [opts]
     */
    setupClinicWorkplaceDatalist(factorySelectId, locationInputId, datalistId, opts = {}) {
        const clearOnChange = opts.clearOnFactoryChange !== false;
        const factoryEl = document.getElementById(factorySelectId);
        const locInput = document.getElementById(locationInputId);
        const dl = document.getElementById(datalistId);
        if (!factoryEl || !locInput || !dl) return;

        const fillList = (clearLocation) => {
            const sid = (factoryEl.value || '').trim();
            const places = sid ? this.getPlaceOptions(sid) : [];
            dl.innerHTML = places.map(p => `<option value="${Utils.escapeHTML(p.name)}"></option>`).join('');
            if (clearLocation) locInput.value = '';
        };

        const handlerKey = '_clinicWorkplaceFactoryChange';
        if (factoryEl[handlerKey]) {
            factoryEl.removeEventListener('change', factoryEl[handlerKey]);
        }
        const onChange = () => fillList(clearOnChange);
        factoryEl[handlerKey] = onChange;
        factoryEl.addEventListener('change', onChange);
        fillList(false);
    },

    /** إعادة تعبئة قوائم المصنع عند اكتمال تحميل إعدادات النماذج (استدعاء تلقائي من حدث formSettingsUpdated) */
    refreshSiteDropdowns() {
        try {
            const sites = this.getSiteOptions();
            const esc = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML : (s) => String(s == null ? '' : s);
            const opts = (empty) => '<option value="">' + (empty || 'اختر المصنع') + '</option>' + (sites || []).map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>').join('');
            ['visits-filter-factory', 'visit-factory', 'visit-contractor-factory', 'enhanced-visit-factory'].forEach(id => {
                const el = document.getElementById(id);
                if (el && el.tagName === 'SELECT') { const v = el.value; el.innerHTML = opts('اختر المصنع'); if (v) el.value = v; }
            });
            if (typeof this.setupClinicWorkplaceDatalist === 'function') {
                this.setupClinicWorkplaceDatalist('visit-factory', 'visit-employee-location', 'visit-employee-location-datalist');
                this.setupClinicWorkplaceDatalist('visit-contractor-factory', 'visit-work-area', 'visit-work-area-datalist');
                this.setupClinicWorkplaceDatalist('enhanced-visit-factory', 'enhanced-visit-employee-location', 'enhanced-visit-employee-location-datalist');
            }
        } catch (e) { if (typeof Utils !== 'undefined' && Utils.safeWarn) Utils.safeWarn('⚠️ Clinic.refreshSiteDropdowns:', e); }
    },

    getExpiringMedications() {
        return this.getMedications().filter((item) => item.status === 'قريب الانتهاء' || item.status === 'منتهي');
    },

    /**
     * التأكد من وجود البيانات
     */
    ensureDataStructure() {
        if (typeof AppState === 'undefined' || !AppState.appData) return;
        const ad = AppState.appData;
        if (!ad.clinicMedications) ad.clinicMedications = [];
        if (!ad.injuries) ad.injuries = [];
        if (!ad.sickLeave) ad.sickLeave = [];
        if (!ad.clinicVisits) ad.clinicVisits = [];
        if (!ad.clinicSupplyRequests) ad.clinicSupplyRequests = [];
    },


    notifyMedicationAlerts() {
        const alerts = this.getExpiringMedications();
        alerts.forEach((med) => {
            if (!this.state.medicationAlertsNotified.has(med.id)) {
                if (med.status === 'منتهي') {
                    Notification?.error?.(`انتهت صلاحية الدواء ${Utils.escapeHTML(med.name || '')}`);
                } else {
                    Notification?.warning?.(`الدواء ${Utils.escapeHTML(med.name || '')} سينتهي خلال ${med.daysRemaining ?? 0} يوم`);
                }
                this.state.medicationAlertsNotified.add(med.id);
            }
        });
    },

    getFilteredMedications() {
        const filters = this.state.filters.medications || {};
        const searchTerm = (filters.search || '').toLowerCase();
        const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
        const toDate = filters.dateTo ? new Date(filters.dateTo) : null;
        const statusFilter = filters.status || 'all';

        return this.getMedications().filter((item) => {
            const matchesSearch = !searchTerm
                || (item.name && item.name.toLowerCase().includes(searchTerm))
                || (item.type && item.type.toLowerCase().includes(searchTerm))
                || (item.location && item.location.toLowerCase().includes(searchTerm));

            if (!matchesSearch) return false;

            if (statusFilter !== 'all' && item.status !== statusFilter) {
                return false;
            }

            if (fromDate) {
                const purchaseDate = item.purchaseDate ? new Date(item.purchaseDate) : null;
                if (!purchaseDate || purchaseDate < fromDate) {
                    return false;
                }
            }

            if (toDate) {
                const purchaseDate = item.purchaseDate ? new Date(item.purchaseDate) : null;
                if (!purchaseDate || purchaseDate > toDate) {
                    return false;
                }
            }

            return true;
        });
    },

    getFilteredSickLeaves() {
        const filters = this.state.filters.sickLeave || {};
        const searchTerm = (filters.search || '').toLowerCase();
        const departmentFilter = filters.department || '';
        const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
        const toDate = filters.dateTo ? new Date(filters.dateTo) : null;

        return this.getSickLeaves().filter((item) => {
            const matchesSearch = !searchTerm
                || (item.employeeName && item.employeeName.toLowerCase().includes(searchTerm))
                || (item.personName && item.personName.toLowerCase().includes(searchTerm))
                || (item.employeeDepartment && item.employeeDepartment.toLowerCase().includes(searchTerm));

            if (!matchesSearch) return false;

            if (departmentFilter && item.employeeDepartment !== departmentFilter) {
                return false;
            }

            const startDate = item.startDate ? new Date(item.startDate) : null;
            if (fromDate && (!startDate || startDate < fromDate)) {
                return false;
            }

            if (toDate && (!startDate || startDate > toDate)) {
                return false;
            }

            return true;
        });
    },

    getFilteredInjuries() {
        const filters = this.state.filters.injuries || {};
        const searchTerm = (filters.search || '').toLowerCase();
        const statusFilter = filters.status || 'all';
        const departmentFilter = filters.department || '';
        const injuryTypeFilter = filters.injuryType || 'all';
        const injuryBodyPartFilter = filters.injuryBodyPart || 'all';
        const activePersonTab = this.state.activeInjuryType || 'employees';
        const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
        const toDate = filters.dateTo ? new Date(filters.dateTo) : null;

        return this.getInjuries().filter((item) => {
            const searchableText = [
                item.employeeCode,
                item.employeeNumber,
                item.employeeName,
                item.personName,
                item.contractorName,
                item.employeeDepartment,
                item.department,
                item.factoryName,
                item.factory,
                item.subLocationName,
                item.subLocation,
                item.injuryType,
                item.injuryBodyPart,
                item.injuryLocation,
                item.status,
                item.injuryDescription
            ].map(v => String(v || '').toLowerCase()).join(' ');
            const matchesSearch = !searchTerm || searchableText.includes(searchTerm);

            if (!matchesSearch) return false;

            if (statusFilter !== 'all' && item.status !== statusFilter) {
                return false;
            }

            if (injuryTypeFilter !== 'all' && (item.injuryType || '') !== injuryTypeFilter) {
                return false;
            }
            if (injuryBodyPartFilter !== 'all' && (item.injuryBodyPart || '') !== injuryBodyPartFilter) {
                return false;
            }

            if (departmentFilter && item.department !== departmentFilter) {
                return false;
            }

            const pType = String(item.personType || 'employee').toLowerCase();
            if (activePersonTab === 'employees' && pType !== 'employee') return false;
            if (activePersonTab === 'contractors' && pType === 'employee') return false;

            const injuryDate = item.injuryDate ? new Date(item.injuryDate) : null;
            if (fromDate && (!injuryDate || injuryDate < fromDate)) {
                return false;
            }

            if (toDate && (!injuryDate || injuryDate > toDate)) {
                return false;
            }

            return true;
        });
    },

    renderEmptyState(message) {
        const { t, isRTL } = this.getTranslations();
        const defaultMessage = isRTL ? 'لا توجد بيانات' : 'No data available';
        return `
            <div class="empty-state" style="direction: ${isRTL ? 'rtl' : 'ltr'}; text-align: ${isRTL ? 'right' : 'left'};">
                <i class="fas fa-folder-open text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">${Utils.escapeHTML(message || defaultMessage)}</p>
            </div>
        `;
    },

    getClinicDepartments() {
        const departments = new Set();
        (AppState.appData?.employees || []).forEach((employee) => {
            const value = (employee?.department || '').trim();
            if (value) departments.add(value);
        });
        (AppState.appData?.sickLeave || []).forEach((leave) => {
            const value = (leave?.employeeDepartment || leave?.department || '').trim();
            if (value) departments.add(value);
        });
        (AppState.appData?.injuries || []).forEach((injury) => {
            const value = (injury?.employeeDepartment || injury?.department || '').trim();
            if (value) departments.add(value);
        });
        return Array.from(departments).sort((a, b) => a.localeCompare(b, 'ar'));
    },

    getMedicationBadgeClass(status) {
        if (status === 'منتهي') return 'badge-danger';
        if (status === 'قريب الانتهاء') return 'badge-warning';
        return 'badge-success';
    },

    renderTabNavigation() {
        const buttons = document.querySelectorAll('.clinic-tab-btn');
        buttons.forEach((btn) => {
            const tab = btn.getAttribute('data-tab');
            if (tab === this.state.activeTab) {
                // للتبويبات في قسم "سجلات العيادة التفصيلية" (btn-secondary/btn-primary)
                if (btn.classList.contains('btn-secondary') || btn.classList.contains('btn-primary')) {
                    btn.classList.remove('btn-secondary');
                    btn.classList.add('btn-primary');
                }
                // للتبويبات الرئيسية (active class)
                if (!btn.classList.contains('btn-secondary') && !btn.classList.contains('btn-primary')) {
                    btn.classList.add('active');
                }
            } else {
                // للتبويبات في قسم "سجلات العيادة التفصيلية"
                if (btn.classList.contains('btn-secondary') || btn.classList.contains('btn-primary')) {
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
                // للتبويبات الرئيسية
                if (!btn.classList.contains('btn-secondary') && !btn.classList.contains('btn-primary')) {
                    btn.classList.remove('active');
                }
            }
        });
    },

    bindTabEvents() {
        const buttons = document.querySelectorAll('.clinic-tab-btn');
        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                if (!tab || tab === this.state.activeTab) return;
                this.state.activeTab = tab;
                this.renderTabNavigation();
                // ✅ فتح فوري: تفعيل اللوحة مباشرة، ثم جدولة الرندر الثقيل خارج click handler
                // هذا يقلل تأخير الانتقال بين التبويبات ويقلل Violations.
                requestAnimationFrame(() => {
                    this._activateTabPanels(tab);
                    this.scheduleClinicTabRender(tab, { delayMs: 20 });
                });
            });
        });
    },

    /**
     * تفعيل/إخفاء لوحات التبويبات بسرعة (بدون رندر محتوى ثقيل)
     */
    _activateTabPanels(activeKey) {
        try {
            const panels = document.querySelectorAll('.clinic-tab-panel');
            panels.forEach((panel) => {
                const panelKey = panel.getAttribute('data-tab-panel');
                const isActive = panelKey === activeKey;
                if (isActive) {
                    panel.classList.add('active');
                    panel.style.display = 'block';
                } else {
                    panel.classList.remove('active');
                    panel.style.display = 'none';
                }
            });
        } catch (e) { /* ignore */ }
    },

    /**
     * Skeleton خفيف لفتح التبويب فوراً بدون شاشة/تبويب فاضي أثناء الرندر
     */
    _renderTabSkeleton(panel, label) {
        try {
            if (!panel) return;
            const current = (panel.innerHTML || '').trim();
            // إذا كان هناك محتوى بالفعل لا نمسحه لتجنب وميض
            if (current) return;
            const safeLabel = Utils.escapeHTML(label || 'جاري التحميل...');
            panel.innerHTML = `
                <div class="content-card" style="margin:14px;">
                    <div class="card-body" style="display:flex;align-items:center;justify-content:center;min-height:210px;gap:12px;">
                        <div style="width:34px;height:34px;border:3px solid rgba(37,99,235,0.18);border-top-color:#2563eb;border-radius:50%;animation:hseSpin 0.9s linear infinite;"></div>
                        <div style="font-weight:600;color:#334155;">${safeLabel}</div>
                    </div>
                </div>
            `;
            this.applyModuleI18n(panel);
            if (!document.getElementById('hse-mini-spinner-style')) {
                const style = document.createElement('style');
                style.id = 'hse-mini-spinner-style';
                style.textContent = '@keyframes hseSpin{to{transform:rotate(360deg);}}';
                document.head.appendChild(style);
            }
        } catch (e) { /* ignore */ }
    },

    /**
     * Scheduler موحّد لرندر تبويبات العيادة
     * - يضمن فتح مباشر (activate + skeleton)
     * - يمنع تكرار الرندر عند التنقل السريع بين التبويبات (token + timer)
     */
    scheduleClinicTabRender(tabKey, { delayMs = 0 } = {}) {
        try {
            if (!tabKey) return;
            if (!this._tabRenderState) this._tabRenderState = { token: 0, timers: {} };
            const state = this._tabRenderState;
            state.token += 1;
            const myToken = state.token;

            // إلغاء أي جدولة سابقة لهذا التبويب
            const oldTimer = state.timers[tabKey];
            if (oldTimer) {
                clearTimeout(oldTimer);
                state.timers[tabKey] = null;
            }

            const panel = document.querySelector(`.clinic-tab-panel[data-tab-panel="${tabKey}"]`);
            const labelMap = {
                visits: 'جاري فتح سجل التردد...',
                medications: 'جاري فتح الأدوية...',
                sickLeave: 'جاري فتح الإجازات المرضية...',
                'dispensed-medications': 'جاري فتح سجل الأدوية المنصرفة...',
                injuries: 'جاري فتح الإصابات...',
                'supply-request': 'جاري فتح إرسال طلب احتياجات...',
                approvals: 'جاري فتح طلبات الموافقة...'
            };
            this._renderTabSkeleton(panel, labelMap[tabKey] || 'جاري التحميل...');

            const run = () => {
                // تجاهل إذا تغيّر التبويب/تم جدولة أحدث
                if (!this._tabRenderState || myToken !== this._tabRenderState.token) return;
                // اجعل callback خفيفاً ثم ادفع الرندر الثقيل خارج rAF/idle
                setTimeout(() => {
                    if (!this._tabRenderState || myToken !== this._tabRenderState.token) return;
                    try {
                        this._renderTabByKey(tabKey);
                    } catch (e) {
                        if (AppState.debugMode) Utils.safeWarn('⚠️ خطأ في رندر تبويب العيادة:', tabKey, e);
                    }
                }, 0);
            };

            // ضمان سلاسة الانتقال: ننتظر frame ثم نستخدم idle إن توفر
            requestAnimationFrame(() => {
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(run, { timeout: 900 });
                } else {
                    run();
                }
            });

            state.timers[tabKey] = setTimeout(() => {
                // إعادة جدولة بسيطة بعد delayMs (خصوصاً عند التنقل السريع)
                if (!this._tabRenderState || myToken !== this._tabRenderState.token) return;
                run();
            }, Math.max(0, delayMs));
        } catch (e) { /* ignore */ }
    },

    _renderTabByKey(tabKey) {
        // لا نستخدم await هنا لتجنّب حجب التنقل، الدوال async تتعامل مع نفسها
        if (tabKey === 'visits') {
            this.scheduleVisitsTabRender(false, 0);
            return;
        }
        if (tabKey === 'medications') return this.renderMedicationsTab();
        if (tabKey === 'sickLeave') return this.renderSickLeaveTab();
        if (tabKey === 'injuries') return this.renderInjuriesTab();
        if (tabKey === 'approvals') return this.renderApprovalsTab();
        if (tabKey === 'dispensed-medications') return this.renderDispensedMedicationsTab();
        if (tabKey === 'analytics') return this.renderAnalyticsTab();
        if (tabKey === 'data-analysis') return this.renderDataAnalysisTab();
        if (tabKey === 'supply-request') return this.renderSupplyRequestTab();
    },

    renderActiveTabContent() {
        const active = this.state.activeTab || 'medications';
        // ✅ بدل استدعاء render*Tab مباشرة (ثقيل)، نفعل اللوحة سريعاً ثم نُجدول الرندر
        this._activateTabPanels(active);
        this.scheduleClinicTabRender(active, { delayMs: 0 });
    },

    renderMedicationsTab() {
        const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="medications"]');
        if (!panel) return;

        const filters = this.state.filters.medications || {};
        const medications = this.getFilteredMedications();
        
        // ✅ التحقق من صلاحية مدير النظام
        const isAdmin = this.isCurrentUserAdmin();

        const rows = medications.map((item) => {
            // ✅ مهم: إعادة حساب الحالة ديناميكياً بدلاً من الاعتماد على القيمة المخزنة
            // هذا يضمن تطبيق المنطق الجديد (قريب الانتهاء فقط عند وجود رصيد > 0)
            const statusInfo = this.calculateMedicationStatus(item);
            const status = statusInfo.status || 'ساري';
            const days = statusInfo.daysRemaining !== undefined && statusInfo.daysRemaining !== null ? statusInfo.daysRemaining : '—';
            
            const purchase = this.formatDate(item.purchaseDate);
            const expiry = item.expiryDate ? this.formatDate(item.expiryDate) : '—';
            const rowClass = this.getMedicationRowClass(status);

            // حساب الرصيد والمنصرف
            const quantityAdded = item.quantityAdded ?? item.quantity ?? 0;
            const remainingQuantity = item.remainingQuantity ?? item.quantity ?? 0;
            const dispensed = Math.max(0, quantityAdded - remainingQuantity);
            const usage = item.usage || item.notes || '—';

            // ✅ إظهار أزرار التعديل والحذف فقط لمدير النظام
            const actionButtons = isAdmin ? `
                <button type="button" class="btn-icon btn-icon-primary" data-action="view-medication" data-id="${Utils.escapeHTML(item.id || '')}">
                    <i class="fas fa-eye"></i>
                </button>
                <button type="button" class="btn-icon btn-icon-warning" data-action="edit-medication" data-id="${Utils.escapeHTML(item.id || '')}">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="btn-icon btn-icon-danger" data-action="delete-medication" data-id="${Utils.escapeHTML(item.id || '')}">
                    <i class="fas fa-trash"></i>
                </button>
            ` : `
                <button type="button" class="btn-icon btn-icon-primary" data-action="view-medication" data-id="${Utils.escapeHTML(item.id || '')}">
                    <i class="fas fa-eye"></i>
                </button>
            `;

            return `
                <tr class="${rowClass}">
                    <td>${Utils.escapeHTML(item.name || '')}</td>
                    <td>${Utils.escapeHTML(item.type || '')}</td>
                    <td>${Utils.escapeHTML(usage)}</td>
                    <td>${purchase}</td>
                    <td>${expiry}</td>
                    <td>
                        <span class="badge ${this.getMedicationBadgeClass(status)}">${Utils.escapeHTML(status)}</span>
                    </td>
                    <td>${days}</td>
                    <td class="text-center font-semibold">${quantityAdded}</td>
                    <td class="text-center font-semibold text-blue-600">${dispensed}</td>
                    <td class="text-center font-semibold">${remainingQuantity}</td>
                    <td class="text-center">
                        <div class="flex items-center justify-center gap-2">
                            ${actionButtons}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const tableHtml = medications.length
            ? `
                <div class="table-wrapper clinic-table-wrapper" style="overflow-x: auto; overflow-y: auto; max-height: 70vh;">
                    <table class="data-table table-header-green">
                        <thead>
                            <tr>
                                <th>اسم الدواء</th>
                                <th>نوع الدواء</th>
                                <th>الاستخدام</th>
                                <th>تاريخ الشراء</th>
                                <th>تاريخ انتهاء الصلاحية</th>
                                <th>الحالة</th>
                                <th>عدد الأيام المتبقية</th>
                                <th class="text-center">الكمية</th>
                                <th class="text-center">المنصرف</th>
                                <th class="text-center">الرصيد</th>
                                <th class="text-center">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `
            : this.renderEmptyState('لا توجد أدوية مسجلة في السجل.');

        panel.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div class="flex flex-wrap items-center gap-2">
                    <div class="relative">
                        <input type="text" id="medications-search" class="form-input pr-10" placeholder="بحث بالاسم أو النوع" value="${Utils.escapeHTML(filters.search || '')}">
                        <i class="fas fa-search absolute top-3 right-3 text-gray-400"></i>
                    </div>
                    <select id="medications-status" class="form-input">
                        <option value="all" ${filters.status === 'all' ? 'selected' : ''}>جميع الحالات</option>
                        <option value="ساري" ${filters.status === 'ساري' ? 'selected' : ''}>ساري</option>
                        <option value="قريب الانتهاء" ${filters.status === 'قريب الانتهاء' ? 'selected' : ''}>قريب الانتهاء</option>
                        <option value="منتهي" ${filters.status === 'منتهي' ? 'selected' : ''}>منتهي</option>
                    </select>
                    <input type="date" id="medications-date-from" class="form-input" value="${filters.dateFrom || ''}" title="من تاريخ الشراء">
                    <input type="date" id="medications-date-to" class="form-input" value="${filters.dateTo || ''}" title="إلى تاريخ الشراء">
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" class="btn-secondary" id="medications-export-pdf-btn">
                        <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                    </button>
                    <button type="button" class="btn-success" id="medications-export-excel-btn">
                        <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                    </button>
                    ${isAdmin ? `
                    <button type="button" class="btn-primary" id="medications-add-btn">
                        <i class="fas fa-plus ml-2"></i>إضافة جديد
                    </button>
                    ` : ''}
                </div>
            </div>
            ${tableHtml}
        `;
        this.applyModuleI18n(panel);

        this.bindMedicationsTabEvents(panel);
        
        // إضافة مستمعي التمرير للجدول
        setTimeout(() => {
            const wrapper = panel.querySelector('.clinic-table-wrapper');
            if (wrapper) {
                this.setupTableScrollListeners(wrapper);
            }
        }, 100);
    },

    bindMedicationsTabEvents(panel) {
        const searchInput = panel.querySelector('#medications-search');
        const statusSelect = panel.querySelector('#medications-status');
        const dateFromInput = panel.querySelector('#medications-date-from');
        const dateToInput = panel.querySelector('#medications-date-to');
        const addBtn = panel.querySelector('#medications-add-btn');
        const exportPdfBtn = panel.querySelector('#medications-export-pdf-btn');
        const exportExcelBtn = panel.querySelector('#medications-export-excel-btn');

        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                this.state.filters.medications.search = event.target.value.trim();
                this.renderMedicationsTab();
            });
        }

        if (statusSelect) {
            statusSelect.addEventListener('change', (event) => {
                this.state.filters.medications.status = event.target.value;
                this.renderMedicationsTab();
            });
        }

        if (dateFromInput) {
            dateFromInput.addEventListener('change', (event) => {
                this.state.filters.medications.dateFrom = event.target.value;
                this.renderMedicationsTab();
            });
        }

        if (dateToInput) {
            dateToInput.addEventListener('change', (event) => {
                this.state.filters.medications.dateTo = event.target.value;
                this.renderMedicationsTab();
            });
        }

        if (addBtn) {
            addBtn.addEventListener('click', () => this.showMedicationForm());
        }

        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => this.exportMedicationsToPDF());
        }

        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => this.exportMedicationsToExcel());
        }

        panel.querySelectorAll('[data-action="view-medication"]').forEach((btn) => {
            btn.addEventListener('click', () => this.viewMedication(btn.getAttribute('data-id')));
        });
        panel.querySelectorAll('[data-action="edit-medication"]').forEach((btn) => {
            btn.addEventListener('click', () => this.editMedication(btn.getAttribute('data-id')));
        });
        panel.querySelectorAll('[data-action="delete-medication"]').forEach((btn) => {
            btn.addEventListener('click', () => this.deleteMedication(btn.getAttribute('data-id')));
        });
    },

    viewMedication(id) {
        const record = this.getMedications().find((item) => item.id === id);
        if (!record) {
            Notification?.error?.('تعذر العثور على الدواء المحدد');
            return;
        }

        const status = record.status || 'ساري';
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 720px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">تفاصيل الدواء</h2>
                    <button type="button" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span class="text-sm font-semibold text-gray-600">اسم الدواء</span>
                            <p class="text-gray-800">${Utils.escapeHTML(record.name || '')}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">نوع الدواء</span>
                            <p class="text-gray-800">${Utils.escapeHTML(record.type || '')}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">الاستخدام</span>
                            <p class="text-gray-800">${Utils.escapeHTML(record.usage || record.notes || '—')}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">تاريخ الشراء</span>
                            <p class="text-gray-800">${this.formatDate(record.purchaseDate)}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">تاريخ انتهاء الصلاحية</span>
                            <p class="text-gray-800">${record.expiryDate ? this.formatDate(record.expiryDate) : '—'}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">الكمية</span>
                            <p class="text-gray-800">${record.quantityAdded ?? record.quantity ?? 0}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">الرصيد</span>
                            <p class="text-gray-800 font-semibold">${record.remainingQuantity ?? record.quantity ?? 0}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">المنصرف</span>
                            <p class="text-gray-800 font-semibold text-blue-600">${Math.max(0, (record.quantityAdded ?? record.quantity ?? 0) - (record.remainingQuantity ?? record.quantity ?? 0))}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">موقع التخزين</span>
                            <p class="text-gray-800">${Utils.escapeHTML(record.location || '—')}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">الحالة</span>
                            <p class="text-gray-800">
                                <span class="badge ${this.getMedicationBadgeClass(status)}">${Utils.escapeHTML(status)}</span>
                                ${record.daysRemaining !== undefined && record.daysRemaining !== null
                ? `<span class="text-xs text-gray-500 ml-2">(تبقى ${record.daysRemaining} يوم)</span>`
                : ''}
                            </p>
                        </div>
                    </div>
                    ${record.notes ? `
                        <div>
                            <span class="text-sm font-semibold text-gray-600">ملاحظات</span>
                            <p class="text-gray-800 whitespace-pre-line">${Utils.escapeHTML(record.notes || '')}</p>
                        </div>
                    ` : ''}
                    <div class="text-sm text-gray-500 border-t pt-3">
                        ${record.createdBy?.name ? `تم التسجيل بواسطة: ${Utils.escapeHTML(record.createdBy.name)}` : ''}
                        ${record.createdAt ? `<span class="ml-2">بتاريخ ${this.formatDate(record.createdAt, true)}</span>` : ''}
                    </div>
                </div>
                <div class="modal-footer form-actions-centered">
                    <button type="button" class="btn-secondary modal-close-btn">إغلاق</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const closeModal = () => modal.remove();

        modal.querySelectorAll('.modal-close, .modal-close-btn').forEach((btn) => {
            btn.addEventListener('click', closeModal);
        });
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النافذة.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) closeModal();
            }
        });
    },

    editMedication(id) {
        const record = this.getMedications().find((item) => item.id === id);
        if (!record) {
            Notification?.error?.('تعذر العثور على الدواء المطلوب تعديله');
            return;
        }
        this.showMedicationForm(record);
    },

    async deleteMedication(id) {
        const record = this.getMedications().find((item) => item.id === id);
        if (!record) {
            Notification?.error?.('تعذر العثور على الدواء المطلوب حذفه');
            return;
        }

        // التحقق من صلاحيات المستخدم
        const isAdmin = this.isCurrentUserAdmin();

        if (isAdmin) {
            // المدير يمكنه الحذف مباشرة
            const confirmed = confirm(`هل أنت متأكد من حذف الدواء "${Utils.escapeHTML(record.name || '')}"؟\n\nهذه العملية لا يمكن التراجع عنها.`);
            if (!confirmed) return;

            Loading.show();
            try {
                // حذف من AppState
                AppState.appData.medications = (AppState.appData.medications || []).filter(m => m.id !== id);
                AppState.appData.clinicMedications = (AppState.appData.clinicMedications || []).filter(m => m.id !== id);
                AppState.appData.clinicInventory = (AppState.appData.clinicInventory || []).filter(m => m.id !== id);

                // حفظ البيانات محلياً
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                // حذف من Google Sheets
                await GoogleIntegration.sendRequest({
                    action: 'deleteMedication',
                    data: { medicationId: id }
                });

                Loading.hide();
                Notification.success('تم حذف الدواء بنجاح');

                // إعادة عرض الجدول
                this.renderMedicationsTab();

                // إطلاق حدث لإشعار نظام المزامنة اللحظية
                document.dispatchEvent(new CustomEvent('data-saved', {
                    detail: {
                        module: 'medications',
                        action: 'حذف',
                        data: { id: id }
                    }
                }));
            } catch (error) {
                Loading.hide();
                Utils.safeError('خطأ في حذف الدواء:', error);
                Notification.error('تعذر حذف الدواء: ' + (error.message || 'حدث خطأ غير معروف'));
            }
        } else {
            // المستخدم العادي يرسل طلب موافقة
            const confirmed = confirm(`سيتم إرسال طلب حذف الدواء "${Utils.escapeHTML(record.name || '')}" إلى مدير النظام للموافقة.\n\nهل تريد المتابعة؟`);
            if (!confirmed) return;

            Loading.show();
            try {
                // إنشاء طلب موافقة
                const requestData = {
                    medicationId: id,
                    medicationData: record,
                    requestedBy: {
                        id: AppState.currentUser?.id || '',
                        name: AppState.currentUser?.name || '',
                        email: AppState.currentUser?.email || '',
                        role: AppState.currentUser?.role || ''
                    },
                    requestedById: AppState.currentUser?.id || '',
                    reason: 'طلب حذف دواء'
                };

                const result = await GoogleIntegration.sendRequest({
                    action: 'addMedicationDeletionRequest',
                    data: requestData
                });

                if (result && result.success) {
                    Loading.hide();
                    Notification.success('تم إرسال طلب الحذف إلى مدير النظام للموافقة');

                    // إرسال إشعار للمدير
                    this.notifyAdminAboutDeletionRequest(record);

                    // تحديث تبويب طلبات الموافقة إذا كان مفتوحاً
                    if (this.state.activeTab === 'approvals') {
                        setTimeout(() => {
                            this.renderApprovalsTab();
                        }, 500);
                    }

                    // تحديث قائمة الأدوية
                    this.renderMedicationsTab();
                } else {
                    throw new Error(result.message || 'فشل إرسال الطلب');
                }
            } catch (error) {
                Loading.hide();
                Utils.safeError('خطأ في إرسال طلب الحذف:', error);
                Notification.error('تعذر إرسال طلب الحذف: ' + (error.message || 'حدث خطأ غير معروف'));
            }
        }
    },

    /**
     * التحقق من أن المستخدم الحالي هو مدير
     */
    isCurrentUserAdmin() {
        if (typeof Permissions !== 'undefined' && typeof Permissions.isCurrentUserAdmin === 'function') {
            return Permissions.isCurrentUserAdmin();
        }
        const userRole = (AppState.currentUser?.role || '').toLowerCase();
        return userRole === 'admin' || userRole === 'مدير';
    },

    /**
     * إرسال إشعار للمدير عند طلب حذف دواء
     */
    async notifyAdminAboutDeletionRequest(medication) {
        try {
            // الحصول على جميع المستخدمين المدراء
            const usersResult = await GoogleIntegration.sendRequest({
                action: 'readFromSheet',
                data: { sheetName: 'Users' }
            });

            if (usersResult && usersResult.success && Array.isArray(usersResult.data)) {
                const admins = usersResult.data.filter(user => {
                    const role = (user.role || '').toLowerCase();
                    return role === 'admin' || role === 'مدير';
                });

                // إرسال إشعار لكل مدير
                for (const admin of admins) {
                    if (admin.id) {
                        await GoogleIntegration.sendRequest({
                            action: 'addNotification',
                            data: {
                                userId: admin.id,
                                title: 'طلب موافقة على حذف دواء',
                                message: `طلب ${AppState.currentUser?.name || 'مستخدم'} الموافقة على حذف الدواء "${medication.name || ''}"`,
                                type: 'approval_request',
                                priority: 'high',
                                link: '#clinic-approvals',
                                data: {
                                    module: 'clinic',
                                    action: 'medication_deletion',
                                    medicationId: medication.id
                                }
                            }
                        }).catch(error => {
                            Utils.safeWarn('فشل إرسال الإشعار للمدير:', error);
                        });
                    }
                }
            }
        } catch (error) {
            Utils.safeWarn('خطأ في إرسال الإشعارات:', error);
        }
    },

    /**
     * إرسال إشعار للمدير عند طلب احتياج
     */
    async notifyAdminAboutSupplyRequest(request) {
        try {
            // الحصول على جميع المستخدمين المدراء
            const usersResult = await GoogleIntegration.sendRequest({
                action: 'readFromSheet',
                data: { sheetName: 'Users' }
            });

            if (usersResult && usersResult.success && Array.isArray(usersResult.data)) {
                const admins = usersResult.data.filter(user => {
                    const role = (user.role || '').toLowerCase();
                    return role === 'admin' || role === 'مدير';
                });

                const typeLabel = {
                    'medication': 'أدوية',
                    'equipment': 'أجهزة طبية',
                    'supplies': 'مستلزمات طبية',
                    'other': 'أخرى'
                }[request.type] || request.type || 'غير محدد';

                // إرسال إشعار لكل مدير
                for (const admin of admins) {
                    if (admin.id) {
                        await GoogleIntegration.sendRequest({
                            action: 'addNotification',
                            data: {
                                userId: admin.id,
                                title: 'طلب موافقة على احتياج',
                                message: `طلب ${AppState.currentUser?.name || 'مستخدم'} الموافقة على ${typeLabel}: "${request.itemName || ''}"`,
                                type: 'approval_request',
                                priority: request.priority === 'urgent' ? 'high' : 'normal',
                                link: '#clinic-approvals',
                                data: {
                                    module: 'clinic',
                                    action: 'supply_request',
                                    requestId: request.id
                                }
                            }
                        }).catch(error => {
                            Utils.safeWarn('فشل إرسال الإشعار للمدير:', error);
                        });
                    }
                }
            }
        } catch (error) {
            Utils.safeWarn('خطأ في إرسال الإشعارات:', error);
        }
    },

    /**
     * الحصول على حد تنبيه الزيارات الشهرية من إعدادات الشركة (قابل للتعديل من واجهة الإعدادات)
     * @returns {number} الحد (1–1000)، الافتراضي 10
     */
    getMonthlyVisitsAlertThreshold() {
        try {
            const v = AppState.companySettings?.clinicMonthlyVisitsAlertThreshold;
            if (v === undefined || v === null || v === '') return 10;
            const n = parseInt(v, 10);
            return (isNaN(n) || n < 1) ? 10 : Math.min(1000, n);
        } catch (e) {
            return 10;
        }
    },

    /** القائمة الافتراضية لأنواع الزيارة (قابلة للتعديل من مدير النظام عبر إعدادات العيادة) */
    DEFAULT_VISIT_TYPES: ['طوارئ', 'اصابة عمل', 'مرض', 'فحص دوري', 'متابعة', 'فحص ماقبل التعيين', 'تحليل مخدارت'],

    /**
     * الحصول على قائمة أنواع الزيارة (من إعدادات المدير أو الافتراضية)
     * @returns {string[]}
     */
    getVisitTypeOptions() {
        let custom = AppState.companySettings?.clinicVisitTypes;
        if (typeof custom === 'string') {
            const raw = custom.trim();
            if (raw) {
                try {
                    custom = JSON.parse(raw);
                } catch (e) {
                    custom = raw.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
                }
            } else {
                custom = [];
            }
        }
        if ((!Array.isArray(custom) || custom.length === 0) && AppState.appData?.clinicVisitTypes) {
            custom = AppState.appData.clinicVisitTypes;
        }
        if (Array.isArray(custom) && custom.length > 0) {
            return custom.map((v) => (typeof v === 'string' ? v.trim() : String(v))).filter(Boolean);
        }
        return (this.DEFAULT_VISIT_TYPES || []).slice();
    },

    /**
     * عد زيارات شخص معين (موظف أو مقاول) في الشهر الذي تنتمي إليه زيارة معينة
     * @param {Object} visitData - بيانات زيارة تحتوي على personType و visitDate ومعرفات الشخص
     * @returns {number} عدد الزيارات في نفس الشهر
     */
    getMonthlyVisitCountForPerson(visitData) {
        try {
            if (!visitData || !visitData.visitDate) return 0;
            const visitDate = new Date(visitData.visitDate);
            if (isNaN(visitDate.getTime())) return 0;
            const year = visitDate.getFullYear();
            const month = visitDate.getMonth();

            const allVisits = (AppState.appData.clinicVisits || []).concat(
                Array.isArray(AppState.appData.clinicContractorVisits) ? AppState.appData.clinicContractorVisits : []
            );

            const isSameMonth = (v) => {
                if (!v || !v.visitDate) return false;
                const d = new Date(v.visitDate);
                if (isNaN(d.getTime())) return false;
                return d.getFullYear() === year && d.getMonth() === month;
            };

            const personType = (visitData.personType || 'employee').toString().toLowerCase();

            if (personType === 'employee') {
                const code = String(visitData.employeeCode || visitData.employeeNumber || '').trim();
                if (!code) return 0;
                return allVisits.filter(v => {
                    if (!isSameMonth(v)) return false;
                    const t = (v.personType || '').toString().toLowerCase();
                    if (t !== 'employee' && t !== '') return false;
                    const c = String(v.employeeCode || v.employeeNumber || '').trim();
                    return c === code;
                }).length;
            }

            // contractor أو external
            const name = String(visitData.contractorName || visitData.externalName || '').trim();
            const worker = String(visitData.contractorWorkerName || '').trim();
            if (!name && !worker) return 0;
            return allVisits.filter(v => {
                if (!isSameMonth(v)) return false;
                const t = (v.personType || '').toString().toLowerCase();
                if (t !== 'contractor' && t !== 'external') return false;
                const n = String(v.contractorName || v.externalName || '').trim();
                const w = String(v.contractorWorkerName || '').trim();
                return n === name && w === worker;
            }).length;
        } catch (e) {
            Utils.safeWarn('getMonthlyVisitCountForPerson:', e);
            return 0;
        }
    },

    /**
     * عرض نافذة إدارة أنواع الزيارة (مدير النظام فقط) - القائمة قابلة للتعديل
     */
    showVisitTypesSettingsModal() {
        if (!this.isCurrentUserAdmin()) {
            Notification?.error?.('هذا القسم متاح لمدير النظام فقط');
            return;
        }
        const currentList = this.getVisitTypeOptions();
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        const listToEditableItems = (arr) => arr.map((text, idx) => ({
            id: 'vt-' + Date.now() + '-' + idx,
            text: String(text).trim()
        }));
        let items = listToEditableItems(currentList);

        const renderList = () => {
            const container = document.getElementById('clinic-visit-types-list');
            if (!container) return;
            container.innerHTML = items.map((it, idx) => `
                <div class="flex items-center gap-2 mb-2" data-id="${it.id}">
                    <input type="text" class="form-input flex-1" value="${Utils.escapeHTML(it.text)}" data-id="${it.id}" placeholder="نوع الزيارة">
                    <button type="button" class="btn-icon btn-icon-danger btn-xs remove-visit-type" data-id="${it.id}" title="حذف">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
            container.querySelectorAll('input').forEach(input => {
                input.addEventListener('change', () => {
                    const id = input.getAttribute('data-id');
                    const it = items.find(i => i.id === id);
                    if (it) it.text = input.value.trim();
                });
            });
            container.querySelectorAll('.remove-visit-type').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    items = items.filter(i => i.id !== id);
                    renderList();
                });
            });
        };

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px; border-radius: 15px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <h2 class="modal-title"><i class="fas fa-list-ul ml-2"></i> إدارة أنواع الزيارة</h2>
                    <button class="modal-close" style="color: white;" onclick="this.closest('.modal-overlay')?.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <p class="text-gray-600 text-sm mb-4">تظهر هذه البنود في قائمة "نوع الزيارة" عند تسجيل زيارة جديدة. يمكنك الإضافة أو الحذف أو التعديل.</p>
                    <div id="clinic-visit-types-list"></div>
                    <button type="button" id="clinic-visit-types-add-row" class="btn-secondary mt-2">
                        <i class="fas fa-plus ml-2"></i> إضافة بند
                    </button>
                    <div class="flex gap-2 justify-end mt-4 pt-4 border-t">
                        <button type="button" class="btn-secondary modal-close-btn">إلغاء</button>
                        <button type="button" id="clinic-visit-types-reset" class="btn-secondary">استعادة الافتراضي</button>
                        <button type="button" id="clinic-visit-types-save" class="btn-primary">حفظ</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        renderList();

        modal.querySelector('#clinic-visit-types-add-row').addEventListener('click', () => {
            items.push({ id: 'vt-' + Date.now() + '-' + items.length, text: '' });
            renderList();
        });
        modal.querySelector('#clinic-visit-types-reset').addEventListener('click', () => {
            items = listToEditableItems(this.DEFAULT_VISIT_TYPES || []);
            renderList();
        });
        modal.querySelector('#clinic-visit-types-save').addEventListener('click', async () => {
            modal.querySelectorAll('#clinic-visit-types-list input').forEach(input => {
                const id = input.getAttribute('data-id');
                const it = items.find(i => i.id === id);
                if (it) it.text = input.value.trim();
            });
            const list = items.map(i => i.text).filter(Boolean);
            if (list.length === 0) {
                Notification?.warning?.('أضف بنداً واحداً على الأقل أو استعد الافتراضي');
                return;
            }
            if (!AppState.appData) AppState.appData = {};
            AppState.appData.clinicVisitTypes = list;
            if (!AppState.companySettings || typeof AppState.companySettings !== 'object') {
                AppState.companySettings = {};
            }
            AppState.companySettings.clinicVisitTypes = list;

            // حفظ مركزي في إعدادات الشركة ليظهر لجميع المستخدمين
            try {
                const userData = AppState.currentUser || {};
                const savePayload = {
                    ...AppState.companySettings,
                    clinicVisitTypes: list,
                    userData
                };
                const result = await GoogleIntegration.sendRequest({
                    action: 'saveCompanySettings',
                    data: savePayload
                });
                if (!result || result.success !== true) {
                    throw new Error((result && result.message) || 'تعذر حفظ أنواع الزيارة في قاعدة البيانات');
                }
            } catch (error) {
                Notification?.error?.(error?.message || 'تعذر حفظ أنواع الزيارة لجميع المستخدمين');
                return;
            }

            if (typeof DataManager !== 'undefined' && DataManager.save) {
                DataManager.save();
            }
            Notification?.success?.('تم حفظ قائمة أنواع الزيارة وتعميمها على المستخدمين');
            modal.remove();
        });
        modal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
    },

    /** القائمة الافتراضية لأنواع الإصابات (قابلة للتعديل من مدير النظام) */
    DEFAULT_INJURY_TYPES: ['جرح', 'كسر', 'حروق', 'إصابة بالغة', 'التواء', 'أخرى'],

    getInjuryTypeOptions() {
        const custom = AppState.appData?.clinicInjuryTypes;
        if (Array.isArray(custom) && custom.length > 0) {
            return custom.map((v) => (typeof v === 'string' ? v.trim() : String(v))).filter(Boolean);
        }
        return (this.DEFAULT_INJURY_TYPES || []).slice();
    },

    showInjuryTypesSettingsModal() {
        if (!this.isCurrentUserAdmin()) {
            Notification?.error?.('هذا القسم متاح لمدير النظام فقط');
            return;
        }
        const currentList = this.getInjuryTypeOptions();
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        const toItems = (arr) => arr.map((text, idx) => ({
            id: 'it-' + Date.now() + '-' + idx,
            text: String(text).trim()
        }));
        let items = toItems(currentList);

        const renderList = () => {
            const container = document.getElementById('clinic-injury-types-list');
            if (!container) return;
            container.innerHTML = items.map((it) => `
                <div class="flex items-center gap-2 mb-2" data-id="${it.id}">
                    <input type="text" class="form-input flex-1" value="${Utils.escapeHTML(it.text)}" data-id="${it.id}" placeholder="نوع الإصابة">
                    <button type="button" class="btn-icon btn-icon-danger btn-xs remove-injury-type" data-id="${it.id}" title="حذف">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
            container.querySelectorAll('input').forEach(input => {
                input.addEventListener('change', () => {
                    const id = input.getAttribute('data-id');
                    const it = items.find(i => i.id === id);
                    if (it) it.text = input.value.trim();
                });
            });
            container.querySelectorAll('.remove-injury-type').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    items = items.filter(i => i.id !== id);
                    renderList();
                });
            });
        };

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px; border-radius: 15px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); color: white;">
                    <h2 class="modal-title"><i class="fas fa-briefcase-medical ml-2"></i> إدارة أنواع الإصابات</h2>
                    <button class="modal-close" style="color: white;" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <p class="text-gray-600 text-sm mb-4">تظهر هذه البنود في قائمة "نوع الإصابة" عند تسجيل إصابة جديدة.</p>
                    <div id="clinic-injury-types-list"></div>
                    <button type="button" id="clinic-injury-types-add-row" class="btn-secondary mt-2">
                        <i class="fas fa-plus ml-2"></i> إضافة بند
                    </button>
                    <div class="flex gap-2 justify-end mt-4 pt-4 border-t">
                        <button type="button" class="btn-secondary modal-close-btn">إلغاء</button>
                        <button type="button" id="clinic-injury-types-reset" class="btn-secondary">استعادة الافتراضي</button>
                        <button type="button" id="clinic-injury-types-save" class="btn-primary">حفظ</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        renderList();

        modal.querySelector('#clinic-injury-types-add-row').addEventListener('click', () => {
            items.push({ id: 'it-' + Date.now() + '-' + items.length, text: '' });
            renderList();
        });
        modal.querySelector('#clinic-injury-types-reset').addEventListener('click', () => {
            items = toItems(this.DEFAULT_INJURY_TYPES || []);
            renderList();
        });
        modal.querySelector('#clinic-injury-types-save').addEventListener('click', () => {
            modal.querySelectorAll('#clinic-injury-types-list input').forEach(input => {
                const id = input.getAttribute('data-id');
                const it = items.find(i => i.id === id);
                if (it) it.text = input.value.trim();
            });
            const list = items.map(i => i.text).filter(Boolean);
            if (list.length === 0) {
                Notification?.warning?.('أضف بنداً واحداً على الأقل أو استعد الافتراضي');
                return;
            }
            if (!AppState.appData) AppState.appData = {};
            AppState.appData.clinicInjuryTypes = list;
            if (typeof DataManager !== 'undefined' && DataManager.save) DataManager.save();
            Notification?.success?.('تم حفظ قائمة أنواع الإصابات');
            if (this.state.activeTab === 'injuries') this.renderInjuriesTab();
            modal.remove();
        });
        modal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
    },

    /** القائمة الافتراضية لأماكن الإصابة في الجسم (قابلة للتعديل من مدير النظام) */
    DEFAULT_INJURY_BODY_PARTS: ['الرأس', 'العين', 'الوجه', 'الرقبة', 'الكتف', 'الذراع', 'اليد', 'الصدر', 'الظهر', 'البطن', 'الساق', 'القدم', 'أخرى'],

    getInjuryBodyPartOptions() {
        const custom = AppState.appData?.clinicInjuryBodyParts;
        if (Array.isArray(custom) && custom.length > 0) {
            return custom.map((v) => (typeof v === 'string' ? v.trim() : String(v))).filter(Boolean);
        }
        return (this.DEFAULT_INJURY_BODY_PARTS || []).slice();
    },

    showInjuryBodyPartsSettingsModal() {
        if (!this.isCurrentUserAdmin()) {
            Notification?.error?.('هذا القسم متاح لمدير النظام فقط');
            return;
        }
        const currentList = this.getInjuryBodyPartOptions();
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        const toItems = (arr) => arr.map((text, idx) => ({
            id: 'ib-' + Date.now() + '-' + idx,
            text: String(text).trim()
        }));
        let items = toItems(currentList);

        const renderList = () => {
            const container = document.getElementById('clinic-injury-body-parts-list');
            if (!container) return;
            container.innerHTML = items.map((it) => `
                <div class="flex items-center gap-2 mb-2" data-id="${it.id}">
                    <input type="text" class="form-input flex-1" value="${Utils.escapeHTML(it.text)}" data-id="${it.id}" placeholder="مكان الإصابة بالجسم">
                    <button type="button" class="btn-icon btn-icon-danger btn-xs remove-injury-body-part" data-id="${it.id}" title="حذف">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
            container.querySelectorAll('input').forEach(input => {
                input.addEventListener('change', () => {
                    const id = input.getAttribute('data-id');
                    const it = items.find(i => i.id === id);
                    if (it) it.text = input.value.trim();
                });
            });
            container.querySelectorAll('.remove-injury-body-part').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    items = items.filter(i => i.id !== id);
                    renderList();
                });
            });
        };

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 520px; border-radius: 15px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); color: white;">
                    <h2 class="modal-title"><i class="fas fa-filter ml-2"></i> إدارة أماكن الإصابة بالجسم</h2>
                    <button class="modal-close" style="color: white;" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <p class="text-gray-600 text-sm mb-4">تظهر هذه البنود في حقل مكان الإصابة (بالجسم) وفلتر الإصابات.</p>
                    <div id="clinic-injury-body-parts-list"></div>
                    <button type="button" id="clinic-injury-body-parts-add-row" class="btn-secondary mt-2">
                        <i class="fas fa-plus ml-2"></i> إضافة بند
                    </button>
                    <div class="flex gap-2 justify-end mt-4 pt-4 border-t">
                        <button type="button" class="btn-secondary modal-close-btn">إلغاء</button>
                        <button type="button" id="clinic-injury-body-parts-reset" class="btn-secondary">استعادة الافتراضي</button>
                        <button type="button" id="clinic-injury-body-parts-save" class="btn-primary">حفظ</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        renderList();

        modal.querySelector('#clinic-injury-body-parts-add-row').addEventListener('click', () => {
            items.push({ id: 'ib-' + Date.now() + '-' + items.length, text: '' });
            renderList();
        });
        modal.querySelector('#clinic-injury-body-parts-reset').addEventListener('click', () => {
            items = toItems(this.DEFAULT_INJURY_BODY_PARTS || []);
            renderList();
        });
        modal.querySelector('#clinic-injury-body-parts-save').addEventListener('click', () => {
            modal.querySelectorAll('#clinic-injury-body-parts-list input').forEach(input => {
                const id = input.getAttribute('data-id');
                const it = items.find(i => i.id === id);
                if (it) it.text = input.value.trim();
            });
            const list = items.map(i => i.text).filter(Boolean);
            if (list.length === 0) {
                Notification?.warning?.('أضف بنداً واحداً على الأقل أو استعد الافتراضي');
                return;
            }
            if (!AppState.appData) AppState.appData = {};
            AppState.appData.clinicInjuryBodyParts = list;
            if (typeof DataManager !== 'undefined' && DataManager.save) DataManager.save();
            Notification?.success?.('تم حفظ قائمة أماكن الإصابة بالجسم');
            if (this.state.activeTab === 'injuries') this.renderInjuriesTab();
            modal.remove();
        });
        modal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
    },

    /**
     * إرسال إشعار لمدير النظام عند وصول تردد موظف/مقاول على العيادة إلى الحد الشهري أو أكثر
     */
    async notifyAdminsAboutHighClinicVisits(visitData, monthlyCount) {
        try {
            const usersResult = await GoogleIntegration.sendRequest({
                action: 'readFromSheet',
                data: { sheetName: 'Users' }
            });

            if (!usersResult || !usersResult.success || !Array.isArray(usersResult.data)) return;

            const admins = usersResult.data.filter(user => {
                const role = (user.role || '').toLowerCase();
                return role === 'admin' || role === 'مدير';
            });

            const threshold = this.getMonthlyVisitsAlertThreshold();
            const personLabel = (visitData.personType || '').toString().toLowerCase() === 'employee'
                ? (visitData.employeeName || visitData.employeeCode || 'موظف')
                : (visitData.contractorWorkerName || visitData.contractorName || visitData.externalName || 'مقاول/عامل');
            const title = 'تنبيه: تردد عالٍ على العيادة';
            const message = `الموظف/المقاول "${personLabel}" بلغ عدد زياراته للعيادة هذا الشهر ${monthlyCount} زيارة (الحد ${threshold}).`;

            for (const admin of admins) {
                if (admin.id || admin.email) {
                    try {
                        await GoogleIntegration.sendRequest({
                            action: 'addNotification',
                            data: {
                                userId: admin.id || admin.email,
                                title: title,
                                message: message,
                                type: 'clinic_high_visits',
                                priority: 'high',
                                link: '#clinic',
                                data: {
                                    module: 'clinic',
                                    action: 'high_monthly_visits',
                                    personType: visitData.personType,
                                    monthlyCount: monthlyCount,
                                    personLabel: personLabel
                                }
                            }
                        });
                    } catch (err) {
                        Utils.safeWarn('فشل إرسال إشعار تردد العيادة للمدير:', err);
                    }
                }
            }
        } catch (error) {
            Utils.safeWarn('خطأ في إرسال إشعارات تردد العيادة للمديرين:', error);
        }
    },

    exportMedicationsToExcel() {
        const medications = this.getFilteredMedications();
        if (medications.length === 0) {
            Notification?.info?.('لا توجد بيانات لتصديرها');
            return;
        }
        if (typeof XLSX === 'undefined') {
            Notification?.error?.('مكتبة Excel غير متوفرة');
            return;
        }

        const excelData = medications.map((item) => {
            const quantityAdded = item.quantityAdded ?? item.quantity ?? 0;
            const remainingQuantity = item.remainingQuantity ?? item.quantity ?? 0;
            const dispensed = Math.max(0, quantityAdded - remainingQuantity);
            return {
                'اسم الدواء': item.name || '',
                'نوع الدواء': item.type || '',
                'الاستخدام': item.usage || item.notes || '',
                'تاريخ الشراء': item.purchaseDate ? this.formatDate(item.purchaseDate) : '',
                'تاريخ انتهاء الصلاحية': item.expiryDate ? this.formatDate(item.expiryDate) : '',
                'الحالة': item.status || 'ساري',
                'عدد الأيام المتبقية': item.daysRemaining ?? '',
                'الكمية': quantityAdded,
                'المنصرف': dispensed,
                'الرصيد': remainingQuantity
            };
        });

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Medications');
        const fileName = `Clinic_Medications_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    },

    exportMedicationsToPDF() {
        const medications = this.getFilteredMedications();
        if (medications.length === 0) {
            Notification?.info?.('لا توجد بيانات لتصديرها');
            return;
        }

        const rows = medications.map((item) => {
            const quantityAdded = item.quantityAdded ?? item.quantity ?? 0;
            const remainingQuantity = item.remainingQuantity ?? item.quantity ?? 0;
            const dispensed = Math.max(0, quantityAdded - remainingQuantity);
            return `
            <tr>
                <td>${Utils.escapeHTML(item.name || '')}</td>
                <td>${Utils.escapeHTML(item.type || '')}</td>
                <td>${Utils.escapeHTML(item.usage || item.notes || '—')}</td>
                <td>${this.formatDate(item.purchaseDate)}</td>
                <td>${item.expiryDate ? this.formatDate(item.expiryDate) : '—'}</td>
                <td>${Utils.escapeHTML(item.status || 'ساري')}</td>
                <td>${item.daysRemaining ?? '—'}</td>
                <td class="text-center">${quantityAdded}</td>
                <td class="text-center">${dispensed}</td>
                <td class="text-center">${remainingQuantity}</td>
            </tr>
        `;
        }).join('');

        const content = `
            <table>
                <thead>
                    <tr>
                        <th>اسم الدواء</th>
                        <th>نوع الدواء</th>
                        <th>الاستخدام</th>
                        <th>تاريخ الشراء</th>
                        <th>تاريخ انتهاء الصلاحية</th>
                        <th>الحالة</th>
                        <th>عدد الأيام المتبقية</th>
                        <th>الكمية</th>
                        <th>المنصرف</th>
                        <th>الرصيد</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;

        const formCode = `CLINIC-MED-${new Date().toISOString().slice(0, 10)}`;
        const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
            ? FormHeader.generatePDFHTML(formCode, 'سجل الأدوية', content, false, true)
            : `<html><body>${content}</body></html>`;

        try {
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }, 400);
                };
            } else {
                Notification?.error?.('يرجى السماح للنوافذ المنبثقة لتصدير PDF');
            }
        } catch (error) {
            Utils.safeError('فشل تصدير سجل الأدوية:', error);
            Notification?.error?.('تعذر تصدير سجل الأدوية');
        }
    },

    renderSickLeaveTab() {
        const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="sickLeave"]');
        if (!panel) return;

        const filters = this.state.filters.sickLeave || {};
        const leaves = this.getFilteredSickLeaves();
        const departments = this.getClinicDepartments();

        const rows = leaves.map((item) => {
            const name = item.employeeName || item.personName || '';
            const department = item.employeeDepartment || '—';
            const start = this.formatDate(item.startDate);
            const end = this.formatDate(item.endDate);
            const days = item.daysCount ?? this.calculateSickLeaveDays(item.startDate, item.endDate);
            const doctor = item.treatingDoctor || '—';
            return `
                <tr>
                    <td>${Utils.escapeHTML(name)}</td>
                    <td>${Utils.escapeHTML(department)}</td>
                    <td>${start}</td>
                    <td>${end}</td>
                    <td>${days}</td>
                    <td>${Utils.escapeHTML(doctor)}</td>
                    <td class="text-center">
                        <div class="flex items-center justify-center gap-2">
                            <button type="button" class="btn-icon btn-icon-primary" data-action="view-sick-leave" data-id="${Utils.escapeHTML(item.id || '')}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button type="button" class="btn-icon btn-icon-warning" data-action="edit-sick-leave" data-id="${Utils.escapeHTML(item.id || '')}">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const tableHtml = leaves.length
            ? `
                <div class="table-wrapper clinic-table-wrapper" style="overflow-x: auto; overflow-y: auto; max-height: 70vh;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>اسم الموظف</th>
                                <th>القسم / الإدارة</th>
                                <th>تاريخ البداية</th>
                                <th>تاريخ النهاية</th>
                                <th>عدد الأيام</th>
                                <th>الطبيب المعالج</th>
                                <th class="text-center">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `
            : this.renderEmptyState('لا توجد إجازات مرضية مسجلة.');

        panel.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div class="flex flex-wrap items-center gap-2">
                    <div class="relative">
                        <input type="text" id="sick-leave-search" class="form-input pr-10" placeholder="بحث بالاسم أو القسم" value="${Utils.escapeHTML(filters.search || '')}">
                        <i class="fas fa-search absolute top-3 right-3 text-gray-400"></i>
                    </div>
                    <select id="sick-leave-department" class="form-input">
                        <option value="">جميع الإدارات</option>
                        ${departments.map((department) => `
                            <option value="${Utils.escapeHTML(department)}" ${filters.department === department ? 'selected' : ''}>${Utils.escapeHTML(department)}</option>
                        `).join('')}
                    </select>
                    <input type="date" id="sick-leave-date-from" class="form-input" value="${filters.dateFrom || ''}" title="من تاريخ">
                    <input type="date" id="sick-leave-date-to" class="form-input" value="${filters.dateTo || ''}" title="إلى تاريخ">
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" class="btn-secondary" id="sick-leave-export-pdf-btn">
                        <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                    </button>
                    <button type="button" class="btn-success" id="sick-leave-export-excel-btn">
                        <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                    </button>
                    <button type="button" class="btn-primary" id="sick-leave-add-btn">
                        <i class="fas fa-plus ml-2"></i>إضافة جديد
                    </button>
                </div>
            </div>
            ${tableHtml}
        `;
        this.applyModuleI18n(panel);

        this.bindSickLeaveTabEvents(panel);
        
        // إضافة مستمعي التمرير للجدول
        setTimeout(() => {
            const wrapper = panel.querySelector('.clinic-table-wrapper');
            if (wrapper) {
                this.setupTableScrollListeners(wrapper);
            }
        }, 100);
    },

    bindSickLeaveTabEvents(panel) {
        const searchInput = panel.querySelector('#sick-leave-search');
        const departmentSelect = panel.querySelector('#sick-leave-department');
        const dateFromInput = panel.querySelector('#sick-leave-date-from');
        const dateToInput = panel.querySelector('#sick-leave-date-to');
        const addBtn = panel.querySelector('#sick-leave-add-btn');
        const exportPdfBtn = panel.querySelector('#sick-leave-export-pdf-btn');
        const exportExcelBtn = panel.querySelector('#sick-leave-export-excel-btn');

        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                this.state.filters.sickLeave.search = event.target.value.trim();
                this.renderSickLeaveTab();
            });
        }

        if (departmentSelect) {
            departmentSelect.addEventListener('change', (event) => {
                this.state.filters.sickLeave.department = event.target.value;
                this.renderSickLeaveTab();
            });
        }

        if (dateFromInput) {
            dateFromInput.addEventListener('change', (event) => {
                this.state.filters.sickLeave.dateFrom = event.target.value;
                this.renderSickLeaveTab();
            });
        }

        if (dateToInput) {
            dateToInput.addEventListener('change', (event) => {
                this.state.filters.sickLeave.dateTo = event.target.value;
                this.renderSickLeaveTab();
            });
        }

        addBtn?.addEventListener('click', () => this.showSickLeaveForm());
        exportPdfBtn?.addEventListener('click', () => this.exportSickLeaveToPDF());
        exportExcelBtn?.addEventListener('click', () => this.exportSickLeaveToExcel());

        panel.querySelectorAll('[data-action="view-sick-leave"]').forEach((btn) => {
            btn.addEventListener('click', () => this.viewSickLeaveRecord(btn.getAttribute('data-id')));
        });
        panel.querySelectorAll('[data-action="edit-sick-leave"]').forEach((btn) => {
            btn.addEventListener('click', () => this.editSickLeave(btn.getAttribute('data-id')));
        });
    },

    viewSickLeaveRecord(id) {
        const record = this.getSickLeaves().find((item) => item.id === id);
        if (!record) {
            Notification?.error?.('تعذر العثور على الإجازة المرضية المطلوبة');
            return;
        }

        const name = record.employeeName || record.personName || '';
        const department = record.employeeDepartment || '—';
        const start = this.formatDate(record.startDate);
        const end = this.formatDate(record.endDate);
        const days = record.daysCount ?? this.calculateSickLeaveDays(record.startDate, record.endDate);
        const doctor = record.treatingDoctor || '—';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 740px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">تفاصيل الإجازة المرضية</h2>
                    <button type="button" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span class="text-sm font-semibold text-gray-600">الاسم</span>
                            <p class="text-gray-800">${Utils.escapeHTML(name)}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">القسم / الإدارة</span>
                            <p class="text-gray-800">${Utils.escapeHTML(department)}</p>
                        </div>
                        ${record.employeeCode ? `
                            <div>
                                <span class="text-sm font-semibold text-gray-600">الكود الوظيفي</span>
                                <p class="text-gray-800">${Utils.escapeHTML(record.employeeCode)}</p>
                            </div>
                        ` : ''}
                        <div>
                            <span class="text-sm font-semibold text-gray-600">الطبيب المعالج</span>
                            <p class="text-gray-800">${Utils.escapeHTML(doctor)}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">تاريخ البداية</span>
                            <p class="text-gray-800">${start}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">تاريخ النهاية</span>
                            <p class="text-gray-800">${end}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">عدد الأيام</span>
                            <p class="text-gray-800">${days}</p>
                        </div>
                    </div>
                    <div>
                        <span class="text-sm font-semibold text-gray-600">سبب الإجازة</span>
                        <p class="text-gray-800 whitespace-pre-line">${Utils.escapeHTML(record.reason || '')}</p>
                    </div>
                    ${record.medicalNotes ? `
                        <div>
<span class="text-sm font-semibold text-gray-600">ملاحظات طبية</span>
                                <p class="text-gray-800 whitespace-pre-line">${Utils.escapeHTML(record.medicalNotes || '')}</p>
                        </div>
                    ` : ''}
                    <div class="text-sm text-gray-500 border-t pt-3">
                        ${record.createdBy?.name ? `تم التسجيل بواسطة: ${Utils.escapeHTML(record.createdBy.name)}` : ''}
                        ${record.createdAt ? `<span class="ml-2">بتاريخ ${this.formatDate(record.createdAt, true)}</span>` : ''}
                    </div>
                </div>
                <div class="modal-footer form-actions-centered">
                    <button type="button" class="btn-secondary modal-close-btn">إغلاق</button>
                    <button type="button" class="btn-secondary modal-print-btn">
                        <i class="fas fa-print ml-2"></i>طباعة
                    </button>
                    <button type="button" class="btn-primary modal-edit-btn">
                        <i class="fas fa-edit ml-2"></i>تعديل
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const closeModal = () => modal.remove();

        modal.querySelectorAll('.modal-close, .modal-close-btn').forEach((btn) => btn.addEventListener('click', closeModal));
        modal.querySelector('.modal-edit-btn')?.addEventListener('click', () => {
            closeModal();
            this.showSickLeaveForm(record);
        });
        modal.querySelector('.modal-print-btn')?.addEventListener('click', () => this.printSickLeaveRecord(record.id));
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النافذة.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) closeModal();
            }
        });
    },

    editSickLeave(id) {
        const record = this.getSickLeaves().find((item) => item.id === id);
        if (!record) {
            Notification?.error?.('تعذر العثور على الإجازة المرضية');
            return;
        }
        this.showSickLeaveForm(record);
    },

    printSickLeaveRecord(id) {
        const record = this.getSickLeaves().find((item) => item.id === id);
        if (!record) {
            Notification?.error?.('تعذر العثور على الإجازة المرضية للطباعة');
            return;
        }

        const name = record.employeeName || record.personName || '';
        const department = record.employeeDepartment || '—';
        const doctor = record.treatingDoctor || '—';
        const days = record.daysCount ?? this.calculateSickLeaveDays(record.startDate, record.endDate);

        const content = `
            <table>
                <tr><th>الاسم</th><td>${Utils.escapeHTML(name)}</td></tr>
                <tr><th>القسم / الإدارة</th><td>${Utils.escapeHTML(department)}</td></tr>
                ${record.employeeCode ? `<tr><th>الكود الوظيفي</th><td>${Utils.escapeHTML(record.employeeCode)}</td></tr>` : ''}
                <tr><th>تاريخ البداية</th><td>${this.formatDate(record.startDate)}</td></tr>
                <tr><th>تاريخ النهاية</th><td>${this.formatDate(record.endDate)}</td></tr>
                <tr><th>عدد الأيام</th><td>${days}</td></tr>
                <tr><th>الطبيب المعالج</th><td>${Utils.escapeHTML(doctor)}</td></tr>
            </table>
            <div class="section-title">سبب الإجازة</div>
            <div class="description">${Utils.escapeHTML(record.reason || '')}</div>
            ${record.medicalNotes ? `
                <div class="section-title">ملاحظات طبية</div>
                <div class="description">${Utils.escapeHTML(record.medicalNotes || '')}</div>
            ` : ''}
        `;

        const formCode = `SICK-LEAVE-${record.id}`;
        const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
            ? FormHeader.generatePDFHTML(formCode, 'نموذج إجازة مرضية', content, false, true, {}, record.createdAt, record.updatedAt)
            : `<html><body>${content}</body></html>`;

        try {
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }, 400);
                };
            } else {
                Notification?.error?.('يرجى السماح للنوافذ المنبثقة للطباعة');
            }
        } catch (error) {
            Utils.safeError('فشل طباعة الإجازة المرضية:', error);
            Notification?.error?.('تعذر طباعة الإجازة المرضية');
        }
    },

    exportSickLeaveToExcel() {
        const leaves = this.getFilteredSickLeaves();
        if (leaves.length === 0) {
            Notification?.info?.('لا توجد بيانات لتصديرها');
            return;
        }
        if (typeof XLSX === 'undefined') {
            Notification?.error?.('مكتبة Excel غير متوفرة');
            return;
        }

        const excelData = leaves.map((item) => ({
            'الاسم': item.employeeName || item.personName || '',
            'القسم': item.employeeDepartment || '',
            'تاريخ البداية': this.formatDate(item.startDate),
            'تاريخ النهاية': this.formatDate(item.endDate),
            'عدد الأيام': item.daysCount ?? this.calculateSickLeaveDays(item.startDate, item.endDate),
            'الطبيب المعالج': item.treatingDoctor || '',
            'السبب': item.reason || '',
            'ملاحظات طبية': item.medicalNotes || ''
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'SickLeave');
        const fileName = `Clinic_SickLeave_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    },

    exportSickLeaveToPDF() {
        const leaves = this.getFilteredSickLeaves();
        if (leaves.length === 0) {
            Notification?.info?.('لا توجد بيانات لتصديرها');
            return;
        }

        const rows = leaves.map((item) => `
            <tr>
                <td>${Utils.escapeHTML(item.employeeName || item.personName || '')}</td>
                <td>${Utils.escapeHTML(item.employeeDepartment || '')}</td>
                <td>${this.formatDate(item.startDate)}</td>
                <td>${this.formatDate(item.endDate)}</td>
                <td>${item.daysCount ?? this.calculateSickLeaveDays(item.startDate, item.endDate)}</td>
                <td>${Utils.escapeHTML(item.treatingDoctor || '')}</td>
            </tr>
        `).join('');

        const content = `
            <table>
                <thead>
                    <tr>
                        <th>الاسم</th>
                        <th>القسم</th>
                        <th>تاريخ البداية</th>
                        <th>تاريخ النهاية</th>
                        <th>عدد الأيام</th>
                        <th>الطبيب المعالج</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;

        const formCode = `SICK-LEAVE-REPORT-${new Date().toISOString().slice(0, 10)}`;
        const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
            ? FormHeader.generatePDFHTML(formCode, 'تقرير الإجازات المرضية', content, false, true)
            : `<html><body>${content}</body></html>`;

        try {
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }, 400);
                };
            } else {
                Notification?.error?.('يرجى السماح للنوافذ المنبثقة لتصدير PDF');
            }
        } catch (error) {
            Utils.safeError('فشل تصدير تقرير الإجازات المرضية:', error);
            Notification?.error?.('تعذر تصدير تقرير الإجازات المرضية');
        }
    },

    renderInjuriesTab() {
        const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="injuries"]');
        if (!panel) return;

        const filters = this.state.filters.injuries || {};
        const allInjuries = this.getInjuries();
        const injuries = this.getFilteredInjuries();
        const departments = this.getClinicDepartments();
        const injuryTypes = this.getInjuryTypeOptions();
        const injuryBodyParts = this.getInjuryBodyPartOptions();
        const isContractorsTab = this.state.activeInjuryType === 'contractors';
        const employeeCount = allInjuries.filter(i => String(i.personType || 'employee').toLowerCase() === 'employee').length;
        const contractorCount = allInjuries.length - employeeCount;

        const rows = injuries.map((item) => {
            const contractorName = item.contractorName || '—';
            const employeeCode = item.employeeCode || item.employeeNumber || '—';
            const injuredName = item.employeeName || item.personName || item.contractorWorkerName || '—';
            const factory = item.factoryName || item.factory || '—';
            const subLocation = item.subLocationName || item.subLocation || '—';
            const department = item.department || item.employeeDepartment || '—';
            const date = this.formatDate(item.injuryDate, true);
            const status = item.status || 'قيد المتابعة';
            const attachmentsCount = Array.isArray(item.attachments) ? item.attachments.length : 0;
            const rowClass = this.getInjuryRowClass(status);
            return `
                <tr class="${rowClass}">
                    ${isContractorsTab
                    ? `<td>${Utils.escapeHTML(contractorName)}</td>`
                    : `<td>${Utils.escapeHTML(employeeCode)}</td>`
                }
                    <td>${Utils.escapeHTML(injuredName)}</td>
                    <td>${Utils.escapeHTML(factory)}</td>
                    <td>${Utils.escapeHTML(subLocation)}</td>
                    <td>${Utils.escapeHTML(department)}</td>
                    <td>${date}</td>
                    <td>${Utils.escapeHTML(item.injuryType || '')}</td>
                    <td>${Utils.escapeHTML(item.injuryBodyPart || '')}</td>
                    <td>
                        <span class="badge ${this.getInjuryStatusBadgeClass(status)}">${Utils.escapeHTML(status)}</span>
                    </td>
                    <td class="text-center">${attachmentsCount}</td>
                    <td class="text-center">
                        <div class="flex items-center justify-center gap-2">
                            <button type="button" class="btn-icon btn-icon-primary" data-action="view-injury" data-id="${Utils.escapeHTML(item.id || '')}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button type="button" class="btn-icon btn-icon-warning" data-action="edit-injury" data-id="${Utils.escapeHTML(item.id || '')}">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const tableHtml = injuries.length
            ? `
                <div class="table-wrapper clinic-table-wrapper" style="overflow-x: auto; overflow-y: auto; max-height: 70vh;">
                    <table class="data-table table-header-red">
                        <thead>
                            <tr>
                                <th>${isContractorsTab ? 'اسم المقاول' : 'الكود الوظيفي'}</th>
                                <th>اسم المصاب</th>
                                <th>المصنع</th>
                                <th>الموقع الفرعي</th>
                                <th>الإدارة / القسم</th>
                                <th>تاريخ الإصابة</th>
                                <th>نوع الإصابة</th>
                                <th>مكان الإصابة (بالجسم)</th>
                                <th>الحالة</th>
                                <th>عدد المرفقات</th>
                                <th class="text-center">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `
            : this.renderEmptyState('لا توجد إصابات طبية مسجلة.');

        panel.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div class="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                    <button type="button" class="btn-${this.state.activeInjuryType === 'employees' ? 'primary' : 'secondary'} injury-person-tab-btn" data-tab="employees">
                        الموظفين (${employeeCount})
                    </button>
                    <button type="button" class="btn-${this.state.activeInjuryType === 'contractors' ? 'primary' : 'secondary'} injury-person-tab-btn" data-tab="contractors">
                        المقاولين (${contractorCount})
                    </button>
                </div>
                <div class="flex items-center gap-2">
                    ${this.isCurrentUserAdmin() ? `
                    <button type="button" class="btn-secondary" id="injuries-types-settings-btn" title="إدارة أنواع الإصابات (مدير النظام فقط)">
                        <i class="fas fa-list-ul ml-2"></i>أنواع الإصابات
                    </button>
                    <button type="button" class="btn-secondary" id="injuries-body-parts-settings-btn" title="إدارة أماكن الإصابة بالجسم (مدير النظام فقط)">
                        <i class="fas fa-user-injured ml-2"></i>أماكن الإصابة بالجسم
                    </button>
                    ` : ''}
                    <button type="button" class="btn-secondary" id="injuries-export-pdf-btn">
                        <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                    </button>
                    <button type="button" class="btn-success" id="injuries-export-excel-btn">
                        <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                    </button>
                    <button type="button" class="btn-primary" id="injuries-add-btn">
                        <i class="fas fa-plus ml-2"></i>إضافة جديد
                    </button>
                </div>
            </div>
            <div class="visits-filters-row" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 16px 20px; margin: 0 -20px 14px -20px; width: calc(100% + 40px);">
                <div class="filters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; align-items: end;">
                    <div class="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                        <label class="filter-label" for="injuries-search">بحث</label>
                        <div class="relative w-full">
                            <input type="text" id="injuries-search" class="form-input pr-10 filter-input" placeholder="بحث بالاسم أو الكود أو نوع الإصابة" value="${Utils.escapeHTML(filters.search || '')}">
                            <i class="fas fa-search absolute top-3 right-3 text-gray-400"></i>
                        </div>
                    </div>
                    <div class="filter-field">
                        <label class="filter-label" for="injuries-status">الحالة</label>
                        <select id="injuries-status" class="form-input filter-input">
                            <option value="all" ${filters.status === 'all' ? 'selected' : ''}>جميع الحالات</option>
                            <option value="قيد المتابعة" ${filters.status === 'قيد المتابعة' ? 'selected' : ''}>قيد المتابعة</option>
                            <option value="تم الشفاء" ${filters.status === 'تم الشفاء' ? 'selected' : ''}>تم الشفاء</option>
                            <option value="مغلق" ${filters.status === 'مغلق' ? 'selected' : ''}>مغلق</option>
                        </select>
                    </div>
                    <div class="filter-field">
                        <label class="filter-label" for="injuries-type-filter">نوع الإصابة</label>
                        <select id="injuries-type-filter" class="form-input filter-input">
                            <option value="all" ${(filters.injuryType || 'all') === 'all' ? 'selected' : ''}>جميع الأنواع</option>
                            ${injuryTypes.map((type) => `
                                <option value="${Utils.escapeHTML(type)}" ${(filters.injuryType || 'all') === type ? 'selected' : ''}>${Utils.escapeHTML(type)}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="filter-field">
                        <label class="filter-label" for="injuries-body-part-filter">مكان الإصابة (بالجسم)</label>
                        <select id="injuries-body-part-filter" class="form-input filter-input">
                            <option value="all" ${(filters.injuryBodyPart || 'all') === 'all' ? 'selected' : ''}>جميع الأماكن</option>
                            ${injuryBodyParts.map((part) => `
                                <option value="${Utils.escapeHTML(part)}" ${(filters.injuryBodyPart || 'all') === part ? 'selected' : ''}>${Utils.escapeHTML(part)}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="filter-field">
                        <label class="filter-label" for="injuries-department">الإدارة / القسم</label>
                        <select id="injuries-department" class="form-input filter-input">
                            <option value="">جميع الإدارات</option>
                            ${departments.map((department) => `
                                <option value="${Utils.escapeHTML(department)}" ${filters.department === department ? 'selected' : ''}>${Utils.escapeHTML(department)}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="filter-field">
                        <label class="filter-label" for="injuries-date-from">من تاريخ</label>
                        <input type="date" id="injuries-date-from" class="form-input filter-input" value="${filters.dateFrom || ''}" title="من تاريخ">
                    </div>
                    <div class="filter-field">
                        <label class="filter-label" for="injuries-date-to">إلى تاريخ</label>
                        <input type="date" id="injuries-date-to" class="form-input filter-input" value="${filters.dateTo || ''}" title="إلى تاريخ">
                    </div>
                    <div class="filter-field">
                        <button type="button" id="injuries-reset-filters" class="filter-reset-btn" style="width: 100%;">
                            <i class="fas fa-undo-alt"></i>
                            إعادة تعيين الفلاتر
                        </button>
                    </div>
                </div>
            </div>
            ${tableHtml}
        `;
        this.applyModuleI18n(panel);

        this.bindInjuriesTabEvents(panel);
        
        // إضافة مستمعي التمرير للجدول
        setTimeout(() => {
            const wrapper = panel.querySelector('.clinic-table-wrapper');
            if (wrapper) {
                this.setupTableScrollListeners(wrapper);
            }
        }, 100);
    },

    bindInjuriesTabEvents(panel) {
        const searchInput = panel.querySelector('#injuries-search');
        const typeSelect = panel.querySelector('#injuries-type-filter');
        const bodyPartSelect = panel.querySelector('#injuries-body-part-filter');
        const statusSelect = panel.querySelector('#injuries-status');
        const departmentSelect = panel.querySelector('#injuries-department');
        const dateFromInput = panel.querySelector('#injuries-date-from');
        const dateToInput = panel.querySelector('#injuries-date-to');
        const resetFiltersBtn = panel.querySelector('#injuries-reset-filters');
        const injuryTypesSettingsBtn = panel.querySelector('#injuries-types-settings-btn');
        const injuryBodyPartsSettingsBtn = panel.querySelector('#injuries-body-parts-settings-btn');
        const addBtn = panel.querySelector('#injuries-add-btn');
        const exportPdfBtn = panel.querySelector('#injuries-export-pdf-btn');
        const exportExcelBtn = panel.querySelector('#injuries-export-excel-btn');

        panel.querySelectorAll('.injury-person-tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab') || 'employees';
                this.state.activeInjuryType = tab;
                this.renderInjuriesTab();
            });
        });

        if (searchInput) {
            let isComposing = false;
            const triggerSearch = (value, caretPos = null) => {
                this.state.filters.injuries.search = String(value || '');
                if (this._injurySearchDebounceTimer) {
                    clearTimeout(this._injurySearchDebounceTimer);
                }
                this._injurySearchDebounceTimer = setTimeout(() => {
                    this.renderInjuriesTab();
                    requestAnimationFrame(() => {
                        const newInput = document.getElementById('injuries-search');
                        if (!newInput) return;
                        newInput.focus();
                        const pos = typeof caretPos === 'number' ? caretPos : newInput.value.length;
                        try {
                            newInput.setSelectionRange(pos, pos);
                        } catch (e) { /* ignore */ }
                    });
                }, 120);
            };

            searchInput.addEventListener('compositionstart', () => {
                isComposing = true;
            });
            searchInput.addEventListener('compositionend', (event) => {
                isComposing = false;
                triggerSearch(event.target.value, event.target.selectionStart);
            });
            searchInput.addEventListener('input', (event) => {
                if (isComposing) return;
                triggerSearch(event.target.value, event.target.selectionStart);
            });
        }

        if (statusSelect) {
            statusSelect.addEventListener('change', (event) => {
                this.state.filters.injuries.status = event.target.value;
                this.renderInjuriesTab();
            });
        }

        if (typeSelect) {
            typeSelect.addEventListener('change', (event) => {
                this.state.filters.injuries.injuryType = event.target.value;
                this.renderInjuriesTab();
            });
        }
        if (bodyPartSelect) {
            bodyPartSelect.addEventListener('change', (event) => {
                this.state.filters.injuries.injuryBodyPart = event.target.value;
                this.renderInjuriesTab();
            });
        }

        if (departmentSelect) {
            departmentSelect.addEventListener('change', (event) => {
                this.state.filters.injuries.department = event.target.value;
                this.renderInjuriesTab();
            });
        }

        if (dateFromInput) {
            dateFromInput.addEventListener('change', (event) => {
                this.state.filters.injuries.dateFrom = event.target.value;
                this.renderInjuriesTab();
            });
        }

        if (dateToInput) {
            dateToInput.addEventListener('change', (event) => {
                this.state.filters.injuries.dateTo = event.target.value;
                this.renderInjuriesTab();
            });
        }

        addBtn?.addEventListener('click', () => this.showInjuryForm());
        injuryTypesSettingsBtn?.addEventListener('click', () => this.showInjuryTypesSettingsModal());
        injuryBodyPartsSettingsBtn?.addEventListener('click', () => this.showInjuryBodyPartsSettingsModal());
        resetFiltersBtn?.addEventListener('click', () => {
            this.state.filters.injuries = { search: '', status: 'all', department: '', injuryType: 'all', injuryBodyPart: 'all', dateFrom: '', dateTo: '' };
            this.renderInjuriesTab();
        });
        exportPdfBtn?.addEventListener('click', () => this.exportInjuriesToPDF());
        exportExcelBtn?.addEventListener('click', () => this.exportInjuriesToExcel());

        panel.querySelectorAll('[data-action="view-injury"]').forEach((btn) => {
            btn.addEventListener('click', () => this.viewInjuryRecord(btn.getAttribute('data-id')));
        });
        panel.querySelectorAll('[data-action="edit-injury"]').forEach((btn) => {
            btn.addEventListener('click', () => this.editInjury(btn.getAttribute('data-id')));
        });
    },

    // ===== قسم تحليل بيانات المترددين على العيادة =====

    /**
     * جمع وتحليل بيانات المترددين على العيادة
     */
    analyzeClinicVisitsData() {
        const visits = AppState.appData.clinicVisits || [];
        const sickLeaves = AppState.appData.sickLeave || [];
        const injuries = AppState.appData.injuries || [];

        // دمج جميع البيانات في مصدر واحد للتحليل
        const allRecords = [
            ...visits.map(v => ({
                type: 'زيارة',
                personType: v.personType === 'contractor' ? 'مقاول' : 'موظف',
                name: v.employeeName || v.contractorName || v.externalName || '',
                jobTitle: v.employeePosition || v.position || '-',
                location: v.employeeLocation || v.workArea || '-',
                department: v.employeeDepartment || v.department || '-',
                diagnosis: v.diagnosis || '-',
                date: v.visitDate || v.createdAt
            })),
            ...sickLeaves.map(s => ({
                type: 'إجازة مرضية',
                personType: s.personType === 'contractor' ? 'مقاول' : 'موظف',
                name: s.employeeName || s.personName || '',
                jobTitle: s.employeePosition || '-',
                location: '-',
                department: s.employeeDepartment || s.department || '-',
                diagnosis: s.reason || '-',
                date: s.startDate || s.createdAt
            })),
            ...injuries.map(i => ({
                type: 'إصابة',
                personType: i.personType === 'contractor' ? 'مقاول' : 'موظف',
                name: i.employeeName || i.personName || '',
                jobTitle: '-',
                location: i.injuryLocation || '-',
                department: i.employeeDepartment || i.department || '-',
                diagnosis: i.injuryType || '-',
                date: i.injuryDate || i.createdAt
            }))
        ];

        // التحليل حسب الوظيفة (Job Title)
        const byJobTitle = {};
        allRecords.forEach(record => {
            const key = record.jobTitle;
            if (!byJobTitle[key]) {
                byJobTitle[key] = { total: 0, employees: 0, contractors: 0, visits: 0, sickLeaves: 0, injuries: 0 };
            }
            byJobTitle[key].total++;
            if (record.personType === 'موظف') byJobTitle[key].employees++;
            if (record.personType === 'مقاول') byJobTitle[key].contractors++;
            if (record.type === 'زيارة') byJobTitle[key].visits++;
            if (record.type === 'إجازة مرضية') byJobTitle[key].sickLeaves++;
            if (record.type === 'إصابة') byJobTitle[key].injuries++;
        });

        // التحليل حسب مكان العمل (Location)
        const byLocation = {};
        allRecords.forEach(record => {
            const key = record.location;
            if (!byLocation[key]) {
                byLocation[key] = { total: 0, employees: 0, contractors: 0, visits: 0, sickLeaves: 0, injuries: 0 };
            }
            byLocation[key].total++;
            if (record.personType === 'موظف') byLocation[key].employees++;
            if (record.personType === 'مقاول') byLocation[key].contractors++;
            if (record.type === 'زيارة') byLocation[key].visits++;
            if (record.type === 'إجازة مرضية') byLocation[key].sickLeaves++;
            if (record.type === 'إصابة') byLocation[key].injuries++;
        });

        // التحليل حسب الإدارة (Department)
        const byDepartment = {};
        allRecords.forEach(record => {
            const key = record.department;
            if (!byDepartment[key]) {
                byDepartment[key] = { total: 0, employees: 0, contractors: 0, visits: 0, sickLeaves: 0, injuries: 0 };
            }
            byDepartment[key].total++;
            if (record.personType === 'موظف') byDepartment[key].employees++;
            if (record.personType === 'مقاول') byDepartment[key].contractors++;
            if (record.type === 'زيارة') byDepartment[key].visits++;
            if (record.type === 'إجازة مرضية') byDepartment[key].sickLeaves++;
            if (record.type === 'إصابة') byDepartment[key].injuries++;
        });

        // التحليل حسب التشخيص (Diagnosis)
        const byDiagnosis = {};
        allRecords.forEach(record => {
            const key = record.diagnosis;
            if (!byDiagnosis[key]) {
                byDiagnosis[key] = { total: 0, employees: 0, contractors: 0, visits: 0, sickLeaves: 0, injuries: 0 };
            }
            byDiagnosis[key].total++;
            if (record.personType === 'موظف') byDiagnosis[key].employees++;
            if (record.personType === 'مقاول') byDiagnosis[key].contractors++;
            if (record.type === 'زيارة') byDiagnosis[key].visits++;
            if (record.type === 'إجازة مرضية') byDiagnosis[key].sickLeaves++;
            if (record.type === 'إصابة') byDiagnosis[key].injuries++;
        });

        return {
            totalRecords: allRecords.length,
            totalEmployees: allRecords.filter(r => r.personType === 'موظف').length,
            totalContractors: allRecords.filter(r => r.personType === 'مقاول').length,
            totalVisits: visits.length,
            totalSickLeaves: sickLeaves.length,
            totalInjuries: injuries.length,
            byJobTitle: Object.entries(byJobTitle).sort((a, b) => b[1].total - a[1].total),
            byLocation: Object.entries(byLocation).sort((a, b) => b[1].total - a[1].total),
            byDepartment: Object.entries(byDepartment).sort((a, b) => b[1].total - a[1].total),
            byDiagnosis: Object.entries(byDiagnosis).sort((a, b) => b[1].total - a[1].total)
        };
    },


    /**
     * عرض قسم تحليل بيانات المترددين
     */
    renderAnalyticsTab() {
        const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="analytics"]');
        if (!panel) return;

        const analytics = this.analyzeClinicVisitsData();

        // إنشاء جداول التحليل
        const createAnalysisTable = (title, data, iconClass) => {
            if (!data || data.length === 0) {
                return `
                    <div class="content-card mb-4">
                        <div class="card-header">
                            <h3 class="card-title"><i class="${iconClass} ml-2"></i>${title}</h3>
                        </div>
                        <div class="card-body">
                            <p class="text-gray-500 text-center py-4">لا توجد بيانات متاحة</p>
                        </div>
                    </div>
                `;
            }

            const rows = data.map(([key, stats]) => `
                <tr>
                    <td class="font-semibold">${Utils.escapeHTML(key)}</td>
                    <td class="text-center font-bold text-blue-600">${stats.total}</td>
                    <td class="text-center">${stats.employees}</td>
                    <td class="text-center">${stats.contractors}</td>
                    <td class="text-center text-green-600">${stats.visits}</td>
                    <td class="text-center text-yellow-600">${stats.sickLeaves}</td>
                    <td class="text-center text-red-600">${stats.injuries}</td>
                </tr>
            `).join('');

            return `
                <div class="content-card mb-4">
                    <div class="card-header">
                        <h3 class="card-title"><i class="${iconClass} ml-2"></i>${title}</h3>
                    </div>
                    <div class="card-body">
                        <div class="table-wrapper" style="overflow-x: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>${title}</th>
                                        <th class="text-center">الإجمالي</th>
                                        <th class="text-center">موظفين</th>
                                        <th class="text-center">مقاولين</th>
                                        <th class="text-center">زيارات</th>
                                        <th class="text-center">إجازات مرضية</th>
                                        <th class="text-center">إصابات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        };

        panel.innerHTML = `
            <div class="space-y-4">
                <!-- ملخص عام -->
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                    <div class="content-card">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                                <i class="fas fa-users text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">إجمالي السجلات</p>
                                <p class="text-2xl font-bold text-gray-900">${analytics.totalRecords}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shadow-sm">
                                <i class="fas fa-user-tie text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">موظفين</p>
                                <p class="text-2xl font-bold text-gray-900">${analytics.totalEmployees}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm">
                                <i class="fas fa-hard-hat text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">مقاولين</p>
                                <p class="text-2xl font-bold text-gray-900">${analytics.totalContractors}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shadow-sm">
                                <i class="fas fa-hospital-user text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">زيارات العيادة</p>
                                <p class="text-2xl font-bold text-gray-900">${analytics.totalVisits}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-yellow-100 text-yellow-600 flex items-center justify-center shadow-sm">
                                <i class="fas fa-notes-medical text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">إجازات مرضية</p>
                                <p class="text-2xl font-bold text-gray-900">${analytics.totalSickLeaves}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shadow-sm">
                                <i class="fas fa-user-injured text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">إصابات</p>
                                <p class="text-2xl font-bold text-gray-900">${analytics.totalInjuries}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- أزرار التصدير -->
                <div class="flex justify-end gap-2 mb-4">
                    <button type="button" class="btn-secondary" id="analytics-export-pdf-btn">
                        <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                    </button>
                    <button type="button" class="btn-success" id="analytics-export-excel-btn">
                        <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                    </button>
                </div>

                <!-- التحليل حسب الوظيفة -->
                ${createAnalysisTable('التحليل حسب الوظيفة', analytics.byJobTitle, 'fas fa-briefcase')}

                <!-- التحليل حسب مكان العمل -->
                ${createAnalysisTable('التحليل حسب مكان العمل', analytics.byLocation, 'fas fa-map-marker-alt')}

                <!-- التحليل حسب الإدارة -->
                ${createAnalysisTable('التحليل حسب الإدارة', analytics.byDepartment, 'fas fa-building')}

                <!-- التحليل حسب التشخيص -->
                ${createAnalysisTable('التحليل حسب التشخيص', analytics.byDiagnosis, 'fas fa-stethoscope')}
            </div>
        `;
        this.applyModuleI18n(panel);

        this.bindAnalyticsTabEvents(panel);
    },

    /**
     * ربط أحداث قسم التحليلات
     */
    bindAnalyticsTabEvents(panel) {
        const exportPdfBtn = panel.querySelector('#analytics-export-pdf-btn');
        const exportExcelBtn = panel.querySelector('#analytics-export-excel-btn');

        exportPdfBtn?.addEventListener('click', () => this.exportAnalyticsToPDF());
        exportExcelBtn?.addEventListener('click', () => this.exportAnalyticsToExcel());
    },

    /**
     * تصدير التحليلات إلى Excel
     */
    exportAnalyticsToExcel() {
        if (typeof XLSX === 'undefined') {
            Notification?.error?.('مكتبة Excel غير متوفرة');
            return;
        }

        const analytics = this.analyzeClinicVisitsData();
        const workbook = XLSX.utils.book_new();

        // ملخص عام
        const summaryData = [
            ['نوع البيانات', 'العدد'],
            ['إجمالي السجلات', analytics.totalRecords],
            ['موظفين', analytics.totalEmployees],
            ['مقاولين', analytics.totalContractors],
            ['زيارات العيادة', analytics.totalVisits],
            ['إجازات مرضية', analytics.totalSickLeaves],
            ['إصابات', analytics.totalInjuries]
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'ملخص عام');

        // دالة مساعدة لإنشاء ورقة من البيانات
        const createSheet = (data, title) => {
            const sheetData = [
                [title, 'الإجمالي', 'موظفين', 'مقاولين', 'زيارات', 'إجازات مرضية', 'إصابات']
            ];
            data.forEach(([key, stats]) => {
                sheetData.push([
                    key,
                    stats.total,
                    stats.employees,
                    stats.contractors,
                    stats.visits,
                    stats.sickLeaves,
                    stats.injuries
                ]);
            });
            return XLSX.utils.aoa_to_sheet(sheetData);
        };

        // إضافة الأوراق
        XLSX.utils.book_append_sheet(workbook, createSheet(analytics.byJobTitle, 'الوظيفة'), 'حسب الوظيفة');
        XLSX.utils.book_append_sheet(workbook, createSheet(analytics.byLocation, 'المكان'), 'حسب المكان');
        XLSX.utils.book_append_sheet(workbook, createSheet(analytics.byDepartment, 'الإدارة'), 'حسب الإدارة');
        XLSX.utils.book_append_sheet(workbook, createSheet(analytics.byDiagnosis, 'التشخيص'), 'حسب التشخيص');

        const fileName = `Clinic_Analytics_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        Notification?.success?.('تم تصدير التحليلات بنجاح');
    },

    /**
     * تصدير التحليلات إلى PDF
     */
    exportAnalyticsToPDF() {
        const analytics = this.analyzeClinicVisitsData();

        // دالة مساعدة لإنشاء جدول HTML
        const createTable = (title, data) => {
            if (!data || data.length === 0) return '';

            const rows = data.map(([key, stats]) => `
                <tr>
                    <td>${Utils.escapeHTML(key)}</td>
                    <td class="text-center">${stats.total}</td>
                    <td class="text-center">${stats.employees}</td>
                    <td class="text-center">${stats.contractors}</td>
                    <td class="text-center">${stats.visits}</td>
                    <td class="text-center">${stats.sickLeaves}</td>
                    <td class="text-center">${stats.injuries}</td>
                </tr>
            `).join('');

            return `
                <div class="section-title">${title}</div>
                <table>
                    <thead>
                        <tr>
                            <th>${title}</th>
                            <th class="text-center">الإجمالي</th>
                            <th class="text-center">موظفين</th>
                            <th class="text-center">مقاولين</th>
                            <th class="text-center">زيارات</th>
                            <th class="text-center">إجازات مرضية</th>
                            <th class="text-center">إصابات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;
        };

        const content = `
            <div class="section-title">ملخص عام</div>
            <table>
                <tbody>
                    <tr><th>إجمالي السجلات</th><td>${analytics.totalRecords}</td></tr>
                    <tr><th>موظفين</th><td>${analytics.totalEmployees}</td></tr>
                    <tr><th>مقاولين</th><td>${analytics.totalContractors}</td></tr>
                    <tr><th>زيارات العيادة</th><td>${analytics.totalVisits}</td></tr>
                    <tr><th>إجازات مرضية</th><td>${analytics.totalSickLeaves}</td></tr>
                    <tr><th>إصابات</th><td>${analytics.totalInjuries}</td></tr>
                </tbody>
            </table>
            
            ${createTable('التحليل حسب الوظيفة', analytics.byJobTitle)}
            ${createTable('التحليل حسب مكان العمل', analytics.byLocation)}
            ${createTable('التحليل حسب الإدارة', analytics.byDepartment)}
            ${createTable('التحليل حسب التشخيص', analytics.byDiagnosis)}
        `;

        const formCode = `CLINIC-ANALYTICS-${new Date().toISOString().slice(0, 10)}`;
        const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
            ? FormHeader.generatePDFHTML(formCode, 'تحليل بيانات المترددين على العيادة الطبية', content, false, true)
            : `<html><body>${content}</body></html>`;

        try {
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }, 400);
                };
                Notification?.success?.('جاري تحضير ملف PDF للطباعة...');
            } else {
                Notification?.error?.('يرجى السماح للنوافذ المنبثقة لتصدير PDF');
            }
        } catch (error) {
            Utils.safeError('فشل تصدير تحليلات العيادة:', error);
            Notification?.error?.('تعذر تصدير التحليلات');
        }
    },

    /**
     * تحليل شامل لجميع بيانات العيادة الطبية
     */
    analyzeAllClinicData() {
        try {
            this.ensureData();
        } catch (error) {
            Utils.safeError('خطأ في ensureData:', error);
        }

        const visits = AppState.appData?.clinicVisits || [];
        const medications = AppState.appData?.clinicMedications || [];
        const sickLeaves = AppState.appData?.sickLeave || [];
        const injuries = AppState.appData?.injuries || [];
        const supplyRequests = AppState.appData?.clinicSupplyRequests || [];

        // تحليل الأدوية
        const medicationAnalysis = {
            total: medications.length,
            byStatus: {},
            byType: {},
            expired: 0,
            expiringSoon: 0,
            totalQuantity: 0,
            totalDispensed: 0,
            byLocation: {}
        };

        medications.forEach(med => {
            const status = med.status || 'ساري';
            const type = med.type || 'غير محدد';
            const location = med.location || 'غير محدد';

            medicationAnalysis.byStatus[status] = (medicationAnalysis.byStatus[status] || 0) + 1;
            medicationAnalysis.byType[type] = (medicationAnalysis.byType[type] || 0) + 1;
            medicationAnalysis.byLocation[location] = (medicationAnalysis.byLocation[location] || 0) + 1;

            if (status === 'منتهي') medicationAnalysis.expired++;
            if (status === 'قريب الانتهاء') medicationAnalysis.expiringSoon++;

            const quantity = med.remainingQuantity ?? med.quantity ?? 0;
            const added = med.quantityAdded ?? med.quantity ?? 0;
            medicationAnalysis.totalQuantity += quantity;
            medicationAnalysis.totalDispensed += Math.max(0, added - quantity);
        });

        // تحليل الزيارات
        const visitAnalysis = {
            total: visits.length,
            byMonth: {},
            byReason: {},
            byPersonType: { موظف: 0, مقاول: 0, خارجي: 0 },
            byDepartment: {},
            byLocation: {},
            averagePerMonth: 0
        };

        visits.forEach(visit => {
            try {
                const dateStr = visit.visitDate || visit.createdAt;
                if (!dateStr) return;
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return;
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                visitAnalysis.byMonth[monthKey] = (visitAnalysis.byMonth[monthKey] || 0) + 1;
            } catch (error) {
                // تجاهل الأخطاء في معالجة التاريخ
            }

            const reason = visit.reason || visit.diagnosis || 'غير محدد';
            visitAnalysis.byReason[reason] = (visitAnalysis.byReason[reason] || 0) + 1;

            const personType = visit.personType === 'contractor' ? 'مقاول' :
                visit.personType === 'external' ? 'خارجي' : 'موظف';
            visitAnalysis.byPersonType[personType] = (visitAnalysis.byPersonType[personType] || 0) + 1;

            const dept = visit.employeeDepartment || visit.department || 'غير محدد';
            visitAnalysis.byDepartment[dept] = (visitAnalysis.byDepartment[dept] || 0) + 1;

            const loc = visit.employeeLocation || visit.workArea || 'غير محدد';
            visitAnalysis.byLocation[loc] = (visitAnalysis.byLocation[loc] || 0) + 1;
        });

        const monthsCount = Object.keys(visitAnalysis.byMonth).length;
        visitAnalysis.averagePerMonth = monthsCount > 0 ? (visitAnalysis.total / monthsCount).toFixed(1) : 0;

        // تحليل الإجازات المرضية
        const sickLeaveAnalysis = {
            total: sickLeaves.length,
            byMonth: {},
            byStatus: {},
            byPersonType: { موظف: 0, مقاول: 0 },
            byDepartment: {},
            totalDays: 0,
            averageDays: 0
        };

        sickLeaves.forEach(leave => {
            try {
                const dateStr = leave.startDate || leave.createdAt;
                if (!dateStr) return;
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return;
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                sickLeaveAnalysis.byMonth[monthKey] = (sickLeaveAnalysis.byMonth[monthKey] || 0) + 1;
            } catch (error) {
                // تجاهل الأخطاء في معالجة التاريخ
            }

            const status = leave.status || 'قيد المعالجة';
            sickLeaveAnalysis.byStatus[status] = (sickLeaveAnalysis.byStatus[status] || 0) + 1;

            const personType = leave.personType === 'contractor' ? 'مقاول' : 'موظف';
            sickLeaveAnalysis.byPersonType[personType] = (sickLeaveAnalysis.byPersonType[personType] || 0) + 1;

            const dept = leave.employeeDepartment || leave.department || 'غير محدد';
            sickLeaveAnalysis.byDepartment[dept] = (sickLeaveAnalysis.byDepartment[dept] || 0) + 1;

            if (leave.startDate && leave.endDate) {
                const start = new Date(leave.startDate);
                const end = new Date(leave.endDate);
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                sickLeaveAnalysis.totalDays += days;
            }
        });

        sickLeaveAnalysis.averageDays = sickLeaveAnalysis.total > 0
            ? (sickLeaveAnalysis.totalDays / sickLeaveAnalysis.total).toFixed(1)
            : 0;

        // تحليل الإصابات
        const injuryAnalysis = {
            total: injuries.length,
            byMonth: {},
            byType: {},
            byLocation: {},
            byPersonType: { موظف: 0, مقاول: 0 },
            byDepartment: {},
            byStatus: {}
        };

        injuries.forEach(injury => {
            try {
                const dateStr = injury.injuryDate || injury.createdAt;
                if (!dateStr) return;
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return;
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                injuryAnalysis.byMonth[monthKey] = (injuryAnalysis.byMonth[monthKey] || 0) + 1;
            } catch (error) {
                // تجاهل الأخطاء في معالجة التاريخ
            }

            const type = injury.injuryType || 'غير محدد';
            injuryAnalysis.byType[type] = (injuryAnalysis.byType[type] || 0) + 1;

            const loc = injury.injuryLocation || 'غير محدد';
            injuryAnalysis.byLocation[loc] = (injuryAnalysis.byLocation[loc] || 0) + 1;

            const personType = injury.personType === 'contractor' ? 'مقاول' : 'موظف';
            injuryAnalysis.byPersonType[personType] = (injuryAnalysis.byPersonType[personType] || 0) + 1;

            const dept = injury.employeeDepartment || injury.department || 'غير محدد';
            injuryAnalysis.byDepartment[dept] = (injuryAnalysis.byDepartment[dept] || 0) + 1;

            const status = injury.status || 'قيد المتابعة';
            injuryAnalysis.byStatus[status] = (injuryAnalysis.byStatus[status] || 0) + 1;
        });

        // تحليل طلبات الاحتياجات
        const supplyRequestAnalysis = {
            total: supplyRequests.length,
            byStatus: {},
            byType: {},
            byPriority: {},
            byMonth: {},
            pending: 0,
            approved: 0,
            rejected: 0,
            fulfilled: 0
        };

        supplyRequests.forEach(req => {
            try {
                const status = req.status || 'pending';
                supplyRequestAnalysis.byStatus[status] = (supplyRequestAnalysis.byStatus[status] || 0) + 1;

                if (status === 'pending') supplyRequestAnalysis.pending++;
                if (status === 'approved') supplyRequestAnalysis.approved++;
                if (status === 'rejected') supplyRequestAnalysis.rejected++;
                if (status === 'fulfilled') supplyRequestAnalysis.fulfilled++;

                const type = req.type || 'غير محدد';
                supplyRequestAnalysis.byType[type] = (supplyRequestAnalysis.byType[type] || 0) + 1;

                const priority = req.priority || 'normal';
                supplyRequestAnalysis.byPriority[priority] = (supplyRequestAnalysis.byPriority[priority] || 0) + 1;

                const dateStr = req.createdAt || req.requestDate;
                if (dateStr) {
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        supplyRequestAnalysis.byMonth[monthKey] = (supplyRequestAnalysis.byMonth[monthKey] || 0) + 1;
                    }
                }
            } catch (error) {
                // تجاهل الأخطاء في معالجة الطلبات
            }
        });

        return {
            medications: medicationAnalysis,
            visits: visitAnalysis,
            sickLeaves: sickLeaveAnalysis,
            injuries: injuryAnalysis,
            supplyRequests: supplyRequestAnalysis,
            summary: {
                totalRecords: visits.length + sickLeaves.length + injuries.length,
                totalMedications: medications.length,
                totalSupplyRequests: supplyRequests.length,
                totalVisits: visits.length,
                totalSickLeaves: sickLeaves.length,
                totalInjuries: injuries.length
            }
        };
    },

    /**
     * عرض تبويب تحليل البيانات الشامل
     */
    renderDataAnalysisTab() {
        const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="data-analysis"]');
        if (!panel) return;

        const analysis = this.analyzeAllClinicData();

        // دالة مساعدة لإنشاء رسم بياني
        const createChartContainer = (id, type = 'bar') => {
            return `
                <div id="${id}-container" class="mt-4" style="position: relative; height: 300px;">
                    <canvas id="${id}"></canvas>
                </div>
            `;
        };

        // دالة مساعدة لإنشاء جدول تحليل مع رسم بياني
        const createAnalysisTable = (title, data, columns, iconClass = 'fas fa-table', chartId = null, chartType = 'bar') => {
            if (!data || Object.keys(data).length === 0) {
                return `
                    <div class="content-card mb-4">
                        <div class="card-header">
                            <h3 class="card-title"><i class="${iconClass} ml-2"></i>${title}</h3>
                        </div>
                        <div class="card-body">
                            <p class="text-gray-500 text-center py-4">لا توجد بيانات متاحة</p>
                        </div>
                    </div>
                `;
            }

            const rows = Object.entries(data)
                .sort((a, b) => b[1] - a[1])
                .map(([key, value]) => `
                    <tr>
                        <td class="font-semibold">${Utils.escapeHTML(key)}</td>
                        <td class="text-center font-bold text-blue-600">${value}</td>
                    </tr>
                `).join('');

            return `
                <div class="content-card mb-4">
                    <div class="card-header">
                        <h3 class="card-title"><i class="${iconClass} ml-2"></i>${title}</h3>
                    </div>
                    <div class="card-body">
                        <div class="table-wrapper" style="overflow-x: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        ${columns.map(col => `<th>${col}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                        ${chartId ? createChartContainer(chartId, chartType) : ''}
                    </div>
                </div>
            `;
        };

        panel.innerHTML = `
            <div class="space-y-6">
                <!-- تحليل قابل للتخصيص (مثل الملاحظات اليومية) -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-chart-line ml-2"></i>
                            تحليل البيانات (قابل للتخصيص)
                        </h2>
                        <p class="text-sm text-gray-500 mt-2">كروت ورسوم قابلة للإضافة والتعديل والتحكم الكامل داخل موديول العيادة (مدير النظام فقط)</p>
                    </div>
                    <div class="card-body">
                        <div id="clinic-data-analysis-container">
                            <!-- الكروت التوضيحية -->
                            <div class="mb-6">
                                <div class="flex items-center justify-between mb-4">
                                    <h3 class="text-lg font-semibold">
                                        <i class="fas fa-info-circle ml-2 text-blue-600"></i>
                                        الكروت التوضيحية
                                    </h3>
                                    <button id="clinic-manage-cards-btn" class="btn-secondary">
                                        <i class="fas fa-edit ml-2"></i>
                                        إدارة الكروت
                                    </button>
                                </div>
                                <div id="clinic-info-cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                    <!-- filled dynamically -->
                                </div>
                            </div>

                            <!-- إعدادات التحليل -->
                            <div class="mb-6 border-t pt-6">
                                <h3 class="text-lg font-semibold mb-4">
                                    <i class="fas fa-cog ml-2"></i>
                                    إعدادات التحليل
                                </h3>
                                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                        <span id="clinic-analysis-items-list-label" class="block text-sm font-medium mb-2">اختر البنود للتحليل</span>
                                        <div id="clinic-analysis-items-list" class="space-y-2 max-h-64 overflow-y-auto border rounded p-3" role="group" aria-labelledby="clinic-analysis-items-list-label">
                                            <!-- filled dynamically -->
                                        </div>
                                    </div>
                                    <div>
                                        <span id="clinic-analysis-items-heading" class="block text-sm font-medium mb-2">إضافة بند جديد</span>
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <label for="clinic-new-analysis-dataset" class="sr-only">المجموعة</label>
                                            <select id="clinic-new-analysis-dataset" class="form-input">
                                                <option value="visits">زيارات</option>
                                                <option value="medications">أدوية</option>
                                                <option value="sickLeave">إجازات مرضية</option>
                                                <option value="injuries">إصابات</option>
                                                <option value="supplyRequests">طلبات احتياجات</option>
                                            </select>
                                            <label for="clinic-new-analysis-field" class="sr-only">الحقل</label>
                                            <select id="clinic-new-analysis-field" class="form-input">
                                                <!-- filled dynamically -->
                                            </select>
                                            <div id="clinic-custom-field-wrap" class="md:col-span-2" style="display:none;">
                                                <label for="clinic-new-analysis-custom-field" class="sr-only">الحقل المخصص</label>
                                                <input type="text" id="clinic-new-analysis-custom-field" class="form-input" placeholder="اسم الحقل (مثال: status / reason)">
                                            </div>
                                            <label for="clinic-new-analysis-label" class="sr-only">اسم البند</label>
                                            <input type="text" id="clinic-new-analysis-label" class="form-input md:col-span-2" placeholder="اسم البند (مثال: زيارات حسب السبب)">
                                            <label for="clinic-new-analysis-charttype" class="sr-only">نوع الرسم</label>
                                            <select id="clinic-new-analysis-charttype" class="form-input">
                                                <option value="auto">تلقائي</option>
                                                <option value="bar">Bar</option>
                                                <option value="doughnut">Doughnut</option>
                                                <option value="pie">Pie</option>
                                                <option value="line">Line</option>
                                            </select>
                                            <button id="clinic-add-analysis-item-btn" class="btn-primary">
                                                <i class="fas fa-plus ml-2"></i>
                                                إضافة
                                            </button>
                                        </div>
                                        <p class="text-xs text-gray-500 mt-2">
                                            <i class="fas fa-info-circle ml-1"></i>
                                            اختر المجموعة والحقل، أو استخدم "حقل مخصص" لتحليل أي بيانات موجودة داخل سجلات العيادة.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <!-- النتائج -->
                            <div id="clinic-analysis-results" class="mt-6 border-t pt-6">
                                <h3 class="text-lg font-semibold mb-4">
                                    <i class="fas fa-chart-bar ml-2"></i>
                                    نتائج التحليل والرسوم البيانية
                                </h3>
                                <div class="empty-state">
                                    <p class="text-gray-500">قم بتفعيل/إضافة بنود للتحليل لعرض النتائج.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ملخص عام -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-chart-pie ml-2"></i>
                            ملخص عام للبيانات
                        </h2>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <div class="text-center p-4 bg-blue-50 rounded-lg">
                                <div class="text-3xl font-bold text-blue-600">${analysis.summary.totalRecords}</div>
                                <div class="text-sm text-gray-600 mt-1">إجمالي السجلات</div>
                            </div>
                            <div class="text-center p-4 bg-green-50 rounded-lg">
                                <div class="text-3xl font-bold text-green-600">${analysis.summary.totalVisits}</div>
                                <div class="text-sm text-gray-600 mt-1">زيارات العيادة</div>
                            </div>
                            <div class="text-center p-4 bg-yellow-50 rounded-lg">
                                <div class="text-3xl font-bold text-yellow-600">${analysis.summary.totalSickLeaves}</div>
                                <div class="text-sm text-gray-600 mt-1">إجازات مرضية</div>
                            </div>
                            <div class="text-center p-4 bg-red-50 rounded-lg">
                                <div class="text-3xl font-bold text-red-600">${analysis.summary.totalInjuries}</div>
                                <div class="text-sm text-gray-600 mt-1">إصابات</div>
                            </div>
                            <div class="text-center p-4 bg-purple-50 rounded-lg">
                                <div class="text-3xl font-bold text-purple-600">${analysis.summary.totalMedications}</div>
                                <div class="text-sm text-gray-600 mt-1">الأدوية</div>
                            </div>
                            <div class="text-center p-4 bg-teal-50 rounded-lg">
                                <div class="text-3xl font-bold text-teal-600">${analysis.summary.totalSupplyRequests}</div>
                                <div class="text-sm text-gray-600 mt-1">طلبات الاحتياجات</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- أزرار التصدير -->
                <div class="flex justify-end gap-2 mb-4">
                    <button type="button" class="btn-secondary" id="data-analysis-export-pdf-btn">
                        <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                    </button>
                    <button type="button" class="btn-success" id="data-analysis-export-excel-btn">
                        <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                    </button>
                </div>

                <!-- تحليل الأدوية -->
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title">
                                <i class="fas fa-pills ml-2"></i>
                                تحليل الأدوية والمخزون
                            </h2>
                            <div class="flex gap-2">
                                <button type="button" class="btn-primary btn-sm" id="analysis-add-medication-btn">
                                    <i class="fas fa-plus ml-2"></i>إضافة دواء
                                </button>
                                <button type="button" class="btn-secondary btn-sm" onclick="Clinic.state.activeTab='medications'; Clinic.renderTabNavigation(); Clinic.renderActiveTabContent();">
                                    <i class="fas fa-edit ml-2"></i>إدارة الأدوية
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div class="text-center p-4 bg-gray-50 rounded-lg">
                                <div class="text-2xl font-bold text-gray-700">${analysis.medications.total}</div>
                                <div class="text-sm text-gray-600 mt-1">إجمالي الأدوية</div>
                            </div>
                            <div class="text-center p-4 bg-red-50 rounded-lg">
                                <div class="text-2xl font-bold text-red-600">${analysis.medications.expired}</div>
                                <div class="text-sm text-gray-600 mt-1">منتهية الصلاحية</div>
                            </div>
                            <div class="text-center p-4 bg-yellow-50 rounded-lg">
                                <div class="text-2xl font-bold text-yellow-600">${analysis.medications.expiringSoon}</div>
                                <div class="text-sm text-gray-600 mt-1">قريبة الانتهاء</div>
                            </div>
                            <div class="text-center p-4 bg-green-50 rounded-lg">
                                <div class="text-2xl font-bold text-green-600">${analysis.medications.totalQuantity}</div>
                                <div class="text-sm text-gray-600 mt-1">الكمية المتاحة</div>
                            </div>
                        </div>
                        ${createAnalysisTable('حسب الحالة', analysis.medications.byStatus, ['الحالة', 'العدد'], 'fas fa-info-circle', 'medications-status-chart', 'pie')}
                        ${createAnalysisTable('حسب النوع', analysis.medications.byType, ['النوع', 'العدد'], 'fas fa-tags', 'medications-type-chart', 'bar')}
                        ${createAnalysisTable('حسب الموقع', analysis.medications.byLocation, ['الموقع', 'العدد'], 'fas fa-map-marker-alt', 'medications-location-chart', 'bar')}
                    </div>
                </div>

                <!-- تحليل الزيارات -->
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title">
                                <i class="fas fa-hospital-user ml-2"></i>
                                تحليل زيارات العيادة
                            </h2>
                            <div class="flex gap-2">
                                <button type="button" class="btn-primary btn-sm" onclick="Clinic.state.activeTab='visits'; Clinic.renderTabNavigation(); Clinic.renderActiveTabContent();">
                                    <i class="fas fa-plus ml-2"></i>إضافة زيارة
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div class="text-center p-4 bg-blue-50 rounded-lg">
                                <div class="text-2xl font-bold text-blue-600">${analysis.visits.total}</div>
                                <div class="text-sm text-gray-600 mt-1">إجمالي الزيارات</div>
                            </div>
                            <div class="text-center p-4 bg-green-50 rounded-lg">
                                <div class="text-2xl font-bold text-green-600">${analysis.visits.byPersonType.موظف}</div>
                                <div class="text-sm text-gray-600 mt-1">موظفين</div>
                            </div>
                            <div class="text-center p-4 bg-purple-50 rounded-lg">
                                <div class="text-2xl font-bold text-purple-600">${analysis.visits.averagePerMonth}</div>
                                <div class="text-sm text-gray-600 mt-1">متوسط شهري</div>
                            </div>
                        </div>
                        ${createAnalysisTable('حسب الشهر', analysis.visits.byMonth, ['الشهر', 'عدد الزيارات'], 'fas fa-calendar-alt', 'visits-month-chart', 'line')}
                        ${createAnalysisTable('حسب السبب', analysis.visits.byReason, ['السبب', 'العدد'], 'fas fa-stethoscope', 'visits-reason-chart', 'bar')}
                        ${createAnalysisTable('حسب الإدارة', analysis.visits.byDepartment, ['الإدارة', 'العدد'], 'fas fa-building', 'visits-department-chart', 'bar')}
                        ${createAnalysisTable('حسب الموقع', analysis.visits.byLocation, ['الموقع', 'العدد'], 'fas fa-map-marker-alt', 'visits-location-chart', 'bar')}
                    </div>
                </div>

                <!-- تحليل الإجازات المرضية -->
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title">
                                <i class="fas fa-notes-medical ml-2"></i>
                                تحليل الإجازات المرضية
                            </h2>
                            <div class="flex gap-2">
                                <button type="button" class="btn-primary btn-sm" id="analysis-add-sickleave-btn">
                                    <i class="fas fa-plus ml-2"></i>إضافة إجازة
                                </button>
                                <button type="button" class="btn-secondary btn-sm" onclick="Clinic.state.activeTab='sickLeave'; Clinic.renderTabNavigation(); Clinic.renderActiveTabContent();">
                                    <i class="fas fa-edit ml-2"></i>إدارة الإجازات
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div class="text-center p-4 bg-yellow-50 rounded-lg">
                                <div class="text-2xl font-bold text-yellow-600">${analysis.sickLeaves.total}</div>
                                <div class="text-sm text-gray-600 mt-1">إجمالي الإجازات</div>
                            </div>
                            <div class="text-center p-4 bg-blue-50 rounded-lg">
                                <div class="text-2xl font-bold text-blue-600">${analysis.sickLeaves.totalDays}</div>
                                <div class="text-sm text-gray-600 mt-1">إجمالي الأيام</div>
                            </div>
                            <div class="text-center p-4 bg-green-50 rounded-lg">
                                <div class="text-2xl font-bold text-green-600">${analysis.sickLeaves.averageDays}</div>
                                <div class="text-sm text-gray-600 mt-1">متوسط الأيام</div>
                            </div>
                        </div>
                        ${createAnalysisTable('حسب الشهر', analysis.sickLeaves.byMonth, ['الشهر', 'العدد'], 'fas fa-calendar-alt', 'sickleave-month-chart', 'line')}
                        ${createAnalysisTable('حسب الحالة', analysis.sickLeaves.byStatus, ['الحالة', 'العدد'], 'fas fa-info-circle', 'sickleave-status-chart', 'pie')}
                        ${createAnalysisTable('حسب الإدارة', analysis.sickLeaves.byDepartment, ['الإدارة', 'العدد'], 'fas fa-building', 'sickleave-department-chart', 'bar')}
                    </div>
                </div>

                <!-- تحليل الإصابات -->
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title">
                                <i class="fas fa-user-injured ml-2"></i>
                                تحليل الإصابات الطبية
                            </h2>
                            <div class="flex gap-2">
                                <button type="button" class="btn-primary btn-sm" id="analysis-add-injury-btn">
                                    <i class="fas fa-plus ml-2"></i>إضافة إصابة
                                </button>
                                <button type="button" class="btn-secondary btn-sm" onclick="Clinic.state.activeTab='injuries'; Clinic.renderTabNavigation(); Clinic.renderActiveTabContent();">
                                    <i class="fas fa-edit ml-2"></i>إدارة الإصابات
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body space-y-4">
                        <div class="text-center p-4 bg-red-50 rounded-lg mb-4">
                            <div class="text-3xl font-bold text-red-600">${analysis.injuries.total}</div>
                            <div class="text-sm text-gray-600 mt-1">إجمالي الإصابات</div>
                        </div>
                        ${createAnalysisTable('حسب الشهر', analysis.injuries.byMonth, ['الشهر', 'العدد'], 'fas fa-calendar-alt', 'injuries-month-chart', 'line')}
                        ${createAnalysisTable('حسب النوع', analysis.injuries.byType, ['نوع الإصابة', 'العدد'], 'fas fa-exclamation-triangle', 'injuries-type-chart', 'bar')}
                        ${createAnalysisTable('حسب الموقع', analysis.injuries.byLocation, ['موقع الإصابة', 'العدد'], 'fas fa-map-marker-alt', 'injuries-location-chart', 'bar')}
                        ${createAnalysisTable('حسب الإدارة', analysis.injuries.byDepartment, ['الإدارة', 'العدد'], 'fas fa-building', 'injuries-department-chart', 'bar')}
                        ${createAnalysisTable('حسب الحالة', analysis.injuries.byStatus, ['الحالة', 'العدد'], 'fas fa-info-circle', 'injuries-status-chart', 'pie')}
                    </div>
                </div>

                <!-- تحليل طلبات الاحتياجات -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-shopping-cart ml-2"></i>
                            تحليل طلبات الاحتياجات
                        </h2>
                    </div>
                    <div class="card-body space-y-4">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div class="text-center p-4 bg-gray-50 rounded-lg">
                                <div class="text-2xl font-bold text-gray-700">${analysis.supplyRequests.total}</div>
                                <div class="text-sm text-gray-600 mt-1">إجمالي الطلبات</div>
                            </div>
                            <div class="text-center p-4 bg-yellow-50 rounded-lg">
                                <div class="text-2xl font-bold text-yellow-600">${analysis.supplyRequests.pending}</div>
                                <div class="text-sm text-gray-600 mt-1">قيد الانتظار</div>
                            </div>
                            <div class="text-center p-4 bg-green-50 rounded-lg">
                                <div class="text-2xl font-bold text-green-600">${analysis.supplyRequests.approved}</div>
                                <div class="text-sm text-gray-600 mt-1">موافق عليها</div>
                            </div>
                            <div class="text-center p-4 bg-red-50 rounded-lg">
                                <div class="text-2xl font-bold text-red-600">${analysis.supplyRequests.rejected}</div>
                                <div class="text-sm text-gray-600 mt-1">مرفوضة</div>
                            </div>
                        </div>
                        ${createAnalysisTable('حسب الحالة', analysis.supplyRequests.byStatus, ['الحالة', 'العدد'], 'fas fa-info-circle', 'supply-status-chart', 'pie')}
                        ${createAnalysisTable('حسب النوع', analysis.supplyRequests.byType, ['النوع', 'العدد'], 'fas fa-tags', 'supply-type-chart', 'bar')}
                        ${createAnalysisTable('حسب الأولوية', analysis.supplyRequests.byPriority, ['الأولوية', 'العدد'], 'fas fa-exclamation-circle', 'supply-priority-chart', 'bar')}
                        ${createAnalysisTable('حسب الشهر', analysis.supplyRequests.byMonth, ['الشهر', 'العدد'], 'fas fa-calendar-alt', 'supply-month-chart', 'line')}
                    </div>
                </div>
            </div>
        `;
        this.applyModuleI18n(panel);

        this.bindDataAnalysisTabEvents(panel);
    },

    /**
     * ربط أحداث تبويب تحليل البيانات
     */
    bindDataAnalysisTabEvents(panel) {
        const exportPdfBtn = panel.querySelector('#data-analysis-export-pdf-btn');
        const exportExcelBtn = panel.querySelector('#data-analysis-export-excel-btn');
        const addMedicationBtn = panel.querySelector('#analysis-add-medication-btn');
        const addSickLeaveBtn = panel.querySelector('#analysis-add-sickleave-btn');
        const addInjuryBtn = panel.querySelector('#analysis-add-injury-btn');

        exportPdfBtn?.addEventListener('click', () => this.exportDataAnalysisToPDF());
        exportExcelBtn?.addEventListener('click', () => this.exportDataAnalysisToExcel());

        addMedicationBtn?.addEventListener('click', () => {
            this.showMedicationForm();
        });

        addSickLeaveBtn?.addEventListener('click', () => {
            this.showSickLeaveForm();
        });

        addInjuryBtn?.addEventListener('click', () => {
            this.showInjuryForm();
        });

        // رسم الرسوم البيانية + تحميل محرك التحليل القابل للتخصيص
        setTimeout(async () => {
            // محاولة تحميل Chart.js لتحسين الرسوم
            await this.ensureChartJSLoaded().catch(() => false);
            this.renderDataAnalysisCharts();
            this.loadClinicDataAnalysis();
        }, 500);
    },

    /**
     * رسم الرسوم البيانية للتحليل
     */
    renderDataAnalysisCharts() {
        const analysis = this.analyzeAllClinicData();

        // استخدام Chart.js إذا كان متاحاً، وإلا استخدام CSS charts
        if (typeof Chart !== 'undefined') {
            this.renderChartsWithChartJS(analysis);
        } else {
            this.renderChartsWithCSS(analysis);
        }
    },

    /**
     * رسم الرسوم البيانية باستخدام Chart.js
     */
    renderChartsWithChartJS(analysis) {
        // رسم بياني للأدوية حسب الحالة
        const medStatusCtx = document.getElementById('medications-status-chart');
        if (medStatusCtx && Object.keys(analysis.medications.byStatus).length > 0) {
            const data = Object.entries(analysis.medications.byStatus);
            new Chart(medStatusCtx, {
                type: 'pie',
                data: {
                    labels: data.map(([key]) => key),
                    datasets: [{
                        data: data.map(([, value]) => value),
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', rtl: true }
                    }
                }
            });
        }

        // رسم بياني للزيارات حسب الشهر
        const visitsMonthCtx = document.getElementById('visits-month-chart');
        if (visitsMonthCtx && Object.keys(analysis.visits.byMonth).length > 0) {
            const data = Object.entries(analysis.visits.byMonth).sort();
            new Chart(visitsMonthCtx, {
                type: 'line',
                data: {
                    labels: data.map(([key]) => key),
                    datasets: [{
                        label: 'عدد الزيارات',
                        data: data.map(([, value]) => value),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

        // رسم بياني للإصابات حسب النوع
        const injuriesTypeCtx = document.getElementById('injuries-type-chart');
        if (injuriesTypeCtx && Object.keys(analysis.injuries.byType).length > 0) {
            const data = Object.entries(analysis.injuries.byType).sort((a, b) => b[1] - a[1]).slice(0, 10);
            new Chart(injuriesTypeCtx, {
                type: 'bar',
                data: {
                    labels: data.map(([key]) => key),
                    datasets: [{
                        label: 'عدد الإصابات',
                        data: data.map(([, value]) => value),
                        backgroundColor: '#ef4444'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
    },

    /**
     * رسم الرسوم البيانية باستخدام CSS (Fallback)
     */
    renderChartsWithCSS(analysis) {
        // رسم بياني للأدوية حسب الحالة
        const medStatusContainer = document.getElementById('medications-status-chart-container');
        if (medStatusContainer && Object.keys(analysis.medications.byStatus).length > 0) {
            const data = Object.entries(analysis.medications.byStatus);
            const maxValue = Math.max(...data.map(([, v]) => v), 1);
            medStatusContainer.innerHTML = `
                <div class="space-y-2 mt-4">
                    ${data.map(([key, value]) => `
                        <div class="flex items-center gap-2">
                            <span class="text-sm text-gray-700 w-32">${Utils.escapeHTML(key)}</span>
                            <div class="flex-1 bg-gray-200 rounded h-6 relative">
                                <div class="bg-blue-500 h-6 rounded flex items-center justify-end pr-2" style="width: ${(value / maxValue) * 100}%">
                                    <span class="text-xs font-semibold text-white">${value}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // رسم بياني للزيارات حسب الشهر
        const visitsMonthContainer = document.getElementById('visits-month-chart-container');
        if (visitsMonthContainer && Object.keys(analysis.visits.byMonth).length > 0) {
            const data = Object.entries(analysis.visits.byMonth).sort();
            const maxValue = Math.max(...data.map(([, v]) => v), 1);
            visitsMonthContainer.innerHTML = `
                <div class="space-y-2 mt-4">
                    ${data.map(([key, value]) => `
                        <div class="flex items-center gap-2">
                            <span class="text-sm text-gray-700 w-24">${Utils.escapeHTML(key)}</span>
                            <div class="flex-1 bg-gray-200 rounded h-6 relative">
                                <div class="bg-green-500 h-6 rounded flex items-center justify-end pr-2" style="width: ${(value / maxValue) * 100}%">
                                    <span class="text-xs font-semibold text-white">${value}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // رسم بياني للإصابات حسب النوع
        const injuriesTypeContainer = document.getElementById('injuries-type-chart-container');
        if (injuriesTypeContainer && Object.keys(analysis.injuries.byType).length > 0) {
            const data = Object.entries(analysis.injuries.byType).sort((a, b) => b[1] - a[1]).slice(0, 10);
            const maxValue = Math.max(...data.map(([, v]) => v), 1);
            injuriesTypeContainer.innerHTML = `
                <div class="space-y-2 mt-4">
                    ${data.map(([key, value]) => `
                        <div class="flex items-center gap-2">
                            <span class="text-sm text-gray-700 w-32">${Utils.escapeHTML(key)}</span>
                            <div class="flex-1 bg-gray-200 rounded h-6 relative">
                                <div class="bg-red-500 h-6 rounded flex items-center justify-end pr-2" style="width: ${(value / maxValue) * 100}%">
                                    <span class="text-xs font-semibold text-white">${value}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // رسم باقي الرسوم البيانية الأخرى
        this.renderAllCSSCharts(analysis);
    },

    /**
     * رسم جميع الرسوم البيانية المتبقية باستخدام CSS
     */
    renderAllCSSCharts(analysis) {
        const charts = [
            { id: 'medications-type-chart', data: analysis.medications.byType, color: '#8b5cf6' },
            { id: 'medications-location-chart', data: analysis.medications.byLocation, color: '#3b82f6' },
            { id: 'visits-reason-chart', data: analysis.visits.byReason, color: '#10b981' },
            { id: 'visits-department-chart', data: analysis.visits.byDepartment, color: '#3b82f6' },
            { id: 'visits-location-chart', data: analysis.visits.byLocation, color: '#06b6d4' },
            { id: 'sickleave-month-chart', data: analysis.sickLeaves.byMonth, color: '#f59e0b' },
            { id: 'sickleave-status-chart', data: analysis.sickLeaves.byStatus, color: '#f59e0b' },
            { id: 'sickleave-department-chart', data: analysis.sickLeaves.byDepartment, color: '#f59e0b' },
            { id: 'injuries-month-chart', data: analysis.injuries.byMonth, color: '#ef4444' },
            { id: 'injuries-location-chart', data: analysis.injuries.byLocation, color: '#ef4444' },
            { id: 'injuries-department-chart', data: analysis.injuries.byDepartment, color: '#ef4444' },
            { id: 'injuries-status-chart', data: analysis.injuries.byStatus, color: '#ef4444' },
            { id: 'supply-status-chart', data: analysis.supplyRequests.byStatus, color: '#06b6d4' },
            { id: 'supply-type-chart', data: analysis.supplyRequests.byType, color: '#06b6d4' },
            { id: 'supply-priority-chart', data: analysis.supplyRequests.byPriority, color: '#06b6d4' },
            { id: 'supply-month-chart', data: analysis.supplyRequests.byMonth, color: '#06b6d4' }
        ];

        charts.forEach(({ id, data, color }) => {
            const container = document.getElementById(`${id}-container`);
            if (container && data && Object.keys(data).length > 0) {
                const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
                const maxValue = Math.max(...entries.map(([, v]) => v), 1);
                container.innerHTML = `
                    <div class="space-y-2 mt-4">
                        ${entries.slice(0, 10).map(([key, value]) => `
                            <div class="flex items-center gap-2">
                                <span class="text-sm text-gray-700 w-32 truncate">${Utils.escapeHTML(key)}</span>
                                <div class="flex-1 bg-gray-200 rounded h-6 relative">
                                    <div class="${color === '#8b5cf6' ? 'bg-purple' : color === '#10b981' ? 'bg-green' : color === '#f59e0b' ? 'bg-yellow' : color === '#ef4444' ? 'bg-red' : 'bg-blue'}-500 h-6 rounded flex items-center justify-end pr-2" style="width: ${(value / maxValue) * 100}%">
                                        <span class="text-xs font-semibold text-white">${value}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        });
    },

    /**
     * تحديث تبويب التحليل بعد إضافة/تعديل بيانات
     */
    refreshDataAnalysisTab() {
        if (this.state.activeTab === 'data-analysis') {
            this.renderDataAnalysisTab();
        }
    },

    /**
     * تصدير تحليل البيانات إلى Excel
     */
    exportDataAnalysisToExcel() {
        if (typeof XLSX === 'undefined') {
            Notification?.error?.('مكتبة Excel غير متوفرة');
            return;
        }

        const analysis = this.analyzeAllClinicData();
        const workbook = XLSX.utils.book_new();

        // ملخص عام
        const summaryData = [
            ['نوع البيانات', 'العدد'],
            ['إجمالي السجلات', analysis.summary.totalRecords],
            ['زيارات العيادة', analysis.summary.totalVisits],
            ['إجازات مرضية', analysis.summary.totalSickLeaves],
            ['إصابات', analysis.summary.totalInjuries],
            ['الأدوية', analysis.summary.totalMedications],
            ['طلبات الاحتياجات', analysis.summary.totalSupplyRequests]
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'ملخص عام');

        // دالة مساعدة لإنشاء ورقة
        const createSheet = (data, title) => {
            const sheetData = [[title, 'العدد']];
            Object.entries(data)
                .sort((a, b) => b[1] - a[1])
                .forEach(([key, value]) => {
                    sheetData.push([key, value]);
                });
            return XLSX.utils.aoa_to_sheet(sheetData);
        };

        // إضافة الأوراق
        if (Object.keys(analysis.medications.byStatus).length > 0) {
            XLSX.utils.book_append_sheet(workbook, createSheet(analysis.medications.byStatus, 'الأدوية - حسب الحالة'), 'أدوية-حالة');
        }
        if (Object.keys(analysis.medications.byType).length > 0) {
            XLSX.utils.book_append_sheet(workbook, createSheet(analysis.medications.byType, 'الأدوية - حسب النوع'), 'أدوية-نوع');
        }
        if (Object.keys(analysis.visits.byMonth).length > 0) {
            XLSX.utils.book_append_sheet(workbook, createSheet(analysis.visits.byMonth, 'الزيارات - حسب الشهر'), 'زيارات-شهر');
        }
        if (Object.keys(analysis.visits.byDepartment).length > 0) {
            XLSX.utils.book_append_sheet(workbook, createSheet(analysis.visits.byDepartment, 'الزيارات - حسب الإدارة'), 'زيارات-إدارة');
        }
        if (Object.keys(analysis.sickLeaves.byMonth).length > 0) {
            XLSX.utils.book_append_sheet(workbook, createSheet(analysis.sickLeaves.byMonth, 'الإجازات - حسب الشهر'), 'إجازات-شهر');
        }
        if (Object.keys(analysis.injuries.byType).length > 0) {
            XLSX.utils.book_append_sheet(workbook, createSheet(analysis.injuries.byType, 'الإصابات - حسب النوع'), 'إصابات-نوع');
        }
        if (Object.keys(analysis.supplyRequests.byStatus).length > 0) {
            XLSX.utils.book_append_sheet(workbook, createSheet(analysis.supplyRequests.byStatus, 'الطلبات - حسب الحالة'), 'طلبات-حالة');
        }

        const fileName = `Clinic_Data_Analysis_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        Notification?.success?.('تم تصدير تحليل البيانات بنجاح');
    },

    /**
     * تصدير تحليل البيانات إلى PDF
     */
    exportDataAnalysisToPDF() {
        const analysis = this.analyzeAllClinicData();

        // دالة مساعدة لإنشاء جدول HTML
        const createTable = (title, data) => {
            if (!data || Object.keys(data).length === 0) return '';

            const rows = Object.entries(data)
                .sort((a, b) => b[1] - a[1])
                .map(([key, value]) => `
                    <tr>
                        <td>${Utils.escapeHTML(key)}</td>
                        <td class="text-center">${value}</td>
                    </tr>
                `).join('');

            return `
                <div class="section-title">${title}</div>
                <table>
                    <thead>
                        <tr>
                            <th>${title}</th>
                            <th class="text-center">العدد</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;
        };

        const content = `
            <div class="section-title">ملخص عام</div>
            <table>
                <tbody>
                    <tr><th>إجمالي السجلات</th><td>${analysis.summary.totalRecords}</td></tr>
                    <tr><th>زيارات العيادة</th><td>${analysis.summary.totalVisits}</td></tr>
                    <tr><th>إجازات مرضية</th><td>${analysis.summary.totalSickLeaves}</td></tr>
                    <tr><th>إصابات</th><td>${analysis.summary.totalInjuries}</td></tr>
                    <tr><th>الأدوية</th><td>${analysis.summary.totalMedications}</td></tr>
                    <tr><th>طلبات الاحتياجات</th><td>${analysis.summary.totalSupplyRequests}</td></tr>
                </tbody>
            </table>
            
            <div class="section-title">تحليل الأدوية</div>
            ${createTable('حسب الحالة', analysis.medications.byStatus)}
            ${createTable('حسب النوع', analysis.medications.byType)}
            
            <div class="section-title">تحليل الزيارات</div>
            ${createTable('حسب الشهر', analysis.visits.byMonth)}
            ${createTable('حسب الإدارة', analysis.visits.byDepartment)}
            
            <div class="section-title">تحليل الإجازات المرضية</div>
            ${createTable('حسب الشهر', analysis.sickLeaves.byMonth)}
            
            <div class="section-title">تحليل الإصابات</div>
            ${createTable('حسب النوع', analysis.injuries.byType)}
            
            <div class="section-title">تحليل طلبات الاحتياجات</div>
            ${createTable('حسب الحالة', analysis.supplyRequests.byStatus)}
        `;

        const formCode = `CLINIC-DATA-ANALYSIS-${new Date().toISOString().slice(0, 10)}`;
        const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
            ? FormHeader.generatePDFHTML(formCode, 'تحليل شامل لبيانات العيادة الطبية', content, false, true)
            : `<html><body>${content}</body></html>`;

        try {
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }, 400);
                };
                Notification?.success?.('جاري تحضير ملف PDF للطباعة...');
            } else {
                Notification?.error?.('يرجى السماح للنوافذ المنبثقة لتصدير PDF');
            }
        } catch (error) {
            Utils.safeError('فشل تصدير تحليل البيانات:', error);
            Notification?.error?.('تعذر تصدير التحليل');
        }
    },

    scheduleVisitsTabRender(forceReload = false, delayMs = 0) {
        if (this._visitsRenderTimer) {
            clearTimeout(this._visitsRenderTimer);
            this._visitsRenderTimer = null;
        }
        const doRender = () => {
            this._visitsRenderTimer = null;
            requestAnimationFrame(() => {
                this.renderVisitsTab(forceReload);
            });
        };
        // setTimeout(0) بدل requestIdleCallback لتفادي تأخير يصل إلى ~1.2 ثانية
        this._visitsRenderTimer = setTimeout(doRender, Math.max(0, delayMs));
    },

    async renderVisitsTab(forceReload = false) {
        try {
            const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="visits"]');
            if (!panel) {
                Utils.safeWarn('⚠️ لوحة سجل التردد غير موجودة');
                return;
            }

            this.ensureData();
            this.ensureFilterDefaults(); // ✅ التأكد من تهيئة الفلاتر بشكل صحيح

            // ✅ عرض الواجهة أولاً بالبيانات المتوفرة (مثل الأدوية تماماً)
            // هذا يضمن بقاء الواجهة ثابتة ومرئية أثناء التحميل
            const hasLocalData = AppState.appData.clinicVisits && AppState.appData.clinicVisits.length > 0;
            
            // ✅ التحقق من عمر البيانات المحلية
            const lastSync = localStorage.getItem('clinic_last_sync');
            const cacheAge = lastSync ? (Date.now() - parseInt(lastSync)) : Infinity;
            const CACHE_DURATION = 10 * 60 * 1000; // 10 دقائق
            const isDataStale = cacheAge >= CACHE_DURATION;

            // تحميل مباشر: عرض فوري بما هو متاح محلياً، ثم جلب كامل في الخلفية (طلب واحد — نفس promise إن وُجد)
            const shouldLoadData = forceReload || !hasLocalData || isDataStale || this._visitsBackendFetchOk !== true;

            this.renderVisitsTabContent(panel);

            if (shouldLoadData && typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                this.loadVisitsDataFromBackend()
                    .then(() => {
                        const p = document.querySelector('.clinic-tab-panel[data-tab-panel="visits"]');
                        if (p && this.state && this.state.activeTab === 'visits') {
                            this.ensureData();
                            this.renderVisitsTabContent(p);
                        }
                        if (AppState.debugMode) {
                            Utils.safeLog('✅ تم تحديث سجل التردد بعد المزامنة مع الخادم (بدون حجب الواجهة)');
                        }
                    })
                    .catch((error) => {
                        if (AppState.debugMode) {
                            Utils.safeWarn('⚠️ تعذر تحميل بيانات سجل التردد من الخادم:', error && error.message);
                        }
                    });
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في عرض تبويب سجل التردد:', error);
            const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="visits"]');
            if (panel) {
                panel.innerHTML = `
                    <div class="p-4 text-center">
                        <div class="text-red-600 mb-2">
                            <i class="fas fa-exclamation-triangle"></i>
                            حدث خطأ في عرض سجل التردد
                        </div>
                        <button type="button" class="btn-primary mt-4" onclick="Clinic.renderVisitsTab(true)">
                            <i class="fas fa-redo ml-2"></i>إعادة المحاولة
                        </button>
                    </div>
                `;
            }
        }
    },

    /**
     * دمج زيارات الخادم مع أي زيارات موجودة محلياً ولم تُرجَع بعد في getAllClinicVisits
     * (مثلاً فشل/تأخر addClinicVisit أو سباق قبل كتابة الشيت).
     * يمنع اختفاء الزيارة بعد إعادة تحميل الصفحة.
     */
    mergeClinicVisitsWithLocalOnly(serverVisits, previousLocal) {
        const server = Array.isArray(serverVisits) ? serverVisits : [];
        const local = Array.isArray(previousLocal) ? previousLocal : [];
        const seen = new Set();
        server.forEach((v) => {
            if (v && v.id != null && String(v.id).trim() !== '') {
                seen.add(String(v.id));
            }
        });
        const extras = [];
        local.forEach((v) => {
            if (!v || v.id == null || String(v.id).trim() === '') return;
            const id = String(v.id);
            if (!seen.has(id)) {
                seen.add(id);
                extras.push(v);
            }
        });
        if (extras.length === 0) {
            return server.slice();
        }
        const merged = server.concat(extras);
        merged.sort((a, b) => {
            const dateA = new Date(a.visitDate || a.createdAt || 0).getTime();
            const dateB = new Date(b.visitDate || b.createdAt || 0).getTime();
            return dateB - dateA;
        });
        return merged;
    },

    /**
     * يجب أن يعيد الخادم success: true بعد كتابة الشيت؛ وإلا نعتبر الحفظ فاشلاً (لا نعتمد على ردود ناقصة).
     */
    assertClinicVisitRpcResult(result) {
        if (!result || result.success !== true) {
            throw new Error(
                (result && result.message)
                    ? result.message
                    : 'لم يُؤكد الخادم حفظ الزيارة. تحقق من رابط Web App ونشر Apps Script ومعرف الجدول.'
            );
        }
    },

    /**
     * مواءمة معرف الزيارة مع ما أعادته الخادم (إن وُجد visitId).
     */
    applyClinicVisitIdFromServer(formData, result) {
        if (!formData || !result || !result.visitId) return;
        const vid = String(result.visitId).trim();
        if (!vid || String(formData.id) === vid) return;
        const oldId = formData.id;
        formData.id = vid;
        const list = AppState.appData.clinicVisits;
        if (!Array.isArray(list)) return;
        const idx = list.findIndex((v) => v && v.id === oldId);
        if (idx !== -1) {
            list[idx] = { ...list[idx], id: vid };
        }
    },

    /**
     * ✅ دالة منفصلة لتحميل بيانات الزيارات من Backend
     */
    async loadVisitsDataFromBackend() {
        // ✅ منع التكرار: نفس الطلب لا يبدأ أكثر من مرة
        if (this._clinicVisitsLoadPromise) {
            return this._clinicVisitsLoadPromise;
        }
        const previousLocalVisits = Array.isArray(AppState.appData.clinicVisits)
            ? AppState.appData.clinicVisits.slice()
            : [];
        this._clinicVisitsLoadPromise = (async () => {
            try {
            if (AppState.debugMode) {
                Utils.safeLog('🔄 تحميل بيانات سجل التردد من Backend...');
            }
            
            // تحميل بيانات الزيارات من Backend بشكل فوري
            const result = await Utils.promiseWithTimeout(
                GoogleIntegration.sendRequest({
                    action: 'getAllClinicVisits',
                    data: { __timeoutMs: 120000 }
                }),
                120000,
                'انتهت مهلة تحميل بيانات سجل التردد'
            );

            if (result && result.success && Array.isArray(result.data)) {
                // ✅ تطبيع البيانات للتأكد من وجود جميع الحقول المطلوبة
                const normalizedVisits = result.data.map(visit => {
                    if (!visit || typeof visit !== 'object') return visit;
                    
                    // التأكد من وجود personType
                    if (!visit.personType) {
                        // محاولة تحديد النوع من الحقول المتوفرة
                        if (visit.contractorName || visit.contractorWorkerName || visit.externalName) {
                            visit.personType = 'contractor';
                        } else {
                            visit.personType = 'employee';
                        }
                    }
                    
                    // ✅ التأكد من وجود medications كـ array (التحقق الشامل)
                    let normalizedMeds = [];
                    
                    // أولاً: normalize medications الموجودة (إذا كانت موجودة)
                    if (visit.medications) {
                        normalizedMeds = this.normalizeVisitMedications(visit.medications);
                        if (AppState.debugMode && normalizedMeds.length > 0) {
                            Utils.safeLog(`✅ تم تحميل ${normalizedMeds.length} دواء من medications لزيارة ${visit.id || 'غير محدد'}`);
                        }
                    }
                    
                    // ثانياً: إذا كانت medications فارغة أو غير صحيحة، نحاول من medicationsDispensed
                    if ((!normalizedMeds || normalizedMeds.length === 0) && visit.medicationsDispensed) {
                        // استخدام normalizeVisitMedications لتحويل medicationsDispensed (يدعم النص)
                        const medsFromText = this.normalizeVisitMedications(visit.medicationsDispensed);
                        if (medsFromText && medsFromText.length > 0) {
                            normalizedMeds = medsFromText;
                            if (AppState.debugMode) {
                                Utils.safeLog(`✅ تم تحويل medicationsDispensed لزيارة ${visit.id || 'غير محدد'}:`, medsFromText.length, 'دواء');
                            }
                        }
                    }
                    
                    // تعيين medications النهائي
                    visit.medications = normalizedMeds && normalizedMeds.length > 0 ? normalizedMeds : [];
                    
                    // ✅ إصلاح شامل: تطبيع visitDate و exitDate للتعامل مع جميع الصيغ
                    // معالجة visitDate
                    if (visit.visitDate) {
                        try {
                            // إذا كان Date object، نحوله مباشرة إلى ISO
                            if (visit.visitDate instanceof Date) {
                                if (!isNaN(visit.visitDate.getTime())) {
                                    visit.visitDate = visit.visitDate.toISOString();
                                } else {
                                    visit.visitDate = null;
                                }
                            } else {
                                const visitDateStr = String(visit.visitDate).trim();
                                
                                // إذا كانت بصيغة ISO كاملة (تحتوي على T و Z أو +)
                                if (visitDateStr.includes('T') && (visitDateStr.includes('Z') || visitDateStr.includes('+') || visitDateStr.includes('-'))) {
                                    // التحقق من صحة ISO string
                                    const parsed = new Date(visitDateStr);
                                    if (!isNaN(parsed.getTime())) {
                                        visit.visitDate = parsed.toISOString();
                                    } else {
                                        visit.visitDate = null;
                                    }
                                }
                                // إذا كانت بصيغة yyyy-MM-dd فقط (10 أحرف)، نضيف وقت افتراضي
                                else if (visitDateStr.length === 10 && visitDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    const dateOnly = new Date(visitDateStr + 'T00:00:00');
                                    if (!isNaN(dateOnly.getTime())) {
                                        visit.visitDate = dateOnly.toISOString();
                                    } else {
                                        visit.visitDate = null;
                                    }
                                }
                                // محاولة تحويل أي صيغة أخرى
                                else {
                                    const parsed = new Date(visitDateStr);
                                    if (!isNaN(parsed.getTime())) {
                                        visit.visitDate = parsed.toISOString();
                                    } else {
                                        if (AppState.debugMode) {
                                            Utils.safeWarn(`⚠️ لا يمكن تحويل visitDate: ${visitDateStr}`);
                                        }
                                        visit.visitDate = null;
                                    }
                                }
                            }
                        } catch (e) {
                            if (AppState.debugMode) {
                                Utils.safeWarn('⚠️ خطأ في تطبيع visitDate:', e);
                            }
                            visit.visitDate = null;
                        }
                    }
                    
                    // معالجة exitDate
                    if (visit.exitDate) {
                        try {
                            // إذا كان Date object، نحوله مباشرة إلى ISO
                            if (visit.exitDate instanceof Date) {
                                if (!isNaN(visit.exitDate.getTime())) {
                                    visit.exitDate = visit.exitDate.toISOString();
                                } else {
                                    visit.exitDate = null;
                                }
                            } else {
                                const exitDateStr = String(visit.exitDate).trim();
                                
                                // إذا كانت بصيغة ISO كاملة (تحتوي على T و Z أو +)
                                if (exitDateStr.includes('T') && (exitDateStr.includes('Z') || exitDateStr.includes('+') || exitDateStr.includes('-'))) {
                                    // التحقق من صحة ISO string
                                    const parsed = new Date(exitDateStr);
                                    if (!isNaN(parsed.getTime())) {
                                        visit.exitDate = parsed.toISOString();
                                    } else {
                                        visit.exitDate = null;
                                    }
                                }
                                // إذا كانت بصيغة yyyy-MM-dd فقط (10 أحرف)، نضيف وقت افتراضي
                                else if (exitDateStr.length === 10 && exitDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    const dateOnly = new Date(exitDateStr + 'T00:00:00');
                                    if (!isNaN(dateOnly.getTime())) {
                                        visit.exitDate = dateOnly.toISOString();
                                    } else {
                                        visit.exitDate = null;
                                    }
                                }
                                // محاولة تحويل أي صيغة أخرى
                                else {
                                    const parsed = new Date(exitDateStr);
                                    if (!isNaN(parsed.getTime())) {
                                        visit.exitDate = parsed.toISOString();
                                    } else {
                                        if (AppState.debugMode) {
                                            Utils.safeWarn(`⚠️ لا يمكن تحويل exitDate: ${exitDateStr}`);
                                        }
                                        visit.exitDate = null;
                                    }
                                }
                            }
                        } catch (e) {
                            if (AppState.debugMode) {
                                Utils.safeWarn('⚠️ خطأ في تطبيع exitDate:', e);
                            }
                            visit.exitDate = null;
                        }
                    }
                    
                    // ✅ تطبيع createdBy و updatedBy للتعامل مع string و object
                    // عند التحميل من Backend، createdBy يأتي كـ string (اسم المستخدم)
                    // نحتاج للاحتفاظ به كـ string للعرض بشكل صحيح
                    if (visit.createdBy) {
                        // إذا كان string، نتركه كما هو (سيتم عرضه مباشرة)
                        if (typeof visit.createdBy === 'string') {
                            const trimmed = visit.createdBy.trim();
                            // ✅ إصلاح جذري: إذا كان "النظام"، نحاول استخدام email من visit
                            if (trimmed && trimmed !== '' && trimmed !== 'النظام') {
                                visit.createdBy = trimmed;
                            } else if (trimmed === 'النظام') {
                                // محاولة استخدام email كبديل
                                // ✅ البحث عن الاسم من قاعدة البيانات بدلاً من استخدام email
                                const emailFromVisit = (visit.email || '').toString().trim();
                                const userIdFromVisit = (visit.userId || '').toString().trim();
                                
                                if (emailFromVisit || userIdFromVisit) {
                                    const users = AppState.appData.users || [];
                                    const dbUser = users.find(u => {
                                        const userEmail = (u.email || '').toString().toLowerCase().trim();
                                        const userId = (u.id || '').toString().trim();
                                        return (emailFromVisit && userEmail === emailFromVisit.toLowerCase().trim()) || 
                                               (userIdFromVisit && userId === userIdFromVisit);
                                    });
                                    
                                    if (dbUser) {
                                        const dbUserName = (dbUser.name || dbUser.displayName || '').toString().trim();
                                        if (dbUserName && dbUserName !== 'النظام' && dbUserName !== '') {
                                            visit.createdBy = dbUserName;
                                            if (AppState.debugMode) {
                                                Utils.safeLog(`✅ تم استبدال "النظام" بـ اسم المستخدم لزيارة ${visit.id || 'غير محدد'}: ${dbUserName}`);
                                            }
                                        } else {
                                            visit.createdBy = 'مستخدم';
                                        }
                                    } else {
                                        visit.createdBy = 'مستخدم';
                                    }
                                } else {
                                    visit.createdBy = 'مستخدم';
                                }
                            } else {
                                visit.createdBy = null;
                            }
                        } else if (typeof visit.createdBy === 'object') {
                            // إذا كان object، نحوله إلى string للتوافق مع Backend (استخدام الاسم فقط)
                            const name = visit.createdBy.name || '';
                            const result = (name || 'مستخدم').trim();
                            visit.createdBy = result;
                        }
                    } else {
                        visit.createdBy = 'مستخدم';
                    }
                    
                    if (visit.updatedBy) {
                        if (typeof visit.updatedBy === 'string') {
                            visit.updatedBy = visit.updatedBy.trim() || null;
                        } else if (typeof visit.updatedBy === 'object') {
                            // ✅ استخدام الاسم فقط (وليس email أو id)
                            const name = visit.updatedBy.name || '';
                            visit.updatedBy = (name || 'مستخدم').trim();
                        }
                    } else {
                        visit.updatedBy = 'مستخدم';
                    }
                    
                    // إذا كان medicationsDispensedQty موجوداً ولكن لا توجد قائمة أدوية، نضيف logging
                    if (visit.medications.length === 0 && visit.medicationsDispensedQty && visit.medicationsDispensedQty > 0) {
                        if (AppState.debugMode) {
                            Utils.safeWarn(`⚠️ زيارة ${visit.id || 'غير محدد'} لديها medicationsDispensedQty=${visit.medicationsDispensedQty} ولكن لا توجد قائمة أدوية. medicationsDispensed:`, visit.medicationsDispensed);
                        }
                    }
                    
                    return visit;
                });
                
                AppState.appData.clinicVisits = this.mergeClinicVisitsWithLocalOnly(
                    normalizedVisits,
                    previousLocalVisits
                );
                
                // ✅ إعادة تطبيع البيانات بعد التحميل
                this.ensureData();
                
                // حفظ البيانات محلياً فوراً
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }
                
                // ✅ حفظ وقت آخر مزامنة
                localStorage.setItem('clinic_last_sync', Date.now().toString());
                this._visitsBackendFetchOk = true;
                
                // ✅ إحصاءات البيانات المحملة (للتأكد من عدم فقدان البيانات)
                const visitsWithMeds = AppState.appData.clinicVisits.filter(v => {
                    const meds = this.normalizeVisitMedications(v.medications);
                    if (meds && meds.length > 0) return true;
                    if (v.medicationsDispensed) {
                        const medsFromText = this.normalizeVisitMedications(v.medicationsDispensed);
                        return medsFromText && medsFromText.length > 0;
                    }
                    return false;
                });
                
                const mergedVisits = AppState.appData.clinicVisits;
                const totalMedsCount = mergedVisits.reduce((sum, v) => {
                    const meds = this.normalizeVisitMedications(v.medications);
                    if (meds && meds.length > 0) return sum + meds.length;
                    if (v.medicationsDispensed) {
                        const medsFromText = this.normalizeVisitMedications(v.medicationsDispensed);
                        if (medsFromText && medsFromText.length > 0) return sum + medsFromText.length;
                    }
                    return sum;
                }, 0);
                
                if (AppState.debugMode) {
                    Utils.safeLog(`✅ تم تحميل ${normalizedVisits.length} زيارة من الخادم؛ بعد الدمج مع المحلي: ${mergedVisits.length}`);
                    Utils.safeLog(`   - ${mergedVisits.filter(v => v.personType === 'employee' || !v.personType).length} موظف`);
                    Utils.safeLog(`   - ${mergedVisits.filter(v => v.personType === 'contractor').length} مقاول`);
                    Utils.safeLog(`   - ${visitsWithMeds.length} زيارة تحتوي على أدوية منصرفة`);
                    Utils.safeLog(`   - إجمالي ${totalMedsCount} دواء منصرف`);
                }
            }
            } catch (error) {
            if (AppState.debugMode) {
                Utils.safeWarn('⚠️ تعذر تحميل بيانات سجل التردد من الخادم:', error.message);
            }
            // الاستمرار بالبيانات المحلية المتاحة (حتى لو كانت فارغة)
            if (!AppState.appData.clinicVisits) {
                AppState.appData.clinicVisits = [];
            }
            throw error;
            }
        })().finally(() => {
            this._clinicVisitsLoadPromise = null;
        });
        return this._clinicVisitsLoadPromise;
    },

    /**
     * بعد حفظ زيارة ناجح: إعادة جلب السجل من الخادم في الخلفية.
     * لا يُستخدم await هنا — getAllClinicVisits قد يستغرق دقائق وكان يُبقي زر «جاري الحفظ...» والمودال معلقين.
     */
    refreshClinicVisitsFromServerAfterSave() {
        this.loadVisitsDataFromBackend()
            .then(() => {
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    try {
                        window.DataManager.save();
                    } catch (e) { /* ignore */ }
                }
                if (this.state && this.state.activeTab === 'visits') {
                    const p = document.querySelector('.clinic-tab-panel[data-tab-panel="visits"]');
                    if (p) {
                        try {
                            this.ensureData();
                            this.renderVisitsTabContent(p);
                        } catch (e) { /* ignore */ }
                    }
                }
            })
            .catch((reloadErr) => {
                Utils.safeWarn('تعذر تحديث سجل التردد من الخادم بعد الحفظ:', reloadErr);
            });
    },

    /**
     * ✅ دالة منفصلة لعرض محتوى تبويب سجل التردد (مثل الأدوية)
     * تعرض الواجهة بالبيانات المتوفرة فوراً دون انتظار التحميل
     */
    renderVisitsTabContent(panel) {
        try {
            // التحقق من وجود panel
            if (!panel) {
                Utils.safeWarn('⚠️ panel غير موجود في renderVisitsTabContent');
                return;
            }

            // التحقق من وجود AppState
            if (typeof AppState === 'undefined' || !AppState.appData) {
                Utils.safeWarn('⚠️ AppState غير متوفر في renderVisitsTabContent');
                panel.innerHTML = '<div class="empty-state"><p class="text-gray-500">جاري تحميل البيانات...</p></div>';
                return;
            }

            // الحصول على الترجمات مع حماية من الأخطاء
            let t, isRTL;
            try {
                const translations = this.getTranslations();
                t = translations.t;
                isRTL = translations.isRTL;
            } catch (error) {
                Utils.safeError('❌ خطأ في الحصول على الترجمات:', error);
                // استخدام قيم افتراضية في حالة الفشل
                t = (key) => key;
                isRTL = true;
            }
            
            // الحصول على التبويب النشط (موظفين أو مقاولين)
            const activeVisitType = (this.state && this.state.activeVisitType) ? this.state.activeVisitType : 'employees';
            const isContractorsTab = activeVisitType === 'contractors';
            const visitFilters = (this.state && this.state.filters && this.state.filters.visits) ? this.state.filters.visits : { search: '', factory: '', position: '', workplace: '' };
            const searchTermRaw = (visitFilters.search || '').trim();
            const searchTerm = searchTermRaw.toLowerCase();
            const filterFactory = (visitFilters.factory || '').trim();
            const filterPosition = (visitFilters.position || '').trim();
            const filterWorkplace = (visitFilters.workplace || '').trim();

            // ✅ التأكد من تطبيع البيانات قبل العرض
            this.ensureData();
            
            const allVisits = (AppState.appData.clinicVisits || []).slice().reverse();

            // ✅ فلترة الزيارات حسب النوع مع التأكد من وجود personType
            const employeeVisits = allVisits.filter(v => {
                if (!v || typeof v !== 'object') return false;
                // التأكد من وجود personType
                if (!v.personType) {
                    // محاولة تحديد النوع من الحقول المتوفرة
                    if (v.contractorName || v.contractorWorkerName || v.externalName) {
                        v.personType = 'contractor';
                    } else {
                        v.personType = 'employee';
                    }
                }
                return v.personType === 'employee' || !v.personType;
            });
            const contractorVisits = allVisits.filter(v => {
                if (!v || typeof v !== 'object') return false;
                // التأكد من وجود personType
                if (!v.personType) {
                    // محاولة تحديد النوع من الحقول المتوفرة
                    if (v.contractorName || v.contractorWorkerName || v.externalName) {
                        v.personType = 'contractor';
                    } else {
                        v.personType = 'employee';
                    }
                }
                return v.personType === 'contractor';
            });

            const baseVisits = activeVisitType === 'employees' ? employeeVisits : contractorVisits;
            
            // تطبيق الفلاتر والبحث (قبل تحديث الفلاتر لأن updateVisitFilterOptions يحتاج DOM)
            const visits = baseVisits.filter((visit) => {
                // فلترة المصنع
                if (filterFactory) {
                    try {
                        const visitFactory = this.getVisitFactoryDisplayName(visit);
                        if (String(visitFactory || '').trim() !== filterFactory) {
                            return false;
                        }
                    } catch (error) {
                        // في حالة الخطأ، نتجاهل هذه الزيارة من الفلترة
                        return false;
                    }
                }
                
                // فلترة الوظيفة
                if (filterPosition) {
                    const visitPosition = isContractorsTab
                        ? (visit.contractorPosition || visit.employeePosition || '')
                        : (visit.employeePosition || '');
                    if (String(visitPosition || '').trim() !== filterPosition) {
                        return false;
                    }
                }
                
                // فلترة مكان العمل
                if (filterWorkplace) {
                    const visitWorkplace = isContractorsTab
                        ? (visit.workArea || visit.employeeLocation || '')
                        : (visit.employeeLocation || visit.workArea || '');
                    if (String(visitWorkplace || '').trim() !== filterWorkplace) {
                        return false;
                    }
                }
                
                // البحث في جميع الأعمدة
                if (searchTerm) {
                    const primaryValue = isContractorsTab
                        ? String(visit.contractorName || visit.employeeName || visit.externalName || '')
                        : String(visit.employeeCode || visit.employeeNumber || '');
                    const displayName = isContractorsTab
                        ? String(visit.contractorWorkerName || '')
                        : String(visit.employeeName || '');
                    const position = isContractorsTab
                        ? String(visit.contractorPosition || visit.employeePosition || '')
                        : String(visit.employeePosition || '');
                    let factoryDisplay = '-';
                    try {
                        factoryDisplay = this.getVisitFactoryDisplayName(visit);
                    } catch (error) {
                        factoryDisplay = visit.factoryName || visit.factory || '-';
                    }
                    
                    const workplace = isContractorsTab
                        ? String(visit.workArea || visit.employeeLocation || '')
                        : String(visit.employeeLocation || visit.workArea || '');
                    
                    // ✅ عرض التاريخ والوقت في البحث بشكل صحيح
                    let entryTime = '-';
                    let exitTime = '';
                    try {
                        if (visit.visitDate) {
                            let visitDateValue = visit.visitDate;
                            if (visitDateValue instanceof Date) {
                                visitDateValue = visitDateValue.toISOString();
                            } else if (typeof visitDateValue === 'string' && !visitDateValue.includes('T')) {
                                if (visitDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    visitDateValue = visitDateValue + 'T00:00:00Z';
                                }
                            }
                            entryTime = Utils.formatDateTime ? Utils.formatDateTime(visitDateValue) : String(visitDateValue);
                        }
                        
                        if (visit.exitDate) {
                            let exitDateValue = visit.exitDate;
                            if (exitDateValue instanceof Date) {
                                exitDateValue = exitDateValue.toISOString();
                            } else if (typeof exitDateValue === 'string' && !exitDateValue.includes('T')) {
                                if (exitDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    exitDateValue = exitDateValue + 'T00:00:00Z';
                                }
                            }
                            exitTime = Utils.formatDateTime ? Utils.formatDateTime(exitDateValue) : String(exitDateValue);
                        }
                    } catch (error) {
                        entryTime = visit.visitDate ? String(visit.visitDate) : '-';
                        exitTime = visit.exitDate ? String(visit.exitDate) : '';
                    }
                    
                    const reason = String(visit.reason || '');
                    const diagnosis = String(visit.diagnosis || '');
                    
                    // البحث في الأدوية مع حماية من الأخطاء
                    let medsArr = [];
                    if (visit.medications) {
                        try {
                            medsArr = this.normalizeVisitMedications(visit.medications);
                        } catch (error) {
                            // في حالة الخطأ، نستخدم قائمة فارغة
                            medsArr = [];
                        }
                    }
                    const medications = medsArr && medsArr.length > 0
                        ? medsArr.map(m => {
                            try {
                                let name = '';
                                if (m && m.medicationName) {
                                    name = typeof m.medicationName === 'string' ? m.medicationName : (m.medicationName.name || String(m.medicationName) || '');
                                } else if (m && m.name) {
                                    name = typeof m.name === 'string' ? m.name : (m.name.name || String(m.name) || '');
                                }
                                return name;
                            } catch (error) {
                                return '';
                            }
                        }).filter(Boolean).join(' ')
                        : '';
                    
                    // ✅ إضافة createdBy في البحث
                    let createdBySearch = '';
                    try {
                        if (visit.createdBy) {
                            if (typeof visit.createdBy === 'object') {
                                // ✅ استخدام الاسم فقط (وليس email أو id)
                                createdBySearch = String(visit.createdBy.name || 'مستخدم');
                            } else {
                                createdBySearch = String(visit.createdBy || '');
                            }
                        }
                    } catch (error) {
                        createdBySearch = '';
                    }
                    
                    const searchText = [
                        primaryValue, displayName, position, factoryDisplay, workplace,
                        entryTime, exitTime, reason, diagnosis, medications, createdBySearch
                    ].join(' ').toLowerCase();
                    
                    if (!searchText.includes(searchTerm)) {
                        return false;
                    }
                }
                
                return true;
            });

            // ✅ تحسين الأداء: بناء صف واحد (يُستخدم لاحقاً في ضخ الصفوف تدريجياً)
            const buildVisitRowHtml = (visit) => {
                // ترتيب الأعمدة حسب نوع التبويب
                const primaryValue = isContractorsTab
                    ? (visit.contractorName || visit.employeeName || visit.externalName || '-')
                    : (visit.employeeCode || visit.employeeNumber || '-');

                const displayName = isContractorsTab
                    ? (visit.contractorWorkerName || '-')
                    : (visit.employeeName || '-');

                const position = isContractorsTab
                    ? (visit.contractorPosition || visit.employeePosition || '-')
                    : (visit.employeePosition || '-');

                let factoryDisplay = '-';
                try {
                    factoryDisplay = this.getVisitFactoryDisplayName(visit);
                } catch (error) {
                    factoryDisplay = visit.factoryName || visit.factory || '-';
                }
                
                const workplace = isContractorsTab
                    ? (visit.workArea || visit.employeeLocation || '-')
                    : (visit.employeeLocation || visit.workArea || '-');

                // ✅ عرض التاريخ والوقت بشكل صحيح مع معالجة شاملة
                let entryTime = '-';
                let exitTime = `<span class="text-xs text-gray-500">${t('table.notRecorded')}</span>`;
                try {
                    if (visit.visitDate) {
                        // التأكد من أن visitDate هو ISO string صحيح
                        let visitDateValue = visit.visitDate;
                        if (visitDateValue instanceof Date) {
                            visitDateValue = visitDateValue.toISOString();
                        } else if (typeof visitDateValue === 'string' && !visitDateValue.includes('T')) {
                            // إذا كان string بدون T، نحاول إصلاحه
                            if (visitDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                visitDateValue = visitDateValue + 'T00:00:00Z';
                            }
                        }
                        entryTime = Utils.formatDateTime ? Utils.formatDateTime(visitDateValue) : String(visitDateValue);
                    }
                    
                    if (visit.exitDate) {
                        // التأكد من أن exitDate هو ISO string صحيح
                        let exitDateValue = visit.exitDate;
                        if (exitDateValue instanceof Date) {
                            exitDateValue = exitDateValue.toISOString();
                        } else if (typeof exitDateValue === 'string' && !exitDateValue.includes('T')) {
                            // إذا كان string بدون T، نحاول إصلاحه
                            if (exitDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                exitDateValue = exitDateValue + 'T00:00:00Z';
                            }
                        }
                        exitTime = Utils.formatDateTime ? Utils.formatDateTime(exitDateValue) : `<span class="text-xs text-gray-500">${t('table.notRecorded')}</span>`;
                    }
                } catch (error) {
                    if (AppState.debugMode) {
                        Utils.safeWarn('⚠️ خطأ في عرض التاريخ والوقت:', error);
                    }
                    entryTime = visit.visitDate ? String(visit.visitDate) : '-';
                    exitTime = visit.exitDate ? String(visit.exitDate) : `<span class="text-xs text-gray-500">${t('table.notRecorded')}</span>`;
                }
                
                let totalTime = '-';
                try {
                    totalTime = this.calculateTotalTime(visit.visitDate, visit.exitDate);
                } catch (error) {
                    totalTime = '-';
                }
                
                const reason = visit.reason || '';
                const diagnosis = visit.diagnosis || '';

                // ✅ تطبيع الأدوية بشكل شامل (دعم جميع الصيغ) مع حماية من الأخطاء
                let medsArr = [];
                
                // أولاً: محاولة من medications
                if (visit.medications) {
                    try {
                        medsArr = this.normalizeVisitMedications(visit.medications);
                        if (AppState.debugMode && medsArr.length > 0) {
                            Utils.safeLog(`✅ تم تحميل ${medsArr.length} دواء من medications لزيارة ${visit.id || 'غير محدد'}`);
                        }
                    } catch (error) {
                        if (AppState.debugMode) {
                            Utils.safeWarn('⚠️ خطأ في normalizeVisitMedications:', error);
                        }
                        medsArr = [];
                    }
                }
                
                // ثانياً: إذا كانت medications فارغة أو غير صالحة، نحاول من medicationsDispensed
                if ((!medsArr || medsArr.length === 0) && visit.medicationsDispensed) {
                    try {
                        const medsFromDispensed = this.normalizeVisitMedications(visit.medicationsDispensed);
                        if (medsFromDispensed && medsFromDispensed.length > 0) {
                            medsArr = medsFromDispensed;
                            if (AppState.debugMode) {
                                Utils.safeLog(`✅ تم تحويل medicationsDispensed أثناء العرض لزيارة ${visit.id || 'غير محدد'}:`, medsArr.length, 'دواء');
                            }
                        }
                    } catch (error) {
                        if (AppState.debugMode) {
                            Utils.safeWarn('⚠️ خطأ في normalizeVisitMedications من medicationsDispensed:', error);
                        }
                    }
                }
                
                // ثالثاً: إذا كان medicationsDispensedQty موجوداً ولكن لا توجد قائمة أدوية، نحاول استخدامه
                if ((!medsArr || medsArr.length === 0) && visit.medicationsDispensedQty && visit.medicationsDispensedQty > 0) {
                    if (AppState.debugMode) {
                        Utils.safeWarn(`⚠️ زيارة ${visit.id || 'غير محدد'} لديها medicationsDispensedQty=${visit.medicationsDispensedQty} ولكن لا توجد قائمة أدوية`);
                    }
                }
                
                // عرض الأدوية والكمية مع حماية شاملة من الأخطاء
                const medications = medsArr && medsArr.length > 0
                    ? medsArr.map(m => {
                        try {
                            // ✅ التأكد من أن medicationName هو string وليس كائن
                            if (!m || typeof m !== 'object') {
                                return null;
                            }
                            
                            let name = '';
                            if (m.medicationName) {
                                name = typeof m.medicationName === 'string' 
                                    ? m.medicationName.trim() 
                                    : (m.medicationName.name || String(m.medicationName) || '').trim();
                            } else if (m.name) {
                                name = typeof m.name === 'string' 
                                    ? m.name.trim() 
                                    : (m.name.name || String(m.name) || '').trim();
                            }
                            
                            if (!name) {
                                if (AppState.debugMode) {
                                    Utils.safeWarn('⚠️ دواء بدون اسم:', m);
                                }
                                return null;
                            }
                            
                            const qty = parseInt(m.quantity, 10) || 1;
                            return `${Utils.escapeHTML(name)} (${qty})`;
                        } catch (error) {
                            if (AppState.debugMode) {
                                Utils.safeWarn('⚠️ خطأ في معالجة دواء:', error, m);
                            }
                            return null;
                        }
                    }).filter(Boolean).join(isRTL ? '، ' : ', ')
                    : '-';
                
                const dispensedQty = medsArr && medsArr.length > 0
                    ? medsArr.reduce((sum, m) => {
                        try {
                            const qty = parseInt(m.quantity, 10) || 0;
                            return sum + qty;
                        } catch (error) {
                            return sum;
                        }
                    }, 0)
                    : 0;

                // ✅ عرض createdBy (تم التسجيل بواسطة) - منطق مبسط
                let createdByDisplay = 'غير محدد';
                try {
                    // أولاً: إذا كان createdBy موجود ومليء
                    if (visit.createdBy) {
                        const createdByValue = typeof visit.createdBy === 'object' 
                            ? (visit.createdBy.name || '') 
                            : String(visit.createdBy).trim();
                        
                        if (createdByValue && createdByValue !== 'مستخدم' && createdByValue !== 'النظام') {
                            createdByDisplay = Utils.escapeHTML(createdByValue);
                        }
                    }
                    
                    // ثانياً: إذا لم نجد اسم صحيح، نبحث في قاعدة البيانات
                    if (createdByDisplay === 'غير محدد' && visit.email) {
                        const users = AppState.appData.users || [];
                        const visitEmail = (visit.email || '').toString().toLowerCase().trim();
                        const dbUser = users.find(u => (u.email || '').toString().toLowerCase().trim() === visitEmail);
                        if (dbUser && dbUser.name) {
                            createdByDisplay = Utils.escapeHTML(dbUser.name);
                        }
                    }
                } catch (error) {
                    createdByDisplay = 'غير محدد';
                }

                // استخدام isRTL من بداية الدالة (تم الحصول عليه في السطر 5010)
                const textAlign = isRTL ? 'right' : 'left';
                
                return `
                <tr>
                    <td style="word-wrap: break-word; white-space: normal; text-align: ${textAlign};">${Utils.escapeHTML(primaryValue)}</td>
                    <td style="word-wrap: break-word; white-space: normal; max-width: 200px; text-align: ${textAlign};">
                        <div class="font-medium text-gray-900">${Utils.escapeHTML(displayName)}</div>
                    </td>
                    <td style="word-wrap: break-word; white-space: normal; max-width: 150px; text-align: ${textAlign};">${Utils.escapeHTML(position)}</td>
                    <td style="word-wrap: break-word; white-space: normal; max-width: 150px; text-align: ${textAlign};">${Utils.escapeHTML(factoryDisplay)}</td>
                    <td style="word-wrap: break-word; white-space: normal; max-width: 150px; text-align: ${textAlign};">${Utils.escapeHTML(workplace)}</td>
                    <td style="word-wrap: break-word; white-space: normal; text-align: ${textAlign};">${Utils.escapeHTML(entryTime)}</td>
                    <td style="word-wrap: break-word; white-space: normal; text-align: ${textAlign};">${exitTime}</td>
                    <td style="word-wrap: break-word; white-space: normal; text-align: ${textAlign};">${totalTime}</td>
                    <td style="word-wrap: break-word; white-space: normal; max-width: 200px; text-align: ${textAlign};">${Utils.escapeHTML(reason)}</td>
                    <td style="word-wrap: break-word; white-space: normal; max-width: 200px; text-align: ${textAlign};">${Utils.escapeHTML(diagnosis)}</td>
                    <td style="word-wrap: break-word; white-space: normal; max-width: 250px; text-align: ${textAlign};"><div style="overflow-wrap: break-word;">${medications}</div></td>
                    <td class="text-center font-semibold" style="word-wrap: break-word; white-space: normal;">${dispensedQty}</td>
                    <td style="word-wrap: break-word; white-space: normal; max-width: 150px; text-align: ${textAlign};">${createdByDisplay}</td>
                    <td class="text-center" style="min-width: 150px;">
                        <div class="flex items-center justify-center gap-2 flex-wrap">
                            <button type="button" class="btn-icon btn-icon-primary" data-action="view-visit" data-id="${Utils.escapeHTML(visit.id || '')}" title="${t('btn.view')}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button type="button" class="btn-icon btn-icon-warning" data-action="edit-visit" data-id="${Utils.escapeHTML(visit.id || '')}" title="${t('btn.edit')}">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            };

            const tableHtml = visits.length
                ? `
                <div class="table-wrapper clinic-table-wrapper" style="width: 100%; max-width: 100%; overflow-x: auto; overflow-y: auto; max-height: 70vh;">
                    <table class="data-table table-header-green" style="width: 100%; min-width: 100%; table-layout: auto; direction: ${isRTL ? 'rtl' : 'ltr'};">
                        <thead>
                            <tr>
                                <th style="min-width: 120px; text-align: ${isRTL ? 'right' : 'left'};">${isContractorsTab ? t('table.contractorName') : t('table.employeeCode')}</th>
                                <th style="min-width: 150px; text-align: ${isRTL ? 'right' : 'left'};">${t('table.name')}</th>
                                <th style="min-width: 120px; text-align: ${isRTL ? 'right' : 'left'};">${t('table.jobTitle')}</th>
                                <th style="min-width: 120px; text-align: ${isRTL ? 'right' : 'left'};">${t('table.factory')}</th>
                                <th style="min-width: 120px; text-align: ${isRTL ? 'right' : 'left'};">${t('table.workplace')}</th>
                                <th style="min-width: 150px; text-align: ${isRTL ? 'right' : 'left'};">${t('table.entryTime')}</th>
                                <th style="min-width: 150px; text-align: ${isRTL ? 'right' : 'left'};">${t('table.exitTime')}</th>
                                <th style="min-width: 100px; text-align: ${isRTL ? 'right' : 'left'};">${t('table.totalTime')}</th>
                                <th style="min-width: 150px; word-wrap: break-word; text-align: ${isRTL ? 'right' : 'left'};">${t('table.reason')}</th>
                                <th style="min-width: 150px; word-wrap: break-word; text-align: ${isRTL ? 'right' : 'left'};">${t('table.diagnosis')}</th>
                                <th style="min-width: 200px; word-wrap: break-word; text-align: ${isRTL ? 'right' : 'left'};">${t('table.medications')}</th>
                                <th style="min-width: 100px; text-align: center;">${t('table.quantity')}</th>
                                <th style="min-width: 150px; text-align: ${isRTL ? 'right' : 'left'};">تم التسجيل بواسطة</th>
                                <th class="text-center" style="min-width: 150px;">${t('table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody id="clinic-visits-tbody"></tbody>
                    </table>
                </div>
            `
                : this.renderEmptyState(
                    searchTerm
                        ? t('empty.noResults')
                        : (activeVisitType === 'employees' ? t('empty.noEmployeeVisits') : t('empty.noContractorVisits'))
                );

            const iconMarginClass = isRTL ? 'ml-2' : 'mr-2';
            const badgeMarginClass = isRTL ? 'mr-2' : 'ml-2';
            const searchIconClass = isRTL ? 'ml-1' : 'mr-1';
            
            const content = `
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                <div class="flex items-center gap-2">
                    <h3 class="text-lg font-semibold" style="text-align: ${isRTL ? 'right' : 'left'};">${t('tab.visits')}</h3>
                </div>
                <div class="flex gap-2">
                    <button type="button" id="visits-add-btn" class="btn-primary">
                        <i class="fas fa-plus ${iconMarginClass}"></i>
                        ${t('btn.registerVisit')}
                    </button>
                    <button type="button" id="visits-refresh-btn" class="btn-secondary">
                        <i class="fas fa-sync-alt ${iconMarginClass}"></i>
                        ${t('btn.refresh')}
                    </button>
                    <button type="button" id="visits-export-excel-btn" class="btn-success">
                        <i class="fas fa-file-excel ${iconMarginClass}"></i>
                        ${t('btn.exportExcel')}
                    </button>
                    <button type="button" id="visits-export-pdf-btn" class="btn-secondary">
                        <i class="fas fa-file-pdf ${iconMarginClass}"></i>
                        ${t('btn.exportPDF')}
                    </button>
                </div>
            </div>
            
            <!-- تبويبات منفصلة للموظفين والمقاولين -->
            <div class="mb-4" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                <div class="module-tabs-wrapper">
                    <div class="module-tabs-container">
                        <button type="button" 
                            class="visit-type-tab px-6 py-3 font-medium transition-colors ${activeVisitType === 'employees' ? 'text-blue-600 border-b-2 border-blue-600 active' : 'text-gray-500 hover:text-gray-700'}"
                            data-visit-type="employees">
                            <i class="fas fa-user-tie ${iconMarginClass}"></i>
                            ${t('tab.employees')}
                            <span class="badge ${activeVisitType === 'employees' ? 'badge-primary' : 'badge-secondary'} ${badgeMarginClass}">${employeeVisits.length}</span>
                        </button>
                        <button type="button" 
                            class="visit-type-tab px-6 py-3 font-medium transition-colors ${activeVisitType === 'contractors' ? 'text-blue-600 border-b-2 border-blue-600 active' : 'text-gray-500 hover:text-gray-700'}"
                            data-visit-type="contractors">
                            <i class="fas fa-hard-hat ${iconMarginClass}"></i>
                            ${t('tab.contractors')}
                            <span class="badge ${activeVisitType === 'contractors' ? 'badge-primary' : 'badge-secondary'} ${badgeMarginClass}">${contractorVisits.length}</span>
                        </button>
                        </div>
                </div>
            </div>
            
            <!-- الفلاتر في صف واحد احترافي (مشابه لسجل الملاحظات) -->
            <div class="visits-filters-row" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 16px 20px; margin: 0 -20px 0 -20px; width: calc(100% + 40px); direction: ${isRTL ? 'rtl' : 'ltr'};">
                <div class="filters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; align-items: end;">
                    <!-- حقل البحث -->
                    <div class="filter-field" style="min-width: 180px;">
                        <label for="visits-search" class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                            <i class="fas fa-search ${searchIconClass}"></i>${t('filter.search')}
                        </label>
                        <input type="text" id="visits-search" class="filter-input" placeholder="${t('filter.searchPlaceholder')}" value="${Utils.escapeHTML(searchTermRaw)}" style="width: 100%; min-width: 160px; text-align: ${isRTL ? 'right' : 'left'}; direction: ${isRTL ? 'rtl' : 'ltr'};">
                    </div>
                    
                    <!-- فلتر المصنع -->
                    <div class="filter-field" style="min-width: 160px;">
                        <label for="visits-filter-factory" class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                            <i class="fas fa-industry ${searchIconClass}"></i>${t('filter.factory')}
                            ${filterFactory ? `<span class="filter-count-badge" title="عدد النتائج المفلترة">${visits.length}</span>` : ''}
                        </label>
                        <select id="visits-filter-factory" class="filter-input" style="width: 100%; min-width: 140px; direction: ${isRTL ? 'rtl' : 'ltr'};">
                            <option value="">${t('filter.all')}</option>
                        </select>
                    </div>
                    
                    <!-- فلتر الوظيفة -->
                    <div class="filter-field" style="min-width: 160px;">
                        <label for="visits-filter-position" class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                            <i class="fas fa-briefcase ${searchIconClass}"></i>${t('filter.jobTitle')}
                            ${filterPosition ? `<span class="filter-count-badge" title="عدد النتائج المفلترة">${visits.length}</span>` : ''}
                        </label>
                        <select id="visits-filter-position" class="filter-input" style="width: 100%; min-width: 140px; direction: ${isRTL ? 'rtl' : 'ltr'};">
                            <option value="">${t('filter.all')}</option>
                        </select>
                    </div>
                    
                    <!-- فلتر مكان العمل -->
                    <div class="filter-field" style="min-width: 160px;">
                        <label for="visits-filter-workplace" class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                            <i class="fas fa-map-marker-alt ${searchIconClass}"></i>${t('filter.workplace')}
                            ${filterWorkplace ? `<span class="filter-count-badge" title="عدد النتائج المفلترة">${visits.length}</span>` : ''}
                        </label>
                        <select id="visits-filter-workplace" class="filter-input" style="width: 100%; min-width: 140px; direction: ${isRTL ? 'rtl' : 'ltr'};">
                            <option value="">${t('filter.all')}</option>
                        </select>
                    </div>
                    
                    <!-- زر إعادة التعيين -->
                    <div class="filter-field" style="min-width: 140px;">
                        <button id="visits-reset-filters" class="filter-reset-btn" style="width: 100%;">
                            <i class="fas fa-redo ${searchIconClass}"></i>${t('btn.reset')}
                        </button>
                    </div>
                </div>
            </div>
            
            ${tableHtml}
        `;

            panel.innerHTML = content;
            this.applyModuleI18n(panel);
            
            // تحديث قيم الفلاتر بعد إدراج المحتوى في DOM
            // ✅ تجنّب Violation: updateVisitFilterOptions قد تكون ثقيلة، لذا ننقلها إلى idle/timeout
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(() => this.updateVisitFilterOptions(baseVisits), { timeout: 900 });
            } else {
                setTimeout(() => this.updateVisitFilterOptions(baseVisits), 0);
            }

            // ✅ ضخ صفوف الجدول تدريجياً لتسريع فتح تبويب "سجل التردد"
            try {
                const tbody = panel.querySelector('#clinic-visits-tbody');
                if (tbody && Array.isArray(visits) && visits.length > 0) {
                    this._clinicVisitsRowsToken = (this._clinicVisitsRowsToken || 0) + 1;
                    const myToken = this._clinicVisitsRowsToken;
                    let i = 0;
                    const total = visits.length;

                    const pump = (deadline) => {
                        if (myToken !== this._clinicVisitsRowsToken) return;
                        if (this.state && this.state.activeTab !== 'visits') return;

                        const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                        let chunkHtml = '';
                        let rowsBuilt = 0;

                        while (i < total) {
                            chunkHtml += buildVisitRowHtml(visits[i]);
                            i += 1;
                            rowsBuilt += 1;

                            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                            const timeOk = deadline && typeof deadline.timeRemaining === 'function'
                                ? deadline.timeRemaining() > 6
                                : (now - start) < 12;
                            if (rowsBuilt >= 25 && !timeOk) break;
                            if (rowsBuilt >= 75) break;
                        }

                        if (chunkHtml) {
                            tbody.insertAdjacentHTML('beforeend', chunkHtml);
                        }

                        if (i < total) {
                            if (typeof requestIdleCallback === 'function') {
                                requestIdleCallback(pump, { timeout: 900 });
                            } else {
                                setTimeout(() => pump(null), 0);
                            }
                        }
                    };

                    if (typeof requestIdleCallback === 'function') {
                        requestIdleCallback(pump, { timeout: 900 });
                    } else {
                        setTimeout(() => pump(null), 0);
                    }
                }
            } catch (e) { /* ignore */ }
            
            this.bindVisitsTabEvents(panel);
            
            // استعادة التركيز على حقل البحث إذا كان نشطاً
            if (this.state._shouldFocusSearch) {
                requestAnimationFrame(() => {
                    const searchInput = panel.querySelector('#visits-search');
                    if (searchInput) {
                        searchInput.focus();
                        const cursorPos = this.state._searchCursorPosition;
                        if (cursorPos !== null && cursorPos !== undefined) {
                            try {
                                searchInput.setSelectionRange(cursorPos, cursorPos);
                            } catch (e) {
                                // بعض المتصفحات قد لا تدعم setSelectionRange
                            }
                        }
                        this.state._shouldFocusSearch = false;
                    }
                });
            }
            
            // إضافة مستمعي التمرير للجدول
            requestAnimationFrame(() => {
                const wrapper = panel.querySelector('.clinic-table-wrapper');
                if (wrapper) {
                    this.setupTableScrollListeners(wrapper);
                }
            });
        } catch (error) {
            // عرض رسالة خطأ واضحة مع التفاصيل
            const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
            Utils.safeError('❌ خطأ في عرض محتوى تبويب سجل التردد:', errorMessage);
            
            // عرض رسالة خطأ للمستخدم في الواجهة
            if (panel) {
                try {
                    panel.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                            <p class="text-gray-500 mb-2">حدث خطأ أثناء عرض البيانات</p>
                            <p class="text-sm text-gray-400">${Utils.escapeHTML(errorMessage)}</p>
                            <button type="button" class="btn-primary mt-4" onclick="Clinic.renderVisitsTab()">
                                <i class="fas fa-redo ml-2"></i>إعادة المحاولة
                            </button>
                        </div>
                    `;
                } catch (innerError) {
                    // في حالة فشل عرض رسالة الخطأ، نترك الواجهة كما هي
                    Utils.safeError('❌ خطأ في عرض رسالة الخطأ:', innerError);
                }
            }
        }
    },

    calculateTotalTime(visitDate, exitDate) {
        if (!visitDate || !exitDate) return '-';
        try {
            const { t } = this.getTranslations();
            const entry = visitDate instanceof Date ? visitDate : new Date(visitDate);
            const exit = exitDate instanceof Date ? exitDate : new Date(exitDate);

            if (isNaN(entry.getTime()) || isNaN(exit.getTime())) {
                return '-';
            }

            const diffMs = exit.getTime() - entry.getTime();
            if (diffMs < 0) return '-';

            const totalMinutes = Math.floor(diffMs / (1000 * 60));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            if (hours > 0 && minutes > 0) {
                return `${hours} ${t('time.hours')} ${minutes} ${t('time.minutes')}`;
            } else if (hours > 0) {
                return `${hours} ${t('time.hours')}`;
            } else if (minutes > 0) {
                return `${minutes} ${t('time.minutes')}`;
            } else {
                return t('time.lessThanMinute');
            }
        } catch (e) {
            Utils.safeError('خطأ في حساب الوقت:', e);
            return '-';
        }
    },

    /**
     * ✅ تنظيف اسم الدواء من الكمية المدمجة فيه واستخراج الكمية إذا كانت موجودة
     * مثال: "بروفين(600)" -> { name: "بروفين", quantity: 600 }
     * مثال: "بروفين (600)" -> { name: "بروفين", quantity: 600 }
     * مثال: "بروفين" -> { name: "بروفين", quantity: null }
     */
    cleanMedicationName(name, currentQuantity = null) {
        if (!name || typeof name !== 'string') {
            // إذا لم تكن هناك كمية مسجلة، نعيد 0
            const qty = (currentQuantity !== null && currentQuantity !== undefined) ? currentQuantity : 0;
            return { name: name || '', quantity: qty };
        }
        
        const trimmed = name.trim();
        
        // البحث عن الكمية المدمجة في نهاية الاسم مثل "بروفين(600)" أو "بروفين (600)"
        const match = trimmed.match(/^(.+?)\s*\(\s*(\d+)\s*\)\s*$/);
        
        if (match) {
            const cleanedName = match[1].trim();
            
            // ✅ إصلاح: نستخدم الكمية المسجلة من المستخدم إذا كانت موجودة
            // إذا لم تكن هناك كمية مسجلة (null أو undefined)، نعيد 0 وليس استخراج الرقم من الاسم
            // هذا يضمن استخدام البيانات الفعلية المسجلة من المستخدم فقط
            if (currentQuantity !== null && currentQuantity !== undefined) {
                // إذا كانت هناك كمية مسجلة بوضوح، نستخدمها
                return { name: cleanedName, quantity: currentQuantity };
            } else {
                // إذا لم تكن هناك كمية مسجلة، نعيد 0 (وليس استخراج الرقم من الاسم)
                return { name: cleanedName, quantity: 0 };
            }
        }
        
        // إذا لم توجد كمية مدمجة في الاسم، نعيد الاسم كما هو
        // إذا لم تكن هناك كمية مسجلة، نعيد 0
        const qty = (currentQuantity !== null && currentQuantity !== undefined) ? currentQuantity : 0;
        return { name: trimmed, quantity: qty };
    },

    /**
     * ✅ تطبيع قائمة الأدوية المنصرفة (دعم جميع الصيغ)
     * يدعم: array, JSON string, نص صيغة "name (qty)، name (qty)"
     */
    normalizeVisitMedications(medications) {
        if (!medications) return [];
        
        // إذا كانت array، نعيدها مباشرة
        if (Array.isArray(medications)) {
            // التأكد من أن جميع العناصر لها الشكل الصحيح
            const normalized = medications.map(m => {
                if (!m || typeof m !== 'object') return null;
                
                // ✅ إصلاح: التأكد من أن medicationName هو string وليس object
                let name = m.medicationName || m.name || '';
                
                // إذا كان name عبارة عن object (مثل {medicationName: 'بانادول', quantity: 1}), نستخرج medicationName منه
                if (typeof name === 'object' && name !== null) {
                    console.warn('⚠️ [CLINIC] اكتشاف name كـ object:', name);
                    name = name.medicationName || name.name || '';
                    console.log('✅ [CLINIC] بعد الاستخراج:', name);
                }
                
                name = (name || '').toString().trim();
                
                if (!name) return null;
                
                const currentQty = parseInt(m.quantity, 10) || 1;
                
                // ✅ تنظيف اسم الدواء من الكمية المدمجة فيه واستخراج الكمية
                const cleaned = this.cleanMedicationName(name, currentQty);
                
                // ✅ التأكد من أن name هو string وليس كائن
                const finalName = typeof cleaned.name === 'string' 
                    ? cleaned.name.trim() 
                    : (cleaned.name && cleaned.name.name ? cleaned.name.name.trim() : String(cleaned.name || '').trim());
                
                if (!finalName) {
                    if (AppState.debugMode) {
                        Utils.safeWarn('⚠️ دواء بدون اسم بعد التنظيف:', m, cleaned);
                    }
                    return null;
                }
                
                return {
                    medicationName: finalName,
                    quantity: cleaned.quantity || currentQty || 1,
                    unit: m.unit || 'وحدة',
                    notes: m.notes || ''
                };
            }).filter(m => m !== null && m.medicationName);
            
            if (AppState.debugMode && normalized.length === 0 && medications.length > 0) {
                Utils.safeWarn('⚠️ فشل تطبيع مصفوفة الأدوية:', medications);
            }
            
            return normalized;
        }
        
        // إذا كانت string، نحاول parse
        if (typeof medications === 'string') {
            const trimmed = medications.trim();
            if (!trimmed) return [];
            
            // محاولة 1: JSON parse
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    const normalized = parsed.map(m => {
                        if (!m || typeof m !== 'object') return null;
                        
                        // ✅ إصلاح: التأكد من أن medicationName هو string وليس object
                        let name = m.medicationName || m.name || '';
                        
                        // إذا كان name عبارة عن object, نستخرج medicationName منه
                        if (typeof name === 'object' && name !== null) {
                            console.warn('⚠️ [CLINIC JSON] اكتشاف name كـ object:', name);
                            name = name.medicationName || name.name || '';
                            console.log('✅ [CLINIC JSON] بعد الاستخراج:', name);
                        }
                        
                        name = (name || '').toString().trim();
                        
                        if (!name) return null;
                        
                        const currentQty = parseInt(m.quantity, 10) || 1;
                        
                        // ✅ تنظيف اسم الدواء من الكمية المدمجة فيه واستخراج الكمية
                        const cleaned = this.cleanMedicationName(name, currentQty);
                        
                        // ✅ التأكد من أن name هو string وليس كائن
                        const finalName = typeof cleaned.name === 'string' 
                            ? cleaned.name.trim() 
                            : (cleaned.name && cleaned.name.name ? cleaned.name.name.trim() : String(cleaned.name || '').trim());
                        
                        if (!finalName) {
                            if (AppState.debugMode) {
                                Utils.safeWarn('⚠️ دواء بدون اسم بعد التنظيف (JSON):', m, cleaned);
                            }
                            return null;
                        }
                        
                        return {
                            medicationName: finalName,
                            quantity: cleaned.quantity || currentQty || 1,
                            unit: m.unit || 'وحدة',
                            notes: m.notes || ''
                        };
                    }).filter(m => m !== null && m.medicationName);
                    
                    if (normalized.length > 0) {
                        return normalized;
                    }
                }
            } catch (e) {
                // ليس JSON، ننتقل للمحاولة 2
            }
            
            // محاولة 2: parse النص الصيغة "name (qty)، name (qty)" (مثل Backend)
            try {
                const parts = trimmed.split(/،|,/).map(p => p.trim()).filter(Boolean);
                const result = [];
                
                parts.forEach(p => {
                    // match "name (qty)" أو "name"
                    // تحسين الـ regex لدعم مسافات أكثر
                    const match = p.match(/^(.+?)(?:\s*\(\s*(\d+)\s*\))?\s*$/);
                    if (!match) {
                        // إذا لم يطابق، نحاول استخدام النص كله كاسم
                        const name = p.trim();
                        if (name) {
                            result.push({
                                medicationName: name,
                                quantity: 1,
                                unit: 'وحدة',
                                notes: ''
                            });
                        }
                        return;
                    }
                    
                    let name = (match[1] || '').trim();
                    let qty = match[2] ? parseInt(match[2], 10) : 1;
                    
                    if (name) {
                        // ✅ تنظيف اسم الدواء من الكمية المدمجة فيه واستخراج الكمية
                        const cleaned = this.cleanMedicationName(name, qty);
                        name = cleaned.name;
                        qty = cleaned.quantity || qty || 1;
                        
                        // ✅ التأكد من أن name هو string
                        const finalName = typeof name === 'string' ? name.trim() : String(name || '').trim();
                        
                        if (finalName) {
                            result.push({
                                medicationName: finalName,
                                quantity: isNaN(qty) ? 1 : qty,
                                unit: 'وحدة',
                                notes: ''
                            });
                        }
                    }
                });
                
                if (result.length > 0) {
                    if (AppState.debugMode) {
                        Utils.safeLog(`✅ تم تحليل ${result.length} دواء من النص:`, trimmed);
                    }
                    return result;
                }
            } catch (e) {
                // فشل التحليل
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ فشل تحليل نص الأدوية:', trimmed, e);
                }
            }
            
            return [];
        }
        
        // إذا كانت object واحد (ليس array)، نحوله إلى array
        if (typeof medications === 'object' && medications !== null) {
            let name = (medications.medicationName || medications.name || '').trim();
            if (name) {
                const currentQty = parseInt(medications.quantity, 10) || 1;
                
                // ✅ تنظيف اسم الدواء من الكمية المدمجة فيه واستخراج الكمية
                const cleaned = this.cleanMedicationName(name, currentQty);
                
                // ✅ التأكد من أن name هو string
                const finalName = typeof cleaned.name === 'string' 
                    ? cleaned.name.trim() 
                    : (cleaned.name && cleaned.name.name ? cleaned.name.name.trim() : String(cleaned.name || '').trim());
                
                if (!finalName) {
                    if (AppState.debugMode) {
                        Utils.safeWarn('⚠️ دواء بدون اسم بعد التنظيف (object):', medications, cleaned);
                    }
                    return [];
                }
                
                return [{
                    medicationName: finalName,
                    quantity: cleaned.quantity || currentQty || 1,
                    unit: medications.unit || 'وحدة',
                    notes: medications.notes || ''
                }];
            }
        }
        
        return [];
    },

    getVisitFactoryDisplayName(visit) {
        try {
            if (!visit || typeof visit !== 'object') return '-';
            if (visit.factoryName) return String(visit.factoryName);
            if (visit.factory) {
                const sites = this.getSiteOptions ? this.getSiteOptions() : [];
                const found = Array.isArray(sites) ? sites.find(s => s.id === visit.factory || s.name === visit.factory) : null;
                if (found && found.name) return String(found.name);
                return String(visit.factory);
            }
            return '-';
        } catch (e) {
            return '-';
        }
    },

    /**
     * إعادة تعيين جميع الفلاتر في سجل التردد
     */
    resetVisitFilters() {
        const searchInput = document.getElementById('visits-search');
        if (searchInput) searchInput.value = '';

        const factoryFilter = document.getElementById('visits-filter-factory');
        if (factoryFilter) factoryFilter.value = '';

        const positionFilter = document.getElementById('visits-filter-position');
        if (positionFilter) positionFilter.value = '';

        const workplaceFilter = document.getElementById('visits-filter-workplace');
        if (workplaceFilter) workplaceFilter.value = '';

        // إعادة تعيين الفلاتر في state
        this.state.filters = this.state.filters || {};
        this.state.filters.visits = { search: '', factory: '', position: '', workplace: '' };

        this.renderVisitsTab();
    },

    /**
     * تحديث قيم الفلاتر ديناميكياً لسجل التردد
     */
    updateVisitFilterOptions(visits) {
        if (!visits || !Array.isArray(visits)) return;
        
        // الحصول على الترجمات
        const { t } = this.getTranslations();
        
        const isContractorsTab = (this.state.activeVisitType || 'employees') === 'contractors';
        
        // جمع القيم الفريدة
        const factories = [...new Set(visits.map(v => {
            const factory = this.getVisitFactoryDisplayName(v);
            return factory && factory !== '-' ? factory : null;
        }).filter(Boolean))].sort();
        
        const positions = [...new Set(visits.map(v => {
            const position = isContractorsTab
                ? (v.contractorPosition || v.employeePosition || '')
                : (v.employeePosition || '');
            return position && position !== '-' ? position : null;
        }).filter(Boolean))].sort();
        
        const workplaces = [...new Set(visits.map(v => {
            const workplace = isContractorsTab
                ? (v.workArea || v.employeeLocation || '')
                : (v.employeeLocation || v.workArea || '');
            return workplace && workplace !== '-' ? workplace : null;
        }).filter(Boolean))].sort();
        
        // ✅ حفظ القيم المحددة حالياً من state أولاً، ثم من DOM كاحتياطي
        const visitFilters = (this.state && this.state.filters && this.state.filters.visits) 
            ? this.state.filters.visits 
            : { search: '', factory: '', position: '', workplace: '' };
        
        const currentFactory = visitFilters.factory || document.getElementById('visits-filter-factory')?.value || '';
        const currentPosition = visitFilters.position || document.getElementById('visits-filter-position')?.value || '';
        const currentWorkplace = visitFilters.workplace || document.getElementById('visits-filter-workplace')?.value || '';
        
        // تحديث قائمة المصانع
        const factoryFilter = document.getElementById('visits-filter-factory');
        if (factoryFilter) {
            factoryFilter.innerHTML = `<option value="">${t('filter.all')}</option>` +
                factories.map(f => `<option value="${Utils.escapeHTML(f)}" ${f === currentFactory ? 'selected' : ''}>${Utils.escapeHTML(f)}</option>`).join('');
        }
        
        // تحديث قائمة الوظائف
        const positionFilter = document.getElementById('visits-filter-position');
        if (positionFilter) {
            positionFilter.innerHTML = `<option value="">${t('filter.all')}</option>` +
                positions.map(p => `<option value="${Utils.escapeHTML(p)}" ${p === currentPosition ? 'selected' : ''}>${Utils.escapeHTML(p)}</option>`).join('');
        }
        
        // تحديث قائمة أماكن العمل
        const workplaceFilter = document.getElementById('visits-filter-workplace');
        if (workplaceFilter) {
            workplaceFilter.innerHTML = `<option value="">${t('filter.all')}</option>` +
                workplaces.map(w => `<option value="${Utils.escapeHTML(w)}" ${w === currentWorkplace ? 'selected' : ''}>${Utils.escapeHTML(w)}</option>`).join('');
        }
    },

    bindVisitsTabEvents(panel) {
        const addBtn = panel.querySelector('#visits-add-btn');
        const addNewBtn = panel.querySelector('#visits-add-new-btn');
        const refreshBtn = panel.querySelector('#visits-refresh-btn');
        const exportExcelBtn = panel.querySelector('#visits-export-excel-btn');
        const exportPdfBtn = panel.querySelector('#visits-export-pdf-btn');
        const searchInput = panel.querySelector('#visits-search');

        addBtn?.addEventListener('click', () => this.showVisitForm());
        addNewBtn?.addEventListener('click', () => this.showEnhancedVisitForm());
        refreshBtn?.addEventListener('click', () => {
            // ✅ إعادة تحميل قسري للبيانات
            this.renderVisitsTab(true);
            Notification.success('جاري تحديث البيانات...');
        });
        exportExcelBtn?.addEventListener('click', () => this.exportVisitsToExcel());
        exportPdfBtn?.addEventListener('click', () => this.exportVisitsToPDF());

        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                const value = (event.target.value || '').toString();
                // استخدام nullish coalescing للحفاظ على 0 كموضع صحيح للمؤشر
                const cursorPosition = (event.target.selectionStart !== null && event.target.selectionStart !== undefined) 
                    ? event.target.selectionStart 
                    : value.length;
                this.state.filters = this.state.filters || {};
                this.state.filters.visits = this.state.filters.visits || { search: '', factory: '', position: '', workplace: '' };
                this.state.filters.visits.search = value;
                // حفظ موضع المؤشر لاستعادته بعد إعادة الرسم
                this.state._searchCursorPosition = cursorPosition;
                this.state._shouldFocusSearch = true;
                this.renderVisitsTab();
            });
        }
        
        // معالجة فلاتر المصنع
        const factoryFilter = panel.querySelector('#visits-filter-factory');
        if (factoryFilter) {
            factoryFilter.addEventListener('change', () => {
                this.state.filters = this.state.filters || {};
                this.state.filters.visits = this.state.filters.visits || { search: '', factory: '', position: '', workplace: '' };
                this.state.filters.visits.factory = factoryFilter.value || '';
                this.scheduleVisitsTabRender(false, 50);
            });
        }
        
        // معالجة فلاتر الوظيفة
        const positionFilter = panel.querySelector('#visits-filter-position');
        if (positionFilter) {
            positionFilter.addEventListener('change', () => {
                this.state.filters = this.state.filters || {};
                this.state.filters.visits = this.state.filters.visits || { search: '', factory: '', position: '', workplace: '' };
                this.state.filters.visits.position = positionFilter.value || '';
                this.scheduleVisitsTabRender(false, 50);
            });
        }
        
        // معالجة فلاتر مكان العمل
        const workplaceFilter = panel.querySelector('#visits-filter-workplace');
        if (workplaceFilter) {
            workplaceFilter.addEventListener('change', () => {
                this.state.filters = this.state.filters || {};
                this.state.filters.visits = this.state.filters.visits || { search: '', factory: '', position: '', workplace: '' };
                this.state.filters.visits.workplace = workplaceFilter.value || '';
                this.scheduleVisitsTabRender(false, 50);
            });
        }
        
        // معالجة زر إعادة تعيين الفلاتر
        const resetFiltersBtn = panel.querySelector('#visits-reset-filters');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                this.resetVisitFilters();
            });
        }

        // معالجة نقر تبويبات الموظفين والمقاولين
        panel.querySelectorAll('.visit-type-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                try {
                    const visitType = tab.getAttribute('data-visit-type');
                    if (!visitType) {
                        Utils.safeWarn('⚠️ نوع التبويب غير محدد');
                        return;
                    }
                    this.state.activeVisitType = visitType;
                    this.scheduleVisitsTabRender(false, 30);
                } catch (error) {
                    Utils.safeError('❌ خطأ في تبديل التبويب:', error);
                    // محاولة إعادة عرض التبويب الحالي في حالة الخطأ
                    if (this.state && this.state.activeVisitType) {
                        try {
                            this.scheduleVisitsTabRender(false, 30);
                        } catch (retryError) {
                            Utils.safeError('❌ فشل إعادة عرض التبويب:', retryError);
                        }
                    }
                }
            });
        });

        // ✅ Fix: أزرار عرض/تعديل تُضاف عبر الرندر المُجزأ، لذا نستخدم Event Delegation مرة واحدة
        if (!panel.hasAttribute('data-visits-actions-delegation')) {
            panel.setAttribute('data-visits-actions-delegation', 'true');
            panel.addEventListener('click', (evt) => {
                try {
                    const btn = evt.target?.closest?.('[data-action="view-visit"],[data-action="edit-visit"]');
                    if (!btn) return;
                    const action = btn.getAttribute('data-action');
                    const visitId = btn.getAttribute('data-id');
                    if (!visitId) return;
                    const visit = (AppState.appData.clinicVisits || []).find(v => v.id === visitId);
                    if (!visit) return;
                    if (action === 'view-visit') {
                        this.viewVisitDetails(visit);
                    } else if (action === 'edit-visit') {
                        this.showVisitForm(visit);
                    }
                } catch (e) { /* ignore */ }
            }, { passive: true });
        }

        // تم نقل أزرار الحذف والطباعة إلى نموذج تفاصيل الزيارة
    },

    viewVisitDetails(visit) {
        if (!visit) return;
        
        // ✅ التأكد من وجود createdBy و updatedBy (للبيانات القديمة)
        if (!visit.createdBy) {
            visit.createdBy = null;
        }
        if (!visit.updatedBy) {
            visit.updatedBy = null;
        }

        const medicationsDisplay = visit.medications && Array.isArray(visit.medications) && visit.medications.length > 0
            ? visit.medications.map(med => `
                <div style="background: white; border: 2px solid #667eea; border-radius: 10px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600; color: #667eea;">${Utils.escapeHTML(med.medicationName || '')}</span>
                    <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">الكمية: ${med.quantity || 1}</span>
                </div>
            `).join('')
            : '<p style="color: #999; font-style: italic;">لا توجد أدوية منصرفة</p>';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1100px; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                <div class="modal-header modal-header-centered" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px 30px; border-radius: 20px 20px 0 0;">
                    <h2 class="modal-title" style="color: white; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-clipboard-list" style="font-size: 28px;"></i>
                        تفاصيل الزيارة
                    </h2>
                    <button class="modal-close" style="color: white; font-size: 24px; background: rgba(255,255,255,0.2); border-radius: 8px; padding: 8px 12px; transition: all 0.3s;" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body" style="padding: 30px; background: #f8f9fa;">
                    <div class="space-y-6">
                        <!-- قسم معلومات المريض -->
                        <div class="form-section" style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                            <h3 class="section-title" style="color: #667eea; font-size: 20px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-user-circle" style="font-size: 24px;"></i>
                                معلومات المريض
                            </h3>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #667eea;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #667eea; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-id-card"></i>
                                        الكود الوظيفي
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${Utils.escapeHTML(visit.employeeCode || visit.employeeNumber || '-')}</p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #667eea;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #667eea; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-user"></i>
                                        الاسم
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${Utils.escapeHTML(visit.employeeName || visit.contractorName || visit.externalName || '-')}</p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #667eea;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #667eea; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-briefcase"></i>
                                        الوظيفة
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${Utils.escapeHTML(visit.employeePosition || '-')}</p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #667eea;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #667eea; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-map-marker-alt"></i>
                                        مكان العمل
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${Utils.escapeHTML(visit.employeeLocation || visit.workArea || '-')}</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- قسم معلومات الزيارة -->
                        <div class="form-section" style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                            <h3 class="section-title" style="color: #fc6c85; font-size: 20px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-calendar-check" style="font-size: 24px;"></i>
                                معلومات الزيارة
                            </h3>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #fc6c85;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #fc6c85; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-clock"></i>
                                        وقت الدخول
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${visit.visitDate ? Utils.formatDateTime(visit.visitDate) : '-'}</p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #fc6c85;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #fc6c85; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-sign-out-alt"></i>
                                        وقت الخروج
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${visit.exitDate ? Utils.formatDateTime(visit.exitDate) : 'لم يتم تسجيله'}</p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #fc6c85;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #fc6c85; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-user-check"></i>
                                        تم التسجيل بواسطة
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${(() => {
                                        if (!visit.createdBy) return 'غير محدد';
                                        if (typeof visit.createdBy === 'object') {
                                            return Utils.escapeHTML(visit.createdBy.name || visit.createdBy.email || visit.createdBy.id || 'غير محدد');
                                        }
                                        const createdByStr = String(visit.createdBy).trim();
                                        // ✅ إصلاح جذري: إذا كان "النظام"، نحاول استخدام email من visit أو AppState.currentUser
                                        if (createdByStr === 'النظام' || createdByStr === '') {
                                            const emailFromVisit = (visit.email || '').toString().trim();
                                            if (emailFromVisit && emailFromVisit !== '') {
                                                return Utils.escapeHTML(emailFromVisit);
                                            }
                                            // محاولة استخدام AppState.currentUser.email كبديل
                                            const currentUserEmail = (AppState.currentUser?.email || '').toString().trim();
                                            if (currentUserEmail && currentUserEmail !== '') {
                                                return Utils.escapeHTML(currentUserEmail);
                                            }
                                            return 'غير محدد';
                                        }
                                        return Utils.escapeHTML(createdByStr);
                                    })()}</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- قسم التشخيص والعلاج -->
                        <div class="form-section" style="background: linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                            <h3 class="section-title" style="color: #4facfe; font-size: 20px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-stethoscope" style="font-size: 24px;"></i>
                                التشخيص والعلاج
                            </h3>
                            
                            <div class="space-y-4">
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #4facfe;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #4facfe; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-question-circle"></i>
                                        سبب الزيارة
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 500; margin: 0; line-height: 1.6;">${Utils.escapeHTML(visit.reason || '-')}</p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #4facfe;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #4facfe; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-diagnoses"></i>
                                        التشخيص
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 500; margin: 0; line-height: 1.6; white-space: pre-wrap;">${Utils.escapeHTML(visit.diagnosis || '-')}</p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #4facfe;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #4facfe; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-pills"></i>
                                        الإجراء / العلاج
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 500; margin: 0; line-height: 1.6; white-space: pre-wrap;">${Utils.escapeHTML(visit.treatment || '-')}</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- قسم الأدوية المنصرفة -->
                        ${visit.medications && Array.isArray(visit.medications) && visit.medications.length > 0 ? `
                        <div class="form-section" style="background: linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                            <h3 class="section-title" style="color: #009688; font-size: 20px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-prescription-bottle-alt" style="font-size: 24px;"></i>
                                الأدوية المنصرفة
                            </h3>
                            <div style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #009688;">
                                ${medicationsDisplay}
                            </div>
                        </div>
                        ` : ''}
                        ${visit.notes ? `
                        <div class="form-section" style="background: linear-gradient(135deg, #fff9c4 0%, #fff59d 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                            <h3 class="section-title" style="color: #F57F17; font-size: 20px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-sticky-note" style="font-size: 24px;"></i>
                                ملاحظات
                            </h3>
                            <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #F57F17;">
                                <p style="color: #1e293b; font-size: 16px; font-weight: 500; margin: 0; line-height: 1.6; white-space: pre-wrap;">${Utils.escapeHTML(visit.notes)}</p>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="modal-footer form-actions-centered" style="background: #f8f9fa; padding: 20px 30px; border-top: 1px solid #e2e8f0; border-radius: 0 0 20px 20px;">
                    <button class="btn-secondary" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; transition: all 0.3s; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times ml-2"></i>إغلاق
                    </button>
                    <button class="btn-success" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; transition: all 0.3s; box-shadow: 0 4px 15px 0 rgba(17, 153, 142, 0.4);" onclick="Clinic.exportVisitToPDF(${JSON.stringify(visit).replace(/"/g, '&quot;')});">
                        <i class="fas fa-file-pdf ml-2"></i>طباعة
                    </button>
                    ${this.isCurrentUserAdmin() ? `
                    <button class="btn-danger" style="background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; transition: all 0.3s; box-shadow: 0 4px 15px 0 rgba(235, 51, 73, 0.4);" onclick="if(confirm('هل أنت متأكد من حذف هذه الزيارة؟')) { Clinic.deleteVisit('${visit.id}'); this.closest('.modal-overlay').remove(); }">
                        <i class="fas fa-trash-alt ml-2"></i>حذف
                    </button>
                    ` : `
                    <button class="btn-warning" style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; transition: all 0.3s; box-shadow: 0 4px 15px 0 rgba(245, 158, 11, 0.4);" onclick="Clinic.requestVisitDeletion('${visit.id}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-paper-plane ml-2"></i>طلب حذف
                    </button>
                    `}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النافذة.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) modal.remove();
            }
        });
    },

    async deleteVisit(visitId) {
        if (!visitId) {
            Notification.error('معرف الزيارة غير صحيح');
            return;
        }

        // ✅ الحذف المباشر فقط للمدير — غير ذلك: طلب موافقة
        if (!this.isCurrentUserAdmin()) {
            await this.requestVisitDeletion(visitId);
            return;
        }

        const visit = (AppState.appData.clinicVisits || []).find(v => v.id === visitId);
        if (!visit) {
            Notification.error('الزيارة غير موجودة');
            return;
        }

        const employeeName = visit.employeeName || visit.contractorName || visit.externalName || 'غير محدد';
        const visitDate = visit.visitDate ? Utils.formatDateTime(visit.visitDate) : 'غير محدد';

        const confirmed = await Utils.confirmDialog(
            'حذف الزيارة',
            `هل أنت متأكد من حذف زيارة "${employeeName}" بتاريخ ${visitDate}؟\n\nهذا الإجراء لا يمكن التراجع عنه.`,
            'حذف',
            'إلغاء'
        );

        if (!confirmed) return;

        Loading.show('جاري حذف الزيارة...');

        try {
            // حذف فعلي من Backend باستخدام معرف الزيارة فقط (بدون إرسال كل سجل الزيارات)
            if (AppState.googleConfig?.appsScript?.enabled) {
                const deleteResult = await GoogleIntegration.sendRequest({
                    action: 'deleteClinicVisit',
                    data: { visitId: visitId }
                });
                if (!deleteResult || deleteResult.success !== true) {
                    throw new Error(deleteResult?.message || 'فشل حذف الزيارة من الخادم');
                }
            }

            // تحديث محلي بعد نجاح الحذف من الخادم
            AppState.appData.clinicVisits = (AppState.appData.clinicVisits || []).filter(v => v.id !== visitId);
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            Loading.hide();
            Notification.success('تم حذف الزيارة بنجاح');

            // تحديث الواجهة
            this.renderVisitsTab();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ أثناء حذف الزيارة: ' + error.message);
            Utils.safeError('خطأ في حذف الزيارة:', error);
        }
    },

    async requestVisitDeletion(visitId) {
        try {
            if (!visitId) {
                Notification.error('معرف الزيارة غير صحيح');
                return;
            }

            const visit = (AppState.appData.clinicVisits || []).find(v => v.id === visitId);
            if (!visit) {
                Notification.error('الزيارة غير موجودة');
                return;
            }

            const isEnabled = AppState?.googleConfig?.appsScript?.enabled && AppState?.googleConfig?.appsScript?.scriptUrl;
            if (!isEnabled || typeof GoogleIntegration === 'undefined' || !GoogleIntegration.sendRequest) {
                Notification.error('تعذر إرسال طلب الحذف (الخادم غير متاح)');
                return;
            }

            const requestedBy = {
                id: AppState.currentUser?.id || '',
                name: AppState.currentUser?.name || '',
                email: AppState.currentUser?.email || '',
                role: AppState.currentUser?.role || ''
            };

            Loading.show('جاري إرسال طلب حذف الزيارة...');
            const result = await GoogleIntegration.sendRequest({
                action: 'addClinicVisitDeletionRequest',
                data: {
                    visitId: visitId,
                    visitData: visit,
                    requestedBy: requestedBy
                }
            });
            Loading.hide();

            if (!result || result.success !== true) {
                throw new Error(result?.message || 'فشل إرسال طلب الحذف');
            }

            // ✅ تحديث محلي سريع
            try {
                AppState.appData.clinicVisitDeletionRequests = Array.isArray(AppState.appData.clinicVisitDeletionRequests)
                    ? AppState.appData.clinicVisitDeletionRequests
                    : [];
                if (result.data) {
                    AppState.appData.clinicVisitDeletionRequests.unshift({ ...result.data, requestType: 'visit' });
                }
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }
            } catch (e) { /* ignore */ }

            Notification.success('تم إرسال طلب حذف الزيارة إلى مدير النظام');
        } catch (error) {
            try { Loading.hide(); } catch (e) {}
            Utils.safeError('خطأ في إرسال طلب حذف الزيارة:', error);
            Notification.error('فشل إرسال طلب الحذف: ' + (error.message || 'حدث خطأ'));
        }
    },

    getMedicationRowClass(status) {
        if (status === 'منتهي') {
            return 'bg-red-50';
        }
        if (status === 'قريب الانتهاء') {
            return 'bg-yellow-50';
        }
        return 'bg-green-50';
    },

    ensureData() {
        if (typeof AppState === 'undefined') return;
        AppState.appData = AppState.appData || {};
        const data = AppState.appData;

        if (!Array.isArray(data.clinicVisits)) data.clinicVisits = [];
        if (!Array.isArray(data.clinicInventory)) data.clinicInventory = [];
        if (!Array.isArray(data.clinicMedications)) {
            data.clinicMedications = Array.isArray(data.clinicInventory) ? data.clinicInventory : [];
        }
        if (!Array.isArray(data.sickLeave)) data.sickLeave = [];
        if (!Array.isArray(data.injuries)) data.injuries = [];
        if (!Array.isArray(data.clinicSupplyRequests)) data.clinicSupplyRequests = [];

        // ✅ تطبيع بيانات الزيارات لضمان صحة بيانات الأدوية
        let visitsChanged = false;
        data.clinicVisits = data.clinicVisits.map((visit) => {
            if (!visit || typeof visit !== 'object') return visit;
            
            // توحيد النوع: النظام يدعم موظف/مقاول فقط
            if (String(visit.personType || '').toLowerCase().trim() === 'external') {
                visit.personType = 'contractor';
                visitsChanged = true;
            }
            // التأكد من وجود personType
            if (!visit.personType) {
                if (visit.contractorName || visit.contractorWorkerName || visit.externalName) {
                    visit.personType = 'contractor';
                } else {
                    visit.personType = 'employee';
                }
                visitsChanged = true;
            }
            
            // ✅ تطبيع الأدوية للتأكد من صحة البيانات
            let normalizedMeds = [];
            
            // أولاً: محاولة من medications
            if (visit.medications) {
                normalizedMeds = this.normalizeVisitMedications(visit.medications);
            }
            
            // ثانياً: إذا كانت medications فارغة أو غير صالحة، نحاول من medicationsDispensed
            if ((!normalizedMeds || normalizedMeds.length === 0) && visit.medicationsDispensed) {
                const medsFromText = this.normalizeVisitMedications(visit.medicationsDispensed);
                if (medsFromText && medsFromText.length > 0) {
                    normalizedMeds = medsFromText;
                    if (AppState.debugMode) {
                        Utils.safeLog(`✅ تم تحويل medicationsDispensed في ensureData لزيارة ${visit.id || 'غير محدد'}:`, medsFromText.length, 'دواء');
                    }
                }
            }
            
            // ثالثاً: إذا كان medicationsDispensedQty موجوداً ولكن لا توجد قائمة أدوية، نستخدمه
            if ((!normalizedMeds || normalizedMeds.length === 0) && visit.medicationsDispensedQty && visit.medicationsDispensedQty > 0) {
                const totalQty = parseInt(visit.medicationsDispensedQty, 10) || 0;
                if (totalQty > 0) {
                    normalizedMeds = [{
                        medicationName: visit.medicationsDispensed || 'دواء غير محدد',
                        quantity: totalQty,
                        unit: 'وحدة',
                        notes: ''
                    }];
                    if (AppState.debugMode) {
                        Utils.safeLog(`✅ تم إنشاء سجل دواء من medicationsDispensedQty في ensureData لزيارة ${visit.id || 'غير محدد'}:`, totalQty);
                    }
                }
            }
            
            // التأكد من أن medications محدثة بالبيانات المطبعة (حتى لو كانت فارغة)
            if (!normalizedMeds) normalizedMeds = [];
            const currentMeds = Array.isArray(visit.medications) ? visit.medications : [];
            const currentMedsStr = JSON.stringify(currentMeds.sort((a, b) => (a.medicationName || '').localeCompare(b.medicationName || '')));
            const normalizedMedsStr = JSON.stringify(normalizedMeds.sort((a, b) => (a.medicationName || '').localeCompare(b.medicationName || '')));
            if (currentMedsStr !== normalizedMedsStr) {
                visit.medications = normalizedMeds;
                visitsChanged = true;
                if (AppState.debugMode && normalizedMeds.length > 0) {
                    Utils.safeLog(`✅ تم تحديث medications في ensureData لزيارة ${visit.id || 'غير محدد'}:`, normalizedMeds.length, 'دواء');
                }
            }
            
            // ✅ إصلاح: تطبيع visitDate و exitDate للتعامل مع البيانات القديمة
            if (visit.visitDate) {
                const visitDateStr = String(visit.visitDate).trim();
                // إذا كانت بصيغة yyyy-MM-dd فقط (10 أحرف)، نضيف وقت افتراضي
                if (visitDateStr.length === 10 && visitDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const dateOnly = new Date(visitDateStr + 'T00:00:00');
                    visit.visitDate = dateOnly.toISOString();
                    visitsChanged = true;
                } else if (!visitDateStr.includes('T') && !visitDateStr.includes('Z')) {
                    try {
                        const parsed = new Date(visitDateStr);
                        if (!isNaN(parsed.getTime())) {
                            visit.visitDate = parsed.toISOString();
                            visitsChanged = true;
                        }
                    } catch (e) {
                        // تجاهل الأخطاء
                    }
                }
            }
            
            if (visit.exitDate) {
                const exitDateStr = String(visit.exitDate).trim();
                // إذا كانت بصيغة yyyy-MM-dd فقط (10 أحرف)، نضيف وقت افتراضي
                if (exitDateStr.length === 10 && exitDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const dateOnly = new Date(exitDateStr + 'T00:00:00');
                    visit.exitDate = dateOnly.toISOString();
                    visitsChanged = true;
                } else if (!exitDateStr.includes('T') && !exitDateStr.includes('Z')) {
                    try {
                        const parsed = new Date(exitDateStr);
                        if (!isNaN(parsed.getTime())) {
                            visit.exitDate = parsed.toISOString();
                            visitsChanged = true;
                        }
                    } catch (e) {
                        // تجاهل الأخطاء
                    }
                }
            }
            
            return visit;
        });

        let medicationsChanged = false;
        data.clinicMedications = data.clinicMedications.map((item) => {
            const normalized = this.normalizeMedicationRecord(item);
            const statusInfo = this.calculateMedicationStatus(normalized);
            const qtyChanged =
                (item && (item.quantityAdded !== normalized.quantityAdded || item.remainingQuantity !== normalized.remainingQuantity)) ||
                (typeof item?.quantityAdded !== 'number') ||
                (typeof item?.remainingQuantity !== 'number');

            if (normalized.status !== statusInfo.status ||
                normalized.daysRemaining !== statusInfo.daysRemaining ||
                qtyChanged) {
                medicationsChanged = true;
                normalized.status = statusInfo.status;
                normalized.daysRemaining = statusInfo.daysRemaining;
            }
            return normalized;
        });
        data.clinicInventory = data.clinicMedications;
        data.sickLeave = data.sickLeave.map((item) => this.normalizeSickLeaveRecord(item));
        data.injuries = data.injuries.map((item) => this.normalizeInjuryRecord(item));

        AppState.appData = data;
        
        // ✅ حفظ البيانات في جميع الحالات لضمان عدم فقدانها
        // (مثل تبويب الأدوية - نحفظ دائماً بعد ensureData)
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            try {
                window.DataManager.save();
                if (AppState.debugMode && (medicationsChanged || visitsChanged)) {
                    Utils.safeLog(`✅ تم حفظ بيانات العيادة محلياً في ensureData (medicationsChanged: ${medicationsChanged}, visitsChanged: ${visitsChanged})`);
                }
            } catch (error) {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ تعذر حفظ البيانات محلياً في ensureData:', error.message);
                }
            }
            } else {
            if (AppState.debugMode) {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }
        }
    },

    ensureFilterDefaults() {
        if (!this.state) {
            this.state = {
                activeTab: 'medications',
                filters: {}
            };
        }

        if (!this.state.activeTab) {
            this.state.activeTab = 'medications';
        }

        const defaultFilters = {
            medications: { search: '', status: 'all', dateFrom: '', dateTo: '' },
            visits: { search: '', factory: '', position: '', workplace: '' },
            sickLeave: { search: '', department: '', dateFrom: '', dateTo: '' },
            injuries: { search: '', status: 'all', department: '', dateFrom: '', dateTo: '' }
        };

        this.state.filters = this.state.filters || {};

        Object.keys(defaultFilters).forEach((key) => {
            // ✅ إصلاح: دمج الفلاتر بشكل صحيح للحفاظ على القيم المحددة
            const existingFilter = this.state.filters[key] || {};
            this.state.filters[key] = Object.assign({}, defaultFilters[key], existingFilter);
        });

        if (!Array.isArray(this.state.currentInjuryAttachments)) {
            this.state.currentInjuryAttachments = [];
        }
    },

    getCurrentUserSummary(fallback = null) {
        if (fallback && typeof fallback === 'object' && (fallback.name || fallback.id)) {
            return fallback;
        }
        if (!AppState.currentUser) {
            if (AppState.debugMode) {
                Utils.safeWarn('⚠️ AppState.currentUser غير موجود - إرجاع النظام');
            }
            return {
                id: '',
                name: 'النظام',
                email: '',
                role: ''
            };
        }
        
        // ✅ التأكد من أن name موجود، وإلا نستخدم email أو id
        const name = (AppState.currentUser.name || AppState.currentUser.displayName || '').toString().trim();
        const email = (AppState.currentUser.email || '').toString().trim();
        const id = (AppState.currentUser.id || '').toString().trim();
        
        // ✅ Debug logging
        if (AppState.debugMode) {
            Utils.safeLog('🔍 getCurrentUserSummary - name:', name, 'email:', email, 'id:', id);
        }
        
        // نستخدم name أولاً، ثم email، ثم id، ثم 'النظام' كحل أخير
        const finalName = name || email || id || 'النظام';
        
        if (AppState.debugMode && finalName === 'النظام') {
            Utils.safeWarn('⚠️ تحذير: getCurrentUserSummary يعيد "النظام" - AppState.currentUser:', AppState.currentUser);
        }
        
        return {
            id: id,
            name: finalName,
            email: email,
            role: (AppState.currentUser.role || '').toString().trim()
        };
    },

    getMonthlyVisits() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return AppState.appData.clinicVisits.filter(v => {
            const visitDate = new Date(v.visitDate || v.createdAt);
            return visitDate >= startOfMonth;
        }).length;
    },

    calculateTotalTime(visitDate, exitDate) {
        if (!visitDate || !exitDate) return '-';
        try {
            // تحويل التواريخ إلى كائنات Date
            const entry = visitDate instanceof Date ? visitDate : new Date(visitDate);
            const exit = exitDate instanceof Date ? exitDate : new Date(exitDate);

            // التحقق من صحة التواريخ
            if (isNaN(entry.getTime()) || isNaN(exit.getTime())) {
                return '-';
            }

            // حساب الفرق بالمللي ثانية
            const diffMs = exit.getTime() - entry.getTime();

            // التحقق من أن الفرق موجب
            if (diffMs < 0) {
                return '-';
            }

            // حساب الساعات والدقائق
            const totalMinutes = Math.floor(diffMs / (1000 * 60));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            // إرجاع النتيجة بصيغة مناسبة
            if (hours > 0 && minutes > 0) {
                return `${hours} ساعة ${minutes} دقيقة`;
            } else if (hours > 0) {
                return `${hours} ساعة`;
            } else if (minutes > 0) {
                return `${minutes} دقيقة`;
            } else {
                return 'أقل من دقيقة';
            }
        } catch (e) {
            Utils.safeError('خطأ في حساب الوقت:', e, { visitDate, exitDate });
            return '-';
        }
    },

    async renderVisitsList() {
        const visits = AppState.appData.clinicVisits.slice(-10).reverse();
        if (visits.length === 0) {
            return '<div class="empty-state"><p class="text-gray-500">لا توجد زيارات مسجلة</p></div>';
        }
        return `
            <div class="mb-4 flex gap-2 justify-end">
                <button onclick="Clinic.printVisitsList()" class="btn-secondary">
                    <i class="fas fa-print ml-2"></i>طباعة
                </button>
                <button onclick="Clinic.exportVisitsToPDF()" class="btn-secondary">
                    <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الكود الوظيفي</th>
                            <th>الاسم</th>
                            <th>الوظيفة</th>
                            <th>مكان العمل</th>
                            <th>وقت الدخول</th>
                            <th>وقت الخروج</th>
                            <th>اجمالي الوقت</th>
                            <th>السبب</th>
                            <th>التشخيص</th>
                            <th>الاجراء</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${visits.map(visit => {
            const employeeCode = visit.employeeCode || visit.employeeNumber || '-';
            const employeeName = visit.employeeName || visit.contractorName || visit.externalName || '';
            const workerName = visit.contractorWorkerName ? ` (${Utils.escapeHTML(visit.contractorWorkerName)})` : '';
            const position = visit.employeePosition || '-';
            const location = visit.employeeLocation || visit.workArea || '-';
            const entryTime = visit.visitDate ? Utils.escapeHTML(Utils.formatDateTime(visit.visitDate)) : '-';
            const exitTime = visit.exitDate ? Utils.escapeHTML(Utils.formatDateTime(visit.exitDate)) : '<span class="text-xs text-gray-500">لم يتم تسجيله</span>';
            const totalTime = Clinic.calculateTotalTime(visit.visitDate, visit.exitDate);
            const reason = Utils.escapeHTML(visit.reason || '');
            const diagnosis = Utils.escapeHTML(visit.diagnosis || '');
            const procedure = Utils.escapeHTML(visit.treatment || '');

            return `
                                <tr>
                                    <td>${Utils.escapeHTML(employeeCode)}</td>
                                    <td>
                                        <div class="font-medium text-gray-900">${Utils.escapeHTML(employeeName)}${workerName}</div>
                                    </td>
                                    <td>${Utils.escapeHTML(position)}</td>
                                    <td>${Utils.escapeHTML(location)}</td>
                                    <td>${entryTime}</td>
                                    <td>${exitTime}</td>
                                    <td>${totalTime}</td>
                                    <td>${reason}</td>
                                    <td>${diagnosis}</td>
                                    <td>${procedure}</td>
                                    <td>
                                        <button onclick="Clinic.viewVisit('${visit.id}')" class="btn-icon btn-icon-primary">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    setupEventListeners() {
        setTimeout(() => {
            const addVisitBtn = document.getElementById('add-visit-btn');
            if (addVisitBtn) addVisitBtn.addEventListener('click', () => this.showVisitForm());
        }, 100);
    },

    /**
     * تحميل قائمة المقاولين في select
     */
    loadContractorsIntoSelect(selectElement) {
        if (!selectElement) return;

        // ✅ دعم 2 نمط: select قديم أو input(list=datalist) جديد
        const tag = (selectElement.tagName || '').toLowerCase();
        const currentValue = (selectElement.value || '').toString();

        // النمط الجديد (input + datalist)
        if (tag === 'input') {
            const listId = selectElement.getAttribute('list');
            const datalist = listId ? document.getElementById(listId) : null;
            if (!datalist) return;

            // مصدر البيانات: من موديول Contractors إن وجد، أو fallback من AppState
            let names = [];
            try {
                if (typeof Contractors !== 'undefined' && typeof Contractors.getAllContractorsForModules === 'function') {
                    names = (Contractors.getAllContractorsForModules() || [])
                        .map(c => (c && (c.name || c.companyName)) ? String(c.name || c.companyName).trim() : '')
                        .filter(Boolean);
                } else if (Array.isArray(AppState.appData?.approvedContractors)) {
                    names = AppState.appData.approvedContractors
                        .filter(c => c && c.isActive !== 'inactive' && c.isActive !== false && c.isActive !== 'false' && c.isActive !== 'FALSE')
                        .map(c => (c && (c.companyName || c.name)) ? String(c.companyName || c.name).trim() : '')
                        .filter(Boolean);
                } else if (Array.isArray(AppState.appData?.contractors)) {
                    names = AppState.appData.contractors
                        .filter(c => c && c.isActive !== 'inactive' && c.isActive !== false && c.isActive !== 'false' && c.isActive !== 'FALSE')
                        .map(c => (c && (c.name || c.companyName)) ? String(c.name || c.companyName).trim() : '')
                        .filter(Boolean);
                }
            } catch (e) { /* ignore */ }

            // إزالة تكرار + ترتيب بسيط
            const seen = new Set();
            const unique = [];
            names.forEach(n => {
                const key = n.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                unique.push(n);
            });

            datalist.innerHTML = unique.map(n => `<option value="${Utils.escapeHTML(n)}"></option>`).join('');
            // ✅ إلزام الاختيار من القائمة فقط (منع إدخال قيمة غير موجودة)
            try {
                selectElement.dataset.allowedValues = JSON.stringify(unique.map(v => String(v || '').toLowerCase().trim()).filter(Boolean));
            } catch (e) { /* ignore */ }

            if (currentValue) selectElement.value = currentValue;

            if (!selectElement.hasAttribute('data-contractor-change-attached')) {
                selectElement.setAttribute('data-contractor-change-attached', 'true');
                selectElement.addEventListener('input', () => {
                    const nameInput = document.getElementById('visit-employee-name');
                    if (nameInput && selectElement.value) {
                        nameInput.value = selectElement.value;
                    }
                });
                selectElement.addEventListener('blur', () => {
                    try {
                        const raw = (selectElement.value || '').toString().trim();
                        if (!raw) return;
                        const allowed = (() => {
                            try { return JSON.parse(selectElement.dataset.allowedValues || '[]'); } catch (e) { return []; }
                        })();
                        const ok = allowed.includes(raw.toLowerCase().trim());
                        if (!ok) {
                            selectElement.value = '';
                            const nameInput = document.getElementById('visit-employee-name');
                            if (nameInput) nameInput.value = '';
                            Notification?.warning?.('يرجى اختيار اسم المقاول من القائمة فقط');
                        }
                    } catch (e) { /* ignore */ }
                });
            }
            return;
        }

        // النمط القديم (select)
        if (typeof Contractors !== 'undefined' && typeof Contractors.populateContractorSelect === 'function') {
            Contractors.populateContractorSelect(selectElement, {
                placeholder: '-- اختر المقاول --',
                selectedValue: currentValue,
                valueMode: 'name',
                showServiceType: true,
                includeSuppliers: false
            });
        }

        if (currentValue) selectElement.value = currentValue;

        if (!selectElement.hasAttribute('data-contractor-change-attached')) {
            selectElement.setAttribute('data-contractor-change-attached', 'true');
            selectElement.addEventListener('change', () => {
                const nameInput = document.getElementById('visit-employee-name');
                if (nameInput && selectElement.value) {
                    nameInput.value = selectElement.value;
                }
            });
        }
    },

    handlePersonTypeChange() {
        const personTypeEl = document.getElementById('visit-person-type');
        if (!personTypeEl) return;
        const personType = personTypeEl.value;
        const codeContainer = document.getElementById('visit-employee-code-container');
        const codeInput = document.getElementById('visit-employee-code');
        const nameInput = document.getElementById('visit-employee-name');
        const nameLabel = document.getElementById('visit-employee-name-label');
        const positionContainer = document.getElementById('visit-employee-position-container');
        const departmentContainer = document.getElementById('visit-employee-department-container');
        const locationContainer = document.getElementById('visit-employee-location-container');
        const locationInput = document.getElementById('visit-employee-location');
        const contractorWorkerContainer = document.getElementById('visit-contractor-worker-container');
        const contractorWorkerInput = document.getElementById('visit-contractor-worker');
        const contractorWorkerLabel = document.getElementById('visit-contractor-worker-label');
        const contractorPositionContainer = document.getElementById('visit-contractor-position-container');
        const contractorPositionInput = document.getElementById('visit-contractor-position');
        const factoryContainer = document.getElementById('visit-factory-container');
        const factorySelect = document.getElementById('visit-factory');
        const contractorFactoryContainer = document.getElementById('visit-contractor-factory-container');
        const contractorFactorySelect = document.getElementById('visit-contractor-factory');
        const workAreaContainer = document.getElementById('visit-work-area-container');
        const workAreaInput = document.getElementById('visit-work-area');

        // إظهار/إخفاء حقل الكود الوظيفي قط عند اختيار موظف
        if (codeContainer) {
            codeContainer.style.display = personType === 'employee' ? 'block' : 'none';
        }

        // تفعيل/تعطيل حقل الكود الوظيفي
        if (codeInput) {
            if (personType === 'employee') {
                codeInput.disabled = false;
                codeInput.required = true;
                codeInput.placeholder = 'أدخل الكود الوظيفي (سيتم تعبئة البيانات تلقائياً)';
            } else {
                codeInput.disabled = true;
                codeInput.required = false;
                codeInput.value = '';
                codeInput.placeholder = '';
            }
        }

        // إظهار/إخفاء حقول الوظية والإدارة وموقع العمل قط عند اختيار موظ
        if (positionContainer) {
            positionContainer.style.display = personType === 'employee' ? 'block' : 'none';
        }
        if (departmentContainer) {
            departmentContainer.style.display = personType === 'employee' ? 'block' : 'none';
        }
        if (locationContainer) {
            locationContainer.style.display = personType === 'employee' ? 'block' : 'none';
        }
        if (contractorWorkerContainer) {
            contractorWorkerContainer.style.display = personType === 'contractor' || personType === 'external' ? 'block' : 'none';
        }
        if (contractorPositionContainer) {
            contractorPositionContainer.style.display = personType === 'contractor' || personType === 'external' ? 'block' : 'none';
        }
        if (factoryContainer) {
            factoryContainer.style.display = personType === 'employee' ? 'block' : 'none';
        }
        if (contractorFactoryContainer) {
            contractorFactoryContainer.style.display = personType === 'contractor' || personType === 'external' ? 'block' : 'none';
        }
        if (workAreaContainer) {
            workAreaContainer.style.display = personType === 'contractor' || personType === 'external' ? 'block' : 'none';
        }

        // تحديث نص التسمية
        if (nameLabel) {
            nameLabel.textContent = `اسم ${personType === 'employee' ? 'الموظف' : personType === 'contractor' ? 'المقاول' : 'الجهة'} *`;
        }

        // التعامل مع حقل الاسم - عند موظف: input readonly، عند مقاول: select من قائمة المقاولين، عند عمالة خارجية: input يدوي
        const contractorNameSelect = document.getElementById('visit-contractor-name-select');

        if (personType === 'employee') {
            if (nameInput) {
                nameInput.readOnly = true;
                nameInput.placeholder = 'سيتم التعبئة تلقائياً';
                nameInput.value = '';
                nameInput.style.display = 'block';
                nameInput.required = true;
            }
            if (contractorNameSelect) {
                contractorNameSelect.style.display = 'none';
                contractorNameSelect.required = false;
            }
        } else if (personType === 'contractor') {
            // إظهار select المقاولين وإخفاء input
            if (nameInput) {
                nameInput.style.display = 'none';
                nameInput.required = false;
                nameInput.value = '';
            }
            if (contractorNameSelect) {
                contractorNameSelect.style.display = 'block';
                contractorNameSelect.required = true;

                // ملء قائمة المقاولين
                Clinic.loadContractorsIntoSelect(contractorNameSelect);
            }
        } else {
            // عمالة خارجية - input يدوي
            if (nameInput) {
                nameInput.readOnly = false;
                nameInput.placeholder = 'أدخل اسم الجهة أو الشركة الخارجية';
                nameInput.value = '';
                nameInput.style.display = 'block';
                nameInput.required = true;
            }
            if (contractorNameSelect) {
                contractorNameSelect.style.display = 'none';
                contractorNameSelect.required = false;
            }
        }

        // مسح الحقول التلقائية عند تغيير النوع
        const positionInput = document.getElementById('visit-employee-position');
        const departmentInput = document.getElementById('visit-employee-department');

        if (locationInput) {
            locationInput.required = personType === 'employee';
            if (personType !== 'employee') {
                locationInput.value = '';
            }
        }

        if (contractorWorkerInput) {
            if (personType === 'contractor' || personType === 'external') {
                contractorWorkerInput.required = true;
                contractorWorkerInput.placeholder = personType === 'contractor'
                    ? 'أدخل اسم الموظف التابع للمقاول'
                    : 'أدخل اسم العامل الخارجي';
            } else {
                contractorWorkerInput.required = false;
                contractorWorkerInput.value = '';
                contractorWorkerInput.placeholder = '';
            }
        }

        if (contractorWorkerLabel) {
            contractorWorkerLabel.textContent = personType === 'contractor'
                ? 'اسم الموظف التابع للمقاول *'
                : personType === 'external'
                    ? 'اسم العامل الخارجي *'
                    : 'اسم الموظف التابع';
        }

        if (contractorPositionInput) {
            if (personType === 'contractor' || personType === 'external') {
                contractorPositionInput.required = true;
                contractorPositionInput.placeholder = 'أدخل الوظيفة يدوياً';
            } else {
                contractorPositionInput.required = false;
                contractorPositionInput.value = '';
                contractorPositionInput.placeholder = '';
            }
        }

        if (workAreaInput) {
            workAreaInput.required = personType === 'contractor' || personType === 'external';
            if (personType === 'contractor' || personType === 'external') {
                workAreaInput.placeholder = 'حدد موقع أو منطقة العمل الحالية';
            } else {
                workAreaInput.placeholder = '';
                workAreaInput.value = '';
            }
        }

        if (positionInput) positionInput.value = '';
        if (departmentInput) departmentInput.value = '';

        // فتح البحث بالكود الوظيفي فقط عند اختيار موظف
        if (personType === 'employee' && typeof EmployeeHelper !== 'undefined' && codeInput) {
            // إزالة المعالجات القديمة
            const newCodeInput = codeInput.cloneNode(true);
            codeInput.parentNode.replaceChild(newCodeInput, codeInput);

            // تفعيل البحث بالكود الوظيفي — تحذير «لم يتم العثور» فقط عند Enter؛ الرسائل تُعرض أعلى النموذج
            EmployeeHelper.setupEmployeeCodeSearch('visit-employee-code', 'visit-employee-name', (employee) => {
                if (employee) {
                    const nameField = document.getElementById('visit-employee-name');
                    const positionField = document.getElementById('visit-employee-position');
                    const departmentField = document.getElementById('visit-employee-department');

                    if (nameField) nameField.value = employee.name || '';
                    if (positionField) positionField.value = employee.position || '';
                    if (departmentField) departmentField.value = employee.department || '';

                    // تحميل سجل الزيارات السابقة
                    const historyTableBody = document.getElementById('visit-history-tbody');
                    if (historyTableBody) {
                        const code = document.getElementById('visit-employee-code')?.value.trim();
                        if (code) {
                            const visits = (AppState.appData.clinicVisits || []).filter(v =>
                                v.personType === 'employee' &&
                                (v.employeeCode === code || v.employeeNumber === code)
                            ).sort((a, b) => new Date(b.visitDate || b.createdAt) - new Date(a.visitDate || a.createdAt)).slice(0, 10);

                            if (visits.length === 0) {
                                historyTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">لا توجد زيارات سابقة</td></tr>';
                            } else {
                                historyTableBody.innerHTML = visits.map(v => `
                                    <tr>
                                        <td>${v.visitDate ? Utils.escapeHTML(Utils.formatDateTime(v.visitDate)) : '-'}</td>
                                        <td>${v.exitDate ? Utils.escapeHTML(Utils.formatDateTime(v.exitDate)) : '-'}</td>
                                        <td>${Utils.escapeHTML(v.reason || '-')}</td>
                                        <td>${Utils.escapeHTML(v.diagnosis || '-')}</td>
                                        <td>${Utils.escapeHTML(v.treatment || '-')}</td>
                                        <td>${Utils.escapeHTML(v.employeeLocation || v.workArea || '-')}</td>
                                    </tr>
                                `).join('');
                            }
                        }
                    }
                }
            }, {
                inlineAlertId: 'visit-form-alerts',
                employeeNotFoundWarn: 'enter'
            });
        }
    },

    /** رسائل خطأ/تنبيه أعلى نموذج تسجيل الزيارة */
    showVisitFormAlert(message, type = 'error') {
        const el = document.getElementById('visit-form-alerts');
        if (!el || message == null || String(message).trim() === '') return;
        el.style.display = 'block';
        const border = type === 'error'
            ? 'border-red-300 bg-red-50 text-red-900'
            : 'border-amber-300 bg-amber-50 text-amber-950';
        el.innerHTML = `<div class="rounded-lg border ${border} px-3 py-2 text-sm text-right shadow-sm" role="alert">${Utils.escapeHTML(String(message))}</div>`;
        try {
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (e) { /* ignore */ }
    },

    clearVisitFormAlert() {
        const el = document.getElementById('visit-form-alerts');
        if (el) {
            el.innerHTML = '';
            el.style.display = 'none';
        }
    },

    async showSickLeaveForm(record = null) {
        this.ensureData();
        const isEdit = !!record;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        const personType = record?.personType || 'employee';
        const startDateValue = record?.startDate ? new Date(record.startDate).toISOString().slice(0, 10) : '';
        const endDateValue = record?.endDate ? new Date(record.endDate).toISOString().slice(0, 10) : '';
        const employeeName = record?.employeeName || record?.personName || '';
        const department = record?.employeeDepartment || record?.department || '';
        const position = record?.employeePosition || record?.position || '';
        const employeeCode = record?.employeeCode || record?.employeeNumber || '';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 860px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">${isEdit ? 'تعديل إجازة مرضية' : 'تسجيل إجازة مرضية جديدة'}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="sick-leave-form" class="space-y-5">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="sick-leave-person-type" class="block text-sm font-semibold text-gray-700 mb-2">نوع الشخص *</label>
                                <select id="sick-leave-person-type" required class="form-input">
                                    <option value="employee" ${personType === 'employee' ? 'selected' : ''}>موظف</option>
                                    <option value="contractor" ${personType === 'contractor' ? 'selected' : ''}>مقاول</option>
                                    <option value="external" ${personType === 'external' ? 'selected' : ''}>عمالة خارجية</option>
                                </select>
                            </div>
                            <div id="sick-leave-code-container">
                                <label for="sick-leave-employee-code" class="block text-sm font-semibold text-gray-700 mb-2">الكود الوظيفي</label>
                                <input type="text" id="sick-leave-employee-code" class="form-input" value="${Utils.escapeHTML(employeeCode)}"
                                    placeholder="أدخل الكود الوظيفي">
                            </div>
                            <div>
                                <label for="sick-leave-name" class="block text-sm font-semibold text-gray-700 mb-2" id="sick-leave-name-label">اسم الموظف *</label>
                                <div class="relative">
                                    <input type="text" id="sick-leave-name" required class="form-input" value="${Utils.escapeHTML(employeeName)}" placeholder="سيتم تعبئة الاسم تلقائياً">
                                    <div id="sick-leave-dropdown" class="hse-lookup-dropdown absolute z-50 hidden w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"></div>
                                </div>
                            </div>
                            <div id="sick-leave-position-container">
                                <label for="sick-leave-position" class="block text-sm font-semibold text-gray-700 mb-2">الوظيفة</label>
                                <input type="text" id="sick-leave-position" class="form-input" value="${Utils.escapeHTML(position)}" placeholder="سيتم تعبئة الوظيفة تلقائياً">
                            </div>
                            <div id="sick-leave-department-container">
                                <label for="sick-leave-department" class="block text-sm font-semibold text-gray-700 mb-2">القسم / الإدارة</label>
                                <input type="text" id="sick-leave-department" class="form-input" value="${Utils.escapeHTML(department)}" placeholder="سيتم تعبئة القسم تلقائياً">
                            </div>
                            <div>
                                <label for="sick-leave-start-date" class="block text-sm font-semibold text-gray-700 mb-2">تاريخ بداية الإجازة *</label>
                                <input type="date" id="sick-leave-start-date" required class="form-input" value="${startDateValue}">
                            </div>
                            <div>
                                <label for="sick-leave-end-date" class="block text-sm font-semibold text-gray-700 mb-2">تاريخ نهاية الإجازة *</label>
                                <input type="date" id="sick-leave-end-date" required class="form-input" value="${endDateValue}">
                            </div>
                            <div class="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex flex-col justify-center">
                                <span class="text-sm font-semibold text-blue-700">عدد الأيام</span>
                                <span id="sick-leave-days" class="text-xl font-bold text-blue-800 mt-2">${record?.daysCount ? `${record.daysCount} يوم` : '—'}</span>
                            </div>
                            <div>
                                <label for="sick-leave-doctor" class="block text-sm font-semibold text-gray-700 mb-2">الطبيب المعالج</label>
                                <input type="text" id="sick-leave-doctor" class="form-input" placeholder="اسم الطبيب المعالج" value="${Utils.escapeHTML(record?.treatingDoctor || '')}">
                            </div>
                        </div>
                        <div>
                                <label for="sick-leave-reason" class="block text-sm font-semibold text-gray-700 mb-2">سبب الإجازة *</label>
                            <textarea id="sick-leave-reason" required class="form-input" rows="3" placeholder="سبب الإجازة المرضية">${Utils.escapeHTML(record?.reason || '')}</textarea>
                            </div>
                        <div>
                                <label for="sick-leave-notes" class="block text-sm font-semibold text-gray-700 mb-2">ملاحظات طبية</label>
                            <textarea id="sick-leave-notes" class="form-input" rows="3" placeholder="ملاحظات طبية إضافية">${Utils.escapeHTML(record?.medicalNotes || '')}</textarea>
                            </div>
                        <div class="flex items-center justify-end gap-3 pt-4 border-t form-actions-centered">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? 'حفظ التعديلات' : 'تسجيل الإجازة'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const form = modal.querySelector('#sick-leave-form');
        const personTypeSelect = form.querySelector('#sick-leave-person-type');
        const codeInput = form.querySelector('#sick-leave-employee-code');
        const nameInput = form.querySelector('#sick-leave-name');
        const positionInput = form.querySelector('#sick-leave-position');
        const departmentInput = form.querySelector('#sick-leave-department');
        const positionContainer = form.querySelector('#sick-leave-position-container');
        const departmentContainer = form.querySelector('#sick-leave-department-container');
        const codeContainer = form.querySelector('#sick-leave-code-container');
        const nameLabel = form.querySelector('#sick-leave-name-label');
        const dropdown = form.querySelector('#sick-leave-dropdown');
        const startInput = form.querySelector('#sick-leave-start-date');
        const endInput = form.querySelector('#sick-leave-end-date');
        const daysChip = form.querySelector('#sick-leave-days');

        const updateDaysCount = () => {
            if (!startInput.value || !endInput.value) {
                daysChip.textContent = '—';
                return;
            }
            const startISO = new Date(startInput.value).toISOString();
            const endISO = new Date(endInput.value).toISOString();
            const days = this.calculateSickLeaveDays(startISO, endISO);
            daysChip.textContent = `${days} يوم`;
        };

        startInput.addEventListener('change', updateDaysCount);
        endInput.addEventListener('change', updateDaysCount);
        if (startInput.value && endInput.value) {
            updateDaysCount();
        }

        const clearEmployeeFields = () => {
            if (nameInput) nameInput.value = '';
            if (positionInput) positionInput.value = '';
            if (departmentInput) departmentInput.value = '';
            if (codeInput) codeInput.value = '';
        };

        const applyEmployeeDetails = (employee) => {
            if (!employee) {
                clearEmployeeFields();
                return;
            }
            const primaryCode = EmployeeHelper.getPrimaryCode(employee);
            if (codeInput && primaryCode) {
                codeInput.value = primaryCode;
            }
            if (nameInput) nameInput.value = employee.name || '';
            if (positionInput) positionInput.value = employee.position || employee.jobTitle || '';
            if (departmentInput) departmentInput.value = employee.department || employee.unit || employee.section || '';
        };

        const attachEmployeeHandlers = () => {
            if (!codeInput || !nameInput || typeof EmployeeHelper === 'undefined') return;
            EmployeeHelper.setupEmployeeCodeSearch('sick-leave-employee-code', 'sick-leave-name', (employee) => {
                if (employee) {
                    applyEmployeeDetails(employee);
                } else {
                    clearEmployeeFields();
                }
            });
            EmployeeHelper.setupAutocomplete('sick-leave-name', (employee) => {
                if (employee) {
                    applyEmployeeDetails(employee);
                }
            });
        };

        const toggleUiForPersonType = (type, reset = false) => {
            const isEmployee = type === 'employee';
            if (codeContainer) {
                codeContainer.style.display = isEmployee ? 'block' : 'none';
            }
            if (positionContainer) {
                positionContainer.style.display = isEmployee ? 'block' : 'none';
            }
            if (departmentContainer) {
                departmentContainer.style.display = isEmployee ? 'block' : 'none';
            }
            if (nameLabel) {
                nameLabel.textContent = `اسم ${isEmployee ? 'الموظف' : type === 'contractor' ? 'المقاول' : 'العامل'} *`;
            }

            if (codeInput) {
                codeInput.disabled = !isEmployee;
                codeInput.required = isEmployee;
                codeInput.placeholder = isEmployee ? 'أدخل الكود الوظيفي' : 'رقم التعريف (اختياري)';
                if (!isEmployee && reset) {
                    codeInput.value = '';
                }
            }

            if (nameInput) {
                nameInput.readOnly = isEmployee;
                nameInput.placeholder = isEmployee ? 'سيتم تعبئة الاسم تلقائياً' : `أدخل اسم ${type === 'contractor' ? 'المقاول' : 'العامل'}`;
                if (isEmployee && reset) {
                    nameInput.value = '';
                }
            }

            if (!isEmployee && reset) {
                if (positionInput) positionInput.value = '';
                if (departmentInput) departmentInput.value = '';
            }

            if (dropdown) {
                dropdown.classList.add('hidden');
                dropdown.innerHTML = '';
            }

            if (isEmployee) {
                attachEmployeeHandlers();
            }
        };

        toggleUiForPersonType(personType, false);
        if (personType === 'employee' && typeof EmployeeHelper !== 'undefined' && employeeCode) {
            const existingEmployee = EmployeeHelper.findByTerm(employeeCode);
            if (existingEmployee) {
                applyEmployeeDetails(existingEmployee);
            }
        }

        personTypeSelect.addEventListener('change', () => {
            toggleUiForPersonType(personTypeSelect.value, true);
            if (personTypeSelect.value === 'employee' && codeInput) {
                codeInput.focus();
            }
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const currentType = personTypeSelect.value;
            const isEmployee = currentType === 'employee';

            if (!startInput.value || !endInput.value) {
                Notification.warning('يرجى تحديد تاريخ بداية ونهاية الإجازة');
                return;
            }

            const startISO = new Date(startInput.value).toISOString();
            const endISO = new Date(endInput.value).toISOString();
            const daysCount = this.calculateSickLeaveDays(startISO, endISO);
            const createdAt = record?.createdAt || new Date().toISOString();
            const createdBy = record?.createdBy || this.getCurrentUserSummary();
            const currentUser = this.getCurrentUserSummary();

            const payload = this.normalizeSickLeaveRecord({
                id: record?.id || Utils.generateId('SICK_LEAVE'),
                personType: currentType,
                employeeName: isEmployee ? nameInput.value.trim() : null,
                employeeCode: isEmployee ? (codeInput?.value.trim() || '') : null,
                employeeNumber: isEmployee ? (codeInput?.value.trim() || '') : null,
                employeePosition: isEmployee ? (positionInput?.value.trim() || '') : null,
                employeeDepartment: isEmployee ? (departmentInput?.value.trim() || '') : null,
                personName: !isEmployee ? nameInput.value.trim() : null,
                startDate: startISO,
                endDate: endISO,
                daysCount,
                reason: form.querySelector('#sick-leave-reason').value.trim(),
                medicalNotes: form.querySelector('#sick-leave-notes').value.trim(),
                treatingDoctor: form.querySelector('#sick-leave-doctor').value.trim(),
                createdAt,
                createdBy,
                createdById: createdBy?.id || AppState.currentUser?.id || '',
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser
            });

            Loading.show();
            try {
                // حفظ البيانات محلياً أولاً
                const sickLeaves = AppState.appData.sickLeave || [];
                if (isEdit) {
                    const index = sickLeaves.findIndex((item) => item.id === payload.id);
                    if (index !== -1) {
                        sickLeaves[index] = payload;
                    } else {
                        sickLeaves.push(payload);
                    }
                } else {
                    sickLeaves.push(payload);
                }

                AppState.appData.sickLeave = sickLeaves;

                // حفظ البيانات محلياً
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                // إغلاق النموذج وإظهار رسالة النجاح فوراً
                Loading.hide();
                Notification.success(isEdit ? 'تم تحديث الإجازة المرضية بنجاح' : 'تم تسجيل الإجازة المرضية بنجاح');
                modal.remove();

                // تحديث واجهة المستخدم فقط بدون إعادة تحميل كامل
                setTimeout(() => {
                    const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="sickLeave"]');
                    if (panel && this.state.activeTab === 'sickLeave') {
                        this.renderSickLeaveTab();
                    }

                    // تحديث الإحصائيات
                    const totalSickLeaveEl = document.querySelector('#total-sick-leave');
                    if (totalSickLeaveEl) {
                        totalSickLeaveEl.textContent = sickLeaves.length;
                    }
                }, 100);

                // المزامنة مع Google Sheets في الخلفية
                (async () => {
                    try {
                        if (isEdit) {
                            await GoogleIntegration.sendRequest({
                                action: 'updateSickLeave',
                                data: { leaveId: payload.id, updateData: payload }
                            });
                        } else {
                            await GoogleIntegration.sendRequest({
                                action: 'addSickLeave',
                                data: payload
                            });
                        }
                    } catch (syncError) {
                        Utils.safeWarn('⚠️ خطأ في المزامنة مع Google Sheets:', syncError);
                    }
                })();

            } catch (error) {
                Loading.hide();
                Notification.error('حدث خطأ أثناء حفظ الإجازة المرضية: ' + error.message);
            }
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النموذج.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) modal.remove();
            }
        });
    },

    async showInjuryForm(record = null) {
        Utils.safeLog('🔷 تم استدعاء showInjuryForm - بدء فتح النموذج...');
        this.ensureData();
        const isEdit = !!record;
        const self = this; // حفظ reference لـ this
        this.state.currentInjuryAttachments = Array.isArray(record?.attachments)
            ? record.attachments.map((attachment) => this.normalizeAttachment(attachment)).filter(Boolean)
            : [];

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        const personType = record?.personType || 'employee';
        const injuryDateValue = record?.injuryDate ? Utils.toDateTimeLocalString(record.injuryDate) : '';
        const nameValue = record?.employeeName || record?.personName || '';
        const contractorNameValue = record?.contractorName || '';
        const codeValue = record?.employeeCode || record?.employeeNumber || '';
        const positionValue = record?.employeePosition || record?.contractorPosition || '';
        const departmentValue = record?.employeeDepartment || record?.department || '';
        const factoryValue = record?.factory || '';
        const subLocationValue = record?.subLocation || record?.subLocationName || '';
        const statusValue = record?.status || 'قيد المتابعة';
        const injuryTypeOptions = this.getInjuryTypeOptions();
        const siteOptions = this.getSiteOptions();

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 980px; border-radius: 16px; overflow: hidden;">
                <div class="modal-header modal-header-centered" style="background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%); color: white;">
                    <h2 class="modal-title">${isEdit ? 'تعديل إصابة طبية' : 'تسجيل إصابة طبية جديدة'}</h2>
                    <button type="button" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="injury-form" class="space-y-5" novalidate>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4" style="background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%); padding: 16px; border-radius: 12px;">
                            <div>
                                <label for="injury-person-type" class="block text-sm font-semibold text-gray-700 mb-2">نوع الشخص *</label>
                                <select id="injury-person-type" required class="form-input">
                                    <option value="employee" ${personType === 'employee' ? 'selected' : ''}>موظف</option>
                                    <option value="contractor" ${personType === 'contractor' ? 'selected' : ''}>مقاول</option>
                                    <option value="external" ${personType === 'external' ? 'selected' : ''}>عمالة خارجية</option>
                                </select>
                            </div>
                            <div id="injury-code-container">
                                <label for="injury-employee-code" class="block text-sm font-semibold text-gray-700 mb-2">الكود الوظيفي</label>
                                <input type="text" id="injury-employee-code" class="form-input" value="${Utils.escapeHTML(codeValue)}" placeholder="الكود أو رقم الهوية">
                            </div>
                            <div id="injury-contractor-container" style="display:none;">
                                <label for="injury-contractor-name-select" class="block text-sm font-semibold text-gray-700 mb-2">اسم المقاول *</label>
                                <input id="injury-contractor-name-select" class="form-input" list="injury-contractors-datalist" placeholder="-- اختر المقاول --" value="${Utils.escapeHTML(contractorNameValue)}" autocomplete="off">
                                <datalist id="injury-contractors-datalist"></datalist>
                            </div>
                            <div id="injury-employee-name-container">
                                <label for="injury-name" class="block text-sm font-semibold text-gray-700 mb-2" id="injury-name-label">اسم الموظف *</label>
                                <div class="relative">
                                    <input type="text" id="injury-name" required class="form-input" value="${Utils.escapeHTML(nameValue)}" placeholder="سيتم تعبئة الاسم تلقائياً">
                                    <div id="injury-dropdown" class="hse-lookup-dropdown absolute z-50 hidden w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"></div>
                                </div>
                            </div>
                            <div id="injury-contractor-worker-container" style="display:none;">
                                <label for="injury-contractor-worker-name" class="block text-sm font-semibold text-gray-700 mb-2">اسم الموظف التابع للمقاول *</label>
                                <input type="text" id="injury-contractor-worker-name" class="form-input" value="${Utils.escapeHTML(nameValue)}" placeholder="أدخل اسم المصاب التابع للمقاول">
                            </div>
                            <div id="injury-position-container">
                                <label for="injury-position" class="block text-sm font-semibold text-gray-700 mb-2">الوظيفة</label>
                                <input type="text" id="injury-position" class="form-input" value="${Utils.escapeHTML(positionValue)}" placeholder="الوظيفة">
                            </div>
                            <div>
                                <label for="injury-department" class="block text-sm font-semibold text-gray-700 mb-2">الإدارة / القسم</label>
                                <input type="text" id="injury-department" class="form-input" value="${Utils.escapeHTML(departmentValue)}" placeholder="قسم/إدارة المصاب">
                            </div>
                            <div>
                                <label for="injury-factory" class="block text-sm font-semibold text-gray-700 mb-2">المصنع / الموقع</label>
                                <select id="injury-factory" class="form-input">
                                    <option value="">-- اختر المصنع --</option>
                                    ${siteOptions.map(site => `<option value="${Utils.escapeHTML(site.id)}" ${factoryValue === site.id || factoryValue === site.name ? 'selected' : ''}>${Utils.escapeHTML(site.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label for="injury-sub-location" class="block text-sm font-semibold text-gray-700 mb-2">الموقع الفرعي</label>
                                <input type="text" id="injury-sub-location" list="injury-sub-location-datalist" class="form-input" value="${Utils.escapeHTML(subLocationValue)}" placeholder="اختر موقعاً فرعياً أو اكتب يدوياً">
                                <datalist id="injury-sub-location-datalist"></datalist>
                            </div>
                            <div>
                                <label for="injury-date" class="block text-sm font-semibold text-gray-700 mb-2">تاريخ الإصابة *</label>
                                <input type="datetime-local" id="injury-date" required class="form-input" value="${injuryDateValue}">
                            </div>
                            <div>
                                <label for="injury-status" class="block text-sm font-semibold text-gray-700 mb-2">حالة الإصابة *</label>
                                <select id="injury-status" required class="form-input">
                                    <option value="قيد المتابعة" ${statusValue === 'قيد المتابعة' ? 'selected' : ''}>قيد المتابعة</option>
                                    <option value="تم الشفاء" ${statusValue === 'تم الشفاء' ? 'selected' : ''}>تم الشفاء</option>
                                    <option value="مغلق" ${statusValue === 'مغلق' ? 'selected' : ''}>مغلق</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">نوع الإصابة *</label>
                                <select id="injury-type" required class="form-input">
                                    <option value="">اختر نوع الإصابة</option>
                                    ${injuryTypeOptions.map(type => `<option value="${Utils.escapeHTML(type)}" ${record?.injuryType === type ? 'selected' : ''}>${Utils.escapeHTML(type)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">مكان الإصابة (بالجسم) *</label>
                                <select id="injury-body-part" required class="form-input">
                                    <option value="">اختر مكان الإصابة بالجسم</option>
                                    ${this.getInjuryBodyPartOptions().map(part => `<option value="${Utils.escapeHTML(part)}" ${record?.injuryBodyPart === part ? 'selected' : ''}>${Utils.escapeHTML(part)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label for="injury-location" class="block text-sm font-semibold text-gray-700 mb-2">مكان الإصابة *</label>
                                <input type="text" id="injury-location" required class="form-input" value="${Utils.escapeHTML(record?.injuryLocation || '')}" placeholder="حدد مكان الإصابة">
                            </div>
                        </div>
                        <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">وصف الإصابة *</label>
                            <textarea id="injury-description" required class="form-input" rows="3" placeholder="وصف تفصيلي للحادث">${Utils.escapeHTML(record?.injuryDescription || '')}</textarea>
                            </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الإجراءات المتخذة</label>
                                <textarea id="injury-actions" class="form-input" rows="3" placeholder="الإجراءات الفورية أو الخطط العلاجية">${Utils.escapeHTML(record?.actionsTaken || '')}</textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">العلاج</label>
                                <textarea id="injury-treatment" class="form-input" rows="3" placeholder="العلاج الموصوف">${Utils.escapeHTML(record?.treatment || '')}</textarea>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <label for="injury-attachments-input" class="block text-sm font-semibold text-gray-700">مرفقات الحالة</label>
                            <div class="flex items-center gap-3">
                                <input type="file" id="injury-attachments-input" class="form-input" accept=".png,.jpg,.jpeg,.pdf" multiple>
                                <span class="text-xs text-gray-500">الحد الأقصى للملف الواحد 5MB</span>
                            </div>
                            <div id="injury-attachments-preview" class="space-y-2"></div>
                        </div>
                        <div class="flex items-center justify-end gap-3 pt-4 border-t form-actions-centered">
                            <button type="button" class="btn-secondary" id="injury-cancel-btn">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? 'حفظ التعديلات' : 'تسجيل الإصابة'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const form = modal.querySelector('#injury-form');
        const personTypeSelect = form.querySelector('#injury-person-type');
        const injuryNameInput = form.querySelector('#injury-name');
        const injuryCodeInput = form.querySelector('#injury-employee-code');
        const injuryCodeContainer = form.querySelector('#injury-code-container');
        const injuryContractorContainer = form.querySelector('#injury-contractor-container');
        const injuryContractorSelect = form.querySelector('#injury-contractor-name-select');
        const injuryEmployeeNameContainer = form.querySelector('#injury-employee-name-container');
        const injuryContractorWorkerContainer = form.querySelector('#injury-contractor-worker-container');
        const injuryContractorWorkerInput = form.querySelector('#injury-contractor-worker-name');
        const injuryNameLabel = form.querySelector('#injury-name-label');
        const positionInput = form.querySelector('#injury-position');
        const factorySelect = form.querySelector('#injury-factory');
        const subLocationInput = form.querySelector('#injury-sub-location');
        const departmentInput = form.querySelector('#injury-department');
        const dropdown = form.querySelector('#injury-dropdown');
        const attachmentsInput = form.querySelector('#injury-attachments-input');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = form.querySelector('#injury-cancel-btn');

        const applyInjuryEmployee = (employee) => {
            if (!employee) return;
            if (injuryNameInput) injuryNameInput.value = employee.name || '';
            if (injuryCodeInput) {
                const primaryCode = EmployeeHelper.getPrimaryCode(employee);
                if (primaryCode) {
                    injuryCodeInput.value = primaryCode;
                }
            }
            if (departmentInput) {
                departmentInput.value = employee.department || employee.unit || employee.section || departmentInput.value;
            }
            if (positionInput) {
                positionInput.value = employee.position || employee.job || '';
            }
        };

        const attachInjuryEmployeeHandlers = () => {
            if (!injuryCodeInput || !injuryNameInput || typeof EmployeeHelper === 'undefined') return;
            EmployeeHelper.setupEmployeeCodeSearch('injury-employee-code', 'injury-name', (employee) => {
                if (employee) {
                    applyInjuryEmployee(employee);
                }
            });
            EmployeeHelper.setupAutocomplete('injury-name', (employee) => {
                if (employee) {
                    applyInjuryEmployee(employee);
                }
            });
        };

        const toggleInjuryPersonType = (type, reset = false) => {
            const isEmployee = type === 'employee';
            const isContractor = type === 'contractor';
            const isExternal = type === 'external';
            if (injuryCodeContainer) {
                injuryCodeContainer.style.display = isEmployee ? 'block' : 'none';
            }
            if (injuryContractorContainer) {
                injuryContractorContainer.style.display = isContractor ? 'block' : 'none';
            }
            if (injuryEmployeeNameContainer) {
                injuryEmployeeNameContainer.style.display = isEmployee ? 'block' : 'none';
            }
            if (injuryContractorWorkerContainer) {
                injuryContractorWorkerContainer.style.display = (isContractor || isExternal) ? 'block' : 'none';
            }
            if (injuryCodeInput) {
                injuryCodeInput.required = isEmployee;
                injuryCodeInput.disabled = !isEmployee;
                injuryCodeInput.placeholder = isEmployee ? 'أدخل الكود الوظيفي' : 'رقم التعريف (اختياري)';
                if (!isEmployee && reset) {
                    injuryCodeInput.value = '';
                }
            }
            if (injuryNameLabel) {
                injuryNameLabel.textContent = `اسم ${isEmployee ? 'الموظف' : type === 'contractor' ? 'المقاول' : 'العامل'} *`;
            }
            if (injuryNameInput) {
                injuryNameInput.readOnly = isEmployee;
                injuryNameInput.disabled = !isEmployee;
                injuryNameInput.required = isEmployee;
                injuryNameInput.placeholder = isEmployee ? 'سيتم تعبئة الاسم تلقائياً' : `أدخل اسم ${type === 'contractor' ? 'الموظف التابع للمقاول' : 'العامل'}`;
                if (reset && !isEmployee) {
                    injuryNameInput.value = '';
                }
            }
            if (injuryContractorSelect) {
                injuryContractorSelect.required = isContractor;
                injuryContractorSelect.disabled = !isContractor;
                if (isContractor) {
                    this.loadContractorsIntoSelect(injuryContractorSelect);
                } else if (reset) {
                    injuryContractorSelect.value = '';
                }
            }
            if (injuryContractorWorkerInput) {
                injuryContractorWorkerInput.required = (isContractor || isExternal);
                injuryContractorWorkerInput.disabled = !(isContractor || isExternal);
                if (reset && isEmployee) injuryContractorWorkerInput.value = '';
                if (isExternal) injuryContractorWorkerInput.placeholder = 'أدخل اسم العامل الخارجي';
                else if (isContractor) injuryContractorWorkerInput.placeholder = 'أدخل اسم المصاب التابع للمقاول';
                else injuryContractorWorkerInput.placeholder = '';
            }
            if (!isEmployee && reset && departmentInput) {
                departmentInput.value = '';
            }
            if (!isEmployee && reset && positionInput) {
                positionInput.value = '';
            }
            if (dropdown) {
                dropdown.classList.add('hidden');
                dropdown.innerHTML = '';
            }
            if (isEmployee) {
                attachInjuryEmployeeHandlers();
            }
        };

        toggleInjuryPersonType(personType, false);
        if (personType === 'employee' && typeof EmployeeHelper !== 'undefined' && codeValue) {
            const employee = EmployeeHelper.findByTerm(codeValue);
            if (employee) {
                applyInjuryEmployee(employee);
            }
        }

        personTypeSelect.addEventListener('change', () => {
            toggleInjuryPersonType(personTypeSelect.value, true);
        });

        injuryContractorSelect?.addEventListener('input', () => {
            if (personTypeSelect.value !== 'contractor') return;
            const selected = (injuryContractorSelect.value || '').trim();
            if (!selected) return;
            // عند اختيار المقاول: نملأ الاسم بالعامل/المصاب يدوياً لاحقاً، مع الاحتفاظ باسم الشركة
            if (!injuryNameInput.value.trim()) {
                injuryNameInput.focus();
            }
        });

        if (typeof this.setupClinicWorkplaceDatalist === 'function') {
            this.setupClinicWorkplaceDatalist('injury-factory', 'injury-sub-location', 'injury-sub-location-datalist', { includeFallbackNameMatch: true });
        }

        attachmentsInput?.addEventListener('change', async (event) => {
            await self.handleInjuryAttachmentsChange(event.target.files);
        });

        // Render attachments preview if exists
        if (typeof self.renderInjuryAttachmentsPreview === 'function') {
            self.renderInjuryAttachmentsPreview();
        } else {
            Utils.safeWarn('⚠️ renderInjuryAttachmentsPreview غير موجودة');
        }

        const resetStateAndClose = () => {
            self.state.currentInjuryAttachments = [];
            modal.remove();
        };

        closeBtn?.addEventListener('click', resetStateAndClose);
        cancelBtn?.addEventListener('click', resetStateAndClose);

        Utils.safeLog('🔷 تم إضافة event listener للنموذج...');
        form.addEventListener('submit', async (event) => {
            Utils.safeLog('🔴 تم الضغط على زر الحفظ! بدء المعالجة...');
            try {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                Utils.safeLog('🔄 بدء معالجة نموذج الإصابة...');

                const currentType = personTypeSelect.value;
                const isEmployee = currentType === 'employee';
                const injuryDateInput = form.querySelector('#injury-date');
                if (!injuryDateInput.value) {
                    Notification.warning('يرجى تحديد تاريخ الإصابة');
                    return;
                }

                // ✅ إصلاح: استخدام تحويل صحيح لـ datetime-local
                const injuryISO = Utils.dateTimeLocalToISO(injuryDateInput.value) || new Date().toISOString();
                const createdAt = record?.createdAt || new Date().toISOString();
                const createdBy = record?.createdBy || self.getCurrentUserSummary();
                const currentUser = self.getCurrentUserSummary();
                const departmentValueFinal = departmentInput?.value.trim() || '';
                const positionValueFinal = positionInput?.value.trim() || '';
                const contractorNameFinal = injuryContractorSelect?.value?.trim() || '';
                const personNameFinal = isEmployee
                    ? (injuryNameInput?.value?.trim() || '')
                    : (injuryContractorWorkerInput?.value?.trim() || injuryNameInput?.value?.trim() || '');
                const injuryTypeValue = form.querySelector('#injury-type')?.value || '';
                const injuryBodyPartValue = form.querySelector('#injury-body-part')?.value || '';
                const injuryLocationValue = form.querySelector('#injury-location')?.value?.trim() || '';
                const injuryDescriptionValue = form.querySelector('#injury-description')?.value?.trim() || '';
                const factoryId = factorySelect?.value?.trim() || '';
                const subLocationFinal = subLocationInput?.value?.trim() || '';

                if (isEmployee && !personNameFinal) {
                    Notification.warning('يرجى إدخال/اختيار اسم الموظف');
                    return;
                }

                if (currentType === 'contractor' && injuryContractorSelect) {
                    const allowed = (() => {
                        try { return JSON.parse(injuryContractorSelect.dataset.allowedValues || '[]'); } catch (e) { return []; }
                    })();
                    if (!contractorNameFinal || !allowed.includes(contractorNameFinal.toLowerCase().trim())) {
                        Notification.warning('يرجى اختيار اسم المقاول من القائمة فقط');
                        return;
                    }
                    if (!personNameFinal) {
                        Notification.warning('يرجى إدخال اسم المصاب التابع للمقاول');
                        return;
                    }
                }
                if (currentType === 'external' && !personNameFinal) {
                    Notification.warning('يرجى إدخال اسم العامل الخارجي');
                    return;
                }
                if (!injuryTypeValue) {
                    Notification.warning('يرجى اختيار نوع الإصابة');
                    return;
                }
                if (!injuryBodyPartValue) {
                    Notification.warning('يرجى اختيار مكان الإصابة (بالجسم)');
                    return;
                }
                if (!injuryLocationValue) {
                    Notification.warning('يرجى إدخال مكان الإصابة');
                    return;
                }
                if (!injuryDescriptionValue) {
                    Notification.warning('يرجى إدخال وصف الإصابة');
                    return;
                }

                let factoryName = '';
                if (factoryId) {
                    const selectedSite = siteOptions.find(s => s.id === factoryId || s.name === factoryId);
                    factoryName = selectedSite?.name || '';
                }

                const payload = self.normalizeInjuryRecord({
                    id: record?.id || Utils.generateId('INJURY'),
                    personType: currentType,
                    employeeName: isEmployee ? injuryNameInput.value.trim() : null,
                    employeeCode: isEmployee ? (injuryCodeInput?.value.trim() || '') : null,
                    employeeNumber: isEmployee ? (injuryCodeInput?.value.trim() || '') : null,
                    personName: !isEmployee ? personNameFinal : null,
                    contractorName: currentType === 'contractor' ? contractorNameFinal : null,
                    employeePosition: positionValueFinal,
                    contractorPosition: !isEmployee ? positionValueFinal : null,
                    employeeDepartment: departmentValueFinal,
                    department: departmentValueFinal,
                    factory: factoryId || null,
                    factoryName: factoryName || null,
                    subLocation: subLocationFinal || null,
                    subLocationName: subLocationFinal || null,
                    injuryDate: injuryISO,
                    injuryType: injuryTypeValue,
                    injuryBodyPart: injuryBodyPartValue,
                    injuryLocation: injuryLocationValue,
                    injuryDescription: injuryDescriptionValue,
                    actionsTaken: form.querySelector('#injury-actions').value.trim(),
                    treatment: form.querySelector('#injury-treatment').value.trim(),
                    status: form.querySelector('#injury-status').value,
                    attachments: self.state.currentInjuryAttachments.map((attachment) => ({ ...attachment })),
                    createdAt,
                    createdBy,
                    createdById: createdBy?.id || AppState.currentUser?.id || '',
                    updatedAt: new Date().toISOString(),
                    updatedBy: currentUser
                });

                Utils.safeLog('✅ تم إنشاء payload بنجاح:', payload);

                Loading.show();

                // حفظ البيانات محلياً أولاً
                const injuries = AppState.appData.injuries || [];
                if (isEdit) {
                    const index = injuries.findIndex((item) => item.id === payload.id);
                    if (index !== -1) {
                        injuries[index] = payload;
                    } else {
                        injuries.push(payload);
                    }
                } else {
                    injuries.push(payload);
                }

                AppState.appData.injuries = injuries;

                // حفظ البيانات محلياً
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                Utils.safeLog('✅ تم حفظ البيانات محلياً');

                // إغلاق النموذج وإظهار رسالة النجاح فوراً
                Loading.hide();
                Notification.success(isEdit ? 'تم تحديث بيانات الإصابة بنجاح' : 'تم تسجيل الإصابة بنجاح');
                resetStateAndClose();

                Utils.safeLog('✅ تم إغلاق النموذج بنجاح');

                // تحديث واجهة المستخدم فقط بدون إعادة تحميل كامل
                setTimeout(() => {
                    try {
                        Utils.safeLog('✅ محاولة تحديث واجهة الإصابات...');
                        const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="injuries"]');
                        if (panel && self.state.activeTab === 'injuries') {
                            Utils.safeLog('✅ تم العثور على panel، سيتم تحديثه');
                            self.renderInjuriesTab();
                        }

                        // تحديث الإحصائيات
                        const totalInjuriesEl = document.querySelector('#total-injuries');
                        if (totalInjuriesEl) {
                            totalInjuriesEl.textContent = injuries.length;
                        }
                    } catch (renderError) {
                        Utils.safeWarn('⚠️ فشل تحديث واجهة الإصابات:', renderError);
                    }
                }, 100);

                // المزامنة مع Google Sheets في الخلفية
                (async () => {
                    try {
                        if (isEdit) {
                            await GoogleIntegration.sendRequest({
                                action: 'updateInjury',
                                data: { injuryId: payload.id, updateData: payload }
                            });
                            Utils.safeLog('✅ تم حفظ البيانات في Google Sheets (تحديث)');
                        } else {
                            await GoogleIntegration.sendRequest({
                                action: 'addInjury',
                                data: payload
                            });
                            Utils.safeLog('✅ تم حفظ البيانات في Google Sheets (إضافة)');
                        }
                    } catch (syncError) {
                        Utils.safeWarn('⚠️ خطأ في المزامنة مع Google Sheets:', syncError);
                    }
                })();

            } catch (error) {
                Loading.hide();
                Utils.safeError('❌ خطأ عام في حفظ بيانات الإصابة:', error);
                Notification.error('حدث خطأ أثناء حفظ بيانات الإصابة: ' + error.message);
            }
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النموذج.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (!ok) return;
                self.state.currentInjuryAttachments = [];
                modal.remove();
            }
        });
    },

    showVisitForm(visitData = null, registerVisitBtn = null) {
        const isEdit = !!visitData;
        const content = document.getElementById('clinic-section');
        if (!content) {
            if (registerVisitBtn) registerVisitBtn.disabled = false;
            return;
        }

        try {
            this.ensureData();
        } catch (e) {
            if (registerVisitBtn) registerVisitBtn.disabled = false;
            Utils.safeError('خطأ في تحضير نموذج الزيارة:', e);
            return;
        }
        // تشغيل الصلاحيات في الخلفية دون انتظار لفتح النموذج فوراً
        if (typeof Permissions !== 'undefined' && Permissions.ensureFormSettingsState) {
            Permissions.ensureFormSettingsState().catch(() => {});
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; border-radius: 15px; overflow: hidden;">
                <div class="modal-header modal-header-centered" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px;">
                    <h2 class="modal-title" style="color: white; display: flex; align-items: center; gap: 10px;"><i class="fas fa-hospital-user"></i> ${isEdit ? 'تعديل زيارة' : 'تسجيل زيارة جديدة'}</h2>
                    <button class="modal-close" style="color: white;" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="background: #f8f9fa; padding: 25px;">
                    <form id="visit-form" class="space-y-4">
                        <div id="visit-form-alerts" class="visit-form-alerts mb-2" style="display:none" aria-live="polite" role="region" aria-label="تنبيهات النموذج"></div>
                        <div class="grid grid-cols-2 gap-4" style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 20px; border-radius: 10px; margin-bottom: 15px;">
                            <div>
                                <label class="block text-sm font-semibold mb-2" style="color: #667eea; display: flex; align-items: center; gap: 5px;"><i class="fas fa-users"></i> نوع الشخص *</label>
                                <select id="visit-person-type" required class="form-input" onchange="Clinic.handlePersonTypeChange()" style="border: 2px solid #667eea; border-radius: 8px;">
                                    <option value="employee" ${visitData?.personType === 'employee' || !visitData ? 'selected' : ''}>موظف</option>
                                    <option value="contractor" ${visitData?.personType === 'contractor' ? 'selected' : ''}>مقاول</option>
                                    <option value="external" ${visitData?.personType === 'external' ? 'selected' : ''}>عمالة خارجية</option>
                                </select>
                            </div>
                            <div id="visit-employee-code-container" style="display: ${visitData?.personType === 'employee' || !visitData ? 'block' : 'none'};">
                                <label for="visit-employee-code" class="block text-sm font-semibold mb-2" style="color: #667eea; display: flex; align-items: center; gap: 5px;"><i class="fas fa-id-card"></i> الكود الوظيفي / الرقم الوظيفي *</label>
                                <input type="text" id="visit-employee-code" class="form-input" style="border: 2px solid #667eea; border-radius: 8px;"
                                    value="${visitData?.employeeCode || visitData?.employeeNumber || ''}" 
                                    placeholder="أدخل الكود الوظيفي (سيتم تعبئة البيانات تلقائياً)"
                                    autocomplete="off" autocorrect="off" spellcheck="false" inputmode="text"
                                    ${visitData?.personType === 'employee' || !visitData ? 'required' : 'disabled'}>
                            </div>
                            <div id="visit-employee-name-container">
                                <label for="visit-employee-name" class="block text-sm font-semibold mb-2" id="visit-employee-name-label" style="color: #667eea; display: flex; align-items: center; gap: 5px;"><i class="fas fa-user"></i> اسم الموظف *</label>
                                <input type="text" id="visit-employee-name" required class="form-input" style="border: 2px solid #667eea; border-radius: 8px;"
                                    value="${visitData?.employeeName || ''}" 
                                    placeholder="${visitData?.personType === 'employee' || !visitData ? 'سيتم التعبئة تلقائياً' : visitData?.personType === 'contractor' ? 'أدخل اسم المقاول' : 'أدخل اسم العامل'}"
                                    ${visitData?.personType === 'employee' || !visitData ? 'readonly' : ''}
                                    style="display: ${visitData?.personType === 'contractor' ? 'none' : 'block'}; border: 2px solid #667eea; border-radius: 8px;">
                                <input id="visit-contractor-name-select" required class="form-input"
                                    list="visit-contractors-datalist"
                                    placeholder="-- اختر المقاول --"
                                    style="display: ${visitData?.personType === 'contractor' ? 'block' : 'none'}; border: 2px solid #667eea; border-radius: 8px;"
                                    autocomplete="off">
                                <datalist id="visit-contractors-datalist"></datalist>
                            </div>
                        </div>
                        
                        <!-- قسم معلومات الزيارة -->
                        <div class="grid grid-cols-2 gap-4" style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); padding: 20px; border-radius: 10px; margin-bottom: 15px;">
                            <div id="visit-employee-position-container" style="display: ${visitData?.personType === 'employee' || !visitData ? 'block' : 'none'};">
                                <label for="visit-employee-position" class="block text-sm font-semibold text-gray-700 mb-2">الوظيفة</label>
                                <input type="text" id="visit-employee-position" class="form-input" readonly placeholder="سيتم التعبئة تلقائياً"
                                    value="${visitData?.employeePosition || ''}">
                            </div>
                            <div id="visit-employee-department-container" style="display: ${visitData?.personType === 'employee' || !visitData ? 'block' : 'none'};">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">القسم/الإدارة</label>
                                <input type="text" id="visit-employee-department" class="form-input" readonly placeholder="سيتم التعبئة تلقائياً"
                                    value="${visitData?.employeeDepartment || ''}">
                            </div>
                            <div id="visit-factory-container" style="display: ${visitData?.personType === 'employee' || !visitData ? 'block' : 'none'};">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">المصنع</label>
                                <select id="visit-factory" class="form-input" style="border: 2px solid #fc6c85; border-radius: 8px;">
                                    <option value="">-- اختر المصنع --</option>
                                    ${this.getSiteOptions().map(site => `
                                        <option value="${site.id}" ${visitData?.factory === site.id || visitData?.factory === site.name ? 'selected' : ''}>${Utils.escapeHTML(site.name)}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div id="visit-employee-location-container" style="display: ${visitData?.personType === 'employee' || !visitData ? 'block' : 'none'};">
                                <label for="visit-employee-location" class="block text-sm font-semibold text-gray-700 mb-2">مكان العمل *<span style="font-size: 11px; color: #666; display: block; margin-top: 2px;">يُعرض المواقع الفرعية للمصنع أعلاه؛ اكتب للبحث أو أدخل نصاً يدوياً</span></label>
                                <input type="text" id="visit-employee-location" class="form-input" list="visit-employee-location-datalist"
                                    value="${visitData?.employeeLocation || ''}" 
                                    placeholder="اختر موقعاً فرعياً أو اكتب مكان العمل"
                                    autocomplete="off" autocorrect="off" spellcheck="false" inputmode="text" required>
                                <datalist id="visit-employee-location-datalist"></datalist>
                            </div>
                            <div id="visit-contractor-position-container" style="display: ${visitData?.personType === 'contractor' || visitData?.personType === 'external' ? 'block' : 'none'};">
                                <label for="visit-contractor-position" class="block text-sm font-semibold text-gray-700 mb-2">الوظيفة *</label>
                                <input type="text" id="visit-contractor-position" class="form-input"
                                    value="${visitData?.contractorPosition || visitData?.employeePosition || ''}" 
                                    placeholder="أدخل الوظيفة يدوياً"
                                    ${visitData?.personType === 'contractor' || visitData?.personType === 'external' ? 'required' : ''}>
                            </div>
                            <div id="visit-contractor-factory-container" style="display: ${visitData?.personType === 'contractor' || visitData?.personType === 'external' ? 'block' : 'none'};">
                                <label for="visit-contractor-factory" class="block text-sm font-semibold text-gray-700 mb-2">المصنع</label>
                                <select id="visit-contractor-factory" class="form-input" style="border: 2px solid #fc6c85; border-radius: 8px;">
                                    <option value="">-- اختر المصنع --</option>
                                    ${this.getSiteOptions().map(site => `
                                        <option value="${site.id}" ${visitData?.factory === site.id || visitData?.factory === site.name ? 'selected' : ''}>${Utils.escapeHTML(site.name)}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div id="visit-work-area-container" style="display: ${visitData?.personType === 'contractor' || visitData?.personType === 'external' ? 'block' : 'none'};">
                                <label for="visit-work-area" class="block text-sm font-semibold text-gray-700 mb-2">مكان العمل *<span style="font-size: 11px; color: #666; display: block; margin-top: 2px;">يُعرض المواقع الفرعية للمصنع أعلاه؛ اكتب للبحث أو أدخل نصاً يدوياً</span></label>
                                <input type="text" id="visit-work-area" class="form-input" list="visit-work-area-datalist"
                                    value="${visitData?.workArea || ''}" placeholder="اختر موقعاً فرعياً أو اكتب مكان العمل"
                                    autocomplete="off" autocorrect="off" spellcheck="false" inputmode="text"
                                    ${visitData?.personType === 'contractor' || visitData?.personType === 'external' ? 'required' : ''}>
                                <datalist id="visit-work-area-datalist"></datalist>
                            </div>
                            <div id="visit-contractor-worker-container" style="display: ${visitData?.personType === 'contractor' || visitData?.personType === 'external' ? 'block' : 'none'};">
                                <label for="visit-contractor-worker" id="visit-contractor-worker-label" class="block text-sm font-semibold text-gray-700 mb-2">اسم الموظف التابع للمقاول *</label>
                                <input type="text" id="visit-contractor-worker" class="form-input"
                                    value="${visitData?.contractorWorkerName || ''}" placeholder="أدخل اسم العامل التابع للمقاول"
                                    ${visitData?.personType === 'contractor' || visitData?.personType === 'external' ? 'required' : ''}>
                            </div>
                            <div>
                                <label for="visit-date" class="block text-sm font-semibold mb-2" style="color: #fc6c85; display: flex; align-items: center; gap: 5px;"><i class="fas fa-clock"></i> وقت الدخول *</label>
                                <input type="datetime-local" id="visit-date" required class="form-input" style="border: 2px solid #fc6c85; border-radius: 8px;"
                                    value="${visitData?.visitDate ? Utils.toDateTimeLocalString(visitData.visitDate) : ''}">
                            </div>
                            <div>
                                <label for="visit-exit-date" class="block text-sm font-semibold mb-2" style="color: #fc6c85; display: flex; align-items: center; gap: 5px;"><i class="fas fa-sign-out-alt"></i> وقت الخروج</label>
                                <input type="datetime-local" id="visit-exit-date" class="form-input" style="border: 2px solid #fc6c85; border-radius: 8px;"
                                    value="${visitData?.exitDate ? Utils.toDateTimeLocalString(visitData.exitDate) : ''}">
                            </div>
                        </div>
                        
                        <!-- قسم التشخيص والعلاج -->
                        <div class="grid grid-cols-1 gap-4" style="background: linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%); padding: 20px; border-radius: 10px; margin-bottom: 15px;">
                            <div class="col-span-2">
                                <label for="visit-type" class="block text-sm font-semibold mb-2" style="color: #4facfe; display: flex; align-items: center; gap: 5px;"><i class="fas fa-tag"></i> نوع الزيارة *</label>
                                <select id="visit-type" required class="form-input" style="border: 2px solid #4facfe; border-radius: 8px;">
                                    <option value="">-- اختر نوع الزيارة --</option>
                                    ${(isEdit && !visitData?.visitType ? ['غير محدد'] : []).map(opt => `<option value="${Utils.escapeHTML(opt)}" selected>${Utils.escapeHTML(opt)}</option>`).join('')}
                                    ${this.getVisitTypeOptions().map(opt => `<option value="${Utils.escapeHTML(opt)}" ${(visitData?.visitType || '') === opt ? 'selected' : ''}>${Utils.escapeHTML(opt)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-span-2">
                                <label for="visit-reason" class="block text-sm font-semibold mb-2" style="color: #4facfe; display: flex; align-items: center; gap: 5px;"><i class="fas fa-question-circle"></i> سبب الزيارة *</label>
                                <input type="text" id="visit-reason" required class="form-input" style="border: 2px solid #4facfe; border-radius: 8px;"
                                    value="${visitData?.reason || ''}" placeholder="سبب الزيارة">
                            </div>
                            <div class="col-span-2">
                                <label class="block text-sm font-semibold mb-2" style="color: #4facfe; display: flex; align-items: center; gap: 5px;"><i class="fas fa-diagnoses"></i> التشخيص</label>
                                <textarea id="visit-diagnosis" class="form-input" rows="3" style="border: 2px solid #4facfe; border-radius: 8px;"
                                    placeholder="التشخيص">${visitData?.diagnosis || ''}</textarea>
                            </div>
                            <div class="col-span-2">
                                <label class="block text-sm font-semibold mb-2" style="color: #4facfe; display: flex; align-items: center; gap: 5px;"><i class="fas fa-pills"></i> العلاج</label>
                                <textarea id="visit-treatment" class="form-input" rows="3" style="border: 2px solid #4facfe; border-radius: 8px;"
                                    placeholder="العلاج الموصوف">${visitData?.treatment || ''}</textarea>
                            </div>
                        </div>
                        
                        <!-- قسم الأدوية -->
                        <div class="grid grid-cols-1 gap-4" style="background: linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%); padding: 20px; border-radius: 10px;">
                            <div class="col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">صرف الأدوية</label>
                                <div id="visit-medications-container" class="space-y-2">
                                    <div class="flex gap-2 items-end">
                                        <div class="flex-1">
                                            <input id="visit-medication-select" class="form-input"
                                                list="visit-medications-datalist"
                                                placeholder="-- اختر الدواء --"
                                                autocomplete="off">
                                            <datalist id="visit-medications-datalist"></datalist>
                                        </div>
                                        <div style="width: 120px;">
                                            <input type="number" id="visit-medication-quantity" class="form-input" min="1" placeholder="الكمية" value="1">
                                        </div>
                                        <button type="button" class="btn-secondary" id="visit-add-medication-btn">
                                            <i class="fas fa-plus ml-1"></i>إضافة
                                        </button>
                                    </div>
                                    <div id="visit-medications-list" class="space-y-2 mt-2">
                                        ${visitData?.medications && Array.isArray(visitData.medications) ? visitData.medications.map((med, idx) => `
                                            <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2" data-med-id="${med.medicationId || ''}">
                                                <div>
                                                    <span class="font-medium">${Utils.escapeHTML(med.medicationName || '')}</span>
                                                    <span class="text-sm text-gray-600 mr-2">× ${med.quantity || 1}</span>
                                                </div>
                                                <button type="button" class="btn-icon btn-icon-danger btn-xs" data-remove-med="${idx}">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            </div>
                                        `).join('') : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- جدول بيانات الزيارات السابقة (بنفس التصميم المعماري) -->
                        ${visitData?.personType === 'employee' || !visitData ? `
                        <div class="mt-6 pt-6 border-t">
                            <h3 class="text-lg font-bold text-gray-800 mb-4">
                                <i class="fas fa-history ml-2"></i>
                                سجل الزيارات السابقة
                            </h3>
                            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div class="overflow-x-auto">
                                    <table class="data-table w-full" id="visit-history-table">
                                        <thead>
                                            <tr>
                                                <th>وقت الدخول</th>
                                                <th>وقت الخروج</th>
                                                <th>السبب</th>
                                                <th>التشخيص</th>
                                                <th>العلاج</th>
                                                <th>مكان العمل</th>
                                            </tr>
                                        </thead>
                                        <tbody id="visit-history-tbody">
                                            <tr>
                                                <td colspan="6" class="text-center text-gray-500 py-4">جاري تحميل البيانات...</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="flex items-center justify-end gap-4 pt-4 border-t form-actions-centered">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? 'حفظ التعديلات' : 'تسجيل الزيارة'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        if (registerVisitBtn) {
            const observer = new MutationObserver(() => {
                if (!document.body.contains(modal)) {
                    registerVisitBtn.disabled = false;
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // تحميل سجل الزيارات السابقة إذا كان موظف
        setTimeout(() => {
            const personTypeSelect = document.getElementById('visit-person-type');
            const codeInput = document.getElementById('visit-employee-code');
            const historyTableBody = document.getElementById('visit-history-tbody');

            const loadVisitHistory = () => {
                if (!historyTableBody) return;
                const personType = personTypeSelect?.value || 'employee';
                const code = codeInput?.value.trim();

                if (personType !== 'employee' || !code) {
                    historyTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">لا توجد بيانات</td></tr>';
                    return;
                }

                const visits = (AppState.appData.clinicVisits || []).filter(v =>
                    v.personType === 'employee' &&
                    (v.employeeCode === code || v.employeeNumber === code)
                ).sort((a, b) => new Date(b.visitDate || b.createdAt) - new Date(a.visitDate || a.createdAt)).slice(0, 10);

                if (visits.length === 0) {
                    historyTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">لا توجد زيارات سابقة</td></tr>';
                } else {
                    historyTableBody.innerHTML = visits.map(v => `
                        <tr>
                            <td>${v.visitDate ? Utils.escapeHTML(Utils.formatDateTime(v.visitDate)) : '-'}</td>
                            <td>${v.exitDate ? Utils.escapeHTML(Utils.formatDateTime(v.exitDate)) : '-'}</td>
                            <td>${Utils.escapeHTML(v.reason || '-')}</td>
                            <td>${Utils.escapeHTML(v.diagnosis || '-')}</td>
                            <td>${Utils.escapeHTML(v.treatment || '-')}</td>
                            <td>${Utils.escapeHTML(v.employeeLocation || v.workArea || '-')}</td>
                        </tr>
                    `).join('');
                }
            };

            if (codeInput && historyTableBody) {
                codeInput.addEventListener('blur', loadVisitHistory);
                codeInput.addEventListener('input', () => {
                    if (codeInput.value.trim().length >= 3) {
                        loadVisitHistory();
                    }
                });
            }

            if (personTypeSelect) {
                personTypeSelect.addEventListener('change', () => {
                    const historySection = document.querySelector('#visit-history-table')?.closest('.mt-6');
                    if (historySection) {
                        historySection.style.display = personTypeSelect.value === 'employee' ? 'block' : 'none';
                    }
                    if (personTypeSelect.value === 'employee') {
                        loadVisitHistory();
                    }
                });
            }

            // تحميل التاريخ عند تحميل النموذج للتعديل
            if (visitData && visitData.employeeCode) {
                loadVisitHistory();
            }

            // تحميل قائمة المقاولين إذا كان النوع مقاول
            if (visitData?.personType === 'contractor') {
                const contractorSelect = document.getElementById('visit-contractor-name-select');
                if (contractorSelect) {
                    Clinic.loadContractorsIntoSelect(contractorSelect);
                    // تعيين القيمة الحالية إذا كانت موجودة
                    if (visitData.employeeName || visitData.contractorName) {
                        contractorSelect.value = visitData.employeeName || visitData.contractorName || '';
                    }
                }
            }

            if (typeof Clinic.handlePersonTypeChange === 'function') {
                Clinic.handlePersonTypeChange();
            }

            if (typeof Clinic.setupClinicWorkplaceDatalist === 'function') {
                Clinic.setupClinicWorkplaceDatalist('visit-factory', 'visit-employee-location', 'visit-employee-location-datalist');
                Clinic.setupClinicWorkplaceDatalist('visit-contractor-factory', 'visit-work-area', 'visit-work-area-datalist');
            }

            // تحميل قائمة الأدوية المتاحة
            const medicationSelect = document.getElementById('visit-medication-select');
            const medicationsList = document.getElementById('visit-medications-list');
            const addMedicationBtn = document.getElementById('visit-add-medication-btn');
            const medicationQuantityInput = document.getElementById('visit-medication-quantity');
            const medicationDatalist = document.getElementById('visit-medications-datalist');

            let selectedMedications = visitData?.medications && Array.isArray(visitData.medications)
                ? [...visitData.medications]
                : [];

            const loadMedicationsIntoSelect = () => {
                if (!medicationSelect || !medicationDatalist) return;
                const medications = this.getMedications().filter(m => {
                    const remaining = m.remainingQuantity ?? m.quantity ?? 0;
                    if (remaining <= 0) return false;
                    const alreadySelected = selectedMedications.some(sm => sm.medicationId === m.id);
                    return !alreadySelected;
                });
                const map = {};
                medicationDatalist.innerHTML = medications.map(m => {
                    const remaining = m.remainingQuantity ?? m.quantity ?? 0;
                    const label = `${m.name || ''} (متوفر: ${remaining})`;
                    const key = String(m.name || '').toLowerCase().trim();
                    if (key) map[key] = m.id;
                    return `<option value="${Utils.escapeHTML(label)}"></option>`;
                }).join('');
                medicationSelect.dataset.nameToId = JSON.stringify(map);
                medicationSelect.dataset.selectedId = '';
            };

            const renderMedicationsList = () => {
                if (!medicationsList) return;
                if (selectedMedications.length === 0) {
                    medicationsList.innerHTML = '';
                    return;
                }
                medicationsList.innerHTML = selectedMedications.map((med, idx) => {
                    const medication = this.getMedications().find(m => m.id === med.medicationId);
                    return `
                        <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2" data-med-id="${med.medicationId || ''}">
                            <div>
                                <span class="font-medium">${Utils.escapeHTML(med.medicationName || medication?.name || '')}</span>
                                <span class="text-sm text-gray-600 mr-2">× ${med.quantity || 1}</span>
                            </div>
                            <button type="button" class="btn-icon btn-icon-danger btn-xs" data-remove-med="${idx}">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `;
                }).join('');

                // ربط أحداث الحذف
                medicationsList.querySelectorAll('[data-remove-med]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const idx = parseInt(btn.getAttribute('data-remove-med'), 10);
                        selectedMedications.splice(idx, 1);
                        renderMedicationsList();
                        loadMedicationsIntoSelect();
                    });
                });
            };

            if (addMedicationBtn && medicationSelect && medicationQuantityInput) {
                addMedicationBtn.addEventListener('click', () => {
                    const raw = (medicationSelect.value || '').trim();
                    const nameOnly = raw.replace(/\s*\(.*\)\s*$/, '').trim();
                    const map = (() => {
                        try { return JSON.parse(medicationSelect.dataset.nameToId || '{}'); } catch (e) { return {}; }
                    })();
                    const medicationId = medicationSelect.dataset.selectedId || map[String(nameOnly).toLowerCase().trim()] || '';
                    const quantity = parseInt(medicationQuantityInput.value, 10) || 1;

                    if (!medicationId) {
                        Notification.warning('يرجى اختيار دواء');
                        return;
                    }

                    const medication = this.getMedications().find(m => m.id === medicationId);
                    if (!medication) {
                        Notification.error('الدواء المحدد غير موجود');
                        return;
                    }

                    const remaining = medication.remainingQuantity ?? medication.quantity ?? 0;
                    const alreadySelectedQty = selectedMedications
                        .filter(sm => sm.medicationId === medicationId)
                        .reduce((sum, sm) => sum + (sm.quantity || 0), 0);

                    if (alreadySelectedQty + quantity > remaining) {
                        Notification.error(`الكمية المتاحة غير كافية. المتوفر: ${remaining - alreadySelectedQty}`);
                        return;
                    }

                    selectedMedications.push({
                        medicationId: medicationId,
                        medicationName: medication.name || '',
                        quantity: quantity
                    });

                    medicationQuantityInput.value = '1';
                    medicationSelect.value = '';
                    renderMedicationsList();
                    loadMedicationsIntoSelect();
                });
            }
            if (medicationSelect && !medicationSelect.hasAttribute('data-datalist-attached')) {
                medicationSelect.setAttribute('data-datalist-attached', 'true');
                medicationSelect.addEventListener('input', () => {
                    const raw = (medicationSelect.value || '').trim();
                    const nameOnly = raw.replace(/\s*\(.*\)\s*$/, '').trim();
                    const map = (() => {
                        try { return JSON.parse(medicationSelect.dataset.nameToId || '{}'); } catch (e) { return {}; }
                    })();
                    medicationSelect.dataset.selectedId = map[String(nameOnly).toLowerCase().trim()] || '';
                });
                medicationSelect.addEventListener('blur', () => {
                    try {
                        const raw = (medicationSelect.value || '').trim();
                        if (!raw) return;
                        const nameOnly = raw.replace(/\s*\(.*\)\s*$/, '').trim();
                        const map = (() => {
                            try { return JSON.parse(medicationSelect.dataset.nameToId || '{}'); } catch (e) { return {}; }
                        })();
                        const ok = !!(medicationSelect.dataset.selectedId || map[String(nameOnly).toLowerCase().trim()]);
                        if (!ok) {
                            medicationSelect.value = '';
                            medicationSelect.dataset.selectedId = '';
                            Notification?.warning?.('يرجى اختيار الدواء من القائمة فقط');
                        }
                    } catch (e) { /* ignore */ }
                });
            }

            loadMedicationsIntoSelect();
            renderMedicationsList();
        }, 300);

        const form = modal.querySelector('#visit-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.clearVisitFormAlert();

            // منع النقر المتكرر
            const submitBtn = form?.querySelector('button[type="submit"]') ||
                e.target?.querySelector('button[type="submit"]');

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

            // فحص العناصر قبل الاستخدام
            const personTypeEl = document.getElementById('visit-person-type');
            const entryValueEl = document.getElementById('visit-date');
            const exitValueEl = document.getElementById('visit-exit-date');

            if (!personTypeEl || !entryValueEl || !exitValueEl) {
                this.showVisitFormAlert('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
                return;
            }

            const rawPersonType = String(personTypeEl.value || '').trim().toLowerCase();
            const personType = rawPersonType === 'employee' ? 'employee' : 'contractor';
            const entryValue = entryValueEl.value;
            const exitValue = exitValueEl.value;
            const contractorWorkerValue = document.getElementById('visit-contractor-worker')?.value.trim() || '';
            const workAreaValue = personType === 'employee'
                ? document.getElementById('visit-employee-location')?.value.trim() || ''
                : document.getElementById('visit-work-area')?.value.trim() || '';
            const contractorPositionValue = personType === 'contractor'
                ? document.getElementById('visit-contractor-position')?.value.trim() || ''
                : null;

            // الحصول على اسم المقاول من select أو input حسب النوع
            let personName = '';
            if (rawPersonType === 'contractor') {
                const contractorSelect = document.getElementById('visit-contractor-name-select');
                const employeeNameInput = document.getElementById('visit-employee-name');
                personName = contractorSelect ? (contractorSelect.value || '').trim() : (employeeNameInput ? (employeeNameInput.value || '').trim() : '');

                // ✅ إلزام الاختيار من القائمة فقط
                if (contractorSelect) {
                    const allowed = (() => {
                        try { return JSON.parse(contractorSelect.dataset.allowedValues || '[]'); } catch (e) { return []; }
                    })();
                    if (personName && !allowed.includes(personName.toLowerCase().trim())) {
                        this.showVisitFormAlert('اسم المقاول يجب اختياره من القائمة فقط');
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalText;
                        }
                        return;
                    }
                }
            } else {
                const employeeNameInput = document.getElementById('visit-employee-name');
                personName = employeeNameInput ? (employeeNameInput.value || '').trim() : '';
            }

            // الحصول على الأدوية المختارة من DOM
            const medicationsListContainer = document.getElementById('visit-medications-list');
            const selectedMedicationsData = [];
            if (medicationsListContainer) {
                medicationsListContainer.querySelectorAll('[data-med-id]').forEach(item => {
                    const medicationId = item.getAttribute('data-med-id');
                    if (!medicationId) return;

                    const quantityText = item.textContent.match(/×\s*(\d+)/);
                    const quantity = quantityText ? parseInt(quantityText[1], 10) : 1;
                    const medicationNameEl = item.querySelector('.font-medium');
                    const medicationName = medicationNameEl ? medicationNameEl.textContent.trim() : '';

                    selectedMedicationsData.push({
                        medicationId: medicationId,
                        medicationName: medicationName,
                        quantity: quantity
                    });
                });
            }

            // الحصول على قيمة المصنع
            const factoryValue = personType === 'employee' 
                ? document.getElementById('visit-factory')?.value.trim() || null
                : document.getElementById('visit-contractor-factory')?.value.trim() || null;
            
            // الحصول على اسم المصنع من القائمة
            let factoryName = null;
            if (factoryValue) {
                const sites = this.getSiteOptions();
                const selectedSite = sites.find(site => site.id === factoryValue);
                factoryName = selectedSite ? selectedSite.name : null;
            }

            // ✅ إصلاح: تحويل datetime-local إلى ISO string بشكل صحيح
            // datetime-local يعيد قيمة بصيغة YYYY-MM-DDTHH:mm (بدون timezone)
            // يجب التحقق من أن القيمة ليست فارغة قبل التحويل
            // ✅ إصلاح مشكلة الوقت الثابت: تحويل صحيح من local time إلى ISO
            let visitDateISO = null;
            let exitDateISO = null;
            
            if (entryValue && entryValue.trim()) {
                try {
                    // datetime-local يعيد قيمة local time بصيغة YYYY-MM-DDTHH:mm
                    // نحتاج لإنشاء Date object يمثل هذا الوقت المحلي بشكل صحيح
                    // ثم تحويله إلى ISO مع الحفاظ على الوقت المحلي المقصود
                    const [datePart, timePart] = entryValue.split('T');
                    if (datePart && timePart) {
                        const [year, month, day] = datePart.split('-').map(Number);
                        const [hours, minutes] = timePart.split(':').map(Number);
                        
                        // إنشاء Date object باستخدام الوقت المحلي
                        const entryDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
                        if (!isNaN(entryDate.getTime())) {
                            // تحويل إلى ISO string (سيتم تحويله إلى UTC تلقائياً)
                            visitDateISO = entryDate.toISOString();
                        } else {
                            if (AppState.debugMode) {
                                Utils.safeWarn('⚠️ قيمة وقت الدخول غير صحيحة:', entryValue);
                            }
                        }
                    } else {
                        // Fallback: استخدام الطريقة القديمة إذا فشل التحليل
                        const entryDate = new Date(entryValue);
                        if (!isNaN(entryDate.getTime())) {
                            visitDateISO = entryDate.toISOString();
                        }
                    }
                } catch (error) {
                    if (AppState.debugMode) {
                        Utils.safeError('❌ خطأ في تحويل وقت الدخول:', error);
                    }
                }
            }
            
            if (exitValue && exitValue.trim()) {
                try {
                    // نفس المنطق لوقت الخروج
                    const [datePart, timePart] = exitValue.split('T');
                    if (datePart && timePart) {
                        const [year, month, day] = datePart.split('-').map(Number);
                        const [hours, minutes] = timePart.split(':').map(Number);
                        
                        const exitDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
                        if (!isNaN(exitDate.getTime())) {
                            exitDateISO = exitDate.toISOString();
                        } else {
                            if (AppState.debugMode) {
                                Utils.safeWarn('⚠️ قيمة وقت الخروج غير صحيحة:', exitValue);
                            }
                        }
                    } else {
                        // Fallback
                        const exitDate = new Date(exitValue);
                        if (!isNaN(exitDate.getTime())) {
                            exitDateISO = exitDate.toISOString();
                        }
                    }
                } catch (error) {
                    if (AppState.debugMode) {
                        Utils.safeError('❌ خطأ في تحويل وقت الخروج:', error);
                    }
                }
            }

            // ✅ الحصول على اسم المستخدم الحالي
            const currentUser = AppState.currentUser;
            const currentEmail = (currentUser?.email || '').toLowerCase().trim();
            const users = AppState.appData.users || [];
            const dbUser = users.find(u => (u.email || '').toLowerCase().trim() === currentEmail);
            const createdByName = dbUser?.name || currentUser?.name || currentEmail || 'مستخدم';
            
            console.log('✅ [CLINIC-OLD] createdByName:', createdByName);

            const formData = {
                id: visitData?.id || Utils.generateId('CLINIC_VISIT'),
                personType: personType,
                // حفظ الاسم في الحقل المناسب حسب نوع الشخص لضمان الفصل الصحيح
                employeeName: personType === 'employee' ? personName : null,
                employeeCode: personType === 'employee' ? document.getElementById('visit-employee-code').value.trim() : null,
                employeeNumber: personType === 'employee' ? document.getElementById('visit-employee-code').value.trim() : null,
                employeePosition: personType === 'employee' ? document.getElementById('visit-employee-position')?.value.trim() || '' : (contractorPositionValue || null),
                contractorPosition: contractorPositionValue || null,
                employeeDepartment: personType === 'employee' ? document.getElementById('visit-employee-department')?.value.trim() || '' : null,
                factory: factoryValue,
                factoryName: factoryName,
                employeeLocation: personType === 'employee' ? workAreaValue : null,
                contractorName: personType === 'contractor' ? personName : null,
                contractorWorkerName: personType === 'contractor' ? contractorWorkerValue : null,
                externalName: null,
                workArea: workAreaValue || null,
                visitDate: visitDateISO,
                exitDate: exitDateISO,
                visitType: document.getElementById('visit-type')?.value?.trim() || null,
                reason: document.getElementById('visit-reason').value.trim(),
                diagnosis: document.getElementById('visit-diagnosis').value.trim(),
                treatment: document.getElementById('visit-treatment').value.trim(),
                medications: selectedMedicationsData.length > 0 ? selectedMedicationsData : null,
                createdAt: visitData?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                // ✅ إضافة createdBy و updatedBy
                createdBy: visitData?.createdBy || createdByName,
                updatedBy: createdByName,
                email: currentEmail,
                userId: currentUser?.id || ''
            };

            Loading.show();
            try {
                // ===============================
                // حساب دلتا الأدوية (للإضافة + للتعديل)
                // ===============================
                const sumByMedicationId = (arr) => {
                    const map = {};
                    (Array.isArray(arr) ? arr : []).forEach((m) => {
                        const id = (m && (m.medicationId || m.id)) ? String(m.medicationId || m.id) : '';
                        if (!id) return;
                        const qty = parseInt(m.quantity, 10) || 0;
                        map[id] = (map[id] || 0) + qty;
                    });
                    return map;
                };

                const oldMedsArr = isEdit ? this.normalizeVisitMedications(visitData?.medications) : [];
                const oldQtyMap = sumByMedicationId(oldMedsArr);
                const newQtyMap = sumByMedicationId(selectedMedicationsData);

                const medicationAdjustments = [];
                const allIds = new Set([...Object.keys(oldQtyMap), ...Object.keys(newQtyMap)]);
                allIds.forEach((id) => {
                    const delta = (newQtyMap[id] || 0) - (oldQtyMap[id] || 0);
                    if (delta !== 0) {
                        medicationAdjustments.push({ medicationId: id, delta });
                    }
                });

                const hasInventoryChange = medicationAdjustments.length > 0;
                const medications = hasInventoryChange ? this.getMedications() : [];

                // تحقق قبل التعديل: لا نسمح بزيادة صرف أكبر من الرصيد الحالي
                if (hasInventoryChange) {
                    for (const adj of medicationAdjustments) {
                        if (adj.delta <= 0) continue;
                        const medication = medications.find(m => String(m.id) === String(adj.medicationId));
                        if (!medication) {
                            throw new Error('الدواء المحدد غير موجود في المخزون');
                        }
                        const currentRemaining = parseInt(medication.remainingQuantity ?? medication.quantity ?? 0, 10) || 0;
                        if (currentRemaining < adj.delta) {
                            const medName = medication.name || medication.medicationName || 'دواء';
                            throw new Error(`الكمية المتاحة غير كافية للدواء: ${medName}. المتوفر: ${currentRemaining}`);
                        }
                    }
                }

                // حفظ البيانات محلياً أولاً
                if (isEdit) {
                    const index = AppState.appData.clinicVisits.findIndex(v => v.id === visitData.id);
                    if (index !== -1) {
                        AppState.appData.clinicVisits[index] = formData;
                    }
                } else {
                    AppState.appData.clinicVisits.push(formData);
                }

                // خصم/استرجاع الكمية من رصيد الأدوية بناءً على دلتا (للإضافة + للتعديل)
                if (hasInventoryChange) {
                    for (const adj of medicationAdjustments) {
                        const medication = medications.find(m => String(m.id) === String(adj.medicationId));
                        if (!medication) continue;

                        const currentRemaining = parseInt(medication.remainingQuantity ?? medication.quantity ?? 0, 10) || 0;

                        // التأكد من وجود quantityAdded (الكمية الأصلية المضافة) لضمان حساب "المنصرف" بشكل صحيح
                        const hasQtyAdded = (typeof medication.quantityAdded === 'number' && medication.quantityAdded > 0);
                        if (!hasQtyAdded && adj.delta > 0) {
                            const baseQty = parseInt(medication.quantity ?? 0, 10) || 0;
                            // نضمن أن quantityAdded >= الرصيد قبل الخصم + مقدار الخصم الحالي
                            medication.quantityAdded = Math.max(baseQty, currentRemaining + adj.delta);
                        }

                        // delta > 0 => صرف إضافي (نقص)، delta < 0 => استرجاع (زيادة)
                        let newRemaining = currentRemaining - adj.delta;
                        newRemaining = Math.max(0, newRemaining);

                        // لا نرفع الرصيد فوق الكمية الأصلية إذا كانت معروفة
                        const cap = (typeof medication.quantityAdded === 'number' && medication.quantityAdded > 0)
                            ? medication.quantityAdded
                            : (typeof medication.quantity === 'number' && medication.quantity > 0 ? medication.quantity : null);
                        if (cap !== null) {
                            newRemaining = Math.min(cap, newRemaining);
                        }

                        medication.remainingQuantity = newRemaining;
                    }

                    AppState.appData.medications = medications;
                    AppState.appData.clinicMedications = medications;
                    AppState.appData.clinicInventory = medications;
                }

                // حفظ البيانات محلياً
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                // تنبيه وإشعار المدير عند وصول زيارات الشهر إلى الحد المضبوط أو أكثر (بدون التأثير على سير العمل)
                try {
                    const threshold = this.getMonthlyVisitsAlertThreshold();
                    const monthlyCount = this.getMonthlyVisitCountForPerson(formData);
                    if (monthlyCount >= threshold) {
                        const who = (formData.personType || '').toString().toLowerCase() === 'employee' ? 'الموظف' : 'المقاول/العامل';
                        if (typeof Notification !== 'undefined' && Notification.warning) {
                            Notification.warning('تنبيه: عدد زيارات ' + who + ' للعيادة هذا الشهر وصل أو تجاوز ' + threshold + ' زيارة. تم إشعار مدير النظام.');
                        }
                        this.notifyAdminsAboutHighClinicVisits(formData, monthlyCount).catch(function() {});
                    }
                } catch (e) {
                    Utils.safeWarn('فحص تردد العيادة الشهري:', e);
                }

                // ✅ إغلاق النموذج فوراً مع المزامنة في الخلفية (بدون انتظار)
                Loading.hide();
                Notification.success(`تم ${isEdit ? 'تحديث' : 'تسجيل'} الزيارة بنجاح`);
                modal.remove();

                // 🔄 المزامنة في الخلفية (لا تمنع واجهة المستخدم) - بدون انتظار للأدوية
                const rpcTimeoutMs = 15000; // 15 ثانية
                (async () => {
                    try {
                        // ✅ تحديث الزيارة فقط (أساسي)
                        if (isEdit) {
                            const vr = await GoogleIntegration.sendRequest({
                                action: 'updateClinicVisit',
                                data: { visitId: visitData.id, updateData: formData, __timeoutMs: rpcTimeoutMs }
                            });
                            this.assertClinicVisitRpcResult(vr);
                        } else {
                            const vr = await GoogleIntegration.sendRequest({
                                action: 'addClinicVisit',
                                data: { ...formData, __timeoutMs: rpcTimeoutMs }
                            });
                            this.assertClinicVisitRpcResult(vr);
                            this.applyClinicVisitIdFromServer(formData, vr);
                        }

                        // ✅ تحديث الأدوية في الخلفية بدون انتظار (لا يمنع نجاح العملية)
                        if (hasInventoryChange) {
                            const medicationsNow = this.getMedications();
                            const uniqueIds = [...new Set(medicationAdjustments.map(a => String(a.medicationId)))];

                            // تحديث بدون await - في الخلفية تماماً
                            uniqueIds.forEach(async (id) => {
                                const medication = medicationsNow.find(m => String(m.id) === String(id));
                                if (!medication) return;

                                try {
                                    await GoogleIntegration.sendRequest({
                                        action: 'updateMedication',
                                        data: {
                                            medicationId: medication.id,
                                            updateData: {
                                                remainingQuantity: medication.remainingQuantity,
                                                quantityAdded: medication.quantityAdded ?? medication.quantity ?? medication.remainingQuantity
                                            },
                                            __timeoutMs: rpcTimeoutMs
                                        }
                                    });
                                } catch (medError) {
                                    // تجاهل أخطاء الأدوية - ستحدث في الخلفية
                                    Utils.safeWarn('⚠️ خطأ في تحديث دواء في الخلفية:', medError);
                                }
                            });

                            document.dispatchEvent(new CustomEvent('data-saved', {
                                detail: {
                                    module: 'medications',
                                    action: 'تحديث',
                                    data: { updated: uniqueIds.length }
                                }
                            }));
                        }

                        document.dispatchEvent(new CustomEvent('data-saved', {
                            detail: {
                                module: 'clinicVisits',
                                action: isEdit ? 'تحديث' : 'إضافة',
                                data: formData
                            }
                        }));

                        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                            window.DataManager.save();
                        }
                        this.refreshClinicVisitsFromServerAfterSave();
                    } catch (syncError) {
                        // ✅ تجاهل أخطاء المزامنة - البيانات حُفظت محلياً بنجاح
                        Utils.safeWarn('⚠️ خطأ في المزامنة مع قاعدة البيانات (تم الحفظ محلياً):', syncError);
                        try {
                            if (typeof window.DataManager !== 'undefined' && window.DataManager.addToPendingSync) {
                                window.DataManager.addToPendingSync('ClinicVisits', AppState.appData.clinicVisits);
                            }
                        } catch (e) { /* ignore */ }
                        // لا تظهر رسالة خطأ - العملية نجحت محلياً
                    }
                })();

                // تحديث واجهة المستخدم فقط بدون إعادة تحميل كامل
                setTimeout(() => {
                    // تحديث تبويب الزيارات
                    const visitsPanel = document.querySelector('.clinic-tab-panel[data-tab-panel="visits"]');
                    if (visitsPanel && this.state.activeTab === 'visits') {
                        this.renderVisitsTab();
                    }

                    // تحديث تبويب الأدوية دائماً بعد صرف دواء (لإظهار الرصيد والمنصرف المحدث)
                    // حتى لو لم يكن مفتوحاً، سيتم تحديثه عند فتحه
                    if (hasInventoryChange) {
                        const medicationsPanel = document.querySelector('.clinic-tab-panel[data-tab-panel="medications"]');
                        if (medicationsPanel) {
                            // إذا كان التبويب مفتوحاً، قم بتحديثه مباشرة
                            if (this.state.activeTab === 'medications') {
                                this.renderMedicationsTab();
                            }
                            // إذا لم يكن مفتوحاً، سيتم تحديثه تلقائياً عند فتحه لأن البيانات محدثة في AppState
                        }
                    }

                    // تحديث تبويب الأدوية المنصرفة إذا كان مفتوحاً (لإظهار الدواء الجديد)
                    const dispensedPanel = document.querySelector('.clinic-tab-panel[data-tab-panel="dispensed-medications"]');
                    if (dispensedPanel && this.state.activeTab === 'dispensed-medications') {
                        this.renderDispensedMedicationsTab();
                    }

                    // تحديث الإحصائيات
                    const totalVisitsEl = document.querySelector('#total-visits');
                    if (totalVisitsEl) {
                        totalVisitsEl.textContent = AppState.appData.clinicVisits.length;
                    }
                }, 100);

            } catch (error) {
                Loading.hide();
                this.showVisitFormAlert('حدث خطأ: ' + (error.message || 'غير معروف'));

                // استعادة الزر في حالة الخطأ
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النموذج.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) modal.remove();
            }
        });
    },

    async showMedicationForm(record = null) {
        this.ensureData();
        const isEdit = !!record;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        const safeValue = (value = '') => Utils.escapeHTML(value || '');
        const purchaseDateValue = record?.purchaseDate ? new Date(record.purchaseDate).toISOString().slice(0, 10) : '';
        const expiryDateValue = record?.expiryDate ? new Date(record.expiryDate).toISOString().slice(0, 10) : '';
        const statusInfo = this.calculateMedicationStatus(record || {});

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 780px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">${isEdit ? 'تعديل بيانات الدواء' : 'تسجيل دواء جديد'}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="medication-form" class="space-y-5">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">اسم الدواء *</label>
                                <input type="text" id="med-name" required class="form-input" placeholder="اسم الدواء" value="${safeValue(record?.name || record?.medicationName)}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">نوع الدواء *</label>
                                <input type="text" id="med-type" required class="form-input" placeholder="حبوب، شراب، حقن..." value="${safeValue(record?.type || record?.medicationType)}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الاستخدام</label>
                                <input type="text" id="med-usage" class="form-input" placeholder="الاستخدام الطبي للدواء" value="${safeValue(record?.usage || record?.notes || '')}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">تاريخ الشراء *</label>
                                <input type="date" id="med-purchase" required class="form-input" value="${purchaseDateValue}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">تاريخ انتهاء الصلاحية</label>
                                <input type="date" id="med-expiry" class="form-input" value="${expiryDateValue}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الكمية المضافة *</label>
                                <input type="number" id="med-quantity" required class="form-input" min="0" placeholder="الكمية المضافة" value="${record?.quantityAdded ?? record?.quantity ?? 0}">
                        </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الكمية المتبقية *</label>
                                <input type="number" id="med-remaining" required class="form-input" min="0" placeholder="الكمية المتاحة" value="${record?.remainingQuantity ?? record?.quantity ?? 0}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">موقع التخزين</label>
                                <input type="text" id="med-location" class="form-input" placeholder="مثال: غرفة الأدوية" value="${safeValue(record?.location)}">
                            </div>
                            <div class="flex flex-col justify-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                                <span class="text-sm font-semibold text-gray-700 mb-1">الحالة الحالية</span>
                                <span id="med-status-badge" class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${this.getMedicationStatusClasses(statusInfo.status)}">
                                    <i class="fas fa-info-circle"></i>
                                    ${statusInfo.status || 'ساري'}
                                </span>
                                <span id="med-status-hint" class="text-xs text-gray-500 mt-2">${this.getMedicationStatusHint(statusInfo)}</span>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">ملاحظات إضافية</label>
                            <textarea id="med-notes" class="form-input" rows="3" placeholder="أدخل أي ملاحظات أو تعليمات خاصة">${safeValue(record?.notes)}</textarea>
                        </div>
                        <div class="flex items-center justify-end gap-3 pt-4 border-t form-actions-centered">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? 'حفظ التعديلات' : 'تسجيل الدواء'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const form = modal.querySelector('#medication-form');
        const purchaseInput = form.querySelector('#med-purchase');
        const expiryInput = form.querySelector('#med-expiry');
        const statusBadge = form.querySelector('#med-status-badge');
        const statusHint = form.querySelector('#med-status-hint');

        const updateStatusPreview = () => {
            const info = this.calculateMedicationStatus({ expiryDate: expiryInput.value ? new Date(expiryInput.value).toISOString() : null });
            statusBadge.className = `inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${this.getMedicationStatusClasses(info.status)}`;
            statusBadge.innerHTML = `<i class="fas fa-info-circle"></i>${info.status}`;
            statusHint.textContent = this.getMedicationStatusHint(info);
        };

        expiryInput?.addEventListener('change', updateStatusPreview);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const name = form.querySelector('#med-name').value.trim();
            const type = form.querySelector('#med-type').value.trim();
            const usage = form.querySelector('#med-usage')?.value.trim() || '';
            const purchaseDate = form.querySelector('#med-purchase').value;
            const expiry = form.querySelector('#med-expiry').value;
            const quantityAdded = parseInt(form.querySelector('#med-quantity').value, 10) || 0;
            const remainingQuantity = parseInt(form.querySelector('#med-remaining').value, 10) || 0;
            const location = form.querySelector('#med-location').value.trim();
            const notes = form.querySelector('#med-notes').value.trim();
            const createdAt = record?.createdAt || new Date().toISOString();
            const createdBy = record?.createdBy || this.getCurrentUserSummary();

            const purchaseISO = purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString();
            const expiryISO = expiry ? new Date(expiry).toISOString() : '';
            const statusInfoLatest = this.calculateMedicationStatus({ expiryDate: expiryISO });
            const currentUser = this.getCurrentUserSummary();

            const payload = this.normalizeMedicationRecord({
                id: record?.id || Utils.generateId('MED'),
                name,
                type,
                usage: usage,
                purchaseDate: purchaseISO,
                expiryDate: expiryISO,
                quantityAdded,
                remainingQuantity,
                location,
                notes,
                createdAt,
                createdBy,
                createdById: createdBy?.id || AppState.currentUser?.id || '',
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser,
                status: statusInfoLatest.status,
                daysRemaining: statusInfoLatest.daysRemaining
            });

            Loading.show();
            try {
                // حفظ البيانات محلياً أولاً
                const medications = AppState.appData.medications || [];
                if (isEdit) {
                    const index = medications.findIndex((item) => item.id === payload.id);
                    if (index !== -1) {
                        medications[index] = payload;
                    } else {
                        medications.push(payload);
                    }
                } else {
                    medications.push(payload);
                }

                AppState.appData.medications = medications;
                AppState.appData.clinicMedications = medications;
                AppState.appData.clinicInventory = medications;

                // حفظ البيانات محلياً
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                // إغلاق النموذج وإظهار رسالة النجاح فوراً
                Loading.hide();
                Notification.success(isEdit ? 'تم تحديث بيانات الدواء بنجاح' : 'تم تسجيل الدواء بنجاح');
                modal.remove();
                this.state.medicationAlertsNotified.delete(payload.id);

                // تحديث واجهة المستخدم فقط بدون إعادة تحميل كامل
                setTimeout(() => {
                    const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="medications"]');
                    if (panel && this.state.activeTab === 'medications') {
                        this.renderMedicationsTab();
                    }

                    // تحديث الإحصائيات
                    const totalMedsEl = document.querySelector('#total-medications');
                    if (totalMedsEl) {
                        totalMedsEl.textContent = medications.length;
                    }
                }, 100);

                // المزامنة مع Google Sheets في الخلفية
                (async () => {
                    try {
                        if (isEdit) {
                            await GoogleIntegration.sendRequest({
                                action: 'updateMedication',
                                data: { medicationId: payload.id, updateData: payload }
                            });
                        } else {
                            await GoogleIntegration.sendRequest({
                                action: 'addMedication',
                                data: payload
                            });
                        }

                        // إطلاق حدث لإشعار نظام المزامنة اللحظية
                        document.dispatchEvent(new CustomEvent('data-saved', {
                            detail: {
                                module: 'medications',
                                action: isEdit ? 'تحديث' : 'إضافة',
                                data: payload
                            }
                        }));
                    } catch (syncError) {
                        Utils.safeWarn('⚠️ خطأ في المزامنة مع Google Sheets:', syncError);
                    }
                })();

            } catch (error) {
                Loading.hide();
                Notification.error('حدث خطأ: ' + error.message);
            }
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النموذج.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) modal.remove();
            }
        });
    },

    async viewVisit(id) {
        this.ensureData();
        const visit = AppState.appData.clinicVisits.find(v => v.id === id);
        if (!visit) return;
        
        // ✅ التأكد من وجود createdBy و updatedBy (للبيانات القديمة)
        if (!visit.createdBy) {
            visit.createdBy = null;
        }
        if (!visit.updatedBy) {
            visit.updatedBy = null;
        }
        
        const personTypeLabel = visit.personType === 'employee' ? 'موظف' : visit.personType === 'contractor' ? 'مقاول' : 'عمالة خارجية';
        const primaryNameLabel = visit.personType === 'employee' ? 'اسم الموظف' : visit.personType === 'contractor' ? 'اسم المقاول' : 'اسم الجهة';
        const primaryNameValue = visit.employeeName || visit.contractorName || visit.externalName || '';
        const workerNameSection = (visit.personType === 'contractor' || visit.personType === 'external') && visit.contractorWorkerName
            ? `
                <div class="col-span-2">
                    <label class="text-sm font-semibold text-gray-600">اسم الموظف التابع:</label>
                    <p class="text-gray-800">${Utils.escapeHTML(visit.contractorWorkerName)}</p>
                </div>
            `
            : '';
        const locationLabel = visit.personType === 'employee' ? 'مكان العمل' : 'منطقة / موقع العمل';
        const locationValue = visit.personType === 'employee' ? visit.employeeLocation : visit.workArea;
        const exitTimeDisplay = visit.exitDate
            ? Utils.escapeHTML(Utils.formatDateTime(visit.exitDate))
            : '<span class="text-xs text-gray-500">لم يتم تسجيل الخروج</span>';

        const medicationsDisplay = visit.medications && Array.isArray(visit.medications) && visit.medications.length > 0
            ? visit.medications.map(med => `
                <div style="background: white; border: 2px solid #667eea; border-radius: 10px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600; color: #667eea;">${Utils.escapeHTML(med.medicationName || '')}</span>
                    <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">الكمية: ${med.quantity || 1}</span>
                </div>
            `).join('')
            : '<p style="color: #999; font-style: italic;">لا توجد أدوية منصرفة</p>';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1100px; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                <div class="modal-header modal-header-centered" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px 30px; border-radius: 20px 20px 0 0;">
                    <h2 class="modal-title" style="color: white; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-clipboard-list" style="font-size: 28px;"></i>
                        تفاصيل الزيارة
                    </h2>
                    <button class="modal-close" style="color: white; font-size: 24px; background: rgba(255,255,255,0.2); border-radius: 8px; padding: 8px 12px; transition: all 0.3s;" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body" style="padding: 30px; background: #f8f9fa;">
                    <div class="space-y-6">
                        <!-- قسم معلومات المريض -->
                        <div class="form-section" style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                            <h3 class="section-title" style="color: #667eea; font-size: 20px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-user-circle" style="font-size: 24px;"></i>
                                معلومات المريض
                            </h3>
                            
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #667eea;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #667eea; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-users"></i>
                                        نوع الشخص
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">
                                        <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px;">${personTypeLabel}</span>
                                    </p>
                                </div>
                                ${visit.personType === 'employee' && (visit.employeeCode || visit.employeeNumber) ? `
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #667eea;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #667eea; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-id-card"></i>
                                        الكود الوظيفي
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${Utils.escapeHTML(visit.employeeCode || visit.employeeNumber || '')}</p>
                                </div>
                                ` : ''}
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #667eea;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #667eea; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-user"></i>
                                        ${primaryNameLabel}
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${Utils.escapeHTML(primaryNameValue)}</p>
                                </div>
                                ${visit.personType === 'employee' && visit.employeePosition ? `
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #667eea;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #667eea; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-briefcase"></i>
                                        الوظيفة
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${Utils.escapeHTML(visit.employeePosition)}</p>
                                </div>
                                ` : ''}
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #667eea;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #667eea; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-map-marker-alt"></i>
                                        ${locationLabel}
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${Utils.escapeHTML(locationValue || '-')}</p>
                                </div>
                                ${workerNameSection ? `
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #667eea;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #667eea; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-user-tie"></i>
                                        اسم الموظف التابع
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${Utils.escapeHTML(visit.contractorWorkerName)}</p>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        <!-- قسم معلومات الزيارة -->
                        <div class="form-section" style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                            <h3 class="section-title" style="color: #fc6c85; font-size: 20px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-calendar-check" style="font-size: 24px;"></i>
                                معلومات الزيارة
                            </h3>
                            
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #fc6c85;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #fc6c85; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-clock"></i>
                                        وقت الدخول
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${visit.visitDate ? Utils.escapeHTML(Utils.formatDateTime(visit.visitDate)) : '-'}</p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #fc6c85;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #fc6c85; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-sign-out-alt"></i>
                                        وقت الخروج
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${exitTimeDisplay}</p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #fc6c85;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #fc6c85; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-hourglass-half"></i>
                                        إجمالي الوقت
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${Clinic.calculateTotalTime(visit.visitDate, visit.exitDate)}</p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #fc6c85;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #fc6c85; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-user-check"></i>
                                        تم التسجيل بواسطة
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${(() => {
                                        if (!visit.createdBy) return 'غير محدد';
                                        if (typeof visit.createdBy === 'object') {
                                            return Utils.escapeHTML(visit.createdBy.name || visit.createdBy.email || visit.createdBy.id || 'غير محدد');
                                        }
                                        const createdByStr = String(visit.createdBy).trim();
                                        // ✅ إصلاح جذري: إذا كان "النظام"، نحاول استخدام email من visit أو AppState.currentUser
                                        if (createdByStr === 'النظام' || createdByStr === '') {
                                            const emailFromVisit = (visit.email || '').toString().trim();
                                            if (emailFromVisit && emailFromVisit !== '') {
                                                return Utils.escapeHTML(emailFromVisit);
                                            }
                                            // محاولة استخدام AppState.currentUser.email كبديل
                                            const currentUserEmail = (AppState.currentUser?.email || '').toString().trim();
                                            if (currentUserEmail && currentUserEmail !== '') {
                                                return Utils.escapeHTML(currentUserEmail);
                                            }
                                            return 'غير محدد';
                                        }
                                        return Utils.escapeHTML(createdByStr);
                                    })()}</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- قسم التشخيص والعلاج -->
                        <div class="form-section" style="background: linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                            <h3 class="section-title" style="color: #4facfe; font-size: 20px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-stethoscope" style="font-size: 24px;"></i>
                                التشخيص والعلاج
                            </h3>
                            
                            <div class="space-y-4">
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #4facfe;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #4facfe; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-question-circle"></i>
                                        سبب الزيارة
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 500; margin: 0; line-height: 1.6;">${Utils.escapeHTML(visit.reason || '-')}</p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #4facfe;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #4facfe; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-diagnoses"></i>
                                        التشخيص
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 500; margin: 0; line-height: 1.6; white-space: pre-wrap;">${Utils.escapeHTML(visit.diagnosis || '-')}</p>
                                </div>
                                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid #4facfe;">
                                    <span style="display: flex; align-items: center; gap: 8px; color: #4facfe; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                                        <i class="fas fa-pills"></i>
                                        العلاج / الإجراء
                                    </span>
                                    <p style="color: #1e293b; font-size: 16px; font-weight: 500; margin: 0; line-height: 1.6; white-space: pre-wrap;">${Utils.escapeHTML(visit.treatment || '-')}</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- قسم الأدوية المنصرفة -->
                        ${visit.medications && Array.isArray(visit.medications) && visit.medications.length > 0 ? `
                        <div class="form-section" style="background: linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                            <h3 class="section-title" style="color: #009688; font-size: 20px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-prescription-bottle-alt" style="font-size: 24px;"></i>
                                الأدوية المنصرفة
                            </h3>
                            <div style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #009688;">
                                ${medicationsDisplay}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="modal-footer form-actions-centered" style="background: #f8f9fa; padding: 20px 30px; border-top: 1px solid #e2e8f0; border-radius: 0 0 20px 20px;">
                    <button class="btn-secondary" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; transition: all 0.3s; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times ml-2"></i>إغلاق
                    </button>
                    <button class="btn-primary" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; transition: all 0.3s; box-shadow: 0 4px 15px 0 rgba(102, 126, 234, 0.4);" onclick="Clinic.showVisitForm(${JSON.stringify(visit).replace(/"/g, '&quot;')}); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>تعديل
                    </button>
                    <button class="btn-success" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; transition: all 0.3s; box-shadow: 0 4px 15px 0 rgba(17, 153, 142, 0.4);" onclick="Clinic.exportVisitToPDF(${JSON.stringify(visit).replace(/"/g, '&quot;')});">
                        <i class="fas fa-file-pdf ml-2"></i>طباعة
                    </button>
                    ${this.isCurrentUserAdmin() ? `
                    <button class="btn-danger" style="background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; transition: all 0.3s; box-shadow: 0 4px 15px 0 rgba(235, 51, 73, 0.4);" onclick="if(confirm('هل أنت متأكد من حذف هذه الزيارة؟')) { Clinic.deleteVisit('${visit.id}'); this.closest('.modal-overlay').remove(); }">
                        <i class="fas fa-trash-alt ml-2"></i>حذف
                    </button>
                    ` : `
                    <button class="btn-warning" style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; transition: all 0.3s; box-shadow: 0 4px 15px 0 rgba(245, 158, 11, 0.4);" onclick="Clinic.requestVisitDeletion('${visit.id}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-paper-plane ml-2"></i>طلب حذف
                    </button>
                    `}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النافذة.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) modal.remove();
            }
        });
    },

    printVisitsList() {
        const visits = AppState.appData.clinicVisits.slice().reverse();
        if (visits.length === 0) {
            Notification.warning('لا توجد زيارات للطباعة');
            return;
        }

        const tableRows = visits.map(visit => {
            const employeeCode = visit.employeeCode || visit.employeeNumber || '-';
            const employeeName = visit.employeeName || visit.contractorName || visit.externalName || '';
            const workerName = visit.contractorWorkerName ? ` (${visit.contractorWorkerName})` : '';
            const position = visit.employeePosition || '-';
            const location = visit.employeeLocation || visit.workArea || '-';
            const entryTime = visit.visitDate ? Utils.formatDateTime(visit.visitDate) : '-';
            const exitTime = visit.exitDate ? Utils.formatDateTime(visit.exitDate) : 'لم يتم تسجيله';
            const totalTime = Clinic.calculateTotalTime(visit.visitDate, visit.exitDate);
            const reason = visit.reason || '';
            const diagnosis = visit.diagnosis || '';
            const procedure = visit.treatment || '';

            return `
                <tr>
                    <td>${employeeCode}</td>
                    <td>${employeeName}${workerName}</td>
                    <td>${position}</td>
                    <td>${location}</td>
                    <td>${entryTime}</td>
                    <td>${exitTime}</td>
                    <td>${totalTime}</td>
                    <td>${reason}</td>
                    <td>${diagnosis}</td>
                    <td>${procedure}</td>
                </tr>
            `;
        }).join('');

        const content = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>سجلات الزيارة - العيادة الطبية</title>
                <style>
                    @media print {
                        @page { margin: 1cm; size: A4 landscape; }
                        body { margin: 0; padding: 0; }
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        direction: rtl;
                        padding: 20px;
                    }
                    h1 {
                        text-align: center;
                        color: #1f2937;
                        margin-bottom: 20px;
                        font-size: 24px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                        font-size: 11px;
                    }
                    th, td {
                        border: 1px solid #d1d5db;
                        padding: 8px;
                        text-align: right;
                    }
                    th {
                        background-color: #f3f4f6;
                        font-weight: bold;
                        color: #1f2937;
                    }
                    tr:nth-child(even) {
                        background-color: #f9fafb;
                    }
                </style>
            </head>
            <body>
                <h1>سجلات الزيارة - العيادة الطبية</h1>
                <table>
                    <thead>
                        <tr>
                            <th>الكود الوظيفي</th>
                            <th>الاسم</th>
                            <th>الوظيفة</th>
                            <th>مكان العمل</th>
                            <th>وقت الدخول</th>
                            <th>وقت الخروج</th>
                            <th>اجمالي الوقت</th>
                            <th>السبب</th>
                            <th>التشخيص</th>
                            <th>الاجراء</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                <p style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
                    تاريخ الطباعة: ${Utils.formatDateTime(new Date())}
                </p>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    Notification.success('تم تحضير السجلات للطباعة');
                }, 250);
            };
        }
    },

    exportVisitsToExcel() {
        this.ensureData();
        const activeVisitType = this.state.activeVisitType || 'employees';
        const isContractorsTab = activeVisitType === 'contractors';
        const allVisits = (AppState.appData.clinicVisits || []).slice().reverse();

        // فلترة الزيارات حسب النوع
        const employeeVisits = allVisits.filter(v => v.personType === 'employee' || !v.personType);
        const contractorVisits = allVisits.filter(v => v.personType === 'contractor');

        const visits = activeVisitType === 'employees' ? employeeVisits : contractorVisits;
        if (visits.length === 0) {
            Notification.warning('لا توجد زيارات للتصدير');
            return;
        }

        if (typeof XLSX === 'undefined') {
            Notification.error('مكتبة Excel غير متوفرة');
            return;
        }

        try {
            const excelData = visits.map(visit => {
                const primaryValue = isContractorsTab
                    ? (visit.contractorName || visit.employeeName || visit.externalName || '-')
                    : (visit.employeeCode || visit.employeeNumber || '-');
                const displayName = isContractorsTab
                    ? (visit.contractorWorkerName || '-')
                    : (visit.employeeName || '-');
                const position = visit.employeePosition || visit.contractorPosition || '-';
                const factoryDisplay = this.getVisitFactoryDisplayName(visit);
                const workplace = isContractorsTab
                    ? (visit.workArea || visit.employeeLocation || '-')
                    : (visit.employeeLocation || visit.workArea || '-');
                const entryTime = visit.visitDate ? Utils.formatDateTime(visit.visitDate) : '-';
                const exitTime = visit.exitDate ? Utils.formatDateTime(visit.exitDate) : 'لم يتم تسجيله';
                const totalTime = this.calculateTotalTime(visit.visitDate, visit.exitDate);
                const reason = visit.reason || '';
                const diagnosis = visit.diagnosis || '';

                const medsArr = this.normalizeVisitMedications(visit.medications);
                const medications = medsArr.length > 0
                    ? medsArr.map(m => `${m.medicationName || ''} (${m.quantity || 1})`).join('، ')
                    : '-';
                const dispensedQty = medsArr.length > 0
                    ? medsArr.reduce((sum, m) => sum + (parseInt(m.quantity, 10) || 0), 0)
                    : 0;

                const row = {};
                row[isContractorsTab ? 'اسم المقاول' : 'الكود الوظيفي'] = primaryValue;
                row['الاسم'] = displayName;
                row['الوظيفة'] = position;
                row['المصنع'] = factoryDisplay;
                row['مكان العمل'] = workplace;
                row['وقت الدخول'] = entryTime;
                row['وقت الخروج'] = exitTime;
                row['إجمالي الوقت'] = totalTime;
                row['سبب الزيارة'] = reason;
                row['التشخيص'] = diagnosis;
                row['الأدوية المنصرفة'] = medications;
                row['الكمية المنصرفة'] = dispensedQty;
                return row;
            });

            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(excelData);

            // تعيين عرض الأعمدة
            worksheet['!cols'] = [
                { wch: 18 }, // الكود الوظيفي / اسم المقاول
                { wch: 25 }, // الاسم
                { wch: 20 }, // الوظيفة
                { wch: 16 }, // المصنع
                { wch: 20 }, // مكان العمل
                { wch: 20 }, // وقت الدخول
                { wch: 20 }, // وقت الخروج
                { wch: 15 }, // إجمالي الوقت
                { wch: 25 }, // سبب الزيارة
                { wch: 25 }, // التشخيص
                { wch: 30 }, // الأدوية المنصرفة
                { wch: 14 }  // الكمية المنصرفة
            ];

            XLSX.utils.book_append_sheet(workbook, worksheet, `سجلات_${isContractorsTab ? 'المقاولين' : 'الموظفين'}`);
            const fileName = `سجلات_الزيارة_${isContractorsTab ? 'المقاولين' : 'الموظفين'}_العيادة_الطبية_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            Notification.success('تم تصدير سجلات الزيارة إلى Excel بنجاح');
        } catch (error) {
            Utils.safeError('خطأ في تصدير Excel:', error);
            Notification.error('فشل تصدير Excel: ' + error.message);
        }
    },

    async exportVisitsToPDF() {
        this.ensureData();
        const activeVisitType = this.state.activeVisitType || 'employees';
        const isContractorsTab = activeVisitType === 'contractors';

        const allVisits = (AppState.appData.clinicVisits || []).slice().reverse();
        const employeeVisits = allVisits.filter(v => v.personType === 'employee' || !v.personType);
        const contractorVisits = allVisits.filter(v => v.personType === 'contractor');
        const visits = activeVisitType === 'employees' ? employeeVisits : contractorVisits;

        if (visits.length === 0) {
            Notification.warning('لا توجد زيارات للتصدير');
            return;
        }

        try {
            const tableRows = visits.map(visit => {
                const primaryValue = isContractorsTab
                    ? (visit.contractorName || visit.employeeName || visit.externalName || '-')
                    : (visit.employeeCode || visit.employeeNumber || '-');
                const displayName = isContractorsTab
                    ? (visit.contractorWorkerName || '-')
                    : (visit.employeeName || '-');
                const position = isContractorsTab
                    ? (visit.contractorPosition || visit.employeePosition || '-')
                    : (visit.employeePosition || '-');
                const factoryDisplay = this.getVisitFactoryDisplayName(visit);
                const workplace = isContractorsTab
                    ? (visit.workArea || visit.employeeLocation || '-')
                    : (visit.employeeLocation || visit.workArea || '-');
                const entryTime = visit.visitDate ? Utils.formatDateTime(visit.visitDate) : '-';
                const exitTime = visit.exitDate ? Utils.formatDateTime(visit.exitDate) : 'لم يتم تسجيله';
                const totalTime = Clinic.calculateTotalTime(visit.visitDate, visit.exitDate);
                const reason = visit.reason || '';
                const diagnosis = visit.diagnosis || '';

                const medsArr = this.normalizeVisitMedications(visit.medications);
                const medications = medsArr.length > 0
                    ? medsArr.map(m => `${Utils.escapeHTML(m.medicationName || '')} (${m.quantity || 1})`).join('، ')
                    : '-';
                const dispensedQty = medsArr.length > 0
                    ? medsArr.reduce((sum, m) => sum + (parseInt(m.quantity, 10) || 0), 0)
                    : 0;

                return `
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(primaryValue)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(displayName)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(position)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(factoryDisplay)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(workplace)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(entryTime)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(exitTime)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(totalTime)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(reason)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(diagnosis)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right; font-size: 9px;">${medications}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center; font-weight: bold;">${Utils.escapeHTML(String(dispensedQty))}</td>
                    </tr>
                `;
            }).join('');

            const formCode = `CLINIC-VISITS-${new Date().toISOString().slice(0, 10)}`;
            const formTitle = 'سجلات الزيارة - العيادة الطبية';

            const content = `
                <div style="margin-bottom: 20px;">
                    <h2 style="text-align: center; color: #1f2937; margin-bottom: 15px;">سجلات الزيارة - العيادة الطبية</h2>
                    <p style="text-align: center; color: #6b7280; font-size: 14px;">
                        إجمالي عدد الزيارات: ${visits.length}
                    </p>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">${isContractorsTab ? 'اسم المقاول' : 'الكود الوظيفي'}</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">الاسم</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">الوظيفة</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">المصنع</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">مكان العمل</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">وقت الدخول</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">وقت الخروج</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">اجمالي الوقت</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">سبب الزيارة</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">التشخيص</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">الأدوية المنصرفة</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold;">الكمية المنصرفة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            `;

            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(formCode, formTitle, content, false, true, { source: 'ClinicVisits' }, new Date().toISOString(), new Date().toISOString())
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${formTitle}</title></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                        }, 1000);
                        Notification.success('تم تحضير السجلات للطباعة/الحفظ كـ PDF');
                    }, 250);
                };
            } else {
                URL.revokeObjectURL(url);
                Notification.error('يرجى السماح بالنوافذ المنبثقة لتصدير PDF');
            }
        } catch (error) {
            URL.revokeObjectURL(url);
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error('فشل تصدير PDF: ' + error.message);
        }
    },

    /**
     * تصدير تقرير زيارة واحدة إلى PDF
     */
    async exportVisitToPDF(visit) {
        if (!visit) {
            Notification.warning('لا توجد بيانات الزيارة للتصدير');
            return;
        }

        try {
            const personTypeLabel = visit.personType === 'employee' ? 'موظف' : visit.personType === 'contractor' ? 'مقاول' : 'عمالة خارجية';
            const employeeCode = visit.employeeCode || visit.employeeNumber || '-';
            const employeeName = visit.employeeName || visit.contractorName || visit.externalName || '';
            const workerName = visit.contractorWorkerName ? ` (${visit.contractorWorkerName})` : '';
            const position = visit.employeePosition || visit.contractorPosition || '-';
            const location = visit.employeeLocation || visit.workArea || '-';
            const entryTime = visit.visitDate ? Utils.formatDateTime(visit.visitDate) : '-';
            const exitTime = visit.exitDate ? Utils.formatDateTime(visit.exitDate) : 'لم يتم تسجيله';
            const totalTime = this.calculateTotalTime(visit.visitDate, visit.exitDate);
            const reason = visit.reason || '';
            const diagnosis = visit.diagnosis || '';
            const treatment = visit.treatment || '';

            // عرض الأدوية المنصرفة
            const medications = visit.medications && Array.isArray(visit.medications) && visit.medications.length > 0
                ? visit.medications.map(m => `${Utils.escapeHTML(m.medicationName || '')} (${m.quantity || 1})`).join('، ')
                : 'لا توجد أدوية منصرفة';

            const formCode = `CLINIC-VISIT-${visit.id || new Date().toISOString().slice(0, 10)}`;
            const formTitle = 'تقرير زيارة العيادة الطبية';

            const content = `
                <div style="margin-bottom: 20px;">
                    <h2 style="text-align: center; color: #1f2937; margin-bottom: 15px;">تقرير زيارة العيادة الطبية</h2>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px;">
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; background-color: #f3f4f6; width: 30%;">نوع الشخص</td>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; width: 70%;">${Utils.escapeHTML(personTypeLabel)}</td>
                    </tr>
                    ${employeeCode !== '-' ? `
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; background-color: #f3f4f6;">الكود الوظيفي</td>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${Utils.escapeHTML(employeeCode)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; background-color: #f3f4f6;">الاسم</td>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${Utils.escapeHTML(employeeName)}${Utils.escapeHTML(workerName)}</td>
                    </tr>
                    ${position !== '-' ? `
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; background-color: #f3f4f6;">الوظيفة</td>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${Utils.escapeHTML(position)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; background-color: #f3f4f6;">مكان العمل</td>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${Utils.escapeHTML(location)}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; background-color: #f3f4f6;">وقت الدخول</td>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${Utils.escapeHTML(entryTime)}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; background-color: #f3f4f6;">وقت الخروج</td>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${Utils.escapeHTML(exitTime)}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; background-color: #f3f4f6;">إجمالي الوقت</td>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${Utils.escapeHTML(totalTime)}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; background-color: #f3f4f6;">سبب الزيارة</td>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${Utils.escapeHTML(reason)}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; background-color: #f3f4f6;">التشخيص</td>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${Utils.escapeHTML(diagnosis)}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; background-color: #f3f4f6;">العلاج / الإجراء</td>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${Utils.escapeHTML(treatment)}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; background-color: #f3f4f6;">الأدوية المنصرفة</td>
                        <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${medications}</td>
                    </tr>
                </table>
            `;

            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(formCode, formTitle, content, false, true, { source: 'ClinicVisit' }, visit.visitDate || visit.createdAt || new Date().toISOString(), visit.updatedAt || visit.createdAt || new Date().toISOString())
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${formTitle}</title></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                        }, 1000);
                        Notification.success('تم تحضير التقرير للطباعة/الحفظ كـ PDF');
                    }, 250);
                };
            } else {
                URL.revokeObjectURL(url);
                Notification.error('يرجى السماح بالنوافذ المنبثقة لتصدير PDF');
            }
        } catch (error) {
            URL.revokeObjectURL(url);
            Utils.safeError('خطأ في تصدير تقرير الزيارة:', error);
            Notification.error('فشل تصدير التقرير: ' + error.message);
        }
    },

    /**
     * عرض tab طلبات الموافقة (للمدير فقط)
     */
    async ensureApprovalsDataLoaded({ force = false } = {}) {
        if (this._approvalsLoadPromise && !force) return this._approvalsLoadPromise;
        this._approvalsLoadPromise = (async () => {
            const isEnabled = AppState?.googleConfig?.appsScript?.enabled && AppState?.googleConfig?.appsScript?.scriptUrl;
            if (!isEnabled || typeof GoogleIntegration === 'undefined' || !GoogleIntegration.sendRequest) {
                this._approvalsBackendFetchOk = true;
                return;
            }

            const deletionP = GoogleIntegration.sendRequest({
                action: 'getAllMedicationDeletionRequests',
                data: { filters: {} }
            });
            const supplyP = GoogleIntegration.sendRequest({
                action: 'getAllSupplyRequests',
                data: { filters: {} }
            });
            const visitDeletionP = GoogleIntegration.sendRequest({
                action: 'getAllClinicVisitDeletionRequests',
                data: { filters: {} }
            });

            const [deletionResult, supplyResult, visitDeletionResult] = await Promise.allSettled([
                Utils.promiseWithTimeout(deletionP, 15000, 'انتهت مهلة تحميل طلبات حذف الأدوية'),
                Utils.promiseWithTimeout(supplyP, 15000, 'انتهت مهلة تحميل طلبات الاحتياج'),
                Utils.promiseWithTimeout(visitDeletionP, 15000, 'انتهت مهلة تحميل طلبات حذف الزيارات')
            ]);

            const delVal = deletionResult.status === 'fulfilled' ? deletionResult.value : null;
            const supVal = supplyResult.status === 'fulfilled' ? supplyResult.value : null;
            const visVal = visitDeletionResult.status === 'fulfilled' ? visitDeletionResult.value : null;

            const deletionRequests = Array.isArray(delVal?.data) ? delVal.data : [];
            const supplyRequests = Array.isArray(supVal?.data) ? supVal.data : [];
            const visitDeletionRequests = Array.isArray(visVal?.data) ? visVal.data : [];

            // ✅ لا تستبدل بيانات محلية غير فارغة ببيانات فارغة من backend
            if (deletionRequests.length > 0 || !(Array.isArray(AppState.appData?.clinicMedicationDeletionRequests) && AppState.appData.clinicMedicationDeletionRequests.length > 0)) {
                AppState.appData.clinicMedicationDeletionRequests = deletionRequests;
            }
            if (supplyRequests.length > 0 || !(Array.isArray(AppState.appData?.clinicSupplyRequests) && AppState.appData.clinicSupplyRequests.length > 0)) {
                AppState.appData.clinicSupplyRequests = supplyRequests;
            }
            if (visitDeletionRequests.length > 0 || !(Array.isArray(AppState.appData?.clinicVisitDeletionRequests) && AppState.appData.clinicVisitDeletionRequests.length > 0)) {
                AppState.appData.clinicVisitDeletionRequests = visitDeletionRequests;
            }

            try { localStorage.setItem('clinic_approvals_last_sync', String(Date.now())); } catch (e) {}
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                try { window.DataManager.save(); } catch (e) {}
            }
            this._approvalsBackendFetchOk = true;
        })().finally(() => {
            this._approvalsLoadPromise = null;
        });
        return this._approvalsLoadPromise;
    },

    async renderApprovalsTab() {
        const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="approvals"]');
        if (!panel) {
            Utils.safeError('❌ لوحة approvals غير موجودة');
            return;
        }

        // التحقق من صلاحيات المدير
        if (!this.isCurrentUserAdmin()) {
            panel.innerHTML = '<div class="text-center py-8 text-gray-500">هذا القسم متاح للمديرين فقط</div>';
            return;
        }

        // ✅ عرض فوري بالبيانات المحلية إن وجدت، ثم تحديث من backend عند الحاجة
        panel.innerHTML = '<div class="text-center py-8"><div style="width: 300px; margin: 0 auto 16px;"><div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;"><div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div></div></div><p class="mt-2">جاري التحضير...</p></div>';

        try {
            const lastSync = (() => { try { return localStorage.getItem('clinic_approvals_last_sync'); } catch (e) { return null; } })();
            const cacheAge = lastSync ? (Date.now() - parseInt(lastSync, 10)) : Infinity;
            const CACHE_DURATION = 5 * 60 * 1000; // 5 دقائق
            const hasLocalDeletion = Array.isArray(AppState.appData?.clinicMedicationDeletionRequests) && AppState.appData.clinicMedicationDeletionRequests.length > 0;
            const hasLocalSupply = Array.isArray(AppState.appData?.clinicSupplyRequests) && AppState.appData.clinicSupplyRequests.length > 0;
            const hasLocalVisitDeletion = Array.isArray(AppState.appData?.clinicVisitDeletionRequests) && AppState.appData.clinicVisitDeletionRequests.length > 0;
            const hasLocalAny = hasLocalDeletion || hasLocalSupply || hasLocalVisitDeletion;
            const isStale = cacheAge >= CACHE_DURATION;

            if (!isStale && hasLocalAny) {
                this._approvalsBackendFetchOk = true;
            }
            if ((isStale || !hasLocalAny || this._approvalsBackendFetchOk !== true) && typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                const loadAndMaybeRerender = async () => {
                    await this.ensureApprovalsDataLoaded({ force: isStale && hasLocalAny });
                };

                // ✅ لا ننتظر إذا لدينا بيانات محلية (فتح فوري)، وإلا ننتظر بحد أقصى 6 ثواني
                if (hasLocalAny) {
                    loadAndMaybeRerender().then(() => {
                        try {
                            // إعادة عرض سريعة بعد التحديث إذا ما زلنا على التبويب
                            if (this.state && this.state.activeTab === 'approvals') {
                                this.renderApprovalsTab();
                            }
                        } catch (e) { /* ignore */ }
                    }).catch(() => {});
                } else {
                    await Promise.race([
                        loadAndMaybeRerender(),
                        new Promise(resolve => setTimeout(resolve, 6000))
                    ]);
                }
            }

            const deletionRequests = Array.isArray(AppState.appData?.clinicMedicationDeletionRequests) ? AppState.appData.clinicMedicationDeletionRequests : [];
            const supplyRequests = Array.isArray(AppState.appData?.clinicSupplyRequests) ? AppState.appData.clinicSupplyRequests : [];
            const visitDeletionRequests = Array.isArray(AppState.appData?.clinicVisitDeletionRequests) ? AppState.appData.clinicVisitDeletionRequests : [];

            // إضافة نوع الطلب لكل طلب
            const allDeletionRequests = deletionRequests.map(r => ({ ...r, requestType: 'deletion' }));
            const allSupplyRequests = supplyRequests.map(r => ({ ...r, requestType: 'supply' }));
            const allVisitDeletionRequests = visitDeletionRequests.map(r => ({ ...r, requestType: 'visit' }));

            // دمج الطلبات
            const allRequests = [...allDeletionRequests, ...allSupplyRequests, ...allVisitDeletionRequests];

            Utils.safeLog(`📋 تم تحميل ${allDeletionRequests.length} طلب حذف دواء و ${allSupplyRequests.length} طلب احتياج و ${allVisitDeletionRequests.length} طلب حذف زيارة`);

            const pendingRequests = allRequests.filter(r => r.status === 'pending');
            const approvedRequests = allRequests.filter(r => r.status === 'approved');
            const rejectedRequests = allRequests.filter(r => r.status === 'rejected');

            // تحديث badge عدد الطلبات المعلقة
            const badge = document.getElementById('pending-approvals-badge');
            if (badge) {
                const totalPending = pendingRequests.length;
                if (totalPending > 0) {
                    badge.textContent = totalPending;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }

            panel.innerHTML = `
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-check-circle ml-2"></i>
                            طلبات الموافقة
                        </h2>
                    </div>
                    <div class="card-body">
                        <!-- إحصائيات -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div class="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                <i class="fas fa-clock text-3xl text-yellow-600 mb-2"></i>
                                <p class="text-sm text-gray-600">طلبات معلقة</p>
                                <p class="text-2xl font-bold">${pendingRequests.length}</p>
                            </div>
                            <div class="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                                <i class="fas fa-check text-3xl text-green-600 mb-2"></i>
                                <p class="text-sm text-gray-600">موافق عليها</p>
                                <p class="text-2xl font-bold">${approvedRequests.length}</p>
                            </div>
                            <div class="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                                <i class="fas fa-times text-3xl text-red-600 mb-2"></i>
                                <p class="text-sm text-gray-600">مرفوضة</p>
                                <p class="text-2xl font-bold">${rejectedRequests.length}</p>
                            </div>
                        </div>

                        <!-- فلاتر -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">تصفية حسب الحالة:</label>
                                <select id="approvals-status-filter" class="form-input">
                                    <option value="all">جميع الطلبات</option>
                                    <option value="pending" selected>طلبات معلقة</option>
                                    <option value="approved">موافق عليها</option>
                                    <option value="rejected">مرفوضة</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">تصفية حسب النوع:</label>
                                <select id="approvals-type-filter" class="form-input">
                                    <option value="all">جميع الأنواع</option>
                                    <option value="deletion">طلبات حذف الأدوية</option>
                                    <option value="supply">طلبات الاحتياج</option>
                                    <option value="visit">طلبات حذف الزيارات</option>
                                </select>
                            </div>
                        </div>

                        <!-- جدول الطلبات -->
                        <div id="approvals-table-container">
                            ${this.renderApprovalsTable(pendingRequests)}
                        </div>
                    </div>
                </div>
            `;

            // ربط الأحداث
            const statusFilter = document.getElementById('approvals-status-filter');
            const typeFilter = document.getElementById('approvals-type-filter');

            const updateTable = () => {
                const status = statusFilter?.value || 'all';
                const type = typeFilter?.value || 'all';

                let filteredRequests = allRequests;

                if (status !== 'all') {
                    filteredRequests = filteredRequests.filter(r => r.status === status);
                }
                if (type !== 'all') {
                    filteredRequests = filteredRequests.filter(r => r.requestType === type);
                }

                const approvalsTableContainer = document.getElementById('approvals-table-container');
                if (approvalsTableContainer) {
                    approvalsTableContainer.innerHTML = this.renderApprovalsTable(filteredRequests);
                    this.bindApprovalsEvents();
                }
            };

            if (statusFilter) {
                statusFilter.addEventListener('change', updateTable);
            }
            if (typeFilter) {
                typeFilter.addEventListener('change', updateTable);
            }

            this.bindApprovalsEvents();

            // إضافة مستمعي التمرير للجدول
            setTimeout(() => {
                const wrapper = panel.querySelector('.clinic-table-wrapper');
                if (wrapper) {
                    this.setupTableScrollListeners(wrapper);
                }
            }, 100);

        } catch (error) {
            Utils.safeError('خطأ في عرض طلبات الموافقة:', error);
            panel.innerHTML = '<div class="alert alert-error">حدث خطأ في تحميل البيانات</div>';
        }
    },

    renderApprovalsTable(requests) {
        if (!requests || requests.length === 0) {
            return '<div class="text-center py-8 text-gray-500">لا توجد طلبات</div>';
        }

        const rows = requests.map(request => {
            const requestType = request.requestType || 'deletion';
            const isDeletion = requestType === 'deletion';
            const isSupply = requestType === 'supply';
            const isVisitDeletion = requestType === 'visit';

            let itemName = '-';
            let itemType = '-';
            let itemDetails = '';

            if (isDeletion) {
                const medication = request.medicationData || {};
                itemName = medication.name || '-';
                itemType = medication.type || '-';
                itemDetails = `الدواء: ${Utils.escapeHTML(itemName)}`;
            } else if (isSupply) {
                itemName = request.itemName || '-';
                const typeLabel = {
                    'medication': 'أدوية',
                    'equipment': 'أجهزة طبية',
                    'supplies': 'مستلزمات طبية',
                    'other': 'أخرى'
                }[request.type] || request.type || '-';
                itemType = typeLabel;
                itemDetails = `${typeLabel}: ${Utils.escapeHTML(itemName)} (${request.quantity || ''} ${Utils.escapeHTML(request.unit || '')})`;
            } else if (isVisitDeletion) {
                const visitData = request.visitData || {};
                const personName = visitData.employeeName || visitData.contractorWorkerName || visitData.contractorName || visitData.externalName || '-';
                const typeLabel = visitData.personType === 'employee'
                    ? 'موظف'
                    : (visitData.personType === 'contractor' ? 'مقاول' : 'عمالة خارجية');
                itemName = personName;
                itemType = typeLabel;
                itemDetails = `زيارة: ${Utils.escapeHTML(personName)} (${Utils.escapeHTML(typeLabel)})`;
            }

            const requestedBy = request.requestedBy || {};
            const statusBadge = this.getApprovalStatusBadge(request.status);
            const isPending = request.status === 'pending';
            const requestTypeBadge = isDeletion
                ? '<span class="badge badge-info">حذف دواء</span>'
                : isSupply
                    ? '<span class="badge badge-primary">طلب احتياج</span>'
                    : '<span class="badge badge-warning">حذف زيارة</span>';

            return `
                <tr>
                    <td>${requestTypeBadge}</td>
                    <td>${Utils.escapeHTML(itemName)}</td>
                    <td>${Utils.escapeHTML(itemType)}</td>
                    <td>${Utils.escapeHTML(requestedBy.name || '-')}</td>
                    <td>${this.formatDate(request.createdAt || request.requestDate, true)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="flex gap-2 justify-center">
                            ${isPending ? `
                                <button class="btn-icon btn-icon-success" data-action="approve-request" data-id="${request.id}" data-type="${requestType}" title="موافقة">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button class="btn-icon btn-icon-danger" data-action="reject-request" data-id="${request.id}" data-type="${requestType}" title="رفض">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : ''}
                            <button class="btn-icon btn-icon-primary" data-action="view-request" data-id="${request.id}" data-type="${requestType}" title="عرض التفاصيل">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="table-responsive clinic-table-wrapper" style="overflow-x: auto; overflow-y: auto; max-height: 70vh;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>نوع الطلب</th>
                            <th>اسم العنصر</th>
                            <th>النوع</th>
                            <th>مقدم الطلب</th>
                            <th>تاريخ الطلب</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    },

    getApprovalStatusBadge(status) {
        switch (status) {
            case 'pending':
                return '<span class="badge badge-warning">قيد الانتظار</span>';
            case 'approved':
                return '<span class="badge badge-success">موافق عليه</span>';
            case 'rejected':
                return '<span class="badge badge-danger">مرفوض</span>';
            default:
                return '<span class="badge badge-secondary">غير محدد</span>';
        }
    },

    bindApprovalsEvents() {
        document.querySelectorAll('[data-action="approve-request"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const requestId = btn.getAttribute('data-id');
                const requestType = btn.getAttribute('data-type') || 'deletion';
                this.approveRequest(requestId, requestType);
            });
        });

        document.querySelectorAll('[data-action="reject-request"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const requestId = btn.getAttribute('data-id');
                const requestType = btn.getAttribute('data-type') || 'deletion';
                this.rejectRequest(requestId, requestType);
            });
        });

        document.querySelectorAll('[data-action="view-request"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const requestId = btn.getAttribute('data-id');
                const requestType = btn.getAttribute('data-type') || 'deletion';
                this.viewRequestDetails(requestId, requestType);
            });
        });
    },

    async approveRequest(requestId, requestType = 'deletion') {
        const isDeletion = requestType === 'deletion';
        const isSupply = requestType === 'supply';
        const isVisitDeletion = requestType === 'visit';
        const confirmMessage = isDeletion
            ? 'هل أنت متأكد من الموافقة على حذف هذا الدواء؟\n\nسيتم حذف الدواء نهائياً من النظام.'
            : isSupply
                ? 'هل أنت متأكد من الموافقة على هذا الطلب؟'
                : 'هل أنت متأكد من الموافقة على حذف هذه الزيارة؟\n\nسيتم حذف الزيارة نهائياً من سجل التردد.';

        const confirmed = confirm(confirmMessage);
        if (!confirmed) return;

        Loading.show();
        try {
            const approverData = {
                id: AppState.currentUser?.id || '',
                name: AppState.currentUser?.name || '',
                email: AppState.currentUser?.email || '',
                role: AppState.currentUser?.role || ''
            };

            let result;
            if (isDeletion) {
                result = await GoogleIntegration.sendRequest({
                    action: 'approveMedicationDeletion',
                    data: {
                        requestId: requestId,
                        approverData: approverData
                    }
                });
            } else if (isSupply) {
                result = await GoogleIntegration.sendRequest({
                    action: 'approveSupplyRequest',
                    data: {
                        requestId: requestId,
                        approverData: approverData
                    }
                });
            } else if (isVisitDeletion) {
                result = await GoogleIntegration.sendRequest({
                    action: 'approveClinicVisitDeletion',
                    data: {
                        requestId: requestId,
                        approverData: approverData
                    }
                });
            }

            if (result && result.success) {
                Loading.hide();
                const successMessage = isDeletion
                    ? 'تمت الموافقة على الطلب وحذف الدواء بنجاح'
                    : isSupply
                        ? 'تمت الموافقة على الطلب بنجاح'
                        : 'تمت الموافقة على طلب حذف الزيارة بنجاح';
                Notification.success(successMessage);

                // تحديث تبويبة طلبات الموافقة فقط بدون إعادة تحميل كامل
                setTimeout(() => {
                    this.renderApprovalsTab();
                }, 100);

                // تحديث البيانات في الخلفية (لطلبات الحذف فقط)
                if (isDeletion) {
                    (async () => {
                        try {
                            // تحديث قائمة الأدوية
                            const medicationsResult = await GoogleIntegration.sendRequest({
                                action: 'getAllMedications',
                                data: {}
                            });
                            if (medicationsResult && medicationsResult.success) {
                                AppState.appData.medications = medicationsResult.data;
                                AppState.appData.clinicMedications = medicationsResult.data;
                                AppState.appData.clinicInventory = medicationsResult.data;

                                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                                    window.DataManager.save();
                                }
                            }
                        } catch (syncError) {
                            Utils.safeWarn('⚠️ خطأ في تحديث البيانات في الخلفية:', syncError);
                        }
                    })();
                }
            } else {
                throw new Error(result.message || 'فشلت العملية');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في الموافقة على الطلب:', error);
            Notification.error('فشلت الموافقة: ' + (error.message || 'حدث خطأ'));
        }
    },

    async rejectRequest(requestId, requestType = 'deletion') {
        const reason = prompt('يرجى إدخال سبب الرفض (اختياري):');
        if (reason === null) return;

        Loading.show();
        try {
            const rejectorData = {
                id: AppState.currentUser?.id || '',
                name: AppState.currentUser?.name || '',
                email: AppState.currentUser?.email || '',
                role: AppState.currentUser?.role || ''
            };

            let result;
            if (requestType === 'deletion') {
                result = await GoogleIntegration.sendRequest({
                    action: 'rejectMedicationDeletion',
                    data: {
                        requestId: requestId,
                        rejectorData: rejectorData,
                        reason: reason || 'لم يتم تحديد سبب'
                    }
                });
            } else if (requestType === 'supply') {
                result = await GoogleIntegration.sendRequest({
                    action: 'rejectSupplyRequest',
                    data: {
                        requestId: requestId,
                        rejectorData: rejectorData,
                        reason: reason || 'لم يتم تحديد سبب'
                    }
                });
            } else if (requestType === 'visit') {
                result = await GoogleIntegration.sendRequest({
                    action: 'rejectClinicVisitDeletion',
                    data: {
                        requestId: requestId,
                        rejectorData: rejectorData,
                        reason: reason || 'لم يتم تحديد سبب'
                    }
                });
            }

            if (result && result.success) {
                Loading.hide();
                Notification.success('تم رفض الطلب بنجاح');

                // تحديث تبويبة طلبات الموافقة فقط
                setTimeout(() => {
                    this.renderApprovalsTab();
                }, 100);
            } else {
                throw new Error(result.message || 'فشلت العملية');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في رفض الطلب:', error);
            Notification.error('فشل الرفض: ' + (error.message || 'حدث خطأ'));
        }
    },

    async viewRequestDetails(requestId, requestType = 'deletion') {
        try {
            let result;
            if (requestType === 'deletion') {
                result = await GoogleIntegration.sendRequest({
                    action: 'getAllMedicationDeletionRequests',
                    data: { filters: {} }
                });
            } else if (requestType === 'supply') {
                result = await GoogleIntegration.sendRequest({
                    action: 'getAllSupplyRequests',
                    data: { filters: {} }
                });
            } else if (requestType === 'visit') {
                result = await GoogleIntegration.sendRequest({
                    action: 'getAllClinicVisitDeletionRequests',
                    data: { filters: {} }
                });
            }

            if (!result || !result.success) {
                Notification.error('فشل تحميل تفاصيل الطلب');
                return;
            }

            const request = result.data.find(r => r.id === requestId);
            if (!request) {
                Notification.error('الطلب غير موجود');
                return;
            }

            const isDeletion = requestType === 'deletion';
            const isVisitDeletion = requestType === 'visit';
            const requestedBy = request.requestedBy || {};
            const approvedBy = request.approvedBy || {};
            const rejectedBy = request.rejectedBy || {};

            let itemDetailsHTML = '';
            if (isDeletion) {
                const medication = request.medicationData || {};
                itemDetailsHTML = `
                    <div>
                        <h3 class="font-semibold text-lg mb-2">معلومات الدواء:</h3>
                        <div class="grid grid-cols-2 gap-3">
                            <div><strong>الاسم:</strong> ${Utils.escapeHTML(medication.name || '-')}</div>
                            <div><strong>النوع:</strong> ${Utils.escapeHTML(medication.type || '-')}</div>
                            <div><strong>الكمية:</strong> ${Utils.escapeHTML(medication.quantity || '-')}</div>
                            <div><strong>الموقع:</strong> ${Utils.escapeHTML(medication.location || '-')}</div>
                        </div>
                    </div>
                `;
            } else if (isVisitDeletion) {
                const visit = request.visitData || {};
                const personName = visit.employeeName || visit.contractorWorkerName || visit.contractorName || visit.externalName || '-';
                const personTypeLabel = visit.personType === 'employee' ? 'موظف' : (visit.personType === 'contractor' ? 'مقاول' : 'عمالة خارجية');
                const visitDate = visit.visitDate ? Utils.formatDateTime(visit.visitDate) : '-';
                const exitDate = visit.exitDate ? Utils.formatDateTime(visit.exitDate) : 'لم يتم تسجيله';
                itemDetailsHTML = `
                    <div>
                        <h3 class="font-semibold text-lg mb-2">معلومات الزيارة:</h3>
                        <div class="grid grid-cols-2 gap-3">
                            <div><strong>الاسم:</strong> ${Utils.escapeHTML(personName)}</div>
                            <div><strong>النوع:</strong> ${Utils.escapeHTML(personTypeLabel)}</div>
                            <div><strong>وقت الدخول:</strong> ${Utils.escapeHTML(visitDate)}</div>
                            <div><strong>وقت الخروج:</strong> ${Utils.escapeHTML(exitDate)}</div>
                            <div><strong>سبب الزيارة:</strong> ${Utils.escapeHTML(visit.reason || '-')}</div>
                            <div><strong>التشخيص:</strong> ${Utils.escapeHTML(visit.diagnosis || '-')}</div>
                        </div>
                        <div class="mt-3">
                            <button class="btn-secondary" onclick="Clinic.viewVisit('${Utils.escapeHTML(visit.id || request.visitId || '')}')">
                                <i class="fas fa-eye ml-2"></i>عرض الزيارة
                            </button>
                        </div>
                    </div>
                `;
            } else {
                const typeLabel = {
                    'medication': 'أدوية',
                    'equipment': 'أجهزة طبية',
                    'supplies': 'مستلزمات طبية',
                    'other': 'أخرى'
                }[request.type] || request.type || '-';
                const priorityLabel = {
                    'urgent': 'عاجلة',
                    'high': 'عالية',
                    'normal': 'عادية'
                }[request.priority] || 'عادية';

                itemDetailsHTML = `
                    <div>
                        <h3 class="font-semibold text-lg mb-2">معلومات الطلب:</h3>
                        <div class="grid grid-cols-2 gap-3">
                            <div><strong>نوع الطلب:</strong> ${Utils.escapeHTML(typeLabel)}</div>
                            <div><strong>اسم العنصر:</strong> ${Utils.escapeHTML(request.itemName || '-')}</div>
                            <div><strong>الكمية:</strong> ${request.quantity || '-'} ${Utils.escapeHTML(request.unit || '')}</div>
                            <div><strong>الأولوية:</strong> ${Utils.escapeHTML(priorityLabel)}</div>
                            ${request.notes ? `
                                <div class="col-span-2"><strong>ملاحظات:</strong> ${Utils.escapeHTML(request.notes)}</div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 700px;">
                    <div class="modal-header modal-header-centered">
                        <h2 class="modal-title">تفاصيل طلب الموافقة</h2>
                        <button class="modal-close"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <div class="space-y-4">
                            ${itemDetailsHTML}
                            <div>
                                <h3 class="font-semibold text-lg mb-2">معلومات مقدم الطلب:</h3>
                                <div class="grid grid-cols-2 gap-3">
                                    <div><strong>مقدم الطلب:</strong> ${Utils.escapeHTML(requestedBy.name || '-')}</div>
                                    <div><strong>تاريخ الطلب:</strong> ${this.formatDate(request.createdAt || request.requestDate, true)}</div>
                                    <div><strong>الحالة:</strong> ${this.getApprovalStatusBadge(request.status)}</div>
                                </div>
                            </div>
                            ${request.status === 'approved' ? `
                                <div>
                                    <h3 class="font-semibold text-lg mb-2">معلومات الموافقة:</h3>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div><strong>تمت الموافقة بواسطة:</strong> ${Utils.escapeHTML(approvedBy.name || '-')}</div>
                                        <div><strong>تاريخ الموافقة:</strong> ${this.formatDate(request.approvedAt, true)}</div>
                                    </div>
                                </div>
                            ` : ''}
                            ${request.status === 'rejected' ? `
                                <div>
                                    <h3 class="font-semibold text-lg mb-2">معلومات الرفض:</h3>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div><strong>تم الرفض بواسطة:</strong> ${Utils.escapeHTML(rejectedBy.name || '-')}</div>
                                        <div><strong>تاريخ الرفض:</strong> ${this.formatDate(request.rejectedAt, true)}</div>
                                        ${request.rejectionReason ? `
                                            <div class="col-span-2"><strong>سبب الرفض:</strong> ${Utils.escapeHTML(request.rejectionReason)}</div>
                                        ` : ''}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer form-actions-centered">
                        <button class="btn-secondary modal-close-btn">إغلاق</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
                btn.addEventListener('click', () => modal.remove());
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    const ok = confirm('تنبيه: سيتم إغلاق النافذة.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                    if (ok) modal.remove();
                }
            });

        } catch (error) {
            Utils.safeError('خطأ في عرض تفاصيل الطلب:', error);
            Notification.error('فشل تحميل التفاصيل');
        }
    },

    /**
     * تحميل بيانات العيادة من الخادم
     */
    /**
     * إعادة عرض المحتوى عند تغيير اللغة
     */
    refreshOnLanguageChange() {
        // إعادة عرض التبويب النشط
        if (this.state && this.state.initialized) {
            try {
                this.renderActiveTabContent();
            } catch (error) {
                Utils.safeError('❌ خطأ في إعادة عرض المحتوى عند تغيير اللغة:', error);
            }
        }
    },

    async load() {
        if (typeof Utils !== 'undefined' && Utils.safeLog) {
            Utils.safeLog('🔄 تحميل مديول العيادة...');
        }

        // التأكد من وجود قسم DOM قبل أي عملية
        const section = document.getElementById('clinic-section');
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ قسم clinic-section غير موجود في الصفحة');
            }
            return;
        }

        // التأكد من وجود AppState و appData لمنع الشاشة البيضاء
        if (typeof AppState === 'undefined') {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ AppState غير معرّف - يرجى تحديث الصفحة');
            }
            section.innerHTML = '<div class="content-card"><div class="card-body"><p class="text-red-600">لم يتم تهيئة التطبيق بشكل صحيح. يرجى تحديث الصفحة.</p></div></div>';
            return;
        }
        if (!AppState.appData) {
            AppState.appData = {};
        }
        if (typeof Permissions !== 'undefined' && typeof Permissions.ensureFormSettingsState === 'function') {
            try { Permissions.ensureFormSettingsState().catch(() => {}); } catch (e) { /* ignore */ }
        }

        // حقن أنماط CSS لشريط التمرير
        this.injectTableScrollbarStyles();

        // إضافة مستمع لتغيير اللغة
        if (!this._languageChangeListenerAdded) {
            // الاستماع لتغيير اللغة من app-ui.js
            document.addEventListener('language-changed', () => {
                this.refreshOnLanguageChange();
            });
            
            // الاستماع لتغيير localStorage للغة (fallback)
            window.addEventListener('storage', (e) => {
                if (e.key === 'language' && e.newValue !== e.oldValue) {
                    this.refreshOnLanguageChange();
                }
            });
            
            this._languageChangeListenerAdded = true;
        }
        
        // ✅ إضافة مستمع لحدث اكتمال المزامنة لتحديث سجل التردد تلقائياً
        if (!this._syncCompletedListenerAdded) {
            window.addEventListener('syncDataCompleted', (event) => {
                const { sheets } = event.detail || {};
                // التحقق من أن المزامنة شملت بيانات العيادة
                if (sheets && (sheets.includes('ClinicVisits') || sheets.includes('ClinicContractorVisits') || sheets.includes('clinicVisits'))) {
                    // ✅ إعادة تطبيع البيانات بعد المزامنة
                    this.ensureData();
                    
                    // ✅ إذا كان تبويب سجل التردد مفتوحاً، تحديثه مباشرة
                    if (this.state && this.state.activeTab === 'visits') {
                        this.scheduleVisitsTabRender(false, 0);
                        if (AppState.debugMode) {
                            Utils.safeLog('✅ تم تحديث سجل التردد تلقائياً بعد المزامنة');
                        }
                    }
                }
            });
            
            this._syncCompletedListenerAdded = true;
        }

        try {
            // التأكد من هيكلية البيانات
            this.ensureData();

            // التحقق من البيانات المحفوظة محلياً
            const lastSync = localStorage.getItem('clinic_last_sync');
            const cacheAge = lastSync ? (Date.now() - parseInt(lastSync)) : Infinity;
            const CACHE_DURATION = 10 * 60 * 1000; // 10 دقائق (توازن بين الأداء والتحديث)

            // التحقق من وجود بيانات محلية
            const hasLocalData = this.hasValidLocalData();

            // التحقق من التحميل الأول
            const isFirstLoad = !this.state.initialized;

            // عرض الواجهة فوراً بالبيانات المتوفرة (إن وجدت)
            // هذا يضمن عدم وجود واجهة فارغة حتى لو فشل تحميل البيانات
            this.renderUI();

            // ✅ تحسين سرعة التحميل: عدم انتظار syncDataFromServer في الخلفية
            // التحميل ينتهي فوراً بعد عرض الواجهة؛ جلب البيانات يتم في الخلفية ثم تحديث الواجهة
            const shouldLoadData = isFirstLoad || !hasLocalData || cacheAge >= CACHE_DURATION;
            
            if (shouldLoadData) {
                Utils.safeLog('🔄 تحميل بيانات العيادة من قاعدة البيانات (في الخلفية)...');
                Utils.promiseWithTimeout(
                    this.syncDataFromServer(),
                    130000,
                    'انتهت مهلة تحميل البيانات'
                ).then(() => {
                    localStorage.setItem('clinic_last_sync', Date.now().toString());
                    this.ensureData();
                    this.renderUI();
                    if (this.state && this.state.activeTab === 'visits') {
                        // تشغيل الرسم الثقيل في frame مستقل لتقليل تحذيرات setTimeout الطويلة
                        this.scheduleVisitsTabRender(false, 0);
                    }
                    if (typeof Utils !== 'undefined' && Utils.safeLog && AppState.appData) {
                        const visitsCount = (AppState.appData.clinicVisits || []).length;
                        const medsCount = (AppState.appData.clinicMedications || AppState.appData.medications || []).length;
                        Utils.safeLog(`✅ تم تحميل مديول العيادة بنجاح: ${visitsCount} زيارة، ${medsCount} دواء`);
                    }
                }).catch((error) => {
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                        Utils.safeWarn('⚠️ تعذر تحميل بعض البيانات:', error && error.message);
                    }
                }).finally(() => {
                    this.state.initialized = true;
                });
            } else {
                Utils.safeLog('✅ عرض الواجهة بالبيانات المحفوظة محلياً - تحديث في الخلفية');
                this.syncDataInBackground();
                this.state.initialized = true;
            }

        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل مديول العيادة:', error);

            // في حالة الخطأ، عرض الواجهة بالبيانات المتوفرة (إن وجدت)
            if (this.hasValidLocalData()) {
                this.renderUI();
                Utils.safeLog('✅ تم عرض الواجهة بالبيانات المحلية رغم وجود خطأ');
            }

            // إظهار إشعار خطأ فقط في التحميل الأول
            if (!this.state.initialized) {
                Notification?.error?.('حدث خطأ أثناء تحميل بيانات العيادة');
            }
        } finally {
            // إخفاء شاشة التحميل دائماً (في حالة وجودها)
            Loading.hide();
        }
    },

    /**
     * التحقق من وجود بيانات محلية صالحة
     */
    hasValidLocalData() {
        const ad = AppState.appData;
        if (!ad) return false;
        const medications = ad.medications || ad.clinicMedications || [];
        const sickLeave = ad.sickLeave || [];
        const injuries = ad.injuries || [];
        const visits = ad.clinicVisits || [];

        // نعتبر البيانات صالحة إذا كان هناك على الأقل نوع واحد من البيانات
        return medications.length > 0 || sickLeave.length > 0 || injuries.length > 0 || visits.length > 0;
    },

    /**
     * مزامنة البيانات من الخادم
     */
    async syncDataFromServer() {
        const promises = [];
        const REQUEST_TIMEOUT = 8000; // 8 ثوان لمعظم الطلبات الخفيفة
        /** سجل التردد (الموظفين + المقاولين) قد يكون كبيراً — مهلة كافية لإكمال getAllClinicVisits */
        const CLINIC_VISITS_REQUEST_TIMEOUT = 120000;

        // دالة مساعدة لإضافة timeout للطلب مع معالجة أفضل للأخطاء
        const requestWithTimeout = (promise, timeout, dataType) => {
            return Utils.promiseWithTimeout(
                promise,
                timeout,
                () => new Error(`Request timeout for ${dataType}`)
            );
        };

        // تحميل الأدوية
        promises.push(
            requestWithTimeout(
                GoogleIntegration.sendRequest({
                    action: 'getAllMedications',
                    data: {}
                }),
                REQUEST_TIMEOUT,
                'medications'
            )
                .then(result => {
                    if (result && result.success && Array.isArray(result.data)) {
                        // ✅ تطبيع الأدوية فور تحميلها (الأرقام قد تأتي كـ string من Google Sheets)
                        const normalizedMeds = result.data.map(m => this.normalizeMedicationRecord(m));
                        AppState.appData.medications = normalizedMeds;
                        AppState.appData.clinicMedications = normalizedMeds;
                        AppState.appData.clinicInventory = normalizedMeds;
                        Utils.safeLog(`✅ تم تحميل ${result.data.length} دواء`);
                    }
                }).catch(error => {
                    if (AppState.debugMode) {
                        Utils.safeWarn('⚠️ تعذر تحميل الأدوية:', error.message);
                    }
                })
        );

        // تحميل الإجازات المرضية
        promises.push(
            requestWithTimeout(
                GoogleIntegration.sendRequest({
                    action: 'getAllSickLeaves',
                    data: {}
                }),
                REQUEST_TIMEOUT,
                'sickLeave'
            )
                .then(result => {
                    if (result && result.success && Array.isArray(result.data)) {
                        AppState.appData.sickLeave = result.data;
                        Utils.safeLog(`✅ تم تحميل ${result.data.length} إجازة مرضية`);
                    }
                }).catch(error => {
                    if (AppState.debugMode) {
                        Utils.safeWarn('⚠️ تعذر تحميل الإجازات المرضية:', error.message);
                    }
                })
        );

        // تحميل الإصابات
        promises.push(
            requestWithTimeout(
                GoogleIntegration.sendRequest({
                    action: 'getAllInjuries',
                    data: {}
                }),
                REQUEST_TIMEOUT,
                'injuries'
            )
                .then(result => {
                    if (result && result.success && Array.isArray(result.data)) {
                        AppState.appData.injuries = result.data;
                        Utils.safeLog(`✅ تم تحميل ${result.data.length} إصابة`);
                    }
                }).catch(error => {
                    if (AppState.debugMode) {
                        Utils.safeWarn('⚠️ تعذر تحميل الإصابات:', error.message);
                    }
                })
        );

        // سجل التردد: طلب واحد فقط عبر loadVisitsDataFromBackend (موظفين + مقاولين) — بدون تكرار getAllClinicVisits
        promises.push(
            requestWithTimeout(
                this.loadVisitsDataFromBackend(),
                CLINIC_VISITS_REQUEST_TIMEOUT,
                'clinicVisits'
            )
                .then(() => {
                    const mergedVisits = AppState.appData.clinicVisits || [];
                    Utils.safeLog(
                        `✅ مزامنة سجل التردد: ${mergedVisits.length} زيارة ` +
                        `(${mergedVisits.filter(v => v.personType === 'employee' || !v.personType).length} موظف، ` +
                        `${mergedVisits.filter(v => v.personType === 'contractor').length} مقاول)`
                    );
                })
                .catch(error => {
                    if (AppState.debugMode) {
                        Utils.safeWarn('⚠️ تعذر تحميل سجل التردد:', error.message);
                    }
                })
        );

        // انتظار انتهاء جميع الطلبات دون قطع مجمع بمهلة قصيرة (كانت تُسقط سجل التردد قبل اكتماله)
        try {
            await Promise.allSettled(promises);
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في مزامنة البيانات:', error.message);
        }

        // ✅ حفظ البيانات محلياً في جميع الحالات لضمان عدم فقدان البيانات
        // (حتى لو فشل بعض الطلبات، نحفظ ما تم تحميله بنجاح)
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            try {
                // التأكد من وجود البيانات قبل الحفظ
                this.ensureData();
                window.DataManager.save();
                if (AppState.debugMode) {
                    Utils.safeLog('✅ تم حفظ جميع بيانات العيادة محلياً بعد syncDataFromServer');
                }
            } catch (error) {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ تعذر حفظ البيانات محلياً:', error.message);
                }
            }
        }
    },

    /**
     * مزامنة البيانات في الخلفية بدون عرض شاشة تحميل
     */
    async syncDataInBackground() {
        try {
            Utils.safeLog('🔄 مزامنة بيانات العيادة في الخلفية...');

            // ✅ تحسين: زيادة وقت المزامنة الخلفية قليلاً لإعطاء فرصة أفضل للنجاح
            await Utils.promiseWithTimeout(
                this.syncDataFromServer(),
                130000,
                () => new Error('Background sync timeout')
            );

            // حفظ وقت آخر مزامنة
            localStorage.setItem('clinic_last_sync', Date.now().toString());

            // ✅ إعادة تطبيع البيانات بعد المزامنة
            this.ensureData();

            // تحديث الواجهة بصمت فقط إذا تغيرت البيانات
            const hasData = this.hasValidLocalData();
            if (hasData) {
                this.renderUI();
                
                // ✅ إذا كان تبويب سجل التردد مفتوحاً، تحديثه مباشرة
                if (this.state && this.state.activeTab === 'visits') {
                    this.scheduleVisitsTabRender(false, 0);
                }
                
                Utils.safeLog('✅ تمت مزامنة بيانات العيادة في الخلفية');
            }
        } catch (error) {
            // تجاهل الأخطاء في المزامنة الخلفية (لا تؤثر على تجربة المستخدم)
            if (AppState.debugMode) {
                Utils.safeWarn('⚠️ خطأ في مزامنة البيانات في الخلفية:', error.message);
            }
            // في حالة الخطأ، نحتفظ بالبيانات المحلية الموجودة
            Utils.safeLog('ℹ️ تم الاحتفاظ بالبيانات المحلية');
        }
    },

    /**
     * تحديث البيانات من الخادم
     */
    async refresh() {
        Utils.safeLog('🔄 تحديث بيانات العيادة...');
        Notification?.info?.('جاري تحديث البيانات...');

        await this.load();

        Notification?.success?.('تم تحديث البيانات بنجاح');
    },

    /**
     * التحقق من صلاحية الوصول لتبويب معين
     */
    hasTabAccess(tabName) {
        const user = AppState.currentUser;
        if (!user) return false;

        // المدير لديه صلاحيات كاملة
        if (user.role === 'admin') return true;

        // التحقق من الصلاحيات التفصيلية
        if (typeof Permissions !== 'undefined') {
            return Permissions.hasDetailedPermission('clinic', tabName);
        }

        // افتراضياً، نعطي الوصول (للتوافق مع المستخدمين القدامى)
        return true;
    },

    /**
     * عرض واجهة المستخدم
     */
    renderUI() {
        const section = document.getElementById('clinic-section');
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeError) Utils.safeError('❌ قسم clinic-section غير موجود!');
            return;
        }

        const ad = AppState.appData;
        if (!ad) {
            section.innerHTML = '<div class="content-card"><div class="card-body"><p class="text-gray-600">جاري تحميل البيانات...</p></div></div>';
            return;
        }

        const medicationsCount = this.getMedications().length;
        const sickLeavesCount = this.getSickLeaves().length;
        const injuriesCount = this.getInjuries().length;
        const visitsCount = (ad.clinicVisits || []).length;
        const isAdmin = this.isCurrentUserAdmin();

        section.innerHTML = `
            <div class="section-header">
                <div class="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-clinic-medical ml-3"></i>
                            نظام العيادة الطبية
                        </h1>
                        <p class="section-subtitle">إدارة سجل التردد، الأدوية، الإجازات المرضية، والإصابات</p>
                    </div>
                    <div class="flex gap-2">
                        ${isAdmin ? `
                        <button id="clinic-visit-types-settings-btn" class="btn-secondary" title="إدارة أنواع الزيارة (مدير النظام فقط)">
                            <i class="fas fa-list-ul ml-2"></i>
                            أنواع الزيارة
                        </button>
                        ` : ''}
                        <button id="clinic-refresh-btn" class="btn-secondary" title="تحديث البيانات">
                            <i class="fas fa-sync-alt ml-2"></i>
                            تحديث
                        </button>
                        <button id="clinic-register-visit-btn" class="btn-primary" title="تسجيل زيارة جديدة">
                            <i class="fas fa-plus ml-2"></i>
                            تسجيل زيارة
                        </button>
                    </div>
                </div>
            </div>

            <!-- إحصائيات سريعة -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div class="content-card">
                    <div class="text-center">
                        <i class="fas fa-hospital text-4xl text-green-600 mb-2"></i>
                        <p class="text-sm text-gray-600">سجل التردد</p>
                        <p class="text-2xl font-bold">${visitsCount}</p>
                    </div>
                </div>
                <div class="content-card">
                    <div class="text-center">
                        <i class="fas fa-pills text-4xl text-blue-600 mb-2"></i>
                        <p class="text-sm text-gray-600">الأدوية</p>
                        <p class="text-2xl font-bold">${medicationsCount}</p>
                    </div>
                </div>
                <div class="content-card">
                    <div class="text-center">
                        <i class="fas fa-calendar-times text-4xl text-orange-600 mb-2"></i>
                        <p class="text-sm text-gray-600">الإجازات المرضية</p>
                        <p class="text-2xl font-bold">${sickLeavesCount}</p>
                    </div>
                </div>
                <div class="content-card">
                    <div class="text-center">
                        <i class="fas fa-user-injured text-4xl text-red-600 mb-2"></i>
                        <p class="text-sm text-gray-600">الإصابات</p>
                        <p class="text-2xl font-bold">${injuriesCount}</p>
                    </div>
                </div>
            </div>

            <!-- Tabs Navigation -->
            <div class="mt-6">
                <div class="clinic-tabs">
                    ${this.hasTabAccess('visits') ? `
                    <button class="clinic-tab-btn ${this.state.activeTab === 'visits' ? 'active' : ''}" data-tab="visits">
                        <i class="fas fa-hospital ml-2"></i>
                        سجل التردد (${visitsCount})
                    </button>
                    ` : ''}
                    ${this.hasTabAccess('medications') ? `
                    <button class="clinic-tab-btn ${this.state.activeTab === 'medications' ? 'active' : ''}" data-tab="medications">
                        <i class="fas fa-pills ml-2"></i>
                        الأدوية (${medicationsCount})
                    </button>
                    ` : ''}
                    ${this.hasTabAccess('sickLeave') ? `
                    <button class="clinic-tab-btn ${this.state.activeTab === 'sickLeave' ? 'active' : ''}" data-tab="sickLeave">
                        <i class="fas fa-calendar-times ml-2"></i>
                        الإجازات المرضية (${sickLeavesCount})
                    </button>
                    ` : ''}
                    ${this.hasTabAccess('dispensed-medications') ? `
                    <button class="clinic-tab-btn ${this.state.activeTab === 'dispensed-medications' ? 'active' : ''}" data-tab="dispensed-medications">
                        <i class="fas fa-prescription-bottle-alt ml-2"></i>
                        سجل الأدوية المنصرفة
                    </button>
                    ` : ''}
                    ${this.hasTabAccess('injuries') ? `
                    <button class="clinic-tab-btn ${this.state.activeTab === 'injuries' ? 'active' : ''}" data-tab="injuries">
                        <i class="fas fa-user-injured ml-2"></i>
                        الإصابات (${injuriesCount})
                    </button>
                    ` : ''}
                    ${this.hasTabAccess('supply-request') ? `
                    <button class="clinic-tab-btn ${this.state.activeTab === 'supply-request' ? 'active' : ''}" data-tab="supply-request">
                        <i class="fas fa-shopping-cart ml-2"></i>
                        إرسال طلب احتياجات
                    </button>
                    ` : ''}
                    ${this.hasTabAccess('approvals') ? `
                    <button class="clinic-tab-btn ${this.state.activeTab === 'approvals' ? 'active' : ''}" data-tab="approvals">
                        <i class="fas fa-check-circle ml-2"></i>
                        طلبات الموافقة
                        <span id="pending-approvals-badge" class="badge badge-danger mr-2" style="display: none;"></span>
                    </button>
                    ` : ''}
                    ${this.hasTabAccess('data-analysis') ? `
                    <button class="clinic-tab-btn ${this.state.activeTab === 'data-analysis' ? 'active' : ''}" data-tab="data-analysis">
                        <i class="fas fa-chart-bar ml-2"></i>
                        تحليل البيانات
                    </button>
                    ` : ''}
                </div>

                <!-- Tab Panels -->
                <div class="clinic-tab-panel ${this.state.activeTab === 'visits' ? 'active' : ''}" data-tab-panel="visits"></div>
                <div class="clinic-tab-panel ${this.state.activeTab === 'medications' ? 'active' : ''}" data-tab-panel="medications"></div>
                <div class="clinic-tab-panel ${this.state.activeTab === 'sickLeave' ? 'active' : ''}" data-tab-panel="sickLeave"></div>
                ${isAdmin ? `
                <div class="clinic-tab-panel ${this.state.activeTab === 'dispensed-medications' ? 'active' : ''}" data-tab-panel="dispensed-medications"></div>
                ` : ''}
                <div class="clinic-tab-panel ${this.state.activeTab === 'injuries' ? 'active' : ''}" data-tab-panel="injuries"></div>
                <div class="clinic-tab-panel ${this.state.activeTab === 'supply-request' ? 'active' : ''}" data-tab-panel="supply-request"></div>
                ${isAdmin ? `
                <div class="clinic-tab-panel ${this.state.activeTab === 'approvals' ? 'active' : ''}" data-tab-panel="approvals"></div>
                <div class="clinic-tab-panel ${this.state.activeTab === 'data-analysis' ? 'active' : ''}" data-tab-panel="data-analysis"></div>
                ` : ''}
            </div>
        `;
        this.applyModuleI18n(section);

        // ربط الأحداث
        this.renderTabNavigation();
        this.renderActiveTabContent();
        this.bindTabEvents(); // إضافة ربط أحداث الأزرار

        // ربط زر التحديث
        const refreshBtn = document.getElementById('clinic-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }

        // ربط زر تسجيل زيارة (استجابة فورية + منع تكرار النقر)
        const registerVisitBtn = document.getElementById('clinic-register-visit-btn');
        if (registerVisitBtn) {
            registerVisitBtn.addEventListener('click', () => {
                if (registerVisitBtn.disabled) return;
                registerVisitBtn.disabled = true;
                this.showVisitForm(null, registerVisitBtn);
            });
        }

        // ربط زر إدارة أنواع الزيارة (مدير النظام فقط)
        const visitTypesSettingsBtn = document.getElementById('clinic-visit-types-settings-btn');
        if (visitTypesSettingsBtn) {
            visitTypesSettingsBtn.addEventListener('click', () => this.showVisitTypesSettingsModal());
        }

        // إضافة أيقونات التنقل مباشرة بعد renderUI
        // هذا يضمن ظهور الأيقونات حتى بعد استبدال innerHTML
        if (typeof UI !== 'undefined' && UI.addNavigationIconsAfterRender) {
            UI.addNavigationIconsAfterRender('clinic');
        } else if (typeof UI !== 'undefined' && UI.addNavigationIcons) {
            // Fallback للطريقة القديمة
            setTimeout(() => {
                UI.addNavigationIcons(section, 'clinic');
            }, 0);
            setTimeout(() => {
                UI.addNavigationIcons(section, 'clinic');
            }, 100);
        }
    },

    // ===== سجل الأدوية المنصرفة (للمدير فقط) =====

    async renderDispensedMedicationsTab() {
        const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="dispensed-medications"]');
        if (!panel) {
            Utils.safeWarn('⚠️ لوحة سجل الأدوية المنصرفة غير موجودة');
            return;
        }

        if (!this.isCurrentUserAdmin()) {
            panel.innerHTML = '<div class="text-center py-8 text-gray-500">هذا القسم متاح للمديرين فقط</div>';
            return;
        }
        const { t } = this.getTranslations();

        // ✅ التأكد من تطبيع البيانات أولاً
        this.ensureData();
        
        // ✅ التأكد من تحميل بيانات الزيارات إذا لم تكن موجودة أو كانت غير كاملة
        const hasLocalData = AppState.appData.clinicVisits && AppState.appData.clinicVisits.length > 0;
        const needsReload = !hasLocalData || (hasLocalData && AppState.appData.clinicVisits.some(v => {
            // التحقق من وجود زيارة بدون أدوية مطبعة ولكن لديها medicationsDispensed أو medicationsDispensedQty
            const meds = this.normalizeVisitMedications(v.medications);
            return (!meds || meds.length === 0) && (v.medicationsDispensed || (v.medicationsDispensedQty && v.medicationsDispensedQty > 0));
        }));
        
        if (needsReload && typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
            // عرض رسالة تحميل
            panel.innerHTML = '<div class="text-center py-8 text-gray-500"><div style="width: 300px; margin: 0 auto 16px;"><div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;"><div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div></div></div><p>جاري تحميل البيانات...</p></div>';
            
            try {
                // تحميل البيانات من Backend
                await this.loadVisitsDataFromBackend();
                // ✅ إعادة تطبيع البيانات بعد التحميل
                this.ensureData();
                if (AppState.debugMode) {
                    Utils.safeLog('✅ تم تحميل بيانات الزيارات لسجل الأدوية المنصرفة');
                }
            } catch (error) {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ تعذر تحميل بيانات الزيارات لسجل الأدوية المنصرفة:', error.message);
                }
                // الاستمرار بالبيانات المحلية المتاحة (حتى لو كانت فارغة)
                if (!AppState.appData.clinicVisits) {
                    AppState.appData.clinicVisits = [];
                }
                // ✅ إعادة تطبيع البيانات المحلية
                this.ensureData();
            }
        }

        // ✅ جمع جميع الأدوية المنصرفة من سجل التردد (بعد التأكد من تحميل البيانات)
        // ✅ تضمين جميع الزيارات (الموظفين والمقاولين) مع بيانات العيادة الكاملة
        const visits = AppState.appData.clinicVisits || [];
        const dispensedMedications = [];
        let dataChanged = false;

        visits.forEach(visit => {
            if (!visit || typeof visit !== 'object') return;
            
            // ✅ تطبيع الأدوية بشكل شامل (دعم جميع الصيغ)
            // أولاً: normalize medications إذا كانت موجودة
            let medsArr = this.normalizeVisitMedications(visit.medications);
            
            // ثانياً: إذا كانت medications فارغة أو غير صالحة، نحاول من medicationsDispensed
            if ((!medsArr || medsArr.length === 0) && visit.medicationsDispensed) {
                medsArr = this.normalizeVisitMedications(visit.medicationsDispensed);
                if (medsArr && medsArr.length > 0) {
                    // ✅ تحديث visit.medications بالبيانات المطبعة لضمان ثباتها
                    visit.medications = medsArr;
                    dataChanged = true;
                    if (AppState.debugMode) {
                        Utils.safeLog(`✅ تم تحويل medicationsDispensed في سجل الأدوية لزيارة ${visit.id || 'غير محدد'}:`, medsArr.length, 'دواء');
                    }
                }
            }
            
            // ثالثاً: إذا كان medicationsDispensedQty موجوداً ولكن لا توجد قائمة أدوية، نستخدمه
            if ((!medsArr || medsArr.length === 0) && visit.medicationsDispensedQty && visit.medicationsDispensedQty > 0) {
                // إنشاء سجل دواء افتراضي بناءً على الكمية الإجمالية
                const totalQty = parseInt(visit.medicationsDispensedQty, 10) || 0;
                if (totalQty > 0) {
                    medsArr = [{
                        medicationName: visit.medicationsDispensed || 'دواء غير محدد',
                        quantity: totalQty,
                        unit: 'وحدة',
                        notes: ''
                    }];
                    visit.medications = medsArr;
                    dataChanged = true;
                    if (AppState.debugMode) {
                        Utils.safeWarn(`⚠️ زيارة ${visit.id || 'غير محدد'} لديها medicationsDispensedQty=${totalQty} ولكن لا توجد قائمة أدوية. تم إنشاء سجل افتراضي.`);
                    }
                }
            }
            
            // ✅ إضافة الأدوية إلى القائمة مع بيانات العيادة الكاملة
            if (medsArr && medsArr.length > 0) {
                medsArr.forEach(med => {
                    if (med && (med.medicationName || med.name)) {
                        // ✅ الحصول على بيانات العيادة (المصنع، الموقع، إلخ)
                        const factoryName = visit.factoryName || this.getVisitFactoryDisplayName(visit) || '-';
                        const location = visit.employeeLocation || visit.workArea || visit.location || '-';
                        
                        dispensedMedications.push({
                            visitId: visit.id,
                            visitDate: visit.visitDate || visit.createdAt,
                            employeeName: visit.employeeName || visit.contractorName || visit.contractorWorkerName || visit.externalName || '',
                            employeeCode: visit.employeeCode || visit.employeeNumber || '',
                            employeeDepartment: visit.employeeDepartment || visit.department || '',
                            factory: factoryName,
                            location: location,
                            personType: visit.personType || (visit.contractorName || visit.externalName ? 'contractor' : 'employee'),
                            medicationName: med.medicationName || med.name || '',
                            quantity: (med.quantity !== null && med.quantity !== undefined) ? parseInt(med.quantity, 10) : 0,
                            unit: med.unit || 'وحدة',
                            notes: med.notes || ''
                        });
                    }
                });
            }
        });
        
        // ✅ حفظ البيانات المحدثة محلياً لضمان ثباتها عند إعادة التحميل
        if (dataChanged && typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            try {
                window.DataManager.save();
                if (AppState.debugMode) {
                    Utils.safeLog('✅ تم حفظ بيانات الأدوية المنصرفة محلياً بعد التطبيع');
                }
            } catch (error) {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ تعذر حفظ بيانات الأدوية المنصرفة محلياً:', error.message);
                }
            }
        }
        
        // ✅ إضافة logging للتحقق من البيانات
        if (AppState.debugMode) {
            const employeeCount = dispensedMedications.filter(m => m.personType === 'employee' || !m.personType).length;
            const contractorCount = dispensedMedications.filter(m => m.personType === 'contractor').length;
            Utils.safeLog(`✅ سجل الأدوية المنصرفة: ${dispensedMedications.length} دواء من ${visits.length} زيارة (${employeeCount} موظف، ${contractorCount} مقاول)`);
        }

        // ترتيب حسب التاريخ (الأحدث أولاً)
        dispensedMedications.sort((a, b) => {
            const dateA = new Date(a.visitDate);
            const dateB = new Date(b.visitDate);
            return dateB - dateA;
        });

        const rows = dispensedMedications.map(item => {
            // ✅ إصلاح: التأكد من أن تاريخ الصرف يُعرض بشكل صحيح
            // استخدام visitDate إذا كان موجوداً وصحيحاً، وإلا استخدام createdAt
            let displayDate = item.visitDate || item.createdAt || '';
            if (displayDate) {
                try {
                    // التحقق من أن التاريخ صحيح قبل العرض
                    const testDate = new Date(displayDate);
                    if (isNaN(testDate.getTime())) {
                        // إذا كان التاريخ غير صحيح، استخدام createdAt كبديل
                        displayDate = item.createdAt || '';
                    }
                } catch (error) {
                    // في حالة الخطأ، استخدام createdAt كبديل
                    displayDate = item.createdAt || '';
                }
            }
            const visitDate = this.formatDate(displayDate, true);
            
            const medicationInfo = this.getMedications().find(m =>
                m.name === item.medicationName || m.name?.toLowerCase() === item.medicationName?.toLowerCase()
            );
            const medicationType = medicationInfo?.type || '-';
            const medicationStatus = medicationInfo ? this.calculateMedicationStatus(medicationInfo) : null;
            const statusBadge = medicationStatus ?
                `<span class="badge ${this.getMedicationStatusClasses(medicationStatus.status)}">${medicationStatus.status}</span>` :
                '-';
            
            // تلوين الصفوف حسب حالة الدواء
            const status = medicationStatus?.status || 'ساري';
            const rowClass = this.getMedicationRowClass(status);

            return `
                <tr class="${rowClass}">
                    <td>${visitDate}</td>
                    <td>${Utils.escapeHTML(item.employeeCode)}</td>
                    <td>${Utils.escapeHTML(item.employeeName)}</td>
                    <td>${Utils.escapeHTML(item.employeeDepartment)}</td>
                    <td>${Utils.escapeHTML(item.factory || '-')}</td>
                    <td>${Utils.escapeHTML(item.location || '-')}</td>
                    <td>${Utils.escapeHTML(item.medicationName)}</td>
                    <td>${Utils.escapeHTML(medicationType)}</td>
                    <td class="text-center">${item.quantity} ${Utils.escapeHTML(item.unit)}</td>
                    <td class="text-center">${statusBadge}</td>
                    <td>${Utils.escapeHTML(item.notes || '-')}</td>
                    <td class="text-center">
                        <button type="button" class="btn-icon btn-icon-primary" data-action="view-visit" data-id="${Utils.escapeHTML(item.visitId || '')}" title="عرض الزيارة">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        const tableHtml = dispensedMedications.length
            ? `
                <div class="mb-4 flex items-center justify-between">
                    <h3 class="text-lg font-semibold">${t('tab.dispensedLog') || 'Dispensed Medications Log'}</h3>
                    <div class="flex gap-2">
                        <input type="text" id="dispensed-med-search" class="form-input" placeholder="بحث..." style="width: 250px;">
                        <button type="button" class="btn-secondary" id="export-dispensed-med-btn">
                            <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                        </button>
                        <button type="button" class="btn-secondary" id="export-dispensed-med-pdf-btn">
                            <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                        </button>
                    </div>
                </div>
                <div class="table-wrapper clinic-table-wrapper" style="overflow-x: auto; overflow-y: auto; max-height: 70vh;">
                    <table class="data-table table-header-green">
                        <thead>
                            <tr>
                                <th>${t('table.dispenseDate')}</th>
                                <th>${t('table.employeeCode')}</th>
                                <th>${t('table.patientName')}</th>
                                <th>${t('table.department')}</th>
                                <th>${t('table.factory')}</th>
                                <th>${t('table.workplace')}</th>
                                <th>${t('table.medications')}</th>
                                <th>${t('table.medicationType')}</th>
                                <th class="text-center">${t('table.quantity')}</th>
                                <th class="text-center">${t('table.medicationStatus')}</th>
                                <th>${t('table.notes')}</th>
                                <th class="text-center">${t('table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `
            : this.renderEmptyState('لا توجد أدوية منصرفة مسجلة.');

        panel.innerHTML = tableHtml;
        this.applyModuleI18n(panel);

        // إضافة مستمعي التمرير للجدول
        setTimeout(() => {
            const wrapper = panel.querySelector('.clinic-table-wrapper');
            if (wrapper) {
                this.setupTableScrollListeners(wrapper);
            }
        }, 100);

        // ربط الأحداث
        const searchInput = panel.querySelector('#dispensed-med-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const tableRows = panel.querySelectorAll('tbody tr');
                tableRows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            });
        }

        const exportBtn = panel.querySelector('#export-dispensed-med-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportDispensedMedicationsToExcel(dispensedMedications));
        }
        const exportPdfBtn = panel.querySelector('#export-dispensed-med-pdf-btn');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => this.exportDispensedMedicationsToPDF(dispensedMedications));
        }

        panel.querySelectorAll('[data-action="view-visit"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const visitId = btn.getAttribute('data-id');
                if (visitId) {
                    this.viewVisit(visitId);
                }
            });
        });
    },

    exportDispensedMedicationsToExcel(medications) {
        if (!medications || medications.length === 0) {
            Notification?.warning?.('لا توجد بيانات للتصدير');
            return;
        }

        if (typeof XLSX === 'undefined') {
            Notification?.error?.('مكتبة Excel غير متوفرة');
            return;
        }

        const data = medications.map((item, index) => {
            // ✅ إصلاح: التأكد من أن تاريخ الصرف يُعرض بشكل صحيح في Excel
            let displayDate = item.visitDate || item.createdAt || '';
            if (displayDate) {
                try {
                    const testDate = new Date(displayDate);
                    if (isNaN(testDate.getTime())) {
                        displayDate = item.createdAt || '';
                    }
                } catch (error) {
                    displayDate = item.createdAt || '';
                }
            }
            return {
                'م': index + 1,
                'تاريخ الصرف': this.formatDate(displayDate, true),
                'الكود الوظيفي': item.employeeCode,
                'اسم المريض': item.employeeName,
                'الإدارة': item.employeeDepartment,
                'المصنع': item.factory || '-',
                'الموقع': item.location || '-',
                'اسم الدواء': item.medicationName,
                'الكمية': item.quantity,
                'الوحدة': item.unit,
                'ملاحظات': item.notes || ''
            };
        });

        try {
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(data);
            worksheet['!cols'] = [
                { wch: 5 },  // م
                { wch: 18 }, // تاريخ الصرف
                { wch: 14 }, // الكود الوظيفي
                { wch: 22 }, // اسم المريض
                { wch: 18 }, // الإدارة
                { wch: 16 }, // المصنع
                { wch: 18 }, // الموقع
                { wch: 28 }, // اسم الدواء
                { wch: 10 }, // الكمية
                { wch: 10 }, // الوحدة
                { wch: 20 }  // ملاحظات
            ];
            XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل الأدوية المنصرفة');
            const fileName = `سجل_الأدوية_المنصرفة_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            Notification?.success?.('تم تصدير سجل الأدوية المنصرفة إلى Excel بنجاح');
        } catch (error) {
            Utils.safeError('خطأ في تصدير Excel:', error);
            Notification?.error?.('فشل تصدير Excel: ' + (error?.message || error));
        }
    },

    /**
     * تصدير سجل الأدوية المنصرفة إلى PDF (طباعة/حفظ كـ PDF)
     */
    exportDispensedMedicationsToPDF(medications) {
        if (!medications || medications.length === 0) {
            Notification?.warning?.('لا توجد بيانات للتصدير');
            return;
        }

        try {
            const tableRows = medications.map((item, index) => {
                let displayDate = item.visitDate || item.createdAt || '';
                if (displayDate) {
                    try {
                        const testDate = new Date(displayDate);
                        if (isNaN(testDate.getTime())) {
                            displayDate = item.createdAt || '';
                        }
                    } catch (e) {
                        displayDate = item.createdAt || '';
                    }
                }
                const visitDate = this.formatDate(displayDate, true);
                return `
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${index + 1}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(visitDate)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(item.employeeCode)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(item.employeeName)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(item.employeeDepartment)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(item.factory || '-')}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(item.location || '-')}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(item.medicationName)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${item.quantity} ${Utils.escapeHTML(item.unit)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(item.notes || '-')}</td>
                    </tr>
                `;
            }).join('');

            const formCode = `CLINIC-DISPENSED-MEDS-${new Date().toISOString().slice(0, 10)}`;
            const formTitle = 'سجل الأدوية المنصرفة';

            const content = `
                <div style="margin-bottom: 20px;">
                    <h2 style="text-align: center; color: #1f2937; margin-bottom: 15px;">سجل الأدوية المنصرفة</h2>
                    <p style="text-align: center; color: #6b7280; font-size: 14px;">إجمالي السجلات: ${medications.length}</p>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold;">م</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">تاريخ الصرف</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">الكود الوظيفي</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">اسم المريض</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">الإدارة</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">المصنع</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">الموقع</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">اسم الدواء</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold;">الكمية</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">ملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            `;

            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(formCode, formTitle, content, false, true, { source: 'ClinicDispensedMeds' }, new Date().toISOString(), new Date().toISOString())
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${formTitle}</title></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                        }, 1000);
                        Notification?.success?.('تم تحضير السجلات للطباعة/الحفظ كـ PDF');
                    }, 250);
                };
            } else {
                URL.revokeObjectURL(url);
                Notification?.error?.('يرجى السماح للنوافذ المنبثقة لتصدير PDF');
            }
        } catch (error) {
            URL.revokeObjectURL(url);
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification?.error?.('فشل تصدير PDF: ' + (error?.message || error));
        }
    },

    // ===== إرسال طلب احتياجات (للمستخدمين) =====

    renderSupplyRequestTab() {
        const panel = document.querySelector('.clinic-tab-panel[data-tab-panel="supply-request"]');
        if (!panel) return;

        this.ensureData();

        if (!AppState.appData.clinicSupplyRequests) {
            AppState.appData.clinicSupplyRequests = [];
        }

        const userRequests = AppState.appData.clinicSupplyRequests.filter(req =>
            req.requestedBy?.id === AppState.currentUser?.id ||
            req.requestedBy?.email === AppState.currentUser?.email
        ).sort((a, b) => new Date(b.createdAt || b.requestDate) - new Date(a.createdAt || a.requestDate));

        const isAdmin = this.isCurrentUserAdmin();
        const allRequests = isAdmin ?
            AppState.appData.clinicSupplyRequests.sort((a, b) =>
                new Date(b.createdAt || b.requestDate) - new Date(a.createdAt || a.requestDate)
            ) :
            userRequests;

        panel.innerHTML = `
            <div class="space-y-6">
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-shopping-cart ml-2"></i>
                            إرسال طلب احتياجات
                        </h2>
                    </div>
                    <div class="card-body">
                        <form id="supply-request-form" class="space-y-4">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-tag ml-2"></i>
                                        نوع الطلب *
                                    </label>
                                    <select id="request-type" class="form-input" required>
                                        <option value="">اختر نوع الطلب</option>
                                        <option value="medication">أدوية</option>
                                        <option value="equipment">أجهزة طبية</option>
                                        <option value="supplies">مستلزمات طبية</option>
                                        <option value="other">أخرى</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-box ml-2"></i>
                                        اسم العنصر المطلوب *
                                    </label>
                                    <input type="text" id="item-name" class="form-input" placeholder="مثال: باراسيتامول 500 مجم" required>
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-sort-numeric-up ml-2"></i>
                                        الكمية المطلوبة *
                                    </label>
                                    <input type="number" id="quantity" class="form-input" placeholder="مثال: 10" min="1" required>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-ruler ml-2"></i>
                                        الوحدة
                                    </label>
                                    <input type="text" id="unit" class="form-input" placeholder="مثال: علبة، عبوة، قطعة">
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-comment-alt ml-2"></i>
                                    ملاحظات / سبب الطلب
                                </label>
                                <textarea id="request-notes" class="form-textarea" rows="3" placeholder="اذكر سبب الحاجة لهذا العنصر..."></textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-exclamation-triangle ml-2"></i>
                                    الأولوية
                                </label>
                                <select id="priority" class="form-input">
                                    <option value="normal">عادية</option>
                                    <option value="high">عالية</option>
                                    <option value="urgent">عاجلة</option>
                                </select>
                            </div>
                            <div class="flex gap-2">
                                <button type="submit" class="btn-primary">
                                    <i class="fas fa-paper-plane ml-2"></i>
                                    إرسال الطلب
                                </button>
                                <button type="reset" class="btn-secondary">
                                    <i class="fas fa-redo ml-2"></i>
                                    إعادة تعيين
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-list ml-2"></i>
                            ${isAdmin ? 'جميع طلبات الاحتياجات' : 'طلباتي'}
                        </h2>
                    </div>
                    <div class="card-body">
                        ${this.renderSupplyRequestsList(allRequests, isAdmin)}
                    </div>
                </div>
            </div>
        `;
        this.applyModuleI18n(panel);

        // ربط أحداث النموذج
        const form = panel.querySelector('#supply-request-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitSupplyRequest();
            });
        }

        // ربط أحداث الإجراءات
        panel.querySelectorAll('[data-action="view-request"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const requestId = btn.getAttribute('data-id');
                this.viewSupplyRequest(requestId);
            });
        });

        panel.querySelectorAll('[data-action="update-status"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const requestId = btn.getAttribute('data-id');
                const currentStatus = btn.getAttribute('data-status');
                this.updateSupplyRequestStatus(requestId, currentStatus);
            });
        });

        // إضافة مستمعي التمرير للجدول
        setTimeout(() => {
            const wrapper = panel.querySelector('.clinic-table-wrapper');
            if (wrapper) {
                this.setupTableScrollListeners(wrapper);
            }
        }, 100);
    },

    renderSupplyRequestsList(requests, isAdmin) {
        if (!requests || requests.length === 0) {
            return '<p class="text-center text-gray-500 py-8">لا توجد طلبات</p>';
        }

        const rows = requests.map(request => {
            const requestDate = this.formatDate(request.createdAt || request.requestDate, true);
            const requestedBy = request.requestedBy?.name || request.requestedByName || 'غير معروف';
            const status = request.status || 'pending';
            const priority = request.priority || 'normal';

            const statusBadge = {
                'pending': '<span class="badge badge-warning">قيد الانتظار</span>',
                'approved': '<span class="badge badge-success">موافق عليه</span>',
                'rejected': '<span class="badge badge-danger">مرفوض</span>',
                'fulfilled': '<span class="badge badge-info">تم التنفيذ</span>'
            }[status] || '<span class="badge">غير محدد</span>';

            const priorityBadge = {
                'urgent': '<span class="badge badge-danger">عاجلة</span>',
                'high': '<span class="badge badge-warning">عالية</span>',
                'normal': '<span class="badge badge-info">عادية</span>'
            }[priority] || '<span class="badge">عادية</span>';

            const typeLabel = {
                'medication': 'أدوية',
                'equipment': 'أجهزة طبية',
                'supplies': 'مستلزمات طبية',
                'other': 'أخرى'
            }[request.type] || request.type || 'غير محدد';

            return `
                <tr>
                    <td>${this.formatDate(request.createdAt || request.requestDate, true)}</td>
                    <td>${Utils.escapeHTML(requestedBy)}</td>
                    <td>${Utils.escapeHTML(typeLabel)}</td>
                    <td>${Utils.escapeHTML(request.itemName || '')}</td>
                    <td class="text-center">${request.quantity || ''} ${Utils.escapeHTML(request.unit || '')}</td>
                    <td class="text-center">${priorityBadge}</td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-center">
                        <div class="flex items-center justify-center gap-2">
                            <button type="button" class="btn-icon btn-icon-primary" data-action="view-request" data-id="${Utils.escapeHTML(request.id || '')}" title="عرض التفاصيل">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${isAdmin && status === 'pending' ? `
                            <button type="button" class="btn-icon btn-icon-success" data-action="update-status" data-id="${Utils.escapeHTML(request.id || '')}" data-status="approved" title="موافقة">
                                <i class="fas fa-check"></i>
                            </button>
                            <button type="button" class="btn-icon btn-icon-danger" data-action="update-status" data-id="${Utils.escapeHTML(request.id || '')}" data-status="rejected" title="رفض">
                                <i class="fas fa-times"></i>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="table-wrapper clinic-table-wrapper" style="overflow-x: auto; overflow-y: auto; max-height: 70vh;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>تاريخ الطلب</th>
                            <th>المقدم</th>
                            <th>نوع الطلب</th>
                            <th>اسم العنصر</th>
                            <th class="text-center">الكمية</th>
                            <th class="text-center">الأولوية</th>
                            <th class="text-center">الحالة</th>
                            <th class="text-center">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    },

    async submitSupplyRequest() {
        const type = document.getElementById('request-type')?.value;
        const itemName = document.getElementById('item-name')?.value?.trim();
        const quantity = parseInt(document.getElementById('quantity')?.value);
        const unit = document.getElementById('unit')?.value?.trim() || 'وحدة';
        const notes = document.getElementById('request-notes')?.value?.trim();
        const priority = document.getElementById('priority')?.value || 'normal';

        if (!type || !itemName || !quantity) {
            Notification?.error?.('يرجى ملء جميع الحقول المطلوبة');
            return;
        }

        Loading.show();
        try {
            const request = {
                id: `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type,
                itemName,
                quantity,
                unit,
                notes,
                priority,
                status: 'pending',
                requestedBy: {
                    id: AppState.currentUser?.id,
                    name: AppState.currentUser?.name,
                    email: AppState.currentUser?.email
                },
                createdAt: new Date().toISOString(),
                requestDate: new Date().toISOString()
            };

            // حفظ في Google Sheets
            const result = await GoogleIntegration.sendRequest({
                action: 'addSupplyRequest',
                data: request
            });

            if (result && result.success) {
                // حفظ محلياً أيضاً
                if (!AppState.appData.clinicSupplyRequests) {
                    AppState.appData.clinicSupplyRequests = [];
                }
                AppState.appData.clinicSupplyRequests.push(request);

                // حفظ البيانات محلياً
                if (typeof DataManager !== 'undefined' && DataManager.save) {
                    DataManager.save();
                }

                Loading.hide();
                Notification.success('تم إرسال الطلب بنجاح');

                // إرسال إشعار للمدير
                this.notifyAdminAboutSupplyRequest(request);

                // إعادة تحميل التبويب
                this.renderSupplyRequestTab();

                // تحديث تبويب الموافقات إذا كان مفتوحاً
                if (this.state.activeTab === 'approvals') {
                    setTimeout(() => {
                        this.renderApprovalsTab();
                    }, 500);
                }

                // إعادة تعيين النموذج
                document.getElementById('supply-request-form')?.reset();
            } else {
                throw new Error(result?.message || 'فشل إرسال الطلب');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في إرسال طلب الاحتياج:', error);
            Notification.error('تعذر إرسال الطلب: ' + (error.message || 'حدث خطأ غير معروف'));
        }
    },

    viewSupplyRequest(requestId) {
        const request = AppState.appData.clinicSupplyRequests?.find(r => r.id === requestId);
        if (!request) {
            Notification?.error?.('تعذر العثور على الطلب');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">تفاصيل طلب الاحتياجات</h2>
                    <button type="button" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm font-semibold text-gray-600">تاريخ الطلب</label>
                            <p class="text-gray-800">${this.formatDate(request.createdAt || request.requestDate, true)}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">المقدم</label>
                            <p class="text-gray-800">${Utils.escapeHTML(request.requestedBy?.name || request.requestedByName || 'غير معروف')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">نوع الطلب</label>
                            <p class="text-gray-800">${Utils.escapeHTML({
            'medication': 'أدوية',
            'equipment': 'أجهزة طبية',
            'supplies': 'مستلزمات طبية',
            'other': 'أخرى'
        }[request.type] || request.type || 'غير محدد')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">اسم العنصر</label>
                            <p class="text-gray-800">${Utils.escapeHTML(request.itemName || '')}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">الكمية</span>
                            <p class="text-gray-800">${request.quantity || ''} ${Utils.escapeHTML(request.unit || '')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">الأولوية</label>
                            <p class="text-gray-800">${Utils.escapeHTML({
            'urgent': 'عاجلة',
            'high': 'عالية',
            'normal': 'عادية'
        }[request.priority] || 'عادية')}</p>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">الحالة</span>
                            <p class="text-gray-800">${Utils.escapeHTML({
            'pending': 'قيد الانتظار',
            'approved': 'موافق عليه',
            'rejected': 'مرفوض',
            'fulfilled': 'تم التنفيذ'
        }[request.status] || 'غير محدد')}</p>
                        </div>
                    </div>
                    ${request.notes ? `
                    <div>
                        <label class="text-sm font-semibold text-gray-600">ملاحظات</label>
                        <p class="text-gray-800 whitespace-pre-line">${Utils.escapeHTML(request.notes)}</p>
                    </div>
                    ` : ''}
                </div>
                <div class="modal-footer form-actions-centered">
                    <button type="button" class="btn-secondary modal-close-btn">إغلاق</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const closeModal = () => modal.remove();
        modal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => btn.addEventListener('click', closeModal));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النافذة.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) closeModal();
            }
        });
    },

    updateSupplyRequestStatus(requestId, newStatus) {
        const request = AppState.appData.clinicSupplyRequests?.find(r => r.id === requestId);
        if (!request) {
            Notification?.error?.('تعذر العثور على الطلب');
            return;
        }

        request.status = newStatus;
        request.updatedAt = new Date().toISOString();
        request.updatedBy = {
            id: AppState.currentUser?.id,
            name: AppState.currentUser?.name,
            email: AppState.currentUser?.email
        };

        // حفظ البيانات
        if (typeof DataManager !== 'undefined' && DataManager.save) {
            DataManager.save();
        }

        const statusText = {
            'approved': 'موافق عليه',
            'rejected': 'مرفوض',
            'fulfilled': 'تم التنفيذ'
        }[newStatus] || newStatus;

        Notification?.success?.(`تم تحديث حالة الطلب إلى: ${statusText}`);

        // إعادة تحميل التبويب
        this.renderSupplyRequestTab();
    },

    /**
     * نموذج محسّن وجميل لتسجيل زيارة جديدة
     */
    showEnhancedVisitForm(visitData = null) {
        const isEdit = !!visitData;
        
        // ✅ التأكد من تحميل البيانات قبل حساب الإحصائيات
        this.ensureData();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        const personType = visitData?.personType || 'employee';
        const visitDate = visitData?.visitDate ? Utils.toDateTimeLocalString(visitData.visitDate) : Utils.toDateTimeLocalString(new Date());
        const exitDate = visitData?.exitDate ? Utils.toDateTimeLocalString(visitData.exitDate) : '';

        // حساب إحصائيات سريعة
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayVisits = (AppState.appData.clinicVisits || []).filter(v => {
            if (!v.visitDate) return false;
            try {
                const visitDate = new Date(v.visitDate);
                visitDate.setHours(0, 0, 0, 0);
                return visitDate.getTime() === today.getTime();
            } catch (e) {
                return false;
            }
        }).length;
        
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        const monthlyVisits = (AppState.appData.clinicVisits || []).filter(v => {
            if (!v.visitDate) return false;
            try {
                const visitDate = new Date(v.visitDate);
                return visitDate >= thisMonth;
            } catch (e) {
                return false;
            }
        }).length;

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1400px; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; height: 90vh;">
                <div class="modal-header modal-header-centered" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px 30px; border-radius: 20px 20px 0 0; flex-shrink: 0;">
                    <h2 class="modal-title" style="color: white; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-hospital-user" style="font-size: 28px;"></i>
                        ${isEdit ? 'تعديل بيانات الزيارة' : 'تسجيل زيارة جديدة للعيادة'}
                    </h2>
                    <button class="modal-close" style="color: white; font-size: 24px; background: rgba(255,255,255,0.2); border-radius: 8px; padding: 8px 12px; transition: all 0.3s;" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="display: flex; flex: 1; overflow: hidden; flex-direction: row-reverse;">
                    <!-- المحتوى الرئيسي -->
                    <div class="modal-body" style="padding: 30px; background: #f8f9fa; flex: 1; overflow-y: auto;">
                        <form id="enhanced-visit-form" class="space-y-6">
                        <!-- قسم معلومات المريض -->
                        <div class="form-section" style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                            <h3 class="section-title" style="color: #667eea; font-size: 20px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-user-circle" style="font-size: 24px;"></i>
                                معلومات المريض
                            </h3>
                            
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-users text-purple-600"></i>
                                        نوع المريض *
                                    </label>
                                    <select id="enhanced-visit-person-type" required class="form-input" style="border: 2px solid #667eea; border-radius: 10px; padding: 12px; transition: all 0.3s;">
                                        <option value="employee" ${personType === 'employee' ? 'selected' : ''}>موظف</option>
                                        <option value="contractor" ${personType === 'contractor' ? 'selected' : ''}>مقاول</option>
                                        <option value="external" ${personType === 'external' ? 'selected' : ''}>عمالة خارجية</option>
                                    </select>
                                </div>
                                
                                <div id="enhanced-visit-employee-code-container">
                                    <label for="enhanced-visit-employee-code" class="block text-sm font-semibold text-gray-700 mb-2" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-id-card text-purple-600"></i>
                                        الكود الوظيفي *
                                    </label>
                                    <input type="text" id="enhanced-visit-employee-code" class="form-input" placeholder="أدخل الكود الوظيفي" value="${Utils.escapeHTML(visitData?.employeeCode || visitData?.employeeNumber || '')}" autocomplete="off" autocorrect="off" spellcheck="false" inputmode="text" style="border: 2px solid #667eea; border-radius: 10px; padding: 12px; transition: all 0.3s;">
                                </div>
                                
                                <div>
                                    <label for="enhanced-visit-employee-name" class="block text-sm font-semibold text-gray-700 mb-2" id="enhanced-visit-employee-name-label" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-user text-purple-600"></i>
                                        اسم المريض *
                                    </label>
                                    <input type="text" id="enhanced-visit-employee-name" required class="form-input" placeholder="سيتم تعبئة الاسم تلقائياً" value="${Utils.escapeHTML(visitData?.employeeName || visitData?.contractorName || visitData?.externalName || '')}" style="border: 2px solid #667eea; border-radius: 10px; padding: 12px; transition: all 0.3s;">
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4" id="enhanced-visit-employee-details-container">
                                <div>
                                    <label for="enhanced-visit-employee-position" class="block text-sm font-semibold text-gray-700 mb-2" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-briefcase text-purple-600"></i>
                                        الوظيفة
                                    </label>
                                    <input type="text" id="enhanced-visit-employee-position" class="form-input" placeholder="الوظيفة" value="${Utils.escapeHTML(visitData?.employeePosition || '')}" style="border: 2px solid #667eea; border-radius: 10px; padding: 12px;">
                                </div>
                                
                                <div>
                                    <label for="enhanced-visit-employee-department" class="block text-sm font-semibold text-gray-700 mb-2" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-building text-purple-600"></i>
                                        القسم/الإدارة
                                    </label>
                                    <input type="text" id="enhanced-visit-employee-department" class="form-input" placeholder="القسم/الإدارة" value="${Utils.escapeHTML(visitData?.employeeDepartment || '')}" style="border: 2px solid #667eea; border-radius: 10px; padding: 12px;">
                                </div>
                                
                                <div>
                                    <label for="enhanced-visit-factory" class="block text-sm font-semibold text-gray-700 mb-2" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-industry text-purple-600"></i>
                                        المصنع
                                    </label>
                                    <select id="enhanced-visit-factory" class="form-input" style="border: 2px solid #667eea; border-radius: 10px; padding: 12px;">
                                        <option value="">-- اختر المصنع --</option>
                                        ${this.getSiteOptions().map(site => `
                                            <option value="${site.id}" ${visitData?.factory === site.id || visitData?.factory === site.name ? 'selected' : ''}>${Utils.escapeHTML(site.name)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                
                                <div>
                                    <label for="enhanced-visit-employee-location" class="block text-sm font-semibold text-gray-700 mb-2" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-map-marker-alt text-purple-600"></i>
                                        مكان العمل *<span style="font-size: 11px; color: #666; display: block; margin-top: 2px;">يُعرض المواقع الفرعية للمصنع أعلاه؛ اكتب للبحث أو أدخل نصاً يدوياً</span>
                                    </label>
                                    <input type="text" id="enhanced-visit-employee-location" required class="form-input" list="enhanced-visit-employee-location-datalist" placeholder="اختر موقعاً فرعياً أو اكتب مكان العمل" value="${Utils.escapeHTML(visitData?.employeeLocation || visitData?.workArea || '')}" autocomplete="off" autocorrect="off" spellcheck="false" inputmode="text" style="border: 2px solid #667eea; border-radius: 10px; padding: 12px;">
                                    <datalist id="enhanced-visit-employee-location-datalist"></datalist>
                                </div>
                            </div>
                        </div>
                        
                        <!-- قسم معلومات الزيارة -->
                        <div class="form-section" style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                            <h3 class="section-title" style="color: #fc6c85; font-size: 20px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-calendar-check" style="font-size: 24px;"></i>
                                معلومات الزيارة
                            </h3>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label for="enhanced-visit-date" class="block text-sm font-semibold text-gray-700 mb-2" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-clock text-orange-600"></i>
                                        وقت الدخول *
                                    </label>
                                    <input type="datetime-local" id="enhanced-visit-date" required class="form-input" value="${visitDate}" style="border: 2px solid #fc6c85; border-radius: 10px; padding: 12px;">
                                </div>
                                
                                <div>
                                    <label for="enhanced-visit-exit-date" class="block text-sm font-semibold text-gray-700 mb-2" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-sign-out-alt text-orange-600"></i>
                                        وقت الخروج
                                    </label>
                                    <input type="datetime-local" id="enhanced-visit-exit-date" class="form-input" value="${exitDate}" style="border: 2px solid #fc6c85; border-radius: 10px; padding: 12px;">
                                </div>
                            </div>
                        </div>
                        
                        <!-- قسم التشخيص والعلاج -->
                        <div class="form-section" style="background: linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%); padding: 25px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                            <h3 class="section-title" style="color: #4facfe; font-size: 20px; font-weight: bold; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-stethoscope" style="font-size: 24px;"></i>
                                التشخيص والعلاج
                            </h3>
                            
                            <div class="grid grid-cols-1 gap-4">
                                <div>
                                    <label for="enhanced-visit-type" class="block text-sm font-semibold text-gray-700 mb-2" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-tag text-blue-600"></i>
                                        نوع الزيارة *
                                    </label>
                                    <select id="enhanced-visit-type" required class="form-input" style="border: 2px solid #4facfe; border-radius: 10px; padding: 12px;">
                                        <option value="">-- اختر نوع الزيارة --</option>
                                        ${(isEdit && !visitData?.visitType ? ['غير محدد'] : []).map(opt => `<option value="${Utils.escapeHTML(opt)}" selected>${Utils.escapeHTML(opt)}</option>`).join('')}
                                        ${this.getVisitTypeOptions().map(opt => `<option value="${Utils.escapeHTML(opt)}" ${(visitData?.visitType || '') === opt ? 'selected' : ''}>${Utils.escapeHTML(opt)}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label for="enhanced-visit-reason" class="block text-sm font-semibold text-gray-700 mb-2" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-question-circle text-blue-600"></i>
                                        سبب الزيارة *
                                    </label>
                                    <input type="text" id="enhanced-visit-reason" required class="form-input" placeholder="سبب الزيارة" value="${Utils.escapeHTML(visitData?.reason || '')}" style="border: 2px solid #4facfe; border-radius: 10px; padding: 12px;">
                                </div>
                                
                                <div>
                                    <label for="enhanced-visit-diagnosis" class="block text-sm font-semibold text-gray-700 mb-2" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-diagnoses text-blue-600"></i>
                                        التشخيص
                                    </label>
                                    <textarea id="enhanced-visit-diagnosis" rows="3" class="form-input" placeholder="التشخيص الطبي" style="border: 2px solid #4facfe; border-radius: 10px; padding: 12px;">${Utils.escapeHTML(visitData?.diagnosis || '')}</textarea>
                                </div>
                                
                                <div>
                                    <label for="enhanced-visit-treatment" class="block text-sm font-semibold text-gray-700 mb-2" style="display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-pills text-blue-600"></i>
                                        العلاج / الإجراء المتخذ
                                    </label>
                                    <textarea id="enhanced-visit-treatment" rows="3" class="form-input" placeholder="العلاج أو الإجراء المتخذ" style="border: 2px solid #4facfe; border-radius: 10px; padding: 12px;">${Utils.escapeHTML(visitData?.treatment || '')}</textarea>
                                </div>
                            </div>
                        </div>
                    </form>
                    </div>
                    
                    <!-- المسطرة الجانبية -->
                    <div style="width: 320px; background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%); border-right: 2px solid #e2e8f0; padding: 25px; overflow-y: auto; flex-shrink: 0;">
                        <div style="margin-bottom: 25px;">
                            <h3 style="color: #667eea; font-size: 18px; font-weight: bold; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-chart-line" style="font-size: 20px;"></i>
                                إحصائيات سريعة
                            </h3>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                                        <span style="font-size: 13px; opacity: 0.9;">زيارات اليوم</span>
                                        <i class="fas fa-calendar-day" style="font-size: 16px;"></i>
                                    </div>
                                    <div style="font-size: 28px; font-weight: bold;">${todayVisits}</div>
                                </div>
                                <div style="background: linear-gradient(135deg, #fc6c85 0%, #ff8a95 100%); color: white; padding: 15px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                                        <span style="font-size: 13px; opacity: 0.9;">زيارات هذا الشهر</span>
                                        <i class="fas fa-calendar-alt" style="font-size: 16px;"></i>
                                    </div>
                                    <div style="font-size: 28px; font-weight: bold;">${monthlyVisits}</div>
                                </div>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 25px;">
                            <h3 style="color: #667eea; font-size: 18px; font-weight: bold; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-compass" style="font-size: 20px;"></i>
                                التنقل السريع
                            </h3>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <button type="button" class="sidebar-nav-btn" data-section="0" style="background: white; border: 2px solid #667eea; color: #667eea; padding: 12px 15px; border-radius: 10px; text-align: right; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: space-between;">
                                    <span><i class="fas fa-user-circle ml-2"></i>معلومات المريض</span>
                                    <i class="fas fa-arrow-left" style="font-size: 12px;"></i>
                                </button>
                                <button type="button" class="sidebar-nav-btn" data-section="1" style="background: white; border: 2px solid #fc6c85; color: #fc6c85; padding: 12px 15px; border-radius: 10px; text-align: right; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: space-between;">
                                    <span><i class="fas fa-calendar-check ml-2"></i>معلومات الزيارة</span>
                                    <i class="fas fa-arrow-left" style="font-size: 12px;"></i>
                                </button>
                                <button type="button" class="sidebar-nav-btn" data-section="2" style="background: white; border: 2px solid #4facfe; color: #4facfe; padding: 12px 15px; border-radius: 10px; text-align: right; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: space-between;">
                                    <span><i class="fas fa-stethoscope ml-2"></i>التشخيص والعلاج</span>
                                    <i class="fas fa-arrow-left" style="font-size: 12px;"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 25px;">
                            <h3 style="color: #667eea; font-size: 18px; font-weight: bold; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-lightbulb" style="font-size: 20px;"></i>
                                نصائح سريعة
                            </h3>
                            <div style="background: linear-gradient(135deg, #fff9c4 0%, #fff59d 100%); padding: 15px; border-radius: 12px; border-right: 4px solid #F57F17;">
                                <div style="color: #F57F17; font-size: 13px; line-height: 1.8;">
                                    <div style="margin-bottom: 10px;">
                                        <i class="fas fa-check-circle ml-2"></i>
                                        <strong>تأكد من:</strong> إدخال جميع الحقول المطلوبة (*)
                                    </div>
                                    <div style="margin-bottom: 10px;">
                                        <i class="fas fa-clock ml-2"></i>
                                        <strong>وقت الدخول:</strong> يتم تعيينه تلقائياً
                                    </div>
                                    <div style="margin-bottom: 10px;">
                                        <i class="fas fa-user-check ml-2"></i>
                                        <strong>للموظفين:</strong> أدخل الكود الوظيفي فقط
                                    </div>
                                    <div>
                                        <i class="fas fa-save ml-2"></i>
                                        <strong>الحفظ:</strong> سيتم حفظ البيانات تلقائياً
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <h3 style="color: #667eea; font-size: 18px; font-weight: bold; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-info-circle" style="font-size: 20px;"></i>
                                معلومات
                            </h3>
                            <div style="background: white; padding: 15px; border-radius: 12px; border: 2px solid #e2e8f0;">
                                <div style="color: #64748b; font-size: 13px; line-height: 1.8;">
                                    <div style="margin-bottom: 10px; display: flex; align-items: start; gap: 8px;">
                                        <i class="fas fa-user-md" style="color: #667eea; margin-top: 3px;"></i>
                                        <span>يمكنك تسجيل زيارة للموظفين والمقاولين والعمالة الخارجية</span>
                                    </div>
                                    <div style="margin-bottom: 10px; display: flex; align-items: start; gap: 8px;">
                                        <i class="fas fa-history" style="color: #667eea; margin-top: 3px;"></i>
                                        <span>سيتم حفظ سجل كامل للزيارة مع معلومات المستخدم</span>
                                    </div>
                                    <div style="display: flex; align-items: start; gap: 8px;">
                                        <i class="fas fa-shield-alt" style="color: #667eea; margin-top: 3px;"></i>
                                        <span>جميع البيانات محمية ومشفرة</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer form-actions-centered" style="background: #f8f9fa; border-radius: 0 0 20px 20px; padding: 20px 30px; display: flex; justify-content: flex-end; gap: 15px; flex-shrink: 0;">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 12px 30px; border-radius: 10px; font-size: 16px;">
                        <i class="fas fa-times ml-2"></i>
                        إلغاء
                    </button>
                    <button type="submit" form="enhanced-visit-form" class="btn-primary" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; box-shadow: 0 4px 15px 0 rgba(102, 126, 234, 0.4); padding: 12px 30px; border-radius: 10px; font-size: 16px; transition: all 0.3s;">
                        <i class="fas fa-save ml-2"></i>
                        ${isEdit ? 'تحديث البيانات' : 'حفظ الزيارة'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // منع الإغلاق عند الضغط خارج النموذج إلا بتأكيد
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const ok = confirm('تنبيه: سيتم إغلاق النموذج.\nقد تفقد أي بيانات غير محفوظة.\n\nهل تريد الإغلاق؟');
                if (ok) modal.remove();
            }
        });

        // ربط الأحداث
        const form = modal.querySelector('#enhanced-visit-form');
        const personTypeSelect = modal.querySelector('#enhanced-visit-person-type');

        // تغيير نوع المريض
        personTypeSelect?.addEventListener('change', () => {
            const type = personTypeSelect.value;
            const codeContainer = modal.querySelector('#enhanced-visit-employee-code-container');
            const detailsContainer = modal.querySelector('#enhanced-visit-employee-details-container');
            const codeInput = modal.querySelector('#enhanced-visit-employee-code');
            const nameInput = modal.querySelector('#enhanced-visit-employee-name');
            const nameLabel = modal.querySelector('#enhanced-visit-employee-name-label');
            const departmentInput = modal.querySelector('#enhanced-visit-employee-department');
            const factorySelect = modal.querySelector('#enhanced-visit-factory');

            if (type === 'employee') {
                codeContainer.style.display = 'block';
                detailsContainer.style.display = 'grid';
                codeInput.required = true;
                nameInput.readOnly = true;
                nameInput.placeholder = 'سيتم تعبئة الاسم تلقائياً';
                nameLabel.innerHTML = '<i class="fas fa-user text-purple-600"></i> اسم الموظف *';
                if (departmentInput) {
                    departmentInput.readOnly = true;
                    departmentInput.placeholder = 'سيتم التعبئة تلقائياً';
                }
                if (factorySelect) {
                    factorySelect.style.display = 'block';
                }
            } else {
                codeContainer.style.display = 'none';
                detailsContainer.style.display = 'none';
                codeInput.required = false;
                nameInput.readOnly = false;
                nameInput.placeholder = type === 'contractor' ? 'أدخل اسم المقاول' : 'أدخل اسم العامل';
                nameLabel.innerHTML = `<i class="fas fa-user text-purple-600"></i> ${type === 'contractor' ? 'اسم المقاول' : 'اسم العامل'} *`;
                if (departmentInput) {
                    departmentInput.readOnly = false;
                    departmentInput.placeholder = '';
                }
                if (factorySelect) {
                    factorySelect.style.display = 'none';
                }
            }
        });

        // حفظ النموذج
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveEnhancedVisit(visitData, isEdit, modal);
        });

        if (typeof this.setupClinicWorkplaceDatalist === 'function') {
            this.setupClinicWorkplaceDatalist('enhanced-visit-factory', 'enhanced-visit-employee-location', 'enhanced-visit-employee-location-datalist');
        }

        // ربط أحداث التنقل السريع في المسطرة الجانبية
        const navButtons = modal.querySelectorAll('.sidebar-nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const sectionIndex = parseInt(btn.getAttribute('data-section'), 10);
                const formSections = modal.querySelectorAll('.form-section');
                if (formSections[sectionIndex]) {
                    formSections[sectionIndex].scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start',
                        inline: 'nearest'
                    });
                }
            });
            
            // إضافة تأثيرات hover
            const borderColor = btn.style.borderColor;
            btn.addEventListener('mouseenter', () => {
                btn.style.background = borderColor;
                btn.style.color = 'white';
                btn.style.transform = 'translateX(-5px)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'white';
                btn.style.color = borderColor;
                btn.style.transform = 'translateX(0)';
            });
        });

        // إضافة تأثيرات hover للأزرار
        const submitBtn = modal.querySelector('button[type="submit"]');
        submitBtn?.addEventListener('mouseenter', () => {
            submitBtn.style.transform = 'translateY(-2px)';
            submitBtn.style.boxShadow = '0 6px 20px 0 rgba(102, 126, 234, 0.6)';
        });
        submitBtn?.addEventListener('mouseleave', () => {
            submitBtn.style.transform = 'translateY(0)';
            submitBtn.style.boxShadow = '0 4px 15px 0 rgba(102, 126, 234, 0.4)';
        });
    },

    /**
     * حفظ الزيارة المحسّنة
     */
    async saveEnhancedVisit(visitData, isEdit, modal) {
        Loading.show();

        try {
            const personType = document.getElementById('enhanced-visit-person-type').value;
            const employeeCode = document.getElementById('enhanced-visit-employee-code')?.value.trim() || '';
            const employeeName = document.getElementById('enhanced-visit-employee-name').value.trim();
            const employeePosition = document.getElementById('enhanced-visit-employee-position')?.value.trim() || '';
            const employeeDepartment = document.getElementById('enhanced-visit-employee-department')?.value.trim() || '';
            const factoryValue = document.getElementById('enhanced-visit-factory')?.value.trim() || null;
            const employeeLocation = document.getElementById('enhanced-visit-employee-location').value.trim();
            const visitDate = document.getElementById('enhanced-visit-date').value;
            const exitDate = document.getElementById('enhanced-visit-exit-date').value || null;
            const visitType = document.getElementById('enhanced-visit-type')?.value?.trim() || null;
            const reason = document.getElementById('enhanced-visit-reason').value.trim();
            const diagnosis = document.getElementById('enhanced-visit-diagnosis').value.trim();
            const treatment = document.getElementById('enhanced-visit-treatment').value.trim();

            // الحصول على اسم المصنع من القائمة
            let factoryName = null;
            if (factoryValue) {
                const sites = this.getSiteOptions();
                const selectedSite = sites.find(site => site.id === factoryValue);
                factoryName = selectedSite ? selectedSite.name : null;
            }

            // ✅ إصلاح: تحويل datetime-local إلى ISO string بشكل صحيح
            // ✅ إصلاح مشكلة الوقت الثابت: تحويل صحيح من local time إلى ISO
            let visitDateISO = null;
            let exitDateISO = null;
            
            if (visitDate && visitDate.trim()) {
                try {
                    // datetime-local يعيد قيمة local time بصيغة YYYY-MM-DDTHH:mm
                    // نحتاج لإنشاء Date object يمثل هذا الوقت المحلي بشكل صحيح
                    const [datePart, timePart] = visitDate.split('T');
                    if (datePart && timePart) {
                        const [year, month, day] = datePart.split('-').map(Number);
                        const [hours, minutes] = timePart.split(':').map(Number);
                        
                        // إنشاء Date object باستخدام الوقت المحلي
                        const entryDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
                        if (!isNaN(entryDate.getTime())) {
                            visitDateISO = entryDate.toISOString();
                        } else {
                            if (AppState.debugMode) {
                                Utils.safeWarn('⚠️ قيمة وقت الدخول غير صحيحة:', visitDate);
                            }
                        }
                    } else {
                        // Fallback: استخدام الطريقة القديمة إذا فشل التحليل
                        const entryDate = new Date(visitDate);
                        if (!isNaN(entryDate.getTime())) {
                            visitDateISO = entryDate.toISOString();
                        }
                    }
                } catch (error) {
                    if (AppState.debugMode) {
                        Utils.safeError('❌ خطأ في تحويل وقت الدخول:', error);
                    }
                }
            }
            
            if (exitDate && exitDate.trim()) {
                try {
                    // نفس المنطق لوقت الخروج
                    const [datePart, timePart] = exitDate.split('T');
                    if (datePart && timePart) {
                        const [year, month, day] = datePart.split('-').map(Number);
                        const [hours, minutes] = timePart.split(':').map(Number);
                        
                        const exitDateObj = new Date(year, month - 1, day, hours, minutes, 0, 0);
                        if (!isNaN(exitDateObj.getTime())) {
                            exitDateISO = exitDateObj.toISOString();
                        } else {
                            if (AppState.debugMode) {
                                Utils.safeWarn('⚠️ قيمة وقت الخروج غير صحيحة:', exitDate);
                            }
                        }
                    } else {
                        // Fallback
                        const exitDateObj = new Date(exitDate);
                        if (!isNaN(exitDateObj.getTime())) {
                            exitDateISO = exitDateObj.toISOString();
                        }
                    }
                } catch (error) {
                    if (AppState.debugMode) {
                        Utils.safeError('❌ خطأ في تحويل وقت الخروج:', error);
                    }
                }
            }

            // ✅ الحصول على المستخدم الحالي مع التأكد من وجود name
            // أولاً: التحقق من أن AppState.currentUser موجود
            if (!AppState.currentUser) {
                Utils.safeError('❌ خطأ: AppState.currentUser غير موجود! لا يمكن تسجيل الزيارة بدون معرفة المستخدم.');
                Notification.error('خطأ: لم يتم التعرف على المستخدم. يرجى تسجيل الدخول مرة أخرى.');
                Loading.hide();
                return;
            }
            
            // ثانياً: التحقق من أن AppState.currentUser يحتوي على name أو email
            if (!AppState.currentUser.name && !AppState.currentUser.email && !AppState.currentUser.id) {
                Utils.safeError('❌ خطأ: AppState.currentUser لا يحتوي على name أو email أو id!', AppState.currentUser);
                Notification.error('خطأ: بيانات المستخدم غير مكتملة. يرجى تسجيل الدخول مرة أخرى.');
                Loading.hide();
                return;
            }
            
            // ✅ الحل الجذري: استخدام AppState.currentUser مباشرة بدلاً من getCurrentUserSummary()
            // ✅ الحل النهائي المضمون: البحث عن اسم المستخدم من قاعدة البيانات أولاً
            const currentUser = AppState.currentUser;
            const currentEmail = (currentUser?.email || '').toString().toLowerCase().trim();
            
            // ✅ البحث في AppState.appData.users أولاً (المصدر الموثوق)
            const users = AppState.appData.users || [];
            const dbUser = users.find(u => {
                const email = (u.email || '').toString().toLowerCase().trim();
                return email === currentEmail;
            });
            
            // ✅ Debug: عرض جميع البيانات
            console.log('🔍 [CLINIC] تشخيص المستخدم:', {
                currentEmail: currentEmail,
                dbUserFound: !!dbUser,
                dbUserName: dbUser?.name || 'غير موجود',
                appStateUserName: currentUser?.name || 'غير موجود',
                usersCount: users.length
            });
            
            
            // ✅ أولوية الحصول على الاسم:
            // 1. من قاعدة البيانات (dbUser.name)
            // 2. من AppState.currentUser.name
            // 3. من email
            // 4. 'مستخدم' كـ fallback
            let finalCreatedBy = '';
            
            if (dbUser && dbUser.name && dbUser.name.trim() !== '') {
                finalCreatedBy = dbUser.name.trim();
                console.log('✅ [CLINIC] الاسم من قاعدة البيانات:', finalCreatedBy);
            } else if (currentUser?.name && currentUser.name.trim() !== '') {
                finalCreatedBy = currentUser.name.trim();
                console.log('✅ [CLINIC] الاسم من AppState:', finalCreatedBy);
            } else if (currentEmail) {
                finalCreatedBy = currentEmail;
                console.log('⚠️ [CLINIC] استخدام email كبديل:', finalCreatedBy);
            } else {
                finalCreatedBy = 'مستخدم';
                console.log('⚠️ [CLINIC] استخدام "مستخدم" كـ fallback');
            }
            
            const finalUpdatedBy = finalCreatedBy;
            console.log('✅ [CLINIC] finalCreatedBy النهائي:', finalCreatedBy);
            
            const formData = {
                id: visitData?.id || Utils.generateId('VISIT'),
                personType,
                employeeCode,
                employeeName,
                employeePosition,
                employeeDepartment,
                factory: factoryValue,
                factoryName: factoryName,
                employeeLocation,
                workArea: employeeLocation,
                visitDate: visitDateISO,
                exitDate: exitDateISO,
                visitType,
                reason,
                diagnosis,
                treatment,
                medications: [],
                createdAt: visitData?.createdAt || new Date().toISOString(),
                createdBy: finalCreatedBy, // string - يجب أن يكون اسم صحيح وليس "النظام"
                updatedAt: new Date().toISOString(),
                updatedBy: finalUpdatedBy, // string - يجب أن يكون اسم صحيح وليس "النظام"
                // ✅ إضافة email و id للمساعدة في استعادة createdBy في Backend إذا لزم الأمر
                email: AppState.currentUser?.email || '',
                userId: AppState.currentUser?.id || ''
            };
            
            // ✅ Debug: تسجيل formData.createdBy مع التأكد من وجود name (دائم)
            console.log('🔍 [CLINIC] formData قبل الإرسال:', {
                createdBy: formData.createdBy,
                updatedBy: formData.updatedBy,
                createdByType: typeof formData.createdBy,
                updatedByType: typeof formData.updatedBy
            });
            
            // ✅ التحقق النهائي: إذا كان createdBy لا يزال 'النظام'، فهناك مشكلة
            if (formData.createdBy === 'النظام' || (typeof formData.createdBy === 'object' && formData.createdBy.name === 'النظام')) {
                console.error('❌ [CLINIC] خطأ: formData.createdBy لا يزال "النظام"!', {
                    formDataCreatedBy: formData.createdBy,
                    currentUser: currentUser,
                    AppStateCurrentUser: AppState.currentUser,
                    currentUserName: currentUser?.name || ''
                });
            }
            
            if (AppState.debugMode) {
                Utils.safeLog('🔍 formData.createdBy النهائي قبل الإرسال (يجب أن يكون string):', formData.createdBy);
                Utils.safeLog('🔍 formData.createdBy type:', typeof formData.createdBy);
            }

            // حفظ محلياً
            if (!AppState.appData.clinicVisits) {
                AppState.appData.clinicVisits = [];
            }

            if (isEdit) {
                const index = AppState.appData.clinicVisits.findIndex(v => v.id === formData.id);
                if (index !== -1) {
                    AppState.appData.clinicVisits[index] = formData;
                }
            } else {
                AppState.appData.clinicVisits.push(formData);
            }

            // حفظ في DataManager
            if (typeof DataManager !== 'undefined' && DataManager.save) {
                DataManager.save();
            }

            // تنبيه وإشعار المدير عند وصول زيارات الشهر إلى الحد المضبوط أو أكثر (بدون التأثير على سير العمل)
            try {
                const threshold = this.getMonthlyVisitsAlertThreshold();
                const monthlyCount = this.getMonthlyVisitCountForPerson(formData);
                if (monthlyCount >= threshold) {
                    const who = (formData.personType || '').toString().toLowerCase() === 'employee' ? 'الموظف' : 'المقاول/العامل';
                    if (typeof Notification !== 'undefined' && Notification.warning) {
                        Notification.warning('تنبيه: عدد زيارات ' + who + ' للعيادة هذا الشهر وصل أو تجاوز ' + threshold + ' زيارة. تم إشعار مدير النظام.');
                    }
                    this.notifyAdminsAboutHighClinicVisits(formData, monthlyCount).catch(function() {});
                }
            } catch (e) {
                Utils.safeWarn('فحص تردد العيادة الشهري:', e);
            }

            const rpcTimeoutMs = 45000;
            try {
                if (AppState.debugMode) {
                    Utils.safeLog('🔍 إرسال formData إلى Backend:', {
                        action: isEdit ? 'updateClinicVisit' : 'addClinicVisit',
                        createdBy: formData.createdBy,
                        createdByType: typeof formData.createdBy,
                        createdByName: typeof formData.createdBy === 'object' ? formData.createdBy.name : formData.createdBy
                    });
                }

                const result = await GoogleIntegration.sendRequest({
                    action: isEdit ? 'updateClinicVisit' : 'addClinicVisit',
                    data: isEdit
                        ? { visitId: formData.id, updateData: formData, __timeoutMs: rpcTimeoutMs }
                        : { ...formData, __timeoutMs: rpcTimeoutMs }
                });

                this.assertClinicVisitRpcResult(result);
                if (!isEdit) {
                    this.applyClinicVisitIdFromServer(formData, result);
                }

                if (AppState.debugMode) {
                    Utils.safeLog('✅ تم إرسال formData إلى Backend بنجاح', result);
                }

                if (typeof DataManager !== 'undefined' && DataManager.save) {
                    DataManager.save();
                }
                this.refreshClinicVisitsFromServerAfterSave();
            } catch (syncErr) {
                Utils.safeError('❌ خطأ في المزامنة:', syncErr);
                Loading.hide();
                const msg = (syncErr && syncErr.message) ? syncErr.message : 'فشل غير معروف';
                Notification.error('لم تُحفظ الزيارة في قاعدة البيانات: ' + msg);
                try {
                    if (typeof DataManager !== 'undefined' && DataManager.addToPendingSync) {
                        DataManager.addToPendingSync('ClinicVisits', AppState.appData.clinicVisits);
                    }
                } catch (e) { /* ignore */ }
                return;
            }

            Loading.hide();
            Notification.success(`تم ${isEdit ? 'تحديث' : 'تسجيل'} الزيارة بنجاح`);
            modal.remove();

            // تحديث الواجهة
            if (this.state.activeTab === 'visits') {
                this.renderVisitsTab();
            }

        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    /**
     * معالجة تحميل المرفقات للإصابات
     */
    async handleInjuryAttachmentsChange(fileList) {
        if (!fileList || fileList.length === 0) return;

        const files = Array.from(fileList);
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        for (const file of files) {
            const extension = (file.name.split('.').pop() || '').toLowerCase();
            if (!allowedExtensions.includes(extension)) {
                Notification.warning(`الملف ${file.name} غير مدعوم. يسمح بملفات JPG أو PNG أو PDF فقط.`);
                continue;
            }
            if (file.size > maxSize) {
                Notification.warning(`الملف ${file.name} يتجاوز الحد الأقصى المسموح به (5MB).`);
                continue;
            }

            try {
                const base64 = await this.readFileAsBase64(file);
                this.state.currentInjuryAttachments.push({
                    id: Utils.generateId('ATT'),
                    name: file.name,
                    type: file.type || this.detectMimeType(file.name),
                    data: base64,
                    size: Math.round(file.size / 1024),
                    uploadedAt: new Date().toISOString()
                });
            } catch (error) {
                Utils.safeError('فشل تحميل الملف:', error);
                Notification.error(`تعذر تحميل الملف ${file.name}`);
            }
        }

        this.renderInjuryAttachmentsPreview();

        // مسح حقل الإدخال
        const input = document.getElementById('injury-attachments-input');
        if (input) {
            input.value = '';
        }
    },

    /**
     * عرض معاينة المرفقات للإصابات
     */
    renderInjuryAttachmentsPreview() {
        const container = document.getElementById('injury-attachments-preview');
        if (!container) return;

        if (!this.state.currentInjuryAttachments || this.state.currentInjuryAttachments.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500">لم يتم إضافة مرفقات بعد</p>';
            return;
        }

        container.innerHTML = this.state.currentInjuryAttachments.map((att, index) => {
            const isImage = att.type && att.type.startsWith('image/');
            const icon = isImage ? 'fa-image' : 'fa-file-pdf';
            const sizeKB = att.size || 0;
            
            return `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <i class="fas ${icon} text-blue-600 text-xl"></i>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-800 truncate">${Utils.escapeHTML(att.name)}</p>
                            <p class="text-xs text-gray-500">${sizeKB} KB</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${isImage ? `
                            <button type="button" class="btn-icon btn-icon-primary" onclick="Clinic.previewAttachment(${index})" title="معاينة">
                                <i class="fas fa-eye"></i>
                            </button>
                        ` : ''}
                        <button type="button" class="btn-icon btn-icon-danger" onclick="Clinic.removeInjuryAttachment(${index})" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * حذف مرفق من قائمة مرفقات الإصابة
     */
    removeInjuryAttachment(index) {
        if (index < 0 || index >= this.state.currentInjuryAttachments.length) return;
        
        this.state.currentInjuryAttachments.splice(index, 1);
        this.renderInjuryAttachmentsPreview();
        Notification.success('تم حذف المرفق');
    },

    /**
     * معاينة مرفق صورة
     */
    previewAttachment(index) {
        const att = this.state.currentInjuryAttachments[index];
        if (!att || !att.type || !att.type.startsWith('image/')) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 90vw; max-height: 90vh;">
                <div class="modal-header">
                    <h3 class="modal-title">${Utils.escapeHTML(att.name)}</h3>
                    <button type="button" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="display: flex; align-items: center; justify-content: center; max-height: 70vh; overflow: auto;">
                    <img src="${att.data}" alt="${Utils.escapeHTML(att.name)}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    /**
     * قراءة ملف كـ Base64
     */
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    },

    /**
     * اكتشاف نوع MIME من اسم الملف
     */
    detectMimeType(filename) {
        if (!filename) return 'application/octet-stream';
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'pdf': 'application/pdf'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    },

    /**
     * تنظيف جميع الموارد عند إلغاء تحميل الموديول
     * يمنع تسريبات الذاكرة (Memory Leaks)
     */
    cleanup() {
        try {
            Utils.safeLog('🧹 تنظيف موارد Clinic module...');

            // تنظيف جميع الـ event listeners
            // ملاحظة: معظم الـ listeners مرتبطة بعناصر DOM محددة
            // سيتم تنظيفها تلقائياً عند إزالة العناصر من DOM
            
            // تنظيف أي timers نشطة
            // (لا توجد timers دائمة في هذا الموديول حالياً، لكن يمكن إضافتها هنا لاحقاً)

            // تنظيف مراجع DOM
            this.state.currentInjuryAttachments = [];
            this.state.medicationAlertsNotified.clear();

            // إعادة تعيين الحالة
            this.state.initialized = false;

            Utils.safeLog('✅ تم تنظيف موارد Clinic module');
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في تنظيف Clinic module:', error);
        }
    }

};
// تصدير فوري حتى لو حدث خطأ لاحقاً في الملف
if (typeof window !== 'undefined' && typeof Clinic !== 'undefined') { window.Clinic = Clinic; }
// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof Clinic !== 'undefined') {
            window.Clinic = Clinic;

            window.addEventListener('formSettingsUpdated', function () {
                try { if (typeof Clinic !== 'undefined' && Clinic.refreshSiteDropdowns) Clinic.refreshSiteDropdowns(); } catch (e) {}
            });

            // ✅ التأكد من أن دالة load موجودة
            if (typeof Clinic.load !== 'function') {
                console.warn('⚠️ Clinic module loaded but load function is missing');
            }

            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ Clinic module loaded and available on window.Clinic');
                Utils.safeLog('✅ Clinic.load function exists: ' + (typeof Clinic.load === 'function'));
            }
        } else {
            console.error('❌ Clinic module not defined - cannot export to window');
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير Clinic:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof Clinic !== 'undefined') {
            try {
                window.Clinic = Clinic;
                console.log('✅ تم تصدير Clinic بنجاح في المحاولة الثانية');
            } catch (e) {
                console.error('❌ فشل تصدير Clinic:', e);
            }
        }
    }
})();