/**
 * Sustainability Module - Environmental Resource Management
 * مديول الاستدامة البيئية - إدارة استهلاك الموارد
 * 
 * Features:
 * - Resource Consumption Registers (Water, Electricity, Natural Gas)
 * - Monitoring & Analytics
 * - Smart Alerts
 * - Sustainability Dashboard
 * - Permission Management
 */

const Sustainability = {
    currentTab: 'dashboard',
    currentWasteSubTab: 'regular',
    settings: {
        consumptionLimits: {
            water: 10000,      // م³ شهرياً
            electricity: 50000, // كيلووات شهرياً
            gas: 30000         // م³ شهرياً
        },
        alertThreshold: 1.2   // 120% من المتوسط
    },

    /**
     * التحقق من صلاحيات المستخدم
     */
    isAdmin() {
        if (typeof AppState === 'undefined' || !AppState.currentUser) return false;
        const user = AppState.currentUser;
        if (user.role === 'admin' || user.role === 'مدير النظام') return true;
        if (typeof Permissions !== 'undefined') {
            const perms = Permissions.getEffectivePermissions(user);
            return perms.__isAdmin || perms['sustainability-manage'] === true || perms['admin'] === true;
        }
        return false;
    },

    canEdit() {
        return this.isAdmin();
    },

    canDelete() {
        return this.isAdmin();
    },

    canManageSettings() {
        return this.isAdmin();
    },

    /**
     * الحصول على قائمة المواقع من الإعدادات
     */
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

    /**
     * تحميل المديول
     */
    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        const section = document.getElementById('sustainability-section');
        if (!section) return;

        if (typeof AppState === 'undefined') {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('AppState غير متوفر!');
            } else {
                console.error('AppState غير متوفر!');
            }
            return;
        }

        // تحميل الإعدادات المحفوظة
        this.loadSettings();

        // تهيئة بنية البيانات إذا لم تكن موجودة
        if (!AppState.appData.resourceConsumption) {
            AppState.appData.resourceConsumption = {
                water: [],
                electricity: [],
                gas: []
            };
        }

        // تهيئة بيانات إدارة المخلفات
        if (!AppState.appData.wasteManagement) {
            AppState.appData.wasteManagement = {
                regularWasteTypes: ['خشب', 'ورق', 'استرتش', 'بلاستيك', 'شكائر', 'جراكن فارغة'],
                regularWasteRecords: [],
                regularWasteSales: [],
                hazardousWasteRecords: []
            };
        }

        // تحميل بيانات استهلاك الموارد من Google Sheets (في الخلفية)
        this.loadResourceConsumptionFromSheets().catch(error => {
            Utils.safeWarn('⚠️ تعذر تحميل بيانات استهلاك الموارد من Google Sheets:', error);
        });

        // تحميل بيانات إدارة المخلفات من Google Sheets (في الخلفية)
        this.loadWasteManagementFromSheets().catch(error => {
            Utils.safeWarn('⚠️ تعذر تحميل بيانات إدارة المخلفات من Google Sheets:', error);
        });

        try {
            section.innerHTML = `
                <div class="section-header">
                    <h1 class="section-title">
                        <i class="fas fa-leaf ml-3"></i>
                        الاستدامة البيئية
                    </h1>
                    <p class="section-subtitle">إدارة ومتابعة استهلاك الموارد البيئية (مياه، كهرباء، غاز طبيعي)</p>
                </div>
                
                <!-- لوحة المؤشرات السريعة -->
                <div id="sustainability-quick-stats" class="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    ${this.renderQuickStats()}
                </div>

                <!-- التبويبات -->
                <div class="mt-6">
                    <div class="flex gap-2 mb-6 border-b overflow-x-auto">
                        <button class="tab-btn ${this.currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
                            <i class="fas fa-chart-line ml-2"></i>لوحة التحليل
                        </button>
                        <button class="tab-btn ${this.currentTab === 'water' ? 'active' : ''}" data-tab="water">
                            <i class="fas fa-tint ml-2"></i>استهلاك المياه
                        </button>
                        <button class="tab-btn ${this.currentTab === 'electricity' ? 'active' : ''}" data-tab="electricity">
                            <i class="fas fa-bolt ml-2"></i>استهلاك الكهرباء
                        </button>
                        <button class="tab-btn ${this.currentTab === 'gas' ? 'active' : ''}" data-tab="gas">
                            <i class="fas fa-fire ml-2"></i>استهلاك الغاز الطبيعي
                        </button>
                        <button class="tab-btn ${this.currentTab === 'waste-management' ? 'active' : ''}" data-tab="waste-management">
                            <i class="fas fa-recycle ml-2"></i>إدارة المخلفات
                        </button>
                        ${this.isAdmin() ? `
                        <button class="tab-btn ${this.currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
                            <i class="fas fa-cog ml-2"></i>الإعدادات
                        </button>
                        ` : ''}
                        <button type="button" class="btn btn-secondary sustainability-refresh-btn ml-4" id="sustainability-refresh-btn" data-action="refresh" title="تحديث البيانات من المصدر">
                            <i class="fas fa-sync-alt ml-2"></i>تحديث
                        </button>
                    </div>
                    <div id="sustainability-content">
                        <div class="content-card">
                            <div class="card-body">
                                <div class="empty-state">
                                    <div style="width: 300px; margin: 0 auto 16px;">
                                        <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                            <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                        </div>
                                    </div>
                                    <p class="text-gray-500">جاري تحميل المحتوى...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.setupEventListeners();

            // ✅ تحميل المحتوى فوراً بعد عرض الواجهة
            setTimeout(async () => {
                try {
                    const contentArea = document.getElementById('sustainability-content');
                    if (!contentArea) return;

                    const content = await this.renderContent().catch(error => {
                        Utils.safeWarn('⚠️ خطأ في تحميل المحتوى:', error);
                        return `
                            <div class="content-card">
                                <div class="card-body">
                                    <div class="empty-state">
                                        <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                        <p class="text-gray-500 mb-4">حدث خطأ في تحميل البيانات</p>
                                        <button onclick="Sustainability.load()" class="btn-primary">
                                            <i class="fas fa-redo ml-2"></i>
                                            إعادة المحاولة
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    });

                    contentArea.innerHTML = content;

                    // ✅ تحديث الكروت السريعة بعد تحميل البيانات
                    if (this.currentTab === 'dashboard') {
                        this.renderCharts();
                        // إعادة رسم الكروت بعد تحميل البيانات من Google Sheets
                        setTimeout(() => {
                            const quickStatsPanel = document.getElementById('sustainability-quick-stats');
                            if (quickStatsPanel) {
                                quickStatsPanel.innerHTML = this.renderQuickStats();
                            }
                        }, 100);
                    }
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في تحميل المحتوى:', error);
                }
            }, 0);
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في تحميل مديول الاستدامة:', error);
            } else {
                console.error('❌ خطأ في تحميل مديول الاستدامة:', error);
            }
            if (section) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">حدث خطأ أثناء تحميل البيانات</p>
                                <button onclick="Sustainability.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    إعادة المحاولة
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    },

    /**
     * عرض المؤشرات السريعة
     */
    renderQuickStats() {
        const waterData = AppState.appData.resourceConsumption?.water || [];
        const electricityData = AppState.appData.resourceConsumption?.electricity || [];
        const gasData = AppState.appData.resourceConsumption?.gas || [];

        // استخدم آخر شهر متاح في البيانات بدلاً من الشهر الحالي فقط،
        // حتى لا تظهر الكروت بصفر عند عدم وجود إدخالات للشهر الجاري.
        const waterLatest = this.getLatestMonthlyConsumption(waterData);
        const electricityLatest = this.getLatestMonthlyConsumption(electricityData);
        const gasLatest = this.getLatestMonthlyConsumption(gasData);

        const waterThisMonth = waterLatest.total;
        const electricityThisMonth = electricityLatest.total;
        const gasThisMonth = gasLatest.total;

        const waterTrend = this.getTrend(waterData, 'water');
        const electricityTrend = this.getTrend(electricityData, 'electricity');
        const gasTrend = this.getTrend(gasData, 'gas');

        return `
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center hover:shadow-md transition-shadow">
                <div class="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">${waterThisMonth.toFixed(2)}</div>
                <div class="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                    <i class="fas fa-tint ml-1"></i>مياه (م³)
                </div>
                <div class="text-xs mt-1 ${waterTrend === 'up' ? 'text-red-600' : waterTrend === 'down' ? 'text-green-600' : 'text-gray-500'}">
                    ${waterTrend === 'up' ? '↑' : waterTrend === 'down' ? '↓' : '→'} ${this.getTrendText(waterTrend)}
                </div>
            </div>
            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-center hover:shadow-md transition-shadow">
                <div class="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">${electricityThisMonth.toFixed(2)}</div>
                <div class="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                    <i class="fas fa-bolt ml-1"></i>كهرباء (ك.و)
                </div>
                <div class="text-xs mt-1 ${electricityTrend === 'up' ? 'text-red-600' : electricityTrend === 'down' ? 'text-green-600' : 'text-gray-500'}">
                    ${electricityTrend === 'up' ? '↑' : electricityTrend === 'down' ? '↓' : '→'} ${this.getTrendText(electricityTrend)}
                </div>
            </div>
            <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 text-center hover:shadow-md transition-shadow">
                <div class="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">${gasThisMonth.toFixed(2)}</div>
                <div class="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                    <i class="fas fa-fire ml-1"></i>غاز (م³)
                </div>
                <div class="text-xs mt-1 ${gasTrend === 'up' ? 'text-red-600' : gasTrend === 'down' ? 'text-green-600' : 'text-gray-500'}">
                    ${gasTrend === 'up' ? '↑' : gasTrend === 'down' ? '↓' : '→'} ${this.getTrendText(gasTrend)}
                </div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer" onclick="Sustainability.currentTab='dashboard'; Sustainability.load();">
                <div class="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                    ${this.getTotalAlerts()}
                </div>
                <div class="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                    <i class="fas fa-exclamation-triangle ml-1"></i>تنبيهات
                </div>
            </div>
        `;
    },

    /**
     * إعداد مستمعي الأحداث
     */
    setupEventListeners() {
        setTimeout(() => {
            const tabs = document.querySelectorAll('#sustainability-section .tab-btn');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    this.currentTab = tab.getAttribute('data-tab');
                    this.load();
                });
            });
            const refreshBtn = document.getElementById('sustainability-refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => this.handleRefresh());
            }
        }, 100);
    },

    /**
     * تحديث البيانات من Google Sheets وإعادة عرض المحتوى
     */
    async handleRefresh() {
        const btn = document.getElementById('sustainability-refresh-btn');
        if (!btn) return;
        const icon = btn.querySelector('i.fa-sync-alt');
        btn.disabled = true;
        if (icon) icon.classList.add('fa-spin');
        try {
            await Promise.all([
                this.loadResourceConsumptionFromSheets(),
                this.loadWasteManagementFromSheets()
            ]);
            await this.load();
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('خطأ أثناء تحديث بيانات الاستدامة:', error);
            } else {
                console.error('خطأ أثناء تحديث بيانات الاستدامة:', error);
            }
        } finally {
            btn.disabled = false;
            if (icon) icon.classList.remove('fa-spin');
        }
    },

    /**
     * عرض المحتوى حسب التبويب
     */
    async renderContent() {
        let content = '';
        switch (this.currentTab) {
            case 'dashboard':
                content = await this.renderDashboard();
                // رسم الرسوم البيانية بعد تحميل المحتوى
                setTimeout(() => {
                    this.renderCharts();
                }, 300);
                return content;
            case 'water':
                return await this.renderResourceRegister('water', 'مياه', 'tint', 'blue');
            case 'electricity':
                return await this.renderResourceRegister('electricity', 'كهرباء', 'bolt', 'yellow');
            case 'gas':
                return await this.renderResourceRegister('gas', 'غاز طبيعي', 'fire', 'orange');
            case 'waste-management':
                return await this.renderWasteManagement();
            case 'settings':
                return await this.renderSettings();
            default:
                content = await this.renderDashboard();
                setTimeout(() => {
                    this.renderCharts();
                }, 300);
                return content;
        }
    },

    /**
     * عرض لوحة التحليل
     */
    async renderDashboard() {
        const waterData = AppState.appData.resourceConsumption?.water || [];
        const electricityData = AppState.appData.resourceConsumption?.electricity || [];
        const gasData = AppState.appData.resourceConsumption?.gas || [];

        const analytics = this.calculateAnalytics();
        const alerts = this.getActiveAlerts();

        return `
            <div class="space-y-6">
                <!-- التنبيهات النشطة -->
                ${alerts.length > 0 ? `
                <div class="content-card border-l-4 border-red-500">
                    <div class="card-header bg-red-50 dark:bg-red-900/20">
                        <h2 class="card-title text-red-700 dark:text-red-400">
                            <i class="fas fa-exclamation-triangle ml-2"></i>
                            تنبيهات الاستهلاك
                        </h2>
                    </div>
                    <div class="card-body">
                        <div class="space-y-3">
                            ${alerts.map(alert => `
                                <div class="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                                    <div class="flex items-center gap-3">
                                        <i class="fas fa-${alert.icon} text-red-600 dark:text-red-400 text-xl"></i>
                                        <div>
                                            <div class="font-semibold text-red-700 dark:text-red-300">${alert.title}</div>
                                            <div class="text-sm text-red-600 dark:text-red-400">${alert.message}</div>
                                        </div>
                                    </div>
                                    <span class="badge badge-danger">${alert.percentage.toFixed(1)}%</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- مؤشرات الأداء -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="content-card">
                        <div class="card-header">
                            <h3 class="card-title text-sm">
                                <i class="fas fa-tint text-blue-500 ml-2"></i>
                                إجمالي استهلاك المياه
                            </h3>
                        </div>
                        <div class="card-body">
                            <div class="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                                ${analytics.water.total.toFixed(2)}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">م³</div>
                            <div class="mt-2 text-xs ${analytics.water.trend === 'up' ? 'text-red-600' : analytics.water.trend === 'down' ? 'text-green-600' : 'text-gray-500'}">
                                ${analytics.water.trend === 'up' ? '↑' : analytics.water.trend === 'down' ? '↓' : '→'} 
                                ${analytics.water.trendText}
                            </div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="card-header">
                            <h3 class="card-title text-sm">
                                <i class="fas fa-bolt text-yellow-500 ml-2"></i>
                                إجمالي استهلاك الكهرباء
                            </h3>
                        </div>
                        <div class="card-body">
                            <div class="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
                                ${analytics.electricity.total.toFixed(2)}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">كيلووات</div>
                            <div class="mt-2 text-xs ${analytics.electricity.trend === 'up' ? 'text-red-600' : analytics.electricity.trend === 'down' ? 'text-green-600' : 'text-gray-500'}">
                                ${analytics.electricity.trend === 'up' ? '↑' : analytics.electricity.trend === 'down' ? '↓' : '→'} 
                                ${analytics.electricity.trendText}
                            </div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="card-header">
                            <h3 class="card-title text-sm">
                                <i class="fas fa-fire text-orange-500 ml-2"></i>
                                إجمالي استهلاك الغاز
                            </h3>
                        </div>
                        <div class="card-body">
                            <div class="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                                ${analytics.gas.total.toFixed(2)}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">م³</div>
                            <div class="mt-2 text-xs ${analytics.gas.trend === 'up' ? 'text-red-600' : analytics.gas.trend === 'down' ? 'text-green-600' : 'text-gray-500'}">
                                ${analytics.gas.trend === 'up' ? '↑' : analytics.gas.trend === 'down' ? '↓' : '→'} 
                                ${analytics.gas.trendText}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- أكثر موقع استهلاكاً -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-map-marker-alt ml-2"></i>
                            أكثر المواقع استهلاكاً
                        </h2>
                    </div>
                    <div class="card-body">
                        ${this.renderTopConsumingLocations()}
                    </div>
                </div>

                <!-- الرسوم البيانية -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="content-card">
                        <div class="card-header">
                            <h2 class="card-title">
                                <i class="fas fa-chart-bar ml-2"></i>
                                مقارنة شهرية - المياه
                            </h2>
                        </div>
                        <div class="card-body">
                            <div style="position: relative; height: 300px;">
                                <canvas id="water-monthly-chart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="card-header">
                            <h2 class="card-title">
                                <i class="fas fa-chart-bar ml-2"></i>
                                مقارنة شهرية - الكهرباء
                            </h2>
                        </div>
                        <div class="card-body">
                            <div style="position: relative; height: 300px;">
                                <canvas id="electricity-monthly-chart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="card-header">
                            <h2 class="card-title">
                                <i class="fas fa-chart-bar ml-2"></i>
                                مقارنة شهرية - الغاز
                            </h2>
                        </div>
                        <div class="card-body">
                            <div style="position: relative; height: 300px;">
                                <canvas id="gas-monthly-chart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="card-header">
                            <h2 class="card-title">
                                <i class="fas fa-chart-pie ml-2"></i>
                                توزيع الاستهلاك حسب المصدر
                            </h2>
                        </div>
                        <div class="card-body">
                            <div style="position: relative; height: 300px;">
                                <canvas id="source-distribution-chart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض سجل استهلاك الموارد
     */
    async renderResourceRegister(type, name, icon, color) {
        const data = AppState.appData.resourceConsumption?.[type] || [];
        const hasAlerts = data.some(record => record.hasAlert);

        return `
            <div class="space-y-4">
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title">
                                <i class="fas fa-${icon} text-${color}-500 ml-2"></i>
                                سجل استهلاك ${name}
                            </h2>
                            <button class="btn-primary" onclick="Sustainability.showResourceForm('${type}')">
                                <i class="fas fa-plus ml-2"></i>
                                إضافة سجل جديد
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        ${data.length === 0 ? `
                            <div class="empty-state">
                                <i class="fas fa-${icon} text-4xl text-${color}-400 mb-4"></i>
                                <p class="text-gray-500">لا توجد سجلات لاستهلاك ${name}. ابدأ بإضافة سجلات جديدة.</p>
                            </div>
                        ` : `
                            <div class="overflow-x-auto">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>التاريخ</th>
                                            <th>الشهر / السنة</th>
                                            <th>الموقع / المصنع</th>
                                            <th>قراءة البداية</th>
                                            <th>قراءة النهاية</th>
                                            <th>إجمالي الاستهلاك</th>
                                            <th>وحدة القياس</th>
                                            <th>الجهة / القسم</th>
                                            <th>الحالة</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${data.map((record, index) => {
                                            const alertClass = record.hasAlert ? 'bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500' : '';
                                            return `
                                                <tr class="${alertClass}" data-record-id="${record.id}">
                                                    <td>${index + 1}</td>
                                                    <td>${Utils.formatDate(record.date)}</td>
                                                    <td>${record.monthYear || this.getMonthYear(record.date)}</td>
                                                    <td>${Utils.escapeHTML(record.location || '')}</td>
                                                    <td>${parseFloat(record.startReading || 0).toFixed(2)}</td>
                                                    <td>${parseFloat(record.endReading || 0).toFixed(2)}</td>
                                                    <td class="font-semibold">${parseFloat(record.totalConsumption || 0).toFixed(2)}</td>
                                                    <td>${Utils.escapeHTML(record.unit || this.getDefaultUnit(type))}</td>
                                                    <td>${Utils.escapeHTML(record.department || '')}</td>
                                                    <td>
                                                        ${record.hasAlert ? `
                                                            <span class="badge badge-danger">
                                                                <i class="fas fa-exclamation-triangle ml-1"></i>
                                                                تنبيه
                                                            </span>
                                                        ` : `
                                                            <span class="badge badge-success">طبيعي</span>
                                                        `}
                                                    </td>
                                                    <td>
                                                        <div class="flex items-center gap-2">
                                                            <button onclick="Sustainability.viewResourceRecord('${type}', '${record.id}')" 
                                                                    class="btn-icon btn-icon-info" title="عرض">
                                                                <i class="fas fa-eye"></i>
                                                            </button>
                                                            ${this.canEdit() ? `
                                                            <button onclick="Sustainability.editResourceRecord('${type}', '${record.id}')" 
                                                                    class="btn-icon btn-icon-primary" title="تعديل">
                                                                <i class="fas fa-edit"></i>
                                                            </button>
                                                            ` : ''}
                                                            ${this.canDelete() ? `
                                                            <button onclick="Sustainability.deleteResourceRecord('${type}', '${record.id}')" 
                                                                    class="btn-icon btn-icon-danger" title="حذف">
                                                                <i class="fas fa-trash"></i>
                                                            </button>
                                                            ` : ''}
                                                        </div>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض نموذج إضافة/تعديل سجل
     */
    showResourceForm(type, recordId = null) {
        const record = recordId 
            ? (AppState.appData.resourceConsumption?.[type] || []).find(r => r.id === recordId)
            : null;

        const typeNames = {
            water: { name: 'مياه', icon: 'tint', color: 'blue' },
            electricity: { name: 'كهرباء', icon: 'bolt', color: 'yellow' },
            gas: { name: 'غاز طبيعي', icon: 'fire', color: 'orange' }
        };

        const typeInfo = typeNames[type] || typeNames.water;
        const dateValue = record?.date ? new Date(record.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        const monthYearValue = record?.monthYear || this.getMonthYear(new Date());

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-${typeInfo.icon} text-${typeInfo.color}-500 ml-2"></i>
                        ${record ? 'تعديل' : 'إضافة'} سجل استهلاك ${typeInfo.name}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="resource-form-${type}" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    التاريخ <span class="text-red-500">*</span>
                                </label>
                                <input type="date" id="resource-date-${type}" required 
                                       class="form-input" value="${dateValue}"
                                       onchange="Sustainability.updateMonthYear('${type}')">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    الشهر / السنة <span class="text-red-500">*</span>
                                </label>
                                <input type="text" id="resource-month-year-${type}" required 
                                       class="form-input" value="${monthYearValue}" 
                                       placeholder="مثال: يناير 2024" readonly>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                الموقع / المصنع <span class="text-red-500">*</span>
                            </label>
                            <select id="resource-location-${type}" required class="form-input">
                                <option value="">-- اختر الموقع / المصنع --</option>
                                ${this.getSiteOptions().map(site => `
                                    <option value="${Utils.escapeHTML(site.name)}" ${record?.location === site.name ? 'selected' : ''}>
                                        ${Utils.escapeHTML(site.name)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                المصدر <span class="text-red-500">*</span>
                            </label>
                            <input type="text" id="resource-source-${type}" required 
                                   class="form-input" 
                                   value="${Utils.escapeHTML(record?.source || typeInfo.name)}"
                                   placeholder="المصدر" readonly>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="resource-start-${type}" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    قراءة البداية <span class="text-red-500">*</span>
                                </label>
                                <input type="number" id="resource-start-${type}" required step="0.01"
                                       class="form-input" 
                                       value="${record?.startReading || ''}"
                                       placeholder="0.00"
                                       onchange="Sustainability.calculateConsumption('${type}')">
                            </div>
                            <div>
                                <label for="resource-end-${type}" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    قراءة النهاية <span class="text-red-500">*</span>
                                </label>
                                <input type="number" id="resource-end-${type}" required step="0.01"
                                       class="form-input" 
                                       value="${record?.endReading || ''}"
                                       placeholder="0.00"
                                       onchange="Sustainability.calculateConsumption('${type}')">
                            </div>
                        </div>
                        <div>
                            <label for="resource-total-${type}" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                إجمالي الاستهلاك <span class="text-red-500">*</span>
                            </label>
                            <input type="number" id="resource-total-${type}" required step="0.01"
                                   class="form-input font-semibold" 
                                   value="${record?.totalConsumption || ''}"
                                   placeholder="سيتم حسابه تلقائياً" readonly>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="resource-unit-${type}" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    وحدة القياس <span class="text-red-500">*</span>
                                </label>
                                <input type="text" id="resource-unit-${type}" required 
                                       class="form-input" 
                                       value="${Utils.escapeHTML(record?.unit || this.getDefaultUnit(type))}"
                                       placeholder="${this.getDefaultUnit(type)}" readonly>
                            </div>
                            <div>
                                <label for="resource-department-${type}" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    الجهة / القسم
                                </label>
                                <input type="text" id="resource-department-${type}" 
                                       class="form-input" 
                                       value="${Utils.escapeHTML(record?.department || '')}"
                                       placeholder="أدخل القسم أو الجهة">
                            </div>
                        </div>
                        <div>
                            <label for="resource-notes-${type}" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                ملاحظات
                            </label>
                            <textarea id="resource-notes-${type}" 
                                      class="form-input" rows="3"
                                      placeholder="ملاحظات إضافية">${Utils.escapeHTML(record?.notes || '')}</textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        إلغاء
                    </button>
                    <button type="button" id="save-resource-btn-${type}" class="btn-primary">
                        <i class="fas fa-save ml-2"></i>
                        حفظ
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const saveBtn = modal.querySelector(`#save-resource-btn-${type}`);
        saveBtn.addEventListener('click', () => this.handleResourceSubmit(type, recordId, modal));

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    /**
     * تحديث الشهر/السنة تلقائياً
     */
    updateMonthYear(type) {
        const dateInput = document.getElementById(`resource-date-${type}`);
        if (dateInput && dateInput.value) {
            const date = new Date(dateInput.value);
            const monthYear = this.getMonthYear(date);
            const monthYearInput = document.getElementById(`resource-month-year-${type}`);
            if (monthYearInput) {
                monthYearInput.value = monthYear;
            }
        }
    },

    /**
     * حساب الاستهلاك تلقائياً
     */
    calculateConsumption(type) {
        const startInput = document.getElementById(`resource-start-${type}`);
        const endInput = document.getElementById(`resource-end-${type}`);
        const totalInput = document.getElementById(`resource-total-${type}`);

        if (startInput && endInput && totalInput) {
            const start = parseFloat(startInput.value) || 0;
            const end = parseFloat(endInput.value) || 0;
            const total = Math.max(0, end - start);
            totalInput.value = total.toFixed(2);
        }
    },

    /**
     * معالجة حفظ السجل
     */
    async handleResourceSubmit(type, recordId, modal) {
        const form = document.getElementById(`resource-form-${type}`);
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const date = new Date(document.getElementById(`resource-date-${type}`).value);
        const monthYear = document.getElementById(`resource-month-year-${type}`).value;
        const location = document.getElementById(`resource-location-${type}`).value.trim();
        const source = document.getElementById(`resource-source-${type}`).value.trim();
        const startReading = parseFloat(document.getElementById(`resource-start-${type}`).value);
        const endReading = parseFloat(document.getElementById(`resource-end-${type}`).value);
        const totalConsumption = parseFloat(document.getElementById(`resource-total-${type}`).value);
        const unit = document.getElementById(`resource-unit-${type}`).value.trim();
        const department = document.getElementById(`resource-department-${type}`).value.trim();
        const notes = document.getElementById(`resource-notes-${type}`).value.trim();

        // التحقق من صحة البيانات
        if (endReading < startReading) {
            Notification.error('قراءة النهاية يجب أن تكون أكبر من قراءة البداية');
            return;
        }

        // التحقق من التنبيهات
        const hasAlert = this.checkConsumptionAlert(type, totalConsumption, monthYear);

        const formData = {
            id: recordId || Utils.generateId(type.toUpperCase().substring(0, 3)),
            serialNumber: recordId ? (AppState.appData.resourceConsumption?.[type] || []).find(r => r.id === recordId)?.serialNumber : this.generateSerialNumber(type),
            date: date.toISOString(),
            monthYear: monthYear,
            location: location,
            source: source,
            startReading: startReading,
            endReading: endReading,
            totalConsumption: totalConsumption,
            unit: unit,
            department: department,
            notes: notes,
            hasAlert: hasAlert,
            createdAt: recordId ? (AppState.appData.resourceConsumption?.[type] || []).find(r => r.id === recordId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: AppState.currentUser?.email || AppState.currentUser?.name || 'Unknown',
            updatedBy: AppState.currentUser?.email || AppState.currentUser?.name || 'Unknown'
        };

        if (!AppState.appData.resourceConsumption) {
            AppState.appData.resourceConsumption = {};
        }
        if (!AppState.appData.resourceConsumption[type]) {
            AppState.appData.resourceConsumption[type] = [];
        }

        Loading.show();
        try {
            if (recordId) {
                const index = AppState.appData.resourceConsumption[type].findIndex(r => r.id === recordId);
                if (index !== -1) {
                    AppState.appData.resourceConsumption[type][index] = formData;
                    Notification.success('تم تحديث السجل بنجاح');
                }
            } else {
                AppState.appData.resourceConsumption[type].push(formData);
                Notification.success('تم إضافة السجل بنجاح');
            }

            // حفظ البيانات
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }

            // حفظ في الجداول المنفصلة
            await this.saveResourceConsumptionToSheets();

            Loading.hide();
            modal.remove();
            this.load();

            // إظهار تنبيه إذا كان هناك تحذير
            if (hasAlert) {
                Notification.warning(`تنبيه: استهلاك ${this.getTypeName(type)} تجاوز الحد المسموح`);
            }
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    /**
     * عرض تفاصيل السجل
     */
    viewResourceRecord(type, recordId) {
        const data = AppState.appData.resourceConsumption?.[type] || [];
        const record = data.find(r => r.id === recordId);
        if (!record) {
            Notification.error('السجل غير موجود');
            return;
        }

        const typeNames = {
            water: { name: 'مياه', icon: 'tint', color: 'blue' },
            electricity: { name: 'كهرباء', icon: 'bolt', color: 'yellow' },
            gas: { name: 'غاز طبيعي', icon: 'fire', color: 'orange' }
        };
        const typeInfo = typeNames[type] || typeNames.water;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-${typeInfo.icon} text-${typeInfo.color}-500 ml-2"></i>
                        تفاصيل سجل استهلاك ${typeInfo.name}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-3">
                        <div class="grid grid-cols-2 gap-4">
                            <div><strong>الرقم التسلسلي:</strong> ${Utils.escapeHTML(record.serialNumber || '')}</div>
                            <div><strong>التاريخ:</strong> ${Utils.formatDate(record.date)}</div>
                            <div><strong>الشهر / السنة:</strong> ${Utils.escapeHTML(record.monthYear || '')}</div>
                            <div><strong>الموقع / المصنع:</strong> ${Utils.escapeHTML(record.location || '')}</div>
                            <div><strong>المصدر:</strong> ${Utils.escapeHTML(record.source || '')}</div>
                            <div><strong>قراءة البداية:</strong> ${parseFloat(record.startReading || 0).toFixed(2)}</div>
                            <div><strong>قراءة النهاية:</strong> ${parseFloat(record.endReading || 0).toFixed(2)}</div>
                            <div><strong>إجمالي الاستهلاك:</strong> <span class="font-semibold">${parseFloat(record.totalConsumption || 0).toFixed(2)} ${Utils.escapeHTML(record.unit || '')}</span></div>
                            <div><strong>وحدة القياس:</strong> ${Utils.escapeHTML(record.unit || '')}</div>
                            <div><strong>الجهة / القسم:</strong> ${Utils.escapeHTML(record.department || '-')}</div>
                            <div><strong>الحالة:</strong> 
                                ${record.hasAlert ? `
                                    <span class="badge badge-danger">
                                        <i class="fas fa-exclamation-triangle ml-1"></i>
                                        تنبيه
                                    </span>
                                ` : `
                                    <span class="badge badge-success">طبيعي</span>
                                `}
                            </div>
                        </div>
                        ${record.notes ? `
                            <div class="mt-4 pt-4 border-t">
                                <strong>ملاحظات:</strong>
                                <p class="text-gray-700 dark:text-gray-300 mt-2">${Utils.escapeHTML(record.notes)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        إغلاق
                    </button>
                    ${this.canEdit() ? `
                    <button type="button" class="btn-primary" onclick="Sustainability.editResourceRecord('${type}', '${recordId}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>
                        تعديل
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

    /**
     * تعديل السجل
     */
    editResourceRecord(type, recordId) {
        if (!this.canEdit()) {
            Notification.error('ليس لديك صلاحية لتعديل السجلات');
            return;
        }
        this.showResourceForm(type, recordId);
    },

    /**
     * حذف السجل
     */
    async deleteResourceRecord(type, recordId) {
        if (!this.canDelete()) {
            Notification.error('ليس لديك صلاحية لحذف السجلات');
            return;
        }

        if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;

        Loading.show();
        try {
            AppState.appData.resourceConsumption[type] = AppState.appData.resourceConsumption[type].filter(r => r.id !== recordId);

            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            // حفظ في الجداول المنفصلة
            await this.saveResourceConsumptionToSheets();
            Notification.success('تم حذف السجل بنجاح');
            this.load();
        } catch (error) {
            Notification.error('حدث خطأ: ' + error.message);
        } finally {
            Loading.hide();
        }
    },

    /**
     * عرض الإعدادات (للمدير فقط)
     */
    renderSettings() {
        if (!this.canManageSettings()) {
            return '<div class="empty-state"><p class="text-gray-500">ليس لديك صلاحية للوصول إلى الإعدادات</p></div>';
        }

        return `
            <div class="content-card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-cog ml-2"></i>
                        إعدادات الاستدامة البيئية
                    </h2>
                </div>
                <div class="card-body">
                    <form id="sustainability-settings-form" class="space-y-6">
                        <div>
                            <h3 class="text-lg font-semibold mb-4">حدود الاستهلاك الشهرية</h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label for="limit-water" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        <i class="fas fa-tint text-blue-500 ml-1"></i>
                                        حد استهلاك المياه (م³)
                                    </label>
                                    <input type="number" id="limit-water" step="0.01" 
                                           class="form-input" 
                                           value="${this.settings.consumptionLimits.water}">
                                </div>
                                <div>
                                    <label for="limit-electricity" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        <i class="fas fa-bolt text-yellow-500 ml-1"></i>
                                        حد استهلاك الكهرباء (ك.و)
                                    </label>
                                    <input type="number" id="limit-electricity" step="0.01" 
                                           class="form-input" 
                                           value="${this.settings.consumptionLimits.electricity}">
                                </div>
                                <div>
                                    <label for="limit-gas" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        <i class="fas fa-fire text-orange-500 ml-1"></i>
                                        حد استهلاك الغاز (م³)
                                    </label>
                                    <input type="number" id="limit-gas" step="0.01" 
                                           class="form-input" 
                                           value="${this.settings.consumptionLimits.gas}">
                                </div>
                            </div>
                        </div>
                        <div>
                            <label for="alert-threshold" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                نسبة التنبيه (% من المتوسط)
                            </label>
                            <input type="number" id="alert-threshold" step="0.1" min="1" max="2"
                                   class="form-input" 
                                   value="${this.settings.alertThreshold}">
                            <p class="text-xs text-gray-500 mt-1">
                                سيتم إظهار تنبيه عند تجاوز الاستهلاك لهذه النسبة من المتوسط الشهري
                            </p>
                        </div>
                        <div class="flex justify-end gap-2 pt-4 border-t">
                            <button type="button" class="btn-secondary" onclick="Sustainability.loadSettings(); Sustainability.currentTab='settings'; Sustainability.load();">
                                إلغاء
                            </button>
                            <button type="button" class="btn-primary" onclick="Sustainability.saveSettings()">
                                <i class="fas fa-save ml-2"></i>
                                حفظ الإعدادات
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    /**
     * حفظ الإعدادات
     */
    async saveSettings() {
        if (!this.canManageSettings()) {
            Notification.error('ليس لديك صلاحية لحفظ الإعدادات');
            return;
        }

        this.settings.consumptionLimits.water = parseFloat(document.getElementById('limit-water').value) || 10000;
        this.settings.consumptionLimits.electricity = parseFloat(document.getElementById('limit-electricity').value) || 50000;
        this.settings.consumptionLimits.gas = parseFloat(document.getElementById('limit-gas').value) || 30000;
        this.settings.alertThreshold = parseFloat(document.getElementById('alert-threshold').value) || 1.2;

        // حفظ في localStorage
        try {
            localStorage.setItem('sustainability_settings', JSON.stringify(this.settings));
            Notification.success('تم حفظ الإعدادات بنجاح');
            this.load();
        } catch (error) {
            Notification.error('حدث خطأ أثناء حفظ الإعدادات: ' + error.message);
        }
    },

    /**
     * تحميل الإعدادات
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('sustainability_settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            Utils.safeWarn('خطأ في تحميل إعدادات الاستدامة:', error);
        }
    },

    // ===== دوال مساعدة =====

    /**
     * الحصول على الشهر/السنة من التاريخ
     */
    getMonthYear(date) {
        const d = new Date(date);
        const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                       'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        return `${months[d.getMonth()]} ${d.getFullYear()}`;
    },

    /**
     * الحصول على الوحدة الافتراضية
     */
    getDefaultUnit(type) {
        const units = {
            water: 'م³',
            electricity: 'ك.و',
            gas: 'م³'
        };
        return units[type] || '';
    },

    /**
     * الحصول على اسم النوع
     */
    getTypeName(type) {
        const names = {
            water: 'المياه',
            electricity: 'الكهرباء',
            gas: 'الغاز الطبيعي'
        };
        return names[type] || type;
    },

    /**
     * إنشاء رقم تسلسلي
     */
    generateSerialNumber(type) {
        const data = AppState.appData.resourceConsumption?.[type] || [];
        const prefix = {
            water: 'WTR',
            electricity: 'ELC',
            gas: 'GAS'
        }[type] || 'RES';
        
        const nextNum = data.length + 1;
        return `${prefix}-${String(nextNum).padStart(6, '0')}`;
    },

    /**
     * الحصول على استهلاك الشهر الحالي
     */
    getMonthlyConsumption(data, month, year) {
        return data
            .filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getMonth() === month && recordDate.getFullYear() === year;
            })
            .reduce((sum, record) => sum + (parseFloat(record.totalConsumption) || 0), 0);
    },

    getLatestMonthContext(data = []) {
        const validDates = (data || [])
            .map((record) => new Date(record?.date))
            .filter((d) => !Number.isNaN(d.getTime()))
            .sort((a, b) => a - b);

        if (!validDates.length) return null;
        const latest = validDates[validDates.length - 1];
        return { month: latest.getMonth(), year: latest.getFullYear() };
    },

    getLatestMonthlyConsumption(data = []) {
        const latest = this.getLatestMonthContext(data);
        if (!latest) {
            return { total: 0, month: null, year: null };
        }
        return {
            total: this.getMonthlyConsumption(data, latest.month, latest.year),
            month: latest.month,
            year: latest.year
        };
    },

    /**
     * الحصول على اتجاه الاستهلاك
     */
    getTrend(data, type) {
        if (data.length < 2) return 'stable';

        const latest = this.getLatestMonthContext(data);
        if (!latest) return 'stable';
        const currentMonth = latest.month;
        const currentYear = latest.year;
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const current = this.getMonthlyConsumption(data, currentMonth, currentYear);
        const previous = this.getMonthlyConsumption(data, lastMonth, lastMonthYear);

        if (previous === 0) return 'stable';
        const change = ((current - previous) / previous) * 100;

        if (change > 5) return 'up';
        if (change < -5) return 'down';
        return 'stable';
    },

    /**
     * الحصول على نص الاتجاه
     */
    getTrendText(trend) {
        const texts = {
            up: 'زيادة',
            down: 'انخفاض',
            stable: 'ثابت'
        };
        return texts[trend] || 'ثابت';
    },

    /**
     * حساب التحليلات
     */
    calculateAnalytics() {
        const waterData = AppState.appData.resourceConsumption?.water || [];
        const electricityData = AppState.appData.resourceConsumption?.electricity || [];
        const gasData = AppState.appData.resourceConsumption?.gas || [];

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const calculate = (data, type) => {
            const total = data.reduce((sum, r) => sum + (parseFloat(r.totalConsumption) || 0), 0);
            const current = this.getMonthlyConsumption(data, currentMonth, currentYear);
            const previous = this.getMonthlyConsumption(data, lastMonth, lastMonthYear);
            const average = data.length > 0 ? total / data.length : 0;
            const trend = this.getTrend(data, type);
            const trendText = this.getTrendText(trend);

            return { total, current, previous, average, trend, trendText };
        };

        return {
            water: calculate(waterData, 'water'),
            electricity: calculate(electricityData, 'electricity'),
            gas: calculate(gasData, 'gas')
        };
    },

    /**
     * التحقق من تنبيه الاستهلاك
     */
    checkConsumptionAlert(type, consumption, monthYear) {
        const data = AppState.appData.resourceConsumption?.[type] || [];
        const monthlyData = data.filter(r => r.monthYear === monthYear);
        
        if (monthlyData.length === 0) return false;

        const monthlyTotal = monthlyData.reduce((sum, r) => sum + (parseFloat(r.totalConsumption) || 0), 0);
        const average = monthlyTotal / monthlyData.length;
        const threshold = average * this.settings.alertThreshold;

        return consumption > threshold;
    },

    /**
     * الحصول على التنبيهات النشطة
     */
    getActiveAlerts() {
        const alerts = [];
        const waterData = AppState.appData.resourceConsumption?.water || [];
        const electricityData = AppState.appData.resourceConsumption?.electricity || [];
        const gasData = AppState.appData.resourceConsumption?.gas || [];

        const checkAlerts = (data, type, name, icon) => {
            const latest = this.getLatestMonthContext(data);
            if (!latest) return;
            const monthlyData = data.filter(r => {
                const recordDate = new Date(r.date);
                return recordDate.getMonth() === latest.month && recordDate.getFullYear() === latest.year;
            });

            if (monthlyData.length === 0) return;

            const monthlyTotal = monthlyData.reduce((sum, r) => sum + (parseFloat(r.totalConsumption) || 0), 0);
            const limit = this.settings.consumptionLimits[type];
            const percentage = limit > 0 ? (monthlyTotal / limit) * 100 : 0;

            if (percentage > 100) {
                alerts.push({
                    type: type,
                    title: `استهلاك ${name} تجاوز الحد`,
                    message: `الاستهلاك الحالي: ${monthlyTotal.toFixed(2)} (${percentage.toFixed(1)}% من الحد)`,
                    percentage: percentage,
                    icon: icon
                });
            }
        };

        checkAlerts(waterData, 'water', 'المياه', 'tint');
        checkAlerts(electricityData, 'electricity', 'الكهرباء', 'bolt');
        checkAlerts(gasData, 'gas', 'الغاز', 'fire');

        return alerts;
    },

    /**
     * الحصول على إجمالي التنبيهات
     */
    getTotalAlerts() {
        return this.getActiveAlerts().length;
    },

    /**
     * رسم الرسوم البيانية
     */
    async renderCharts() {
        // التأكد من تحميل Chart.js
        const chartLoaded = await this.ensureChartJSLoaded();
        if (!chartLoaded || typeof Chart === 'undefined') {
            Utils.safeWarn('Chart.js غير متاح - لن يتم عرض الرسوم البيانية');
            return;
        }

        // رسم رسوم بيانية شهرية
        this.renderMonthlyChart('water-monthly-chart', 'water', 'مياه', 'rgba(59, 130, 246, 0.8)');
        this.renderMonthlyChart('electricity-monthly-chart', 'electricity', 'كهرباء', 'rgba(245, 158, 11, 0.8)');
        this.renderMonthlyChart('gas-monthly-chart', 'gas', 'غاز', 'rgba(249, 115, 22, 0.8)');
        
        // رسم توزيع المصادر
        this.renderSourceDistributionChart();
    },

    /**
     * التأكد من تحميل Chart.js
     */
    async ensureChartJSLoaded() {
        if (typeof Chart !== 'undefined') {
            return true;
        }

        const existingScript = document.querySelector('script[src*="chart.js"], script[src*="chartjs"]');
        if (existingScript) {
            return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 50; // 5 ثوان
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (typeof Chart !== 'undefined') {
                        clearInterval(checkInterval);
                        resolve(true);
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        resolve(false);
                    }
                }, 100);
            });
        }

        return false;
    },

    /**
     * رسم الرسم البياني الشهري
     */
    renderMonthlyChart(canvasId, type, name, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // إزالة الرسم السابق إن وجد
        if (canvas.chart) {
            canvas.chart.destroy();
        }

        const data = AppState.appData.resourceConsumption?.[type] || [];
        const monthlyData = this.getMonthlyData(data);

        const ctx = canvas.getContext('2d');
        canvas.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthlyData.map(d => d.month),
                datasets: [{
                    label: `استهلاك ${name}`,
                    data: monthlyData.map(d => d.total),
                    backgroundColor: color,
                    borderColor: color.replace('0.8', '1'),
                    borderWidth: 2,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        rtl: true
                    },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(0);
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * الحصول على البيانات الشهرية
     */
    getMonthlyData(data) {
        const monthlyMap = {};
        
        data.forEach(record => {
            const date = new Date(record.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthLabel = this.getMonthYear(date);
            
            if (!monthlyMap[monthKey]) {
                monthlyMap[monthKey] = {
                    month: monthLabel,
                    total: 0
                };
            }
            
            monthlyMap[monthKey].total += parseFloat(record.totalConsumption) || 0;
        });

        // ترتيب حسب التاريخ
        return Object.entries(monthlyMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-12) // آخر 12 شهر
            .map(([key, value]) => value);
    },

    /**
     * رسم توزيع المصادر
     */
    renderSourceDistributionChart() {
        const canvas = document.getElementById('source-distribution-chart');
        if (!canvas) return;

        if (canvas.chart) {
            canvas.chart.destroy();
        }

        const waterData = AppState.appData.resourceConsumption?.water || [];
        const electricityData = AppState.appData.resourceConsumption?.electricity || [];
        const gasData = AppState.appData.resourceConsumption?.gas || [];

        const waterTotal = waterData.reduce((sum, r) => sum + (parseFloat(r.totalConsumption) || 0), 0);
        const electricityTotal = electricityData.reduce((sum, r) => sum + (parseFloat(r.totalConsumption) || 0), 0);
        const gasTotal = gasData.reduce((sum, r) => sum + (parseFloat(r.totalConsumption) || 0), 0);

        const ctx = canvas.getContext('2d');
        canvas.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['مياه', 'كهرباء', 'غاز طبيعي'],
                datasets: [{
                    data: [waterTotal, electricityTotal, gasTotal],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(249, 115, 22, 0.8)'
                    ],
                    borderColor: [
                        'rgba(59, 130, 246, 1)',
                        'rgba(245, 158, 11, 1)',
                        'rgba(249, 115, 22, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        rtl: true
                    },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * عرض تبويب إدارة المخلفات
     */
    async renderWasteManagement() {
        try {
            const defaultWasteData = {
                regularWasteTypes: ['خشب', 'ورق', 'استرتش', 'بلاستيك', 'شكائر', 'جراكن فارغة'],
                regularWasteRecords: [],
                regularWasteSales: [],
                hazardousWasteRecords: []
            };
            
            const wasteData = AppState.appData.wasteManagement || defaultWasteData;
            
            // التأكد من وجود جميع الخصائص
            if (!wasteData.regularWasteTypes) wasteData.regularWasteTypes = defaultWasteData.regularWasteTypes;
            if (!wasteData.regularWasteRecords) wasteData.regularWasteRecords = [];
            if (!wasteData.regularWasteSales) wasteData.regularWasteSales = [];
            if (!wasteData.hazardousWasteRecords) wasteData.hazardousWasteRecords = [];

        return `
            <div class="space-y-6">
                <!-- التحليلات السريعة -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                        <div class="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                            ${this.getTotalRegularWasteQuantity(wasteData.regularWasteRecords || [])}
                        </div>
                        <div class="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                            <i class="fas fa-recycle ml-1"></i>إجمالي المخلفات العادية
                        </div>
                    </div>
                    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                        <div class="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
                            ${this.getTotalHazardousWasteQuantity(wasteData.hazardousWasteRecords || [])}
                        </div>
                        <div class="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                            <i class="fas fa-exclamation-triangle ml-1"></i>إجمالي المخلفات الخطرة
                        </div>
                    </div>
                    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center">
                        <div class="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                            ${this.getTotalSalesRevenue(wasteData.regularWasteSales || []).toFixed(2)}
                        </div>
                        <div class="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                            <i class="fas fa-money-bill-wave ml-1"></i>إجمالي العائد (ج.م)
                        </div>
                    </div>
                    <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-center">
                        <div class="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
                            ${(wasteData.regularWasteSales || []).length}
                        </div>
                        <div class="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                            <i class="fas fa-shopping-cart ml-1"></i>عمليات البيع
                        </div>
                    </div>
                </div>

                <!-- التبويبات الداخلية -->
                <div class="mt-6">
                    <div class="flex gap-2 mb-6 border-b overflow-x-auto">
                        <button class="tab-btn-internal ${this.currentWasteSubTab === 'regular' ? 'active' : ''}" 
                                onclick="Sustainability.currentWasteSubTab='regular'; Sustainability.load();">
                            <i class="fas fa-recycle ml-2"></i>المخلفات العادية
                        </button>
                        <button class="tab-btn-internal ${this.currentWasteSubTab === 'hazardous' ? 'active' : ''}" 
                                onclick="Sustainability.currentWasteSubTab='hazardous'; Sustainability.load();">
                            <i class="fas fa-exclamation-triangle ml-2"></i>المخلفات الخطرة
                        </button>
                        <button class="tab-btn-internal ${this.currentWasteSubTab === 'analytics' ? 'active' : ''}" 
                                onclick="Sustainability.currentWasteSubTab='analytics'; Sustainability.load();">
                            <i class="fas fa-chart-bar ml-2"></i>التحليلات
                        </button>
                        ${this.isAdmin() ? `
                        <button class="tab-btn-internal ${this.currentWasteSubTab === 'waste-types' ? 'active' : ''}" 
                                onclick="Sustainability.currentWasteSubTab='waste-types'; Sustainability.load();">
                            <i class="fas fa-list ml-2"></i>إدارة أنواع المخلفات
                        </button>
                        ` : ''}
                    </div>
                    <div id="waste-management-content">
                        ${await this.renderWasteManagementContent()}
                    </div>
                </div>
            </div>
            <style>
                .tab-btn-internal {
                    padding: 10px 20px;
                    border: none;
                    background: transparent;
                    color: #6b7280;
                    font-weight: 500;
                    cursor: pointer;
                    border-bottom: 3px solid transparent;
                    transition: all 0.3s;
                    white-space: nowrap;
                }
                .tab-btn-internal:hover {
                    color: #3b82f6;
                }
                .tab-btn-internal.active {
                    color: #3b82f6;
                    border-bottom-color: #3b82f6;
                    font-weight: 600;
                }
            </style>
        `;
        } catch (error) {
            Utils.safeError('❌ خطأ في renderWasteManagement:', error);
            return `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-4">حدث خطأ أثناء عرض بيانات إدارة المخلفات</p>
                            <button onclick="Sustainability.load()" class="btn-primary">
                                <i class="fas fa-redo ml-2"></i>
                                إعادة المحاولة
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * عرض محتوى تبويب إدارة المخلفات حسب التبويب الفرعي
     */
    async renderWasteManagementContent() {
        if (!this.currentWasteSubTab) {
            this.currentWasteSubTab = 'regular';
        }

        switch (this.currentWasteSubTab) {
            case 'regular':
                return await this.renderRegularWaste();
            case 'hazardous':
                return await this.renderHazardousWaste();
            case 'analytics':
                return await this.renderWasteAnalytics();
            case 'waste-types':
                return await this.renderWasteTypesManagement();
            default:
                return await this.renderRegularWaste();
        }
    },

    /**
     * عرض قسم المخلفات العادية
     */
    async renderRegularWaste() {
        const wasteData = AppState.appData.wasteManagement || {
            regularWasteRecords: [],
            regularWasteSales: []
        };
        const records = wasteData.regularWasteRecords || [];
        const sales = wasteData.regularWasteSales || [];

        return `
            <div class="space-y-6">
                <!-- سجل المخلفات العادية -->
                <div class="content-card border-l-4 border-green-500">
                    <div class="card-header bg-green-50 dark:bg-green-900/20">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title text-green-700 dark:text-green-400">
                                <i class="fas fa-recycle ml-2"></i>
                                سجل المخلفات العادية
                            </h2>
                            <button class="btn-success" onclick="Sustainability.showRegularWasteForm()">
                                <i class="fas fa-plus ml-2"></i>
                                إضافة سجل جديد
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        ${records.length === 0 ? `
                            <div class="empty-state">
                                <i class="fas fa-recycle text-4xl text-green-400 mb-4"></i>
                                <p class="text-gray-500">لا توجد سجلات للمخلفات العادية. ابدأ بإضافة سجلات جديدة.</p>
                            </div>
                        ` : `
                            <div class="overflow-x-auto">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>الرقم التسلسلي</th>
                                            <th>التاريخ</th>
                                            <th>الموقع / المصنع</th>
                                            <th>نوع المخلفات</th>
                                            <th>الكمية</th>
                                            <th>وحدة القياس</th>
                                            <th>القسم المنتج</th>
                                            <th>طريقة التخزين المؤقت</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${records.map((record, index) => `
                                            <tr class="bg-green-50/50 dark:bg-green-900/10" data-record-id="${record.id}">
                                                <td>${index + 1}</td>
                                                <td>${Utils.escapeHTML(record.serialNumber || '')}</td>
                                                <td>${Utils.formatDate(record.date)}</td>
                                                <td>${Utils.escapeHTML(record.location || '')}</td>
                                                <td>${Utils.escapeHTML(record.wasteType || '')}</td>
                                                <td class="font-semibold">${parseFloat(record.quantity || 0).toFixed(2)}</td>
                                                <td>${Utils.escapeHTML(record.unit || '')}</td>
                                                <td>${Utils.escapeHTML(record.department || '')}</td>
                                                <td>${Utils.escapeHTML(record.storageMethod || '')}</td>
                                                <td>
                                                    <div class="flex items-center gap-2">
                                                        <button onclick="Sustainability.viewRegularWasteRecord('${record.id}')" 
                                                                class="btn-icon btn-icon-info" title="عرض">
                                                            <i class="fas fa-eye"></i>
                                                        </button>
                                                        ${this.canEdit() ? `
                                                        <button onclick="Sustainability.editRegularWasteRecord('${record.id}')" 
                                                                class="btn-icon btn-icon-primary" title="تعديل">
                                                            <i class="fas fa-edit"></i>
                                                        </button>
                                                        ` : ''}
                                                        ${this.canDelete() ? `
                                                        <button onclick="Sustainability.deleteRegularWasteRecord('${record.id}')" 
                                                                class="btn-icon btn-icon-danger" title="حذف">
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
                        `}
                    </div>
                </div>

                <!-- سجل بيع المخلفات العادية -->
                <div class="content-card border-l-4 border-blue-500">
                    <div class="card-header bg-blue-50 dark:bg-blue-900/20">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title text-blue-700 dark:text-blue-400">
                                <i class="fas fa-shopping-cart ml-2"></i>
                                سجل بيع المخلفات العادية
                            </h2>
                            <button class="btn-primary" onclick="Sustainability.showRegularWasteSaleForm()">
                                <i class="fas fa-plus ml-2"></i>
                                إضافة عملية بيع
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        ${sales.length === 0 ? `
                            <div class="empty-state">
                                <i class="fas fa-shopping-cart text-4xl text-blue-400 mb-4"></i>
                                <p class="text-gray-500">لا توجد عمليات بيع مسجلة. ابدأ بإضافة عمليات بيع جديدة.</p>
                            </div>
                        ` : `
                            <div class="overflow-x-auto">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>رقم العملية</th>
                                            <th>التاريخ</th>
                                            <th>الموقع</th>
                                            <th>نوع المخلفات</th>
                                            <th>الكمية</th>
                                            <th>وحدة القياس</th>
                                            <th>سعر الوحدة</th>
                                            <th>إجمالي القيمة</th>
                                            <th>اسم المشتري</th>
                                            <th>طريقة البيع</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${sales.map((sale, index) => `
                                            <tr class="bg-blue-50/50 dark:bg-blue-900/10" data-sale-id="${sale.id}">
                                                <td>${index + 1}</td>
                                                <td>${Utils.escapeHTML(sale.transactionNumber || '')}</td>
                                                <td>${Utils.formatDate(sale.date)}</td>
                                                <td>${Utils.escapeHTML(sale.location || '')}</td>
                                                <td>${Utils.escapeHTML(sale.wasteType || '')}</td>
                                                <td>${parseFloat(sale.quantity || 0).toFixed(2)}</td>
                                                <td>${Utils.escapeHTML(sale.unit || '')}</td>
                                                <td>${parseFloat(sale.unitPrice || 0).toFixed(2)} ج.م</td>
                                                <td class="font-semibold text-green-600">${parseFloat(sale.totalValue || 0).toFixed(2)} ج.م</td>
                                                <td>${Utils.escapeHTML(sale.buyerName || '')}</td>
                                                <td>${Utils.escapeHTML(sale.paymentMethod || '')}</td>
                                                <td>
                                                    <div class="flex items-center gap-2">
                                                        <button onclick="Sustainability.viewRegularWasteSale('${sale.id}')" 
                                                                class="btn-icon btn-icon-info" title="عرض">
                                                            <i class="fas fa-eye"></i>
                                                        </button>
                                                        ${this.canEdit() ? `
                                                        <button onclick="Sustainability.editRegularWasteSale('${sale.id}')" 
                                                                class="btn-icon btn-icon-primary" title="تعديل">
                                                            <i class="fas fa-edit"></i>
                                                        </button>
                                                        ` : ''}
                                                        ${this.canDelete() ? `
                                                        <button onclick="Sustainability.deleteRegularWasteSale('${sale.id}')" 
                                                                class="btn-icon btn-icon-danger" title="حذف">
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
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض قسم المخلفات الخطرة
     */
    async renderHazardousWaste() {
        const wasteData = AppState.appData.wasteManagement || {};
        const records = wasteData.hazardousWasteRecords || [];

        return `
            <div class="space-y-6">
                <div class="content-card border-l-4 border-red-500">
                    <div class="card-header bg-red-50 dark:bg-red-900/20">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title text-red-700 dark:text-red-400">
                                <i class="fas fa-exclamation-triangle ml-2"></i>
                                سجل المخلفات الخطرة
                            </h2>
                            <button class="btn-danger" onclick="Sustainability.showHazardousWasteForm()">
                                <i class="fas fa-plus ml-2"></i>
                                إضافة سجل جديد
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        ${records.length === 0 ? `
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                                <p class="text-gray-500">لا توجد سجلات للمخلفات الخطرة. ابدأ بإضافة سجلات جديدة.</p>
                            </div>
                        ` : `
                            <div class="overflow-x-auto">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>الرقم التسلسلي</th>
                                            <th>التاريخ</th>
                                            <th>الموقع</th>
                                            <th>نوع المخلفات</th>
                                            <th>الكمية</th>
                                            <th>وحدة القياس</th>
                                            <th>تصنيف الخطورة</th>
                                            <th>طريقة التخزين</th>
                                            <th>شركة النقل</th>
                                            <th>جهة المعالجة</th>
                                            <th>تاريخ النقل</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${records.map((record, index) => `
                                            <tr class="bg-red-50/50 dark:bg-red-900/10" data-record-id="${record.id}">
                                                <td>${index + 1}</td>
                                                <td>${Utils.escapeHTML(record.serialNumber || '')}</td>
                                                <td>${Utils.formatDate(record.date)}</td>
                                                <td>${Utils.escapeHTML(record.location || '')}</td>
                                                <td>${Utils.escapeHTML(record.wasteType || '')}</td>
                                                <td class="font-semibold">${parseFloat(record.quantity || 0).toFixed(2)}</td>
                                                <td>${Utils.escapeHTML(record.unit || '')}</td>
                                                <td>
                                                    <span class="badge badge-danger">${Utils.escapeHTML(record.hazardClassification || '')}</span>
                                                </td>
                                                <td>${Utils.escapeHTML(record.storageMethod || '')}</td>
                                                <td>${Utils.escapeHTML(record.transportCompany || '')}</td>
                                                <td>${Utils.escapeHTML(record.treatmentFacility || '')}</td>
                                                <td>${record.transportDate ? Utils.formatDate(record.transportDate) : '-'}</td>
                                                <td>
                                                    <div class="flex items-center gap-2">
                                                        <button onclick="Sustainability.viewHazardousWasteRecord('${record.id}')" 
                                                                class="btn-icon btn-icon-info" title="عرض">
                                                            <i class="fas fa-eye"></i>
                                                        </button>
                                                        ${this.canEdit() ? `
                                                        <button onclick="Sustainability.editHazardousWasteRecord('${record.id}')" 
                                                                class="btn-icon btn-icon-primary" title="تعديل">
                                                            <i class="fas fa-edit"></i>
                                                        </button>
                                                        ` : ''}
                                                        ${this.canDelete() ? `
                                                        <button onclick="Sustainability.deleteHazardousWasteRecord('${record.id}')" 
                                                                class="btn-icon btn-icon-danger" title="حذف">
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
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض تحليلات المخلفات
     */
    async renderWasteAnalytics() {
        const wasteData = AppState.appData.wasteManagement || {
            regularWasteRecords: [],
            regularWasteSales: [],
            hazardousWasteRecords: []
        };

        const monthlyData = this.getMonthlyWasteData(wasteData);

        return `
            <div class="space-y-6">
                <!-- مؤشرات الأداء -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="content-card">
                        <div class="card-header">
                            <h3 class="card-title text-sm">
                                <i class="fas fa-recycle text-green-500 ml-2"></i>
                                إجمالي كميات المخلفات العادية
                            </h3>
                        </div>
                        <div class="card-body">
                            <div class="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                                ${this.getTotalRegularWasteQuantity(wasteData.regularWasteRecords || [])}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">وحدة قياس</div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="card-header">
                            <h3 class="card-title text-sm">
                                <i class="fas fa-exclamation-triangle text-red-500 ml-2"></i>
                                إجمالي كميات المخلفات الخطرة
                            </h3>
                        </div>
                        <div class="card-body">
                            <div class="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
                                ${this.getTotalHazardousWasteQuantity(wasteData.hazardousWasteRecords || [])}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">وحدة قياس</div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="card-header">
                            <h3 class="card-title text-sm">
                                <i class="fas fa-money-bill-wave text-blue-500 ml-2"></i>
                                إجمالي العائد من بيع المخلفات العادية
                            </h3>
                        </div>
                        <div class="card-body">
                            <div class="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                                ${this.getTotalSalesRevenue(wasteData.regularWasteSales || []).toFixed(2)}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">جنيه مصري</div>
                        </div>
                    </div>
                </div>

                <!-- مقارنة شهرية -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-chart-bar ml-2"></i>
                            مقارنة شهرية - الكميات والعائد
                        </h2>
                    </div>
                    <div class="card-body">
                        <div class="overflow-x-auto">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>الشهر</th>
                                        <th>المخلفات العادية</th>
                                        <th>المخلفات الخطرة</th>
                                        <th>عائد البيع (ج.م)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${monthlyData && monthlyData.length > 0 ? monthlyData.map(month => `
                                        <tr>
                                            <td class="font-semibold">${Utils.escapeHTML(month.month || '')}</td>
                                            <td class="text-green-600 font-semibold">${(month.regularQuantity || 0).toFixed(2)}</td>
                                            <td class="text-red-600 font-semibold">${(month.hazardousQuantity || 0).toFixed(2)}</td>
                                            <td class="text-blue-600 font-semibold">${(month.revenue || 0).toFixed(2)}</td>
                                        </tr>
                                    `).join('') : `
                                        <tr>
                                            <td colspan="4" class="text-center text-gray-500 py-4">لا توجد بيانات للعرض</td>
                                        </tr>
                                    `}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض إدارة أنواع المخلفات (Admin Only)
     */
    async renderWasteTypesManagement() {
        if (!this.isAdmin()) {
            return '<div class="empty-state"><p class="text-gray-500">ليس لديك صلاحية للوصول إلى هذا القسم</p></div>';
        }

        const wasteData = AppState.appData.wasteManagement || {
            regularWasteTypes: ['خشب', 'ورق', 'استرتش', 'بلاستيك', 'شكائر', 'جراكن فارغة']
        };
        const types = wasteData.regularWasteTypes || [];

        return `
            <div class="content-card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-list ml-2"></i>
                        إدارة أنواع المخلفات العادية
                    </h2>
                </div>
                <div class="card-body">
                    <div class="space-y-3 mb-4">
                        ${types.map((type, index) => `
                            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <span class="font-semibold">${Utils.escapeHTML(type)}</span>
                                <button onclick="Sustainability.deleteWasteType(${index})" 
                                        class="btn-danger btn-sm">
                                    <i class="fas fa-trash ml-2"></i>
                                    حذف
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="flex gap-2">
                        <input type="text" id="new-waste-type-input" 
                               class="form-input flex-1" 
                               placeholder="أدخل نوع مخلفات جديد">
                        <button onclick="Sustainability.addWasteType()" class="btn-success">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة نوع جديد
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض أكثر المواقع استهلاكاً
     */
    renderTopConsumingLocations() {
        const waterData = AppState.appData.resourceConsumption?.water || [];
        const electricityData = AppState.appData.resourceConsumption?.electricity || [];
        const gasData = AppState.appData.resourceConsumption?.gas || [];

        const locationStats = {};

        [...waterData, ...electricityData, ...gasData].forEach(record => {
            const location = record.location || 'غير محدد';
            if (!locationStats[location]) {
                locationStats[location] = { water: 0, electricity: 0, gas: 0, total: 0 };
            }
            
            const type = record.source === 'مياه' ? 'water' : 
                        record.source === 'كهرباء' ? 'electricity' : 
                        record.source === 'غاز' ? 'gas' : 'other';
            
            if (type !== 'other') {
                locationStats[location][type] += parseFloat(record.totalConsumption) || 0;
                locationStats[location].total += parseFloat(record.totalConsumption) || 0;
            }
        });

        const sorted = Object.entries(locationStats)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 5);

        if (sorted.length === 0) {
            return '<p class="text-gray-500 text-center py-4">لا توجد بيانات للعرض</p>';
        }

        return `
            <div class="space-y-3">
                ${sorted.map(([location, stats], index) => `
                    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                                ${index + 1}
                            </div>
                            <div>
                                <div class="font-semibold">${Utils.escapeHTML(location)}</div>
                                <div class="text-xs text-gray-500">
                                    مياه: ${stats.water.toFixed(2)} | كهرباء: ${stats.electricity.toFixed(2)} | غاز: ${stats.gas.toFixed(2)}
                                </div>
                            </div>
                        </div>
                        <div class="text-lg font-bold text-blue-600 dark:text-blue-400">
                            ${stats.total.toFixed(2)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // ===== دوال إدارة المخلفات =====

    /**
     * عرض نموذج إضافة/تعديل سجل مخلفات عادية
     */
    showRegularWasteForm(recordId = null) {
        const wasteData = AppState.appData.wasteManagement || {
            regularWasteTypes: ['خشب', 'ورق', 'استرتش', 'بلاستيك', 'شكائر', 'جراكن فارغة'],
            regularWasteRecords: []
        };
        const record = recordId 
            ? (wasteData.regularWasteRecords || []).find(r => r.id === recordId)
            : null;

        const dateValue = record?.date ? new Date(record.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        const wasteTypes = wasteData.regularWasteTypes || [];

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-recycle text-green-500 ml-2"></i>
                        ${record ? 'تعديل' : 'إضافة'} سجل مخلفات عادية
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="regular-waste-form" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    التاريخ <span class="text-red-500">*</span>
                                </label>
                                <input type="date" id="regular-waste-date" required 
                                       class="form-input" value="${dateValue}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    الموقع / المصنع <span class="text-red-500">*</span>
                                </label>
                                <select id="regular-waste-location" required class="form-input">
                                    <option value="">-- اختر الموقع --</option>
                                    ${this.getSiteOptions().map(site => `
                                        <option value="${Utils.escapeHTML(site.name)}" ${record?.location === site.name ? 'selected' : ''}>
                                            ${Utils.escapeHTML(site.name)}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    نوع المخلفات <span class="text-red-500">*</span>
                                </label>
                                <select id="regular-waste-type" required class="form-input">
                                    <option value="">-- اختر النوع --</option>
                                    ${wasteTypes.map(type => `
                                        <option value="${Utils.escapeHTML(type)}" ${record?.wasteType === type ? 'selected' : ''}>
                                            ${Utils.escapeHTML(type)}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    وحدة القياس <span class="text-red-500">*</span>
                                </label>
                                <input type="text" id="regular-waste-unit" required 
                                       class="form-input" 
                                       value="${Utils.escapeHTML(record?.unit || 'كجم')}"
                                       placeholder="كجم / طن / م³">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                الكمية <span class="text-red-500">*</span>
                            </label>
                            <input type="number" id="regular-waste-quantity" required step="0.01"
                                   class="form-input" 
                                   value="${record?.quantity || ''}"
                                   placeholder="0.00">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                القسم المنتج
                            </label>
                            <input type="text" id="regular-waste-department" 
                                   class="form-input" 
                                   value="${Utils.escapeHTML(record?.department || '')}"
                                   placeholder="أدخل القسم المنتج">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                طريقة التخزين المؤقت
                            </label>
                            <input type="text" id="regular-waste-storage" 
                                   class="form-input" 
                                   value="${Utils.escapeHTML(record?.storageMethod || '')}"
                                   placeholder="أدخل طريقة التخزين">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                ملاحظات
                            </label>
                            <textarea id="regular-waste-notes" 
                                      class="form-input" rows="3"
                                      placeholder="ملاحظات إضافية">${Utils.escapeHTML(record?.notes || '')}</textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        إلغاء
                    </button>
                    <button type="button" id="save-regular-waste-btn" class="btn-success">
                        <i class="fas fa-save ml-2"></i>
                        حفظ
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const saveBtn = modal.querySelector('#save-regular-waste-btn');
        saveBtn.addEventListener('click', () => this.handleRegularWasteSubmit(recordId, modal));

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    /**
     * معالجة حفظ سجل مخلفات عادية
     */
    async handleRegularWasteSubmit(recordId, modal) {
        const form = document.getElementById('regular-waste-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const date = new Date(document.getElementById('regular-waste-date').value);
        const location = document.getElementById('regular-waste-location').value.trim();
        const wasteType = document.getElementById('regular-waste-type').value.trim();
        const quantity = parseFloat(document.getElementById('regular-waste-quantity').value);
        const unit = document.getElementById('regular-waste-unit').value.trim();
        const department = document.getElementById('regular-waste-department').value.trim();
        const storageMethod = document.getElementById('regular-waste-storage').value.trim();
        const notes = document.getElementById('regular-waste-notes').value.trim();

        if (!AppState.appData.wasteManagement) {
            AppState.appData.wasteManagement = {
                regularWasteTypes: ['خشب', 'ورق', 'استرتش', 'بلاستيك', 'شكائر', 'جراكن فارغة'],
                regularWasteRecords: [],
                regularWasteSales: [],
                hazardousWasteRecords: []
            };
        }

        const formData = {
            id: recordId || Utils.generateId('RWR'),
            serialNumber: recordId ? (AppState.appData.wasteManagement.regularWasteRecords || []).find(r => r.id === recordId)?.serialNumber : this.generateWasteSerialNumber('regular'),
            date: date.toISOString(),
            location: location,
            wasteType: wasteType,
            quantity: quantity,
            unit: unit,
            department: department,
            storageMethod: storageMethod,
            notes: notes,
            createdAt: recordId ? (AppState.appData.wasteManagement.regularWasteRecords || []).find(r => r.id === recordId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: AppState.currentUser?.email || AppState.currentUser?.name || 'Unknown',
            updatedBy: AppState.currentUser?.email || AppState.currentUser?.name || 'Unknown'
        };

        Loading.show();
        try {
            if (!AppState.appData.wasteManagement.regularWasteRecords) {
                AppState.appData.wasteManagement.regularWasteRecords = [];
            }

            if (recordId) {
                const index = AppState.appData.wasteManagement.regularWasteRecords.findIndex(r => r.id === recordId);
                if (index !== -1) {
                    AppState.appData.wasteManagement.regularWasteRecords[index] = formData;
                    Notification.success('تم تحديث السجل بنجاح');
                }
            } else {
                AppState.appData.wasteManagement.regularWasteRecords.push(formData);
                Notification.success('تم إضافة السجل بنجاح');
            }

            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            await this.saveWasteManagementToSheets();

            Loading.hide();
            modal.remove();
            this.load();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    /**
     * عرض نموذج إضافة/تعديل عملية بيع مخلفات عادية
     */
    showRegularWasteSaleForm(saleId = null) {
        const wasteData = AppState.appData.wasteManagement || {
            regularWasteTypes: ['خشب', 'ورق', 'استرتش', 'بلاستيك', 'شكائر', 'جراكن فارغة'],
            regularWasteSales: []
        };
        const sale = saleId 
            ? (wasteData.regularWasteSales || []).find(s => s.id === saleId)
            : null;

        const dateValue = sale?.date ? new Date(sale.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        const wasteTypes = wasteData.regularWasteTypes || [];

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-shopping-cart text-blue-500 ml-2"></i>
                        ${sale ? 'تعديل' : 'إضافة'} عملية بيع مخلفات عادية
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="regular-waste-sale-form" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    التاريخ <span class="text-red-500">*</span>
                                </label>
                                <input type="date" id="sale-date" required 
                                       class="form-input" value="${dateValue}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    الموقع <span class="text-red-500">*</span>
                                </label>
                                <select id="sale-location" required class="form-input">
                                    <option value="">-- اختر الموقع --</option>
                                    ${this.getSiteOptions().map(site => `
                                        <option value="${Utils.escapeHTML(site.name)}" ${sale?.location === site.name ? 'selected' : ''}>
                                            ${Utils.escapeHTML(site.name)}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    نوع المخلفات <span class="text-red-500">*</span>
                                </label>
                                <select id="sale-waste-type" required class="form-input">
                                    <option value="">-- اختر النوع --</option>
                                    ${wasteTypes.map(type => `
                                        <option value="${Utils.escapeHTML(type)}" ${sale?.wasteType === type ? 'selected' : ''}>
                                            ${Utils.escapeHTML(type)}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    وحدة القياس <span class="text-red-500">*</span>
                                </label>
                                <input type="text" id="sale-unit" required 
                                       class="form-input" 
                                       value="${Utils.escapeHTML(sale?.unit || 'كجم')}"
                                       placeholder="كجم / طن / م³">
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    الكمية <span class="text-red-500">*</span>
                                </label>
                                <input type="number" id="sale-quantity" required step="0.01"
                                       class="form-input" 
                                       value="${sale?.quantity || ''}"
                                       placeholder="0.00"
                                       onchange="Sustainability.calculateSaleTotal()">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    سعر الوحدة (ج.م) <span class="text-red-500">*</span>
                                </label>
                                <input type="number" id="sale-unit-price" required step="0.01"
                                       class="form-input" 
                                       value="${sale?.unitPrice || ''}"
                                       placeholder="0.00"
                                       onchange="Sustainability.calculateSaleTotal()">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                إجمالي القيمة (ج.م) <span class="text-red-500">*</span>
                            </label>
                            <input type="number" id="sale-total-value" required step="0.01"
                                   class="form-input font-semibold" 
                                   value="${sale?.totalValue || ''}"
                                   placeholder="سيتم حسابه تلقائياً" readonly>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    اسم المشتري / الجهة <span class="text-red-500">*</span>
                                </label>
                                <input type="text" id="sale-buyer" required 
                                       class="form-input" 
                                       value="${Utils.escapeHTML(sale?.buyerName || '')}"
                                       placeholder="أدخل اسم المشتري">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    طريقة البيع <span class="text-red-500">*</span>
                                </label>
                                <select id="sale-payment-method" required class="form-input">
                                    <option value="">-- اختر طريقة البيع --</option>
                                    <option value="نقدي" ${sale?.paymentMethod === 'نقدي' ? 'selected' : ''}>نقدي</option>
                                    <option value="تحويل" ${sale?.paymentMethod === 'تحويل' ? 'selected' : ''}>تحويل</option>
                                    <option value="تعاقد" ${sale?.paymentMethod === 'تعاقد' ? 'selected' : ''}>تعاقد</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                ملاحظات
                            </label>
                            <textarea id="sale-notes" 
                                      class="form-input" rows="3"
                                      placeholder="ملاحظات إضافية">${Utils.escapeHTML(sale?.notes || '')}</textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        إلغاء
                    </button>
                    <button type="button" id="save-sale-btn" class="btn-primary">
                        <i class="fas fa-save ml-2"></i>
                        حفظ
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const saveBtn = modal.querySelector('#save-sale-btn');
        saveBtn.addEventListener('click', () => this.handleRegularWasteSaleSubmit(saleId, modal));

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // حساب القيمة الإجمالية عند التحميل
        setTimeout(() => this.calculateSaleTotal(), 100);
    },

    /**
     * حساب إجمالي قيمة البيع
     */
    calculateSaleTotal() {
        const quantityInput = document.getElementById('sale-quantity');
        const unitPriceInput = document.getElementById('sale-unit-price');
        const totalInput = document.getElementById('sale-total-value');

        if (quantityInput && unitPriceInput && totalInput) {
            const quantity = parseFloat(quantityInput.value) || 0;
            const unitPrice = parseFloat(unitPriceInput.value) || 0;
            const total = quantity * unitPrice;
            totalInput.value = total.toFixed(2);
        }
    },

    /**
     * معالجة حفظ عملية بيع مخلفات عادية
     */
    async handleRegularWasteSaleSubmit(saleId, modal) {
        const form = document.getElementById('regular-waste-sale-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const date = new Date(document.getElementById('sale-date').value);
        const location = document.getElementById('sale-location').value.trim();
        const wasteType = document.getElementById('sale-waste-type').value.trim();
        const quantity = parseFloat(document.getElementById('sale-quantity').value);
        const unit = document.getElementById('sale-unit').value.trim();
        const unitPrice = parseFloat(document.getElementById('sale-unit-price').value);
        const totalValue = parseFloat(document.getElementById('sale-total-value').value);
        const buyerName = document.getElementById('sale-buyer').value.trim();
        const paymentMethod = document.getElementById('sale-payment-method').value.trim();
        const notes = document.getElementById('sale-notes').value.trim();

        if (!AppState.appData.wasteManagement) {
            AppState.appData.wasteManagement = {
                regularWasteTypes: ['خشب', 'ورق', 'استرتش', 'بلاستيك', 'شكائر', 'جراكن فارغة'],
                regularWasteRecords: [],
                regularWasteSales: [],
                hazardousWasteRecords: []
            };
        }

        const formData = {
            id: saleId || Utils.generateId('RWS'),
            transactionNumber: saleId ? (AppState.appData.wasteManagement.regularWasteSales || []).find(s => s.id === saleId)?.transactionNumber : this.generateSaleTransactionNumber(),
            date: date.toISOString(),
            location: location,
            wasteType: wasteType,
            quantity: quantity,
            unit: unit,
            unitPrice: unitPrice,
            totalValue: totalValue,
            buyerName: buyerName,
            paymentMethod: paymentMethod,
            notes: notes,
            createdAt: saleId ? (AppState.appData.wasteManagement.regularWasteSales || []).find(s => s.id === saleId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: AppState.currentUser?.email || AppState.currentUser?.name || 'Unknown',
            updatedBy: AppState.currentUser?.email || AppState.currentUser?.name || 'Unknown'
        };

        Loading.show();
        try {
            if (!AppState.appData.wasteManagement.regularWasteSales) {
                AppState.appData.wasteManagement.regularWasteSales = [];
            }

            if (saleId) {
                const index = AppState.appData.wasteManagement.regularWasteSales.findIndex(s => s.id === saleId);
                if (index !== -1) {
                    AppState.appData.wasteManagement.regularWasteSales[index] = formData;
                    Notification.success('تم تحديث عملية البيع بنجاح');
                }
            } else {
                AppState.appData.wasteManagement.regularWasteSales.push(formData);
                Notification.success('تم إضافة عملية البيع بنجاح');
            }

            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            await this.saveWasteManagementToSheets();

            Loading.hide();
            modal.remove();
            this.load();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    /**
     * عرض نموذج إضافة/تعديل سجل مخلفات خطرة
     */
    showHazardousWasteForm(recordId = null) {
        const wasteData = AppState.appData.wasteManagement || {
            hazardousWasteRecords: []
        };
        const record = recordId 
            ? (wasteData.hazardousWasteRecords || []).find(r => r.id === recordId)
            : null;

        const dateValue = record?.date ? new Date(record.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        const transportDateValue = record?.transportDate ? new Date(record.transportDate).toISOString().slice(0, 10) : '';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-exclamation-triangle text-red-500 ml-2"></i>
                        ${record ? 'تعديل' : 'إضافة'} سجل مخلفات خطرة
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="hazardous-waste-form" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    التاريخ <span class="text-red-500">*</span>
                                </label>
                                <input type="date" id="hazardous-waste-date" required 
                                       class="form-input" value="${dateValue}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    الموقع <span class="text-red-500">*</span>
                                </label>
                                <select id="hazardous-waste-location" required class="form-input">
                                    <option value="">-- اختر الموقع --</option>
                                    ${this.getSiteOptions().map(site => `
                                        <option value="${Utils.escapeHTML(site.name)}" ${record?.location === site.name ? 'selected' : ''}>
                                            ${Utils.escapeHTML(site.name)}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                نوع المخلفات <span class="text-red-500">*</span>
                            </label>
                            <input type="text" id="hazardous-waste-type" required 
                                   class="form-input" 
                                   value="${Utils.escapeHTML(record?.wasteType || '')}"
                                   placeholder="أدخل نوع المخلفات الخطرة">
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    الكمية <span class="text-red-500">*</span>
                                </label>
                                <input type="number" id="hazardous-waste-quantity" required step="0.01"
                                       class="form-input" 
                                       value="${record?.quantity || ''}"
                                       placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    وحدة القياس <span class="text-red-500">*</span>
                                </label>
                                <input type="text" id="hazardous-waste-unit" required 
                                       class="form-input" 
                                       value="${Utils.escapeHTML(record?.unit || 'كجم')}"
                                       placeholder="كجم / لتر / م³">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                تصنيف الخطورة <span class="text-red-500">*</span>
                            </label>
                            <input type="text" id="hazardous-waste-classification" required 
                                   class="form-input" 
                                   value="${Utils.escapeHTML(record?.hazardClassification || '')}"
                                   placeholder="مثال: سام / قابل للاشتعال / مسبب للتآكل">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                طريقة التخزين
                            </label>
                            <input type="text" id="hazardous-waste-storage" 
                                   class="form-input" 
                                   value="${Utils.escapeHTML(record?.storageMethod || '')}"
                                   placeholder="أدخل طريقة التخزين">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                شركة النقل المعتمدة
                            </label>
                            <input type="text" id="hazardous-waste-transport" 
                                   class="form-input" 
                                   value="${Utils.escapeHTML(record?.transportCompany || '')}"
                                   placeholder="أدخل اسم شركة النقل">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                جهة المعالجة النهائية
                            </label>
                            <input type="text" id="hazardous-waste-treatment" 
                                   class="form-input" 
                                   value="${Utils.escapeHTML(record?.treatmentFacility || '')}"
                                   placeholder="أدخل اسم جهة المعالجة">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                تاريخ النقل
                            </label>
                            <input type="date" id="hazardous-waste-transport-date" 
                                   class="form-input" 
                                   value="${transportDateValue}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                مستندات مرفقة (رابط)
                            </label>
                            <input type="url" id="hazardous-waste-documents" 
                                   class="form-input" 
                                   value="${Utils.escapeHTML(record?.documents || '')}"
                                   placeholder="https://...">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                ملاحظات
                            </label>
                            <textarea id="hazardous-waste-notes" 
                                      class="form-input" rows="3"
                                      placeholder="ملاحظات إضافية">${Utils.escapeHTML(record?.notes || '')}</textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        إلغاء
                    </button>
                    <button type="button" id="save-hazardous-waste-btn" class="btn-danger">
                        <i class="fas fa-save ml-2"></i>
                        حفظ
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const saveBtn = modal.querySelector('#save-hazardous-waste-btn');
        saveBtn.addEventListener('click', () => this.handleHazardousWasteSubmit(recordId, modal));

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    /**
     * معالجة حفظ سجل مخلفات خطرة
     */
    async handleHazardousWasteSubmit(recordId, modal) {
        const form = document.getElementById('hazardous-waste-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const date = new Date(document.getElementById('hazardous-waste-date').value);
        const location = document.getElementById('hazardous-waste-location').value.trim();
        const wasteType = document.getElementById('hazardous-waste-type').value.trim();
        const quantity = parseFloat(document.getElementById('hazardous-waste-quantity').value);
        const unit = document.getElementById('hazardous-waste-unit').value.trim();
        const hazardClassification = document.getElementById('hazardous-waste-classification').value.trim();
        const storageMethod = document.getElementById('hazardous-waste-storage').value.trim();
        const transportCompany = document.getElementById('hazardous-waste-transport').value.trim();
        const treatmentFacility = document.getElementById('hazardous-waste-treatment').value.trim();
        const transportDateInput = document.getElementById('hazardous-waste-transport-date').value;
        const transportDate = transportDateInput ? new Date(transportDateInput).toISOString() : null;
        const documents = document.getElementById('hazardous-waste-documents').value.trim();
        const notes = document.getElementById('hazardous-waste-notes').value.trim();

        if (!AppState.appData.wasteManagement) {
            AppState.appData.wasteManagement = {
                regularWasteTypes: ['خشب', 'ورق', 'استرتش', 'بلاستيك', 'شكائر', 'جراكن فارغة'],
                regularWasteRecords: [],
                regularWasteSales: [],
                hazardousWasteRecords: []
            };
        }

        const formData = {
            id: recordId || Utils.generateId('HWR'),
            serialNumber: recordId ? (AppState.appData.wasteManagement.hazardousWasteRecords || []).find(r => r.id === recordId)?.serialNumber : this.generateWasteSerialNumber('hazardous'),
            date: date.toISOString(),
            location: location,
            wasteType: wasteType,
            quantity: quantity,
            unit: unit,
            hazardClassification: hazardClassification,
            storageMethod: storageMethod,
            transportCompany: transportCompany,
            treatmentFacility: treatmentFacility,
            transportDate: transportDate,
            documents: documents,
            notes: notes,
            createdAt: recordId ? (AppState.appData.wasteManagement.hazardousWasteRecords || []).find(r => r.id === recordId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: AppState.currentUser?.email || AppState.currentUser?.name || 'Unknown',
            updatedBy: AppState.currentUser?.email || AppState.currentUser?.name || 'Unknown'
        };

        Loading.show();
        try {
            if (!AppState.appData.wasteManagement.hazardousWasteRecords) {
                AppState.appData.wasteManagement.hazardousWasteRecords = [];
            }

            if (recordId) {
                const index = AppState.appData.wasteManagement.hazardousWasteRecords.findIndex(r => r.id === recordId);
                if (index !== -1) {
                    AppState.appData.wasteManagement.hazardousWasteRecords[index] = formData;
                    Notification.success('تم تحديث السجل بنجاح');
                }
            } else {
                AppState.appData.wasteManagement.hazardousWasteRecords.push(formData);
                Notification.success('تم إضافة السجل بنجاح');
            }

            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            await this.saveWasteManagementToSheets();

            Loading.hide();
            modal.remove();
            this.load();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    /**
     * إضافة نوع مخلفات جديد
     */
    async addWasteType() {
        if (!this.isAdmin()) {
            Notification.error('ليس لديك صلاحية لإضافة أنواع المخلفات');
            return;
        }

        const input = document.getElementById('new-waste-type-input');
        if (!input || !input.value.trim()) {
            Notification.warning('يرجى إدخال نوع المخلفات');
            return;
        }

        if (!AppState.appData.wasteManagement) {
            AppState.appData.wasteManagement = {
                regularWasteTypes: ['خشب', 'ورق', 'استرتش', 'بلاستيك', 'شكائر', 'جراكن فارغة'],
                regularWasteRecords: [],
                regularWasteSales: [],
                hazardousWasteRecords: []
            };
        }

        if (!AppState.appData.wasteManagement.regularWasteTypes) {
            AppState.appData.wasteManagement.regularWasteTypes = [];
        }

        const newType = input.value.trim();
        if (AppState.appData.wasteManagement.regularWasteTypes.includes(newType)) {
            Notification.warning('هذا النوع موجود بالفعل');
            return;
        }

        AppState.appData.wasteManagement.regularWasteTypes.push(newType);
        input.value = '';

        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        }

        await this.saveWasteManagementToSheets();
        Notification.success('تم إضافة نوع المخلفات بنجاح');
        this.load();
    },

    /**
     * حذف نوع مخلفات
     */
    async deleteWasteType(index) {
        if (!this.isAdmin()) {
            Notification.error('ليس لديك صلاحية لحذف أنواع المخلفات');
            return;
        }

        if (!confirm('هل أنت متأكد من حذف هذا النوع؟')) return;

        const wasteData = AppState.appData.wasteManagement || {};
        if (wasteData.regularWasteTypes && wasteData.regularWasteTypes[index]) {
            wasteData.regularWasteTypes.splice(index, 1);

            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            await this.saveWasteManagementToSheets();
            Notification.success('تم حذف نوع المخلفات بنجاح');
            this.load();
        }
    },

    // ===== دوال العرض والحذف =====

    viewRegularWasteRecord(recordId) {
        const wasteData = AppState.appData.wasteManagement || {};
        const record = (wasteData.regularWasteRecords || []).find(r => r.id === recordId);
        if (!record) {
            Notification.error('السجل غير موجود');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-recycle text-green-500 ml-2"></i>
                        تفاصيل سجل مخلفات عادية
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-3">
                        <div class="grid grid-cols-2 gap-4">
                            <div><strong>الرقم التسلسلي:</strong> ${Utils.escapeHTML(record.serialNumber || '')}</div>
                            <div><strong>التاريخ:</strong> ${Utils.formatDate(record.date)}</div>
                            <div><strong>الموقع:</strong> ${Utils.escapeHTML(record.location || '')}</div>
                            <div><strong>نوع المخلفات:</strong> ${Utils.escapeHTML(record.wasteType || '')}</div>
                            <div><strong>الكمية:</strong> ${parseFloat(record.quantity || 0).toFixed(2)}</div>
                            <div><strong>وحدة القياس:</strong> ${Utils.escapeHTML(record.unit || '')}</div>
                            <div><strong>القسم المنتج:</strong> ${Utils.escapeHTML(record.department || '-')}</div>
                            <div><strong>طريقة التخزين:</strong> ${Utils.escapeHTML(record.storageMethod || '-')}</div>
                        </div>
                        ${record.notes ? `
                            <div class="mt-4 pt-4 border-t">
                                <strong>ملاحظات:</strong>
                                <p class="text-gray-700 dark:text-gray-300 mt-2">${Utils.escapeHTML(record.notes)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        إغلاق
                    </button>
                    ${this.canEdit() ? `
                    <button type="button" class="btn-success" onclick="Sustainability.editRegularWasteRecord('${recordId}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>
                        تعديل
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

    editRegularWasteRecord(recordId) {
        if (!this.canEdit()) {
            Notification.error('ليس لديك صلاحية لتعديل السجلات');
            return;
        }
        this.showRegularWasteForm(recordId);
    },

    async deleteRegularWasteRecord(recordId) {
        if (!this.canDelete()) {
            Notification.error('ليس لديك صلاحية لحذف السجلات');
            return;
        }

        if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;

        Loading.show();
        try {
            const wasteData = AppState.appData.wasteManagement || {};
            if (wasteData.regularWasteRecords) {
                wasteData.regularWasteRecords = wasteData.regularWasteRecords.filter(r => r.id !== recordId);
            }

            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            await this.saveWasteManagementToSheets();
            Notification.success('تم حذف السجل بنجاح');
            this.load();
        } catch (error) {
            Notification.error('حدث خطأ: ' + error.message);
        } finally {
            Loading.hide();
        }
    },

    viewRegularWasteSale(saleId) {
        const wasteData = AppState.appData.wasteManagement || {};
        const sale = (wasteData.regularWasteSales || []).find(s => s.id === saleId);
        if (!sale) {
            Notification.error('عملية البيع غير موجودة');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-shopping-cart text-blue-500 ml-2"></i>
                        تفاصيل عملية البيع
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-3">
                        <div class="grid grid-cols-2 gap-4">
                            <div><strong>رقم العملية:</strong> ${Utils.escapeHTML(sale.transactionNumber || '')}</div>
                            <div><strong>التاريخ:</strong> ${Utils.formatDate(sale.date)}</div>
                            <div><strong>الموقع:</strong> ${Utils.escapeHTML(sale.location || '')}</div>
                            <div><strong>نوع المخلفات:</strong> ${Utils.escapeHTML(sale.wasteType || '')}</div>
                            <div><strong>الكمية:</strong> ${parseFloat(sale.quantity || 0).toFixed(2)}</div>
                            <div><strong>وحدة القياس:</strong> ${Utils.escapeHTML(sale.unit || '')}</div>
                            <div><strong>سعر الوحدة:</strong> ${parseFloat(sale.unitPrice || 0).toFixed(2)} ج.م</div>
                            <div><strong>إجمالي القيمة:</strong> <span class="font-semibold text-green-600">${parseFloat(sale.totalValue || 0).toFixed(2)} ج.م</span></div>
                            <div><strong>اسم المشتري:</strong> ${Utils.escapeHTML(sale.buyerName || '')}</div>
                            <div><strong>طريقة البيع:</strong> ${Utils.escapeHTML(sale.paymentMethod || '')}</div>
                        </div>
                        ${sale.notes ? `
                            <div class="mt-4 pt-4 border-t">
                                <strong>ملاحظات:</strong>
                                <p class="text-gray-700 dark:text-gray-300 mt-2">${Utils.escapeHTML(sale.notes)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        إغلاق
                    </button>
                    ${this.canEdit() ? `
                    <button type="button" class="btn-primary" onclick="Sustainability.editRegularWasteSale('${saleId}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>
                        تعديل
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

    editRegularWasteSale(saleId) {
        if (!this.canEdit()) {
            Notification.error('ليس لديك صلاحية لتعديل عمليات البيع');
            return;
        }
        this.showRegularWasteSaleForm(saleId);
    },

    async deleteRegularWasteSale(saleId) {
        if (!this.canDelete()) {
            Notification.error('ليس لديك صلاحية لحذف عمليات البيع');
            return;
        }

        if (!confirm('هل أنت متأكد من حذف عملية البيع هذه؟')) return;

        Loading.show();
        try {
            const wasteData = AppState.appData.wasteManagement || {};
            if (wasteData.regularWasteSales) {
                wasteData.regularWasteSales = wasteData.regularWasteSales.filter(s => s.id !== saleId);
            }

            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            await this.saveWasteManagementToSheets();
            Notification.success('تم حذف عملية البيع بنجاح');
            this.load();
        } catch (error) {
            Notification.error('حدث خطأ: ' + error.message);
        } finally {
            Loading.hide();
        }
    },

    viewHazardousWasteRecord(recordId) {
        const wasteData = AppState.appData.wasteManagement || {};
        const record = (wasteData.hazardousWasteRecords || []).find(r => r.id === recordId);
        if (!record) {
            Notification.error('السجل غير موجود');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-exclamation-triangle text-red-500 ml-2"></i>
                        تفاصيل سجل مخلفات خطرة
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-3">
                        <div class="grid grid-cols-2 gap-4">
                            <div><strong>الرقم التسلسلي:</strong> ${Utils.escapeHTML(record.serialNumber || '')}</div>
                            <div><strong>التاريخ:</strong> ${Utils.formatDate(record.date)}</div>
                            <div><strong>الموقع:</strong> ${Utils.escapeHTML(record.location || '')}</div>
                            <div><strong>نوع المخلفات:</strong> ${Utils.escapeHTML(record.wasteType || '')}</div>
                            <div><strong>الكمية:</strong> ${parseFloat(record.quantity || 0).toFixed(2)}</div>
                            <div><strong>وحدة القياس:</strong> ${Utils.escapeHTML(record.unit || '')}</div>
                            <div><strong>تصنيف الخطورة:</strong> <span class="badge badge-danger">${Utils.escapeHTML(record.hazardClassification || '')}</span></div>
                            <div><strong>طريقة التخزين:</strong> ${Utils.escapeHTML(record.storageMethod || '-')}</div>
                            <div><strong>شركة النقل:</strong> ${Utils.escapeHTML(record.transportCompany || '-')}</div>
                            <div><strong>جهة المعالجة:</strong> ${Utils.escapeHTML(record.treatmentFacility || '-')}</div>
                            <div><strong>تاريخ النقل:</strong> ${record.transportDate ? Utils.formatDate(record.transportDate) : '-'}</div>
                            ${record.documents ? `
                            <div class="col-span-2">
                                <strong>مستندات مرفقة:</strong>
                                <a href="${Utils.escapeHTML(record.documents)}" target="_blank" class="text-blue-600 hover:underline">
                                    ${Utils.escapeHTML(record.documents)}
                                </a>
                            </div>
                            ` : ''}
                        </div>
                        ${record.notes ? `
                            <div class="mt-4 pt-4 border-t">
                                <strong>ملاحظات:</strong>
                                <p class="text-gray-700 dark:text-gray-300 mt-2">${Utils.escapeHTML(record.notes)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        إغلاق
                    </button>
                    ${this.canEdit() ? `
                    <button type="button" class="btn-danger" onclick="Sustainability.editHazardousWasteRecord('${recordId}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>
                        تعديل
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

    editHazardousWasteRecord(recordId) {
        if (!this.canEdit()) {
            Notification.error('ليس لديك صلاحية لتعديل السجلات');
            return;
        }
        this.showHazardousWasteForm(recordId);
    },

    async deleteHazardousWasteRecord(recordId) {
        if (!this.canDelete()) {
            Notification.error('ليس لديك صلاحية لحذف السجلات');
            return;
        }

        if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;

        Loading.show();
        try {
            const wasteData = AppState.appData.wasteManagement || {};
            if (wasteData.hazardousWasteRecords) {
                wasteData.hazardousWasteRecords = wasteData.hazardousWasteRecords.filter(r => r.id !== recordId);
            }

            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            await this.saveWasteManagementToSheets();
            Notification.success('تم حذف السجل بنجاح');
            this.load();
        } catch (error) {
            Notification.error('حدث خطأ: ' + error.message);
        } finally {
            Loading.hide();
        }
    },

    // ===== دوال مساعدة للمخلفات =====

    /**
     * تحميل بيانات إدارة المخلفات من Google Sheets
     */
    async loadWasteManagementFromSheets() {
        // التحقق من تفعيل Google Integration
        if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
            return;
        }

        if (typeof GoogleIntegration === 'undefined' || typeof GoogleIntegration.sendRequest !== 'function') {
            return;
        }

        try {
            const spreadsheetId = AppState.googleConfig?.sheets?.spreadsheetId;
            if (!spreadsheetId) return;

            // تحميل أنواع المخلفات العادية
            try {
                const typesResult = await GoogleIntegration.sendRequest({
                    action: 'readFromSheet',
                    data: {
                        sheetName: 'WasteManagement_RegularWasteTypes',
                        spreadsheetId: spreadsheetId
                    }
                });
                if (typesResult && typesResult.success && Array.isArray(typesResult.data)) {
                    const types = typesResult.data.map(item => item.name).filter(Boolean);
                    if (types.length > 0) {
                        AppState.appData.wasteManagement.regularWasteTypes = types;
                    }
                }
            } catch (error) {
                Utils.safeWarn('⚠️ تعذر تحميل أنواع المخلفات:', error);
            }

            // تحميل سجلات المخلفات العادية
            try {
                const recordsResult = await GoogleIntegration.sendRequest({
                    action: 'readFromSheet',
                    data: {
                        sheetName: 'WasteManagement_RegularWasteRecords',
                        spreadsheetId: spreadsheetId
                    }
                });
                if (recordsResult && recordsResult.success && Array.isArray(recordsResult.data)) {
                    AppState.appData.wasteManagement.regularWasteRecords = recordsResult.data;
                }
            } catch (error) {
                Utils.safeWarn('⚠️ تعذر تحميل سجلات المخلفات العادية:', error);
            }

            // تحميل عمليات بيع المخلفات العادية
            try {
                const salesResult = await GoogleIntegration.sendRequest({
                    action: 'readFromSheet',
                    data: {
                        sheetName: 'WasteManagement_RegularWasteSales',
                        spreadsheetId: spreadsheetId
                    }
                });
                if (salesResult && salesResult.success && Array.isArray(salesResult.data)) {
                    AppState.appData.wasteManagement.regularWasteSales = salesResult.data;
                }
            } catch (error) {
                Utils.safeWarn('⚠️ تعذر تحميل عمليات بيع المخلفات:', error);
            }

            // تحميل سجلات المخلفات الخطرة
            try {
                const hazardousResult = await GoogleIntegration.sendRequest({
                    action: 'readFromSheet',
                    data: {
                        sheetName: 'WasteManagement_HazardousWasteRecords',
                        spreadsheetId: spreadsheetId
                    }
                });
                if (hazardousResult && hazardousResult.success && Array.isArray(hazardousResult.data)) {
                    AppState.appData.wasteManagement.hazardousWasteRecords = hazardousResult.data;
                }
            } catch (error) {
                Utils.safeWarn('⚠️ تعذر تحميل سجلات المخلفات الخطرة:', error);
            }

            // حفظ البيانات المحلية
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            // إعادة تحميل الواجهة إذا كان التبويب مفتوحاً
            if (this.currentTab === 'waste-management') {
                this.load();
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل بيانات إدارة المخلفات:', error);
        }
    },

    /**
     * تحميل بيانات استهلاك الموارد من Google Sheets (جداول منفصلة)
     * — طلبات متوازية لتقليل زمن الانتظار، ودمج متزامن لمنع تكرار الشبكة.
     */
    async loadResourceConsumptionFromSheets() {
        if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
            return;
        }

        if (typeof GoogleIntegration === 'undefined' || typeof GoogleIntegration.sendRequest !== 'function') {
            return;
        }

        if (this._resourceConsumptionFetchPromise) {
            return this._resourceConsumptionFetchPromise;
        }

        const spreadsheetId = AppState.googleConfig?.sheets?.spreadsheetId;
        if (!spreadsheetId) return;

        this._resourceConsumptionFetchPromise = (async () => {
            try {
                if (!AppState.appData.resourceConsumption) {
                    AppState.appData.resourceConsumption = {
                        water: [],
                        electricity: [],
                        gas: []
                    };
                }

                const normalizeList = (list = []) => (Array.isArray(list) ? list : []).map((row) => this.normalizeResourceConsumptionRecord(row)).filter(Boolean);

                const readSheet = async (sheetName) => {
                    try {
                        const result = await GoogleIntegration.sendRequest({
                            action: 'readFromSheet',
                            data: { sheetName, spreadsheetId }
                        });
                        if (result && result.success && Array.isArray(result.data)) {
                            return normalizeList(result.data);
                        }
                    } catch (error) {
                        Utils.safeWarn(`⚠️ تعذر تحميل ${sheetName}:`, error);
                    }
                    return undefined;
                };

                const [waterList, gasList, electricityList] = await Promise.all([
                    readSheet('WaterManagement_Records'),
                    readSheet('GasManagement_Records'),
                    readSheet('ElectricityManagement_Records')
                ]);

                if (waterList !== undefined) AppState.appData.resourceConsumption.water = waterList;
                if (gasList !== undefined) AppState.appData.resourceConsumption.gas = gasList;
                if (electricityList !== undefined) AppState.appData.resourceConsumption.electricity = electricityList;

                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                const quickStatsPanel = document.getElementById('sustainability-quick-stats');
                if (quickStatsPanel) {
                    quickStatsPanel.innerHTML = this.renderQuickStats();
                }

                const onSustainabilitySection = typeof AppState !== 'undefined' && AppState.currentSection === 'sustainability';
                if (onSustainabilitySection && document.getElementById('sustainability-section')) {
                    if (this.currentTab === 'dashboard') {
                        const contentArea = document.getElementById('sustainability-content');
                        if (contentArea) {
                            contentArea.innerHTML = await this.renderDashboard();
                            this.renderCharts();
                        }
                    } else if (this.currentTab === 'water' || this.currentTab === 'electricity' || this.currentTab === 'gas') {
                        const contentArea = document.getElementById('sustainability-content');
                        if (contentArea) {
                            contentArea.innerHTML = await this.renderContent();
                        }
                    }
                }

                if (typeof Dashboard !== 'undefined' && typeof Dashboard.updateReportsStatistics === 'function') {
                    Dashboard.updateReportsStatistics();
                }
            } catch (error) {
                Utils.safeError('❌ خطأ في تحميل بيانات استهلاك الموارد:', error);
            } finally {
                this._resourceConsumptionFetchPromise = null;
            }
        })();

        return this._resourceConsumptionFetchPromise;
    },

    normalizeResourceConsumptionRecord(record) {
        if (!record || typeof record !== 'object') return null;
        const pick = (...keys) => {
            for (const key of keys) {
                if (record[key] !== undefined && record[key] !== null && String(record[key]).trim() !== '') {
                    return record[key];
                }
            }
            return '';
        };

        const parsedDate = (() => {
            const rawDate = pick('date', 'Date', 'التاريخ', 'recordDate');
            const d = new Date(rawDate || new Date());
            return Number.isNaN(d.getTime()) ? new Date() : d;
        })();

        const totalConsumption = parseFloat(
            pick(
                'totalConsumption',
                'total',
                'consumption',
                'quantity',
                'Total Consumption',
                'إجمالي الاستهلاك',
                'الاستهلاك'
            )
        ) || 0;

        return {
            ...record,
            id: String(pick('id', 'ID', 'recordId') || Utils.generateId('RES')),
            serialNumber: String(pick('serialNumber', 'serial', 'Serial Number', 'الرقم التسلسلي') || ''),
            date: parsedDate.toISOString(),
            monthYear: String(pick('monthYear', 'month', 'Month/Year', 'الشهر / السنة') || this.getMonthYear(parsedDate)),
            location: String(pick('location', 'site', 'locationName', 'الموقع') || ''),
            quantity: parseFloat(pick('quantity', 'Quantity', 'الكمية')) || 0,
            totalConsumption: totalConsumption,
            notes: String(pick('notes', 'Notes', 'ملاحظات') || ''),
            createdAt: String(pick('createdAt', 'Created At', 'تاريخ الإنشاء') || parsedDate.toISOString()),
            updatedAt: new Date().toISOString(),
            createdBy: String(pick('createdBy', 'created_by', 'المنشئ') || ''),
            updatedBy: String(pick('updatedBy', 'updated_by', 'المعدل') || '')
        };
    },

    /**
     * حفظ بيانات إدارة المخلفات في Google Sheets (جداول منفصلة)
     */
    async saveWasteManagementToSheets() {
        const wasteData = AppState.appData.wasteManagement || {
            regularWasteTypes: ['خشب', 'ورق', 'استرتش', 'بلاستيك', 'شكائر', 'جراكن فارغة'],
            regularWasteRecords: [],
            regularWasteSales: [],
            hazardousWasteRecords: []
        };

        try {
            // حفظ أنواع المخلفات العادية (كقائمة بسيطة)
            const wasteTypesData = (wasteData.regularWasteTypes || []).map((name, index) => ({
                id: `WT-${index + 1}`,
                name: name,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }));
            await GoogleIntegration.autoSave('WasteManagement_RegularWasteTypes', wasteTypesData);

            // حفظ سجلات المخلفات العادية
            await GoogleIntegration.autoSave('WasteManagement_RegularWasteRecords', wasteData.regularWasteRecords || []);

            // حفظ عمليات بيع المخلفات العادية
            await GoogleIntegration.autoSave('WasteManagement_RegularWasteSales', wasteData.regularWasteSales || []);

            // حفظ سجلات المخلفات الخطرة
            await GoogleIntegration.autoSave('WasteManagement_HazardousWasteRecords', wasteData.hazardousWasteRecords || []);

            return { success: true };
        } catch (error) {
            Utils.safeError('❌ خطأ في حفظ بيانات إدارة المخلفات:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * حفظ بيانات استهلاك الموارد في Google Sheets (جداول منفصلة)
     */
    async saveResourceConsumptionToSheets() {
        const resourceData = AppState.appData.resourceConsumption || {
            water: [],
            electricity: [],
            gas: []
        };

        try {
            // حفظ سجلات المياه
            await GoogleIntegration.autoSave('WaterManagement_Records', resourceData.water || []);

            // حفظ سجلات الغاز
            await GoogleIntegration.autoSave('GasManagement_Records', resourceData.gas || []);

            // حفظ سجلات الكهرباء
            await GoogleIntegration.autoSave('ElectricityManagement_Records', resourceData.electricity || []);

            return { success: true };
        } catch (error) {
            Utils.safeError('❌ خطأ في حفظ بيانات استهلاك الموارد:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * إنشاء رقم تسلسلي للمخلفات
     */
    generateWasteSerialNumber(type) {
        const wasteData = AppState.appData.wasteManagement || {};
        const prefix = type === 'regular' ? 'RWR' : 'HWR';
        const records = type === 'regular' 
            ? (wasteData.regularWasteRecords || [])
            : (wasteData.hazardousWasteRecords || []);
        const nextNum = records.length + 1;
        return `${prefix}-${String(nextNum).padStart(6, '0')}`;
    },

    /**
     * إنشاء رقم عملية بيع
     */
    generateSaleTransactionNumber() {
        const wasteData = AppState.appData.wasteManagement || {};
        const sales = wasteData.regularWasteSales || [];
        const nextNum = sales.length + 1;
        const year = new Date().getFullYear();
        return `SALE-${year}-${String(nextNum).padStart(6, '0')}`;
    },

    /**
     * الحصول على إجمالي كمية المخلفات العادية
     */
    getTotalRegularWasteQuantity(records) {
        if (!records || records.length === 0) return '0.00';
        const total = records.reduce((sum, record) => sum + (parseFloat(record.quantity) || 0), 0);
        return total.toFixed(2);
    },

    /**
     * الحصول على إجمالي كمية المخلفات الخطرة
     */
    getTotalHazardousWasteQuantity(records) {
        if (!records || records.length === 0) return '0.00';
        const total = records.reduce((sum, record) => sum + (parseFloat(record.quantity) || 0), 0);
        return total.toFixed(2);
    },

    /**
     * الحصول على إجمالي عائد البيع
     */
    getTotalSalesRevenue(sales) {
        if (!sales || sales.length === 0) return 0;
        return sales.reduce((sum, sale) => sum + (parseFloat(sale.totalValue) || 0), 0);
    },

    /**
     * الحصول على البيانات الشهرية للمخلفات
     */
    getMonthlyWasteData(wasteData) {
        try {
            const monthlyMap = {};
            const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                           'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

            // معالجة المخلفات العادية
            (wasteData?.regularWasteRecords || []).forEach(record => {
                try {
                    if (!record || !record.date) return;
                    const date = new Date(record.date);
                    if (isNaN(date.getTime())) return;
                    
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const monthLabel = `${months[date.getMonth()]} ${date.getFullYear()}`;
                    
                    if (!monthlyMap[monthKey]) {
                        monthlyMap[monthKey] = {
                            month: monthLabel,
                            regularQuantity: 0,
                            hazardousQuantity: 0,
                            revenue: 0
                        };
                    }
                    
                    monthlyMap[monthKey].regularQuantity += parseFloat(record.quantity) || 0;
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في معالجة سجل مخلفات عادية:', error);
                }
            });

            // معالجة المخلفات الخطرة
            (wasteData?.hazardousWasteRecords || []).forEach(record => {
                try {
                    if (!record || !record.date) return;
                    const date = new Date(record.date);
                    if (isNaN(date.getTime())) return;
                    
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const monthLabel = `${months[date.getMonth()]} ${date.getFullYear()}`;
                    
                    if (!monthlyMap[monthKey]) {
                        monthlyMap[monthKey] = {
                            month: monthLabel,
                            regularQuantity: 0,
                            hazardousQuantity: 0,
                            revenue: 0
                        };
                    }
                    
                    monthlyMap[monthKey].hazardousQuantity += parseFloat(record.quantity) || 0;
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في معالجة سجل مخلفات خطرة:', error);
                }
            });

            // معالجة عمليات البيع
            (wasteData?.regularWasteSales || []).forEach(sale => {
                try {
                    if (!sale || !sale.date) return;
                    const date = new Date(sale.date);
                    if (isNaN(date.getTime())) return;
                    
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const monthLabel = `${months[date.getMonth()]} ${date.getFullYear()}`;
                    
                    if (!monthlyMap[monthKey]) {
                        monthlyMap[monthKey] = {
                            month: monthLabel,
                            regularQuantity: 0,
                            hazardousQuantity: 0,
                            revenue: 0
                        };
                    }
                    
                    monthlyMap[monthKey].revenue += parseFloat(sale.totalValue) || 0;
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في معالجة عملية بيع:', error);
                }
            });

            // ترتيب حسب التاريخ (آخر 12 شهر)
            return Object.entries(monthlyMap)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .slice(0, 12)
                .map(([key, value]) => value);
        } catch (error) {
            Utils.safeError('❌ خطأ في getMonthlyWasteData:', error);
            return [];
        }
    }
};

// ===== Export module to global scope =====
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof Sustainability !== 'undefined') {
            window.Sustainability = Sustainability;
            
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ Sustainability module loaded and available on window.Sustainability');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير Sustainability:', error);
        if (typeof window !== 'undefined' && typeof Sustainability !== 'undefined') {
            try {
                window.Sustainability = Sustainability;
            } catch (e) {
                console.error('❌ فشل تصدير Sustainability:', e);
            }
        }
    }
})();
