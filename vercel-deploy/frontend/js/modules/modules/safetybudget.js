/**
 * SafetyBudget Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
// ===== Safety Budget Module (ميزانية السلامة وتتبع الإنفاق) =====
const SafetyBudget = {
    currentView: 'dashboard', // dashboard, list, form, edit
    currentEditId: null,
    currentBudgetId: null,
    currencies: {
        'EGP': { symbol: 'ج.م', name: 'جنيه مصري', locale: 'ar-EG' },
        'USD': { symbol: '$', name: 'دولار أمريكي', locale: 'en-US' }
    },
    defaultCurrency: 'EGP',
    expenseCategories: ['معدات', 'تدريب', 'صيانة', 'أدوات حماية', 'طوارئ', 'OPEX', 'CAPEX', 'أخرى'],

    getCurrencySymbol(currency = null) {
        const curr = currency || this.defaultCurrency;
        return this.currencies[curr]?.symbol || curr;
    },

    formatCurrency(amount, currency = null) {
        const curr = currency || this.defaultCurrency;
        const currencyInfo = this.currencies[curr];
        if (!currencyInfo) return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (curr === 'EGP') {
            return amount.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currencyInfo.symbol;
        } else if (curr === 'USD') {
            return currencyInfo.symbol + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currencyInfo.symbol;
    },

    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        // التحقق من وجود التبعيات المطلوبة
        if (typeof Utils === 'undefined') {
            console.error('Utils غير متوفر!');
            return;
        }
        const section = document.getElementById('safety-budget-section');
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('قسم safety-budget-section غير موجود!');
            } else {
                console.error('قسم safety-budget-section غير موجود!');
            }
            return;
        }

        if (typeof AppState === 'undefined') {
            // لا تترك الواجهة فارغة
            section.innerHTML = `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-2">تعذر تحميل ميزانية السلامة</p>
                            <p class="text-sm text-gray-400">AppState غير متوفر حالياً. جرّب تحديث الصفحة.</p>
                            <button onclick="location.reload()" class="btn-primary mt-4">
                                <i class="fas fa-redo ml-2"></i>
                                تحديث الصفحة
                            </button>
                        </div>
                    </div>
                </div>
            `;
            Utils.safeError('AppState غير متوفر!');
            return;
        }

        try {
            // Skeleton فوري قبل أي render قد يكون بطيئاً
            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-wallet ml-3" aria-hidden="true"></i>
                                ميزانية السلامة وتتبع الإنفاق
                            </h1>
                            <p class="section-subtitle">جاري التحميل...</p>
                        </div>
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

            // التأكد من وجود البيانات
            if (!AppState.appData) {
                AppState.appData = {};
            }
            if (!AppState.appData.safetyBudget) {
                AppState.appData.safetyBudget = { expenses: [], budgets: [] };
            }

            const budgetTitle = (typeof i18n !== 'undefined' && i18n.translate) ? i18n.translate('budget.title') : 'ميزانية السلامة وتتبع الإنفاق';
            const budgetSubtitle = (typeof i18n !== 'undefined' && i18n.translate) ? i18n.translate('budget.subtitle') : 'إدارة ومتابعة مصروفات وأنشطة السلامة';

            // محاولة تحميل لوحة التحكم مع معالجة الأخطاء
            let dashboardContent = '';
            try {
                const dashboardPromise = this.renderDashboard();
                dashboardContent = await Utils.promiseWithTimeout(
                    dashboardPromise,
                    10000,
                    () => new Error('Timeout: renderDashboard took too long')
                );
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                    Utils.safeWarn('⚠️ خطأ في تحميل لوحة التحكم:', error);
                } else {
                    console.warn('⚠️ خطأ في تحميل لوحة التحكم:', error);
                }
                dashboardContent = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">حدث خطأ في تحميل البيانات</p>
                                <button onclick="SafetyBudget.load()" class="btn-primary">
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
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-wallet ml-3" aria-hidden="true"></i>
                            ${budgetTitle}
                        </h1>
                        <p class="section-subtitle">${budgetSubtitle}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button id="import-budget-btn" class="btn-secondary" onclick="SafetyBudget.showImportModal()">
                            <i class="fas fa-file-import ml-2"></i>
                            استيراد من Excel
                        </button>
                        <button id="export-report-pdf-btn" class="btn-secondary" onclick="SafetyBudget.exportReport('pdf')">
                            <i class="fas fa-file-pdf ml-2"></i>
                            تصدير PDF
                        </button>
                        <button id="export-report-excel-btn" class="btn-secondary" onclick="SafetyBudget.exportReport('excel')">
                            <i class="fas fa-file-excel ml-2"></i>
                            تصدير Excel
                        </button>
                        <button id="add-budget-btn" class="btn-secondary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة ميزانية
                        </button>
                        <button id="add-expense-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            تسجيل مصروف جديد
                        </button>
                    </div>
                </div>
            </div>
            <div class="mt-6">
                <!-- Tabs Navigation -->
                <div class="mb-6">
                    <div class="flex items-center gap-2 border-b border-gray-200" style="border-bottom: 2px solid #e5e7eb;">
                        <button class="tab-btn active" data-tab="dashboard" onclick="SafetyBudget.switchTab('dashboard')" style="padding: 12px 20px; border: none; background: transparent; color: #6b7280; font-weight: 500; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s;">
                            <i class="fas fa-chart-pie ml-2"></i>
                            لوحة التحكم
                        </button>
                        <button class="tab-btn" data-tab="all" onclick="SafetyBudget.switchTab('all')" style="padding: 12px 20px; border: none; background: transparent; color: #6b7280; font-weight: 500; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s;">
                            <i class="fas fa-list ml-2"></i>
                            جميع المصروفات
                        </button>
                        <button class="tab-btn" data-tab="opex" onclick="SafetyBudget.switchTab('opex')" style="padding: 12px 20px; border: none; background: transparent; color: #6b7280; font-weight: 500; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s;">
                            <i class="fas fa-chart-line ml-2"></i>
                            OPEX (مصروفات تشغيلية)
                        </button>
                        <button class="tab-btn" data-tab="capex" onclick="SafetyBudget.switchTab('capex')" style="padding: 12px 20px; border: none; background: transparent; color: #6b7280; font-weight: 500; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s;">
                            <i class="fas fa-building ml-2"></i>
                            CAPEX (مصروفات رأسمالية)
                        </button>
                    </div>
                    <style>
                        .tab-btn:hover {
                            color: #3b82f6 !important;
                        }
                        .tab-btn.active {
                            color: #3b82f6 !important;
                            border-bottom-color: #3b82f6 !important;
                            font-weight: 600 !important;
                        }
                    </style>
                </div>
                
                <!-- Tab Content -->
                <div id="safety-budget-tab-content">
                    ${dashboardContent}
                </div>
            </div>
        `;
            this.setupEventListeners();
            this.currentTab = 'dashboard';
            
            // تحميل لوحة التحكم فوراً بعد عرض الواجهة (حتى لو كانت البيانات فارغة)
            // هذا يضمن عدم بقاء الواجهة فارغة بعد التحميل
            try {
                // استخدام setTimeout بسيط لضمان أن DOM جاهز
                setTimeout(() => {
                    this.loadDashboard();
                }, 0);
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في تحميل لوحة التحكم الأولي:', error);
            }
            
            // تحميل البيانات بشكل غير متزامن بعد عرض الواجهة (للتحديث)
            setTimeout(() => {
                try {
                    this.loadDashboard().then(() => {
                        // تحديث الواجهة بعد تحميل البيانات لضمان عرض البيانات المحدثة
                        if (this.currentTab === 'dashboard') {
                            this.switchTab('dashboard', { silent: true });
                        }
                    }).catch(error => {
                        Utils.safeWarn('⚠️ تعذر تحميل بيانات الميزانية:', error);
                        // حتى في حالة الخطأ، تأكد من تحميل لوحة التحكم
                        this.loadDashboard();
                    });
                } catch (error) {
                    Utils.safeWarn('⚠️ تعذر تحميل بيانات الميزانية:', error);
                    // حتى في حالة الخطأ، تأكد من تحميل لوحة التحكم
                    this.loadDashboard();
                }
            }, 100);
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل مديول ميزانية السلامة:', error);
            section.innerHTML = `
                <div class="section-header">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-wallet ml-3"></i>
                            ميزانية السلامة وتتبع الإنفاق
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
                                <button onclick="SafetyBudget.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    إعادة المحاولة
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    async switchTab(tabName, options = {}) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Load appropriate content
        const contentContainer = document.getElementById('safety-budget-tab-content');
        if (!contentContainer) return;

        if (tabName === 'dashboard') {
            contentContainer.innerHTML = await this.renderDashboard();
            this.loadDashboard();
        } else if (tabName === 'all') {
            contentContainer.innerHTML = await this.renderExpensesList('all');
            this.loadExpensesList();
        } else if (tabName === 'opex') {
            contentContainer.innerHTML = await this.renderExpensesList('OPEX');
            this.setupOPEXEventListeners();
            this.loadOPEXList();
        } else if (tabName === 'capex') {
            contentContainer.innerHTML = await this.renderExpensesList('CAPEX');
            this.setupCAPEXEventListeners();
            this.loadCAPEXList();
        }
    },

    async renderDashboard() {
        return `
            <!-- Dashboard Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div class="content-card">
                    <div class="card-body">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">إجمالي الميزانية المعتمدة</p>
                                <p class="text-2xl font-bold text-blue-600" id="total-budget">0.00</p>
                                <p class="text-xs text-gray-500 mt-1" id="total-budget-currency">جنيه مصري</p>
                            </div>
                            <div class="bg-blue-100 rounded-full p-4">
                                <i class="fas fa-wallet text-2xl text-blue-600"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-body">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">إجمالي المصروفات</p>
                                <p class="text-2xl font-bold text-red-600" id="total-expenses">0.00</p>
                                <p class="text-xs text-gray-500 mt-1" id="total-expenses-currency">جنيه مصري</p>
                            </div>
                            <div class="bg-red-100 rounded-full p-4">
                                <i class="fas fa-money-bill-wave text-2xl text-red-600"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-body">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">المتبقي</p>
                                <p class="text-2xl font-bold text-green-600" id="remaining-budget">0.00</p>
                                <p class="text-xs text-gray-500 mt-1" id="remaining-budget-currency">جنيه مصري</p>
                            </div>
                            <div class="bg-green-100 rounded-full p-4">
                                <i class="fas fa-coins text-2xl text-green-600"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-body">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">نسبة الاستهلاك</p>
                                <p class="text-2xl font-bold" id="consumption-percentage">0%</p>
                                <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
                                    <div class="bg-blue-600 h-2 rounded-full transition-all duration-500" id="consumption-bar" style="width: 0%"></div>
                                </div>
                            </div>
                            <div class="bg-yellow-100 rounded-full p-4">
                                <i class="fas fa-percentage text-2xl text-yellow-600"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Charts and Summary -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-chart-pie ml-2"></i>
                            الإنفاق حسب الفئة
                        </h2>
                    </div>
                    <div class="card-body">
                        <div id="expenses-by-category-chart" style="height: 300px;"></div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-chart-line ml-2"></i>
                            الإنفاق الشهري
                        </h2>
                    </div>
                    <div class="card-body">
                        <div id="monthly-expenses-chart" style="height: 300px;"></div>
                    </div>
                </div>
            </div>

            <!-- Top Expenses and Recent Transactions -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-list-ol ml-2"></i>
                            أعلى بنود الإنفاق
                        </h2>
                    </div>
                    <div class="card-body">
                        <div id="top-expenses-list"></div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-history ml-2"></i>
                            العمليات الأخيرة
                        </h2>
                    </div>
                    <div class="card-body">
                        <div id="recent-transactions-list"></div>
                    </div>
                </div>
            </div>

            <!-- Expenses List -->
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-table ml-2"></i>
                            قائمة المصروفات
                        </h2>
                        <div class="flex items-center gap-4">
                            <input type="text" id="expense-search" class="form-input" style="max-width: 300px;" placeholder="البحث...">
                            <select id="expense-filter-category" class="form-input" style="max-width: 200px;">
                                <option value="">جميع الفئات</option>
                                <option value="معدات">معدات</option>
                                <option value="تدريب">تدريب</option>
                                <option value="صيانة">صيانة</option>
                                <option value="أدوات حماية">أدوات حماية</option>
                                <option value="طوارئ">طوارئ</option>
                                <option value="OPEX">OPEX</option>
                                <option value="CAPEX">CAPEX</option>
                                <option value="أخرى">أخرى</option>
                            </select>
                            <select id="expense-filter-year" class="form-input" style="max-width: 150px;">
                                <option value="">جميع السنوات</option>
                            </select>
                            <select id="expense-filter-month" class="form-input" style="max-width: 150px;">
                                <option value="">جميع الأشهر</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div id="expenses-table-container">
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

    setupEventListeners() {
        const addBudgetBtn = document.getElementById('add-budget-btn');
        const addExpenseBtn = document.getElementById('add-expense-btn');
        const expenseSearch = document.getElementById('expense-search');
        const allSearch = document.getElementById('all-search');
        const expenseFilterCategory = document.getElementById('expense-filter-category');
        const allFilterCategory = document.getElementById('all-filter-category');
        const expenseFilterYear = document.getElementById('expense-filter-year');
        const allFilterYear = document.getElementById('all-filter-year');
        const expenseFilterMonth = document.getElementById('expense-filter-month');
        const allFilterMonth = document.getElementById('all-filter-month');

        if (addBudgetBtn) {
            addBudgetBtn.addEventListener('click', () => this.showBudgetForm());
        }
        if (addExpenseBtn) {
            addExpenseBtn.addEventListener('click', () => this.showExpenseForm());
        }
        if (expenseSearch) {
            expenseSearch.addEventListener('input', () => this.loadExpensesList());
        }
        if (allSearch) {
            allSearch.addEventListener('input', () => this.loadExpensesList());
        }
        if (expenseFilterCategory) {
            expenseFilterCategory.addEventListener('change', () => this.loadExpensesList());
        }
        if (allFilterCategory) {
            allFilterCategory.addEventListener('change', () => this.loadExpensesList());
        }
        if (expenseFilterYear) {
            expenseFilterYear.addEventListener('change', () => this.loadExpensesList());
        }
        if (allFilterYear) {
            allFilterYear.addEventListener('change', () => this.loadExpensesList());
        }
        if (expenseFilterMonth) {
            expenseFilterMonth.addEventListener('change', () => this.loadExpensesList());
        }
        if (allFilterMonth) {
            allFilterMonth.addEventListener('change', () => this.loadExpensesList());
        }
    },

    loadDashboard() {
        this.updateDashboardStats();
        this.loadExpensesList();
        this.loadTopExpenses();
        this.loadRecentTransactions();
        this.renderCharts();
        this.populateYearMonthFilters('all');
        this.populateYearMonthFilters('expense'); // Keep for backward compatibility
    },

    updateDashboardStats() {
        const budgets = AppState.appData.safetyBudgets || [];
        const transactions = AppState.appData.safetyBudgetTransactions || [];

        const currentYear = new Date().getFullYear();
        const currentBudget = budgets.find(b => {
            const budgetYear = b.year ? parseInt(b.year) : new Date(b.createdAt || b.startDate).getFullYear();
            return budgetYear === currentYear && (b.status === 'نشط' || b.status === 'active' || !b.status);
        }) || budgets[budgets.length - 1];

        const budgetCurrency = currentBudget?.currency || this.defaultCurrency;
        const totalBudget = currentBudget ? (parseFloat(currentBudget.amount) || 0) : 0;

        // حساب المصروفات بنفس عملة الميزانية
        const totalExpenses = transactions
            .filter(t => (t.currency || this.defaultCurrency) === budgetCurrency)
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const remaining = totalBudget - totalExpenses;
        const consumptionPercent = totalBudget > 0 ? ((totalExpenses / totalBudget) * 100).toFixed(1) : 0;

        const totalBudgetEl = document.getElementById('total-budget');
        const totalExpensesEl = document.getElementById('total-expenses');
        const remainingEl = document.getElementById('remaining-budget');
        const consumptionEl = document.getElementById('consumption-percentage');
        const consumptionBar = document.getElementById('consumption-bar');
        const budgetCurrencyEl = document.getElementById('total-budget-currency');
        const expensesCurrencyEl = document.getElementById('total-expenses-currency');
        const remainingCurrencyEl = document.getElementById('remaining-budget-currency');

        if (totalBudgetEl) totalBudgetEl.textContent = this.formatCurrency(totalBudget, budgetCurrency);
        if (totalExpensesEl) totalExpensesEl.textContent = this.formatCurrency(totalExpenses, budgetCurrency);
        if (budgetCurrencyEl) budgetCurrencyEl.textContent = this.currencies[budgetCurrency]?.name || 'جنيه مصري';
        if (expensesCurrencyEl) expensesCurrencyEl.textContent = this.currencies[budgetCurrency]?.name || 'جنيه مصري';
        if (remainingCurrencyEl) remainingCurrencyEl.textContent = this.currencies[budgetCurrency]?.name || 'جنيه مصري';

        if (remainingEl) {
            remainingEl.textContent = this.formatCurrency(remaining, budgetCurrency);
            remainingEl.className = remaining >= 0 ? 'text-2xl font-bold text-green-600' : 'text-2xl font-bold text-red-600';
        }
        if (consumptionEl) {
            consumptionEl.textContent = consumptionPercent + '%';
            consumptionEl.className = parseFloat(consumptionPercent) > 90 ? 'text-2xl font-bold text-red-600' :
                parseFloat(consumptionPercent) > 70 ? 'text-2xl font-bold text-yellow-600' :
                    'text-2xl font-bold text-green-600';
        }
        if (consumptionBar) {
            const percent = Math.min(100, Math.max(0, parseFloat(consumptionPercent)));
            consumptionBar.style.width = percent + '%';
            consumptionBar.className = percent > 90 ? 'bg-red-600 h-2 rounded-full transition-all duration-500' :
                percent > 70 ? 'bg-yellow-600 h-2 rounded-full transition-all duration-500' :
                    'bg-blue-600 h-2 rounded-full transition-all duration-500';
        }
    },

    loadExpensesList() {
        const container = document.getElementById('all-table-container') || document.getElementById('expenses-table-container');
        if (!container) return;

        const transactions = AppState.appData.safetyBudgetTransactions || [];
        const searchTerm = (document.getElementById('all-search')?.value || document.getElementById('expense-search')?.value || '').toLowerCase();
        const categoryFilter = document.getElementById('all-filter-category')?.value || document.getElementById('expense-filter-category')?.value || '';
        const yearFilter = document.getElementById('all-filter-year')?.value || document.getElementById('expense-filter-year')?.value || '';
        const monthFilter = document.getElementById('all-filter-month')?.value || document.getElementById('expense-filter-month')?.value || '';

        let filtered = transactions.filter(t => {
            const matchesSearch = !searchTerm ||
                (t.description || '').toLowerCase().includes(searchTerm) ||
                (t.vendor || '').toLowerCase().includes(searchTerm) ||
                (t.invoiceNumber || '').toLowerCase().includes(searchTerm);
            const matchesCategory = !categoryFilter || t.category === categoryFilter;
            const transactionDate = t.date ? new Date(t.date) : new Date(t.createdAt);
            const matchesYear = !yearFilter || transactionDate.getFullYear().toString() === yearFilter;
            const matchesMonth = !monthFilter || (transactionDate.getMonth() + 1).toString() === monthFilter;
            return matchesSearch && matchesCategory && matchesYear && matchesMonth;
        });

        filtered.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt);
            const dateB = new Date(b.date || b.createdAt);
            return dateB - dateA;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد مصروفات مسجلة</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>التاريخ</th>
                            <th>الفئة</th>
                            <th>الوصف</th>
                            <th>الجهة</th>
                            <th>المبلغ</th>
                            <th>العملة</th>
                            <th>رقم الفاتورة</th>
                            <th>المرفقات</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(t => `
                            <tr>
                                <td>${Utils.formatDate(t.date || t.createdAt)}</td>
                                <td><span class="badge badge-info">${Utils.escapeHTML(t.category || '')}</span></td>
                                <td>${Utils.escapeHTML(t.description || '')}</td>
                                <td>${Utils.escapeHTML(t.vendor || '')}</td>
                                <td class="font-semibold">${this.formatCurrency(parseFloat(t.amount) || 0, t.currency || this.defaultCurrency)}</td>
                                <td><span class="badge badge-secondary">${this.currencies[t.currency || this.defaultCurrency]?.symbol || 'ج.م'}</span></td>
                                <td>${Utils.escapeHTML(t.invoiceNumber || '-')}</td>
                                <td>
                                    ${(t.attachments || []).length > 0 ?
                `<span class="badge badge-success">${(t.attachments || []).length} مرفق</span>` :
                '<span class="text-gray-400">-</span>'}
                                </td>
                                <td>
                                    <div class="flex items-center gap-2">
                                        <button class="btn-icon btn-icon-primary" onclick="SafetyBudget.viewExpense('${t.id}')" title="عرض">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        ${Permissions.hasAccess('safety-budget') ? `
                                            <button class="btn-icon btn-icon-warning" onclick="SafetyBudget.editExpense('${t.id}')" title="تعديل">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn-icon btn-icon-danger" onclick="SafetyBudget.deleteExpense('${t.id}')" title="حذف">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    loadTopExpenses() {
        const container = document.getElementById('top-expenses-list');
        if (!container) return;

        const transactions = AppState.appData.safetyBudgetTransactions || [];
        const topExpenses = [...transactions]
            .sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))
            .slice(0, 5);

        if (topExpenses.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500">لا توجد مصروفات مسجلة</p>';
            return;
        }

        container.innerHTML = topExpenses.map((expense, index) => `
            <div class="flex items-center justify-between p-3 border-b border-gray-200 last:border-b-0">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                        ${index + 1}
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-gray-800">${Utils.escapeHTML(expense.description || '')}</p>
                        <p class="text-xs text-gray-500">${Utils.escapeHTML(expense.category || '')} - ${Utils.formatDate(expense.date || expense.createdAt)}</p>
                    </div>
                </div>
                <div class="text-left">
                    <p class="text-sm font-bold text-red-600">${this.formatCurrency(parseFloat(expense.amount) || 0, expense.currency || this.defaultCurrency)}</p>
                </div>
            </div>
        `).join('');
    },

    loadRecentTransactions() {
        const container = document.getElementById('recent-transactions-list');
        if (!container) return;

        const transactions = AppState.appData.safetyBudgetTransactions || [];
        const recent = [...transactions]
            .sort((a, b) => {
                const dateA = new Date(a.date || a.createdAt);
                const dateB = new Date(b.date || b.createdAt);
                return dateB - dateA;
            })
            .slice(0, 5);

        if (recent.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500">لا توجد عمليات مسجلة</p>';
            return;
        }

        container.innerHTML = recent.map(t => `
            <div class="flex items-center justify-between p-3 border-b border-gray-200 last:border-b-0">
                <div>
                    <p class="text-sm font-semibold text-gray-800">${Utils.escapeHTML(t.description || '')}</p>
                    <p class="text-xs text-gray-500">${Utils.formatDate(t.date || t.createdAt)}</p>
                </div>
                <div class="text-left">
                    <p class="text-sm font-bold text-blue-600">${this.formatCurrency(parseFloat(t.amount) || 0, t.currency || this.defaultCurrency)}</p>
                    <span class="badge badge-info text-xs">${Utils.escapeHTML(t.category || '')}</span>
                </div>
            </div>
        `).join('');
    },

    renderCharts() {
        this.renderCategoryChart();
        this.renderMonthlyChart();
    },

    renderCategoryChart() {
        const container = document.getElementById('expenses-by-category-chart');
        if (!container) return;

        const transactions = AppState.appData.safetyBudgetTransactions || [];
        const categories = this.expenseCategories;
        const categoryTotals = {};

        categories.forEach(cat => {
            categoryTotals[cat] = transactions
                .filter(t => t.category === cat)
                .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        });

        const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
        if (total === 0) {
            container.innerHTML = '<div class="empty-state"><p class="text-gray-500">لا توجد بيانات</p></div>';
            return;
        }

        container.innerHTML = categories.map(cat => {
            const amount = categoryTotals[cat] || 0;
            const percent = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
            return `
                <div class="mb-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-semibold">${cat}</span>
                        <span class="text-sm font-bold">${this.formatCurrency(amount)} (${percent}%)</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-3">
                        <div class="bg-blue-600 h-3 rounded-full transition-all duration-500" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderMonthlyChart() {
        const container = document.getElementById('monthly-expenses-chart');
        if (!container) return;

        const transactions = AppState.appData.safetyBudgetTransactions || [];
        const monthlyTotals = {};
        const currentYear = new Date().getFullYear();

        transactions.forEach(t => {
            const date = t.date ? new Date(t.date) : new Date(t.createdAt);
            if (date.getFullYear() === currentYear) {
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + (parseFloat(t.amount) || 0);
            }
        });

        const months = [];
        for (let i = 1; i <= 12; i++) {
            const monthKey = `${currentYear}-${String(i).padStart(2, '0')}`;
            months.push({
                key: monthKey,
                name: new Date(currentYear, i - 1).toLocaleDateString('ar-SA', { month: 'long' }),
                amount: monthlyTotals[monthKey] || 0
            });
        }

        const maxAmount = Math.max(...months.map(m => m.amount), 1);

        container.innerHTML = `
            <div class="flex items-end gap-2" style="height: 100%;">
                ${months.map(month => {
            const height = maxAmount > 0 ? ((month.amount / maxAmount) * 100) : 0;
            return `
                        <div class="flex-1 flex flex-col items-center gap-2">
                            <div class="w-full bg-gray-200 rounded-t relative" style="height: 200px;">
                                <div class="bg-blue-500 rounded-t transition-all duration-500 hover:bg-blue-600 absolute bottom-0 w-full" 
                                     style="height: ${height}%;" 
                                     title="${month.name}: ${this.formatCurrency(month.amount)}">
                                </div>
                            </div>
                            <span class="text-xs text-gray-600" style="writing-mode: vertical-rl; text-orientation: mixed;">${month.name.substring(0, 3)}</span>
                            <span class="text-xs font-semibold text-gray-700">${month.amount.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    },

    populateYearMonthFilters(prefix = 'expense') {
        const transactions = AppState.appData.safetyBudgetTransactions || [];
        const years = new Set();
        transactions.forEach(t => {
            const date = t.date ? new Date(t.date) : new Date(t.createdAt);
            years.add(date.getFullYear());
        });

        const yearSelect = document.getElementById(`${prefix}-filter-year`);
        const monthSelect = document.getElementById(`${prefix}-filter-month`);

        if (yearSelect) {
            const sortedYears = Array.from(years).sort((a, b) => b - a);
            yearSelect.innerHTML = '<option value="">جميع السنوات</option>' +
                sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
        }

        if (monthSelect) {
            const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
            monthSelect.innerHTML = '<option value="">جميع الأشهر</option>' +
                months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
        }
    },

    showBudgetForm(budgetData = null) {
        const isEdit = !!budgetData;
        const currentCurrency = budgetData?.currency || this.defaultCurrency;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px 8px 0 0;">
                    <h2 class="modal-title" style="color: white;">
                        <i class="fas fa-wallet ml-2"></i>
                        ${isEdit ? 'تعديل الميزانية' : 'إضافة ميزانية جديدة'}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="budget-form" class="modal-body" style="padding: 24px;">
                    <div class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-calendar-alt ml-2 text-blue-600"></i>
                                    السنة المالية *
                                </label>
                                <input type="number" id="budget-year" class="form-input" 
                                       value="${budgetData ? (budgetData.year || new Date(budgetData.createdAt).getFullYear()) : new Date().getFullYear()}" 
                                       min="2020" max="2100" required
                                       style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-coins ml-2 text-green-600"></i>
                                    العملة *
                                </label>
                                <select id="budget-currency" class="form-input" required
                                        style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                                    <option value="EGP" ${currentCurrency === 'EGP' ? 'selected' : ''}>جنيه مصري (ج.م)</option>
                                    <option value="USD" ${currentCurrency === 'USD' ? 'selected' : ''}>دولار أمريكي ($)</option>
                                </select>
                            </div>
                        </div>
                        <div class="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border-2 border-blue-200">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-money-bill-wave ml-2 text-blue-600"></i>
                                المبلغ المعتمد *
                            </label>
                            <div class="flex items-center gap-2">
                                <input type="number" id="budget-amount" class="form-input flex-1" 
                                       value="${budgetData ? (parseFloat(budgetData.amount) || 0) : ''}" 
                                       step="0.01" min="0" required
                                       placeholder="أدخل المبلغ"
                                       style="border: 2px solid #3b82f6; border-radius: 8px; padding: 12px; font-size: 18px; font-weight: bold;">
                                <span id="budget-currency-display" class="text-lg font-bold text-blue-600 px-3 py-2 bg-white rounded-lg border-2 border-blue-200">
                                    ${this.getCurrencySymbol(currentCurrency)}
                                </span>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">
                                <i class="fas fa-info-circle ml-1"></i>
                                سيتم استخدام هذه العملة كعملة افتراضية لجميع المصروفات المرتبطة بهذه الميزانية
                            </p>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-file-alt ml-2 text-purple-600"></i>
                                الوصف / الملاحظات
                            </label>
                            <textarea id="budget-description" class="form-input" rows="3" 
                                      placeholder="أدخل وصفاً أو ملاحظات حول الميزانية..."
                                      style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; resize: vertical;">${Utils.escapeHTML(budgetData?.description || '')}</textarea>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-toggle-on ml-2 text-orange-600"></i>
                                    الحالة
                                </label>
                                <select id="budget-status" class="form-input"
                                        style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                                    <option value="نشط" ${budgetData?.status === 'نشط' || !budgetData ? 'selected' : ''}>نشط</option>
                                    <option value="مغلق" ${budgetData?.status === 'مغلق' ? 'selected' : ''}>مغلق</option>
                                </select>
                            </div>
                            <div class="flex items-end">
                                <div class="w-full p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <p class="text-xs text-gray-500 mb-1">تاريخ الإنشاء</p>
                                    <p class="text-sm font-semibold text-gray-700">
                                        ${budgetData ? Utils.formatDate(budgetData.createdAt) : Utils.formatDate(new Date().toISOString())}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-4 pt-6 border-t mt-6">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px;">
                            <i class="fas fa-times ml-2"></i>إلغاء
                        </button>
                        <button type="submit" class="btn-primary" style="padding: 10px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            <i class="fas fa-save ml-2"></i>
                            ${isEdit ? 'حفظ التعديلات' : 'حفظ الميزانية'}
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // تحديث رمز العملة عند تغيير العملة
        const currencySelect = modal.querySelector('#budget-currency');
        const currencyDisplay = modal.querySelector('#budget-currency-display');
        if (currencySelect && currencyDisplay) {
            currencySelect.addEventListener('change', (e) => {
                const selectedCurrency = e.target.value;
                currencyDisplay.textContent = this.getCurrencySymbol(selectedCurrency);
            });
        }

        const form = document.getElementById('budget-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleBudgetSubmit(budgetData?.id, modal);
            });
        }
    },

    async handleBudgetSubmit(budgetId, modal) {
        // فحص العناصر قبل الاستخدام
        const yearEl = document.getElementById('budget-year');
        const amountEl = document.getElementById('budget-amount');
        const currencyEl = document.getElementById('budget-currency');
        const descriptionEl = document.getElementById('budget-description');
        const statusEl = document.getElementById('budget-status');
        
        if (!yearEl || !amountEl || !statusEl) {
            Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
            return;
        }

        const formData = {
            id: budgetId || Utils.generateId('BUDGET'),
            year: parseInt(yearEl.value),
            amount: parseFloat(amountEl.value),
            currency: currencyEl?.value || this.defaultCurrency,
            description: descriptionEl?.value.trim() || '',
            status: statusEl.value,
            createdAt: budgetId ? AppState.appData.safetyBudgets.find(b => b.id === budgetId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (!formData.year || !formData.amount || formData.amount <= 0) {
            Notification.error('يرجى ملء جميع الحقول المطلوبة بشكل صحيح');
            return;
        }

        Loading.show();
        try {
            if (budgetId) {
                const index = AppState.appData.safetyBudgets.findIndex(b => b.id === budgetId);
                if (index !== -1) {
                    AppState.appData.safetyBudgets[index] = formData;
                    Notification.success('تم تحديث الميزانية بنجاح');
                }
            } else {
                AppState.appData.safetyBudgets.push(formData);
                Notification.success('تم إضافة الميزانية بنجاح');
            }

            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            await GoogleIntegration.autoSave('SafetyBudgets', AppState.appData.safetyBudgets);

            AuditLog.log(budgetId ? 'update_budget' : 'create_budget', 'SafetyBudget', formData.id, {
                year: formData.year,
                amount: formData.amount
            });

            Loading.hide();
            modal.remove();
            this.loadDashboard();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    showExpenseForm(expenseData = null) {
        const isEdit = !!expenseData;
        const currentCurrency = expenseData?.currency || this.defaultCurrency;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border-radius: 8px 8px 0 0;">
                    <h2 class="modal-title" style="color: white;">
                        <i class="fas fa-receipt ml-2"></i>
                        ${isEdit ? 'تعديل المصروف' : 'تسجيل مصروف جديد'}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="expense-form" class="modal-body" style="padding: 24px;">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-calendar-alt ml-2 text-blue-600"></i>
                                التاريخ *
                            </label>
                            <input type="date" id="expense-date" class="form-input" 
                                   value="${expenseData ? (expenseData.date ? new Date(expenseData.date).toISOString().split('T')[0] : '') : new Date().toISOString().split('T')[0]}" 
                                   required
                                   style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-tags ml-2 text-purple-600"></i>
                                نوع المصروف (الفئة) *
                            </label>
                            <select id="expense-category" class="form-input" required
                                    style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                                <option value="">اختر الفئة</option>
                                <option value="معدات" ${expenseData?.category === 'معدات' ? 'selected' : ''}>معدات</option>
                                <option value="تدريب" ${expenseData?.category === 'تدريب' ? 'selected' : ''}>تدريب</option>
                                <option value="صيانة" ${expenseData?.category === 'صيانة' ? 'selected' : ''}>صيانة</option>
                                <option value="أدوات حماية" ${expenseData?.category === 'أدوات حماية' ? 'selected' : ''}>أدوات حماية</option>
                                <option value="طوارئ" ${expenseData?.category === 'طوارئ' ? 'selected' : ''}>طوارئ</option>
                                <option value="OPEX" ${expenseData?.category === 'OPEX' ? 'selected' : ''}>OPEX (مصروفات تشغيلية)</option>
                                <option value="CAPEX" ${expenseData?.category === 'CAPEX' ? 'selected' : ''}>CAPEX (مصروفات رأسمالية)</option>
                                <option value="أخرى" ${expenseData?.category === 'أخرى' ? 'selected' : ''}>أخرى</option>
                            </select>
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-align-right ml-2 text-green-600"></i>
                                الوصف *
                            </label>
                            <input type="text" id="expense-description" class="form-input" 
                                   value="${Utils.escapeHTML(expenseData?.description || '')}" 
                                   required
                                   placeholder="أدخل وصفاً تفصيلياً للمصروف..."
                                   style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-building ml-2 text-orange-600"></i>
                                الجهة / المورد *
                            </label>
                            <input type="text" id="expense-vendor" class="form-input" 
                                   value="${Utils.escapeHTML(expenseData?.vendor || '')}" 
                                   required
                                   placeholder="اسم المورد أو الجهة"
                                   style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-coins ml-2 text-yellow-600"></i>
                                العملة *
                            </label>
                            <select id="expense-currency" class="form-input" required
                                    style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                                <option value="EGP" ${currentCurrency === 'EGP' ? 'selected' : ''}>جنيه مصري (ج.م)</option>
                                <option value="USD" ${currentCurrency === 'USD' ? 'selected' : ''}>دولار أمريكي ($)</option>
                            </select>
                        </div>
                        <div class="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-lg border-2 border-red-200">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-money-bill-wave ml-2 text-red-600"></i>
                                القيمة *
                            </label>
                            <div class="flex items-center gap-2">
                                <input type="number" id="expense-amount" class="form-input flex-1" 
                                       value="${expenseData ? (parseFloat(expenseData.amount) || 0) : ''}" 
                                       step="0.01" min="0" required
                                       placeholder="أدخل المبلغ"
                                       style="border: 2px solid #ef4444; border-radius: 8px; padding: 12px; font-size: 18px; font-weight: bold;">
                                <span id="expense-currency-display" class="text-lg font-bold text-red-600 px-3 py-2 bg-white rounded-lg border-2 border-red-200">
                                    ${this.getCurrencySymbol(currentCurrency)}
                                </span>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-file-invoice ml-2"></i>
                                رقم الفاتورة
                            </label>
                            <input type="text" id="expense-invoice" class="form-input" 
                                   value="${Utils.escapeHTML(expenseData?.invoiceNumber || '')}">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-paperclip ml-2"></i>
                                المرفقات (PDF / صورة)
                            </label>
                            <input type="file" id="expense-attachments" class="form-input" 
                                   accept=".pdf,.jpg,.jpeg,.png" multiple>
                            <p class="text-xs text-gray-500 mt-1">يمكن رفع عدة ملفات (PDF أو صور)</p>
                            <div id="expense-attachments-list" class="mt-3 space-y-2"></div>
                            ${expenseData && expenseData.attachments && expenseData.attachments.length > 0 ? `
                                <div class="mt-3">
                                    <p class="text-sm font-semibold mb-2">المرفقات الحالية:</p>
                                    ${expenseData.attachments.map((att, idx) => `
                                        <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-2">
                                            <div class="flex items-center gap-2">
                                                <i class="fas fa-paperclip text-blue-500"></i>
                                                <span class="text-sm">${Utils.escapeHTML(att.name || 'مرفق')}</span>
                                            </div>
                                            <button type="button" class="btn-icon btn-icon-danger" onclick="this.closest('div').remove()">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-4 pt-4 border-t mt-6">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save ml-2"></i>
                            ${isEdit ? 'حفظ التعديلات' : 'تسجيل المصروف'}
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // تحديث رمز العملة عند تغيير العملة
        const currencySelect = modal.querySelector('#expense-currency');
        const currencyDisplay = modal.querySelector('#expense-currency-display');
        if (currencySelect && currencyDisplay) {
            currencySelect.addEventListener('change', (e) => {
                const selectedCurrency = e.target.value;
                currencyDisplay.textContent = this.getCurrencySymbol(selectedCurrency);
            });
        }

        const attachmentsInput = document.getElementById('expense-attachments');
        if (attachmentsInput) {
            attachmentsInput.addEventListener('change', (e) => {
                this.handleAttachmentsChange(e.target.files, modal);
            });
        }

        const form = document.getElementById('expense-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleExpenseSubmit(expenseData?.id, modal);
            });
        }

        this.currentAttachments = expenseData?.attachments ? [...expenseData.attachments] : [];
    },

    async handleAttachmentsChange(fileList, modal) {
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

        if (validFiles.length === 0) return;

        Loading.show('جاري معالجة المرفقات...');
        try {
            for (const file of validFiles) {
                const base64 = await this.readFileAsBase64(file);
                const attachment = {
                    id: Utils.generateId('ATT'),
                    name: file.name,
                    type: file.type,
                    data: base64,
                    size: Math.round(file.size / 1024)
                };
                if (!this.currentAttachments) this.currentAttachments = [];
                this.currentAttachments.push(attachment);
            }
            this.renderAttachmentsList(modal);
            const input = document.getElementById('expense-attachments');
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

    renderAttachmentsList(modal) {
        const container = modal.querySelector('#expense-attachments-list');
        if (!container) return;

        if (!this.currentAttachments || this.currentAttachments.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = this.currentAttachments.map((att, index) => `
            <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2" data-attachment-index="${index}">
                <div class="flex items-center gap-2">
                    <i class="fas fa-paperclip text-blue-500"></i>
                    <div>
                        <div class="text-sm font-medium text-gray-700">${Utils.escapeHTML(att.name || 'attachment')}</div>
                        <div class="text-xs text-gray-500">${att.size || 0} KB</div>
                    </div>
                </div>
                <button type="button" class="btn-icon btn-icon-danger" onclick="SafetyBudget.removeAttachment(${index}, this)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    },

    removeAttachment(index, button) {
        if (this.currentAttachments && this.currentAttachments[index]) {
            this.currentAttachments.splice(index, 1);
            const container = button.closest('.modal-overlay')?.querySelector('#expense-attachments-list');
            if (container) this.renderAttachmentsList(button.closest('.modal-overlay'));
        }
    },

    async handleExpenseSubmit(expenseId, modal) {
        // فحص العناصر قبل الاستخدام
        const dateEl = document.getElementById('expense-date');
        const categoryEl = document.getElementById('expense-category');
        const descriptionEl = document.getElementById('expense-description');
        const vendorEl = document.getElementById('expense-vendor');
        const currencyEl = document.getElementById('expense-currency');
        const amountEl = document.getElementById('expense-amount');
        const invoiceEl = document.getElementById('expense-invoice');
        
        if (!dateEl || !categoryEl || !descriptionEl || !vendorEl || !amountEl) {
            Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
            return;
        }

        const formData = {
            id: expenseId || Utils.generateId('EXPENSE'),
            date: new Date(dateEl.value).toISOString(),
            category: categoryEl.value,
            description: descriptionEl.value.trim(),
            vendor: vendorEl.value.trim(),
            currency: currencyEl?.value || this.defaultCurrency,
            amount: parseFloat(amountEl.value),
            invoiceNumber: invoiceEl?.value.trim() || '',
            attachments: this.currentAttachments || [],
            createdAt: expenseId ? AppState.appData.safetyBudgetTransactions.find(e => e.id === expenseId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (!formData.date || !formData.category || !formData.description || !formData.vendor || !formData.amount || formData.amount <= 0) {
            Notification.error('يرجى ملء جميع الحقول المطلوبة بشكل صحيح');
            return;
        }

        Loading.show();
        try {
            if (expenseId) {
                const index = AppState.appData.safetyBudgetTransactions.findIndex(e => e.id === expenseId);
                if (index !== -1) {
                    AppState.appData.safetyBudgetTransactions[index] = formData;
                    Notification.success('تم تحديث المصروف بنجاح');
                }
            } else {
                AppState.appData.safetyBudgetTransactions.push(formData);
                Notification.success('تم تسجيل المصروف بنجاح');
            }

            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            await GoogleIntegration.autoSave('SafetyBudgetTransactions', AppState.appData.safetyBudgetTransactions);

            AuditLog.log(expenseId ? 'update_expense' : 'create_expense', 'SafetyBudget', formData.id, {
                category: formData.category,
                amount: formData.amount
            });

            Loading.hide();
            modal.remove();
            this.loadDashboard();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    editExpense(id) {
        const expense = AppState.appData.safetyBudgetTransactions.find(e => e.id === id);
        if (expense) this.showExpenseForm(expense);
    },

    async deleteExpense(id) {
        if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;

        Loading.show();
        try {
            AppState.appData.safetyBudgetTransactions = AppState.appData.safetyBudgetTransactions.filter(e => e.id !== id);
            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            await GoogleIntegration.autoSave('SafetyBudgetTransactions', AppState.appData.safetyBudgetTransactions);

            AuditLog.log('delete_expense', 'SafetyBudget', id);

            Loading.hide();
            Notification.success('تم حذف المصروف بنجاح');
            this.loadDashboard();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    viewExpense(id) {
        const expense = AppState.appData.safetyBudgetTransactions.find(e => e.id === id);
        if (!expense) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-receipt ml-2"></i>
                        تفاصيل المصروف
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm text-gray-600">التاريخ</p>
                                <p class="text-base font-semibold">${Utils.formatDate(expense.date || expense.createdAt)}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">الفئة</p>
                                <p class="text-base font-semibold"><span class="badge badge-info">${Utils.escapeHTML(expense.category || '')}</span></p>
                            </div>
                            <div class="col-span-2">
                                <p class="text-sm text-gray-600">الوصف</p>
                                <p class="text-base font-semibold">${Utils.escapeHTML(expense.description || '')}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">الجهة / المورد</p>
                                <p class="text-base font-semibold">${Utils.escapeHTML(expense.vendor || '')}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">المبلغ</p>
                                <p class="text-2xl font-bold text-red-600">${this.formatCurrency(parseFloat(expense.amount) || 0, expense.currency || this.defaultCurrency)}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">العملة</p>
                                <p class="text-base font-semibold"><span class="badge badge-info">${this.currencies[expense.currency || this.defaultCurrency]?.name || 'جنيه مصري'}</span></p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">رقم الفاتورة</p>
                                <p class="text-base font-semibold">${Utils.escapeHTML(expense.invoiceNumber || '-')}</p>
                            </div>
                        </div>
                        ${expense.attachments && expense.attachments.length > 0 ? `
                            <div class="border-t pt-4">
                                <p class="text-sm font-semibold mb-3">المرفقات (${expense.attachments.length})</p>
                                <div class="space-y-2">
                                    ${expense.attachments.map(att => `
                                        <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2">
                                            <div class="flex items-center gap-2">
                                                <i class="fas fa-paperclip text-blue-500"></i>
                                                <span class="text-sm">${Utils.escapeHTML(att.name || 'مرفق')}</span>
                                                <span class="text-xs text-gray-500">(${att.size || 0} KB)</span>
                                            </div>
                                            <button class="btn-icon btn-icon-primary" onclick="SafetyBudget.downloadAttachment('${att.id}', '${expense.id}')" title="تحميل">
                                                <i class="fas fa-download"></i>
                                            </button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                    ${Permissions.hasAccess('safety-budget') ? `
                        <button class="btn-primary" onclick="SafetyBudget.editExpense('${expense.id}'); this.closest('.modal-overlay').remove();">
                            <i class="fas fa-edit ml-2"></i>تعديل
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    downloadAttachment(attachmentId, expenseId) {
        const expense = AppState.appData.safetyBudgetTransactions.find(e => e.id === expenseId);
        if (!expense || !expense.attachments) return;

        const attachment = expense.attachments.find(a => a.id === attachmentId);
        if (!attachment || !attachment.data) return;

        const link = document.createElement('a');
        link.href = attachment.data;
        link.download = attachment.name || 'attachment';
        link.click();
    },

    async exportReport(format = 'pdf', categoryFilter = null) {
        // التحقق من وجود AppState و appData
        if (typeof AppState === 'undefined' || !AppState.appData) {
            Notification.error('البيانات غير متوفرة. يرجى تحديث الصفحة');
            return;
        }

        const budgets = AppState.appData.safetyBudgets || [];
        let transactions = AppState.appData.safetyBudgetTransactions || [];

        // التحقق من أن البيانات هي arrays
        if (!Array.isArray(budgets)) {
            Notification.error('بيانات الميزانيات غير صحيحة');
            return;
        }
        if (!Array.isArray(transactions)) {
            Notification.error('بيانات المعاملات غير صحيحة');
            return;
        }

        // فلترة حسب الفئة إذا تم تحديدها
        if (categoryFilter && (categoryFilter === 'OPEX' || categoryFilter === 'CAPEX')) {
            transactions = transactions.filter(t => t.category === categoryFilter);
        }
        const currentYear = new Date().getFullYear();
        const currentBudget = budgets.find(b => {
            const budgetYear = b.year ? parseInt(b.year) : new Date(b.createdAt || b.startDate).getFullYear();
            return budgetYear === currentYear && (b.status === 'نشط' || b.status === 'active' || !b.status);
        }) || budgets[budgets.length - 1];

        const budgetCurrency = currentBudget?.currency || this.defaultCurrency;
        const totalBudget = currentBudget ? (parseFloat(currentBudget.amount) || 0) : 0;
        const totalExpenses = transactions
            .filter(t => (t.currency || this.defaultCurrency) === budgetCurrency)
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const remaining = totalBudget - totalExpenses;

        if (format === 'excel') {
            if (typeof XLSX === 'undefined') {
                Notification.error('مكتبة Excel غير متوفرة');
                return;
            }

            const wb = XLSX.utils.book_new();
            const wsData = [
                ['تاريخ', 'الفئة', 'الوصف', 'الجهة', 'المبلغ', 'العملة', 'رقم الفاتورة']
            ];

            transactions.forEach(t => {
                wsData.push([
                    Utils.formatDate(t.date || t.createdAt),
                    t.category || '',
                    t.description || '',
                    t.vendor || '',
                    parseFloat(t.amount) || 0,
                    t.currency || this.defaultCurrency,
                    t.invoiceNumber || ''
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, 'مصروفات السلامة');
            XLSX.writeFile(wb, `تقرير_ميزانية_السلامة_${currentYear}.xlsx`);
            Notification.success('تم تصدير التقرير بنجاح');
            return;
        }

        // PDF Report
        const content = `
            <div style="direction: rtl; text-align: right; font-family: 'Cairo', Arial, sans-serif; padding: 20px;">
                <h1 style="color: #1e40af; margin-bottom: 20px;">تقرير ميزانية السلامة وتتبع الإنفاق</h1>
                <div style="margin-bottom: 30px;">
                    <p><strong>السنة:</strong> ${currentYear}</p>
                    <p><strong>العملة:</strong> ${this.currencies[budgetCurrency]?.name || 'جنيه مصري'}</p>
                    <p><strong>الميزانية المعتمدة:</strong> ${this.formatCurrency(totalBudget, budgetCurrency)}</p>
                    <p><strong>إجمالي المصروفات:</strong> ${this.formatCurrency(totalExpenses, budgetCurrency)}</p>
                    <p><strong>المتبقي:</strong> ${this.formatCurrency(remaining, budgetCurrency)}</p>
                    <p><strong>نسبة الاستهلاك:</strong> ${totalBudget > 0 ? ((totalExpenses / totalBudget) * 100).toFixed(1) : 0}%</p>
                </div>
                <h2 style="color: #1e40af; margin-top: 30px; margin-bottom: 15px;">تفاصيل المصروفات</h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">التاريخ</th>
                            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">الفئة</th>
                            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">الوصف</th>
                            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">الجهة</th>
                            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">المبلغ</th>
                            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">العملة</th>
                            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">رقم الفاتورة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map(t => `
                            <tr>
                                <td style="border: 1px solid #e5e7eb; padding: 8px;">${Utils.formatDate(t.date || t.createdAt)}</td>
                                <td style="border: 1px solid #e5e7eb; padding: 8px;">${Utils.escapeHTML(t.category || '')}</td>
                                <td style="border: 1px solid #e5e7eb; padding: 8px;">${Utils.escapeHTML(t.description || '')}</td>
                                <td style="border: 1px solid #e5e7eb; padding: 8px;">${Utils.escapeHTML(t.vendor || '')}</td>
                                <td style="border: 1px solid #e5e7eb; padding: 8px;">${this.formatCurrency(parseFloat(t.amount) || 0, t.currency || this.defaultCurrency)}</td>
                                <td style="border: 1px solid #e5e7eb; padding: 8px;">${this.currencies[t.currency || this.defaultCurrency]?.name || 'جنيه مصري'}</td>
                                <td style="border: 1px solid #e5e7eb; padding: 8px;">${Utils.escapeHTML(t.invoiceNumber || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">تاريخ الإنشاء: ${new Date().toLocaleDateString('ar-SA')}</p>
            </div>
        `;

        const formCode = `BUDGET-REPORT-${currentYear}`;
        const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
            ? FormHeader.generatePDFHTML(formCode, 'تقرير ميزانية السلامة وتتبع الإنفاق', content, false, true, { version: '1.0' }, new Date().toISOString(), new Date().toISOString())
            : `<html><body>${content}</body></html>`;

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
                }, 500);
            };
        } else {
            Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
        }
    },

    // ===== OPEX Section =====
    async loadOPEX() {
        const section = document.getElementById('safety-budget-opex-section');
        if (!section) {
            Utils.safeError('قسم safety-budget-opex-section غير موجود!');
            return;
        }

        // ✅ تحميل القائمة بشكل آمن
        let opexListContent = '';
        try {
            opexListContent = await this.renderExpensesList('OPEX');
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في تحميل قائمة OPEX:', error);
            opexListContent = `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-4">حدث خطأ في تحميل البيانات</p>
                            <button onclick="SafetyBudget.showOPEXTab()" class="btn-primary">
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
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-chart-line ml-3" aria-hidden="true"></i>
                            OPEX - مصروفات تشغيلية
                        </h1>
                        <p class="section-subtitle">إدارة ومتابعة المصروفات التشغيلية للسلامة</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button id="export-opex-pdf-btn" class="btn-secondary" onclick="SafetyBudget.exportReport('pdf', 'OPEX')">
                            <i class="fas fa-file-pdf ml-2"></i>
                            تصدير PDF
                        </button>
                        <button id="add-opex-expense-btn" class="btn-primary" onclick="SafetyBudget.showExpenseForm(null, 'OPEX')">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة مصروف OPEX
                        </button>
                    </div>
                </div>
            </div>
            <div class="mt-6">
                ${opexListContent}
            </div>
        `;
        this.setupOPEXEventListeners();
        this.loadOPEXList();
    },

    async renderExpensesList(category) {
        const categoryName = category === 'all' ? 'جميع المصروفات' : category;
        const prefix = category === 'all' ? 'all' : category.toLowerCase();
        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-table ml-2"></i>
                            قائمة مصروفات ${categoryName}
                        </h2>
                        <div class="flex items-center gap-4">
                            <input type="text" id="${prefix}-search" class="form-input" style="max-width: 300px;" placeholder="البحث...">
                            ${category === 'all' ? `
                                <select id="${prefix}-filter-category" class="form-input" style="max-width: 200px;">
                                    <option value="">جميع الفئات</option>
                                    <option value="معدات">معدات</option>
                                    <option value="تدريب">تدريب</option>
                                    <option value="صيانة">صيانة</option>
                                    <option value="أدوات حماية">أدوات حماية</option>
                                    <option value="طوارئ">طوارئ</option>
                                    <option value="OPEX">OPEX</option>
                                    <option value="CAPEX">CAPEX</option>
                                    <option value="أخرى">أخرى</option>
                                </select>
                            ` : ''}
                            <select id="${prefix}-filter-year" class="form-input" style="max-width: 150px;">
                                <option value="">جميع السنوات</option>
                            </select>
                            <select id="${prefix}-filter-month" class="form-input" style="max-width: 150px;">
                                <option value="">جميع الأشهر</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div id="${prefix}-table-container">
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

    setupOPEXEventListeners() {
        const search = document.getElementById('opex-search');
        const yearFilter = document.getElementById('opex-filter-year');
        const monthFilter = document.getElementById('opex-filter-month');

        if (search) search.addEventListener('input', () => this.loadOPEXList());
        if (yearFilter) yearFilter.addEventListener('change', () => this.loadOPEXList());
        if (monthFilter) monthFilter.addEventListener('change', () => this.loadOPEXList());
    },

    loadOPEXList() {
        const container = document.getElementById('opex-table-container');
        if (!container) return;

        const transactions = (AppState.appData.safetyBudgetTransactions || []).filter(t => t.category === 'OPEX');
        const searchTerm = (document.getElementById('opex-search')?.value || '').toLowerCase();
        const yearFilter = document.getElementById('opex-filter-year')?.value || '';
        const monthFilter = document.getElementById('opex-filter-month')?.value || '';

        let filtered = transactions.filter(t => {
            const matchesSearch = !searchTerm ||
                (t.description || '').toLowerCase().includes(searchTerm) ||
                (t.vendor || '').toLowerCase().includes(searchTerm) ||
                (t.invoiceNumber || '').toLowerCase().includes(searchTerm);
            const transactionDate = t.date ? new Date(t.date) : new Date(t.createdAt);
            const matchesYear = !yearFilter || transactionDate.getFullYear().toString() === yearFilter;
            const matchesMonth = !monthFilter || (transactionDate.getMonth() + 1).toString() === monthFilter;
            return matchesSearch && matchesYear && matchesMonth;
        });

        filtered.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt);
            const dateB = new Date(b.date || b.createdAt);
            return dateB - dateA;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-line text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد مصروفات OPEX مسجلة</p>
                    <button class="btn-primary mt-4" onclick="SafetyBudget.showExpenseForm(null, 'OPEX')">
                        <i class="fas fa-plus ml-2"></i>
                        إضافة مصروف OPEX جديد
                    </button>
                </div>
            `;
            return;
        }

        const totalOPEX = filtered.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const currencies = {};
        filtered.forEach(t => {
            const curr = t.currency || this.defaultCurrency;
            currencies[curr] = (currencies[curr] || 0) + (parseFloat(t.amount) || 0);
        });

        container.innerHTML = `
            <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-gray-600">إجمالي مصروفات OPEX</p>
                        <div class="flex items-center gap-4 mt-2">
                            ${Object.entries(currencies).map(([curr, amount]) => `
                                <div>
                                    <p class="text-2xl font-bold text-blue-600">${this.formatCurrency(amount, curr)}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="text-sm text-gray-600">
                        <p>عدد المصروفات: <strong>${filtered.length}</strong></p>
                    </div>
                </div>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>التاريخ</th>
                            <th>الوصف</th>
                            <th>الجهة</th>
                            <th>المبلغ</th>
                            <th>العملة</th>
                            <th>رقم الفاتورة</th>
                            <th>المرفقات</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(t => `
                            <tr>
                                <td>${Utils.formatDate(t.date || t.createdAt)}</td>
                                <td>${Utils.escapeHTML(t.description || '')}</td>
                                <td>${Utils.escapeHTML(t.vendor || '')}</td>
                                <td class="font-semibold">${this.formatCurrency(parseFloat(t.amount) || 0, t.currency || this.defaultCurrency)}</td>
                                <td><span class="badge badge-secondary">${this.currencies[t.currency || this.defaultCurrency]?.symbol || 'ج.م'}</span></td>
                                <td>${Utils.escapeHTML(t.invoiceNumber || '-')}</td>
                                <td>
                                    ${(t.attachments || []).length > 0 ?
                `<span class="badge badge-success">${(t.attachments || []).length} مرفق</span>` :
                '<span class="text-gray-400">-</span>'}
                                </td>
                                <td>
                                    <div class="flex items-center gap-2">
                                        <button class="btn-icon btn-icon-primary" onclick="SafetyBudget.viewExpense('${t.id}')" title="عرض">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        ${Permissions.hasAccess('safety-budget') ? `
                                            <button class="btn-icon btn-icon-warning" onclick="SafetyBudget.editExpense('${t.id}')" title="تعديل">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn-icon btn-icon-danger" onclick="SafetyBudget.deleteExpense('${t.id}')" title="حذف">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.populateYearMonthFilters('opex');
    },

    // ===== CAPEX Section =====
    async loadCAPEX() {
        const section = document.getElementById('safety-budget-capex-section');
        if (!section) {
            Utils.safeError('قسم safety-budget-capex-section غير موجود!');
            return;
        }

        // ✅ تحميل القائمة بشكل آمن
        let capexListContent = '';
        try {
            capexListContent = await this.renderExpensesList('CAPEX');
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في تحميل قائمة CAPEX:', error);
            capexListContent = `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-4">حدث خطأ في تحميل البيانات</p>
                            <button onclick="SafetyBudget.showCAPEXTab()" class="btn-primary">
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
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-building ml-3" aria-hidden="true"></i>
                            CAPEX - مصروفات رأسمالية
                        </h1>
                        <p class="section-subtitle">إدارة ومتابعة المصروفات الرأسمالية للسلامة</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button id="export-capex-pdf-btn" class="btn-secondary" onclick="SafetyBudget.exportReport('pdf', 'CAPEX')">
                            <i class="fas fa-file-pdf ml-2"></i>
                            تصدير PDF
                        </button>
                        <button id="add-capex-expense-btn" class="btn-primary" onclick="SafetyBudget.showExpenseForm(null, 'CAPEX')">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة مصروف CAPEX
                        </button>
                    </div>
                </div>
            </div>
            <div class="mt-6">
                ${capexListContent}
            </div>
        `;
        this.setupCAPEXEventListeners();
        this.loadCAPEXList();
    },

    setupCAPEXEventListeners() {
        const search = document.getElementById('capex-search');
        const yearFilter = document.getElementById('capex-filter-year');
        const monthFilter = document.getElementById('capex-filter-month');

        if (search) search.addEventListener('input', () => this.loadCAPEXList());
        if (yearFilter) yearFilter.addEventListener('change', () => this.loadCAPEXList());
        if (monthFilter) monthFilter.addEventListener('change', () => this.loadCAPEXList());
    },

    loadCAPEXList() {
        const container = document.getElementById('capex-table-container');
        if (!container) return;

        const transactions = (AppState.appData.safetyBudgetTransactions || []).filter(t => t.category === 'CAPEX');
        const searchTerm = (document.getElementById('capex-search')?.value || '').toLowerCase();
        const yearFilter = document.getElementById('capex-filter-year')?.value || '';
        const monthFilter = document.getElementById('capex-filter-month')?.value || '';

        let filtered = transactions.filter(t => {
            const matchesSearch = !searchTerm ||
                (t.description || '').toLowerCase().includes(searchTerm) ||
                (t.vendor || '').toLowerCase().includes(searchTerm) ||
                (t.invoiceNumber || '').toLowerCase().includes(searchTerm);
            const transactionDate = t.date ? new Date(t.date) : new Date(t.createdAt);
            const matchesYear = !yearFilter || transactionDate.getFullYear().toString() === yearFilter;
            const matchesMonth = !monthFilter || (transactionDate.getMonth() + 1).toString() === monthFilter;
            return matchesSearch && matchesYear && matchesMonth;
        });

        filtered.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt);
            const dateB = new Date(b.date || b.createdAt);
            return dateB - dateA;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-building text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد مصروفات CAPEX مسجلة</p>
                    <button class="btn-primary mt-4" onclick="SafetyBudget.showExpenseForm(null, 'CAPEX')">
                        <i class="fas fa-plus ml-2"></i>
                        إضافة مصروف CAPEX جديد
                    </button>
                </div>
            `;
            return;
        }

        const totalCAPEX = filtered.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const currencies = {};
        filtered.forEach(t => {
            const curr = t.currency || this.defaultCurrency;
            currencies[curr] = (currencies[curr] || 0) + (parseFloat(t.amount) || 0);
        });

        container.innerHTML = `
            <div class="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-gray-600">إجمالي مصروفات CAPEX</p>
                        <div class="flex items-center gap-4 mt-2">
                            ${Object.entries(currencies).map(([curr, amount]) => `
                                <div>
                                    <p class="text-2xl font-bold text-purple-600">${this.formatCurrency(amount, curr)}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="text-sm text-gray-600">
                        <p>عدد المصروفات: <strong>${filtered.length}</strong></p>
                    </div>
                </div>
            </div>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>التاريخ</th>
                            <th>الوصف</th>
                            <th>الجهة</th>
                            <th>المبلغ</th>
                            <th>العملة</th>
                            <th>رقم الفاتورة</th>
                            <th>المرفقات</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(t => `
                            <tr>
                                <td>${Utils.formatDate(t.date || t.createdAt)}</td>
                                <td>${Utils.escapeHTML(t.description || '')}</td>
                                <td>${Utils.escapeHTML(t.vendor || '')}</td>
                                <td class="font-semibold">${this.formatCurrency(parseFloat(t.amount) || 0, t.currency || this.defaultCurrency)}</td>
                                <td><span class="badge badge-secondary">${this.currencies[t.currency || this.defaultCurrency]?.symbol || 'ج.م'}</span></td>
                                <td>${Utils.escapeHTML(t.invoiceNumber || '-')}</td>
                                <td>
                                    ${(t.attachments || []).length > 0 ?
                `<span class="badge badge-success">${(t.attachments || []).length} مرفق</span>` :
                '<span class="text-gray-400">-</span>'}
                                </td>
                                <td>
                                    <div class="flex items-center gap-2">
                                        <button class="btn-icon btn-icon-primary" onclick="SafetyBudget.viewExpense('${t.id}')" title="عرض">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        ${Permissions.hasAccess('safety-budget') ? `
                                            <button class="btn-icon btn-icon-warning" onclick="SafetyBudget.editExpense('${t.id}')" title="تعديل">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn-icon btn-icon-danger" onclick="SafetyBudget.deleteExpense('${t.id}')" title="حذف">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.populateYearMonthFilters('capex');
    },

    populateYearMonthFilters(prefix) {
        const transactions = AppState.appData.safetyBudgetTransactions || [];
        const years = new Set();
        transactions.forEach(t => {
            const date = t.date ? new Date(t.date) : new Date(t.createdAt);
            years.add(date.getFullYear());
        });

        const yearSelect = document.getElementById(`${prefix}-filter-year`);
        const monthSelect = document.getElementById(`${prefix}-filter-month`);

        if (yearSelect) {
            const sortedYears = Array.from(years).sort((a, b) => b - a);
            yearSelect.innerHTML = '<option value="">جميع السنوات</option>' +
                sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
        }

        if (monthSelect) {
            const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
            monthSelect.innerHTML = '<option value="">جميع الأشهر</option>' +
                months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
        }
    },

    showExpenseForm(expenseData = null, defaultCategory = null) {
        const isEdit = !!expenseData;
        const currentCurrency = expenseData?.currency || this.defaultCurrency;
        const selectedCategory = expenseData?.category || defaultCategory || '';
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border-radius: 8px 8px 0 0;">
                    <h2 class="modal-title" style="color: white;">
                        <i class="fas fa-receipt ml-2"></i>
                        ${isEdit ? 'تعديل المصروف' : 'تسجيل مصروف جديد'}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="expense-form" class="modal-body" style="padding: 24px;">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-calendar-alt ml-2 text-blue-600"></i>
                                التاريخ *
                            </label>
                            <input type="date" id="expense-date" class="form-input" 
                                   value="${expenseData ? (expenseData.date ? new Date(expenseData.date).toISOString().split('T')[0] : '') : new Date().toISOString().split('T')[0]}" 
                                   required
                                   style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-tags ml-2 text-purple-600"></i>
                                نوع المصروف (الفئة) *
                            </label>
                            <select id="expense-category" class="form-input" required
                                    style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                                <option value="">اختر الفئة</option>
                                <option value="معدات" ${selectedCategory === 'معدات' ? 'selected' : ''}>معدات</option>
                                <option value="تدريب" ${selectedCategory === 'تدريب' ? 'selected' : ''}>تدريب</option>
                                <option value="صيانة" ${selectedCategory === 'صيانة' ? 'selected' : ''}>صيانة</option>
                                <option value="أدوات حماية" ${selectedCategory === 'أدوات حماية' ? 'selected' : ''}>أدوات حماية</option>
                                <option value="طوارئ" ${selectedCategory === 'طوارئ' ? 'selected' : ''}>طوارئ</option>
                                <option value="OPEX" ${selectedCategory === 'OPEX' ? 'selected' : ''}>OPEX (مصروفات تشغيلية)</option>
                                <option value="CAPEX" ${selectedCategory === 'CAPEX' ? 'selected' : ''}>CAPEX (مصروفات رأسمالية)</option>
                                <option value="أخرى" ${selectedCategory === 'أخرى' ? 'selected' : ''}>أخرى</option>
                            </select>
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-align-right ml-2 text-green-600"></i>
                                الوصف *
                            </label>
                            <input type="text" id="expense-description" class="form-input" 
                                   value="${Utils.escapeHTML(expenseData?.description || '')}" 
                                   required
                                   placeholder="أدخل وصفاً تفصيلياً للمصروف..."
                                   style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-building ml-2 text-orange-600"></i>
                                الجهة / المورد *
                            </label>
                            <input type="text" id="expense-vendor" class="form-input" 
                                   value="${Utils.escapeHTML(expenseData?.vendor || '')}" 
                                   required
                                   placeholder="اسم المورد أو الجهة"
                                   style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-coins ml-2 text-yellow-600"></i>
                                العملة *
                            </label>
                            <select id="expense-currency" class="form-input" required
                                    style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                                <option value="EGP" ${currentCurrency === 'EGP' ? 'selected' : ''}>جنيه مصري (ج.م)</option>
                                <option value="USD" ${currentCurrency === 'USD' ? 'selected' : ''}>دولار أمريكي ($)</option>
                            </select>
                        </div>
                        <div class="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-lg border-2 border-red-200">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-money-bill-wave ml-2 text-red-600"></i>
                                القيمة *
                            </label>
                            <div class="flex items-center gap-2">
                                <input type="number" id="expense-amount" class="form-input flex-1" 
                                       value="${expenseData ? (parseFloat(expenseData.amount) || 0) : ''}" 
                                       step="0.01" min="0" required
                                       placeholder="أدخل المبلغ"
                                       style="border: 2px solid #ef4444; border-radius: 8px; padding: 12px; font-size: 18px; font-weight: bold;">
                                <span id="expense-currency-display" class="text-lg font-bold text-red-600 px-3 py-2 bg-white rounded-lg border-2 border-red-200">
                                    ${this.getCurrencySymbol(currentCurrency)}
                                </span>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-file-invoice ml-2"></i>
                                رقم الفاتورة
                            </label>
                            <input type="text" id="expense-invoice" class="form-input" 
                                   value="${Utils.escapeHTML(expenseData?.invoiceNumber || '')}"
                                   style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-paperclip ml-2"></i>
                                المرفقات (PDF / صورة)
                            </label>
                            <input type="file" id="expense-attachments" class="form-input" 
                                   accept=".pdf,.jpg,.jpeg,.png" multiple
                                   style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                            <p class="text-xs text-gray-500 mt-1">يمكن رفع عدة ملفات (PDF أو صور)</p>
                            <div id="expense-attachments-list" class="mt-3 space-y-2"></div>
                            ${expenseData && expenseData.attachments && expenseData.attachments.length > 0 ? `
                                <div class="mt-3">
                                    <p class="text-sm font-semibold mb-2">المرفقات الحالية:</p>
                                    ${expenseData.attachments.map((att, idx) => `
                                        <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-2">
                                            <div class="flex items-center gap-2">
                                                <i class="fas fa-paperclip text-blue-500"></i>
                                                <span class="text-sm">${Utils.escapeHTML(att.name || 'مرفق')}</span>
                                            </div>
                                            <button type="button" class="btn-icon btn-icon-danger" onclick="this.closest('div').remove()">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-4 pt-6 border-t mt-6">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px;">
                            <i class="fas fa-times ml-2"></i>إلغاء
                        </button>
                        <button type="submit" class="btn-primary" style="padding: 10px 24px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                            <i class="fas fa-save ml-2"></i>
                            ${isEdit ? 'حفظ التعديلات' : 'تسجيل المصروف'}
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // تحديث رمز العملة عند تغيير العملة
        const currencySelect = modal.querySelector('#expense-currency');
        const currencyDisplay = modal.querySelector('#expense-currency-display');
        if (currencySelect && currencyDisplay) {
            currencySelect.addEventListener('change', (e) => {
                const selectedCurrency = e.target.value;
                currencyDisplay.textContent = this.getCurrencySymbol(selectedCurrency);
            });
        }

        const attachmentsInput = document.getElementById('expense-attachments');
        if (attachmentsInput) {
            attachmentsInput.addEventListener('change', (e) => {
                this.handleAttachmentsChange(e.target.files, modal);
            });
        }

        const form = document.getElementById('expense-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleExpenseSubmit(expenseData?.id, modal, defaultCategory);
            });
        }

        this.currentAttachments = expenseData?.attachments ? [...expenseData.attachments] : [];
    },

    async handleExpenseSubmit(expenseId, modal, defaultCategory = null) {
        // فحص العناصر قبل الاستخدام
        const dateEl = document.getElementById('expense-date');
        const categoryEl = document.getElementById('expense-category');
        const descriptionEl = document.getElementById('expense-description');
        const vendorEl = document.getElementById('expense-vendor');
        const currencyEl = document.getElementById('expense-currency');
        const amountEl = document.getElementById('expense-amount');
        const invoiceEl = document.getElementById('expense-invoice');
        
        if (!dateEl || !categoryEl || !descriptionEl || !vendorEl || !amountEl) {
            Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
            return;
        }

        const formData = {
            id: expenseId || Utils.generateId('EXPENSE'),
            date: new Date(dateEl.value).toISOString(),
            category: categoryEl.value || defaultCategory,
            description: descriptionEl.value.trim(),
            vendor: vendorEl.value.trim(),
            currency: currencyEl?.value || this.defaultCurrency,
            amount: parseFloat(amountEl.value),
            invoiceNumber: invoiceEl?.value.trim() || '',
            attachments: this.currentAttachments || [],
            createdAt: expenseId ? AppState.appData.safetyBudgetTransactions.find(e => e.id === expenseId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (!formData.date || !formData.category || !formData.description || !formData.vendor || !formData.amount || formData.amount <= 0) {
            Notification.error('يرجى ملء جميع الحقول المطلوبة بشكل صحيح');
            return;
        }

        Loading.show();
        try {
            if (expenseId) {
                const index = AppState.appData.safetyBudgetTransactions.findIndex(e => e.id === expenseId);
                if (index !== -1) {
                    AppState.appData.safetyBudgetTransactions[index] = formData;
                    Notification.success('تم تحديث المصروف بنجاح');
                }
            } else {
                AppState.appData.safetyBudgetTransactions.push(formData);
                Notification.success('تم تسجيل المصروف بنجاح');
            }

            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            await GoogleIntegration.autoSave('SafetyBudgetTransactions', AppState.appData.safetyBudgetTransactions);

            AuditLog.log(expenseId ? 'update_expense' : 'create_expense', 'SafetyBudget', formData.id, {
                category: formData.category,
                amount: formData.amount
            });

            Loading.hide();
            modal.remove();

            // إعادة تحميل القسم المناسب
            if (this.currentTab === 'opex' && formData.category === 'OPEX') {
                this.loadOPEXList();
            } else if (this.currentTab === 'capex' && formData.category === 'CAPEX') {
                this.loadCAPEXList();
            } else if (this.currentTab === 'all') {
                this.loadExpensesList();
            } else if (this.currentTab === 'dashboard') {
                this.loadDashboard();
            } else {
                // إذا كان في تبويب آخر، نعيد تحميل التبويب المناسب
                if (formData.category === 'OPEX') {
                    this.switchTab('opex');
                } else if (formData.category === 'CAPEX') {
                    this.switchTab('capex');
                } else {
                    this.switchTab('all');
                }
            }
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    // ===== Import from Excel =====
    showImportModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; border-radius: 8px 8px 0 0;">
                    <h2 class="modal-title" style="color: white;">
                        <i class="fas fa-file-import ml-2"></i>
                        استيراد الميزانية من Excel
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 24px;">
                    <div class="space-y-6">
                        <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h3 class="text-sm font-semibold text-gray-700 mb-3">
                                <i class="fas fa-info-circle ml-2 text-blue-600"></i>
                                تعليمات الاستيراد
                            </h3>
                            <ul class="text-sm text-gray-600 space-y-2 list-disc list-inside">
                                <li>يجب أن يحتوي ملف Excel على الأعمدة التالية: التاريخ، الفئة، الوصف، الجهة، المبلغ، العملة (اختياري)، رقم الفاتورة (اختياري)</li>
                                <li>التاريخ يجب أن يكون بصيغة YYYY-MM-DD أو DD/MM/YYYY</li>
                                <li>الفئة يجب أن تكون واحدة من: معدات، تدريب، صيانة، أدوات حماية، طوارئ، OPEX، CAPEX، أخرى</li>
                                <li>العملة: EGP أو USD (افتراضي: EGP)</li>
                                <li>المبلغ يجب أن يكون رقماً صحيحاً</li>
                            </ul>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-file-excel ml-2 text-green-600"></i>
                                اختر ملف Excel (.xlsx, .xls) *
                            </label>
                            <input type="file" id="budget-excel-file" class="form-input" 
                                   accept=".xlsx,.xls" required
                                   style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                            <p class="text-xs text-gray-500 mt-2">
                                <i class="fas fa-download ml-1"></i>
                                <a href="#" onclick="SafetyBudget.downloadTemplate(); return false;" class="text-blue-600 hover:underline">
                                    تحميل نموذج Excel
                                </a>
                            </p>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-cog ml-2 text-purple-600"></i>
                                خيارات الاستيراد
                            </label>
                            <div class="space-y-2">
                                <label class="flex items-center gap-2">
                                    <input type="checkbox" id="import-overwrite" class="rounded border-gray-300 text-blue-600">
                                    <span class="text-sm text-gray-700">استبدال البيانات الموجودة (إن وجدت)</span>
                                </label>
                                <label class="flex items-center gap-2">
                                    <input type="checkbox" id="import-skip-duplicates" class="rounded border-gray-300 text-blue-600" checked>
                                    <span class="text-sm text-gray-700">تخطي السجلات المكررة (حسب رقم الفاتورة)</span>
                                </label>
                            </div>
                        </div>
                        <div id="import-preview" class="hidden">
                            <h3 class="text-sm font-semibold text-gray-700 mb-2">معاينة البيانات:</h3>
                            <div class="max-h-60 overflow-y-auto border border-gray-200 rounded p-2">
                                <table class="data-table text-xs">
                                    <thead>
                                        <tr>
                                            <th>التاريخ</th>
                                            <th>الفئة</th>
                                            <th>الوصف</th>
                                            <th>الجهة</th>
                                            <th>المبلغ</th>
                                            <th>العملة</th>
                                        </tr>
                                    </thead>
                                    <tbody id="import-preview-body"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-4 pt-6 border-t mt-6">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px;">
                            <i class="fas fa-times ml-2"></i>إلغاء
                        </button>
                        <button type="button" id="import-preview-btn" class="btn-secondary" onclick="SafetyBudget.previewImport()" style="padding: 10px 20px;">
                            <i class="fas fa-eye ml-2"></i>معاينة
                        </button>
                        <button type="button" id="import-execute-btn" class="btn-primary" onclick="SafetyBudget.executeImport()" style="padding: 10px 24px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                            <i class="fas fa-upload ml-2"></i>استيراد
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    downloadTemplate() {
        if (typeof XLSX === 'undefined') {
            Notification.error('مكتبة Excel غير متوفرة');
            return;
        }

        const templateData = [
            ['التاريخ', 'الفئة', 'الوصف', 'الجهة', 'المبلغ', 'العملة', 'رقم الفاتورة'],
            ['2024-01-15', 'OPEX', 'مثال: صيانة معدات السلامة', 'شركة الصيانة', '5000', 'EGP', 'INV-001'],
            ['2024-01-20', 'CAPEX', 'مثال: شراء معدات جديدة', 'مورد المعدات', '50000', 'EGP', 'INV-002'],
            ['2024-02-10', 'تدريب', 'مثال: دورة تدريبية', 'مركز التدريب', '3000', 'USD', 'INV-003']
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(templateData);
        XLSX.utils.book_append_sheet(wb, ws, 'نموذج الميزانية');
        XLSX.writeFile(wb, 'نموذج_استيراد_الميزانية.xlsx');
        Notification.success('تم تحميل النموذج بنجاح');
    },

    async previewImport() {
        const fileInput = document.getElementById('budget-excel-file');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            Notification.error('يرجى اختيار ملف Excel أولاً');
            return;
        }

        if (typeof XLSX === 'undefined') {
            Notification.error('مكتبة Excel غير متوفرة');
            return;
        }

        Loading.show('جاري قراءة الملف...');
        try {
            const file = fileInput.files[0];
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            if (jsonData.length === 0) {
                Notification.error('الملف فارغ أو لا يحتوي على بيانات');
                Loading.hide();
                return;
            }

            // تحليل البيانات
            const previewData = jsonData.slice(0, 10).map(row => {
                const date = this.parseDate(row['التاريخ'] || row['Date'] || row['تاريخ'] || '');
                const category = String(row['الفئة'] || row['Category'] || row['الفئة'] || '').trim();
                const description = String(row['الوصف'] || row['Description'] || row['وصف'] || '').trim();
                const vendor = String(row['الجهة'] || row['Vendor'] || row['المورد'] || '').trim();
                const amount = parseFloat(row['المبلغ'] || row['Amount'] || row['المبلغ'] || 0);
                const currency = String(row['العملة'] || row['Currency'] || row['عملة'] || 'EGP').trim().toUpperCase();
                const invoice = String(row['رقم الفاتورة'] || row['Invoice'] || row['Invoice Number'] || '').trim();

                return {
                    date: date ? Utils.formatDate(date) : 'غير صحيح',
                    category: category || 'غير محدد',
                    description: description || 'غير محدد',
                    vendor: vendor || 'غير محدد',
                    amount: isNaN(amount) ? 0 : amount,
                    currency: currency === 'EGP' || currency === 'USD' ? currency : 'EGP',
                    invoice: invoice || '-'
                };
            });

            const previewBody = document.getElementById('import-preview-body');
            const previewDiv = document.getElementById('import-preview');

            if (previewBody && previewDiv) {
                previewBody.innerHTML = previewData.map(row => `
                    <tr>
                        <td>${Utils.escapeHTML(row.date)}</td>
                        <td>${Utils.escapeHTML(row.category)}</td>
                        <td>${Utils.escapeHTML(row.description)}</td>
                        <td>${Utils.escapeHTML(row.vendor)}</td>
                        <td>${row.amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>${Utils.escapeHTML(row.currency)}</td>
                    </tr>
                `).join('');
                previewDiv.classList.remove('hidden');
            }

            Notification.success(`تم تحليل ${jsonData.length} سطر. عرض أول 10 سطور للمعاينة.`);
            Loading.hide();
        } catch (error) {
            Loading.hide();
            Notification.error('فشل قراءة الملف: ' + error.message);
        }
    },

    parseDate(dateStr) {
        if (!dateStr) return null;

        // محاولة تحليل التاريخ بصيغ مختلفة
        const str = String(dateStr).trim();

        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            return new Date(str);
        }

        // DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
            const parts = str.split('/');
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }

        // MM/DD/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
            const parts = str.split('/');
            return new Date(parts[2], parts[0] - 1, parts[1]);
        }

        // معالجة Excel serial date مع دعم الوقت (الجزء الكسري)
        const excelDate = parseFloat(str);
        if (!isNaN(excelDate) && excelDate > 1) {
            // Excel يخزن التاريخ كعدد الأيام من 1899-12-30
            // والوقت كجزء كسري من اليوم
            const totalDays = Math.floor(excelDate);
            const timeFraction = excelDate - totalDays;
            const baseDate = new Date(1899, 11, 30); // 30 ديسمبر 1899 (التوقيت المحلي)
            const date = new Date(baseDate.getTime() + totalDays * 24 * 60 * 60 * 1000);
            // إضافة الوقت من الجزء الكسري
            if (timeFraction > 0) {
                const totalSeconds = Math.round(timeFraction * 24 * 60 * 60);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                date.setHours(hours, minutes, seconds, 0);
            }
            return date;
        }

        // محاولة تحليل كتاريخ عادي
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            return date;
        }

        return null;
    },

    async executeImport() {
        const fileInput = document.getElementById('budget-excel-file');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            Notification.error('يرجى اختيار ملف Excel أولاً');
            return;
        }

        if (typeof XLSX === 'undefined') {
            Notification.error('مكتبة Excel غير متوفرة');
            return;
        }

        const overwrite = document.getElementById('import-overwrite')?.checked || false;
        const skipDuplicates = document.getElementById('import-skip-duplicates')?.checked || true;

        Loading.show('جاري استيراد البيانات...');
        try {
            const file = fileInput.files[0];
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            if (jsonData.length === 0) {
                Notification.error('الملف فارغ أو لا يحتوي على بيانات');
                Loading.hide();
                return;
            }

            const existingTransactions = AppState.appData.safetyBudgetTransactions || [];
            const existingInvoiceNumbers = new Set(
                existingTransactions
                    .map(t => t.invoiceNumber)
                    .filter(Boolean)
            );

            let imported = 0;
            let skipped = 0;
            let errors = 0;

            for (const row of jsonData) {
                try {
                    const date = this.parseDate(row['التاريخ'] || row['Date'] || row['تاريخ'] || '');
                    const category = String(row['الفئة'] || row['Category'] || row['الفئة'] || '').trim();
                    const description = String(row['الوصف'] || row['Description'] || row['وصف'] || '').trim();
                    const vendor = String(row['الجهة'] || row['Vendor'] || row['المورد'] || '').trim();
                    const amount = parseFloat(row['المبلغ'] || row['Amount'] || row['المبلغ'] || 0);
                    const currency = String(row['العملة'] || row['Currency'] || row['عملة'] || 'EGP').trim().toUpperCase();
                    const invoiceNumber = String(row['رقم الفاتورة'] || row['Invoice'] || row['Invoice Number'] || '').trim();

                    // التحقق من صحة البيانات
                    if (!date || isNaN(date.getTime())) {
                        errors++;
                        continue;
                    }

                    if (!category || !description || !vendor || isNaN(amount) || amount <= 0) {
                        errors++;
                        continue;
                    }

                    // التحقق من التكرار
                    if (skipDuplicates && invoiceNumber && existingInvoiceNumbers.has(invoiceNumber)) {
                        skipped++;
                        continue;
                    }

                    // إنشاء السجل
                    const transaction = {
                        id: Utils.generateId('EXPENSE'),
                        date: date.toISOString(),
                        category: category,
                        description: description,
                        vendor: vendor,
                        currency: currency === 'EGP' || currency === 'USD' ? currency : 'EGP',
                        amount: amount,
                        invoiceNumber: invoiceNumber || '',
                        attachments: [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };

                    if (overwrite && invoiceNumber) {
                        const existingIndex = existingTransactions.findIndex(t => t.invoiceNumber === invoiceNumber);
                        if (existingIndex !== -1) {
                            transaction.id = existingTransactions[existingIndex].id;
                            transaction.createdAt = existingTransactions[existingIndex].createdAt;
                            existingTransactions[existingIndex] = transaction;
                            imported++;
                            continue;
                        }
                    }

                    AppState.appData.safetyBudgetTransactions.push(transaction);
                    if (invoiceNumber) {
                        existingInvoiceNumbers.add(invoiceNumber);
                    }
                    imported++;
                } catch (error) {
                    errors++;
                    Utils.safeError('خطأ في استيراد سطر:', error);
                }
            }

            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            await GoogleIntegration.autoSave('SafetyBudgetTransactions', AppState.appData.safetyBudgetTransactions);

            AuditLog.log('import_budget', 'SafetyBudget', null, {
                imported,
                skipped,
                errors,
                total: jsonData.length
            });

            Loading.hide();

            const modal = document.querySelector('.modal-overlay');
            if (modal) modal.remove();

            Notification.success(`تم الاستيراد بنجاح: ${imported} سجل جديد، ${skipped} تم تخطيه، ${errors} أخطاء`);

            // إعادة تحميل Dashboard
            this.loadDashboard();
        } catch (error) {
            Loading.hide();
            Notification.error('فشل الاستيراد: ' + error.message);
        }
    }
};

SafetyBudget.purchaseOrderSheetName = 'SafetyBudgetPurchaseOrders';
SafetyBudget.purchaseOrderPrStatuses = [
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'closed', label: 'Closed' }
];
SafetyBudget.purchaseOrderPoStatuses = [
    { value: 'not-issued', label: 'Not Issued' },
    { value: 'open', label: 'Open' },
    { value: 'partial', label: 'Partial' },
    { value: 'closed', label: 'Closed' },
    { value: 'cancelled', label: 'Cancelled' }
];

SafetyBudget.ensurePurchaseOrdersCollection = function () {
    if (!AppState.appData) AppState.appData = {};
    if (!Array.isArray(AppState.appData.safetyBudgetPurchaseOrders)) {
        AppState.appData.safetyBudgetPurchaseOrders = [];
    }
    return AppState.appData.safetyBudgetPurchaseOrders;
};

SafetyBudget.normalizePurchaseOrderRecord = function (record = {}) {
    return {
        id: String(record.id || '').trim(),
        prNo: String(record.prNo || record.PRNo || '').trim(),
        prDate: String(record.prDate || record.PRDate || '').trim(),
        itemCodeNo: String(record.itemCodeNo || record.itemCode || '').trim(),
        itemsDescription: String(record.itemsDescription || record.itemDescription || '').trim(),
        detailsRemarks: String(record.detailsRemarks || record.remarks || '').trim(),
        quantity: parseFloat(record.quantity || 0) || 0,
        prStatus: String(record.prStatus || 'submitted').trim(),
        poNo: String(record.poNo || '').trim(),
        poStatus: String(record.poStatus || 'not-issued').trim(),
        note: String(record.note || record.notes || '').trim(),
        createdAt: String(record.createdAt || '').trim(),
        updatedAt: String(record.updatedAt || '').trim(),
        updatedBy: String(record.updatedBy || '').trim()
    };
};

SafetyBudget.ensurePurchaseOrdersLoaded = async function (forceReload = false) {
    const current = this.ensurePurchaseOrdersCollection();
    if (!forceReload && current.length > 0) {
        return current;
    }

    if (typeof GoogleIntegration === 'undefined' || !GoogleIntegration.readFromSheets) {
        return current;
    }

    try {
        const rows = await GoogleIntegration.readFromSheets(this.purchaseOrderSheetName, 12000);
        if (Array.isArray(rows)) {
            AppState.appData.safetyBudgetPurchaseOrders = rows.map((row) => this.normalizePurchaseOrderRecord(row));
        }
    } catch (error) {
        Utils.safeWarn('تعذر تحميل طلبات الشراء المسجلة:', error);
    }

    return this.ensurePurchaseOrdersCollection();
};

SafetyBudget.getPurchaseOrderPrStatusLabel = function (value) {
    return this.purchaseOrderPrStatuses.find((status) => status.value === value)?.label || value || '-';
};

SafetyBudget.getPurchaseOrderPoStatusLabel = function (value) {
    return this.purchaseOrderPoStatuses.find((status) => status.value === value)?.label || value || '-';
};

SafetyBudget.getPurchaseOrderStatusBadge = function (type, value) {
    const palette = {
        approved: 'background:#dcfce7;color:#166534;',
        closed: 'background:#dbeafe;color:#1d4ed8;',
        submitted: 'background:#e0f2fe;color:#075985;',
        draft: 'background:#f1f5f9;color:#334155;',
        rejected: 'background:#fee2e2;color:#b91c1c;',
        'not-issued': 'background:#f8fafc;color:#475569;',
        open: 'background:#ede9fe;color:#6d28d9;',
        partial: 'background:#fef3c7;color:#b45309;',
        cancelled: 'background:#f3f4f6;color:#4b5563;'
    };
    const label = type === 'pr'
        ? this.getPurchaseOrderPrStatusLabel(value)
        : this.getPurchaseOrderPoStatusLabel(value);
    return `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold" style="${palette[value] || 'background:#e5e7eb;color:#374151;'}">${Utils.escapeHTML(label)}</span>`;
};

SafetyBudget.injectPurchaseOrdersUI = function () {
    const addExpenseBtn = document.getElementById('add-expense-btn');
    if (addExpenseBtn && !document.getElementById('add-purchase-order-btn')) {
        const button = document.createElement('button');
        button.id = 'add-purchase-order-btn';
        button.className = 'btn-primary';
        button.innerHTML = '<i class="fas fa-file-signature ml-2"></i>Track registered purchase orders';
        button.onclick = () => this.showPurchaseOrderForm();
        addExpenseBtn.insertAdjacentElement('afterend', button);
    }

    const tabsBar = document.querySelector('#safety-budget-section .tab-btn[data-tab="capex"]')?.parentElement;
    if (tabsBar && !tabsBar.querySelector('[data-tab="purchase-orders"]')) {
        const button = document.createElement('button');
        button.className = 'tab-btn';
        button.dataset.tab = 'purchase-orders';
        button.setAttribute('onclick', "SafetyBudget.switchTab('purchase-orders')");
        button.style.cssText = 'padding: 12px 20px; border: none; background: transparent; color: #6b7280; font-weight: 500; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s;';
        button.innerHTML = '<i class="fas fa-clipboard-list ml-2"></i>Track registered purchase orders';
        tabsBar.appendChild(button);
    }
};

SafetyBudget.renderPurchaseOrdersTab = async function () {
    const records = this.ensurePurchaseOrdersCollection();
    const approvedCount = records.filter((record) => record.prStatus === 'approved').length;
    const linkedPoCount = records.filter((record) => String(record.poNo || '').trim() !== '').length;
    const openPoCount = records.filter((record) => ['open', 'partial'].includes(record.poStatus)).length;

    return `
        <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div class="content-card"><div class="card-body"><div class="flex items-center justify-between"><div><p class="text-sm text-gray-500">Total PRs</p><p class="text-3xl font-black text-slate-900">${records.length}</p></div><div class="bg-blue-100 rounded-2xl p-4"><i class="fas fa-file-alt text-blue-600 text-xl"></i></div></div></div></div>
                <div class="content-card"><div class="card-body"><div class="flex items-center justify-between"><div><p class="text-sm text-gray-500">Approved PRs</p><p class="text-3xl font-black text-emerald-600">${approvedCount}</p></div><div class="bg-emerald-100 rounded-2xl p-4"><i class="fas fa-circle-check text-emerald-600 text-xl"></i></div></div></div></div>
                <div class="content-card"><div class="card-body"><div class="flex items-center justify-between"><div><p class="text-sm text-gray-500">Linked POs</p><p class="text-3xl font-black text-indigo-600">${linkedPoCount}</p></div><div class="bg-indigo-100 rounded-2xl p-4"><i class="fas fa-link text-indigo-600 text-xl"></i></div></div></div></div>
                <div class="content-card"><div class="card-body"><div class="flex items-center justify-between"><div><p class="text-sm text-gray-500">Open PO Status</p><p class="text-3xl font-black text-amber-600">${openPoCount}</p></div><div class="bg-amber-100 rounded-2xl p-4"><i class="fas fa-hourglass-half text-amber-600 text-xl"></i></div></div></div></div>
            </div>

            <div class="content-card">
                <div class="card-body">
                    <div class="flex items-center justify-between flex-wrap gap-4 mb-5">
                        <div>
                            <h2 class="text-xl font-black text-slate-900">
                                <i class="fas fa-clipboard-list ml-2 text-blue-600"></i>
                                Track registered purchase orders.
                            </h2>
                            <p class="text-sm text-gray-500 mt-2">جدول مركزي لمتابعة طلبات الشراء وربط حالة PR و PO داخل نفس مديول الميزانية.</p>
                        </div>
                        <button class="btn-primary" onclick="SafetyBudget.showPurchaseOrderForm()">
                            <i class="fas fa-plus ml-2"></i>
                            تسجيل طلب شراء
                        </button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">بحث سريع</label>
                            <input id="purchase-order-search" class="form-input" placeholder="PR No / PO No / Item / Notes">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">PR Status</label>
                            <select id="purchase-order-pr-status-filter" class="form-input">
                                <option value="">All</option>
                                ${this.purchaseOrderPrStatuses.map((status) => `<option value="${status.value}">${status.label}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">PO Status</label>
                            <select id="purchase-order-po-status-filter" class="form-input">
                                <option value="">All</option>
                                ${this.purchaseOrderPoStatuses.map((status) => `<option value="${status.value}">${status.label}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Year</label>
                            <input id="purchase-order-year-filter" class="form-input" type="number" min="2020" max="2100" placeholder="2026">
                        </div>
                    </div>

                    <div class="mt-5" id="purchase-orders-table-container">
                        <div class="empty-state">
                            <p class="text-gray-500">جاري تجهيز الجدول...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

SafetyBudget.setupPurchaseOrderEventListeners = function () {
    const rerender = () => this.loadPurchaseOrdersList();
    const search = document.getElementById('purchase-order-search');
    const prStatus = document.getElementById('purchase-order-pr-status-filter');
    const poStatus = document.getElementById('purchase-order-po-status-filter');
    const year = document.getElementById('purchase-order-year-filter');

    if (search) search.addEventListener('input', rerender);
    if (prStatus) prStatus.addEventListener('change', rerender);
    if (poStatus) poStatus.addEventListener('change', rerender);
    if (year) year.addEventListener('input', rerender);
};

SafetyBudget.getFilteredPurchaseOrders = function () {
    const records = this.ensurePurchaseOrdersCollection().slice();
    const search = String(document.getElementById('purchase-order-search')?.value || '').trim().toLowerCase();
    const prStatus = String(document.getElementById('purchase-order-pr-status-filter')?.value || '').trim();
    const poStatus = String(document.getElementById('purchase-order-po-status-filter')?.value || '').trim();
    const year = String(document.getElementById('purchase-order-year-filter')?.value || '').trim();

    return records
        .filter((record) => {
            const haystack = [
                record.prNo,
                record.poNo,
                record.itemCodeNo,
                record.itemsDescription,
                record.detailsRemarks,
                record.note
            ].join(' ').toLowerCase();

            const recordYear = String(new Date(record.prDate || record.createdAt || Date.now()).getFullYear());

            return (!search || haystack.includes(search)) &&
                (!prStatus || record.prStatus === prStatus) &&
                (!poStatus || record.poStatus === poStatus) &&
                (!year || recordYear === year);
        })
        .sort((a, b) => new Date(b.prDate || b.updatedAt || 0) - new Date(a.prDate || a.updatedAt || 0));
};

SafetyBudget.loadPurchaseOrdersList = function () {
    const container = document.getElementById('purchase-orders-table-container');
    if (!container) return;

    const records = this.getFilteredPurchaseOrders();

    if (records.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500 mb-3">لا توجد طلبات شراء مطابقة حاليًا</p>
                <button class="btn-primary" onclick="SafetyBudget.showPurchaseOrderForm()">
                    <i class="fas fa-plus ml-2"></i>
                    تسجيل أول طلب شراء
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>PR No</th>
                        <th>PR Date</th>
                        <th>Item Code No</th>
                        <th>Items Description</th>
                        <th>Details / Remarks</th>
                        <th>Quantity</th>
                        <th>PR Status</th>
                        <th>PO No</th>
                        <th>PO Status</th>
                        <th>Note</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map((record) => `
                        <tr>
                            <td class="font-bold text-slate-900">${Utils.escapeHTML(record.prNo || '-')}</td>
                            <td>${record.prDate ? Utils.formatDate(record.prDate) : '-'}</td>
                            <td>${Utils.escapeHTML(record.itemCodeNo || '-')}</td>
                            <td style="min-width: 220px;">${Utils.escapeHTML(record.itemsDescription || '-')}</td>
                            <td style="min-width: 220px;">${Utils.escapeHTML(record.detailsRemarks || '-')}</td>
                            <td>${(parseFloat(record.quantity) || 0).toLocaleString('en-US')}</td>
                            <td>${this.getPurchaseOrderStatusBadge('pr', record.prStatus)}</td>
                            <td>${Utils.escapeHTML(record.poNo || '-')}</td>
                            <td>${this.getPurchaseOrderStatusBadge('po', record.poStatus)}</td>
                            <td style="min-width: 180px;">${Utils.escapeHTML(record.note || '-')}</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <button class="btn-icon btn-icon-primary" onclick="SafetyBudget.viewPurchaseOrder('${record.id}')" title="عرض">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    ${Permissions.hasAccess('safety-budget') ? `
                                        <button class="btn-icon btn-icon-warning" onclick="SafetyBudget.editPurchaseOrder('${record.id}')" title="تعديل">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn-icon btn-icon-danger" onclick="SafetyBudget.deletePurchaseOrder('${record.id}')" title="حذف">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
};

SafetyBudget.showPurchaseOrderForm = function (record = null) {
    const isEdit = !!record;
    const normalized = this.normalizePurchaseOrderRecord(record || {});
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1040px; overflow:hidden; border-radius: 24px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #eff6ff 0%, #ffffff 58%, #f0fdf4 100%); border-bottom: 1px solid rgba(148,163,184,0.2);">
                <div class="flex items-start justify-between gap-4 w-full flex-wrap">
                    <div class="min-w-0">
                        <div class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black text-blue-700 bg-blue-100 border border-blue-200">
                            <i class="fas fa-file-signature"></i>
                            Purchase Order Form
                        </div>
                        <h2 class="modal-title mt-3" style="font-size: 1.5rem;">
                            ${isEdit ? 'تعديل طلب شراء' : 'تسجيل طلب شراء جديد'}
                        </h2>
                        <p class="text-sm text-slate-500 mt-2">نموذج مبسّط وسريع لتسجيل حالة الطلب وربطها بحالة أمر الشراء مع تمييز بصري أوضح للبيانات الأساسية.</p>
                    </div>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <form id="purchase-order-form" class="modal-body" style="padding: 24px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);">
                <div class="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
                    <div class="rounded-[22px] border border-blue-100 bg-white p-5" style="box-shadow: 0 14px 34px rgba(59,130,246,0.08);">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="h-11 w-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                                <i class="fas fa-clipboard-check"></i>
                            </div>
                            <div>
                                <h3 class="text-base font-black text-slate-900">بيانات الطلب الأساسية</h3>
                                <p class="text-xs text-slate-500 mt-1">الحقول الأساسية المطلوبة لاعتماد سجل PR بشكل صحيح.</p>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">PR No *</label>
                                <input id="purchase-order-pr-no" class="form-input" required value="${Utils.escapeHTML(normalized.prNo)}" style="border-width:2px;">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">PR Date *</label>
                                <input id="purchase-order-pr-date" type="date" class="form-input" required value="${Utils.escapeHTML(normalized.prDate ? normalized.prDate.slice(0, 10) : '')}" style="border-width:2px;">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Item Code No</label>
                                <input id="purchase-order-item-code" class="form-input" value="${Utils.escapeHTML(normalized.itemCodeNo)}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Quantity *</label>
                                <input id="purchase-order-quantity" type="number" min="0" step="0.01" class="form-input" required value="${normalized.quantity || ''}">
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Items Description *</label>
                                <textarea id="purchase-order-description" class="form-input" rows="4" required style="min-height: 112px;">${Utils.escapeHTML(normalized.itemsDescription)}</textarea>
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Details / Remarks</label>
                                <textarea id="purchase-order-remarks" class="form-input" rows="4" style="min-height: 112px;">${Utils.escapeHTML(normalized.detailsRemarks)}</textarea>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-5">
                        <div class="rounded-[22px] border border-emerald-100 bg-white p-5" style="box-shadow: 0 14px 34px rgba(16,185,129,0.08);">
                            <div class="flex items-center gap-3 mb-4">
                                <div class="h-11 w-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                    <i class="fas fa-circle-check"></i>
                                </div>
                                <div>
                                    <h3 class="text-base font-black text-slate-900">حالة PR / PO</h3>
                                    <p class="text-xs text-slate-500 mt-1">مؤشرات واضحة للحالة الحالية وسهولة التحديث لاحقًا.</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">PR Status</label>
                                    <select id="purchase-order-pr-status" class="form-input">
                                        ${this.purchaseOrderPrStatuses.map((status) => `<option value="${status.value}" ${normalized.prStatus === status.value ? 'selected' : ''}>${status.label}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">PO No</label>
                                    <input id="purchase-order-po-no" class="form-input" value="${Utils.escapeHTML(normalized.poNo)}">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">PO Status</label>
                                    <select id="purchase-order-po-status" class="form-input">
                                        ${this.purchaseOrderPoStatuses.map((status) => `<option value="${status.value}" ${normalized.poStatus === status.value ? 'selected' : ''}>${status.label}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-[22px] border border-amber-100 bg-white p-5" style="box-shadow: 0 14px 34px rgba(245,158,11,0.08);">
                            <div class="flex items-center gap-3 mb-4">
                                <div class="h-11 w-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                                    <i class="fas fa-note-sticky"></i>
                                </div>
                                <div>
                                    <h3 class="text-base font-black text-slate-900">ملاحظات إضافية</h3>
                                    <p class="text-xs text-slate-500 mt-1">أي معلومات داعمة أو تفاصيل خاصة بسير الشراء.</p>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Note</label>
                                <textarea id="purchase-order-note" class="form-input" rows="6" style="min-height: 158px;">${Utils.escapeHTML(normalized.note)}</textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-between items-center gap-3 flex-wrap mt-6 border-t border-slate-200 pt-5">
                    <div class="text-xs text-slate-500">
                        <i class="fas fa-bolt ml-1 text-blue-500"></i>
                        بعد الضغط على الحفظ سيتم إغلاق النموذج مباشرة وتحديث الجدول تلقائيًا.
                    </div>
                    <div class="flex justify-end gap-3">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                        <button type="submit" class="btn-primary" id="purchase-order-submit-btn" style="box-shadow: 0 14px 26px rgba(37,99,235,0.24);">
                            <i class="fas fa-save ml-2"></i>
                            ${isEdit ? 'حفظ التعديلات' : 'تسجيل الطلب'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector('#purchase-order-form');
    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handlePurchaseOrderSubmit(normalized.id || null, modal);
        });
    }
};

SafetyBudget.handlePurchaseOrderSubmit = async function (recordId, modal) {
    const collection = this.ensurePurchaseOrdersCollection();
    const existing = recordId ? collection.find((record) => record.id === recordId) : null;
    const submitButton = document.getElementById('purchase-order-submit-btn');
    const formData = this.normalizePurchaseOrderRecord({
        id: existing?.id || Utils.generateSequentialId('SPO', collection),
        prNo: document.getElementById('purchase-order-pr-no')?.value,
        prDate: document.getElementById('purchase-order-pr-date')?.value,
        itemCodeNo: document.getElementById('purchase-order-item-code')?.value,
        itemsDescription: document.getElementById('purchase-order-description')?.value,
        detailsRemarks: document.getElementById('purchase-order-remarks')?.value,
        quantity: document.getElementById('purchase-order-quantity')?.value,
        prStatus: document.getElementById('purchase-order-pr-status')?.value,
        poNo: document.getElementById('purchase-order-po-no')?.value,
        poStatus: document.getElementById('purchase-order-po-status')?.value,
        note: document.getElementById('purchase-order-note')?.value,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: AppState.currentUser?.name || AppState.currentUser?.email || ''
    });

    if (!formData.prNo || !formData.prDate || !formData.itemsDescription || !(parseFloat(formData.quantity) > 0)) {
        Notification.error('يرجى إدخال PR No و PR Date و Items Description و Quantity بشكل صحيح');
        return;
    }

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.style.opacity = '0.7';
    }

    try {
        if (existing) {
            const index = collection.findIndex((record) => record.id === existing.id);
            collection[index] = formData;
        } else {
            collection.push(formData);
        }

        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        }

        modal?.remove();

        if (this.currentTab === 'purchase-orders') {
            const contentContainer = document.getElementById('safety-budget-tab-content');
            if (contentContainer) {
                contentContainer.innerHTML = await this.renderPurchaseOrdersTab();
                this.setupPurchaseOrderEventListeners();
                this.loadPurchaseOrdersList();
            }
        } else {
            this.loadDashboard();
        }

        Notification.success(existing ? 'تم تحديث طلب الشراء بنجاح' : 'تم تسجيل طلب الشراء بنجاح');

        GoogleIntegration.autoSave(this.purchaseOrderSheetName, collection)
            .then(() => {
                AuditLog.log(existing ? 'update_purchase_order' : 'create_purchase_order', 'SafetyBudget', formData.id, {
                    prNo: formData.prNo,
                    poNo: formData.poNo,
                    prStatus: formData.prStatus,
                    poStatus: formData.poStatus
                });
            })
            .catch((error) => {
                Notification.warning('تم حفظ الطلب محليًا، وجارٍ مزامنته مع قاعدة البيانات: ' + error.message);
            });
    } catch (error) {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
        }
        Notification.error('حدث خطأ أثناء حفظ طلب الشراء: ' + error.message);
    }
};

SafetyBudget.viewPurchaseOrder = function (recordId) {
    const record = this.ensurePurchaseOrdersCollection().find((item) => item.id === recordId);
    if (!record) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; overflow:hidden; border-radius: 24px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #f8fafc 0%, #ffffff 56%, #eff6ff 100%); border-bottom: 1px solid rgba(148,163,184,0.2);">
                <div class="flex items-start justify-between gap-4 w-full flex-wrap">
                    <div>
                        <div class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black text-indigo-700 bg-indigo-100 border border-indigo-200">
                            <i class="fas fa-eye"></i>
                            Purchase Order Details
                        </div>
                        <h2 class="modal-title mt-3">تفاصيل طلب الشراء</h2>
                        <p class="text-sm text-slate-500 mt-2">عرض سريع وواضح لكامل بيانات PR و PO مع تمييز بصري للحالة.</p>
                    </div>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="modal-body" style="padding: 24px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);">
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                    <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4"><p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">PR No</p><p class="text-lg font-black text-slate-900 mt-2">${Utils.escapeHTML(record.prNo || '-')}</p></div>
                    <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4"><p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">PR Date</p><p class="text-lg font-black text-slate-900 mt-2">${record.prDate ? Utils.formatDate(record.prDate) : '-'}</p></div>
                    <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4"><p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Item Code</p><p class="text-lg font-black text-slate-900 mt-2">${Utils.escapeHTML(record.itemCodeNo || '-')}</p></div>
                    <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4"><p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Quantity</p><p class="text-lg font-black text-slate-900 mt-2">${(parseFloat(record.quantity) || 0).toLocaleString('en-US')}</p></div>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
                    <div class="space-y-4">
                        <div class="rounded-[22px] border border-blue-100 bg-white p-5" style="box-shadow: 0 14px 34px rgba(59,130,246,0.08);">
                            <p class="text-sm font-black text-slate-900 mb-3">Items Description</p>
                            <p class="text-base leading-8 text-slate-700">${Utils.escapeHTML(record.itemsDescription || '-')}</p>
                        </div>
                        <div class="rounded-[22px] border border-amber-100 bg-white p-5" style="box-shadow: 0 14px 34px rgba(245,158,11,0.08);">
                            <p class="text-sm font-black text-slate-900 mb-3">Details / Remarks</p>
                            <p class="text-base leading-8 text-slate-700">${Utils.escapeHTML(record.detailsRemarks || '-')}</p>
                        </div>
                        <div class="rounded-[22px] border border-slate-200 bg-white p-5">
                            <p class="text-sm font-black text-slate-900 mb-3">Note</p>
                            <p class="text-base leading-8 text-slate-700">${Utils.escapeHTML(record.note || '-')}</p>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <div class="rounded-[22px] border border-emerald-100 bg-white p-5" style="box-shadow: 0 14px 34px rgba(16,185,129,0.08);">
                            <p class="text-sm font-black text-slate-900 mb-3">PR Status</p>
                            <div>${this.getPurchaseOrderStatusBadge('pr', record.prStatus)}</div>
                        </div>
                        <div class="rounded-[22px] border border-indigo-100 bg-white p-5" style="box-shadow: 0 14px 34px rgba(99,102,241,0.08);">
                            <p class="text-sm font-black text-slate-900 mb-2">PO No</p>
                            <p class="text-lg font-black text-slate-900">${Utils.escapeHTML(record.poNo || '-')}</p>
                            <p class="text-sm font-black text-slate-900 mt-4 mb-3">PO Status</p>
                            <div>${this.getPurchaseOrderStatusBadge('po', record.poStatus)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

SafetyBudget.editPurchaseOrder = function (recordId) {
    const record = this.ensurePurchaseOrdersCollection().find((item) => item.id === recordId);
    if (record) this.showPurchaseOrderForm(record);
};

SafetyBudget.deletePurchaseOrder = async function (recordId) {
    if (!confirm('هل أنت متأكد من حذف طلب الشراء هذا؟')) return;

    Loading.show();
    try {
        AppState.appData.safetyBudgetPurchaseOrders = this.ensurePurchaseOrdersCollection().filter((record) => record.id !== recordId);

        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        }

        await GoogleIntegration.autoSave(this.purchaseOrderSheetName, AppState.appData.safetyBudgetPurchaseOrders);
        AuditLog.log('delete_purchase_order', 'SafetyBudget', recordId);

        Loading.hide();
        Notification.success('تم حذف طلب الشراء بنجاح');
        if (this.currentTab === 'purchase-orders') {
            const contentContainer = document.getElementById('safety-budget-tab-content');
            if (contentContainer) {
                contentContainer.innerHTML = await this.renderPurchaseOrdersTab();
                this.setupPurchaseOrderEventListeners();
                this.loadPurchaseOrdersList();
            }
        } else {
            this.loadDashboard();
        }
    } catch (error) {
        Loading.hide();
        Notification.error('حدث خطأ أثناء حذف طلب الشراء: ' + error.message);
    }
};

const __originalSafetyBudgetLoad = SafetyBudget.load;
SafetyBudget.load = async function () {
    this.ensurePurchaseOrdersCollection();
    await __originalSafetyBudgetLoad.call(this);
    this.injectPurchaseOrdersUI();
    this.ensurePurchaseOrdersLoaded().then(() => {
        if (this.currentTab === 'purchase-orders') {
            this.switchTab('purchase-orders', { silent: true });
        }
    }).catch(() => {});
};

const __originalSafetyBudgetSwitchTab = SafetyBudget.switchTab;
SafetyBudget.switchTab = async function (tabName, options = {}) {
    if (tabName !== 'purchase-orders') {
        const result = await __originalSafetyBudgetSwitchTab.call(this, tabName, options);
        this.injectPurchaseOrdersUI();
        return result;
    }

    this.currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const contentContainer = document.getElementById('safety-budget-tab-content');
    if (!contentContainer) return;

    await this.ensurePurchaseOrdersLoaded();
    contentContainer.innerHTML = await this.renderPurchaseOrdersTab();
    this.setupPurchaseOrderEventListeners();
    this.loadPurchaseOrdersList();
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof SafetyBudget !== 'undefined') {
            window.SafetyBudget = SafetyBudget;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ SafetyBudget module loaded and available on window.SafetyBudget');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير SafetyBudget:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof SafetyBudget !== 'undefined') {
            try {
                window.SafetyBudget = SafetyBudget;
            } catch (e) {
                console.error('❌ فشل تصدير SafetyBudget:', e);
            }
        }
    }
})();
