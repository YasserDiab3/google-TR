/**
 * Chemical Management Module - مديول إدارة المواد الكيميائية
 * Chemical Register with full CRUD, file uploads, NFPA Diamond, and exports
 */

// ===== Constants =====
const PHYSICAL_SHAPES = [
    'Powder', 'Flakes', 'Pellets', 'Liquid', 'Lubricant', 'Oil', 'Gel', 'Gas', 'Spray'
];

const PURPOSE_OF_USE_OPTIONS = [
    'Electrical panels cleaners',
    'CIP',
    'Water Treatment',
    'Conveyors lubricants',
    'Data Coding',
    'Boilers additives',
    'BW Recovery',
    'BW additives',
    'Cleaning Agent',
    'Pesticide',
    'Lubricants',
    'Fuels',
    'Lab chemicals',
    'Microbiology Media',
    'Cooling Gases',
    'Ingredients',
    'Stationary'
];

const LOCAL_IMPORT_OPTIONS = ['Local', 'Import'];

// ===== SDS / GHS Pictograms (inline SVG) =====
// Note: we keep this minimal and focused on the pictograms shown in the provided template.
const GHS_PICTOGRAMS = [
    {
        key: 'environment',
        labelAr: 'خطر على البيئة',
        // Simple SVG representation (diamond + tree/fish)
        svg: `
            <svg viewBox="0 0 100 100" width="74" height="74" aria-hidden="true" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;">
                <polygon points="50,3 97,50 50,97 3,50" fill="#FFFFFF" stroke="#FF0000" stroke-width="6" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <!-- ground -->
                <line x1="22" y1="72" x2="78" y2="72" stroke="#000000" stroke-width="3" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <!-- tree -->
                <path d="M44 70 L44 46" stroke="#000000" stroke-width="4" stroke-linecap="round" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <path d="M44 46 C36 44, 32 36, 36 30 C40 24, 52 24, 56 30 C60 36, 56 44, 48 46 Z" fill="#000000" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <!-- fish -->
                <path d="M60 68 C66 66, 70 62, 73 58 C76 62, 80 66, 86 68 C80 70, 76 74, 73 78 C70 74, 66 70, 60 68 Z" fill="#000000" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <circle cx="69" cy="66" r="1.8" fill="#FFFFFF" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
            </svg>
        `.trim()
    },
    {
        key: 'corrosion',
        labelAr: 'مادة آكلة',
        // Simple SVG representation (diamond + test tubes and corrosion lines)
        svg: `
            <svg viewBox="0 0 100 100" width="74" height="74" aria-hidden="true" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;">
                <polygon points="50,3 97,50 50,97 3,50" fill="#FFFFFF" stroke="#FF0000" stroke-width="6" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <!-- test tube 1 -->
                <path d="M30 28 L42 28 L39 58 C38 66,34 70,30 70 C26 70,22 66,23 58 Z" fill="#000000" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <rect x="28" y="24" width="16" height="6" fill="#000000" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <!-- test tube 2 -->
                <path d="M52 28 L64 28 L61 52 C60 60,56 64,52 64 C48 64,44 60,45 52 Z" fill="#000000" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <rect x="50" y="24" width="16" height="6" fill="#000000" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <!-- drops -->
                <path d="M40 62 C41 60,42 58,42 56 C42 58,43 60,44 62 C45 64,44 66,42 66 C40 66,39 64,40 62 Z" fill="#000000" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <path d="M62 56 C63 54,64 52,64 50 C64 52,65 54,66 56 C67 58,66 60,64 60 C62 60,61 58,62 56 Z" fill="#000000" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <!-- corrosion lines -->
                <line x1="36" y1="70" x2="50" y2="70" stroke="#000000" stroke-width="3" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <line x1="56" y1="64" x2="74" y2="64" stroke="#000000" stroke-width="3" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <line x1="58" y1="70" x2="82" y2="70" stroke="#000000" stroke-width="3" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
            </svg>
        `.trim()
    },
    {
        key: 'skull',
        labelAr: 'سام (سمّية حادة)',
        // Simple SVG representation (diamond + skull)
        svg: `
            <svg viewBox="0 0 100 100" width="74" height="74" aria-hidden="true" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;">
                <polygon points="50,3 97,50 50,97 3,50" fill="#FFFFFF" stroke="#FF0000" stroke-width="6" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <path d="M50 28 C38 28,30 36,30 48 C30 57,35 62,40 64 L40 72 L60 72 L60 64 C65 62,70 57,70 48 C70 36,62 28,50 28 Z" fill="#000000" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <circle cx="42" cy="46" r="6" fill="#FFFFFF" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <circle cx="58" cy="46" r="6" fill="#FFFFFF" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <rect x="46" y="54" width="8" height="6" rx="2" fill="#FFFFFF" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <!-- crossbones -->
                <path d="M28 76 L72 56" stroke="#000000" stroke-width="6" stroke-linecap="round" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <path d="M28 56 L72 76" stroke="#000000" stroke-width="6" stroke-linecap="round" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
            </svg>
        `.trim()
    },
    {
        key: 'flame',
        labelAr: 'قابل للاشتعال',
        // Simple SVG representation (diamond + flame)
        svg: `
            <svg viewBox="0 0 100 100" width="74" height="74" aria-hidden="true" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;">
                <polygon points="50,3 97,50 50,97 3,50" fill="#FFFFFF" stroke="#FF0000" stroke-width="6" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <path d="M52 24 C58 34,52 38,60 46 C67 53,66 64,58 72 C52 78,42 78,36 72 C28 64,30 52,40 44 C45 40,44 34,48 30 C49 34,52 36,52 24 Z" fill="#000000" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <path d="M48 54 C52 58,50 60,54 64 C56 66,56 70,52 72 C48 74,44 72,42 68 C40 64,42 60,46 58 C47 57,48 56,48 54 Z" fill="#FFFFFF" opacity="0.3" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
                <line x1="30" y1="76" x2="70" y2="76" stroke="#000000" stroke-width="4" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;"/>
            </svg>
        `.trim()
    }
];

// ===== Helper Functions =====
function generateISOCode(prefix, dataArray) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = (dataArray || []).length + 1;
    return `${prefix}-${year}${month}-${String(count).padStart(4, '0')}`;
}

// ===== Chemical Safety Module =====
const ChemicalSafety = {
    currentEditId: null,
    filters: {
        search: '',
        department: '',
        physicalShape: '',
        classification: ''
    },
    msdsFiles: {
        arabic: null,
        english: null
    },
    // مراجع لتنظيف الموارد
    _eventListenersAbortController: null,
    _setupTimeoutId: null,
    _chemicalDataLoadPromise: null,
    _chemicalBackendFetchOk: false,

    /**
     * تحميل الموديول
     */
    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        const section = document.getElementById('chemical-safety-section');
        if (!section) return;

        if (typeof AppState === 'undefined') {
            // لا تترك الواجهة فارغة (مهم للاختبار وتجربة المستخدم)
            section.innerHTML = `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-2">تعذر تحميل السلامة الكيميائية</p>
                            <p class="text-sm text-gray-400">AppState غير متوفر حالياً. جرّب تحديث الصفحة.</p>
                            <button onclick="location.reload()" class="btn-primary mt-4">
                                <i class="fas fa-redo ml-2"></i>
                                تحديث الصفحة
                            </button>
                        </div>
                    </div>
                </div>
            `;
            Utils?.safeError?.('AppState غير متوفر!');
            return;
        }

        if (!AppState.appData) AppState.appData = {};
        if (!AppState.appData.chemicalRegister) AppState.appData.chemicalRegister = [];

        try {
            // Skeleton فوري قبل أي عمليات قد تكون بطيئة
            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-flask ml-3"></i>
                                سجل المواد الكيميائية
                            </h1>
                            <p class="section-subtitle">جاري التحميل...</p>
                        </div>
                        <button class="btn-primary" disabled>
                            <i class="fas fa-spinner fa-spin ml-2"></i>
                            تحميل
                        </button>
                    </div>
                </div>
                <div class="mt-6">
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <div style="width: 300px; margin: 0 auto 16px;">
                                    <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                        <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                    </div>
                                </div>
                                <p class="text-gray-500">جاري تجهيز الواجهة...</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // محاولة تحميل القائمة مع معالجة الأخطاء
            let listContent = '';
            try {
                const listPromise = this.renderList();
                listContent = await Utils.promiseWithTimeout(
                    listPromise,
                    10000,
                    () => new Error('Timeout: renderList took too long')
                );
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                    Utils.safeWarn('⚠️ خطأ في تحميل قائمة المواد الكيميائية:', error);
                } else {
                    console.warn('⚠️ خطأ في تحميل قائمة المواد الكيميائية:', error);
                }
                listContent = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">حدث خطأ في تحميل البيانات</p>
                                <button onclick="ChemicalSafety.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    إعادة المحاولة
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }

            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-flask ml-3"></i>
                                سجل المواد الكيميائية
                            </h1>
                            <p class="section-subtitle">إدارة سجل المواد الكيميائية والمواد الخام</p>
                        </div>
                        <button id="add-chemical-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة مادة جديدة
                        </button>
                    </div>
                </div>
                <div id="chemical-content" class="mt-6">
                    ${listContent}
                </div>
            `;

            this.setupEventListeners();
            
            try {
                await this.loadChemicalDataAsync();
            } catch (error) {
                Utils.safeWarn('⚠️ تعذر تحميل بيانات المواد الكيميائية:', error);
                this.loadChemicalList();
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل مديول المواد الكيميائية:', error);
            section.innerHTML = `
                <div class="section-header">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-flask ml-3"></i>
                            سجل المواد الكيميائية
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
                                <button onclick="ChemicalSafety.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>إعادة المحاولة
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * تحميل البيانات من Google Sheets
     */
    async loadChemicalDataAsync() {
        if (this._chemicalDataLoadPromise) {
            return this._chemicalDataLoadPromise;
        }
        this._chemicalDataLoadPromise = (async () => {
            if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
                this._chemicalBackendFetchOk = true;
                this.loadChemicalList();
                return;
            }
            if (typeof GoogleIntegration === 'undefined' || typeof GoogleIntegration.sendRequest !== 'function') {
                this._chemicalBackendFetchOk = true;
                this.loadChemicalList();
                return;
            }
            try {
                const result = await GoogleIntegration.sendRequest({
                    action: 'readFromSheet',
                    data: {
                        sheetName: 'Chemical_Register',
                        spreadsheetId: AppState.googleConfig?.sheets?.spreadsheetId
                    }
                }).catch(error => {
                    Utils.safeWarn('⚠️ تعذر تحميل بيانات السجل:', error);
                    return { success: false, data: [] };
                });

                let dataUpdated = false;
                if (result && result.success && Array.isArray(result.data)) {
                    AppState.appData.chemicalRegister = result.data;
                    dataUpdated = true;
                    Utils.safeLog(`✅ تم تحميل ${result.data.length} سجل من Google Sheets`);
                } else {
                    if (!AppState.appData.chemicalRegister) {
                        AppState.appData.chemicalRegister = [];
                    }
                }

                const statsContainer = document.getElementById('chemical-stats-container');
                if (statsContainer) {
                    statsContainer.innerHTML = this.renderStatisticsCards();
                }
                this.loadChemicalList();

                if (dataUpdated && typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }
                try {
                    localStorage.setItem('chemical_safety_last_sync', String(Date.now()));
                } catch (e) {}
            } catch (error) {
                Utils.safeError('❌ خطأ في تحميل البيانات:', error);
                const statsContainer = document.getElementById('chemical-stats-container');
                if (statsContainer) {
                    statsContainer.innerHTML = this.renderStatisticsCards();
                }
                this.loadChemicalList();
            }
            this._chemicalBackendFetchOk = true;
        })().finally(() => {
            this._chemicalDataLoadPromise = null;
        });
        return this._chemicalDataLoadPromise;
    },

    /**
     * حساب الإحصائيات
     */
    getStatistics() {
        const chemicals = AppState.appData.chemicalRegister || [];
        const total = chemicals.length;
        const hazardous = chemicals.filter(c => {
            const hc = (c.hazardClass || '').toLowerCase();
            return hc.includes('hazard') || hc.includes('خط') || hc.includes('danger');
        }).length;
        const safe = total - hazardous;
        
        // توزيع حسب الشكل الفيزيائي
        const shapeDistribution = {};
        chemicals.forEach(c => {
            const shape = c.physicalShape || 'غير محدد';
            shapeDistribution[shape] = (shapeDistribution[shape] || 0) + 1;
        });
        
        // توزيع حسب القسم
        const deptDistribution = {};
        chemicals.forEach(c => {
            const dept = c.department || 'غير محدد';
            deptDistribution[dept] = (deptDistribution[dept] || 0) + 1;
        });
        
        // المواد التي لديها MSDS
        const withMSDS = chemicals.filter(c => c.msdsArabic || c.msdsEnglish).length;
        const withoutMSDS = total - withMSDS;
        
        return {
            total,
            hazardous,
            safe,
            shapeDistribution,
            deptDistribution,
            withMSDS,
            withoutMSDS,
            hazardousPercentage: total > 0 ? Math.round((hazardous / total) * 100) : 0
        };
    },

    /**
     * عرض كروت الإحصائيات
     */
    renderStatisticsCards() {
        const stats = this.getStatistics();
        
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <!-- إجمالي المواد -->
                <div class="content-card bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 hover:shadow-lg transition-all duration-300">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">
                                <i class="fas fa-flask ml-2"></i>إجمالي المواد
                            </p>
                            <p class="text-3xl font-bold text-blue-600">${stats.total}</p>
                            <p class="text-xs text-gray-500 mt-1">مادة كيميائية مسجلة</p>
                        </div>
                        <div class="bg-blue-500 rounded-full p-4">
                            <i class="fas fa-flask text-white text-2xl"></i>
                        </div>
                    </div>
                </div>
                
                <!-- المواد الخطرة -->
                <div class="content-card bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500 hover:shadow-lg transition-all duration-300">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">
                                <i class="fas fa-exclamation-triangle ml-2"></i>المواد الخطرة
                            </p>
                            <p class="text-3xl font-bold text-red-600">${stats.hazardous}</p>
                            <p class="text-xs text-gray-500 mt-1">${stats.hazardousPercentage}% من الإجمالي</p>
                        </div>
                        <div class="bg-red-500 rounded-full p-4">
                            <i class="fas fa-exclamation-triangle text-white text-2xl"></i>
                        </div>
                    </div>
                </div>
                
                <!-- المواد الآمنة -->
                <div class="content-card bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500 hover:shadow-lg transition-all duration-300">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">
                                <i class="fas fa-shield-alt ml-2"></i>المواد الآمنة
                            </p>
                            <p class="text-3xl font-bold text-green-600">${stats.safe}</p>
                            <p class="text-xs text-gray-500 mt-1">مواد آمنة للاستخدام</p>
                        </div>
                        <div class="bg-green-500 rounded-full p-4">
                            <i class="fas fa-shield-alt text-white text-2xl"></i>
                        </div>
                    </div>
                </div>
                
                <!-- المواد مع MSDS -->
                <div class="content-card bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-500 hover:shadow-lg transition-all duration-300">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">
                                <i class="fas fa-file-pdf ml-2"></i>مواد مع MSDS
                            </p>
                            <p class="text-3xl font-bold text-purple-600">${stats.withMSDS}</p>
                            <p class="text-xs text-gray-500 mt-1">${stats.withoutMSDS} بدون MSDS</p>
                        </div>
                        <div class="bg-purple-500 rounded-full p-4">
                            <i class="fas fa-file-pdf text-white text-2xl"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض القائمة
     */
    async renderList() {
        return `
            <!-- كروت الإحصائيات -->
            <div id="chemical-stats-container" class="mb-6">
                ${this.renderStatisticsCards()}
            </div>
            
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <h2 class="card-title">
                            <i class="fas fa-list ml-2"></i>
                            سجل المواد الكيميائية
                        </h2>
                        <div class="flex items-center gap-2">
                            <button id="export-pdf-btn" class="btn-secondary">
                                <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                            </button>
                            <button id="export-excel-btn" class="btn-success">
                                <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                            </button>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <!-- فلاتر البحث المحسنة -->
                    <div class="bg-gray-50 p-4 rounded-lg mb-6">
                        <div class="flex items-center gap-2 mb-4">
                            <i class="fas fa-filter text-blue-600"></i>
                            <h3 class="text-sm font-semibold text-gray-700">فلترة البحث</h3>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-search ml-1 text-gray-400"></i>بحث عام
                                </label>
                                <input type="text" id="search-filter" class="form-input" 
                                    placeholder="بحث بالاسم، الكود..." value="${Utils.escapeHTML(this.filters.search)}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-building ml-1 text-gray-400"></i>القسم
                                </label>
                                <input type="text" id="department-filter" class="form-input" 
                                    placeholder="القسم" value="${Utils.escapeHTML(this.filters.department)}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-shapes ml-1 text-gray-400"></i>الشكل الفيزيائي
                                </label>
                                <select id="physical-shape-filter" class="form-input">
                                    <option value="">الكل</option>
                                    ${PHYSICAL_SHAPES.map(shape => `
                                        <option value="${shape}" ${this.filters.physicalShape === shape ? 'selected' : ''}>
                                            ${shape}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-tags ml-1 text-gray-400"></i>التصنيف
                                </label>
                                <input type="text" id="classification-filter" class="form-input" 
                                    placeholder="التصنيف" value="${Utils.escapeHTML(this.filters.classification)}">
                            </div>
                        </div>
                        <div class="flex justify-end mt-4">
                            <button id="reset-filters-btn" class="btn-secondary btn-sm">
                                <i class="fas fa-undo-alt ml-2"></i>إعادة تعيين الفلاتر
                            </button>
                        </div>
                    </div>
                    <div id="chemical-table-container">
                        <div class="empty-state">
                            <p class="text-gray-500">جاري التحميل...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * تحميل وعرض قائمة المواد
     */
    async loadChemicalList() {
        const container = document.getElementById('chemical-table-container');
        if (!container) return;

        const chemicals = AppState.appData.chemicalRegister || [];
        const filtered = this.getFilteredChemicals(chemicals);

        // تحديث الإحصائيات
        const statsContainer = document.getElementById('chemical-stats-container');
        if (statsContainer) {
            statsContainer.innerHTML = this.renderStatisticsCards();
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state py-12">
                    <i class="fas fa-flask text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 text-lg mb-2">لا توجد مواد كيميائية مسجلة</p>
                    <p class="text-gray-400 text-sm">ابدأ بإضافة مادة كيميائية جديدة</p>
                    <button onclick="ChemicalSafety.showForm()" class="btn-primary mt-4">
                        <i class="fas fa-plus ml-2"></i>إضافة مادة جديدة
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="overflow-x-auto rounded-lg border border-gray-200">
                <table class="data-table">
                    <thead class="bg-gradient-to-r from-blue-600 to-blue-700">
                        <tr>
                            <th class="text-white">م</th>
                            <th class="text-white">اسم المادة</th>
                            <th class="text-white">الشكل الفيزيائي</th>
                            <th class="text-white">الغرض من الاستخدام</th>
                            <th class="text-white">القسم</th>
                            <th class="text-white">التصنيف</th>
                            <th class="text-white">الموقع/المخزن</th>
                            <th class="text-white">الكمية/السنة</th>
                            <th class="text-white">خطورة</th>
                            <th class="text-white">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map((chemical, index) => {
                            const isHazardous = chemical.hazardClass && 
                                (chemical.hazardClass.toLowerCase().includes('hazard') || 
                                 chemical.hazardClass.toLowerCase().includes('خط') ||
                                 chemical.hazardClass.toLowerCase().includes('danger'));
                            const hasMSDS = !!(chemical.msdsArabic || chemical.msdsEnglish);
                            return `
                                <tr class="${isHazardous ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'} transition-colors duration-150">
                                    <td class="font-semibold text-gray-700">${chemical.serialNumber || (index + 1)}</td>
                                    <td>
                                        <div class="font-semibold text-gray-900">${Utils.escapeHTML(chemical.rmName || '')}</div>
                                        <div class="flex items-center gap-2 mt-1">
                                            ${isHazardous ? '<span class="badge badge-danger text-xs"><i class="fas fa-exclamation-triangle ml-1"></i>خطير</span>' : ''}
                                            ${hasMSDS ? '<span class="badge badge-info text-xs"><i class="fas fa-file-pdf ml-1"></i>MSDS</span>' : ''}
                                        </div>
                                    </td>
                                    <td>
                                        <span class="text-gray-700">${Utils.escapeHTML(chemical.physicalShape || '-')}</span>
                                    </td>
                                    <td>
                                        <div class="max-w-xs truncate" title="${Array.isArray(chemical.purposeOfUse) ? chemical.purposeOfUse.join(', ') : Utils.escapeHTML(chemical.purposeOfUse || '')}">
                                            ${Array.isArray(chemical.purposeOfUse) 
                                                ? chemical.purposeOfUse.slice(0, 2).join(', ') + (chemical.purposeOfUse.length > 2 ? '...' : '')
                                                : Utils.escapeHTML((chemical.purposeOfUse || '').substring(0, 30) + ((chemical.purposeOfUse || '').length > 30 ? '...' : ''))}
                                        </div>
                                    </td>
                                    <td>
                                        <span class="text-gray-700">${Utils.escapeHTML(chemical.department || '-')}</span>
                                    </td>
                                    <td>
                                        ${chemical.hazardClass 
                                            ? `<span class="px-2 py-1 rounded text-xs font-semibold ${isHazardous ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}">${Utils.escapeHTML(chemical.hazardClass)}</span>`
                                            : '<span class="text-gray-400">-</span>'}
                                    </td>
                                    <td>
                                        <span class="text-gray-700">${Utils.escapeHTML(chemical.locationStore || '-')}</span>
                                    </td>
                                    <td>
                                        <span class="font-semibold text-gray-800">${Utils.escapeHTML(chemical.qtyYear || '-')}</span>
                                    </td>
                                    <td>
                                        ${isHazardous 
                                            ? '<span class="badge badge-danger"><i class="fas fa-exclamation-triangle ml-1"></i>خطير</span>'
                                            : '<span class="badge badge-success"><i class="fas fa-check-circle ml-1"></i>آمن</span>'}
                                    </td>
                                    <td>
                                        <div class="flex items-center gap-2">
                                            <button onclick="ChemicalSafety.viewChemical('${chemical.id}')" 
                                                class="btn-icon btn-icon-primary hover:scale-110 transition-transform" title="عرض التفاصيل">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            <button onclick="ChemicalSafety.editChemical('${chemical.id}')" 
                                                class="btn-icon btn-icon-info hover:scale-110 transition-transform" title="تعديل">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="ChemicalSafety.deleteChemical('${chemical.id}')" 
                                                class="btn-icon btn-icon-danger hover:scale-110 transition-transform" title="حذف">
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
            <div class="mt-4 flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                <div class="text-sm text-gray-700">
                    <i class="fas fa-info-circle ml-1 text-blue-600"></i>
                    <span class="font-semibold">إجمالي السجلات:</span> 
                    <span class="text-blue-600 font-bold">${filtered.length}</span> من 
                    <span class="text-gray-600">${chemicals.length}</span>
                </div>
                ${filtered.length < chemicals.length ? `
                    <div class="text-xs text-gray-500">
                        <i class="fas fa-filter ml-1"></i>
                        يتم عرض ${filtered.length} سجل بعد التصفية
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * فلترة المواد
     */
    getFilteredChemicals(chemicals) {
        return chemicals.filter(chem => {
            const searchMatch = !this.filters.search || 
                (chem.rmName && chem.rmName.toLowerCase().includes(this.filters.search.toLowerCase())) ||
                (chem.serialNumber && chem.serialNumber.toString().includes(this.filters.search));
            
            const deptMatch = !this.filters.department || 
                (chem.department && chem.department.toLowerCase().includes(this.filters.department.toLowerCase()));
            
            const shapeMatch = !this.filters.physicalShape || 
                chem.physicalShape === this.filters.physicalShape;
            
            const classMatch = !this.filters.classification || 
                (chem.hazardClass && chem.hazardClass.toLowerCase().includes(this.filters.classification.toLowerCase()));
            
            return searchMatch && deptMatch && shapeMatch && classMatch;
        });
    },

    /**
     * إعداد مستمعي الأحداث
     */
    setupEventListeners() {
        // تنظيف الـ listeners القديمة أولاً
        if (this._eventListenersAbortController) {
            this._eventListenersAbortController.abort();
        }
        this._eventListenersAbortController = new AbortController();
        const signal = this._eventListenersAbortController.signal;

        // تنظيف timeout القديم إن وجد
        if (this._setupTimeoutId) {
            clearTimeout(this._setupTimeoutId);
        }

        this._setupTimeoutId = setTimeout(() => {
            const addBtn = document.getElementById('add-chemical-btn');
            if (addBtn && !signal.aborted) addBtn.addEventListener('click', () => this.showForm(), { signal });

            const searchFilter = document.getElementById('search-filter');
            const deptFilter = document.getElementById('department-filter');
            const shapeFilter = document.getElementById('physical-shape-filter');
            const classFilter = document.getElementById('classification-filter');
            const resetBtn = document.getElementById('reset-filters-btn');

            if (searchFilter && !signal.aborted) {
                searchFilter.addEventListener('input', () => {
                    this.filters.search = searchFilter.value;
                    this.loadChemicalList();
                }, { signal });
            }
            if (deptFilter && !signal.aborted) {
                deptFilter.addEventListener('input', () => {
                    this.filters.department = deptFilter.value;
                    this.loadChemicalList();
                }, { signal });
            }
            if (shapeFilter && !signal.aborted) {
                shapeFilter.addEventListener('change', () => {
                    this.filters.physicalShape = shapeFilter.value;
                    this.loadChemicalList();
                }, { signal });
            }
            if (classFilter && !signal.aborted) {
                classFilter.addEventListener('input', () => {
                    this.filters.classification = classFilter.value;
                    this.loadChemicalList();
                }, { signal });
            }
            if (resetBtn && !signal.aborted) {
                resetBtn.addEventListener('click', () => {
                    this.filters = { search: '', department: '', physicalShape: '', classification: '' };
                    if (searchFilter) searchFilter.value = '';
                    if (deptFilter) deptFilter.value = '';
                    if (shapeFilter) shapeFilter.value = '';
                    if (classFilter) classFilter.value = '';
                    this.loadChemicalList();
                }, { signal });
            }

            const exportPdfBtn = document.getElementById('export-pdf-btn');
            const exportExcelBtn = document.getElementById('export-excel-btn');
            if (exportPdfBtn && !signal.aborted) exportPdfBtn.addEventListener('click', () => this.exportToPDF(), { signal });
            if (exportExcelBtn && !signal.aborted) exportExcelBtn.addEventListener('click', () => this.exportToExcel(), { signal });
        }, 100);
    },

    /**
     * عرض نموذج إضافة/تعديل مادة
     */
    async showForm(data = null) {
        this.currentEditId = data?.id || null;
        this.msdsFiles = { arabic: null, english: null };

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10000';
        
        const purposeOfUseValue = data?.purposeOfUse || [];
        const purposeArray = Array.isArray(purposeOfUseValue) ? purposeOfUseValue : 
            (purposeOfUseValue ? [purposeOfUseValue] : []);

        // SDS data (optional / extended)
        const sdsData = data?.sds || {};
        const sdsPictograms = Array.isArray(sdsData?.ghsPictograms)
            ? sdsData.ghsPictograms
            : (typeof sdsData?.ghsPictograms === 'string'
                ? sdsData.ghsPictograms.split(',').map(v => v.trim()).filter(Boolean)
                : []);
        const sdsInstructions = sdsData?.instructions || {};
        const sdsApproval = sdsData?.approval || {};

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto; overflow-x: hidden;">
                <div class="modal-header bg-white border-b border-gray-200 flex items-center justify-center relative">
                    <h2 class="modal-title text-gray-900 text-2xl font-extrabold text-center">
                        <i class="fas fa-flask ml-2"></i>
                        ${data ? 'تعديل مادة كيميائية' : 'إضافة مادة كيميائية جديدة'}
                    </h2>
                    <button class="modal-close absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:bg-gray-100 rounded p-2 transition-colors" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body p-6">
                    <form id="chemical-form" class="space-y-6">
                        <!-- Tabs Navigation -->
                        <div class="tabs-container">
                            <div class="tabs-nav">
                                <button type="button" class="tab-btn active" data-tab="basic-info">
                                    <i class="fas fa-info-circle ml-2"></i>
                                    المعلومات الأساسية
                                </button>
                                <button type="button" class="tab-btn" data-tab="documents">
                                    <i class="fas fa-file-pdf ml-2"></i>
                                    الملفات والوثائق
                                </button>
                                <button type="button" class="tab-btn" data-tab="manufacturer">
                                    <i class="fas fa-industry ml-2"></i>
                                    معلومات الشركة المصنعة
                                </button>
                                <button type="button" class="tab-btn" data-tab="container">
                                    <i class="fas fa-box ml-2"></i>
                                    معلومات الحاوية
                                </button>
                                <button type="button" class="tab-btn" data-tab="hazards">
                                    <i class="fas fa-exclamation-triangle ml-2"></i>
                                    معلومات الخطورة
                                </button>
                                <button type="button" class="tab-btn" data-tab="location">
                                    <i class="fas fa-map-marker-alt ml-2"></i>
                                    الموقع والكمية
                                </button>
                                <button type="button" class="tab-btn" data-tab="sds">
                                    <i class="fas fa-shield-alt ml-2"></i>
                                    تعليمات السلامة SDS
                                </button>
                            </div>
                        </div>

                        <!-- Tab Content: المعلومات الأساسية -->
                        <div class="tab-content active" id="tab-basic-info">
                            <!-- S.N (Auto) -->
                            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border-2 border-blue-300 shadow-sm mb-4">
                                <label class="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <i class="fas fa-hashtag text-blue-600"></i>الرقم التسلسلي (S.N)
                                </label>
                                <input type="text" id="serial-number" class="form-input bg-white text-gray-900 font-bold text-lg text-center" 
                                    value="${data?.serialNumber || ((AppState.appData.chemicalRegister?.length || 0) + 1)}" readonly style="color: #111827 !important; background-color: #ffffff !important;">
                                <p class="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                    <i class="fas fa-info-circle"></i>يتم توليده تلقائياً
                                </p>
                            </div>

                            <!-- RM Name -->
                            <div class="bg-gradient-to-br from-blue-50 to-white p-4 rounded-lg border-2 border-blue-200 shadow-sm mb-4">
                                <label class="block text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                                    <i class="fas fa-tag text-blue-600"></i>اسم المادة (RM Name) *
                                </label>
                                <input type="text" id="rm-name" required class="form-input bg-white text-gray-900 text-lg" 
                                    value="${Utils.escapeHTML(data?.rmName || '')}" 
                                    placeholder="أدخل اسم المادة الكيميائية" style="color: #111827 !important; background-color: #ffffff !important;">
                            </div>

                            <!-- Physical Shape -->
                            <div class="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-lg border-2 border-indigo-200 shadow-sm mb-4">
                                <label class="block text-sm font-bold text-indigo-800 mb-2 flex items-center gap-2">
                                    <i class="fas fa-shapes text-indigo-600"></i>الشكل الفيزيائي (Physical Shape) *
                                </label>
                                <select id="physical-shape" required class="form-input bg-white text-gray-900" style="color: #111827 !important; background-color: #ffffff !important;">
                                    <option value="" style="color: #6b7280;">اختر الشكل الفيزيائي</option>
                                    ${PHYSICAL_SHAPES.map(shape => `
                                        <option value="${shape}" ${data?.physicalShape === shape ? 'selected' : ''} style="color: #111827; background-color: #ffffff;">
                                            ${shape}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>

                            <!-- Purpose of Use (Custom Multi-Select Dropdown) -->
                            <div class="bg-gradient-to-br from-purple-50 to-white p-4 rounded-lg border-2 border-purple-200 shadow-sm mb-4">
                                <label class="block text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
                                    <i class="fas fa-list-check text-purple-600"></i>الغرض من الاستخدام (Purpose of Use) *
                                </label>
                                
                                <!-- Selected Tags Display -->
                                <div id="purpose-selected-tags" class="flex flex-wrap gap-2 mb-3 min-h-[40px] p-2 bg-gray-50 rounded-lg border border-gray-200">
                                    ${purposeArray.length > 0 ? purposeArray.map(purpose => `
                                        <span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold purpose-tag" data-value="${Utils.escapeHTML(purpose)}">
                                            ${Utils.escapeHTML(purpose)}
                                            <button type="button" onclick="ChemicalSafety.removePurposeTag('${Utils.escapeHTML(purpose)}')" 
                                                class="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors">
                                                <i class="fas fa-times text-xs"></i>
                                            </button>
                                        </span>
                                    `).join('') : '<span class="text-gray-400 text-sm">لم يتم اختيار أي غرض</span>'}
                                </div>
                                
                                <!-- Dropdown -->
                                <div class="relative">
                                    <button type="button" id="purpose-dropdown-btn" 
                                        class="w-full form-input text-right flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-gray-900" style="color: #111827 !important; background-color: #ffffff !important;">
                                        <span class="text-gray-500">اختر الغرض من الاستخدام</span>
                                        <i class="fas fa-chevron-down text-gray-400"></i>
                                    </button>
                                    <div id="purpose-dropdown-menu" 
                                        class="hse-lookup-dropdown hidden absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        ${PURPOSE_OF_USE_OPTIONS.map(purpose => `
                                            <label class="flex items-center gap-2 px-4 py-2 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0">
                                                <input type="checkbox" 
                                                    class="purpose-checkbox rounded border-gray-300 text-blue-600" 
                                                    value="${Utils.escapeHTML(purpose)}" 
                                                    ${purposeArray.includes(purpose) ? 'checked' : ''}
                                                    onchange="ChemicalSafety.togglePurposeOption('${Utils.escapeHTML(purpose)}', this.checked)">
                                                <span class="flex-1 text-sm text-gray-700">${Utils.escapeHTML(purpose)}</span>
                                            </label>
                                        `).join('')}
                                    </div>
                                </div>
                                
                                <input type="hidden" id="purpose-of-use" required 
                                    value="${purposeArray.map(p => Utils.escapeHTML(p)).join(',')}">
                                
                                <p class="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                    <i class="fas fa-info-circle text-blue-600"></i>
                                    يمكنك اختيار أكثر من غرض من القائمة المنسدلة
                                </p>
                            </div>

                            <!-- Method of Application & Department -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="bg-gradient-to-br from-teal-50 to-white p-4 rounded-lg border-2 border-teal-200 shadow-sm">
                                    <label class="block text-sm font-bold text-teal-800 mb-2 flex items-center gap-2">
                                        <i class="fas fa-tools text-teal-600"></i>طريقة التطبيق (Method of Application)
                                    </label>
                                    <input type="text" id="method-of-application" class="form-input bg-white text-gray-900" 
                                        value="${Utils.escapeHTML(data?.methodOfApplication || '')}" 
                                        placeholder="طريقة التطبيق" style="color: #111827 !important; background-color: #ffffff !important;">
                                </div>
                                <div class="bg-gradient-to-br from-cyan-50 to-white p-4 rounded-lg border-2 border-cyan-200 shadow-sm">
                                    <label class="block text-sm font-bold text-cyan-800 mb-2 flex items-center gap-2">
                                        <i class="fas fa-building text-cyan-600"></i>القسم (Department) *
                                    </label>
                                    <input type="text" id="department" required class="form-input bg-white text-gray-900" 
                                        value="${Utils.escapeHTML(data?.department || '')}" 
                                        placeholder="القسم" style="color: #111827 !important; background-color: #ffffff !important;">
                                </div>
                            </div>
                        </div>

                        <!-- Tab Content: الملفات والوثائق -->
                        <div class="tab-content" id="tab-documents">
                            <div class="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border-2 border-purple-200">
                                <label class="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    <i class="fas fa-file-pdf text-purple-600"></i>ملفات MSDS (Material Safety Data Sheet)
                                </label>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="bg-gradient-to-br from-purple-50 to-white p-4 rounded-lg border-2 border-purple-200">
                                        <label class="block text-sm font-bold text-purple-800 mb-2">
                                            <i class="fas fa-file-pdf text-red-500 ml-1"></i>MSDS (Arabic)
                                        </label>
                                        <input type="file" id="msds-arabic" accept=".pdf,.doc,.docx" class="form-input bg-white text-gray-900" style="color: #111827 !important; background-color: #ffffff !important;">
                                        ${data?.msdsArabic ? `
                                            <div class="mt-3 p-2 bg-green-50 rounded border border-green-200">
                                                <a href="${Utils.escapeHTML(data.msdsArabic)}" target="_blank" 
                                                   class="text-green-700 hover:text-green-900 flex items-center gap-2 font-semibold">
                                                    <i class="fas fa-check-circle"></i>
                                                    ملف موجود - اضغط للعرض
                                                </a>
                                            </div>
                                        ` : '<p class="text-xs text-gray-500 mt-2">لم يتم رفع ملف</p>'}
                                    </div>
                                    <div class="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-lg border-2 border-indigo-200">
                                        <label class="block text-sm font-bold text-indigo-800 mb-2">
                                            <i class="fas fa-file-pdf text-red-500 ml-1"></i>MSDS (English)
                                        </label>
                                        <input type="file" id="msds-english" accept=".pdf,.doc,.docx" class="form-input bg-white text-gray-900" style="color: #111827 !important; background-color: #ffffff !important;">
                                        ${data?.msdsEnglish ? `
                                            <div class="mt-3 p-2 bg-green-50 rounded border border-green-200">
                                                <a href="${Utils.escapeHTML(data.msdsEnglish)}" target="_blank" 
                                                   class="text-green-700 hover:text-green-900 flex items-center gap-2 font-semibold">
                                                    <i class="fas fa-check-circle"></i>
                                                    ملف موجود - اضغط للعرض
                                                </a>
                                            </div>
                                        ` : '<p class="text-xs text-gray-500 mt-2">لم يتم رفع ملف</p>'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Tab Content: معلومات الشركة المصنعة -->
                        <div class="tab-content" id="tab-manufacturer">
                            <div class="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-lg border-2 border-indigo-200">
                                <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <i class="fas fa-industry text-indigo-600"></i>
                                    معلومات الشركة المصنعة والوكيل
                                </h3>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-lg border-2 border-indigo-200">
                                        <label class="block text-sm font-bold text-indigo-800 mb-2 flex items-center gap-2">
                                            <i class="fas fa-globe text-indigo-600"></i>محلي / مستورد
                                        </label>
                                        <select id="local-import" class="form-input bg-white text-gray-900" style="color: #111827 !important; background-color: #ffffff !important;">
                                            <option value="" style="color: #6b7280;">اختر</option>
                                            ${LOCAL_IMPORT_OPTIONS.map(opt => `
                                                <option value="${opt}" ${data?.localImport === opt ? 'selected' : ''} style="color: #111827; background-color: #ffffff;">
                                                    ${opt}
                                                </option>
                                            `).join('')}
                                        </select>
                                    </div>
                                    <div class="bg-gradient-to-br from-blue-50 to-white p-4 rounded-lg border-2 border-blue-200">
                                        <label class="block text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                                            <i class="fas fa-industry text-blue-600"></i>الشركة المصنعة
                                        </label>
                                        <input type="text" id="manufacturer" class="form-input bg-white text-gray-900" 
                                            value="${Utils.escapeHTML(data?.manufacturer || '')}" 
                                            placeholder="اسم الشركة المصنعة" style="color: #111827 !important; background-color: #ffffff !important;">
                                    </div>
                                    <div class="bg-gradient-to-br from-violet-50 to-white p-4 rounded-lg border-2 border-violet-200 md:col-span-2">
                                        <label class="block text-sm font-bold text-violet-800 mb-2 flex items-center gap-2">
                                            <i class="fas fa-handshake text-violet-600"></i>الوكيل في مصر
                                        </label>
                                        <input type="text" id="agent-egypt" class="form-input bg-white text-gray-900" 
                                            value="${Utils.escapeHTML(data?.agentEgypt || '')}" 
                                            placeholder="اسم الوكيل في مصر" style="color: #111827 !important; background-color: #ffffff !important;">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Tab Content: معلومات الحاوية -->
                        <div class="tab-content" id="tab-container">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="bg-gradient-to-br from-green-50 to-white p-4 rounded-lg border-2 border-green-200 shadow-sm">
                                    <label class="block text-sm font-bold text-green-800 mb-2 flex items-center gap-2">
                                        <i class="fas fa-box text-green-600"></i>نوع الحاوية
                                    </label>
                                    <input type="text" id="container-type" class="form-input bg-white text-gray-900" 
                                        value="${Utils.escapeHTML(data?.containerType || '')}" 
                                        placeholder="نوع الحاوية" style="color: #111827 !important; background-color: #ffffff !important;">
                                </div>
                                <div class="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-lg border-2 border-emerald-200 shadow-sm">
                                    <label class="block text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
                                        <i class="fas fa-recycle text-emerald-600"></i>طريقة التخلص
                                    </label>
                                    <input type="text" id="container-disposal" class="form-input bg-white text-gray-900" 
                                        value="${Utils.escapeHTML(data?.containerDisposalMethod || '')}" 
                                        placeholder="طريقة التخلص من الحاوية" style="color: #111827 !important; background-color: #ffffff !important;">
                                </div>
                            </div>
                        </div>

                        <!-- Tab Content: معلومات الخطورة -->
                        <div class="tab-content" id="tab-hazards">
                            <!-- Header Section -->
                            <div class="mb-6 flex items-center justify-end gap-3">
                                <h3 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <i class="fas fa-skull text-red-600 text-2xl"></i>
                                    معلومات الخطورة
                                </h3>
                            </div>

                            <!-- Main Content: NFPA Values (Left) and Diamond (Right) -->
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                <!-- Left Side: NFPA Hazard Values -->
                                <div class="bg-white p-6 rounded-lg border-2 border-gray-200 shadow-sm">
                                    <h4 class="text-lg font-bold text-gray-800 mb-4 text-right">قيم الخطورة NFPA</h4>
                                    
                                    <!-- Health Dropdown -->
                                    <div class="mb-4">
                                        <label class="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2 justify-end">
                                            <i class="fas fa-heartbeat text-blue-600"></i>
                                            الصحة (Health)
                                        </label>
                                        <div class="relative">
                                            <select id="nfpa-health-dropdown" 
                                                class="form-input bg-white text-gray-900 w-full pr-10 pl-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                                onchange="ChemicalSafety.updateNFPADiamondFromDropdown()"
                                                style="color: #111827 !important; background-color: #ffffff !important;">
                                                <option value="0" ${(data?.nfpaDiamond?.health || 0) === 0 ? 'selected' : ''}>Normal Material - 0</option>
                                                <option value="1" ${(data?.nfpaDiamond?.health || 0) === 1 ? 'selected' : ''}>Slightly Hazardous - 1</option>
                                                <option value="2" ${(data?.nfpaDiamond?.health || 0) === 2 ? 'selected' : ''}>Hazardous - 2</option>
                                                <option value="3" ${(data?.nfpaDiamond?.health || 0) === 3 ? 'selected' : ''}>Extreme Danger - 3</option>
                                                <option value="4" ${(data?.nfpaDiamond?.health || 0) === 4 ? 'selected' : ''}>Deadly - 4</option>
                                            </select>
                                            <i class="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                                        </div>
                                    </div>

                                    <!-- Fire Dropdown -->
                                    <div class="mb-4">
                                        <label class="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2 justify-end">
                                            <i class="fas fa-fire text-red-600"></i>
                                            الاشتعال (Fire)
                                        </label>
                                        <div class="relative">
                                            <select id="nfpa-fire-dropdown" 
                                                class="form-input bg-white text-gray-900 w-full pr-10 pl-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200"
                                                onchange="ChemicalSafety.updateNFPADiamondFromDropdown()"
                                                style="color: #111827 !important; background-color: #ffffff !important;">
                                                <option value="0" ${(data?.nfpaDiamond?.flammability || 0) === 0 ? 'selected' : ''}>Will Not Burn - 0</option>
                                                <option value="1" ${(data?.nfpaDiamond?.flammability || 0) === 1 ? 'selected' : ''}>Above 200°F - 1</option>
                                                <option value="2" ${(data?.nfpaDiamond?.flammability || 0) === 2 ? 'selected' : ''}>Below 200°F - 2</option>
                                                <option value="3" ${(data?.nfpaDiamond?.flammability || 0) === 3 ? 'selected' : ''}>Below 100°F - 3</option>
                                                <option value="4" ${(data?.nfpaDiamond?.flammability || 0) === 4 ? 'selected' : ''}>Below 73°F - 4</option>
                                            </select>
                                            <i class="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                                        </div>
                                    </div>

                                    <!-- Reactivity Dropdown -->
                                    <div class="mb-4">
                                        <label class="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2 justify-end">
                                            <i class="fas fa-cog text-yellow-600"></i>
                                            التفاعلية (Reactivity)
                                        </label>
                                        <div class="relative">
                                            <select id="nfpa-reactivity-dropdown" 
                                                class="form-input bg-white text-gray-900 w-full pr-10 pl-3 py-2 border-2 border-gray-300 rounded-lg focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200"
                                                onchange="ChemicalSafety.updateNFPADiamondFromDropdown()"
                                                style="color: #111827 !important; background-color: #ffffff !important;">
                                                <option value="0" ${(data?.nfpaDiamond?.instability || 0) === 0 ? 'selected' : ''}>Stable - 0</option>
                                                <option value="1" ${(data?.nfpaDiamond?.instability || 0) === 1 ? 'selected' : ''}>Unstable if Heated - 1</option>
                                                <option value="2" ${(data?.nfpaDiamond?.instability || 0) === 2 ? 'selected' : ''}>Violent Chemical Change - 2</option>
                                                <option value="3" ${(data?.nfpaDiamond?.instability || 0) === 3 ? 'selected' : ''}>Shock and Heat May Detonate - 3</option>
                                                <option value="4" ${(data?.nfpaDiamond?.instability || 0) === 4 ? 'selected' : ''}>May Detonate - 4</option>
                                            </select>
                                            <i class="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                                        </div>
                                    </div>

                                    <!-- Special Dropdown -->
                                    <div class="mb-4">
                                        <label class="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2 justify-end">
                                            <i class="fas fa-exclamation-circle text-gray-700"></i>
                                            خاص (Special)
                                        </label>
                                        <div class="relative">
                                            <select id="nfpa-special-dropdown" 
                                                class="form-input bg-white text-gray-900 w-full pr-10 pl-3 py-2 border-2 border-gray-300 rounded-lg focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                                                onchange="ChemicalSafety.updateNFPADiamondFromDropdown()"
                                                style="color: #111827 !important; background-color: #ffffff !important;">
                                                <option value="">لا يوجد - None</option>
                                                <option value="W" ${(data?.nfpaDiamond?.special || '').toUpperCase() === 'W' ? 'selected' : ''}>W - Use No Water</option>
                                                <option value="OX" ${(data?.nfpaDiamond?.special || '').toUpperCase() === 'OX' ? 'selected' : ''}>OX - Oxidizer</option>
                                                <option value="ACID" ${(data?.nfpaDiamond?.special || '').toUpperCase() === 'ACID' ? 'selected' : ''}>ACID - Acid</option>
                                                <option value="ALK" ${(data?.nfpaDiamond?.special || '').toUpperCase() === 'ALK' ? 'selected' : ''}>ALK - Alkali</option>
                                                <option value="COR" ${(data?.nfpaDiamond?.special || '').toUpperCase() === 'COR' ? 'selected' : ''}>COR - Corrosive</option>
                                            </select>
                                            <i class="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                                        </div>
                                    </div>
                                </div>

                                <!-- Right Side: NFPA Diamond -->
                                <div class="bg-white p-6 rounded-lg border-2 border-gray-200 shadow-sm">
                                    <h4 class="text-lg font-bold text-gray-800 mb-6 text-center">مربع الخطورة (NFPA Diamond)</h4>
                                    <div id="nfpa-diamond-container" class="w-full py-4">
                                        ${this.renderNFPADiamond(data?.nfpaDiamond || {}, 'compact')}
                                    </div>
                                </div>
                            </div>

                            <!-- Hazard Classification Section -->
                            <div class="mb-6">
                                <div class="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm">
                                    <label class="block text-sm font-bold text-gray-800 mb-2 text-right">
                                        تصنيف الخطورة (Class)
                                    </label>
                                    <input type="text" id="hazard-class" class="form-input bg-white text-gray-900 w-full" 
                                        value="${Utils.escapeHTML(data?.hazardClass || '')}" 
                                        placeholder="مثال: Class 3 - Flammable" 
                                        style="color: #111827 !important; background-color: #ffffff !important;">
                                </div>
                            </div>

                            <!-- Hazard Description Section -->
                            <div class="mb-6">
                                <div class="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm">
                                    <label class="block text-sm font-bold text-gray-800 mb-2 text-right">
                                        وصف الخطورة
                                    </label>
                                    <textarea id="hazard-description" class="form-input bg-white text-gray-900 w-full" rows="5" 
                                        placeholder="وصف تفصيلي للمخاطر المرتبطة بالمادة" 
                                        style="color: #111827 !important; background-color: #ffffff !important;">${Utils.escapeHTML(data?.hazardDescription || '')}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Tab Content: تعليمات السلامة SDS -->
                        <div class="tab-content" id="tab-sds">
                            <div class="bg-gradient-to-r from-gray-50 to-slate-50 p-4 rounded-lg border-2 border-gray-200 shadow-sm mb-6">
                                <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 justify-end">
                                    <i class="fas fa-file-alt text-gray-700"></i>
                                    تعليمات السلامة للمواد الكيميائية (SDS)
                                </h3>

                                <!-- Header Fields -->
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div class="bg-white p-4 rounded-lg border border-gray-200">
                                        <label class="block text-sm font-bold text-gray-700 mb-2">اسم الشركة والفرع</label>
                                        <input type="text" id="sds-company-branch" class="form-input bg-white text-gray-900"
                                            value="${Utils.escapeHTML(sdsData?.companyBranch || '')}"
                                            placeholder="اسم الشركة - الفرع" style="color: #111827 !important; background-color: #ffffff !important;">
                                    </div>
                                    <div class="bg-white p-4 rounded-lg border border-gray-200">
                                        <label class="block text-sm font-bold text-gray-700 mb-2">حالة الترجمة</label>
                                        <input type="text" id="sds-translation-status" class="form-input bg-white text-gray-900"
                                            value="${Utils.escapeHTML(sdsData?.translationStatus || 'غير مترجم')}"
                                            placeholder="مثال: غير مترجم" style="color: #111827 !important; background-color: #ffffff !important;">
                                    </div>
                                    <div class="bg-white p-4 rounded-lg border border-gray-200">
                                        <label class="block text-sm font-bold text-gray-700 mb-2">الاسم العلمي للمادة</label>
                                        <input type="text" id="sds-scientific-name" class="form-input bg-white text-gray-900"
                                            value="${Utils.escapeHTML(sdsData?.scientificName || data?.rmName || '')}"
                                            placeholder="الاسم العلمي" style="color: #111827 !important; background-color: #ffffff !important;">
                                    </div>
                                    <div class="bg-white p-4 rounded-lg border border-gray-200">
                                        <label class="block text-sm font-bold text-gray-700 mb-2">الاسم التجاري للمادة</label>
                                        <input type="text" id="sds-trade-name" class="form-input bg-white text-gray-900"
                                            value="${Utils.escapeHTML(sdsData?.tradeName || data?.rmName || '')}"
                                            placeholder="الاسم التجاري" style="color: #111827 !important; background-color: #ffffff !important;">
                                    </div>
                                </div>

                                <!-- GHS Pictograms -->
                                <div class="bg-white p-4 rounded-lg border border-gray-200 mb-4">
                                    <label class="block text-sm font-bold text-gray-700 mb-3">مخاطر المادة الكيميائية (GHS)</label>
                                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        ${GHS_PICTOGRAMS.map(p => `
                                            <label class="flex flex-col items-center gap-2 p-3 rounded-lg border-2 ${sdsPictograms.includes(p.key) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'} cursor-pointer hover:border-blue-300 transition-colors">
                                                <input type="checkbox" class="sds-ghs-checkbox" value="${Utils.escapeHTML(p.key)}" ${sdsPictograms.includes(p.key) ? 'checked' : ''}>
                                                <div class="bg-white rounded-lg p-2 border border-gray-200">${p.svg}</div>
                                                <div class="text-xs font-semibold text-gray-700 text-center">${Utils.escapeHTML(p.labelAr)}</div>
                                            </label>
                                        `).join('')}
                                    </div>
                                    <p class="text-xs text-gray-500 mt-2">اختر العلامات المناسبة لتظهر تلقائيًا في نموذج الطباعة.</p>
                                </div>

                                <!-- SDS Instructions -->
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="bg-white p-4 rounded-lg border border-gray-200">
                                        <label class="block text-sm font-bold text-gray-700 mb-2">الإسعافات الأولية</label>
                                        <textarea id="sds-first-aid" class="form-input bg-white text-gray-900 w-full" rows="4"
                                            placeholder="اكتب تعليمات الإسعافات الأولية..." style="color: #111827 !important; background-color: #ffffff !important;">${Utils.escapeHTML(sdsInstructions?.firstAid || '')}</textarea>
                                    </div>
                                    <div class="bg-white p-4 rounded-lg border border-gray-200">
                                        <label class="block text-sm font-bold text-gray-700 mb-2">الوسيلة الإطفائية</label>
                                        <textarea id="sds-fire-fighting" class="form-input bg-white text-gray-900 w-full" rows="4"
                                            placeholder="اكتب تعليمات مكافحة الحريق..." style="color: #111827 !important; background-color: #ffffff !important;">${Utils.escapeHTML(sdsInstructions?.fireFighting || '')}</textarea>
                                    </div>
                                    <div class="bg-white p-4 rounded-lg border border-gray-200">
                                        <label class="block text-sm font-bold text-gray-700 mb-2">في حالة الانسكابات</label>
                                        <textarea id="sds-spill-response" class="form-input bg-white text-gray-900 w-full" rows="4"
                                            placeholder="اكتب تعليمات التعامل مع الانسكابات..." style="color: #111827 !important; background-color: #ffffff !important;">${Utils.escapeHTML(sdsInstructions?.spillResponse || '')}</textarea>
                                    </div>
                                    <div class="bg-white p-4 rounded-lg border border-gray-200">
                                        <label class="block text-sm font-bold text-gray-700 mb-2">التداول والتخزين</label>
                                        <textarea id="sds-handling-storage" class="form-input bg-white text-gray-900 w-full" rows="4"
                                            placeholder="اكتب تعليمات التداول والتخزين..." style="color: #111827 !important; background-color: #ffffff !important;">${Utils.escapeHTML(sdsInstructions?.handlingStorage || '')}</textarea>
                                    </div>
                                    <div class="bg-white p-4 rounded-lg border border-gray-200 md:col-span-2">
                                        <label class="block text-sm font-bold text-gray-700 mb-2">مهمات الوقاية الشخصية</label>
                                        <textarea id="sds-ppe" class="form-input bg-white text-gray-900 w-full" rows="4"
                                            placeholder="اكتب مهمات الوقاية الشخصية المطلوبة..." style="color: #111827 !important; background-color: #ffffff !important;">${Utils.escapeHTML(sdsInstructions?.ppe || '')}</textarea>
                                    </div>
                                    <div class="bg-white p-4 rounded-lg border border-gray-200">
                                        <label class="block text-sm font-bold text-gray-700 mb-2">الخواص الكيميائية</label>
                                        <textarea id="sds-chemical-properties" class="form-input bg-white text-gray-900 w-full" rows="4"
                                            placeholder="اكتب الخواص الكيميائية..." style="color: #111827 !important; background-color: #ffffff !important;">${Utils.escapeHTML(sdsInstructions?.chemicalProperties || '')}</textarea>
                                    </div>
                                    <div class="bg-white p-4 rounded-lg border border-gray-200">
                                        <label class="block text-sm font-bold text-gray-700 mb-2">الخواص الفيزيائية</label>
                                        <textarea id="sds-physical-properties" class="form-input bg-white text-gray-900 w-full" rows="4"
                                            placeholder="اكتب الخواص الفيزيائية..." style="color: #111827 !important; background-color: #ffffff !important;">${Utils.escapeHTML(sdsInstructions?.physicalProperties || '')}</textarea>
                                    </div>
                                    <div class="bg-white p-4 rounded-lg border border-gray-200 md:col-span-2">
                                        <label class="block text-sm font-bold text-gray-700 mb-2">متطلبات أخرى</label>
                                        <textarea id="sds-other-requirements" class="form-input bg-white text-gray-900 w-full" rows="3"
                                            placeholder="أي متطلبات إضافية..." style="color: #111827 !important; background-color: #ffffff !important;">${Utils.escapeHTML(sdsInstructions?.otherRequirements || '')}</textarea>
                                    </div>
                                </div>

                                <!-- Approval -->
                                <div class="mt-6 bg-white p-4 rounded-lg border border-gray-200">
                                    <h4 class="text-sm font-bold text-gray-800 mb-3">الاعتماد</h4>
                                    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div>
                                            <label class="block text-xs font-semibold text-gray-600 mb-1">الوظيفة</label>
                                            <input type="text" id="sds-approval-job" class="form-input bg-white text-gray-900"
                                                value="${Utils.escapeHTML(sdsApproval?.jobTitle || '')}" placeholder="الوظيفة"
                                                style="color: #111827 !important; background-color: #ffffff !important;">
                                        </div>
                                        <div>
                                            <label class="block text-xs font-semibold text-gray-600 mb-1">الاسم</label>
                                            <input type="text" id="sds-approval-name" class="form-input bg-white text-gray-900"
                                                value="${Utils.escapeHTML(sdsApproval?.name || '')}" placeholder="الاسم"
                                                style="color: #111827 !important; background-color: #ffffff !important;">
                                        </div>
                                        <div>
                                            <label class="block text-xs font-semibold text-gray-600 mb-1">التوقيع</label>
                                            <input type="text" id="sds-approval-signature" class="form-input bg-white text-gray-900"
                                                value="${Utils.escapeHTML(sdsApproval?.signature || '')}" placeholder="التوقيع"
                                                style="color: #111827 !important; background-color: #ffffff !important;">
                                        </div>
                                        <div>
                                            <label class="block text-xs font-semibold text-gray-600 mb-1">التاريخ</label>
                                            <input type="date" id="sds-approval-date" class="form-input bg-white text-gray-900"
                                                value="${Utils.escapeHTML(sdsApproval?.date || '')}"
                                                style="color: #111827 !important; background-color: #ffffff !important;">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Tab Content: الموقع والكمية -->
                        <div class="tab-content" id="tab-location">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="bg-gradient-to-br from-sky-50 to-white p-4 rounded-lg border-2 border-sky-200 shadow-sm">
                                    <label class="block text-sm font-bold text-sky-800 mb-2 flex items-center gap-2">
                                        <i class="fas fa-map-marker-alt text-sky-600"></i>الموقع / المخزن *
                                    </label>
                                    <input type="text" id="location-store" class="form-input bg-white text-gray-900" 
                                        value="${Utils.escapeHTML(data?.locationStore || '')}" 
                                        placeholder="الموقع أو المخزن" style="color: #111827 !important; background-color: #ffffff !important;">
                                </div>
                                <div class="bg-gradient-to-br from-blue-50 to-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                    <label class="block text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                                        <i class="fas fa-calculator text-blue-600"></i>الكمية / السنة
                                    </label>
                                    <input type="text" id="qty-year" class="form-input bg-white text-gray-900" 
                                        value="${Utils.escapeHTML(data?.qtyYear || '')}" 
                                        placeholder="الكمية المستخدمة سنوياً" style="color: #111827 !important; background-color: #ffffff !important;">
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer bg-gray-50 border-t border-gray-200 p-4 flex justify-center gap-3">
                    <button type="button" id="prev-tab-btn" class="btn-warning px-5 py-2" disabled>
                        <i class="fas fa-arrow-right ml-2"></i>السابق
                    </button>
                    <button type="button" class="btn-danger px-5 py-2" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times ml-2"></i>إلغاء
                    </button>
                    <button type="button" id="next-tab-btn" class="btn-info px-5 py-2">
                        <i class="fas fa-arrow-left ml-2"></i>التالي
                    </button>
                    <button type="button" id="save-chemical-btn" class="btn-primary text-lg px-6 py-3">
                        <i class="fas fa-save ml-2"></i>حفظ المادة
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // إعداد مستمعي الأحداث
        const saveBtn = modal.querySelector('#save-chemical-btn');
        saveBtn.addEventListener('click', () => this.handleSubmit(modal));

        // إعداد رفع الملفات
        const msdsArabicInput = modal.querySelector('#msds-arabic');
        const msdsEnglishInput = modal.querySelector('#msds-english');
        
        if (msdsArabicInput) {
            msdsArabicInput.addEventListener('change', (e) => {
                this.msdsFiles.arabic = e.target.files[0];
            });
        }
        if (msdsEnglishInput) {
            msdsEnglishInput.addEventListener('change', (e) => {
                this.msdsFiles.english = e.target.files[0];
            });
        }

        // إعداد dropdown للغرض من الاستخدام
        const dropdownBtn = modal.querySelector('#purpose-dropdown-btn');
        const dropdownMenu = modal.querySelector('#purpose-dropdown-menu');
        
        if (dropdownBtn && dropdownMenu) {
            dropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownMenu.classList.toggle('hidden');
                const icon = dropdownBtn.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-chevron-down');
                    icon.classList.toggle('fa-chevron-up');
                }
            });

            // إغلاق عند النقر خارج القائمة
            document.addEventListener('click', function closeDropdown(e) {
                if (!dropdownMenu.contains(e.target) && !dropdownBtn.contains(e.target)) {
                    dropdownMenu.classList.add('hidden');
                    const icon = dropdownBtn.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-chevron-up');
                        icon.classList.add('fa-chevron-down');
                    }
                }
            });
        }

        // إعداد التبويبات
        const tabButtons = modal.querySelectorAll('.tab-btn');
        const tabContents = modal.querySelectorAll('.tab-content');
        const prevBtn = modal.querySelector('#prev-tab-btn');
        const nextBtn = modal.querySelector('#next-tab-btn');

        // قائمة بالتبويبات بالترتيب
        const tabOrder = ['basic-info', 'documents', 'manufacturer', 'container', 'hazards', 'location', 'sds'];

        const updateTabButtons = () => {
            const activeTab = modal.querySelector('.tab-btn.active');
            if (!activeTab) return;

            const currentIndex = tabOrder.indexOf(activeTab.getAttribute('data-tab'));
            prevBtn.disabled = currentIndex === 0;
            nextBtn.disabled = currentIndex === tabOrder.length - 1;
        };

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');

                // إزالة active من جميع الأزرار والمحتويات
                tabButtons.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                // إضافة active للزر والمحتوى المحدد
                btn.classList.add('active');
                const targetContent = modal.querySelector(`#tab-${targetTab}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                // تحديث أزرار التنقل
                updateTabButtons();
            });
        });

        // إعداد أزرار التنقل السابق والتالي
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                const activeTab = modal.querySelector('.tab-btn.active');
                if (!activeTab) return;

                const currentIndex = tabOrder.indexOf(activeTab.getAttribute('data-tab'));
                if (currentIndex > 0) {
                    const prevTab = tabOrder[currentIndex - 1];
                    const prevTabBtn = modal.querySelector(`[data-tab="${prevTab}"]`);
                    if (prevTabBtn) {
                        prevTabBtn.click();
                    }
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const activeTab = modal.querySelector('.tab-btn.active');
                if (!activeTab) return;

                const currentIndex = tabOrder.indexOf(activeTab.getAttribute('data-tab'));
                if (currentIndex < tabOrder.length - 1) {
                    const nextTab = tabOrder[currentIndex + 1];
                    const nextTabBtn = modal.querySelector(`[data-tab="${nextTab}"]`);
                    if (nextTabBtn) {
                        nextTabBtn.click();
                    }
                }
            });
        }

        // تحديث أزرار التنقل في البداية
        updateTabButtons();

        // إعداد الانتقال التلقائي للتبويب التالي عند إدخال البيانات في التبويب الأول
        const setupAutoTabTransition = () => {
            const requiredFields = [
                'rm-name', // اسم المادة
                'physical-shape', // الشكل الفيزيائي
                'purpose-of-use', // الغرض من الاستخدام
                'department' // القسم
            ];

            let hasTransitioned = false; // علامة لمنع الانتقال المتكرر

            const checkAllFields = () => {
                // تحقق فقط إذا كان التبويب الحالي هو المعلومات الأساسية
                const activeTab = modal.querySelector('.tab-btn.active');
                if (!activeTab || activeTab.getAttribute('data-tab') !== 'basic-info') {
                    return;
                }

                // إعادة حساب جميع الحقول المملوءة
                let filledCount = 0;
                requiredFields.forEach(fieldId => {
                    const field = modal.querySelector(`#${fieldId}`);
                    if (field) {
                        let isFilled = false;
                        if (field.tagName === 'SELECT') {
                            isFilled = field.value && field.value !== '';
                        } else if (field.type === 'hidden') {
                            isFilled = field.value && field.value.trim() !== '';
                        } else {
                            isFilled = field.value && field.value.trim() !== '';
                        }
                        if (isFilled) filledCount++;
                    }
                });

                // إذا تم ملء جميع الحقول المطلوبة ولم ينتقل بعد، انتقل للتبويب التالي
                if (filledCount === requiredFields.length && !hasTransitioned) {
                    hasTransitioned = true;
                    setTimeout(() => {
                        if (nextBtn && !nextBtn.disabled) {
                            nextBtn.click();
                        }
                    }, 500); // تأخير بسيط لإظهار التأثير
                }
            };

            // إضافة مستمعي الأحداث لجميع الحقول المطلوبة
            requiredFields.forEach(fieldId => {
                const field = modal.querySelector(`#${fieldId}`);
                if (field) {
                    field.addEventListener('input', checkAllFields);
                    field.addEventListener('change', checkAllFields);
                }
            });

            // إعادة تعيين العلامة عند الرجوع للتبويب الأول
            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.getAttribute('data-tab') === 'basic-info') {
                        hasTransitioned = false;
                    }
                });
            });
        };

        // تشغيل إعداد الانتقال التلقائي
        setupAutoTabTransition();

        // ربط تبويب SDS تلقائياً ببيانات التبويبات الأخرى (عند إضافة مادة جديدة فقط)
        // ملاحظة: المزامنة أحادية الاتجاه (من التبويبات الأخرى -> SDS)،
        // وأي تعديل يدوي في حقل داخل SDS يوقف المزامنة لهذا الحقل فقط.
        const setupSdsSmartAutofill = () => {
            // فقط عند إضافة مادة جديدة (data == null)
            if (this.currentEditId) return;

            const getEl = (id) => modal.querySelector(`#${id}`);
            const getVal = (id) => (getEl(id)?.value || '').trim();

            const sdsCompanyBranchEl = getEl('sds-company-branch');
            const sdsScientificNameEl = getEl('sds-scientific-name');
            const sdsTradeNameEl = getEl('sds-trade-name');
            const sdsChemicalPropsEl = getEl('sds-chemical-properties');
            const sdsPhysicalPropsEl = getEl('sds-physical-properties');
            const sdsOtherReqEl = getEl('sds-other-requirements');

            const sdsTargets = [
                sdsCompanyBranchEl,
                sdsScientificNameEl,
                sdsTradeNameEl,
                sdsChemicalPropsEl,
                sdsPhysicalPropsEl,
                sdsOtherReqEl
            ].filter(Boolean);

            const markUserEdited = (el) => {
                if (!el) return;
                el.dataset.sdsUserEdited = '1';
            };

            // إذا المستخدم كتب داخل أي حقل SDS => أوقف المزامنة لهذا الحقل
            sdsTargets.forEach(el => {
                el.addEventListener('input', () => markUserEdited(el));
                el.addEventListener('change', () => markUserEdited(el));
            });

            const syncIfNotEdited = (el, value) => {
                if (!el) return;
                if (el.dataset.sdsUserEdited === '1') return; // لا نغيّر لو المستخدم عدّل
                const nextVal = (value || '').trim();
                if (el.value !== nextVal) {
                    el.value = nextVal;
                    el.dataset.sdsAutofilled = '1';
                    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
                }
            };

            const buildCompanyBranch = () => {
                const companyName = (AppState?.companySettings?.name || AppState?.companyName || '').trim();
                const department = getVal('department');
                if (companyName && department) return `${companyName} - ${department}`;
                if (companyName) return companyName;
                return department;
            };

            const buildChemicalProps = () => {
                const hazardClass = getVal('hazard-class');
                const hazardDesc = getVal('hazard-description');
                const parts = [];
                if (hazardClass) parts.push(`تصنيف الخطورة: ${hazardClass}`);
                if (hazardDesc) parts.push(`وصف الخطورة: ${hazardDesc}`);
                return parts.join('\n');
            };

            const buildPhysicalProps = () => {
                const shape = getVal('physical-shape');
                const qtyYear = getVal('qty-year');
                const location = getVal('location-store');
                const parts = [];
                if (shape) parts.push(`الشكل الفيزيائي: ${shape}`);
                if (location) parts.push(`موقع التخزين: ${location}`);
                if (qtyYear) parts.push(`الكمية المستخدمة سنوياً: ${qtyYear}`);
                return parts.join('\n');
            };

            const buildOtherReq = () => {
                const localImport = getVal('local-import');
                const manufacturer = getVal('manufacturer');
                const agentEgypt = getVal('agent-egypt');

                const h = (modal.querySelector('#nfpa-health-dropdown')?.value || '').trim();
                const f = (modal.querySelector('#nfpa-fire-dropdown')?.value || '').trim();
                const r = (modal.querySelector('#nfpa-reactivity-dropdown')?.value || '').trim();
                const s = (modal.querySelector('#nfpa-special-dropdown')?.value || '').trim();
                const nfpa = [h || '0', f || '0', r || '0', s || ''].join('-');

                const parts = [];
                if (localImport) parts.push(`محلي/مستورد: ${localImport}`);
                if (manufacturer) parts.push(`الشركة المصنعة: ${manufacturer}`);
                if (agentEgypt) parts.push(`الوكيل في مصر: ${agentEgypt}`);
                parts.push(`NFPA: ${nfpa}`);
                return parts.filter(Boolean).join('\n');
            };

            const applySync = () => {
                const rmName = getVal('rm-name');

                // أسماء المادة
                syncIfNotEdited(sdsScientificNameEl, rmName);
                syncIfNotEdited(sdsTradeNameEl, rmName);

                // الشركة/الفرع
                syncIfNotEdited(sdsCompanyBranchEl, buildCompanyBranch());

                // خصائص/معلومات مشتقة
                syncIfNotEdited(sdsChemicalPropsEl, buildChemicalProps());
                syncIfNotEdited(sdsPhysicalPropsEl, buildPhysicalProps());
                syncIfNotEdited(sdsOtherReqEl, buildOtherReq());
            };

            // ربط التغييرات من التبويبات الأخرى
            const sourceIds = [
                'rm-name',
                'department',
                'local-import',
                'manufacturer',
                'agent-egypt',
                'hazard-class',
                'hazard-description',
                'physical-shape',
                'location-store',
                'qty-year'
            ];
            sourceIds.forEach(id => {
                const el = getEl(id);
                if (!el) return;
                el.addEventListener('input', applySync);
                el.addEventListener('change', applySync);
            });

            // NFPA dropdowns
            ['nfpa-health-dropdown', 'nfpa-fire-dropdown', 'nfpa-reactivity-dropdown', 'nfpa-special-dropdown'].forEach(id => {
                const el = getEl(id);
                if (!el) return;
                el.addEventListener('change', applySync);
            });

            // تطبيق أولي
            applySync();
        };

        setupSdsSmartAutofill();

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    /**
     * إضافة/إزالة خيار من الغرض من الاستخدام
     */
    togglePurposeOption(value, checked) {
        const tagsContainer = document.getElementById('purpose-selected-tags');
        const hiddenInput = document.getElementById('purpose-of-use');
        
        if (!tagsContainer || !hiddenInput) return;

        if (checked) {
            // إضافة tag
            const tag = document.createElement('span');
            tag.className = 'inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold purpose-tag';
            tag.setAttribute('data-value', value);
            tag.innerHTML = `
                ${Utils.escapeHTML(value)}
                <button type="button" onclick="ChemicalSafety.removePurposeTag('${Utils.escapeHTML(value)}')" 
                    class="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors">
                    <i class="fas fa-times text-xs"></i>
                </button>
            `;
            tagsContainer.innerHTML = tagsContainer.innerHTML.replace('<span class="text-gray-400 text-sm">لم يتم اختيار أي غرض</span>', '');
            tagsContainer.appendChild(tag);
        } else {
            // إزالة tag
            const tag = tagsContainer.querySelector(`[data-value="${Utils.escapeHTML(value)}"]`);
            if (tag) tag.remove();
            
            // إلغاء تحديد checkbox
            const checkbox = document.querySelector(`.purpose-checkbox[value="${Utils.escapeHTML(value)}"]`);
            if (checkbox) checkbox.checked = false;
        }

        // تحديث hidden input
        const selectedTags = Array.from(tagsContainer.querySelectorAll('.purpose-tag')).map(tag => tag.getAttribute('data-value'));
        hiddenInput.value = selectedTags.join(',');
        
        // التحقق من الحقل المطلوب
        if (selectedTags.length === 0) {
            tagsContainer.innerHTML = '<span class="text-gray-400 text-sm">لم يتم اختيار أي غرض</span>';
            hiddenInput.setCustomValidity('يرجى اختيار غرض واحد على الأقل');
        } else {
            hiddenInput.setCustomValidity('');
        }

        // إطلاق حدث change للحقل المخفي حتى تعمل ميزات مثل الانتقال التلقائي للتبويب التالي
        try {
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
            // قد تفشل في بعض البيئات القديمة، تجاهل
        }
    },

    /**
     * إزالة tag من الغرض من الاستخدام
     */
    removePurposeTag(value) {
        const checkbox = document.querySelector(`.purpose-checkbox[value="${Utils.escapeHTML(value)}"]`);
        if (checkbox) {
            checkbox.checked = false;
            this.togglePurposeOption(value, false);
        }
    },

    /**
     * رسم مربع NFPA Diamond بشكل احترافي مطابق للصورة
     */
    renderNFPADiamond(nfpa, size = 'normal') {
        const health = nfpa.health || 0;
        const flammability = nfpa.flammability || 0;
        const instability = nfpa.instability || 0;
        const special = String(nfpa.special || '').trim().toUpperCase();
        
        // تحديد الحجم بناءً على المعامل والبيانات
        const isCompact = size === 'compact';
        const hasData = health > 0 || flammability > 0 || instability > 0 || special;
        
        // أحجام محسّنة ليطابق الصورة بدقة - مطابقة للصورة المرفقة
        const diamondSize = isCompact ? 280 : 320;
        const fontSize = isCompact ? 56 : 64;
        const getSpecialFontSize = (value) => {
            const v = String(value || '');
            const len = v.length;
            if (len <= 1) return isCompact ? 32 : 36;
            if (len === 2) return isCompact ? 28 : 32;
            if (len === 3) return isCompact ? 24 : 28;
            if (len === 4) return isCompact ? 20 : 24;
            return isCompact ? 18 : 20;
        };
        const specialFontSize = getSpecialFontSize(special);
        const specialDisplay = Utils.escapeHTML(special);
        const strokeWidth = isCompact ? 4 : 5; // إطار رفيع كما في الصورة
        const wrapperPadding = isCompact ? '0' : '30px';
        const wrapperGap = isCompact ? '0' : '30px';
        const showInfoGrid = !isCompact;

        // الألوان الثابتة والواضحة حسب NFPA 704 - مطابقة للصورة المرفقة
        const getColor = (value, type) => {
            // الألوان الثابتة حسب النوع - مطابقة للصورة بدقة
            if (type === 'health') {
                // Health - أزرق واضح ومشرق
                return '#0066CC';
            }
            if (type === 'flammability') {
                // Fire - أحمر واضح ومشرق
                return '#FF0000';
            }
            if (type === 'instability') {
                // Instability - أصفر واضح ومشرق
                return '#FFCC00';
            }
            // Special - رمادي فاتح (كما في الصورة)
            return '#F5F5F5';
        };

        // لون النص - جميع الأرقام بيضاء على الألوان الملونة (مطابق للصورة المرفقة)
        const getTextColor = (value, type) => {
            // الأرقام بيضاء على الأحمر والأزرق والأصفر
            if (type === 'health' || type === 'flammability' || type === 'instability') {
                return '#FFFFFF';
            }
            // النص أسود على الأبيض
            return '#000000';
        };

        // التفسيرات حسب NFPA
        const getHealthDescription = (value) => {
            const descriptions = {
                0: 'Normal Material',
                1: 'Slightly Hazardous',
                2: 'Hazardous',
                3: 'Extreme Danger',
                4: 'Deadly'
            };
            return descriptions[value] || '';
        };

        const getFlammabilityDescription = (value) => {
            const descriptions = {
                0: 'Will Not Burn',
                1: 'Above 200°F',
                2: 'Below 200°F',
                3: 'Below 100°F',
                4: 'Below 73°F'
            };
            return descriptions[value] || '';
        };

        const getInstabilityDescription = (value) => {
            const descriptions = {
                0: 'Stable',
                1: 'Unstable if Heated',
                2: 'Violent Chemical Change',
                3: 'Shock and Heat May Detonate',
                4: 'May Detonate'
            };
            return descriptions[value] || '';
        };

        return `
            <style>
                .nfpa-diamond-wrapper {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: ${wrapperGap};
                    padding: ${wrapperPadding};
                    background: ${isCompact ? 'transparent' : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'};
                    border-radius: ${isCompact ? '0' : '16px'};
                    box-shadow: ${isCompact ? 'none' : '0 8px 16px rgba(0,0,0,0.1)'};
                    position: relative;
                }
                .nfpa-info-grid {
                    display: ${showInfoGrid ? 'grid' : 'none'};
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                    width: 100%;
                    max-width: 800px;
                }
                .nfpa-info-box {
                    background: white;
                    border: 2px solid;
                    border-radius: 8px;
                    padding: 12px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .nfpa-info-box:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 12px rgba(0,0,0,0.15);
                }
                .nfpa-info-box.health { border-color: #0046BE; }
                .nfpa-info-box.fire { border-color: #DC2626; }
                .nfpa-info-box.instability { border-color: #EAB308; }
                .nfpa-info-box.special { border-color: #000000; }
                .nfpa-info-title {
                    font-weight: bold;
                    font-size: 13px;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    padding-bottom: 6px;
                    border-bottom: 2px solid;
                }
                .nfpa-info-box.health .nfpa-info-title { color: #0046BE; border-color: #0046BE; }
                .nfpa-info-box.fire .nfpa-info-title { color: #DC2626; border-color: #DC2626; }
                .nfpa-info-box.instability .nfpa-info-title { color: #EAB308; border-color: #EAB308; }
                .nfpa-info-box.special .nfpa-info-title { color: #000000; border-color: #000000; }
                .nfpa-info-item {
                    font-size: 11px;
                    padding: 4px 0;
                    border-bottom: 1px solid #eee;
                    line-height: 1.4;
                }
                .nfpa-info-item:last-child {
                    border-bottom: none;
                }
                .nfpa-diamond-main {
                    width: ${diamondSize}px;
                    height: ${diamondSize}px;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: ${isCompact ? '20px auto' : '30px auto'};
                    overflow: visible;
                    flex-shrink: 0;
                }
                .nfpa-diamond-main svg {
                    width: ${diamondSize}px;
                    height: ${diamondSize}px;
                    display: block;
                    overflow: visible;
                    shape-rendering: geometricPrecision;
                    flex-shrink: 0;
                }
                .nfpa-diamond-main svg polygon {
                    stroke-width: ${strokeWidth};
                    stroke-linejoin: miter;
                    stroke-miterlimit: 10;
                }
                .nfpa-diamond-main svg path {
                    stroke-width: ${strokeWidth};
                    stroke-linejoin: miter;
                    stroke-miterlimit: 10;
                }
                .nfpa-diamond-main svg text {
                    font-family: 'Arial Black', 'Arial', 'Helvetica', sans-serif;
                    font-weight: 900;
                    font-stretch: condensed;
                    letter-spacing: -1px;
                }
                .nfpa-compact-layout {
                    display: flex;
                    flex-direction: row;
                    align-items: flex-start;
                    gap: 30px;
                    justify-content: center;
                    width: 100%;
                    flex-wrap: wrap;
                }
                .nfpa-compact-values {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    min-width: 180px;
                }
                .nfpa-compact-value-item {
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 14px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    border: 2px solid;
                }
                .nfpa-compact-value-item.health {
                    background-color: #0046BE;
                    color: white;
                    border-color: #003399;
                }
                .nfpa-compact-value-item.fire {
                    background-color: #DC2626;
                    color: white;
                    border-color: #B91C1C;
                }
                .nfpa-compact-value-item.reactivity {
                    background-color: #EAB308;
                    color: #000000;
                    border-color: #CA8A04;
                }
                .nfpa-compact-value-item.protection {
                    background-color: #FFFFFF;
                    color: #000000;
                    border-color: #000000;
                }
                .nfpa-compact-value-label {
                    font-weight: 700;
                    margin-right: 12px;
                    min-width: 100px;
                    text-transform: uppercase;
                    font-size: 13px;
                }
                .nfpa-compact-value-number {
                    font-weight: 900;
                    font-size: 24px;
                    margin-right: auto;
                }
            </style>
            ${isCompact ? '' : `
            <div class="nfpa-diamond-wrapper">
                <!-- Info Boxes Grid -->
                <div class="nfpa-info-grid">
                    <!-- Health Info Box -->
                    <div class="nfpa-info-box health">
                        <div class="nfpa-info-title">HEALTH HAZARD</div>
                        <div class="nfpa-info-item"><strong>4</strong> Deadly</div>
                        <div class="nfpa-info-item"><strong>3</strong> Extreme Danger</div>
                        <div class="nfpa-info-item"><strong>2</strong> Hazardous</div>
                        <div class="nfpa-info-item"><strong>1</strong> Slightly Hazardous</div>
                        <div class="nfpa-info-item"><strong>0</strong> Normal Material</div>
                    </div>

                    <!-- Fire Info Box -->
                    <div class="nfpa-info-box fire">
                        <div class="nfpa-info-title">FIRE HAZARD</div>
                        <div class="nfpa-info-item"><strong>4</strong> Below 73°F</div>
                        <div class="nfpa-info-item"><strong>3</strong> Below 100°F</div>
                        <div class="nfpa-info-item"><strong>2</strong> Below 200°F</div>
                        <div class="nfpa-info-item"><strong>1</strong> Above 200°F</div>
                        <div class="nfpa-info-item"><strong>0</strong> Will Not Burn</div>
                    </div>

                    <!-- Instability Info Box -->
                    <div class="nfpa-info-box instability">
                        <div class="nfpa-info-title">INSTABILITY HAZARD</div>
                        <div class="nfpa-info-item"><strong>4</strong> May Detonate</div>
                        <div class="nfpa-info-item"><strong>3</strong> Shock and Heat May Detonate</div>
                        <div class="nfpa-info-item"><strong>2</strong> Violent Chemical Change</div>
                        <div class="nfpa-info-item"><strong>1</strong> Unstable if Heated</div>
                        <div class="nfpa-info-item"><strong>0</strong> Stable</div>
                    </div>

                    <!-- Specific Hazard Info Box -->
                    <div class="nfpa-info-box special">
                        <div class="nfpa-info-title">SPECIFIC HAZARD</div>
                        <div class="nfpa-info-item"><strong>ACID</strong> Acid</div>
                        <div class="nfpa-info-item"><strong>ALK</strong> Alkali</div>
                        <div class="nfpa-info-item"><strong>COR</strong> Corrosive</div>
                        <div class="nfpa-info-item"><strong>OX</strong> Oxidizer</div>
                        <div class="nfpa-info-item"><strong>W</strong> Use No Water</div>
                    </div>
                </div>
            </div>
            `}
            <!-- Main Diamond Layout - مطابق للصورة بدقة -->
            <div class="${isCompact ? 'nfpa-compact-layout' : ''}">
                <!-- Main Diamond - مطابق للصورة بدقة -->
            <div class="nfpa-diamond-main">
                <svg width="${diamondSize}" height="${diamondSize}" viewBox="-6 -6 232 232" preserveAspectRatio="xMidYMid meet" style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.15));">
                    <!-- Outer border - square rotated 45 degrees with thin border -->
                    <path d="M 110 0 L 220 110 L 110 220 L 0 110 Z" 
                        fill="none" 
                        stroke="#000000" 
                        stroke-width="${strokeWidth}" 
                        stroke-linejoin="miter"
                        stroke-miterlimit="10"/>
                    
                    <!-- NFPA 704 quadrants (rhombus) - مطابقة للتقسيم القياسي -->
                    <!-- Midpoints: (55,55) (165,55) (55,165) (165,165) -->
                    <!-- Top (Flammability) - Red -->
                    <polygon points="110,0 165,55 110,110 55,55" 
                        fill="${getColor(flammability, 'flammability')}"/>
                    <!-- Left (Health) - Blue -->
                    <polygon points="0,110 55,55 110,110 55,165" 
                        fill="${getColor(health, 'health')}"/>
                    <!-- Right (Instability) - Yellow -->
                    <polygon points="220,110 165,55 110,110 165,165" 
                        fill="${getColor(instability, 'instability')}"/>
                    <!-- Bottom (Special) - White/Light Grey -->
                    <polygon points="110,220 55,165 110,110 165,165" 
                        fill="#F5F5F5"/>

                    <!-- Divider lines -->
                    <path d="M 55 55 L 165 165" stroke="#000000" stroke-width="${strokeWidth}" stroke-linejoin="miter" stroke-miterlimit="10"/>
                    <path d="M 165 55 L 55 165" stroke="#000000" stroke-width="${strokeWidth}" stroke-linejoin="miter" stroke-miterlimit="10"/>

                    <!-- Text values - centered داخل كل جزء -->
                    <text x="110" y="55"
                        dy=".35em"
                        text-anchor="middle"
                        font-size="${fontSize}" 
                        font-weight="900" 
                        fill="${getTextColor(flammability, 'flammability')}" 
                        font-family="Arial, Helvetica, sans-serif"
                        style="user-select: none; pointer-events: none; font-stretch: normal;">
                        ${flammability}
                    </text>
                    
                    <text x="55" y="110"
                        dy=".35em"
                        text-anchor="middle"
                        font-size="${fontSize}" 
                        font-weight="900" 
                        fill="${getTextColor(health, 'health')}" 
                        font-family="Arial, Helvetica, sans-serif"
                        style="user-select: none; pointer-events: none; font-stretch: normal;">
                        ${health}
                    </text>
                    
                    <text x="165" y="110"
                        dy=".35em"
                        text-anchor="middle"
                        font-size="${fontSize}" 
                        font-weight="900" 
                        fill="${getTextColor(instability, 'instability')}" 
                        font-family="Arial, Helvetica, sans-serif"
                        style="user-select: none; pointer-events: none; font-stretch: normal;">
                        ${instability}
                    </text>
                    
                    ${special ? `
                    <text x="110" y="165"
                        dy=".35em"
                        text-anchor="middle"
                        font-size="${specialFontSize}" 
                        font-weight="900" 
                        fill="#000000" 
                        font-family="Arial, Helvetica, sans-serif"
                        letter-spacing="1px"
                        style="user-select: none; pointer-events: none;">
                        ${specialDisplay}
                    </text>
                    ` : ''}
                </svg>
            </div>
            ${isCompact ? `
            <!-- Compact Values List - مطابق للصورة -->
            <div class="nfpa-compact-values">
                <div class="nfpa-compact-value-item health">
                    <span class="nfpa-compact-value-label">Health</span>
                    <span class="nfpa-compact-value-number">${health}</span>
                </div>
                <div class="nfpa-compact-value-item fire">
                    <span class="nfpa-compact-value-label">Fire</span>
                    <span class="nfpa-compact-value-number">${flammability}</span>
                </div>
                <div class="nfpa-compact-value-item reactivity">
                    <span class="nfpa-compact-value-label">Reactivity</span>
                    <span class="nfpa-compact-value-number">${instability}</span>
                </div>
                <div class="nfpa-compact-value-item protection">
                    <span class="nfpa-compact-value-label">Special</span>
                    <span class="nfpa-compact-value-number">${specialDisplay || '-'}</span>
                </div>
            </div>
            ` : `
            <!-- Current Values Description -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
                <div class="bg-blue-50 p-4 rounded-lg border-2 border-blue-300 shadow-sm">
                    <div class="text-xs font-bold text-blue-800 mb-2 flex items-center gap-2">
                        <i class="fas fa-heartbeat"></i>HEALTH (الصحة)
                    </div>
                    <div class="text-sm text-blue-900 font-semibold">${getHealthDescription(health)}</div>
                </div>
                <div class="bg-red-50 p-4 rounded-lg border-2 border-red-300 shadow-sm">
                    <div class="text-xs font-bold text-red-800 mb-2 flex items-center gap-2">
                        <i class="fas fa-fire"></i>FIRE (الاشتعال)
                    </div>
                    <div class="text-sm text-red-900 font-semibold">${getFlammabilityDescription(flammability)}</div>
                </div>
                <div class="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-300 shadow-sm">
                    <div class="text-xs font-bold text-yellow-800 mb-2 flex items-center gap-2">
                        <i class="fas fa-exclamation-triangle"></i>INSTABILITY (الاستقرار)
                    </div>
                    <div class="text-sm text-yellow-900 font-semibold">${getInstabilityDescription(instability)}</div>
                </div>
            </div>
            `}
            </div>
        `;
    },

    /**
     * تحديث مربع NFPA Diamond
     */
    updateNFPADiamond() {
        const health = parseInt(document.getElementById('nfpa-health')?.value || 0);
        const flammability = parseInt(document.getElementById('nfpa-flammability')?.value || 0);
        const instability = parseInt(document.getElementById('nfpa-instability')?.value || 0);
        const special = document.getElementById('nfpa-special')?.value || '';

        const container = document.getElementById('nfpa-diamond-container');
        if (container) {
            container.innerHTML = this.renderNFPADiamond({ health, flammability, instability, special });
        }
    },

    /**
     * تحديث مربع NFPA Diamond من القوائم المنسدلة
     */
    updateNFPADiamondFromDropdown() {
        const healthDropdown = document.getElementById('nfpa-health-dropdown');
        const fireDropdown = document.getElementById('nfpa-fire-dropdown');
        const reactivityDropdown = document.getElementById('nfpa-reactivity-dropdown');
        const specialDropdown = document.getElementById('nfpa-special-dropdown');

        const health = parseInt(healthDropdown?.value || 0);
        const flammability = parseInt(fireDropdown?.value || 0);
        const instability = parseInt(reactivityDropdown?.value || 0);
        const special = specialDropdown?.value || '';

        const container = document.getElementById('nfpa-diamond-container');
        if (container) {
            container.innerHTML = this.renderNFPADiamond({ health, flammability, instability, special }, 'compact');
        }
    },

    /**
     * معالجة حفظ النموذج
     */
    async handleSubmit(modal) {
        const form = modal.querySelector('#chemical-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        Loading.show('جاري الحفظ...');

        try {
            // جمع بيانات النموذج - الغرض من الاستخدام
            const purposeHiddenInput = document.getElementById('purpose-of-use');
            const selectedPurposes = purposeHiddenInput?.value 
                ? purposeHiddenInput.value.split(',').filter(v => v.trim())
                : [];
            
            if (selectedPurposes.length === 0) {
                Notification.error('يرجى اختيار غرض واحد على الأقل من الاستخدام');
                return;
            }

            const formData = {
                id: this.currentEditId || Utils.generateId('CHEM'),
                serialNumber: document.getElementById('serial-number').value || 
                    (AppState.appData.chemicalRegister?.length || 0) + 1,
                rmName: document.getElementById('rm-name').value.trim(),
                physicalShape: document.getElementById('physical-shape').value,
                purposeOfUse: selectedPurposes,
                methodOfApplication: document.getElementById('method-of-application').value.trim(),
                department: document.getElementById('department').value.trim(),
                localImport: document.getElementById('local-import').value,
                manufacturer: document.getElementById('manufacturer').value.trim(),
                agentEgypt: document.getElementById('agent-egypt').value.trim(),
                containerType: document.getElementById('container-type').value.trim(),
                containerDisposalMethod: document.getElementById('container-disposal').value.trim(),
                hazardClass: document.getElementById('hazard-class').value.trim(),
                hazardDescription: document.getElementById('hazard-description').value.trim(),
                locationStore: document.getElementById('location-store').value.trim(),
                qtyYear: document.getElementById('qty-year').value.trim(),
                nfpaDiamond: {
                    health: parseInt(document.getElementById('nfpa-health-dropdown')?.value || document.getElementById('nfpa-health')?.value || 0),
                    flammability: parseInt(document.getElementById('nfpa-fire-dropdown')?.value || document.getElementById('nfpa-flammability')?.value || 0),
                    instability: parseInt(document.getElementById('nfpa-reactivity-dropdown')?.value || document.getElementById('nfpa-instability')?.value || 0),
                    special: (document.getElementById('nfpa-special-dropdown')?.value || document.getElementById('nfpa-special')?.value || '').trim()
                },
                createdAt: this.currentEditId 
                    ? AppState.appData.chemicalRegister.find(c => c.id === this.currentEditId)?.createdAt 
                    : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // جمع بيانات SDS (تعليمات السلامة) - اختياري
            const sdsSelectedPictograms = Array.from(document.querySelectorAll('.sds-ghs-checkbox:checked'))
                .map(el => (el?.value || '').trim())
                .filter(Boolean);

            const sdsCompanyBranch = (document.getElementById('sds-company-branch')?.value || '').trim();
            const sdsTranslationStatus = (document.getElementById('sds-translation-status')?.value || '').trim();
            const sdsScientificNameRaw = (document.getElementById('sds-scientific-name')?.value || '').trim();
            const sdsTradeNameRaw = (document.getElementById('sds-trade-name')?.value || '').trim();
            // إذا لم يتم إدخال الاسم العلمي/التجاري في SDS، نأخذه تلقائياً من اسم المادة (RM Name)
            const sdsScientificName = sdsScientificNameRaw || formData.rmName || '';
            const sdsTradeName = sdsTradeNameRaw || formData.rmName || '';

            const sdsFirstAid = (document.getElementById('sds-first-aid')?.value || '').trim();
            const sdsFireFighting = (document.getElementById('sds-fire-fighting')?.value || '').trim();
            const sdsSpillResponse = (document.getElementById('sds-spill-response')?.value || '').trim();
            const sdsHandlingStorage = (document.getElementById('sds-handling-storage')?.value || '').trim();
            const sdsPPE = (document.getElementById('sds-ppe')?.value || '').trim();
            const sdsChemicalProperties = (document.getElementById('sds-chemical-properties')?.value || '').trim();
            const sdsPhysicalProperties = (document.getElementById('sds-physical-properties')?.value || '').trim();
            const sdsOtherRequirements = (document.getElementById('sds-other-requirements')?.value || '').trim();

            const sdsApprovalJob = (document.getElementById('sds-approval-job')?.value || '').trim();
            const sdsApprovalName = (document.getElementById('sds-approval-name')?.value || '').trim();
            const sdsApprovalSignature = (document.getElementById('sds-approval-signature')?.value || '').trim();
            const sdsApprovalDate = (document.getElementById('sds-approval-date')?.value || '').trim();

            formData.sds = {
                companyBranch: sdsCompanyBranch,
                translationStatus: sdsTranslationStatus || 'غير مترجم',
                scientificName: sdsScientificName,
                tradeName: sdsTradeName,
                ghsPictograms: sdsSelectedPictograms,
                instructions: {
                    firstAid: sdsFirstAid,
                    fireFighting: sdsFireFighting,
                    spillResponse: sdsSpillResponse,
                    handlingStorage: sdsHandlingStorage,
                    ppe: sdsPPE,
                    chemicalProperties: sdsChemicalProperties,
                    physicalProperties: sdsPhysicalProperties,
                    otherRequirements: sdsOtherRequirements
                },
                approval: {
                    jobTitle: sdsApprovalJob,
                    name: sdsApprovalName,
                    signature: sdsApprovalSignature,
                    date: sdsApprovalDate
                }
            };

            // رفع ملفات MSDS
            if (this.msdsFiles.arabic) {
                const uploadResult = await GoogleIntegration.uploadMultipleFilesToDrive(
                    [{ file: this.msdsFiles.arabic, name: `MSDS_Arabic_${formData.id}.pdf` }],
                    'ChemicalManagement'
                );
                if (uploadResult && uploadResult.success && uploadResult.files && uploadResult.files[0]) {
                    formData.msdsArabic = uploadResult.files[0].shareableLink || uploadResult.files[0].directLink;
                }
            } else if (this.currentEditId) {
                const existing = AppState.appData.chemicalRegister.find(c => c.id === this.currentEditId);
                if (existing?.msdsArabic) formData.msdsArabic = existing.msdsArabic;
            }

            if (this.msdsFiles.english) {
                const uploadResult = await GoogleIntegration.uploadMultipleFilesToDrive(
                    [{ file: this.msdsFiles.english, name: `MSDS_English_${formData.id}.pdf` }],
                    'ChemicalManagement'
                );
                if (uploadResult && uploadResult.success && uploadResult.files && uploadResult.files[0]) {
                    formData.msdsEnglish = uploadResult.files[0].shareableLink || uploadResult.files[0].directLink;
                }
            } else if (this.currentEditId) {
                const existing = AppState.appData.chemicalRegister.find(c => c.id === this.currentEditId);
                if (existing?.msdsEnglish) formData.msdsEnglish = existing.msdsEnglish;
            }

            // حفظ في AppState
            if (!AppState.appData.chemicalRegister) {
                AppState.appData.chemicalRegister = [];
            }

            if (this.currentEditId) {
                const index = AppState.appData.chemicalRegister.findIndex(c => c.id === this.currentEditId);
                if (index !== -1) {
                    AppState.appData.chemicalRegister[index] = formData;
                }
            } else {
                AppState.appData.chemicalRegister.push(formData);
            }

            // حفظ في Google Sheets
            await GoogleIntegration.sendRequest({
                action: 'saveToSheet',
                data: {
                    sheetName: 'Chemical_Register',
                    data: formData,
                    spreadsheetId: AppState.googleConfig?.sheets?.spreadsheetId
                }
            });

            // حفظ محلي
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        }

            Loading.hide();
            Notification.success(this.currentEditId ? 'تم تحديث المادة بنجاح' : 'تم إضافة المادة بنجاح');
            modal.remove();
            this.currentEditId = null;
            this.msdsFiles = { arabic: null, english: null };
            await this.loadChemicalList();
        } catch (error) {
            Loading.hide();
            Utils.safeError('❌ خطأ في حفظ المادة:', error);
            Notification.error('حدث خطأ أثناء الحفظ: ' + (error.message || 'خطأ غير معروف'));
        }
    },

    /**
     * عرض تفاصيل مادة بشكل احترافي
     */
    async viewChemical(id) {
        const chemical = AppState.appData.chemicalRegister.find(c => c.id === id);
        if (!chemical) {
            Notification.error('المادة غير موجودة');
            return;
        }

        const isHazardous = chemical.hazardClass && 
            (chemical.hazardClass.toLowerCase().includes('hazard') || 
             chemical.hazardClass.toLowerCase().includes('خط') ||
             chemical.hazardClass.toLowerCase().includes('danger'));
        const hasMSDS = !!(chemical.msdsArabic || chemical.msdsEnglish);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10000';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto; overflow-x: hidden; border-radius: 15px; overflow: hidden;">
                <div class="modal-header modal-header-centered" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px;">
                    <h2 class="modal-title" style="color: white; display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;">
                        <i class="fas fa-flask"></i>
                        <span>تفاصيل المادة الكيميائية</span>
                        ${isHazardous ? '<span class="badge badge-danger mr-2 bg-red-500"><i class="fas fa-exclamation-triangle ml-1"></i>خطير</span>' : ''}
                    </h2>
                    <button class="modal-close" style="color: white;" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="background: #f8f9fa; padding: 25px;">
                    <!-- معلومات أساسية -->
                    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg mb-6 border-l-4 border-blue-500" style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-left: 4px solid #2196F3;">
                        <h3 class="text-lg font-bold mb-4 flex items-center gap-2" style="color: #1565C0;">
                            <i class="fas fa-info-circle" style="color: #1976D2;"></i>
                            المعلومات الأساسية
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="bg-white p-3 rounded-lg shadow-sm">
                                <label class="text-xs mb-1" style="color: #64748b;">الرقم التسلسلي</label>
                                <p class="font-bold" style="color: #111827;">${Utils.escapeHTML(chemical.serialNumber || '-')}</p>
                            </div>
                            <div class="bg-white p-3 rounded-lg shadow-sm">
                                <label class="text-xs mb-1" style="color: #64748b;">اسم المادة</label>
                                <p class="font-bold" style="color: #111827;">${Utils.escapeHTML(chemical.rmName || '-')}</p>
                            </div>
                            <div class="bg-white p-3 rounded-lg shadow-sm">
                                <label class="text-xs mb-1" style="color: #64748b;">الشكل الفيزيائي</label>
                                <p class="font-semibold" style="color: #111827;">${Utils.escapeHTML(chemical.physicalShape || '-')}</p>
                            </div>
                            <div class="bg-white p-3 rounded-lg shadow-sm">
                                <label class="text-xs mb-1" style="color: #64748b;">القسم</label>
                                <p class="font-semibold" style="color: #111827;">${Utils.escapeHTML(chemical.department || '-')}</p>
                            </div>
                        </div>
                    </div>

                    <!-- الغرض من الاستخدام -->
                    <div class="mb-6">
                        <h3 class="text-lg font-bold mb-3 flex items-center gap-2" style="color: #111827;">
                            <i class="fas fa-list-check" style="color: #4CAF50;"></i>
                            الغرض من الاستخدام
                        </h3>
                        <div class="p-4 rounded-lg border" style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border: 2px solid #4CAF50;">
                            <div class="flex flex-wrap gap-2">
                                ${Array.isArray(chemical.purposeOfUse) 
                                    ? chemical.purposeOfUse.map(p => `
                                        <span class="px-3 py-1 rounded-full text-sm font-semibold" style="background: #4CAF50; color: white;">
                                            ${Utils.escapeHTML(p)}
                                        </span>
                                    `).join('')
                                    : `<span class="px-3 py-1 rounded-full text-sm" style="background: #4CAF50; color: white;">${Utils.escapeHTML(chemical.purposeOfUse || '-')}</span>`}
                            </div>
                        </div>
                    </div>

                    <!-- معلومات إضافية -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div class="bg-white p-4 rounded-lg border shadow-sm" style="border: 1px solid #e5e7eb;">
                            <label class="text-xs mb-1 flex items-center gap-1" style="color: #64748b;">
                                <i class="fas fa-tools" style="color: #9ca3af;"></i>طريقة التطبيق
                            </label>
                            <p style="color: #111827;">${Utils.escapeHTML(chemical.methodOfApplication || '-')}</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg border shadow-sm" style="border: 1px solid #e5e7eb;">
                            <label class="text-xs mb-1 flex items-center gap-1" style="color: #64748b;">
                                <i class="fas fa-globe" style="color: #9ca3af;"></i>محلي / مستورد
                            </label>
                            <p style="color: #111827;">
                                <span class="px-2 py-1 rounded ${chemical.localImport === 'Local' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}">
                                    ${Utils.escapeHTML(chemical.localImport || '-')}
                                </span>
                            </p>
                        </div>
                        <div class="bg-white p-4 rounded-lg border shadow-sm" style="border: 1px solid #e5e7eb;">
                            <label class="text-xs mb-1 flex items-center gap-1" style="color: #64748b;">
                                <i class="fas fa-industry" style="color: #9ca3af;"></i>الشركة المصنعة
                            </label>
                            <p style="color: #111827;">${Utils.escapeHTML(chemical.manufacturer || '-')}</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg border shadow-sm" style="border: 1px solid #e5e7eb;">
                            <label class="text-xs mb-1 flex items-center gap-1" style="color: #64748b;">
                                <i class="fas fa-handshake" style="color: #9ca3af;"></i>الوكيل في مصر
                            </label>
                            <p style="color: #111827;">${Utils.escapeHTML(chemical.agentEgypt || '-')}</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg border shadow-sm" style="border: 1px solid #e5e7eb;">
                            <label class="text-xs mb-1 flex items-center gap-1" style="color: #64748b;">
                                <i class="fas fa-box" style="color: #9ca3af;"></i>نوع الحاوية
                            </label>
                            <p style="color: #111827;">${Utils.escapeHTML(chemical.containerType || '-')}</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg border shadow-sm" style="border: 1px solid #e5e7eb;">
                            <label class="text-xs mb-1 flex items-center gap-1" style="color: #64748b;">
                                <i class="fas fa-recycle" style="color: #9ca3af;"></i>طريقة التخلص
                            </label>
                            <p style="color: #111827;">${Utils.escapeHTML(chemical.containerDisposalMethod || '-')}</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg border shadow-sm" style="border: 1px solid #e5e7eb;">
                            <label class="text-xs mb-1 flex items-center gap-1" style="color: #64748b;">
                                <i class="fas fa-map-marker-alt" style="color: #9ca3af;"></i>الموقع / المخزن
                            </label>
                            <p style="color: #111827;">${Utils.escapeHTML(chemical.locationStore || '-')}</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg border shadow-sm" style="border: 1px solid #e5e7eb;">
                            <label class="text-xs mb-1 flex items-center gap-1" style="color: #64748b;">
                                <i class="fas fa-calculator" style="color: #9ca3af;"></i>الكمية / السنة
                            </label>
                            <p class="font-semibold" style="color: #111827;">${Utils.escapeHTML(chemical.qtyYear || '-')}</p>
                        </div>
                    </div>

                    <!-- معلومات الخطورة -->
                    ${isHazardous || chemical.hazardClass || chemical.hazardDescription ? `
                        <div class="p-4 rounded-lg mb-6 border-l-4" style="background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); border-left: 4px solid #f44336;">
                            <h3 class="text-lg font-bold mb-4 flex items-center gap-2" style="color: #c62828;">
                                <i class="fas fa-exclamation-triangle" style="color: #d32f2f;"></i>
                                معلومات الخطورة
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                ${chemical.hazardClass ? `
                                    <div class="bg-white p-3 rounded-lg shadow-sm">
                                        <label class="text-xs mb-1" style="color: #64748b;">التصنيف</label>
                                        <p class="font-bold" style="color: #c62828;">${Utils.escapeHTML(chemical.hazardClass)}</p>
                                    </div>
                                ` : ''}
                                ${chemical.hazardDescription ? `
                                    <div class="bg-white p-3 rounded-lg shadow-sm md:col-span-2">
                                        <label class="text-xs mb-1" style="color: #64748b;">وصف الخطورة</label>
                                        <p class="whitespace-pre-line" style="color: #111827;">${Utils.escapeHTML(chemical.hazardDescription)}</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- ملفات MSDS -->
                    ${hasMSDS ? `
                        <div class="p-4 rounded-lg mb-6 border-l-4" style="background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); border-left: 4px solid #9C27B0;">
                            <h3 class="text-lg font-bold mb-4 flex items-center gap-2" style="color: #6A1B9A;">
                                <i class="fas fa-file-pdf" style="color: #7B1FA2;"></i>
                                ملفات MSDS
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                ${chemical.msdsArabic ? `
                                    <a href="${Utils.escapeHTML(chemical.msdsArabic)}" target="_blank" 
                                       class="bg-white p-4 rounded-lg border-2 border-purple-200 hover:border-purple-400 hover:shadow-lg transition-all flex items-center justify-between group">
                                        <div class="flex items-center gap-3">
                                            <div class="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition-colors">
                                                <i class="fas fa-file-pdf text-purple-600 text-2xl"></i>
                                            </div>
                                            <div>
                                                <p class="font-semibold text-gray-800">MSDS (Arabic)</p>
                                                <p class="text-xs text-gray-500">اضغط للفتح</p>
                                            </div>
                                        </div>
                                        <i class="fas fa-external-link-alt text-purple-600 group-hover:translate-x-1 transition-transform"></i>
                                    </a>
                                ` : ''}
                                ${chemical.msdsEnglish ? `
                                    <a href="${Utils.escapeHTML(chemical.msdsEnglish)}" target="_blank" 
                                       class="bg-white p-4 rounded-lg border-2 border-purple-200 hover:border-purple-400 hover:shadow-lg transition-all flex items-center justify-between group">
                                        <div class="flex items-center gap-3">
                                            <div class="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition-colors">
                                                <i class="fas fa-file-pdf text-purple-600 text-2xl"></i>
                                            </div>
                                            <div>
                                                <p class="font-semibold text-gray-800">MSDS (English)</p>
                                                <p class="text-xs text-gray-500">اضغط للفتح</p>
                                            </div>
                                        </div>
                                        <i class="fas fa-external-link-alt text-purple-600 group-hover:translate-x-1 transition-transform"></i>
                                    </a>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- NFPA Diamond -->
                    ${chemical.nfpaDiamond ? `
                        <div class="p-4 rounded-lg border-2 mb-6" style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border: 2px solid #FF9800;">
                            <h3 class="text-lg font-bold mb-3 flex items-center gap-2" style="color: #E65100;">
                                <i class="fas fa-gem" style="color: #F57C00;"></i>
                                مربع NFPA (NFPA Diamond)
                            </h3>
                            <div class="flex justify-center">
                                ${this.renderNFPADiamond(chemical.nfpaDiamond, 'compact')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer" style="background: #f8f9fa; border-top: 1px solid #e5e7eb; padding: 20px; display: flex; justify-content: center; gap: 12px;">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px;">
                        <i class="fas fa-times ml-2"></i>إغلاق
                    </button>
                    <button type="button" onclick="ChemicalSafety.exportPDF('${chemical.id}');" 
                        class="btn-success" style="padding: 10px 20px;">
                        <i class="fas fa-file-pdf ml-2"></i>طباعة / تصدير PDF
                    </button>
                    <button type="button" onclick="ChemicalSafety.editChemical('${chemical.id}'); this.closest('.modal-overlay').remove();" 
                        class="btn-primary" style="padding: 10px 20px;">
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

    /**
     * تعديل مادة
     */
    async editChemical(id) {
        const chemical = AppState.appData.chemicalRegister.find(c => c.id === id);
        if (!chemical) {
            Notification.error('المادة غير موجودة');
            return;
        }
        await this.showForm(chemical);
    },

    /**
     * حذف مادة
     */
    async deleteChemical(id) {
        const chemical = AppState.appData.chemicalRegister.find(c => c.id === id);
        if (!chemical) {
            Notification.error('المادة غير موجودة');
            return;
        }

        if (!confirm(`هل أنت متأكد من حذف المادة "${chemical.rmName}"؟`)) {
            return;
        }

        Loading.show('جاري الحذف...');
        try {
            // حذف من AppState
            AppState.appData.chemicalRegister = AppState.appData.chemicalRegister.filter(c => c.id !== id);

            // حذف من Google Sheets
            await GoogleIntegration.sendRequest({
                action: 'deleteFromSheet',
                data: {
                    sheetName: 'Chemical_Register',
                    id: id,
                    spreadsheetId: AppState.googleConfig?.sheets?.spreadsheetId
                }
            });

            // حفظ محلي
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            Loading.hide();
            Notification.success('تم حذف المادة بنجاح');
            await this.loadChemicalList();
        } catch (error) {
            Loading.hide();
            Utils.safeError('❌ خطأ في حذف المادة:', error);
            Notification.error('حدث خطأ أثناء الحذف: ' + (error.message || 'خطأ غير معروف'));
        }
    },

    // ==============================
    // SDS Printing (Template like provided image)
    // ==============================
    _escapePrint(value) {
        try {
            return Utils.escapeHTML(value || '');
        } catch (e) {
            // Fallback (shouldn't happen in this app)
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
    },

    _formatSDSCell(text, placeholder = 'يظهر بشكل تلقائي') {
        const v = String(text || '').trim();
        if (!v) {
            return `<div class="sds-placeholder">${this._escapePrint(placeholder)}</div>`;
        }
        return `<div class="sds-pre">${this._escapePrint(v)}</div>`;
    },

    _getSDSData(chemical) {
        const sds = chemical?.sds || {};
        const instructions = sds?.instructions || {};
        const approval = sds?.approval || {};
        const ghs = Array.isArray(sds?.ghsPictograms)
            ? sds.ghsPictograms
            : (typeof sds?.ghsPictograms === 'string'
                ? sds.ghsPictograms.split(',').map(v => v.trim()).filter(Boolean)
                : []);

        return {
            companyBranch: sds?.companyBranch || '',
            translationStatus: sds?.translationStatus || 'غير مترجم',
            scientificName: sds?.scientificName || '',
            tradeName: sds?.tradeName || '',
            ghsPictograms: ghs,
            instructions: {
                firstAid: instructions?.firstAid || '',
                fireFighting: instructions?.fireFighting || '',
                spillResponse: instructions?.spillResponse || '',
                handlingStorage: instructions?.handlingStorage || '',
                ppe: instructions?.ppe || '',
                chemicalProperties: instructions?.chemicalProperties || '',
                physicalProperties: instructions?.physicalProperties || '',
                otherRequirements: instructions?.otherRequirements || ''
            },
            approval: {
                jobTitle: approval?.jobTitle || '',
                name: approval?.name || '',
                signature: approval?.signature || '',
                date: approval?.date || ''
            }
        };
    },

    _renderGHSPictogramsPrint(selectedKeys = []) {
        const selected = new Set(Array.isArray(selectedKeys) ? selectedKeys : []);
        // Keep the same 2x2 layout as the provided template image
        const ordered = ['environment', 'corrosion', 'skull', 'flame'];
        const byKey = (k) => GHS_PICTOGRAMS.find(p => p.key === k);

        return `
            <div class="ghs-wrap">
                <div class="ghs-title">GHS</div>
                <div class="ghs-grid">
                    ${ordered.map(k => {
                        const p = byKey(k);
                        if (!p) return '';
                        const isSelected = selected.has(k);
                        return `
                            <div class="ghs-item ${isSelected ? 'selected' : 'unselected'}">
                                <div class="ghs-icon">${p.svg}</div>
                                <div class="ghs-caption">${this._escapePrint(p.labelAr)}</div>
                                <div class="ghs-checkbox ${isSelected ? 'checked' : ''}"></div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    generateSDSPrintContent(chemical) {
        const sds = this._getSDSData(chemical);
        const escape = (v) => this._escapePrint(v);

        const scientificName = sds.scientificName || chemical?.rmName || '';
        const tradeName = sds.tradeName || chemical?.rmName || '';

        const nfpaHTML = this.renderNFPADiamond(chemical?.nfpaDiamond || {}, 'compact');
        const ghsHTML = this._renderGHSPictogramsPrint(sds.ghsPictograms || []);

        return `
            <style>
                /* Try to keep SDS in one page when possible (content-dependent) */
                @page { size: A4; margin: 12mm 10mm; }
                .report-body { background: #fff !important; }
                .sds-page { width: 100%; }
                .top-bar {
                    display: grid;
                    grid-template-columns: 1fr 2fr 1fr;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 8px;
                }
                .top-box {
                    border: 1.5px solid #000;
                    padding: 6px 8px;
                    font-size: 12px;
                    text-align: center;
                    white-space: nowrap;
                }
                .title {
                    text-align: center;
                    font-size: 18px;
                    font-weight: 700;
                }

                table.sds-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    table-layout: fixed; 
                    page-break-inside: avoid;
                    direction: rtl;
                }
                .sds-table td { border: 1.5px solid #000; vertical-align: top; padding: 5px 6px; }
                .sds-label {
                    width: 26%;
                    background: #d9d9d9;
                    font-weight: 700;
                    text-align: right;
                    padding: 8px 8px;
                    font-size: 12px;
                }
                .sds-value { 
                    width: 74%; 
                    font-size: 12px;
                    text-align: right;
                    direction: rtl;
                }
                .sds-pre { white-space: pre-wrap; line-height: 1.45; }
                .sds-placeholder { color: #666; font-style: italic; }

                .hazards-row { padding: 0; }
                .hazards-inner {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    align-items: start;
                }
                .nfpa-wrap { text-align: center; }
                .nfpa-title { font-weight: 700; margin-bottom: 6px; font-size: 13px; }
                .nfpa-legend { margin-top: 6px; font-size: 10px; line-height: 1.35; text-align: right; }
                .nfpa-legend .c-blue { color: #0066CC; font-weight: 700; }
                .nfpa-legend .c-red { color: #FF0000; font-weight: 700; }
                .nfpa-legend .c-yellow { color: #B45309; font-weight: 700; }
                .nfpa-legend .c-white { color: #111; font-weight: 700; }

                .ghs-wrap { text-align: center; }
                .ghs-title { font-weight: 700; margin-bottom: 8px; font-size: 13px; }
                .ghs-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    justify-items: center;
                }
                .ghs-item {
                    width: 112px;
                    padding: 6px 6px 8px 6px;
                    border: 2px solid #000;
                    background: #ffffff;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .ghs-item.unselected { opacity: 0.3; }
                .ghs-icon { 
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin: 0 auto;
                }
                .ghs-icon svg { 
                    width: 60px !important; 
                    height: 60px !important; 
                    display: block;
                    margin: 0 auto;
                }
                /* التأكد من ظهور الألوان في الطباعة */
                .ghs-icon svg polygon,
                .ghs-icon svg path,
                .ghs-icon svg line,
                .ghs-icon svg circle,
                .ghs-icon svg rect {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }
                .ghs-checkbox {
                    width: 14px;
                    height: 14px;
                    border: 2px solid #000;
                    background: #ffffff;
                    margin: 4px auto 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }
                .ghs-checkbox.checked {
                    background: #000;
                }
                .ghs-checkbox.checked::after {
                    content: '✓';
                    color: #ffffff;
                    font-size: 10px;
                    font-weight: bold;
                    line-height: 1;
                }
                .ghs-caption { 
                    font-size: 11px; 
                    font-weight: 800; 
                    margin-top: 6px; 
                    color: #000;
                    text-align: center;
                    width: 100%;
                    border-top: 1px solid #000;
                    padding-top: 4px;
                    margin-bottom: 4px;
                }

                .approval-title { margin-top: 10px; font-weight: 800; text-decoration: underline; font-size: 13px; }
                table.approval { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; page-break-inside: avoid; }
                table.approval th, table.approval td { border: 1.5px solid #000; padding: 7px; font-size: 12px; }
                table.approval th { background: #d9d9d9; font-weight: 800; }

                .meta { margin-top: 8px; font-size: 10px; color: #444; text-align: left; direction: ltr; }

                /* Avoid breaking key blocks across pages */
                .sds-page, .top-bar, .approval-title { page-break-inside: avoid; }
            </style>

            <div class="sds-page">
                <div class="top-bar">
                    <div class="top-box">${escape(sds.companyBranch || '')}</div>
                    <div class="title">تعليمات السلامة للمواد الكيميائية</div>
                    <div class="top-box">${escape(sds.translationStatus || 'غير مترجم')}</div>
                </div>

                <table class="sds-table">
                    <tr>
                        <td class="sds-label">الاسم العلمي للمادة</td>
                        <td class="sds-value">${this._formatSDSCell(scientificName, '')}</td>
                    </tr>
                    <tr>
                        <td class="sds-label">الاسم التجاري للمادة</td>
                        <td class="sds-value">${this._formatSDSCell(tradeName, '')}</td>
                    </tr>
                    <tr>
                        <td class="sds-label">مخاطر المادة الكيميائية</td>
                        <td class="sds-value hazards-row">
                            <div class="hazards-inner">
                                <div class="nfpa-wrap">
                                    <div class="nfpa-title">NFPA</div>
                                    ${nfpaHTML}
                                    <div class="nfpa-legend">
                                        <div><span class="c-red">الأحمر</span>: خطر حريق</div>
                                        <div><span class="c-yellow">الأصفر</span>: قابلية التفاعل</div>
                                        <div><span class="c-blue">الأزرق</span>: خطر على صحة الإنسان</div>
                                        <div><span class="c-white">الأبيض</span>: خطر خاص</div>
                                    </div>
                                </div>
                                ${ghsHTML}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td class="sds-label">الإسعافات الأولية</td>
                        <td class="sds-value">${this._formatSDSCell(sds.instructions.firstAid)}</td>
                    </tr>
                    <tr>
                        <td class="sds-label">الوسيلة الإطفائية</td>
                        <td class="sds-value">${this._formatSDSCell(sds.instructions.fireFighting)}</td>
                    </tr>
                    <tr>
                        <td class="sds-label">في حالة الانسكابات</td>
                        <td class="sds-value">${this._formatSDSCell(sds.instructions.spillResponse)}</td>
                    </tr>
                    <tr>
                        <td class="sds-label">التداول والتخزين</td>
                        <td class="sds-value">${this._formatSDSCell(sds.instructions.handlingStorage)}</td>
                    </tr>
                    <tr>
                        <td class="sds-label">مهمات الوقاية الشخصية</td>
                        <td class="sds-value">${this._formatSDSCell(sds.instructions.ppe)}</td>
                    </tr>
                    <tr>
                        <td class="sds-label">الخواص الكيميائية</td>
                        <td class="sds-value">${this._formatSDSCell(sds.instructions.chemicalProperties)}</td>
                    </tr>
                    <tr>
                        <td class="sds-label">الخواص الفيزيائية</td>
                        <td class="sds-value">${this._formatSDSCell(sds.instructions.physicalProperties)}</td>
                    </tr>
                    <tr>
                        <td class="sds-label">متطلبات أخرى</td>
                        <td class="sds-value">${this._formatSDSCell(sds.instructions.otherRequirements)}</td>
                    </tr>
                </table>

                <div class="approval-title">الاعتماد:</div>
                <table class="approval">
                    <thead>
                        <tr>
                            <th style="width: 25%;">الوظيفة</th>
                            <th style="width: 25%;">الاسم</th>
                            <th style="width: 25%;">التوقيع</th>
                            <th style="width: 25%;">التاريخ</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${escape(sds.approval.jobTitle)}</td>
                            <td>${escape(sds.approval.name)}</td>
                            <td>${escape(sds.approval.signature)}</td>
                            <td>${escape(sds.approval.date)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="meta">Printed: ${escape(new Date().toLocaleString('ar-EG'))}</div>
            </div>
        `;
    },

    /**
     * تصدير سجل مادة كيميائية إلى PDF
     */
    async exportPDF(id) {
        const chemical = AppState.appData.chemicalRegister.find(c => c.id === id);
        if (!chemical) {
            Notification.error('المادة غير موجودة');
            return;
        }

        try {
            Loading.show('جاري إنشاء PDF...');

            const formCode = chemical.serialNumber || `CHEM-${chemical.id?.substring(0, 8) || 'UNKNOWN'}`;
            const content = this.generateSDSPrintContent(chemical);
            const formTitle = 'تعليمات السلامة للمواد الكيميائية (SDS)';

            const qrPayload = {
                type: 'ChemicalSDS',
                id: chemical.id,
                code: formCode,
                url: `${window.location.origin}/chemical/${chemical.id}`
            };

            // Use standard header/footer template like other forms (logo + company name + footer)
            // تقليل حجم الفوتر بإضافة CSS مخصص
            const contentWithFooterStyle = content + `
                <style>
                    /* تقليل حجم الفوتر */
                    .report-footer {
                        margin-top: 15px !important;
                    }
                    .footer-watermark-frame {
                        padding: 10px 14px !important;
                        margin-top: 8px !important;
                    }
                    .footer-contact {
                        font-size: 9px !important;
                        margin-bottom: 6px !important;
                    }
                    .footer-bottom {
                        gap: 6px !important;
                        font-size: 10px !important;
                    }
                    .footer-meta-line {
                        font-size: 10px !important;
                        padding: 6px 0 !important;
                        gap: 15px !important;
                    }
                    .footer-meta-item {
                        font-size: 10px !important;
                        padding: 3px 10px !important;
                    }
                    .footer-bottom-text {
                        font-size: 10px !important;
                    }
                    /* التأكد من ظهور ألوان GHS في الطباعة */
                    @media print {
                        .ghs-icon svg * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }
                    }
                </style>
            `;
            const htmlContent = (typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function')
                ? FormHeader.generatePDFHTML(
                    formCode,
                    formTitle,
                    contentWithFooterStyle,
                    false,
                    true,
                    {
                        version: '1.0',
                        releaseDate: chemical.createdAt,
                        revisionDate: chemical.updatedAt || chemical.createdAt,
                        qrData: qrPayload
                    },
                    chemical.createdAt,
                    chemical.updatedAt || chemical.createdAt
                )
                : `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${formTitle}</title></head><body>${content}</body></html>`;

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
                        }, 800);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF للمادة الكيميائية:', error);
            Notification.error('فشل في تصدير PDF: ' + error.message);
        }
    },

    /**
     * تصدير إلى PDF
     */
    async exportToPDF() {
        const chemicals = this.getFilteredChemicals(AppState.appData.chemicalRegister || []);
        if (chemicals.length === 0) {
            Notification.warning('لا توجد بيانات للتصدير');
            return;
        }

        Loading.show('جاري إنشاء PDF...');
        try {
            const rows = chemicals.map(chem => {
                const isHazardous = chem.hazardClass && 
                    (chem.hazardClass.toLowerCase().includes('hazard') || 
                     chem.hazardClass.toLowerCase().includes('خط') ||
                     chem.hazardClass.toLowerCase().includes('danger'));
                return `
                    <tr class="${isHazardous ? 'hazardous-row' : ''}">
                        <td>${Utils.escapeHTML(chem.serialNumber || '')}</td>
                        <td><strong>${Utils.escapeHTML(chem.rmName || '')}</strong>${isHazardous ? ' ⚠️' : ''}</td>
                        <td>${Utils.escapeHTML(chem.physicalShape || '')}</td>
                        <td>${Array.isArray(chem.purposeOfUse) ? chem.purposeOfUse.join(', ') : Utils.escapeHTML(chem.purposeOfUse || '')}</td>
                        <td>${Utils.escapeHTML(chem.department || '')}</td>
                        <td><strong>${Utils.escapeHTML(chem.hazardClass || '-')}</strong></td>
                        <td>${Utils.escapeHTML(chem.locationStore || '')}</td>
                        <td>${Utils.escapeHTML(chem.qtyYear || '')}</td>
                        <td>${isHazardous ? '<strong style="color: #dc2626;">خطير</strong>' : '<span style="color: #16a34a;">آمن</span>'}</td>
                    </tr>
                `;
            }).join('');

            const stats = this.getStatistics();
            
            // بناء محتوى التقرير مع الحفاظ على التصميم الحالي
            const content = `
                <style>
                    .chemical-report-info {
                        display: flex;
                        justify-content: space-around;
                        margin: 20px 0;
                        padding: 15px;
                        background: #f0f9ff;
                        border-radius: 8px;
                    }
                    .chemical-report-info-item {
                        text-align: center;
                    }
                    .chemical-report-info-label {
                        font-size: 12px;
                        color: #64748b;
                        margin-bottom: 5px;
                    }
                    .chemical-report-info-value {
                        font-size: 18px;
                        font-weight: bold;
                        color: #1e40af;
                    }
                    .chemical-report-table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-top: 20px; 
                        font-size: 10px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    .chemical-report-table th, .chemical-report-table td { 
                        border: 1px solid #cbd5e1; 
                        padding: 10px 8px; 
                        text-align: right; 
                    }
                    .chemical-report-table th { 
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white; 
                        font-weight: bold;
                        font-size: 11px;
                    }
                    .chemical-report-table tr:nth-child(even) { 
                        background-color: #f8fafc; 
                    }
                    .chemical-report-table tr:hover {
                        background-color: #e0f2fe;
                    }
                    .chemical-report-table .hazardous-row {
                        background-color: #fef2f2 !important;
                    }
                    /* تخصيص الفوتر ليكون أصغر */
                    .report-footer {
                        margin-top: 20px !important;
                    }
                    .footer-watermark-frame {
                        padding: 12px 16px !important;
                        margin-top: 10px !important;
                    }
                    .footer-contact {
                        font-size: 10px !important;
                        margin-bottom: 8px !important;
                    }
                    .footer-bottom {
                        gap: 8px !important;
                        font-size: 11px !important;
                    }
                    .footer-meta-line {
                        font-size: 11px !important;
                        padding: 8px 0 !important;
                        gap: 20px !important;
                    }
                    .footer-meta-item {
                        font-size: 11px !important;
                        padding: 4px 12px !important;
                    }
                    .footer-bottom-text {
                        font-size: 11px !important;
                    }
                    @media print { 
                        .chemical-report-table { font-size: 9px; } 
                        .chemical-report-table th, .chemical-report-table td { padding: 6px 4px; }
                    }
                </style>
                <div class="chemical-report-info">
                    <div class="chemical-report-info-item">
                        <div class="chemical-report-info-label">تاريخ التصدير</div>
                        <div class="chemical-report-info-value">${new Date().toLocaleDateString('ar-EG')}</div>
                    </div>
                    <div class="chemical-report-info-item">
                        <div class="chemical-report-info-label">إجمالي المواد</div>
                        <div class="chemical-report-info-value">${stats.total}</div>
                    </div>
                    <div class="chemical-report-info-item">
                        <div class="chemical-report-info-label">المواد الخطرة</div>
                        <div class="chemical-report-info-value" style="color: #dc2626;">${stats.hazardous}</div>
                    </div>
                    <div class="chemical-report-info-item">
                        <div class="chemical-report-info-label">المواد الآمنة</div>
                        <div class="chemical-report-info-value" style="color: #16a34a;">${stats.safe}</div>
                    </div>
                </div>
                <table class="chemical-report-table">
                    <thead>
                        <tr>
                            <th>م</th>
                            <th>اسم المادة</th>
                            <th>الشكل الفيزيائي</th>
                            <th>الغرض من الاستخدام</th>
                            <th>القسم</th>
                            <th>التصنيف</th>
                            <th>الموقع/المخزن</th>
                            <th>الكمية/السنة</th>
                            <th>خطورة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                <p style="margin-top: 20px; text-align: center; font-size: 12px; color: #6b7280;">
                    عدد السجلات المعروضة: ${chemicals.length}
                </p>
            `;

            const formTitle = 'سجل المواد الكيميائية';
            const formCode = 'CHEMICAL-REGISTER';
            const exportDate = new Date().toISOString();

            // استخدام FormHeader.generatePDFHTML لإضافة الهيدر والشعار والفوتر بدون QR
            const htmlContent = (typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function')
                ? FormHeader.generatePDFHTML(
                    formCode,
                    formTitle,
                    content,
                    false,  // includeQrInHeader = false
                    false,  // includeQrInFooter = false (بدون QR)
                    {
                        version: '1.0',
                        releaseDate: exportDate,
                        revisionDate: exportDate
                    },
                    exportDate,
                    exportDate
                )
                : `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${formTitle}</title></head><body>${content}</body></html>`;

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
                        }, 800);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('❌ خطأ في تصدير PDF:', error);
            Notification.error('حدث خطأ أثناء التصدير: ' + (error.message || 'خطأ غير معروف'));
        }
    },

    /**
     * تصدير إلى Excel
     */
    async exportToExcel() {
        const chemicals = this.getFilteredChemicals(AppState.appData.chemicalRegister || []);
        if (chemicals.length === 0) {
            Notification.warning('لا توجد بيانات للتصدير');
            return;
        }

        Loading.show('جاري إنشاء Excel...');
        try {
            if (typeof XLSX === 'undefined') {
                Loading.hide();
                Notification.error('مكتبة SheetJS غير محمّلة');
                return;
            }

            const excelData = chemicals.map(chem => {
                const isHazardous = chem.hazardClass && 
                    (chem.hazardClass.toLowerCase().includes('hazard') || 
                     chem.hazardClass.toLowerCase().includes('خط') ||
                     chem.hazardClass.toLowerCase().includes('danger'));
                const nfpa = chem.nfpaDiamond || {};
                return {
                    'م': chem.serialNumber || '',
                    'اسم المادة': chem.rmName || '',
                    'الشكل الفيزيائي': chem.physicalShape || '',
                    'الغرض من الاستخدام': Array.isArray(chem.purposeOfUse) ? chem.purposeOfUse.join('; ') : (chem.purposeOfUse || ''),
                    'طريقة التطبيق': chem.methodOfApplication || '',
                    'القسم': chem.department || '',
                    'MSDS (Arabic)': chem.msdsArabic || '',
                    'MSDS (English)': chem.msdsEnglish || '',
                    'محلي / مستورد': chem.localImport || '',
                    'الشركة المصنعة': chem.manufacturer || '',
                    'الوكيل في مصر': chem.agentEgypt || '',
                    'نوع الحاوية': chem.containerType || '',
                    'طريقة التخلص': chem.containerDisposalMethod || '',
                    'التصنيف': chem.hazardClass || '',
                    'وصف الخطورة': chem.hazardDescription || '',
                    'الموقع / المخزن': chem.locationStore || '',
                    'الكمية / السنة': chem.qtyYear || '',
                    'NFPA Health': nfpa.health || 0,
                    'NFPA Flammability': nfpa.flammability || 0,
                    'NFPA Instability': nfpa.instability || 0,
                    'NFPA Special': nfpa.special || '',
                    'حالة الخطورة': isHazardous ? 'خطير' : 'آمن'
                };
            });

            const ws = XLSX.utils.json_to_sheet(excelData);
            
            // تحسين عرض الأعمدة
            const colWidths = [
                { wch: 8 },   // م
                { wch: 25 },  // اسم المادة
                { wch: 15 },  // الشكل الفيزيائي
                { wch: 30 },  // الغرض من الاستخدام
                { wch: 20 },  // طريقة التطبيق
                { wch: 15 },  // القسم
                { wch: 30 },  // MSDS Arabic
                { wch: 30 },  // MSDS English
                { wch: 12 },  // محلي/مستورد
                { wch: 20 },  // الشركة المصنعة
                { wch: 20 },  // الوكيل
                { wch: 15 },  // نوع الحاوية
                { wch: 20 },  // طريقة التخلص
                { wch: 20 },  // التصنيف
                { wch: 30 },  // وصف الخطورة
                { wch: 20 },  // الموقع
                { wch: 15 },  // الكمية
                { wch: 12 },  // NFPA Health
                { wch: 15 },  // NFPA Flammability
                { wch: 15 },  // NFPA Instability
                { wch: 12 },  // NFPA Special
                { wch: 12 }   // حالة الخطورة
            ];
            ws['!cols'] = colWidths;
            
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'سجل المواد الكيميائية');

            const fileName = `سجل_المواد_الكيميائية_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);

            Loading.hide();
            Notification.success('تم تصدير البيانات بنجاح');
        } catch (error) {
            Loading.hide();
            Utils.safeError('❌ خطأ في تصدير Excel:', error);
            Notification.error('حدث خطأ أثناء التصدير: ' + (error.message || 'خطأ غير معروف'));
        }
    },

    /**
     * تنظيف جميع الموارد عند إلغاء تحميل الموديول
     * يمنع تسريبات الذاكرة (Memory Leaks)
     */
    cleanup() {
        try {
            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('🧹 تنظيف موارد ChemicalSafety module...');
            }

            // تنظيف event listeners باستخدام AbortController
            if (this._eventListenersAbortController) {
                this._eventListenersAbortController.abort();
                this._eventListenersAbortController = null;
            }

            // تنظيف timeout
            if (this._setupTimeoutId) {
                clearTimeout(this._setupTimeoutId);
                this._setupTimeoutId = null;
            }

            // تنظيف مراجع DOM والبيانات المؤقتة
            this.currentEditId = null;
            this.msdsFiles = { arabic: null, english: null };
            this.filters = {
                search: '',
                department: '',
                physicalShape: '',
                classification: ''
            };

            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ تم تنظيف موارد ChemicalSafety module');
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ خطأ في تنظيف ChemicalSafety module:', error);
            }
        }
    }
};

// ===== Export module to global scope =====
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof ChemicalSafety !== 'undefined') {
            window.ChemicalSafety = ChemicalSafety;
            
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ ChemicalSafety module loaded and available on window.ChemicalSafety');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير ChemicalSafety:', error);
        if (typeof window !== 'undefined' && typeof ChemicalSafety !== 'undefined') {
            try {
                window.ChemicalSafety = ChemicalSafety;
            } catch (e) {
                console.error('❌ فشل تصدير ChemicalSafety:', e);
            }
        }
    }
})();
