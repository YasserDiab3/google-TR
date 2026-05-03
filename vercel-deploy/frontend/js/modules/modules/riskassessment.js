/**
 * RiskAssessment Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
// ===== Risk Assessment Module (تقييم المخاطر) =====
const RiskAssessment = (() => {
    const state = {
        filters: {
            query: '',
            status: 'all',
            riskBracket: 'all'
        },
        sort: {
            field: 'updatedAt',
            direction: 'desc'
        },
        listenersBound: false,
        initialized: false,
        scheduleHandle: null
    };

    const SELECTORS = {
        section: '#risk-assessment-section',
        content: '#risk-assessment-content',
        summary: '#risk-assessment-summary',
        filters: '#risk-assessment-filters',
        tableContainer: '#risk-assessment-table-container',
        tableBody: '#risk-assessment-table-body',
        emptyState: '#risk-assessment-empty-state',
        exportButton: '#export-risk-excel-btn'
    };

    const RISK_BRACKETS = [
        { id: 'low', label: 'منخفضة (≤5)', min: 0, max: 5 },
        { id: 'medium', label: 'متوسطة (6-10)', min: 6, max: 10 },
        { id: 'high', label: 'مرتفعة (11-15)', min: 11, max: 15 },
        { id: 'critical', label: 'حرجة (≥16)', min: 16, max: Infinity }
    ];

    const ensureDataStructure = () => {
        if (!AppState.appData) AppState.appData = {};
        if (!Array.isArray(AppState.appData.riskAssessments)) {
            AppState.appData.riskAssessments = [];
        }
        return AppState.appData.riskAssessments;
    };

    const getAssessments = () => ensureDataStructure().slice();

    const normalizeValue = (value) => (typeof value === 'string' ? value.trim() : value ?? '');

    const toNumber = (value) => {
        if (value === null || value === undefined || value === '') return NaN;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : NaN;
    };

    const computeRiskRate = (probability, severity) => {
        const prob = toNumber(probability);
        const sev = toNumber(severity);
        if (Number.isNaN(prob) || Number.isNaN(sev)) return '';
        return prob * sev;
    };

    const asRiskString = (value) => (value === '' || value === null || value === undefined
        ? ''
        : String(value));

    const coalesceMetric = (primary, fallback) => (primary !== '' && primary !== null && primary !== undefined
        ? primary
        : fallback);

    const getEffectiveRiskValue = (assessment) => {
        const residual = toNumber(assessment?.residualRiskRate);
        if (!Number.isNaN(residual)) return residual;

        const riskLevel = toNumber(assessment?.riskLevel);
        if (!Number.isNaN(riskLevel)) return riskLevel;

        const initial = toNumber(assessment?.initialRiskRate);
        if (!Number.isNaN(initial)) return initial;

        return NaN;
    };

    const getBadgeClassForRisk = (riskLevel) => {
        const level = toNumber(riskLevel);
        if (Number.isNaN(level)) return 'secondary';
        if (level <= 5) return 'success';
        if (level <= 10) return 'info';
        if (level <= 15) return 'warning';
        return 'danger';
    };

    const getBadgeClassForStatus = (status) => {
        switch (status) {
            case 'مكتمل':
                return 'success';
            case 'يتطلب إجراء':
                return 'danger';
            case 'قيد المراجعة':
            default:
                return 'warning';
        }
    };

    const toArabicDate = (value) => {
        if (!value) return '-';
        try {
            return Utils.formatDate(value);
        } catch (error) {
            Utils.safeWarn('تعذر تنسيق التاريخ', error);
            return '-';
        }
    };

    const matchesRiskBracket = (riskLevel, bracketId) => {
        if (bracketId === 'all') return true;
        const bracket = RISK_BRACKETS.find((item) => item.id === bracketId);
        if (!bracket) return true;
        const level = toNumber(riskLevel);
        if (Number.isNaN(level)) return false;
        return level >= bracket.min && level <= bracket.max;
    };

    const applyFilters = (assessments) => {
        if (!assessments.length) return assessments;

        const { query, status, riskBracket } = state.filters;
        const normalizedQuery = query.trim().toLowerCase();

        return assessments.filter((assessment) => {
            const activity = normalizeValue(assessment.activity).toLowerCase();
            const location = normalizeValue(assessment.location).toLowerCase();
            const processDescription = normalizeValue(assessment.processDescription).toLowerCase();
            const hazard = normalizeValue(assessment.hazard).toLowerCase();
            const riskDescription = normalizeValue(assessment.riskDescription).toLowerCase();
            const existingControl = normalizeValue(assessment.existingControlMeasure).toLowerCase();
            const requiredControl = normalizeValue(assessment.requiredControlMeasure).toLowerCase();
            const additionalControl = normalizeValue(assessment.additionalControl).toLowerCase();
            const actionRequired = normalizeValue(assessment.actionRequired).toLowerCase();
            const responsible = normalizeValue(assessment.responsiblePerson).toLowerCase();
            const statusMatch = status === 'all' || normalizeValue(assessment.status) === status;
            const riskMatch = matchesRiskBracket(getEffectiveRiskValue(assessment), riskBracket);

            const haystack = [
                activity,
                location,
                processDescription,
                hazard,
                riskDescription,
                existingControl,
                requiredControl,
                additionalControl,
                actionRequired,
                responsible,
                normalizeValue(assessment.correctiveActions).toLowerCase()
            ];

            const queryMatch = !normalizedQuery || haystack.some((value) => value.includes(normalizedQuery));

            return statusMatch && riskMatch && queryMatch;
        });
    };

    const applySorting = (assessments) => {
        const { field, direction } = state.sort;
        const multiplier = direction === 'asc' ? 1 : -1;
        return assessments.sort((a, b) => {
            const valueA = normalizeValue(a[field]);
            const valueB = normalizeValue(b[field]);

            if (field === 'date' || field === 'createdAt' || field === 'updatedAt') {
                const dateA = valueA ? new Date(valueA).getTime() : 0;
                const dateB = valueB ? new Date(valueB).getTime() : 0;
                return (dateA - dateB) * multiplier;
            }

            if (field === 'riskLevel') {
                const riskA = getEffectiveRiskValue(a);
                const riskB = getEffectiveRiskValue(b);
                const safeRiskA = Number.isNaN(riskA) ? -Infinity : riskA;
                const safeRiskB = Number.isNaN(riskB) ? -Infinity : riskB;
                if (safeRiskA === safeRiskB) return 0;
                return (safeRiskA - safeRiskB) * multiplier;
            }

            if (!Number.isNaN(Number(valueA)) && !Number.isNaN(Number(valueB))) {
                return (Number(valueA) - Number(valueB)) * multiplier;
            }

            return valueA.localeCompare(valueB, 'ar', { sensitivity: 'base' }) * multiplier;
        });
    };

    const getFilteredAssessments = () => {
        const filtered = applyFilters(getAssessments());
        return applySorting(filtered);
    };

    const renderShell = async (section) => {
        section.innerHTML = `
            <div class="section-header">
                <div class="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-shield-alt ml-3"></i>
                            تقييم المخاطر
                        </h1>
                        <p class="section-subtitle">
                            إدارة تقييمات المخاطر، متابعة الإجراءات التصحيحية، وتحليل مستويات الخطورة لحظيًا
                        </p>
                    </div>
                    <div class="flex items-center gap-3 flex-wrap">
                        <button id="add-risk-assessment-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة تقييم جديد
                        </button>
                        <button id="export-risk-excel-btn" class="btn-success">
                            <i class="fas fa-file-excel ml-2"></i>
                            تصدير Excel
                        </button>
                    </div>
                </div>
            </div>
            <div class="space-y-6 mt-6" id="risk-assessment-content">
                <div id="risk-assessment-summary" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4"></div>
                
                <!-- مصفوفة تقييم المخاطر المرجعية -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title flex items-center">
                            <i class="fas fa-th ml-2"></i>
                            مصفوفة تقييم المخاطر (مرجع)
                        </h2>
                    </div>
                    <div class="card-body flex justify-center">
                        ${typeof RiskMatrix !== 'undefined' ? RiskMatrix.generate('risk-matrix-display', {
                            showLegend: true,
                            interactive: false
                        }) : ''}
                    </div>
                </div>
                
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <h2 class="card-title flex items-center">
                                <i class="fas fa-list ml-2"></i>
                                سجل تقييمات المخاطر
                            </h2>
                            <form id="risk-assessment-filters" class="grid gap-3 md:grid-cols-4 w-full">
                                <label class="input-group col-span-2">
                                    <span class="input-group-icon"><i class="fas fa-search"></i></span>
                                    <input type="search"
                                           class="form-input"
                                           placeholder="بحث عن نشاط، موقع، أو إجراء تصحيحي..."
                                           data-filter="query"
                                           value="${state.filters.query}">
                                </label>
                                <select class="form-input" data-filter="status">
                                    <option value="all" ${state.filters.status === 'all' ? 'selected' : ''}>جميع الحالات</option>
                                    <option value="قيد المراجعة" ${state.filters.status === 'قيد المراجعة' ? 'selected' : ''}>قيد المراجعة</option>
                                    <option value="يتطلب إجراء" ${state.filters.status === 'يتطلب إجراء' ? 'selected' : ''}>يتطلب إجراء</option>
                                    <option value="مكتمل" ${state.filters.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
                                </select>
                                <select class="form-input" data-filter="riskBracket">
                                    <option value="all" ${state.filters.riskBracket === 'all' ? 'selected' : ''}>جميع مستويات المخاطر</option>
                                    ${RISK_BRACKETS.map((bracket) => `
                                        <option value="${bracket.id}" ${state.filters.riskBracket === bracket.id ? 'selected' : ''}>
                                            ${bracket.label}
                                        </option>
                                    `).join('')}
                                </select>
                            </form>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="flex items-center justify-between mb-4">
                            <div class="text-sm text-gray-500">
                                <i class="fas fa-sort ml-1"></i>
                                ترتيب حسب:
                                <select class="form-input inline-block w-auto ml-2" data-sort-field>
                                    <option value="updatedAt" ${state.sort.field === 'updatedAt' ? 'selected' : ''}>آخر تحديث</option>
                                    <option value="date" ${state.sort.field === 'date' ? 'selected' : ''}>تاريخ التقييم</option>
                                    <option value="riskLevel" ${state.sort.field === 'riskLevel' ? 'selected' : ''}>مستوى المخاطر</option>
                                    <option value="status" ${state.sort.field === 'status' ? 'selected' : ''}>الحالة</option>
                                </select>
                                <button type="button" class="btn-icon ml-2" data-sort-direction>
                                    <i class="fas fa-sort-amount-${state.sort.direction === 'asc' ? 'up' : 'down'}"></i>
                                </button>
                            </div>
                            <button type="button" class="btn-secondary btn-sm" data-action="reset-filters">
                                <i class="fas fa-undo ml-1"></i>
                                إعادة الضبط
                            </button>
                        </div>
                        <div id="risk-assessment-table-container" class="relative">
                            <div class="empty-state" id="risk-assessment-empty-state">
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
            </div>
        `;
    };

    const formatRiskBadge = (riskValue) => {
        if (!riskValue && riskValue !== 0) return '-';
        const numeric = Number(riskValue);
        const badgeClass = getBadgeClassForRisk(numeric);
        return `<span class="badge badge-${badgeClass}">${Number.isNaN(numeric) ? Utils.escapeHTML(riskValue) : numeric}</span>`;
    };

    const buildRow = (assessment) => {
        const fallbackRiskLevel = coalesceMetric(assessment.riskLevel, '');
        const initialRisk = coalesceMetric(assessment.initialRiskRate, fallbackRiskLevel);
        const residualRisk = coalesceMetric(assessment.residualRiskRate, fallbackRiskLevel);

        return `
            <tr data-id="${assessment.id}">
                <td>
                    <div class="font-semibold text-gray-800">${Utils.escapeHTML(assessment.activity || '-')}</div>
                    <div class="text-xs text-gray-500">${toArabicDate(assessment.createdAt)}</div>
                </td>
                <td>${Utils.escapeHTML(assessment.location || '-')}</td>
                <td>
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-500">قبل التحكم:</span>
                            ${formatRiskBadge(initialRisk)}
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-500">بعد التحكم:</span>
                            ${formatRiskBadge(residualRisk)}
                        </div>
                    </div>
                </td>
                <td>${toArabicDate(assessment.date)}</td>
                <td>
                    <span class="badge badge-${getBadgeClassForStatus(assessment.status)}">
                        ${assessment.status || '-'}
                    </span>
                </td>
                <td class="w-32">
                    <div class="flex items-center gap-2 justify-end">
                        <button class="btn-icon btn-icon-info" data-action="view" data-id="${assessment.id}" title="عرض">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon btn-icon-primary" data-action="edit" data-id="${assessment.id}" title="تعديل">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${assessment.id}" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    };

    const renderTable = (assessments) => {
        const container = document.querySelector(SELECTORS.tableContainer);
        if (!container) return;

        if (!assessments.length) {
            container.innerHTML = `
                <div class="empty-state" id="risk-assessment-empty-state">
                    <i class="fas fa-shield-alt text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد تقييمات مخاطر مطابقة للمرشحات الحالية</p>
                    <button class="btn-primary mt-4" data-action="create">
                        <i class="fas fa-plus ml-2"></i>
                        إضافة تقييم جديد
                    </button>
                </div>
            `;
            return;
        }

        const fragment = document.createElement('template');
        fragment.innerHTML = `
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>النشاط/المهمة</th>
                            <th>الموقع</th>
                            <th>معدلات المخاطر</th>
                            <th>تاريخ التقييم</th>
                            <th>الحالة</th>
                            <th class="text-right">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="risk-assessment-table-body">
                        ${assessments.map(buildRow).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = '';
        container.appendChild(fragment.content);
    };

    const renderSummary = (assessments) => {
        const summaryRoot = document.querySelector(SELECTORS.summary);
        if (!summaryRoot) return;

        const total = assessments.length;
        const requiresAction = assessments.filter((item) => item.status === 'يتطلب إجراء').length;
        const completed = assessments.filter((item) => item.status === 'مكتمل').length;
        const highRisk = assessments.filter((item) => {
            const level = getEffectiveRiskValue(item);
            return !Number.isNaN(level) && level >= 15;
        }).length;
        const lastUpdated = assessments
            .map((item) => item.updatedAt)
            .filter(Boolean)
            .sort((a, b) => new Date(b) - new Date(a))[0] || null;

        summaryRoot.innerHTML = `
            <div class="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
                <div class="text-sm text-gray-500 mb-2">إجمالي التقييمات</div>
                <div class="text-3xl font-bold text-gray-800">${total}</div>
            </div>
            <div class="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="text-sm text-gray-500 mb-2">يتطلب إجراء</div>
                        <div class="text-2xl font-semibold text-red-600">${requiresAction}</div>
                    </div>
                    <span class="badge badge-danger">${((requiresAction / (total || 1)) * 100).toFixed(0)}%</span>
                </div>
            </div>
            <div class="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
                <div class="text-sm text-gray-500 mb-2">مكتمل</div>
                <div class="text-2xl font-semibold text-emerald-600">${completed}</div>
            </div>
            <div class="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
                <div class="text-sm text-gray-500 mb-2">مخاطر عالية/حرجة</div>
                <div class="text-2xl font-semibold text-orange-600">${highRisk}</div>
                ${lastUpdated ? `<div class="text-xs text-gray-400 mt-2">
                    <i class="fas fa-history ml-1"></i> آخر تحديث ${toArabicDate(lastUpdated)}
                </div>` : ''}
            </div>
        `;
    };

    const scheduleRefresh = () => {
        if (state.scheduleHandle) {
            cancelAnimationFrame(state.scheduleHandle);
        }
        state.scheduleHandle = requestAnimationFrame(() => {
            state.scheduleHandle = null;
            api.loadRiskAssessmentsList();
        });
    };

    const handleFilterChange = (event) => {
        const target = event.target;
        if (!target) return;

        if (target.dataset.filter === 'query') {
            state.filters.query = target.value || '';
            scheduleRefresh();
        }
        if (target.dataset.filter === 'status') {
            state.filters.status = target.value || 'all';
            scheduleRefresh();
        }
        if (target.dataset.filter === 'riskBracket') {
            state.filters.riskBracket = target.value || 'all';
            scheduleRefresh();
        }
    };

    const handleSortChange = (event) => {
        const target = event.target.closest('[data-sort-field], [data-sort-direction]');
        if (!target) return;

        if (target.matches('[data-sort-field]')) {
            state.sort.field = target.value;
            scheduleRefresh();
        } else if (target.matches('[data-sort-direction]')) {
            state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
            scheduleRefresh();
        }
    };

    const handleSectionClick = (event) => {
        const actionTarget = event.target.closest('[data-action]');
        if (!actionTarget) return;
        const { action, id } = actionTarget.dataset;

        switch (action) {
            case 'view':
                api.viewAssessment(id);
                break;
            case 'edit':
                api.editAssessment(id);
                break;
            case 'delete':
                api.deleteAssessment(id);
                break;
            case 'create':
                api.showForm();
                break;
            case 'reset-filters':
                state.filters = {
                    query: '',
                    status: 'all',
                    riskBracket: 'all'
                };
                state.sort = { field: 'updatedAt', direction: 'desc' };
                api.load(true);
                break;
            default:
                break;
        }
    };

    const bindEvents = (section) => {
        if (state.listenersBound) return;
        section.addEventListener('input', handleFilterChange);
        section.addEventListener('change', handleFilterChange);
        section.addEventListener('change', handleSortChange);
        section.addEventListener('click', handleSectionClick);
        state.listenersBound = true;
    };

    const api = {
        async load(forceRefresh = false) {
            const section = document.querySelector(SELECTORS.section);
            if (!section) return;

            ensureDataStructure();

            if (forceRefresh) {
                state.initialized = false;
            }

            try {
                await renderShell(section);
                bindEvents(section);

                // تحميل البيانات فوراً بعد عرض الواجهة (حتى لو كانت البيانات فارغة)
                // هذا يضمن عدم بقاء الواجهة فارغة بعد التحميل
                try {
                    // استخدام setTimeout بسيط لضمان أن DOM جاهز
                    setTimeout(() => {
                        api.loadRiskAssessmentsList().catch(error => {
                            Utils.safeWarn('⚠️ خطأ في تحميل قائمة تقييمات المخاطر الأولي:', error);
                            // حتى في حالة الخطأ، تأكد من أن الواجهة ليست فارغة
                            const container = document.querySelector(SELECTORS.tableContainer);
                            if (container) {
                                const filtered = getFilteredAssessments();
                                renderSummary(filtered);
                                renderTable(filtered);
                            }
                        });
                    }, 0);
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في تحميل قائمة تقييمات المخاطر:', error);
                    // حتى في حالة الخطأ، تأكد من أن الواجهة ليست فارغة
                    const container = document.querySelector(SELECTORS.tableContainer);
                    if (container) {
                        const filtered = getFilteredAssessments();
                        renderSummary(filtered);
                        renderTable(filtered);
                    } else {
                        // إذا لم يكن هناك container، عرض رسالة خطأ
                        const contentArea = document.querySelector('#risk-assessment-content');
                        if (contentArea) {
                            contentArea.innerHTML = `
                                <div class="content-card">
                                    <div class="card-body">
                                        <div class="empty-state">
                                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                            <p class="text-gray-500 mb-2">حدث خطأ أثناء تحميل البيانات</p>
                                            <p class="text-sm text-gray-400 mb-4">${error && error.message ? Utils.escapeHTML(error.message) : 'خطأ غير معروف'}</p>
                                            <button onclick="RiskAssessment.load()" class="btn-primary">
                                                <i class="fas fa-redo ml-2"></i>
                                                إعادة المحاولة
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }
                    }
                }

                state.initialized = true;
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('❌ خطأ في تحميل مديول تقييم المخاطر:', error);
                } else {
                    console.error('❌ خطأ في تحميل مديول تقييم المخاطر:', error);
                }
                const section = document.querySelector(SELECTORS.section);
                if (section) {
                    section.innerHTML = `
                        <div class="section-header">
                            <div>
                                <h1 class="section-title">
                                    <i class="fas fa-shield-alt ml-3"></i>
                                    تقييم المخاطر
                                </h1>
                            </div>
                        </div>
                        <div class="mt-6">
                            <div class="content-card">
                                <div class="card-body">
                                    <div class="empty-state">
                                        <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                        <p class="text-gray-500 mb-2">حدث خطأ أثناء تحميل البيانات</p>
                                        <p class="text-sm text-gray-400 mb-4">${error && error.message ? Utils.escapeHTML(error.message) : 'خطأ غير معروف'}</p>
                                        <button onclick="RiskAssessment.load()" class="btn-primary">
                                            <i class="fas fa-redo ml-2"></i>
                                            إعادة المحاولة
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }
                if (typeof Notification !== 'undefined' && Notification.error) {
                    Notification.error('حدث خطأ أثناء تحميل تقييم المخاطر. يُرجى المحاولة مرة أخرى.', { duration: 5000 });
                }
            }
        },

        async loadRiskAssessmentsList() {
            const filtered = getFilteredAssessments();
            renderSummary(filtered);
            renderTable(filtered);

            const addBtn = document.getElementById('add-risk-assessment-btn');
            if (addBtn) addBtn.onclick = () => this.showForm();

            const exportBtn = document.querySelector(SELECTORS.exportButton);
            if (exportBtn) {
                exportBtn.onclick = () => this.exportToExcel(filtered);
            }

            const emptyCreate = document.querySelector('[data-action="create"]');
            if (emptyCreate) {
                emptyCreate.addEventListener('click', () => this.showForm(), { once: true });
            }
        },

        getRiskLevelBadgeClass: getBadgeClassForRisk,

        async exportToExcel(assessmentsOverride = null) {
            const dataset = assessmentsOverride ?? getFilteredAssessments();

            if (!dataset.length) {
                Notification?.info?.('لا توجد بيانات لتصديرها في المرشحات الحالية');
                return;
            }

            try {
                Loading.show();

                if (typeof XLSX === 'undefined') {
                    throw new Error('مكتبة SheetJS غير متوفرة');
                }

                const excelData = dataset.map((risk) => ({
                    'النشاط/المهمة': risk.activity || '',
                    'الموقع': risk.location || '',
                    'تاريخ التقييم': risk.date ? Utils.formatDate(risk.date) : '',
                    'الحالة': risk.status || '',
                    'وصف العملية': risk.processDescription || '',
                    'الخطر': risk.hazard || '',
                    'الخطورة': risk.riskDescription || '',
                    'وسيلة التحكم الحالية': risk.existingControlMeasure || '',
                    'الاحتمالية قبل التحكم (P)': risk.initialProbability || '',
                    'الشدة قبل التحكم (S)': risk.initialSeverity || '',
                    'معدل الخطورة قبل التحكم (R)': risk.initialRiskRate || '',
                    'وسيلة التحكم المطلوبة': risk.requiredControlMeasure || '',
                    'المسؤول عن التنفيذ': risk.responsiblePerson || '',
                    'التاريخ المخطط': risk.planningDate ? Utils.formatDate(risk.planningDate) : '',
                    'الاحتمالية بعد التحكم (P)': risk.residualProbability || '',
                    'الشدة بعد التحكم (S)': risk.residualSeverity || '',
                    'معدل الخطورة بعد التحكم (R)': risk.residualRiskRate || '',
                    'وسيلة التحكم الإضافية': risk.additionalControl || '',
                    'الإجراء المطلوب': risk.actionRequired || '',
                    'المتابعة': risk.followUp || '',
                    'التاريخ المخطط للتنفيذ': risk.actionPlannedDate ? Utils.formatDate(risk.actionPlannedDate) : '',
                    'المسؤول': risk.actionResponsible || '',
                    'تاريخ الانتهاء': risk.endDate ? Utils.formatDate(risk.endDate) : '',
                    'الفاعلية': risk.effectiveness || '',
                    'استدامة': risk.sustainability || '',
                    'معدل الخطورة النهائي': risk.riskLevel || '',
                    'تاريخ الإنشاء': risk.createdAt ? Utils.formatDate(risk.createdAt) : '',
                    'آخر تحديث': risk.updatedAt ? Utils.formatDate(risk.updatedAt) : ''
                }));

                const workbook = XLSX.utils.book_new();
                const worksheet = XLSX.utils.json_to_sheet(excelData);

                worksheet['!cols'] = [
                    { wch: 30 },
                    { wch: 20 },
                    { wch: 15 },
                    { wch: 15 },
                    { wch: 15 },
                    { wch: 50 },
                    { wch: 30 },
                    { wch: 30 },
                    { wch: 30 },
                    { wch: 18 },
                    { wch: 18 },
                    { wch: 18 },
                    { wch: 30 },
                    { wch: 25 },
                    { wch: 18 },
                    { wch: 18 },
                    { wch: 25 },
                    { wch: 25 },
                    { wch: 25 },
                    { wch: 25 },
                    { wch: 25 },
                    { wch: 18 },
                    { wch: 18 },
                    { wch: 18 },
                    { wch: 18 },
                    { wch: 18 }
                ];

                XLSX.utils.book_append_sheet(workbook, worksheet, 'تقييم المخاطر');

                const date = new Date().toISOString().slice(0, 10);
                XLSX.writeFile(workbook, `سجل_تقييم_المخاطر_${date}.xlsx`);

                Notification.success('تم تصدير سجل تقييم المخاطر بنجاح');
            } catch (error) {
                Utils.safeError('خطأ في تصدير Excel:', error);
                Notification.error('فشل تصدير Excel: ' + error.message);
            } finally {
                Loading.hide();
            }
        },

        async showForm(data = null) {
            const isEdit = Boolean(data);
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 1100px;">
                    <div class="modal-header">
                        <h2 class="modal-title">${isEdit ? 'تعديل تقييم المخاطر' : 'إضافة تقييم مخاطر جديد'}</h2>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body space-y-6">
                        <form id="risk-assessment-form" class="space-y-6">
                            <section class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">النشاط/المهمة *</label>
                                    <input type="text" id="risk-activity" required class="form-input"
                                        value="${Utils.escapeHTML(data?.activity || '')}" placeholder="وصف النشاط">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">الموقع *</label>
                                    <input type="text" id="risk-location" required class="form-input"
                                        value="${Utils.escapeHTML(data?.location || '')}" placeholder="موقع العمل">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">التاريخ *</label>
                                    <input type="date" id="risk-date" required class="form-input"
                                        value="${data?.date ? new Date(data.date).toISOString().slice(0, 10) : ''}">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">الحالة *</label>
                                    <select id="risk-status" required class="form-input">
                                        <option value="">اختر الحالة</option>
                                        <option value="قيد المراجعة" ${data?.status === 'قيد المراجعة' ? 'selected' : ''}>قيد المراجعة</option>
                                        <option value="يتطلب إجراء" ${data?.status === 'يتطلب إجراء' ? 'selected' : ''}>يتطلب إجراء</option>
                                        <option value="مكتمل" ${data?.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
                                    </select>
                                </div>
                            </section>

                            <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div class="lg:col-span-1">
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">وصف العملية</label>
                                    <textarea id="risk-process-description" class="form-input" rows="4"
                                        placeholder="وصف مختصر للعملية أو المهمة">${Utils.escapeHTML(data?.processDescription || '')}</textarea>
                                </div>
                                <div class="lg:col-span-1">
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">الخطر</label>
                                    <textarea id="risk-hazard" class="form-input" rows="4"
                                        placeholder="حدد الخطر الرئيسي المرتبط بالعملية">${Utils.escapeHTML(data?.hazard || '')}</textarea>
                                </div>
                                <div class="lg:col-span-1">
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">الخطورة</label>
                                    <textarea id="risk-risk-description" class="form-input" rows="4"
                                        placeholder="وصف تأثير الخطر وعواقبه المحتملة">${Utils.escapeHTML(data?.riskDescription || '')}</textarea>
                                </div>
                            </section>

                            <!-- مصفوفة تقييم المخاطر التفاعلية -->
                            <section class="flex justify-center">
                                <div id="risk-matrix-initial-container">
                                    ${typeof RiskMatrix !== 'undefined' ? RiskMatrix.generate('risk-matrix-initial', {
                                        selectedProbability: data?.initialProbability ? parseInt(data.initialProbability) : null,
                                        selectedSeverity: data?.initialSeverity ? parseInt(data.initialSeverity) : null,
                                        showLegend: true,
                                        interactive: true
                                    }) : ''}
                                </div>
                            </section>

                            <section class="border rounded-lg p-4 bg-gray-50 space-y-4">
                                <header class="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h3 class="text-lg font-semibold text-gray-800">تقييم المخاطر الحالي (قبل التحكم)</h3>
                                        <p class="text-sm text-gray-500">تحديد وسيلة التحكم الحالية وحساب معدل الخطورة الحالي</p>
                                    </div>
                                </header>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">وسيلة التحكم الحالية</label>
                                    <textarea id="risk-existing-control" class="form-input" rows="3"
                                        placeholder="وصف وسائل التحكم الحالية">${Utils.escapeHTML(data?.existingControlMeasure || '')}</textarea>
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">الاحتمالية (P)</label>
                                        <input type="number" id="risk-probability-initial" min="0" max="5" step="1" class="form-input"
                                            value="${Utils.escapeHTML(data?.initialProbability ?? '')}" placeholder="0 - 5">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">الشدة (S)</label>
                                        <input type="number" id="risk-severity-initial" min="0" max="5" step="1" class="form-input"
                                            value="${Utils.escapeHTML(data?.initialSeverity ?? '')}" placeholder="0 - 5">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">معدل الخطورة (R = S × P)</label>
                                        <input type="text" id="risk-rate-initial" readonly class="form-input bg-gray-100"
                                            value="${Utils.escapeHTML(data?.initialRiskRate ?? '')}" placeholder="سيتم الحساب تلقائيًا">
                                    </div>
                                </div>
                            </section>

                            <section class="border rounded-lg p-4 bg-white space-y-4">
                                <header class="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h3 class="text-lg font-semibold text-gray-800">وسائل التحكم المطلوبة والتخطيط</h3>
                                        <p class="text-sm text-gray-500">تحديد الوسائل المطلوبة والمسؤول والتواريخ المخطط لها</p>
                                    </div>
                                </header>
                                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">وسيلة التحكم المطلوبة</label>
                                        <textarea id="risk-required-control" class="form-input" rows="3"
                                            placeholder="ما الوسائل الإضافية اللازمة للتحكم في الخطر؟">${Utils.escapeHTML(data?.requiredControlMeasure || '')}</textarea>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">وسيلة التحكم الإضافية</label>
                                        <textarea id="risk-additional-control" class="form-input" rows="3"
                                            placeholder="أي وسائل تحكم إضافية مقترحة">${Utils.escapeHTML(data?.additionalControl || '')}</textarea>
                                    </div>
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">المسؤول عن التنفيذ</label>
                                        <input type="text" id="risk-responsible-person" class="form-input"
                                            value="${Utils.escapeHTML(data?.responsiblePerson || '')}" placeholder="اسم المسؤول">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">التاريخ المخطط</label>
                                        <input type="date" id="risk-planning-date" class="form-input"
                                            value="${data?.planningDate ? new Date(data.planningDate).toISOString().slice(0, 10) : ''}">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">الاحتمالية (P)</label>
                                        <input type="number" id="risk-probability-residual" min="0" max="5" step="1" class="form-input"
                                            value="${Utils.escapeHTML(data?.residualProbability ?? '')}" placeholder="0 - 5">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">الشدة (S)</label>
                                        <input type="number" id="risk-severity-residual" min="0" max="5" step="1" class="form-input"
                                            value="${Utils.escapeHTML(data?.residualSeverity ?? '')}" placeholder="0 - 5">
                                    </div>
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">معدل الخطورة بعد التحكم</label>
                                        <input type="text" id="risk-rate-residual" readonly class="form-input bg-gray-100"
                                            value="${Utils.escapeHTML(data?.residualRiskRate ?? '')}" placeholder="سيتم الحساب تلقائيًا">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">الإجراء المطلوب</label>
                                        <textarea id="risk-action-required" class="form-input" rows="3"
                                            placeholder="حدد الإجراءات المطلوبة">${Utils.escapeHTML(data?.actionRequired || '')}</textarea>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">المتابعة</label>
                                        <textarea id="risk-follow-up" class="form-input" rows="3"
                                            placeholder="متطلبات المتابعة">${Utils.escapeHTML(data?.followUp || '')}</textarea>
                                    </div>
                                </div>
                            </section>

                            <section class="border rounded-lg p-4 bg-gray-50 space-y-4">
                                <header>
                                    <h3 class="text-lg font-semibold text-gray-800">تنفيذ السيطرة وقياس الفاعلية</h3>
                                    <p class="text-sm text-gray-500">بيانات التنفيذ الفعلية والنتائج</p>
                                </header>
                                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">تاريخ التنفيذ المخطط</label>
                                        <input type="date" id="risk-planned-date" class="form-input"
                                            value="${data?.actionPlannedDate ? new Date(data.actionPlannedDate).toISOString().slice(0, 10) : ''}">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">المسؤول</label>
                                        <input type="text" id="risk-action-responsible" class="form-input"
                                            value="${Utils.escapeHTML(data?.actionResponsible || '')}" placeholder="مسؤول المتابعة/التنفيذ">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">تاريخ الانتهاء</label>
                                        <input type="date" id="risk-end-date" class="form-input"
                                            value="${data?.endDate ? new Date(data.endDate).toISOString().slice(0, 10) : ''}">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">الفاعلية</label>
                                        <select id="risk-effective" class="form-input">
                                            <option value="">اختر</option>
                                            <option value="فعّال" ${data?.effectiveness === 'فعّال' ? 'selected' : ''}>فعّال</option>
                                            <option value="جزئي" ${data?.effectiveness === 'جزئي' ? 'selected' : ''}>جزئي</option>
                                            <option value="غير فعّال" ${data?.effectiveness === 'غير فعّال' ? 'selected' : ''}>غير فعّال</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">استدامة</label>
                                    <textarea id="risk-sustain" class="form-input" rows="3"
                                        placeholder="كيف سيتم ضمان استدامة التحكم؟">${Utils.escapeHTML(data?.sustainability || '')}</textarea>
                                </div>
                            </section>

                            <input type="hidden" id="risk-level"
                                value="${Utils.escapeHTML(
                data?.residualRiskRate ??
                data?.initialRiskRate ??
                data?.riskLevel ??
                ''
            )}">
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                        <button type="submit" form="risk-assessment-form" class="btn-primary">${isEdit ? 'تحديث' : 'حفظ'}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const form = modal.querySelector('#risk-assessment-form');
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handleSubmit(data?.id ?? null, modal);
            });

            modal.addEventListener('click', (event) => {
                if (event.target === modal) modal.remove();
            });

            const bindRiskCalculation = (probabilityId, severityId, rateId, levelSync = false) => {
                const probInput = document.getElementById(probabilityId);
                const sevInput = document.getElementById(severityId);
                const rateInput = document.getElementById(rateId);

                const updateRate = () => {
                    if (!rateInput) return;
                    const rate = computeRiskRate(probInput?.value, sevInput?.value);
                    const formattedRate = asRiskString(rate);
                    rateInput.value = formattedRate;
                    if (levelSync) {
                        const levelField = document.getElementById('risk-level');
                        if (levelField) levelField.value = formattedRate;
                    }
                };

                probInput?.addEventListener('input', updateRate);
                sevInput?.addEventListener('input', updateRate);
                updateRate();
            };

            bindRiskCalculation('risk-probability-initial', 'risk-severity-initial', 'risk-rate-initial', false);
            bindRiskCalculation('risk-probability-residual', 'risk-severity-residual', 'risk-rate-residual', true);
        },

        async handleSubmit(editId, modal) {
            ensureDataStructure();

            const getElementValue = (id) => {
                const element = document.getElementById(id);
                return element ? element.value.trim() : '';
            };

            const parseDate = (id) => {
                const value = getElementValue(id);
                return value ? new Date(value).toISOString() : '';
            };

            const initialProbability = getElementValue('risk-probability-initial');
            const initialSeverity = getElementValue('risk-severity-initial');
            const residualProbability = getElementValue('risk-probability-residual');
            const residualSeverity = getElementValue('risk-severity-residual');

            const initialRiskRateValue = computeRiskRate(initialProbability, initialSeverity);
            const residualRiskRateValue = computeRiskRate(residualProbability, residualSeverity);

            const normalizedInitialRiskRate = asRiskString(initialRiskRateValue);
            const normalizedResidualRiskRate = asRiskString(residualRiskRateValue);
            const persistedRiskLevel = asRiskString(
                coalesceMetric(normalizedResidualRiskRate, normalizedInitialRiskRate)
            );

            const riskLevelInput = document.getElementById('risk-level');
            if (riskLevelInput) {
                riskLevelInput.value = persistedRiskLevel;
            }

            const formData = {
                id: editId || (window.crypto?.randomUUID?.() ?? Utils.generateId('RISK')),
                activity: getElementValue('risk-activity'),
                location: getElementValue('risk-location'),
                date: parseDate('risk-date'),
                status: getElementValue('risk-status'),
                processDescription: getElementValue('risk-process-description'),
                hazard: getElementValue('risk-hazard'),
                riskDescription: getElementValue('risk-risk-description'),
                existingControlMeasure: getElementValue('risk-existing-control'),
                initialProbability,
                initialSeverity,
                initialRiskRate: normalizedInitialRiskRate,
                requiredControlMeasure: getElementValue('risk-required-control'),
                responsiblePerson: getElementValue('risk-responsible-person'),
                planningDate: parseDate('risk-planning-date'),
                residualProbability,
                residualSeverity,
                residualRiskRate: normalizedResidualRiskRate,
                additionalControl: getElementValue('risk-additional-control'),
                actionRequired: getElementValue('risk-action-required'),
                followUp: getElementValue('risk-follow-up'),
                actionPlannedDate: parseDate('risk-planned-date'),
                actionResponsible: getElementValue('risk-action-responsible'),
                endDate: parseDate('risk-end-date'),
                effectiveness: getElementValue('risk-effective'),
                sustainability: getElementValue('risk-sustain'),
                riskLevel: persistedRiskLevel,
                correctiveActions: getElementValue('risk-action-required'),
                likelihood: coalesceMetric(residualProbability, initialProbability),
                consequence: coalesceMetric(residualSeverity, initialSeverity),
                createdAt: editId ? AppState.appData.riskAssessments.find((item) => item.id === editId)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (!formData.activity || !formData.location || !formData.date || !formData.status) {
                Notification.error('يرجى استكمال الحقول الإجبارية');
                return;
            }

            if (!formData.riskLevel) {
                const confirmWithoutRiskLevel = confirm('لم يتم احتساب معدل الخطورة، هل ترغب في المتابعة؟');
                if (!confirmWithoutRiskLevel) return;
            }

            Loading.show();
            try {
                if (editId) {
                    const index = AppState.appData.riskAssessments.findIndex((item) => item.id === editId);
                    if (index !== -1) {
                        AppState.appData.riskAssessments[index] = { ...AppState.appData.riskAssessments[index], ...formData };
                        Notification.success('تم تحديث التقييم بنجاح');
                    }
                } else {
                    AppState.appData.riskAssessments.push(formData);
                    Notification.success('تم إضافة التقييم بنجاح');
                }

                // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
                await GoogleIntegration.autoSave?.('RiskAssessments', AppState.appData.riskAssessments);

                modal.remove();
                await this.loadRiskAssessmentsList();
            } catch (error) {
                Utils.safeError('فشل حفظ تقييم المخاطر:', error);
                Notification.error('حدث خطأ أثناء حفظ التقييم: ' + error.message);
            } finally {
                Loading.hide();
            }
        },

        async editAssessment(id) {
            const assessment = AppState.appData.riskAssessments.find((item) => item.id === id);
            if (!assessment) {
                Notification.error('تعذر العثور على التقييم المطلوب');
                return;
            }
            await this.showForm(assessment);
        },

        async viewAssessment(id) {
            const assessment = AppState.appData.riskAssessments.find((item) => item.id === id);
            if (!assessment) {
                Notification.error('تعذر العثور على التقييم المطلوب');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 920px;">
                    <div class="modal-header">
                        <h2 class="modal-title">تفاصيل تقييم المخاطر</h2>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body space-y-6">
                        <section class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <span class="text-sm text-gray-500">النشاط/المهمة</span>
                                <div class="font-semibold text-gray-800 mt-1">${Utils.escapeHTML(assessment.activity || '-')}</div>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500">الموقع</span>
                                <div class="font-semibold text-gray-800 mt-1">${Utils.escapeHTML(assessment.location || '-')}</div>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500">تاريخ التقييم</span>
                                <div class="font-semibold text-gray-800 mt-1">${toArabicDate(assessment.date)}</div>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500">الحالة</span>
                                <div class="mt-1">
                                    <span class="badge badge-${getBadgeClassForStatus(assessment.status)}">
                                        ${assessment.status || '-'}
                                    </span>
                                </div>
                            </div>
                        </section>

                        <section class="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-gray-50 border border-gray-100 rounded-lg p-4">
                            <div>
                                <span class="text-sm text-gray-500">وصف العملية</span>
                                <p class="text-gray-800 whitespace-pre-line mt-1">
                                    ${Utils.escapeHTML(assessment.processDescription || '—')}
                                </p>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500">الخطر</span>
                                <p class="text-gray-800 whitespace-pre-line mt-1">
                                    ${Utils.escapeHTML(assessment.hazard || '—')}
                                </p>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500">الخطورة</span>
                                <p class="text-gray-800 whitespace-pre-line mt-1">
                                    ${Utils.escapeHTML(assessment.riskDescription || '—')}
                                </p>
                            </div>
                        </section>

                        <section class="border rounded-lg p-4 space-y-4">
                            <header>
                                <h3 class="text-lg font-semibold text-gray-800">معدلات الخطورة</h3>
                                <p class="text-sm text-gray-500">مقارنة بين معدلات الخطورة قبل وبعد تطبيق إجراءات التحكم</p>
                            </header>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="border rounded-md p-4 bg-white space-y-3">
                                    <h4 class="font-semibold text-gray-700 flex items-center gap-2">
                                        <i class="fas fa-exclamation-triangle text-amber-500"></i>
                                        قبل التحكم
                                    </h4>
                                    <div class="text-sm text-gray-500">وسيلة التحكم الحالية</div>
                                    <p class="text-gray-800 whitespace-pre-line">
                                        ${Utils.escapeHTML(assessment.existingControlMeasure || '—')}
                                    </p>
                                    <div class="grid grid-cols-3 gap-3 text-center">
                                        <div>
                                            <div class="text-xs text-gray-500">الاحتمالية</div>
                                            <div class="font-semibold text-gray-800">${Utils.escapeHTML(assessment.initialProbability || '—')}</div>
                                        </div>
                                        <div>
                                            <div class="text-xs text-gray-500">الشدة</div>
                                            <div class="font-semibold text-gray-800">${Utils.escapeHTML(assessment.initialSeverity || '—')}</div>
                                        </div>
                                        <div>
                                            <div class="text-xs text-gray-500">معدل الخطورة</div>
                                            <div>${formatRiskBadge(assessment.initialRiskRate)}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="border rounded-md p-4 bg-white space-y-3">
                                    <h4 class="font-semibold text-gray-700 flex items-center gap-2">
                                        <i class="fas fa-check-circle text-emerald-500"></i>
                                        بعد التحكم
                                    </h4>
                                    <div class="text-sm text-gray-500">وسيلة التحكم المطلوبة</div>
                                    <p class="text-gray-800 whitespace-pre-line">
                                        ${Utils.escapeHTML(assessment.requiredControlMeasure || '—')}
                                    </p>
                                    <div class="grid grid-cols-3 gap-3 text-center">
                                        <div>
                                            <div class="text-xs text-gray-500">الاحتمالية</div>
                                            <div class="font-semibold text-gray-800">${Utils.escapeHTML(assessment.residualProbability || '—')}</div>
                                        </div>
                                        <div>
                                            <div class="text-xs text-gray-500">الشدة</div>
                                            <div class="font-semibold text-gray-800">${Utils.escapeHTML(assessment.residualSeverity || '—')}</div>
                                        </div>
                                        <div>
                                            <div class="text-xs text-gray-500">معدل الخطورة</div>
                                            <div>${formatRiskBadge(assessment.residualRiskRate || assessment.riskLevel)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section class="border rounded-lg p-4 space-y-4">
                            <header>
                                <h3 class="text-lg font-semibold text-gray-800">التنفيذ والمتابعة</h3>
                            </header>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <span class="text-sm text-gray-500">المسؤول عن التنفيذ</span>
                                    <div class="font-semibold text-gray-800 mt-1">${Utils.escapeHTML(assessment.responsiblePerson || '—')}</div>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-500">التاريخ المخطط</span>
                                    <div class="font-semibold text-gray-800 mt-1">${toArabicDate(assessment.planningDate)}</div>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-500">الإجراء المطلوب</span>
                                    <p class="text-gray-800 whitespace-pre-line mt-1">
                                        ${Utils.escapeHTML(assessment.actionRequired || '—')}
                                    </p>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-500">المتابعة</span>
                                    <p class="text-gray-800 whitespace-pre-line mt-1">
                                        ${Utils.escapeHTML(assessment.followUp || '—')}
                                    </p>
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <span class="text-sm text-gray-500">التاريخ المخطط للتنفيذ</span>
                                    <div class="font-semibold text-gray-800 mt-1">${toArabicDate(assessment.actionPlannedDate)}</div>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-500">المسؤول</span>
                                    <div class="font-semibold text-gray-800 mt-1">${Utils.escapeHTML(assessment.actionResponsible || '—')}</div>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-500">تاريخ الانتهاء</span>
                                    <div class="font-semibold text-gray-800 mt-1">${toArabicDate(assessment.endDate)}</div>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-500">الفاعلية</span>
                                    <div class="font-semibold text-gray-800 mt-1">${Utils.escapeHTML(assessment.effectiveness || '—')}</div>
                                </div>
                            </div>
                            <div>
                                <span class="text-sm text-gray-500">استدامة</span>
                                <p class="text-gray-800 whitespace-pre-line mt-1">
                                    ${Utils.escapeHTML(assessment.sustainability || '—')}
                                </p>
                            </div>
                        </section>

                        <div class="text-xs text-gray-400 border-t pt-3">
                            <i class="fas fa-clock ml-1"></i>
                            تم الإنشاء في ${toArabicDate(assessment.createdAt)} — آخر تحديث ${toArabicDate(assessment.updatedAt)}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                        <div class="flex-1"></div>
                        <button type="button" class="btn-primary" data-action="view-edit" data-id="${assessment.id}">
                            <i class="fas fa-edit ml-1"></i>
                            تعديل
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.addEventListener('click', (event) => {
                if (event.target === modal) modal.remove();
            });

            const editBtn = modal.querySelector('[data-action="view-edit"]');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    modal.remove();
                    this.editAssessment(assessment.id);
                });
            }
        },

        async deleteAssessment(id) {
            const assessment = AppState.appData.riskAssessments.find((item) => item.id === id);
            if (!assessment) {
                Notification.error('التقييم غير موجود أو تم حذفه بالفعل');
                return;
            }

            const confirmation = confirm(`هل أنت متأكد من حذف تقييم المخاطر للنشاط "${assessment.activity}"؟`);
            if (!confirmation) return;

            Loading.show();
            try {
                AppState.appData.riskAssessments = AppState.appData.riskAssessments.filter((item) => item.id !== id);
                // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
                await GoogleIntegration.autoSave?.('RiskAssessments', AppState.appData.riskAssessments);
                Notification.success('تم حذف التقييم بنجاح');
                await this.loadRiskAssessmentsList();
            } catch (error) {
                Utils.safeError('فشل حذف تقييم المخاطر:', error);
                Notification.error('حدث خطأ أثناء حذف التقييم: ' + error.message);
            } finally {
                Loading.hide();
            }
        }
    };

    return api;
})();

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof RiskAssessment !== 'undefined') {
            window.RiskAssessment = RiskAssessment;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ RiskAssessment module loaded and available on window.RiskAssessment');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير RiskAssessment:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof RiskAssessment !== 'undefined') {
            try {
                window.RiskAssessment = RiskAssessment;
            } catch (e) {
                console.error('❌ فشل تصدير RiskAssessment:', e);
            }
        }
    }
})();