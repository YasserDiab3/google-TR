/**
 * FireEquipment Module
 * تم استخراجه من app-modules.js
 */
// ===== Fire Equipment Module v2 (قاعدة بيانات معدات الحريق) =====
FireEquipment = {
    state: {
        currentTab: 'database', // 'database' أو 'register' أو 'inspections' أو 'analytics' أو 'approval-requests'
        filters: {
            search: '',
            type: 'all',
            status: 'all',
            location: 'all'
        }
    },
    applyModuleI18n(root) {
        const i18nCore = (window.AppI18n && typeof window.AppI18n.applyI18n === 'function')
            ? window.AppI18n
            : ((window.I18n && typeof window.I18n.applyI18n === 'function') ? window.I18n : null);
        if (!i18nCore) return;
        const target = root || document.getElementById('fire-equipment-section') || document;
        i18nCore.applyI18n(target);
        if (typeof i18nCore.applyLiteralTranslations === 'function') {
            i18nCore.applyLiteralTranslations(target);
        }
    },

    assetTypes: [
        'طفاية حريق',
        'خرطوم حريق',
        'صندوق حريق',
        'جهاز إنذار',
        'نظام رش مائي',
        'مضخة حريق',
        'صمام حريق',
        'أخرى'
    ],

    statusOptions: [
        { value: 'صالح', label: 'صالح' },
        { value: 'يحتاج صيانة', label: 'يحتاج صيانة' },
        { value: 'خارج الخدمة', label: 'خارج الخدمة' }
    ],

    /**
     * تأكيد إغلاق النموذج
     * @param {HTMLElement} button - زر الإغلاق المضغوط عليه
     */
    confirmClose(button) {
        if (confirm('هل أنت متأكد من إغلاق هذا النموذج؟\nسيتم فقدان أي بيانات غير محفوظة.')) {
            button.closest('.modal-overlay').remove();
        }
    },

    /**
     * إغلاق النموذج مباشرة بدون تأكيد (لنماذج العرض فقط)
     * @param {HTMLElement} button - زر الإغلاق المضغوط عليه
     */
    closeModal(button) {
        const modal = button.closest('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    },

    /**
     * توليد DeviceID بتنسيق EFA-0000 (3 حروف - 4 أرقام)
     * @returns {string} DeviceID بالتنسيق الجديد
     */
    generateFireDeviceID() {
        const assets = this.getAssets();
        const existingNumbers = assets
            .map(a => a.id)
            .filter(id => id && id.match(/^EFA-\d{4}$/))
            .map(id => parseInt(id.split('-')[1]))
            .filter(num => !isNaN(num));

        const nextNumber = existingNumbers.length > 0
            ? Math.max(...existingNumbers) + 1
            : 1;

        const paddedNumber = String(nextNumber).padStart(4, '0');
        return `EFA-${paddedNumber}`;
    },

    async load() {
        try {
        const section = document.getElementById('fire-equipment-section');
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('قسم fire-equipment-section غير موجود!');
            } else {
                console.error('قسم fire-equipment-section غير موجود!');
            }
            return;
        }

        // التأكد من وجود AppState و appData لمنع الشاشة البيضاء
        if (typeof AppState === 'undefined') {
            section.innerHTML = '<div class="content-card"><div class="card-body"><p class="text-red-600">لم يتم تهيئة التطبيق بشكل صحيح. يرجى تحديث الصفحة.</p></div></div>';
            this.applyModuleI18n(section);
            return;
        }
        if (!AppState.appData) {
            AppState.appData = {};
        }

            const loadingPlaceholder = '<div class="fire-tab-loading"><div style="width: 300px; margin: 0 auto 16px;"><div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;"><div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div></div></div><p>جاري التحميل...</p></div>';

            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-fire-extinguisher ml-3"></i>
                                سجل وفحص معدات الحريق
                            </h1>
                            <p class="section-subtitle">
                                إدارة قاعدة بيانات كاملة لكل معدات الإطفاء مع تتبع الفحوصات وQR Code لكل جهاز
                            </p>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            ${this.canAdd() ? `
                            <button id="add-fire-asset-btn" class="btn-secondary">
                                <i class="fas fa-plus ml-2"></i>
                                إضافة جهاز جديد
                            </button>
                            ` : ''}
                            <button id="scan-qr-inspection-btn" class="btn-primary">
                                <i class="fas fa-qrcode ml-2"></i>
                                مسح QR Code للفحص الشهري
                            </button>
                            <button id="refresh-fire-equipment-btn" class="btn-secondary">
                                <i class="fas fa-sync-alt ml-2"></i>
                                تحديث
                            </button>
                        </div>
                    </div>
                </div>
                <style>
                    .fire-tabs-container {
                        margin-bottom: 1.5rem;
                    }
                    .fire-tabs-header {
                        display: flex;
                        gap: 0.5rem;
                        border-bottom: 2px solid #e5e7eb;
                        padding-bottom: 0;
                    }
                    .fire-tab-btn {
                        padding: 0.75rem 1.5rem;
                        background: none;
                        border: none;
                        border-bottom: 3px solid transparent;
                        color: #6b7280;
                        font-size: 0.9375rem;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        position: relative;
                        margin-bottom: -2px;
                    }
                    .fire-tab-btn:hover {
                        color: #3b82f6;
                        background-color: rgba(59, 130, 246, 0.05);
                    }
                    .fire-tab-btn.active {
                        color: #3b82f6;
                        border-bottom-color: #3b82f6;
                        font-weight: 600;
                    }
                    .fire-tab-btn i {
                        font-size: 14px;
                    }
                    .fire-tab-content {
                        display: none;
                    }
                    .fire-tab-content.active {
                        display: block;
                    }
                    .fire-tab-loading {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 3rem;
                        min-height: 200px;
                    }
                    .fire-tab-loading i {
                        font-size: 2rem;
                        color: #3b82f6;
                        margin-bottom: 1rem;
                    }
                    @media (max-width: 768px) {
                        .fire-tabs-header {
                            flex-wrap: wrap;
                            gap: 0.25rem;
                        }
                        .fire-tab-btn {
                            padding: 0.625rem 1rem;
                            font-size: 0.875rem;
                        }
                    }
                </style>
                <div class="fire-tabs-container mt-6">
                    <div class="fire-tabs-header">
                        ${this.hasTabAccess('database') ? `
                        <button class="fire-tab-btn active" data-tab="database" onclick="FireEquipment.switchTab('database')">
                            <i class="fas fa-database ml-2"></i>
                            قاعدة بيانات معدات الحريق
                        </button>
                        ` : ''}
                        ${this.hasTabAccess('register') ? `
                        <button class="fire-tab-btn" data-tab="register" onclick="FireEquipment.switchTab('register')">
                            <i class="fas fa-clipboard-list ml-2"></i>
                            سجل معدات الاطفاء والانذار
                        </button>
                        ` : ''}
                        ${this.hasTabAccess('inspections') ? `
                        <button class="fire-tab-btn" data-tab="inspections" onclick="FireEquipment.switchTab('inspections')">
                            <i class="fas fa-clipboard-check ml-2"></i>
                            الفحوصات الشهرية
                        </button>
                        ` : ''}
                        ${this.hasTabAccess('analytics') ? `
                        <button class="fire-tab-btn" data-tab="analytics" onclick="FireEquipment.switchTab('analytics')">
                            <i class="fas fa-chart-line ml-2"></i>
                            تحليل البيانات
                        </button>
                        ` : ''}
                        ${this.hasTabAccess('approval-requests') ? `
                        <button class="fire-tab-btn" data-tab="approval-requests" onclick="FireEquipment.switchTab('approval-requests')">
                            <i class="fas fa-check-circle ml-2"></i>
                            طلبات الموافقة
                        </button>
                        ` : ''}
                    </div>
                </div>
                <div id="fire-tab-content">
                    <div id="fire-tab-database" class="fire-tab-content active">
                        ${loadingPlaceholder}
                    </div>
                    <div id="fire-tab-register" class="fire-tab-content" style="display: none;">
                        ${loadingPlaceholder}
                    </div>
                    <div id="fire-tab-inspections" class="fire-tab-content" style="display: none;">
                        ${loadingPlaceholder}
                    </div>
                    ${this.isAdmin() ? `
                    <div id="fire-tab-analytics" class="fire-tab-content" style="display: none;">
                        ${loadingPlaceholder}
                    </div>
                    <div id="fire-tab-approval-requests" class="fire-tab-content" style="display: none;">
                        ${loadingPlaceholder}
                    </div>
                    ` : ''}
                </div>
            `;
            this.applyModuleI18n(section);

            try {
                this.setupEventListeners();
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في setupEventListeners:', error);
            }

            setTimeout(async () => {
                try {
                    const checkAppState = () => {
                        return new Promise((resolve) => {
                            if (typeof AppState !== 'undefined' && AppState && AppState.appData) {
                                resolve();
                                return;
                            }

                            let attempts = 0;
                            const maxAttempts = 50;
                            const checkInterval = setInterval(() => {
                                attempts++;
                                if (typeof AppState !== 'undefined' && AppState && AppState.appData) {
                                    clearInterval(checkInterval);
                                    resolve();
                                } else if (attempts >= maxAttempts) {
                                    clearInterval(checkInterval);
                                    if (typeof AppState === 'undefined' || !AppState) AppState = {};
                                    if (!AppState.appData) AppState.appData = {};
                                    resolve();
                                }
                            }, 100);
                        });
                    };

                    await checkAppState();

                    let migrated = false;
                    try {
                        migrated = this.ensureData();
                    } catch (error) {
                        Utils.safeWarn('⚠️ خطأ في ensureData:', error);
                    }

                    if (migrated) {
                        try {
                            setTimeout(async () => {
                                try {
                                    await this.persistAll();
                                } catch (error) {
                                    Utils.safeWarn('⚠️ خطأ في persistAll:', error);
                                }
                            }, 0);
                        } catch (error) {
                            Utils.safeWarn('⚠️ خطأ في persistAll:', error);
                        }
                    }

                    const databaseTab = document.getElementById('fire-tab-database');
                    if (databaseTab) {
                        const renderWithTimeout = async (renderFn) => {
                            const timeoutWrapper = (promise, timeout, msg) => {
                                const timeoutPromise = new Promise((_, reject) => {
                                    setTimeout(() => reject(new Error(msg || 'Timeout')), timeout);
                                });
                                return Promise.race([promise, timeoutPromise]);
                            };
                            if (typeof Utils !== 'undefined' && Utils.promiseWithTimeout) {
                                return await Utils.promiseWithTimeout(renderFn(), 10000, 'Timeout: renderTabContent');
                            }
                            return await timeoutWrapper(renderFn(), 10000, 'Timeout: renderTabContent');
                        };
                        const fallbackDatabaseHtml = `
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div class="content-card"><div class="text-center"><p class="text-sm text-gray-500">إجمالي الأجهزة</p><p class="text-2xl font-bold" id="fire-summary-total">0</p></div></div>
                                <div class="content-card"><div class="text-center"><p class="text-sm text-gray-500">أجهزة فعّالة</p><p class="text-2xl font-bold text-green-600" id="fire-summary-active">0</p></div></div>
                                <div class="content-card"><div class="text-center"><p class="text-sm text-gray-500">بحاجة إلى متابعة</p><p class="text-2xl font-bold text-yellow-600" id="fire-summary-maintenance">0</p></div></div>
                            </div>
                            <div class="content-card mt-6"><div class="card-body"><div id="fire-assets-table" class="overflow-x-auto"><div class="empty-state"><p class="text-gray-500">لا توجد معدات مسجلة أو جاري التحميل.</p></div></div></div>
                        `;
                        try {
                            const databaseContent = await renderWithTimeout(() => this.renderTabContent('database'));
                            databaseTab.innerHTML = (databaseContent && databaseContent.trim()) ? databaseContent : fallbackDatabaseHtml;
                        } catch (error) {
                            Utils.safeWarn('⚠️ خطأ في تحميل محتوى قاعدة البيانات:', error);
                            databaseTab.innerHTML = fallbackDatabaseHtml;
                        }
                        try {
                            this.renderAssets();
                        } catch (renderError) {
                            Utils.safeWarn('⚠️ خطأ في renderAssets:', renderError);
                        }
                    }

                    // تحميل بيانات معدات الحريق من الخادم دائماً عند فتح الموديول (لضمان عرض أحدث البيانات حتى لو كانت محلياً فارغة أو قديمة)
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                        this.loadFireEquipmentDataAsync()
                            .then(() => {
                                if (this.state.currentTab === 'database') {
                                    try {
                                        this.renderAssets();
                                    } catch (error) {
                                        Utils.safeWarn('⚠️ خطأ في تحديث renderAssets:', error);
                                    }
                                }
                                if (this.state.currentTab === 'register') {
                                    try {
                                        if (typeof this.refreshRegisterTable === 'function') {
                                            this.refreshRegisterTable();
                                        } else if (typeof this.refreshCurrentTab === 'function') {
                                            this.refreshCurrentTab();
                                        }
                                    } catch (err) {
                                        Utils.safeWarn('⚠️ خطأ في تحديث تبويب السجل:', err);
                                    }
                                }
                            })
                            .catch(error => {
                                Utils.safeWarn('⚠️ تعذر تحميل بيانات معدات الحريق:', error);
                                if (this.state.currentTab === 'database') {
                                    try {
                                        this.renderAssets();
                                    } catch (e) {
                                        Utils.safeWarn('⚠️ خطأ في renderAssets بعد فشل التحميل:', e);
                                    }
                                }
                            });
                    } else {
                        if (this.state.currentTab === 'database') {
                            try {
                                this.renderAssets();
                            } catch (error) {
                                Utils.safeWarn('⚠️ خطأ في renderAssets:', error);
                            }
                        }
                    }
                } catch (error) {
                    Utils.safeError('❌ خطأ في تحميل محتوى التبويبات:', error);
                }
            }, 0);
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل مديول معدات الحريق:', error);

            if (section) {
                section.innerHTML = `
                    <div class="section-header">
                        <div class="flex items-center justify-between">
                            <div>
                                <h1 class="section-title">
                                    <i class="fas fa-fire-extinguisher ml-3"></i>
                                    سجل وفحص معدات الحريق
                                </h1>
                                <p class="section-subtitle">إدارة قاعدة بيانات كاملة لكل معدات الإطفاء</p>
                            </div>
                        </div>
                    </div>
                    <div class="mt-6">
                        <div class="content-card">
                            <div class="card-body">
                                <div class="empty-state">
                                    <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                    <p class="text-gray-500 mb-2">حدث خطأ أثناء تحميل البيانات</p>
                                    <p class="text-sm text-gray-400 mb-4">${error && error.message ? Utils.escapeHTML(error.message) : 'خطأ غير معروف'}</p>
                                    <button onclick="FireEquipment.load()" class="btn-primary">
                                        <i class="fas fa-redo ml-2"></i>
                                        إعادة المحاولة
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                this.applyModuleI18n(section);
            }

            if (typeof Notification !== 'undefined' && Notification.error) {
                Notification.error('حدث خطأ أثناء تحميل معدات الحريق. يُرجى المحاولة مرة أخرى.', { duration: 3000 });
            }
        }
    },

    /**
     * التنقل بين التبويبات
     * @param {string} tabName - اسم التبويب ('database' أو 'register' أو 'inspections')
     */
    async switchTab(tabName) {
        // إذا كان التبويب المطلوب هو نفس التبويب الحالي، لا حاجة للتبديل
        if (this.state.currentTab === tabName) {
            return;
        }

        // التأكد من تهيئة البيانات - دائماً قبل أي عملية
        this.ensureData();

        // تحديث أزرار التبويبات
        document.querySelectorAll('.fire-tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // إخفاء جميع التبويبات
        document.querySelectorAll('.fire-tab-content').forEach(content => {
            content.style.display = 'none';
            content.classList.remove('active');
        });

        // إظهار التبويب المطلوب
        const activeTab = document.getElementById(`fire-tab-${tabName}`);
        if (activeTab) {
            activeTab.style.display = 'block';
            activeTab.classList.add('active');
            
            // ✅ تحميل محتوى التبويب إذا كان placeholder (lazy loading)
            const hasPlaceholder = activeTab.innerHTML.includes('fire-tab-loading') || 
                                   activeTab.innerHTML.includes('جاري التحميل');
            if (hasPlaceholder) {
                // تحميل المحتوى بشكل async مع timeout protection
                try {
                    const renderWithTimeout = async (renderFn) => {
                        if (typeof Utils !== 'undefined' && Utils.promiseWithTimeout) {
                            return await Utils.promiseWithTimeout(
                                renderFn(),
                                10000, // 10 ثوان timeout لكل tab
                                'Timeout: renderTabContent took too long'
                            );
                        }
                        return await renderFn();
                    };
                    
                    const tabContent = await renderWithTimeout(() => this.renderTabContent(tabName));
                    activeTab.innerHTML = tabContent || '<div class="fire-tab-loading"><p>خطأ في تحميل المحتوى</p></div>';
                    this.applyModuleI18n(activeTab);
                } catch (error) {
                    Utils.safeWarn(`⚠️ خطأ في تحميل محتوى التبويب ${tabName}:`, error);
                    activeTab.innerHTML = '<div class="fire-tab-loading"><p>خطأ في تحميل المحتوى</p></div>';
                    this.applyModuleI18n(activeTab);
                }
            }
        } else {
            // إذا لم يكن التبويب موجوداً، إنشاؤه
            const contentContainer = document.getElementById('fire-tab-content');
            if (contentContainer) {
                const newTab = document.createElement('div');
                newTab.id = `fire-tab-${tabName}`;
                newTab.className = 'fire-tab-content active';
                
                // ✅ عرض placeholder أولاً
                const loadingPlaceholder = '<div class="fire-tab-loading"><div style="width: 300px; margin: 0 auto 16px;"><div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;"><div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div></div></div><p>جاري التحميل...</p></div>';
                newTab.innerHTML = loadingPlaceholder;
                contentContainer.appendChild(newTab);
                
                    // ✅ تحميل المحتوى بشكل async مع timeout protection
                try {
                    // Fallback implementation if Utils.promiseWithTimeout is not available
                    const timeoutWrapper = (promise, timeout, message) => {
                        const timeoutPromise = new Promise((_, reject) => {
                            setTimeout(() => {
                                reject(new Error(message || `Timeout: العملية استغرقت أكثر من ${timeout}ms`));
                            }, timeout);
                        });
                        return Promise.race([promise, timeoutPromise]);
                    };
                    
                    const renderWithTimeout = async (renderFn) => {
                        if (typeof Utils !== 'undefined' && Utils.promiseWithTimeout) {
                            return await Utils.promiseWithTimeout(
                                renderFn(),
                                10000, // 10 ثوان timeout لكل tab
                                'Timeout: renderTabContent took too long'
                            );
                        }
                        // استخدام fallback implementation
                        return await timeoutWrapper(
                            renderFn(),
                            10000, // 10 ثوان timeout لكل tab
                            'Timeout: renderTabContent took too long'
                        );
                    };
                    
                    const tabContent = await renderWithTimeout(() => this.renderTabContent(tabName));
                    newTab.innerHTML = tabContent || '<div class="fire-tab-loading"><p>خطأ في تحميل المحتوى</p></div>';
                    this.applyModuleI18n(newTab);
                } catch (error) {
                    Utils.safeWarn(`⚠️ خطأ في تحميل محتوى التبويب ${tabName}:`, error);
                    newTab.innerHTML = '<div class="fire-tab-loading"><p>خطأ في تحميل المحتوى</p></div>';
                    this.applyModuleI18n(newTab);
                }
            }
        }

        // تحديث التبويب الحالي
        this.state.currentTab = tabName;

        // ✅ عرض الواجهة فوراً بالبيانات المتوفرة (مثل مديول العيادة)
        // هذا يضمن بقاء الواجهة ثابتة ومرئية أثناء التحميل
        if (tabName === 'database') {
            // عرض الواجهة فوراً بالبيانات المتوفرة
            this.renderAssets();
            
            // إذا لم تكن هناك بيانات محلية، تحميل من Backend في الخلفية وتحديث الواجهة
            const currentAssets = this.getAssets();
            if (!currentAssets || currentAssets.length === 0) {
                this.loadFireEquipmentDataAsync().then(() => {
                    if (this.state.currentTab === 'database') {
                        this.renderAssets();
                    }
                }).catch(error => {
                    Utils.safeWarn('⚠️ تعذر تحميل بيانات قاعدة البيانات:', error);
                });
            }
        } else if (tabName === 'register') {
            // عرض الواجهة فوراً بالبيانات المتوفرة
            await this.refreshRegisterTable();
            
            // إذا لم تكن هناك بيانات محلية، تحميل من Backend في الخلفية وتحديث الواجهة
            const currentAssets = this.getAssets();
            if (!currentAssets || currentAssets.length === 0) {
                this.loadFireEquipmentDataAsync().then(() => {
                    if (this.state.currentTab === 'register') {
                        this.refreshRegisterTable();
                    }
                }).catch(error => {
                    Utils.safeWarn('⚠️ تعذر تحميل بيانات السجل:', error);
                });
            }
        } else if (tabName === 'inspections') {
            // عرض الواجهة فوراً بالبيانات المتوفرة
            const monthlyInspections = this.getMonthlyInspections();
            const completedEl = document.getElementById('inspections-completed');
            const needsRepairEl = document.getElementById('inspections-needs-repair');
            const outOfServiceEl = document.getElementById('inspections-out-of-service');
            const totalEl = document.getElementById('inspections-total');

            if (completedEl) completedEl.textContent = monthlyInspections.completed;
            if (needsRepairEl) needsRepairEl.textContent = monthlyInspections.needsRepair;
            if (outOfServiceEl) outOfServiceEl.textContent = monthlyInspections.outOfService;
            if (totalEl) totalEl.textContent = monthlyInspections.total;

            const tableContainer = document.getElementById('monthly-inspections-table');
            if (tableContainer) {
                tableContainer.innerHTML = this.renderMonthlyInspectionsTable(monthlyInspections.list);
            }
            
            // إذا لم تكن هناك بيانات محلية، تحميل من Backend في الخلفية وتحديث الواجهة
            const currentInspections = this.getInspections();
            if (!currentInspections || currentInspections.length === 0) {
                this.loadFireEquipmentDataAsync().then(() => {
                    if (this.state.currentTab === 'inspections') {
                        const updatedInspections = this.getMonthlyInspections();
                        const completedEl = document.getElementById('inspections-completed');
                        const needsRepairEl = document.getElementById('inspections-needs-repair');
                        const outOfServiceEl = document.getElementById('inspections-out-of-service');
                        const totalEl = document.getElementById('inspections-total');
                        const tableContainer = document.getElementById('monthly-inspections-table');
                        
                        if (completedEl) completedEl.textContent = updatedInspections.completed;
                        if (needsRepairEl) needsRepairEl.textContent = updatedInspections.needsRepair;
                        if (outOfServiceEl) outOfServiceEl.textContent = updatedInspections.outOfService;
                        if (totalEl) totalEl.textContent = updatedInspections.total;
                        if (tableContainer) {
                            tableContainer.innerHTML = this.renderMonthlyInspectionsTable(updatedInspections.list);
                        }
                    }
                }).catch(error => {
                    Utils.safeWarn('⚠️ تعذر تحميل بيانات الفحوصات:', error);
                });
            }
        } else if (tabName === 'analytics') {
            // عرض الواجهة فوراً بالبيانات المتوفرة
            this.renderAnalyticsData();
        } else if (tabName === 'approval-requests') {
            // عرض الواجهة فوراً بالبيانات المتوفرة
            const tabElement = document.getElementById('fire-tab-approval-requests');
            if (tabElement) {
                // تحميل المحتوى فوراً
                const content = await this.renderApprovalRequestsTab();
                tabElement.innerHTML = content;
                this.setupApprovalRequestsEventListeners();
                
                // إذا لم تكن هناك بيانات محلية، تحميل من Backend في الخلفية وتحديث الواجهة
                const currentRequests = this.getApprovalRequests();
                if (!currentRequests || currentRequests.length === 0) {
                    this.loadApprovalRequestsFromBackend().then(async () => {
                        if (this.state.currentTab === 'approval-requests') {
                            const updatedContent = await this.renderApprovalRequestsTab();
                            tabElement.innerHTML = updatedContent;
                            this.setupApprovalRequestsEventListeners();
                        }
                    }).catch(error => {
                        Utils.safeWarn('⚠️ تعذر تحميل طلبات الموافقة:', error);
                    });
                }
            }
        }

        // تهيئة الأحداث للتبويب النشط
        this.setupTabEventListeners(tabName);
    },

    /**
     * تحميل بيانات معدات الحريق بشكل غير متزامن
     */
    async loadFireEquipmentDataAsync() {
        try {
            const [equipmentResult, inspectionsResult, approvalRequestsResult] = await Promise.allSettled([
                GoogleIntegration.sendRequest({
                    // ✅ الأصول تُحفظ في FireEquipmentAssets (وليس FireEquipment القديم)
                    action: 'getAllFireEquipmentAssets',
                    data: {}
                }).catch(error => {
                    const errorMsg = error.message || error.toString() || '';
                    if (errorMsg.includes('انتهت مهلة الاتصال') || errorMsg.includes('timeout')) {
                        Utils.safeWarn('⚠️ انتهت مهلة الاتصال بالخادم');
                        return { success: false, data: [] };
                    }
                    Utils.safeWarn('⚠️ تعذر تحميل بيانات أصول معدات الحريق:', error);
                    return { success: false, data: [] };
                }),
                GoogleIntegration.sendRequest({
                    action: 'getAllFireEquipmentInspections',
                    data: {}
                }).catch(error => {
                    const errorMsg = error.message || error.toString() || '';
                    if (errorMsg.includes('انتهت مهلة الاتصال') || errorMsg.includes('timeout')) {
                        Utils.safeWarn('⚠️ انتهت مهلة الاتصال بالخادم');
                        return { success: false, data: [] };
                    }
                    Utils.safeWarn('⚠️ تعذر تحميل بيانات فحوصات معدات الحريق:', error);
                    return { success: false, data: [] };
                }),
                GoogleIntegration.sendRequest({
                    action: 'getFireEquipmentApprovalRequests',
                    data: {}
                }).catch(error => {
                    const errorMsg = error.message || error.toString() || '';
                    if (errorMsg.includes('انتهت مهلة الاتصال') || errorMsg.includes('timeout')) {
                        Utils.safeWarn('⚠️ انتهت مهلة الاتصال بالخادم');
                        return { success: false, data: [] };
                    }
                    Utils.safeWarn('⚠️ تعذر تحميل طلبات الموافقة:', error);
                    return { success: false, data: [] };
                })
            ]);

            // متغير لتتبع ما إذا تم تحديث البيانات
            let assetsUpdated = false;
            let inspectionsUpdated = false;

            // معالجة نتائج بيانات الأجهزة
            if (equipmentResult.status === 'fulfilled' && equipmentResult.value && equipmentResult.value.success && Array.isArray(equipmentResult.value.data)) {
                // التأكد من تهيئة المصفوفة قبل التحديث
                if (!AppState.appData.fireEquipmentAssets) {
                    AppState.appData.fireEquipmentAssets = [];
                }
                
                // دمج البيانات من Backend مع البيانات المحلية بدلاً من الاستبدال الكامل
                // هذا يضمن عدم فقدان البيانات الجديدة التي لم تُحفظ بعد
                const existingAssets = AppState.appData.fireEquipmentAssets || [];
                const backendAssets = equipmentResult.value.data;
                
                // إنشاء خريطة للأجهزة الموجودة باستخدام ID
                const existingMap = new Map();
                existingAssets.forEach(asset => {
                    if (asset.id) {
                        existingMap.set(asset.id, asset);
                    }
                });
                
                // دمج البيانات: البيانات من Backend لها الأولوية، لكن نحتفظ بالبيانات المحلية الجديدة
                backendAssets.forEach(backendAsset => {
                    if (backendAsset.id) {
                        existingMap.set(backendAsset.id, backendAsset);
                    }
                });
                
                // تحويل الخريطة إلى مصفوفة
                AppState.appData.fireEquipmentAssets = Array.from(existingMap.values());
                assetsUpdated = true;
                Utils.safeLog(`✅ تم تحميل ودمج ${equipmentResult.value.data.length} جهاز من Google Sheets (إجمالي: ${AppState.appData.fireEquipmentAssets.length})`);
            }

            // معالجة نتائج بيانات الفحوصات
            if (inspectionsResult.status === 'fulfilled' && inspectionsResult.value && inspectionsResult.value.success && Array.isArray(inspectionsResult.value.data)) {
                // إصلاح: حفظ البيانات في المكان الصحيح
                if (!AppState.appData.fireEquipmentInspections) {
                    AppState.appData.fireEquipmentInspections = [];
                }
                
                // دمج البيانات من Backend مع البيانات المحلية
                const existingInspections = AppState.appData.fireEquipmentInspections || [];
                const backendInspections = inspectionsResult.value.data;
                
                // إنشاء خريطة للفحوصات الموجودة باستخدام ID
                const existingMap = new Map();
                existingInspections.forEach(inspection => {
                    if (inspection.id) {
                        existingMap.set(inspection.id, inspection);
                    }
                });
                
                // دمج البيانات: البيانات من Backend لها الأولوية
                backendInspections.forEach(backendInspection => {
                    if (backendInspection.id) {
                        existingMap.set(backendInspection.id, backendInspection);
                    }
                });
                
                // تحويل الخريطة إلى مصفوفة
                AppState.appData.fireEquipmentInspections = Array.from(existingMap.values());
                inspectionsUpdated = true;
                Utils.safeLog(`✅ تم تحميل ودمج ${inspectionsResult.value.data.length} فحص من Google Sheets (إجمالي: ${AppState.appData.fireEquipmentInspections.length})`);
            }

            // معالجة نتائج طلبات الموافقة
            if (approvalRequestsResult.status === 'fulfilled' && approvalRequestsResult.value && approvalRequestsResult.value.success && Array.isArray(approvalRequestsResult.value.data)) {
                if (!AppState.appData.fireEquipmentApprovalRequests) {
                    AppState.appData.fireEquipmentApprovalRequests = [];
                }
                
                // دمج البيانات من Backend مع البيانات المحلية
                const existingRequests = AppState.appData.fireEquipmentApprovalRequests || [];
                const backendRequests = approvalRequestsResult.value.data;
                
                // إنشاء خريطة للطلبات الموجودة باستخدام ID
                const existingMap = new Map();
                existingRequests.forEach(request => {
                    if (request.id) {
                        existingMap.set(request.id, request);
                    }
                });
                
                // دمج البيانات: البيانات من Backend لها الأولوية
                backendRequests.forEach(backendRequest => {
                    if (backendRequest.id) {
                        existingMap.set(backendRequest.id, backendRequest);
                    }
                });
                
                // تحويل الخريطة إلى مصفوفة
                AppState.appData.fireEquipmentApprovalRequests = Array.from(existingMap.values());
                localStorage.setItem('fire_equipment_approval_requests', JSON.stringify(AppState.appData.fireEquipmentApprovalRequests));
                Utils.safeLog(`✅ تم تحميل ودمج ${approvalRequestsResult.value.data.length} طلب موافقة من Backend (إجمالي: ${AppState.appData.fireEquipmentApprovalRequests.length})`);
            }

            // تحديث الواجهة بناءً على التبويب الحالي (بعد تحميل جميع البيانات)
            // يتم التحديث مرة واحدة فقط لضمان الكفاءة
            // ملاحظة: التحقق من التبويب الحالي مهم لتجنب تحديث تبويب قد تم تبديله
            const currentTab = this.state.currentTab;
            
            // تحديث الواجهة بعد تحميل البيانات (ضمان عدم بقاء الواجهة فارغة)
            // إذا كان التبويب الحالي هو 'database'، قم بتحديث الواجهة دائماً
            if (currentTab === 'database') {
                // تحديث الواجهة دائماً لتضمن عرض البيانات المحملة (حتى لو كانت فارغة)
                // هذا يضمن عدم بقاء الواجهة فارغة بعد التحميل
                    this.renderAssets();
                } else if (currentTab === 'register' && (assetsUpdated || inspectionsUpdated)) {
                    // التحقق من أن التبويب لم يتغير أثناء التحميل
                    if (this.state.currentTab === 'register') {
                        // تحديث جدول السجل وكروت الإحصائيات بشكل موثوق بعد تحديث البيانات
                        // هذا يضمن عرض البيانات المحدثة فوراً
                        await this.refreshRegisterTable();
                    }
                } else if (currentTab === 'inspections' && inspectionsUpdated) {
                    // التحقق من أن التبويب لم يتغير أثناء التحميل
                    if (this.state.currentTab === 'inspections') {
                        // تحديث الواجهة إذا كان التبويب الحالي يتضمن الفحوصات
                        const inspections = this.getMonthlyInspections();
                        const completedEl = document.getElementById('inspections-completed');
                        const needsRepairEl = document.getElementById('inspections-needs-repair');
                        const outOfServiceEl = document.getElementById('inspections-out-of-service');
                        const totalEl = document.getElementById('inspections-total');
                        if (completedEl) completedEl.textContent = inspections.completed;
                        if (needsRepairEl) needsRepairEl.textContent = inspections.needsRepair;
                        if (outOfServiceEl) outOfServiceEl.textContent = inspections.outOfService;
                        if (totalEl) totalEl.textContent = inspections.total;
                        const tableContainer = document.getElementById('monthly-inspections-table');
                        if (tableContainer) {
                            tableContainer.innerHTML = this.renderMonthlyInspectionsTable(inspections.list);
                    }
                }
            }

            // حفظ البيانات محلياً
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }
        } catch (error) {
            const errorMsg = error.message || error.toString() || '';
            Utils.safeError('❌ خطأ في تحميل بيانات معدات الحريق من Google Sheets:', error);

            // عرض رسالة خطأ واضحة للمستخدم
            if (errorMsg.includes('انتهت مهلة الاتصال') || errorMsg.includes('timeout')) {
                Notification.warning({
                    title: 'الربط مع الخلفية',
                    message: 'انتهت مهلة الاتصال. سيتم استخدام البيانات المحلية.',
                    duration: 5000,
                    persistent: false
                });
            }
        }
    },

    /**
     * عرض محتوى التبويب بشكل متزامن مع حالة تحميل (لضمان عدم اختفاء الواجهة)
     * @param {string} tabName - اسم التبويب
     * @returns {string} HTML للمحتوى مع حالة تحميل
     */
    renderTabContentSync(tabName) {
        const loadingHTML = `
            <div class="fire-tab-loading">
                <div style="width: 300px; margin: 0 auto 16px;">
                    <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                    </div>
                </div>
                <p class="text-gray-500">جاري تحميل البيانات...</p>
            </div>
        `;

        if (tabName === 'database') {
            return `
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-database ml-2"></i>
                            قاعدة بيانات معدات الحريق
                        </h2>
                    </div>
                    <div class="card-body">
                        ${loadingHTML}
                        <div id="fire-assets-container" style="display: none;"></div>
                    </div>
                </div>
            `;
        } else if (tabName === 'register') {
            return loadingHTML;
        } else if (tabName === 'inspections') {
            return loadingHTML;
        } else if (tabName === 'analytics') {
            return loadingHTML;
        } else if (tabName === 'approval-requests') {
            return loadingHTML;
        }
        return loadingHTML;
    },

    /**
     * إخفاء حالة التحميل واستبدالها بالمحتوى الفعلي
     */
    async hideLoadingAndShowContent() {
        const activeTab = this.state.currentTab;
        const tabElement = document.getElementById(`fire-tab-${activeTab}`);
        
        if (tabElement) {
            // إخفاء حالة التحميل
            const loadingElement = tabElement.querySelector('.fire-tab-loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
            
            // تحميل المحتوى الفعلي للتبويب النشط
            try {
                const content = await this.renderTabContent(activeTab);
                if (content) {
                    // استبدال المحتوى مع الحفاظ على التبويب مرئياً
                    tabElement.innerHTML = content;
                    // إعادة تهيئة الأحداث
                    this.setupTabEventListeners(activeTab);
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في تحميل محتوى التبويب:', error);
            }
        }
    },

    async renderTabContent(tabName) {
        if (tabName === 'database') {
            return await this.renderDatabaseTab();
        } else if (tabName === 'register') {
            return await this.renderRegisterTab();
        } else if (tabName === 'inspections') {
            return await this.renderInspectionsTab();
        } else if (tabName === 'analytics') {
            return await this.renderAnalyticsTab();
        } else if (tabName === 'approval-requests') {
            return await this.renderApprovalRequestsTab();
        }
        return '';
    },

    /**
     * عرض تبويب قاعدة بيانات معدات الحريق
     */
    async renderDatabaseTab() {
        // إرجاع HTML أولاً
        return `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="content-card">
                    <div class="text-center">
                        <p class="text-sm text-gray-500">إجمالي الأجهزة</p>
                        <p class="text-2xl font-bold" id="fire-summary-total">0</p>
                    </div>
                </div>
                <div class="content-card">
                    <div class="text-center">
                        <p class="text-sm text-gray-500">أجهزة فعّالة</p>
                        <p class="text-2xl font-bold text-green-600" id="fire-summary-active">0</p>
                    </div>
                </div>
                <div class="content-card">
                    <div class="text-center">
                        <p class="text-sm text-gray-500">بحاجة إلى متابعة</p>
                        <p class="text-2xl font-bold text-yellow-600" id="fire-summary-maintenance">0</p>
                    </div>
                </div>
            </div>
            <div class="content-card mt-6">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-filter ml-2"></i>تصفية السجل</h2>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label class="form-label">بحث</label>
                            <input type="text" id="fire-assets-search" class="form-input" placeholder="بحث برقم الجهاز، النوع، الموقع...">
                        </div>
                        <div>
                            <label class="form-label">النوع</label>
                            <select id="fire-assets-type" class="form-input">
                                <option value="all">جميع الأنواع</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label">الحالة</label>
                            <select id="fire-assets-status" class="form-input">
                                <option value="all">جميع الحالات</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label">الموقع</label>
                            <select id="fire-assets-location" class="form-input">
                                <option value="all">جميع المواقع</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
                <div class="content-card xl:col-span-2">
                    <div class="card-header">
                        <h2 class="card-title"><i class="fas fa-database ml-2"></i>قاعدة بيانات معدات الحريق</h2>
                    </div>
                    <div class="card-body" id="fire-assets-table"></div>
                </div>
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title"><i class="fas fa-history ml-2"></i>أحدث الفحوصات</h2>
                    </div>
                    <div class="card-body" id="fire-recent-inspections"></div>
                </div>
            </div>
        `;
    },

    /**
     * عرض كروت الإحصائيات لتبويب السجل
     */
    renderRegisterStatisticsCards() {
        const stats = this.getRegisterStatistics();
        
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div class="content-card bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 hover:shadow-lg transition-shadow duration-300">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">إجمالي الأجهزة</p>
                            <p class="text-3xl font-bold text-blue-600" id="register-stat-total">${stats.total}</p>
                        </div>
                        <div class="bg-blue-500 rounded-full p-4">
                            <i class="fas fa-fire-extinguisher text-white text-2xl"></i>
                        </div>
                    </div>
                    <div class="mt-4">
                        <p class="text-xs text-gray-500">جميع المعدات المسجلة</p>
                    </div>
                </div>
                
                <div class="content-card bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500 hover:shadow-lg transition-shadow duration-300">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">الأجهزة الصالحة</p>
                            <p class="text-3xl font-bold text-green-600" id="register-stat-operational">${stats.operational}</p>
                        </div>
                        <div class="bg-green-500 rounded-full p-4">
                            <i class="fas fa-check-circle text-white text-2xl"></i>
                        </div>
                    </div>
                    <div class="mt-4">
                        <p class="text-xs text-gray-500">جاهزة للاستخدام</p>
                    </div>
                </div>
                
                <div class="content-card bg-gradient-to-br from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 hover:shadow-lg transition-shadow duration-300">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">تحتاج صيانة</p>
                            <p class="text-3xl font-bold text-yellow-600" id="register-stat-needs-maintenance">${stats.needsMaintenance}</p>
                        </div>
                        <div class="bg-yellow-500 rounded-full p-4">
                            <i class="fas fa-tools text-white text-2xl"></i>
                        </div>
                    </div>
                    <div class="mt-4">
                        <p class="text-xs text-gray-500">تتطلب متابعة</p>
                    </div>
                </div>
                
                <div class="content-card bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500 hover:shadow-lg transition-shadow duration-300">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">خارج الخدمة</p>
                            <p class="text-3xl font-bold text-red-600" id="register-stat-out-of-service">${stats.outOfService}</p>
                        </div>
                        <div class="bg-red-500 rounded-full p-4">
                            <i class="fas fa-ban text-white text-2xl"></i>
                        </div>
                    </div>
                    <div class="mt-4">
                        <p class="text-xs text-gray-500">غير متاحة للاستخدام</p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * تحديث كروت الإحصائيات
     * هذه الدالة آمنة للاستدعاء حتى لو لم تكن الكروت موجودة في DOM
     */
    updateRegisterStatisticsCards() {
        // التأكد من تهيئة البيانات قبل الحساب
        this.ensureData();
        
        const stats = this.getRegisterStatistics();
        
        const totalEl = document.getElementById('register-stat-total');
        const operationalEl = document.getElementById('register-stat-operational');
        const needsMaintenanceEl = document.getElementById('register-stat-needs-maintenance');
        const outOfServiceEl = document.getElementById('register-stat-out-of-service');
        
        // تحديث القيم فقط إذا كانت العناصر موجودة في DOM
        if (totalEl) totalEl.textContent = stats.total;
        if (operationalEl) operationalEl.textContent = stats.operational;
        if (needsMaintenanceEl) needsMaintenanceEl.textContent = stats.needsMaintenance;
        if (outOfServiceEl) outOfServiceEl.textContent = stats.outOfService;
    },

    /**
     * عرض تبويب سجل معدات الاطفاء والانذار
     * يعرض البيانات مباشرة إذا كانت موجودة، وإلا يعرض حالة تحميل
     */
    async renderRegisterTab() {
        // التأكد من تهيئة البيانات قبل العرض
        this.ensureData();
        
        // التحقق من وجود البيانات - إذا كانت موجودة، عرضها مباشرة
        const assets = this.getAssets();
        const hasData = assets && assets.length > 0;
        
        // تحديد محتوى الجدول بناءً على وجود البيانات
        let tableContent = '';
        if (hasData) {
            // إذا كانت البيانات موجودة، عرضها مباشرة
            tableContent = this.renderRegisterTable();
        } else {
            // إذا لم تكن البيانات موجودة، عرض حالة تحميل
            tableContent = `
                <div class="empty-state">
                    <div style="width: 300px; margin: 0 auto 16px;">
                        <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                        </div>
                    </div>
                    <p class="text-gray-500">جاري تحميل البيانات...</p>
                </div>
            `;
        }
        
        return `
            ${this.renderRegisterStatisticsCards()}
            <div class="content-card">
                <div class="card-header flex items-center justify-between flex-wrap gap-3">
                    <h2 class="card-title">
                        <i class="fas fa-clipboard-list ml-2"></i>
                        سجل معدات الاطفاء والانذار
                    </h2>
                    <div class="flex items-center gap-2 flex-wrap">
                        <button id="register-import-excel-btn" class="btn-secondary">
                            <i class="fas fa-file-import ml-2"></i>
                            استيراد من Excel
                        </button>
                        <button id="register-export-excel-btn" class="btn-secondary">
                            <i class="fas fa-file-excel ml-2"></i>
                            تصدير إلى Excel
                        </button>
                        <button id="register-export-pdf-btn" class="btn-secondary">
                            <i class="fas fa-file-pdf ml-2"></i>
                            تصدير إلى PDF
                        </button>
                        <button id="register-add-device-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة جهاز جديد
                        </button>
                    </div>
                </div>
                <div class="card-body" id="fire-register-table">
                    ${tableContent}
                </div>
            </div>
        `;
    },

    /**
     * عرض جدول سجل معدات الاطفاء والانذار
     */
    renderRegisterTable() {
        const assets = this.getAssets();

        if (!assets || assets.length === 0) {
            return '<div class="empty-state"><p class="text-gray-500">لا توجد معدات مسجلة بعد، قم بإضافة جهاز جديد لبدء المتابعة.</p></div>';
        }

        const rows = assets.map(asset => {
            const statusBadge = this.getStatusBadge(asset.status);
            const manufacturingYear = asset.manufacturingYear || '-';

            return `
                <tr>
                    <td>${Utils.escapeHTML(asset.factoryName || asset.factory || '-')}</td>
                    <td>${Utils.escapeHTML(asset.subLocationName || asset.subLocation || '-')}</td>
                    <td>${Utils.escapeHTML(asset.location || '-')}</td>
                    <td>${Utils.escapeHTML(asset.type || '-')}</td>
                    <td>${Utils.escapeHTML(asset.capacity || asset.capacityKg || '-')}</td>
                    <td>${Utils.escapeHTML(asset.siteNumber || asset.number || '-')}</td>
                    <td>${Utils.escapeHTML(asset.manufacturer || '-')}</td>
                    <td>${Utils.escapeHTML(manufacturingYear)}</td>
                    <td>${Utils.escapeHTML(asset.serialNumber || '-')}</td>
                    <td>${statusBadge}</td>
                    <td style="word-wrap: break-word; max-width: 120px;">${Utils.escapeHTML(asset.installationMethod || '-')}</td>
                    <td>
                        <div class="flex flex-wrap gap-2" style="min-width: 150px;">
                            <button class="btn-icon btn-icon-primary" data-action="view-details" data-id="${asset.id}" title="عرض التفاصيل">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon btn-icon-secondary" data-action="print-qr" data-id="${asset.id}" title="طباعة QR">
                                <i class="fas fa-qrcode"></i>
                            </button>
                            ${this.canEdit() ? `
                            <button class="btn-icon btn-icon-warning" data-action="edit-device" data-id="${asset.id}" title="تعديل">
                                <i class="fas fa-edit"></i>
                            </button>
                            ` : ''}
                            ${this.canDelete() ? `
                            <button class="btn-icon btn-icon-danger" data-action="delete-device" data-id="${asset.id}" title="حذف">
                                <i class="fas fa-trash"></i>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                    <td style="word-wrap: break-word; max-width: 200px; white-space: normal;">${Utils.escapeHTML(asset.notes || '-')}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="table-wrapper fire-register-table-wrapper" style="width: 100%; max-width: 100%; overflow-x: auto; overflow-y: auto; max-height: 70vh; position: relative;">
                <table class="data-table table-header-red" style="width: 100%; min-width: 100%; table-layout: auto;">
                    <thead>
                        <tr>
                            <th style="min-width: 100px;">المصنع</th>
                            <th style="min-width: 120px;">الموقع الفرعي</th>
                            <th style="min-width: 150px;">مكان / موقع الجهاز</th>
                            <th style="min-width: 100px;">نوع الجهاز</th>
                            <th style="min-width: 80px;">السعة / كجم</th>
                            <th style="min-width: 120px;">رقم الجهاز بالموقع</th>
                            <th style="min-width: 120px;">الشركة المصنعة</th>
                            <th style="min-width: 80px;">سنة الصنع</th>
                            <th style="min-width: 120px;">رقم مسلسل الجهاز</th>
                            <th style="min-width: 100px;">حالة الجهاز</th>
                            <th style="min-width: 100px;">طريقة تثبيت</th>
                            <th style="min-width: 150px;">الإجراء</th>
                            <th style="min-width: 150px; word-wrap: break-word;">ملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot style="display: none;"></tfoot>
                </table>
            </div>
        `;
    },

    /**
     * عرض تبويب الفحوصات الشهرية
     */
    async renderInspectionsTab() {
        // التأكد من تهيئة البيانات قبل العرض
        this.ensureData();
        
        const inspections = this.getMonthlyInspections();
        return `
            <div class="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">
                    <i class="fas fa-clipboard-check ml-2"></i>
                    الفحوصات الشهرية - ${new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })}
                </h3>
                <button id="mobile-scan-qr-btn" class="btn-primary w-full sm:w-auto" style="padding: 1rem 2rem; font-size: 1.1rem;">
                    <i class="fas fa-qrcode ml-2"></i>
                    <span class="hidden sm:inline">مسح QR Code للفحص</span>
                    <span class="sm:hidden">مسح QR</span>
                </button>
                        </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div class="content-card text-center">
                    <div class="text-2xl font-bold text-blue-600" id="inspections-total">${inspections.total}</div>
                    <div class="text-sm text-gray-600 mt-1">إجمالي الفحوصات</div>
                    </div>
                <div class="content-card text-center">
                    <div class="text-2xl font-bold text-green-600" id="inspections-completed">${inspections.completed}</div>
                    <div class="text-sm text-gray-600 mt-1">صالح</div>
                        </div>
                <div class="content-card text-center">
                    <div class="text-2xl font-bold text-yellow-600" id="inspections-needs-repair">${inspections.needsRepair}</div>
                    <div class="text-sm text-gray-600 mt-1">يحتاج صيانة</div>
                    </div>
                <div class="content-card text-center">
                    <div class="text-2xl font-bold text-red-600" id="inspections-out-of-service">${inspections.outOfService}</div>
                    <div class="text-sm text-gray-600 mt-1">خارج الخدمة</div>
                        </div>
                    </div>
                    <div class="content-card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-clipboard-list ml-2"></i>
                        سجل الفحوصات الشهرية
                    </h2>
                </div>
                <div class="card-body" id="monthly-inspections-table">
                    ${this.renderMonthlyInspectionsTable(inspections.list)}
                </div>
            </div>
        `;
    },

    /**
     * تحديث جدول السجل بشكل موثوق
     * هذه الدالة مسؤولة عن تحديث الجدول والكروت الإحصائية بالبيانات الحالية من AppState
     * يتم استدعاؤها دائماً بعد استبدال innerHTML في switchTab() أو عند تحديث البيانات
     */
    async refreshRegisterTable() {
        // التأكد من تهيئة البيانات - خطوة مهمة جداً
        this.ensureData();
        
        // تحديث كروت الإحصائيات أولاً (يتم التحقق من وجود العناصر داخل الدالة)
        this.updateRegisterStatisticsCards();
        
        const tableContainer = document.getElementById('fire-register-table');
        if (!tableContainer) {
            // إذا لم يكن الجدول موجوداً في DOM، لا حاجة للتحديث
            // قد يحدث هذا إذا لم يتم تحميل التبويب بعد أو كان التبويب مختلف
            return;
        }
        
        // الحصول على البيانات الحالية من AppState
        const assets = this.getAssets();
        
        // تحديث محتوى الجدول بناءً على البيانات الموجودة
        if (!assets || assets.length === 0) {
            // إذا لم تكن هناك بيانات، عرض رسالة واضحة
            tableContainer.innerHTML = '<div class="empty-state"><p class="text-gray-500">لا توجد معدات مسجلة بعد، قم بإضافة جهاز جديد لبدء المتابعة.</p></div>';
        } else {
            // إذا كانت هناك بيانات، عرض الجدول
            tableContainer.innerHTML = this.renderRegisterTable();
            // إعادة تعيين eventsBound لأن innerHTML تم استبداله
            tableContainer.dataset.eventsBound = 'false';
            // ربط الأحداث بعد عرض الجدول
            this.bindRegisterTableEvents(tableContainer);
        }
    },

    /**
     * تحديث التبويب الحالي
     */
    async refreshCurrentTab(skipSync = false) {
        // ✅ skipSync: إذا كان true، لا يتم إعادة تحميل البيانات من Backend
        // هذا مهم بعد الحذف لمنع إعادة الجهاز المحذوف
        
        if (this.state.currentTab === 'database') {
            this.renderAssets();
        } else if (this.state.currentTab === 'register') {
            // تحديث الكروت الإحصائية والجدول
            // ملاحظة: updateRegisterStatisticsCards() يتم استدعاؤها داخل refreshRegisterTable()
            await this.refreshRegisterTable();
        } else if (this.state.currentTab === 'inspections') {
            // تحديث تبويب الفحوصات الشهرية
            const inspections = this.getMonthlyInspections();

            // تحديث الإحصائيات
            const completedEl = document.getElementById('inspections-completed');
            const needsRepairEl = document.getElementById('inspections-needs-repair');
            const outOfServiceEl = document.getElementById('inspections-out-of-service');
            const totalEl = document.getElementById('inspections-total');

            if (completedEl) completedEl.textContent = inspections.completed;
            if (needsRepairEl) needsRepairEl.textContent = inspections.needsRepair;
            if (outOfServiceEl) outOfServiceEl.textContent = inspections.outOfService;
            if (totalEl) totalEl.textContent = inspections.total;

            // تحديث الجدول
            const tableContainer = document.getElementById('monthly-inspections-table');
            if (tableContainer) {
                tableContainer.innerHTML = this.renderMonthlyInspectionsTable(inspections.list);
            }
        } else {
            // تحديث كلا التبويبين
            this.renderAssets();
        }
        
        // ✅ إذا كان skipSync = true، لا نعيد تحميل البيانات من Backend
        // هذا يمنع إعادة الجهاز المحذوف بعد الحذف
    },

    /**
     * الحصول على الفحوصات الشهرية
     */
    getMonthlyInspections() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const monthlyInspections = this.getInspections().filter(inspection => {
            const inspectionDate = new Date(inspection.checkDate || inspection.createdAt);
            return inspectionDate >= startOfMonth && inspectionDate <= endOfMonth;
        }).sort((a, b) => {
            const dateA = new Date(a.checkDate || a.createdAt);
            const dateB = new Date(b.checkDate || b.createdAt);
            return dateB - dateA;
        });

        return {
            list: monthlyInspections,
            total: monthlyInspections.length,
            completed: monthlyInspections.filter(i => i.status === 'صالح').length,
            needsRepair: monthlyInspections.filter(i => i.status === 'يحتاج صيانة').length,
            outOfService: monthlyInspections.filter(i => i.status === 'خارج الخدمة').length
        };
    },

    /**
     * عرض جدول الفحوصات الشهرية
     */
    renderMonthlyInspectionsTable(inspections) {
        if (!inspections || inspections.length === 0) {
            return '<div class="empty-state"><p class="text-gray-500">لا توجد فحوصات مسجلة هذا الشهر</p></div>';
        }

        const rows = inspections.map(inspection => {
            const asset = this.getAssets().find(a => a.id === inspection.assetId);
            const assetLabel = asset ? `${asset.number || asset.id} - ${asset.location || ''}` : inspection.assetId;
            const statusBadge = this.getStatusBadge(inspection.status);
            const checkDate = inspection.checkDate ? Utils.formatDate(inspection.checkDate) : '-';

            return `
                <tr>
                    <td>
                        <div class="font-semibold text-gray-800">${Utils.escapeHTML(assetLabel)}</div>
                        <div class="text-xs text-gray-400">DeviceID: ${Utils.escapeHTML(inspection.assetId || '-')}</div>
                    </td>
                    <td>${checkDate}</td>
                    <td>${Utils.escapeHTML(inspection.inspector || '-')}</td>
                    <td style="word-wrap: break-word;">${statusBadge}</td>
                    <td style="word-wrap: break-word; max-width: 250px; white-space: normal;">${Utils.escapeHTML(inspection.remarks || '-')}</td>
                    <td>
                        <button class="btn-icon btn-icon-primary" onclick="FireEquipment.viewInspection('${inspection.id}')" title="عرض التفاصيل">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="table-wrapper" style="width: 100%; max-width: 100%; overflow-x: auto;">
                <table class="data-table table-header-red" style="width: 100%; min-width: 100%; table-layout: auto;">
                    <thead>
                        <tr>
                            <th style="min-width: 150px;">الجهاز</th>
                            <th style="min-width: 120px;">تاريخ الفحص</th>
                            <th style="min-width: 120px;">المفتش</th>
                            <th style="min-width: 100px;">الحالة</th>
                            <th style="min-width: 200px; word-wrap: break-word;">ملاحظات</th>
                            <th style="min-width: 100px;">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    /**
     * عرض تفاصيل فحص
     */
    viewInspection(inspectionId) {
        const inspection = this.getInspections().find(i => i.id === inspectionId);
        if (!inspection) {
            Notification.error('لم يتم العثور على بيانات الفحص');
            return;
        }

        const asset = this.getAssets().find(a => a.id === inspection.assetId);
        const assetLabel = asset ? `${asset.number || asset.id} - ${asset.location || ''}` : inspection.assetId;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">
                        <i class="fas fa-clipboard-check"></i>
                        تفاصيل الفحص الشهري
                    </h2>
                    <button class="modal-close" onclick="FireEquipment.confirmClose(this)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الجهاز:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(assetLabel)}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">DeviceID:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(inspection.assetId || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">تاريخ الفحص:</label>
                                <p class="text-gray-800">${inspection.checkDate ? Utils.formatDate(inspection.checkDate) : '-'}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">المفتش:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(inspection.inspector || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الحالة:</label>
                                <p class="text-gray-800">${this.getStatusBadge(inspection.status)}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">قراءة العداد / الضغط:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(inspection.gaugeReading || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">ختم الأمان:</label>
                                <p class="text-gray-800">${inspection.sealIntact === true ? 'سليم' :
                inspection.sealIntact === false ? 'مكسور' :
                    'غير محدد'
            }</p>
                            </div>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">الملاحظات:</label>
                            <p class="text-gray-800">${Utils.escapeHTML(inspection.remarks || '-')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">الإجراءات المتخذة:</label>
                            <p class="text-gray-800">${Utils.escapeHTML(inspection.actions || '-')}</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer form-actions-centered">
                    <button class="btn-secondary" onclick="FireEquipment.confirmClose(this)">إغلاق</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    /**
     * تحميل الأجهزة مباشرة من Backend
     */
    async loadAssetsFromBackend() {
        try {
            if (!GoogleIntegration || !AppState.googleConfig?.appsScript?.enabled) {
                Utils.safeWarn('⚠️ Backend غير متاح - استخدام البيانات المحلية');
                return;
            }

            // التأكد من تهيئة البيانات قبل التحميل
            this.ensureData();

            Utils.safeLog('🔄 تحميل أجهزة الحريق من Backend...');

            const result = await GoogleIntegration.sendRequest({
                action: 'getAllFireEquipmentAssets',
                data: {}
            });

            if (result && result.success && Array.isArray(result.data)) {
                // دمج البيانات من Backend مع البيانات المحلية بدلاً من الاستبدال الكامل
                // هذا يضمن عدم فقدان البيانات الجديدة التي لم تُحفظ بعد
                const existingAssets = AppState.appData.fireEquipmentAssets || [];
                const backendAssets = result.data;
                
                // إنشاء خريطة للأجهزة الموجودة باستخدام ID
                const existingMap = new Map();
                existingAssets.forEach(asset => {
                    if (asset.id) {
                        existingMap.set(asset.id, asset);
                    }
                });
                
                // دمج البيانات: البيانات من Backend لها الأولوية، لكن نحتفظ بالبيانات المحلية الجديدة
                backendAssets.forEach(backendAsset => {
                    if (backendAsset.id) {
                        existingMap.set(backendAsset.id, backendAsset);
                    }
                });
                
                // تحويل الخريطة إلى مصفوفة
                AppState.appData.fireEquipmentAssets = Array.from(existingMap.values());

                // حفظ محلياً
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                Utils.safeLog(`✅ تم تحميل ودمج ${result.data.length} جهاز من Backend (إجمالي: ${AppState.appData.fireEquipmentAssets.length})`);
            } else {
                Utils.safeWarn('⚠️ فشل تحميل البيانات من Backend:', result?.message);
                // في حالة الفشل، البيانات المحلية تبقى في AppState
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل البيانات من Backend:', error);
            // في حالة الخطأ، البيانات المحلية تبقى في AppState
        }
    },

    ensureData() {
        if (typeof AppState === 'undefined') AppState = {};
        if (!AppState.appData) AppState.appData = {};
        const data = AppState.appData;
        let migrated = false;

        if (!Array.isArray(data.fireEquipmentAssets)) {
            data.fireEquipmentAssets = [];
        }
        if (!Array.isArray(data.fireEquipmentInspections)) {
            data.fireEquipmentInspections = [];
        }
        // نقل الفحوصات من الموقع القديم (fireEquipment) إلى الجديد (fireEquipmentInspections)
        // إذا كانت fireEquipment تحتوي على فحوصات (لها assetId و checkDate)
        if (Array.isArray(data.fireEquipment) && data.fireEquipment.length > 0) {
            const inspectionsToMigrate = data.fireEquipment.filter(entry => 
                entry.assetId && (entry.checkDate || entry.createdAt)
            );
            
            if (inspectionsToMigrate.length > 0) {
                // نقل الفحوصات إلى الموقع الصحيح
                inspectionsToMigrate.forEach(inspection => {
                    const exists = data.fireEquipmentInspections.some(i => i.id === inspection.id);
                    if (!exists) {
                        data.fireEquipmentInspections.push({
                            id: inspection.id || Utils.generateId('FEI'),
                            assetId: inspection.assetId,
                            checkDate: inspection.checkDate || inspection.createdAt,
                            inspector: inspection.inspector || '',
                            status: inspection.status || 'صالح',
                            gaugeReading: inspection.gaugeReading || '',
                            sealIntact: typeof inspection.sealIntact === 'boolean' ? inspection.sealIntact : null,
                            remarks: inspection.remarks || inspection.notes || '',
                            actions: inspection.actions || '',
                            createdAt: inspection.createdAt || new Date().toISOString(),
                            updatedAt: inspection.updatedAt || new Date().toISOString()
                        });
                    }
                });
                migrated = true;
            }
        }

        // معالجة البيانات الجديدة من fireEquipment (بعد المزامنة)
        if (
            Array.isArray(data.fireEquipment) &&
            data.fireEquipment.length > 0
        ) {
            // إنشاء خرائط من البيانات الموجودة لتجنب التكرار
            const existingAssetsMap = new Map();
            const existingInspectionsMap = new Map();

            data.fireEquipmentAssets.forEach(asset => {
                if (asset.id) existingAssetsMap.set(asset.id, asset);
                if (asset.number) existingAssetsMap.set(asset.number.toLowerCase(), asset);
            });

            data.fireEquipmentInspections.forEach(inspection => {
                if (inspection.id) existingInspectionsMap.set(inspection.id, inspection);
            });

            const numberMap = new Map();
            const idMap = new Map();
            const statusMap = {
                'صالح': 'صالح',
                'يحتاج إصلاح': 'يحتاج صيانة',
                'معطل': 'خارج الخدمة'
            };

            data.fireEquipment.forEach(entry => {
                const rawNumber = String(entry.equipmentNumber || entry.number || '').trim();
                const key = rawNumber.toLowerCase();
                let asset = key ? numberMap.get(key) : null;

                // التحقق من البيانات الموجودة أولاً
                if (!asset && key) {
                    asset = existingAssetsMap.get(key);
                }

                // معالجة assetId
                let entryAssetId = entry.assetId ? String(entry.assetId) : null;

                // تحويل IDs القديمة (FEA_...) إلى التنسيق الجديد (EFA-XXXX)
                if (entryAssetId && entryAssetId.startsWith('FEA_')) {
                    // إذا كان لدينا ID قديم، نتجاهله ونطلب توليد جديد
                    // إلا إذا كان مسجلاً بالفعل في النظام بتنسيق جديد
                    const existingWithOldId = existingAssetsMap.get(entryAssetId);
                    if (existingWithOldId && existingWithOldId.id.match(/^EFA-\d{4}$/)) {
                        entryAssetId = existingWithOldId.id; // استخدم الجديد الموجود
                    } else {
                        entryAssetId = null; // سيتم توليد جديد بالأسفل
                    }
                }

                if (!asset && entryAssetId) {
                    asset = existingAssetsMap.get(entryAssetId);
                }

                if (!asset) {
                    // توليد ID جديد بالتنسيق القياسي EFA-XXXX
                    const assetId = entryAssetId && entryAssetId.match(/^EFA-\d{4}$/)
                        ? entryAssetId
                        : this.generateFireDeviceID();

                    const qrData = this.generateQrData(assetId);
                    const status = statusMap[entry.status] || entry.status || 'صالح';

                    asset = {
                        id: assetId,
                        number: rawNumber || assetId,
                        type: entry.equipmentType || '',
                        location: entry.location || '',
                        manufacturer: entry.manufacturer || '',
                        model: entry.model || '',
                        capacity: entry.capacity || '',
                        installationDate: entry.installationDate || '',
                        lastServiceDate: entry.checkDate || entry.lastServiceDate || '',
                        status,
                        responsible: entry.inspector || '',
                        notes: entry.notes || '',
                        qrCodeData: qrData,
                        createdAt: entry.createdAt || new Date().toISOString(),
                        updatedAt: entry.updatedAt || new Date().toISOString()
                    };

                    if (key) {
                        numberMap.set(key, asset);
                    }
                    idMap.set(asset.id, asset);
                } else {
                    // تحديث البيانات الموجودة
                    if (entry.equipmentType) asset.type = entry.equipmentType;
                    if (entry.location) asset.location = entry.location;
                    if (entry.manufacturer) asset.manufacturer = entry.manufacturer;
                    if (entry.model) asset.model = entry.model;
                    if (entry.capacity) asset.capacity = entry.capacity;
                    if (entry.installationDate) asset.installationDate = entry.installationDate;
                    if (entry.checkDate || entry.lastServiceDate) asset.lastServiceDate = entry.checkDate || entry.lastServiceDate;
                    if (entry.status) asset.status = statusMap[entry.status] || entry.status;
                    if (entry.inspector) asset.responsible = entry.inspector;
                    if (entry.notes) asset.notes = entry.notes;
                    if (entry.updatedAt) asset.updatedAt = entry.updatedAt;

                    idMap.set(asset.id, asset);
                }

                const baseId = entry.id ? String(entry.id) : Utils.generateId('FEI');
                const inspectionId = baseId.startsWith('FEI') ? baseId : baseId.replace(/^FIRE_EQUIP/, 'FEI');
                const inspectionDate = entry.checkDate || entry.createdAt || new Date().toISOString();
                const inspectionStatus = statusMap[entry.status] || entry.status || 'صالح';

                // التحقق من وجود الفحص مسبقاً
                let inspection = existingInspectionsMap.get(inspectionId);
                if (!inspection) {
                    inspection = {
                        id: inspectionId,
                        assetId: asset.id,
                        checkDate: inspectionDate,
                        inspector: entry.inspector || asset.responsible || '',
                        status: inspectionStatus,
                        gaugeReading: entry.gaugeReading || '',
                        sealIntact: typeof entry.sealIntact === 'boolean' ? entry.sealIntact : null,
                        remarks: entry.notes || '',
                        actions: entry.actions || '',
                        createdAt: entry.createdAt || inspectionDate,
                        updatedAt: entry.updatedAt || inspectionDate
                    };
                    data.fireEquipmentInspections.push(inspection);
                } else {
                    // تحديث الفحص الموجود
                    if (entry.checkDate) inspection.checkDate = entry.checkDate;
                    if (entry.inspector) inspection.inspector = entry.inspector;
                    if (entry.status) inspection.status = statusMap[entry.status] || entry.status;
                    if (entry.gaugeReading !== undefined) inspection.gaugeReading = entry.gaugeReading;
                    if (typeof entry.sealIntact === 'boolean') inspection.sealIntact = entry.sealIntact;
                    if (entry.notes) inspection.remarks = entry.notes;
                    if (entry.actions) inspection.actions = entry.actions;
                    if (entry.updatedAt) inspection.updatedAt = entry.updatedAt;
                }
            });

            // دمج الأصول الجديدة مع الموجودة
            const mergedAssets = [...data.fireEquipmentAssets];
            idMap.forEach((asset, id) => {
                const existingIndex = mergedAssets.findIndex(a => a.id === id);
                if (existingIndex >= 0) {
                    mergedAssets[existingIndex] = asset;
                } else {
                    mergedAssets.push(asset);
                }
            });

            data.fireEquipmentAssets = mergedAssets;
            data.fireEquipment = [];
            migrated = true;
        }

        return migrated;
    },

    getAssets() {
        return Array.isArray(AppState.appData.fireEquipmentAssets)
            ? AppState.appData.fireEquipmentAssets
            : [];
    },

    /**
     * الحصول على إحصائيات الأجهزة
     */
    getRegisterStatistics() {
        const assets = this.getAssets();
        
        return {
            total: assets.length,
            operational: assets.filter(a => a.status === 'صالح').length,
            needsMaintenance: assets.filter(a => a.status === 'يحتاج صيانة').length,
            outOfService: assets.filter(a => a.status === 'خارج الخدمة').length
        };
    },

    getInspections() {
        // دعم التوافق مع البيانات القديمة والجديدة
        const inspections = Array.isArray(AppState.appData.fireEquipmentInspections)
            ? AppState.appData.fireEquipmentInspections
            : [];
        
        // إذا كانت البيانات محفوظة في المكان القديم، نقلها
        if (inspections.length === 0 && Array.isArray(AppState.appData.fireEquipment) && AppState.appData.fireEquipment.length > 0) {
            AppState.appData.fireEquipmentInspections = AppState.appData.fireEquipment;
            // الاحتفاظ بنسخة احتياطية مؤقتة
            return AppState.appData.fireEquipment;
        }
        
        return inspections;
    },

    async renderAssets() {
        this.refreshFilterOptions();
        this.renderSummary();

        const assets = this.getFilteredAssets();
        const tableContainer = document.getElementById('fire-assets-table');
        if (tableContainer) {
            tableContainer.innerHTML = this.renderAssetsTable(assets);
            this.bindTableEvents(tableContainer);
        }

        const recentContainer = document.getElementById('fire-recent-inspections');
        if (recentContainer) {
            recentContainer.innerHTML = this.renderRecentInspections();
        }
    },

    refreshFilterOptions() {
        const assets = this.getAssets();
        const typeSelect = document.getElementById('fire-assets-type');
        const statusSelect = document.getElementById('fire-assets-status');
        const locationSelect = document.getElementById('fire-assets-location');

        if (typeSelect) {
            const current = this.state.filters.type;
            const types = Array.from(new Set(assets.map(asset => asset.type).filter(Boolean)));
            typeSelect.innerHTML = [
                '<option value="all">جميع الأنواع</option>',
                ...types.map(type => `<option value="${Utils.escapeHTML(type)}">${Utils.escapeHTML(type)}</option>`)
            ].join('');
            typeSelect.value = types.includes(current) ? current : 'all';
            this.state.filters.type = typeSelect.value;
        }

        if (statusSelect) {
            const current = this.state.filters.status;
            statusSelect.innerHTML = [
                '<option value="all">جميع الحالات</option>',
                ...this.statusOptions.map(option => `<option value="${option.value}">${option.label}</option>`)
            ].join('');
            statusSelect.value = this.statusOptions.some(option => option.value === current) ? current : 'all';
            this.state.filters.status = statusSelect.value;
        }

        if (locationSelect) {
            const current = this.state.filters.location;
            const locations = Array.from(new Set(assets.map(asset => asset.location).filter(Boolean)));
            locationSelect.innerHTML = [
                '<option value="all">جميع المواقع</option>',
                ...locations.map(location => `<option value="${Utils.escapeHTML(location)}">${Utils.escapeHTML(location)}</option>`)
            ].join('');
            locationSelect.value = locations.includes(current) ? current : 'all';
            this.state.filters.location = locationSelect.value;
        }
    },

    renderSummary() {
        const stats = this.getAssetStats();
        const totalEl = document.getElementById('fire-summary-total');
        const activeEl = document.getElementById('fire-summary-active');
        const maintenanceEl = document.getElementById('fire-summary-maintenance');

        if (totalEl) totalEl.textContent = stats.total;
        if (activeEl) activeEl.textContent = stats.active;
        if (maintenanceEl) maintenanceEl.textContent = stats.needsMaintenance;
    },

    renderAssetsTable(assets) {
        if (!assets.length) {
            return '<div class="empty-state"><p class="text-gray-500">لا توجد معدات مسجلة بعد، قم بإضافة جهاز جديد لبدء المتابعة.</p></div>';
        }

        const rows = assets.map(asset => {
            const latest = this.getLatestInspection(asset.id);
            const lastCheck = latest ? Utils.formatDate(latest.checkDate) : '-';
            const statusBadge = this.getStatusBadge(asset.status);

            return `
                <tr>
                    <td>
                        <div class="font-semibold text-gray-800">${Utils.escapeHTML(asset.number || '-')}</div>
                        <div class="text-xs text-gray-400">${Utils.escapeHTML(asset.model || '')}</div>
                    </td>
                    <td>${Utils.escapeHTML(asset.type || '')}</td>
                    <td>${Utils.escapeHTML(asset.location || '')}</td>
                    <td>${statusBadge}</td>
                    <td>${lastCheck}</td>
                    <td>
                        <div class="flex flex-wrap gap-2">
                            <button class="btn-icon btn-icon-primary" data-action="view" data-id="${asset.id}" title="عرض التفاصيل">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon btn-icon-secondary" data-action="qr" data-id="${asset.id}" title="طباعة QR Code">
                                <i class="fas fa-qrcode"></i>
                            </button>
                            ${this.canEdit() ? `
                            <button class="btn-icon btn-icon-warning" data-action="edit" data-id="${asset.id}" title="تعديل الجهاز">
                                <i class="fas fa-edit"></i>
                            </button>
                            ` : ''}
                            ${this.canDelete() ? `
                            <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${asset.id}" title="حذف الجهاز">
                                <i class="fas fa-trash"></i>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="table-wrapper fire-assets-table-wrapper" style="width: 100%; max-width: 100%; overflow-x: auto; overflow-y: auto; max-height: 70vh; position: relative;">
                <table class="data-table table-header-red" style="width: 100%; min-width: 100%; table-layout: auto;">
                    <thead>
                        <tr>
                            <th style="min-width: 120px;">رقم الجهاز</th>
                            <th style="min-width: 100px;">النوع</th>
                            <th style="min-width: 150px;">الموقع</th>
                            <th style="min-width: 100px;">الحالة</th>
                            <th style="min-width: 120px;">آخر فحص</th>
                            <th style="min-width: 150px;">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    renderRecentInspections() {
        const inspections = this.getInspections()
            .slice()
            .sort((a, b) => new Date(b.checkDate || b.createdAt || 0) - new Date(a.checkDate || a.createdAt || 0))
            .slice(0, 6);

        if (!inspections.length) {
            return '<div class="empty-state"><p class="text-gray-500">لا توجد فحوصات مسجلة مؤخراً.</p></div>';
        }

        const items = inspections.map(inspection => {
            const asset = this.getAssets().find(item => item.id === inspection.assetId);
            const assetLabel = asset ? asset.number : inspection.assetId;
            return `
                <div class="border-b border-gray-100 py-3 last:border-b-0">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <p class="font-semibold text-gray-800">${Utils.escapeHTML(assetLabel || '-')}</p>
                            <p class="text-xs text-gray-500">${Utils.formatDate(inspection.checkDate)}</p>
                        </div>
                        <div>${this.getStatusBadge(inspection.status)}</div>
                    </div>
                    <p class="text-xs text-gray-500 mt-2">المفتش: ${Utils.escapeHTML(inspection.inspector || '-')}</p>
                </div>
            `;
        }).join('');

        return `<div class="divide-y divide-gray-100">${items}</div>`;
    },

    getStatusBadge(status) {
        const normalized = status || '';
        let badgeClass = 'badge-info';
        if (normalized === 'صالح') badgeClass = 'badge-success';
        else if (normalized === 'يحتاج صيانة') badgeClass = 'badge-warning';
        else if (normalized === 'خارج الخدمة') badgeClass = 'badge-danger';
        return `<span class="badge ${badgeClass}">${Utils.escapeHTML(normalized || '-')}</span>`;
    },

    bindTableEvents(container) {
        if (!container || container.dataset.eventsBound === 'true') {
            return;
        }

        container.addEventListener('click', async event => {
            const target = event.target.closest('[data-action]');
            if (!target) return;

            event.preventDefault();
            const action = target.dataset.action;
            const id = target.dataset.id;

            switch (action) {
                case 'view':
                    this.viewAsset(id);
                    break;
                case 'qr':
                    this.printQr(id);
                    break;
                case 'edit':
                    await this.showAssetForm(this.getAssets().find(asset => asset.id === id) || null);
                    break;
                case 'delete':
                    await this.deleteAsset(id);
                    break;
                default:
                    break;
            }
        });

        container.dataset.eventsBound = 'true';
    },

    setupEventListeners() {
        // الأزرار العامة (موجودة في جميع التبويبات)
        const addAssetBtn = document.getElementById('add-fire-asset-btn');
        if (addAssetBtn) {
            addAssetBtn.addEventListener('click', async () => await this.showAssetForm());
        }

        const scanQrBtn = document.getElementById('scan-qr-inspection-btn');
        if (scanQrBtn) {
            scanQrBtn.addEventListener('click', () => this.startQRScan());
        }

        // زر مسح QR للموبايل
        const mobileScanBtn = document.getElementById('mobile-scan-qr-btn');
        if (mobileScanBtn) {
            mobileScanBtn.addEventListener('click', () => this.startQRScan());
        }

        const refreshBtn = document.getElementById('refresh-fire-equipment-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                try {
                    // إظهار حالة التحميل على الزر
                    const originalHtml = refreshBtn.innerHTML;
                    refreshBtn.disabled = true;
                    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري التحديث...';
                    
                    // تحميل البيانات من الخادم
                    await this.loadFireEquipmentDataAsync();
                    
                    // تحديث التبويب الحالي
                    await this.refreshCurrentTab();
                    
                    // إرجاع حالة الزر
                    refreshBtn.disabled = false;
                    refreshBtn.innerHTML = originalHtml;
                    
                    if (typeof Notification !== 'undefined') {
                        Notification.success('تم تحديث البيانات بنجاح');
                    }
                } catch (error) {
                    Utils.safeError('❌ خطأ في تحديث البيانات:', error);
                    if (typeof Notification !== 'undefined') {
                        Notification.error('حدث خطأ أثناء تحديث البيانات');
                    }
                    refreshBtn.disabled = false;
                    refreshBtn.innerHTML = '<i class="fas fa-sync-alt ml-2"></i>تحديث';
                }
            });
        }

        // تهيئة أحداث التبويب الحالي
        this.setupTabEventListeners(this.state.currentTab);
    },

    /**
     * ربط أحداث جدول السجل
     */
    bindRegisterTableEvents(container) {
        if (!container || container.dataset.eventsBound === 'true') {
            return;
        }

        container.addEventListener('click', async event => {
            const target = event.target.closest('[data-action]');
            if (!target) return;

            event.preventDefault();
            const action = target.dataset.action;
            const id = target.dataset.id;

            switch (action) {
                case 'view-details':
                    this.viewAsset(id);
                    break;
                case 'print-qr':
                    this.printQr(id);
                    break;
                case 'edit-device':
                    await this.showAssetForm(this.getAssets().find(asset => asset.id === id) || null);
                    break;
                case 'delete-device':
                    await this.deleteAsset(id);
                    break;
                default:
                    break;
            }
        });

        container.dataset.eventsBound = 'true';
    },

    /**
     * تهيئة أحداث التبويب المحدد
     * @param {string} tabName - اسم التبويب
     */
    setupTabEventListeners(tabName) {
        if (tabName === 'database') {
            // أحداث تبويب قاعدة البيانات
            const searchInput = document.getElementById('fire-assets-search');
            if (searchInput) {
                // إزالة المستمعين السابقين
                const newSearchInput = searchInput.cloneNode(true);
                searchInput.parentNode.replaceChild(newSearchInput, searchInput);
                newSearchInput.addEventListener('input', () => this.applyFilters());
            }

            const typeSelect = document.getElementById('fire-assets-type');
            if (typeSelect) {
                const newTypeSelect = typeSelect.cloneNode(true);
                typeSelect.parentNode.replaceChild(newTypeSelect, typeSelect);
                newTypeSelect.addEventListener('change', () => this.applyFilters());
            }

            const statusSelect = document.getElementById('fire-assets-status');
            if (statusSelect) {
                const newStatusSelect = statusSelect.cloneNode(true);
                statusSelect.parentNode.replaceChild(newStatusSelect, statusSelect);
                newStatusSelect.addEventListener('change', () => this.applyFilters());
            }

            const locationSelect = document.getElementById('fire-assets-location');
            if (locationSelect) {
                const newLocationSelect = locationSelect.cloneNode(true);
                locationSelect.parentNode.replaceChild(newLocationSelect, locationSelect);
                newLocationSelect.addEventListener('change', () => this.applyFilters());
            }
        } else if (tabName === 'inspections') {
            // أحداث تبويب الفحوصات الشهرية
            const newInspectionBtn = document.getElementById('new-inspection-btn');
            if (newInspectionBtn) {
                // إزالة المستمعين السابقين
                const newBtn = newInspectionBtn.cloneNode(true);
                newInspectionBtn.parentNode.replaceChild(newBtn, newInspectionBtn);
                newBtn.addEventListener('click', () => {
                    this.startQRScan();
                });
            }
            
            // زر مسح QR للموبايل
            const mobileScanBtn = document.getElementById('mobile-scan-qr-btn');
            if (mobileScanBtn) {
                const newMobileBtn = mobileScanBtn.cloneNode(true);
                mobileScanBtn.parentNode.replaceChild(newMobileBtn, mobileScanBtn);
                newMobileBtn.addEventListener('click', () => {
                    this.startQRScan();
                });
            }
        } else if (tabName === 'register') {
            // أحداث تبويب السجل
            const registerTable = document.getElementById('fire-register-table');
            if (registerTable) {
                this.bindRegisterTableEvents(registerTable);
            }

            const addDeviceBtn = document.getElementById('register-add-device-btn');
            if (addDeviceBtn) {
                const newAddBtn = addDeviceBtn.cloneNode(true);
                addDeviceBtn.parentNode.replaceChild(newAddBtn, addDeviceBtn);
                newAddBtn.addEventListener('click', async () => {
                    await this.showAssetForm();
                });
            }

            const importExcelBtn = document.getElementById('register-import-excel-btn');
            if (importExcelBtn) {
                const newImportBtn = importExcelBtn.cloneNode(true);
                importExcelBtn.parentNode.replaceChild(newImportBtn, importExcelBtn);
                newImportBtn.addEventListener('click', () => {
                    this.showImportExcelModal();
                });
            }

            const exportExcelBtn = document.getElementById('register-export-excel-btn');
            if (exportExcelBtn) {
                const newExportBtn = exportExcelBtn.cloneNode(true);
                exportExcelBtn.parentNode.replaceChild(newExportBtn, exportExcelBtn);
                newExportBtn.addEventListener('click', () => {
                    this.exportToExcel();
                });
            }

            const exportPdfBtn = document.getElementById('register-export-pdf-btn');
            if (exportPdfBtn) {
                const newPdfBtn = exportPdfBtn.cloneNode(true);
                exportPdfBtn.parentNode.replaceChild(newPdfBtn, exportPdfBtn);
                newPdfBtn.addEventListener('click', () => {
                    this.exportRegisterToPDF();
                });
            }
        } else if (tabName === 'analytics') {
            // أحداث تبويب تحليل البيانات
            this.setupAnalyticsEventListeners();
        } else if (tabName === 'approval-requests') {
            // أحداث تبويب طلبات الموافقة
            this.setupApprovalRequestsEventListeners();
        }
    },

    applyFilters() {
        const searchInput = document.getElementById('fire-assets-search');
        const typeSelect = document.getElementById('fire-assets-type');
        const statusSelect = document.getElementById('fire-assets-status');
        const locationSelect = document.getElementById('fire-assets-location');

        this.state.filters.search = (searchInput?.value || '').trim().toLowerCase();
        this.state.filters.type = typeSelect ? typeSelect.value : 'all';
        this.state.filters.status = statusSelect ? statusSelect.value : 'all';
        this.state.filters.location = locationSelect ? locationSelect.value : 'all';

        this.renderAssets();
    },

    getFilteredAssets() {
        const filters = this.state.filters;
        return this.getAssets().filter(asset => {
            const searchValue = filters.search;
            const matchesSearch =
                !searchValue ||
                [
                    asset.number,
                    asset.type,
                    asset.location,
                    asset.manufacturer,
                    asset.responsible
                ].some(value => String(value || '').toLowerCase().includes(searchValue));

            const matchesType = filters.type === 'all' || asset.type === filters.type;
            const matchesStatus = filters.status === 'all' || asset.status === filters.status;
            const matchesLocation = filters.location === 'all' || asset.location === filters.location;

            return matchesSearch && matchesType && matchesStatus && matchesLocation;
        });
    },

    async showAssetForm(asset = null) {
        const isEdit = !!asset;

        // التحقق من الصلاحيات
        if (isEdit && !this.canEdit()) {
            Notification.error('ليس لديك صلاحية لتعديل الأجهزة. يجب أن تكون مدير النظام أو لديك صلاحية التعديل.');
            return;
        }

        if (!isEdit && !this.canAdd()) {
            Notification.error('ليس لديك صلاحية لإضافة أجهزة جديدة. يجب أن تكون مدير النظام أو لديك صلاحية الإضافة.');
            return;
        }

        const assetId = asset?.id || this.generateFireDeviceID();

        // التأكد من تحميل إعدادات النماذج
        if (typeof Permissions !== 'undefined' && typeof Permissions.ensureFormSettingsState === 'function') {
            await Permissions.ensureFormSettingsState();
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 760px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">${isEdit ? 'تعديل جهاز' : 'إضافة جهاز إطفاء جديد'}</h2>
                    <button class="modal-close" onclick="FireEquipment.confirmClose(this)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="fire-asset-form" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="form-label">المصنع</label>
                                <select id="asset-factory" class="form-input">
                                    <option value="">اختر المصنع</option>
                                    ${this.getSiteOptions().map(site => {
            const isSelected = asset && (asset.factoryId === site.id || asset.factoryId === String(site.id) || (asset.factory === site.id && !asset.factoryId) || asset.factory === site.name);
            return `<option value="${site.id}" ${isSelected ? 'selected' : ''}>${Utils.escapeHTML(site.name)}</option>`;
        }).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="form-label">الموقع الفرعي</label>
                                <select id="asset-sub-location" class="form-input">
                                    <option value="">اختر الموقع الفرعي</option>
                                    ${(() => {
                const factoryId = asset?.factoryId || asset?.factory || '';
                const places = this.getPlaceOptions(factoryId);
                return places.map(place => {
                    const isSelected = asset && (asset.subLocationId === place.id || asset.subLocationId === String(place.id) || (asset.subLocation === place.id && !asset.subLocationId) || asset.subLocation === place.name);
                    return `<option value="${place.id}" ${isSelected ? 'selected' : ''}>${Utils.escapeHTML(place.name)}</option>`;
                }).join('');
            })()}
                                </select>
                            </div>
                            <div>
                                <label class="form-label">مكان / موقع الجهاز *</label>
                                <input type="text" id="asset-location" required class="form-input" value="${Utils.escapeHTML(asset?.location || '')}" placeholder="المبنى / الدور / المنطقة">
                            </div>
                            <div>
                                <label class="form-label">نوع الجهاز *</label>
                                <div class="flex gap-2">
                                    <input type="text" id="asset-type" list="fire-asset-types" required class="form-input flex-1" value="${Utils.escapeHTML(asset?.type || '')}" placeholder="اختر أو أضف نوع جديد">
                                    <button type="button" id="manage-types-btn" class="btn-secondary" title="إدارة أنواع الأجهزة">
                                        <i class="fas fa-cog"></i>
                                    </button>
                                </div>
                                <datalist id="fire-asset-types">
                                    ${this.assetTypes.map(type => `<option value="${Utils.escapeHTML(type)}"></option>`).join('')}
                                </datalist>
                            </div>
                            <div>
                                <label class="form-label">السعة / كجم *</label>
                                <input type="text" id="asset-capacity" required class="form-input" value="${Utils.escapeHTML(asset?.capacity || asset?.capacityKg || '')}" placeholder="مثال: 6 كجم">
                            </div>
                            <div>
                                <label class="form-label">رقم الجهاز بالموقع *</label>
                                <input type="text" id="asset-site-number" required class="form-input" value="${Utils.escapeHTML(asset?.siteNumber || asset?.number || '')}" placeholder="رقم الجهاز في الموقع">
                            </div>
                            <div>
                                <label class="form-label">الشركة المصنعة</label>
                                <input type="text" id="asset-manufacturer" class="form-input" value="${Utils.escapeHTML(asset?.manufacturer || '')}" placeholder="الشركة المصنعة">
                            </div>
                            <div>
                                <label class="form-label">سنة الصنع</label>
                                <input type="number" id="asset-manufacturing-year" class="form-input" value="${asset?.manufacturingYear || ''}" placeholder="مثال: 2023" min="1900" max="2100">
                            </div>
                            <div>
                                <label class="form-label">رقم مسلسل الجهاز</label>
                                <input type="text" id="asset-serial-number" class="form-input" value="${Utils.escapeHTML(asset?.serialNumber || '')}" placeholder="الرقم المسلسل">
                            </div>
                            <div>
                                <label class="form-label">حالة الجهاز *</label>
                                <select id="asset-status" class="form-input" required>
                                    ${this.statusOptions.map(option => `<option value="${option.value}" ${asset?.status === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="form-label">طريقة تثبيت</label>
                                <input type="text" id="asset-installation-method" class="form-input" value="${Utils.escapeHTML(asset?.installationMethod || '')}" placeholder="مثال: مثبت على الحائط، متحرك">
                            </div>
                            <div>
                                <label class="form-label">الموديل / المواصفات</label>
                                <input type="text" id="asset-model" class="form-input" value="${Utils.escapeHTML(asset?.model || '')}" placeholder="الموديل أو المواصفات">
                            </div>
                            <div>
                                <label class="form-label">تاريخ التركيب</label>
                                <input type="date" id="asset-installation" class="form-input" value="${asset?.installationDate ? new Date(asset.installationDate).toISOString().slice(0, 10) : ''}">
                            </div>
                            <div>
                                <label class="form-label">آخر صيانة</label>
                                <input type="date" id="asset-last-service" class="form-input" value="${asset?.lastServiceDate ? new Date(asset.lastServiceDate).toISOString().slice(0, 10) : ''}">
                            </div>
                            <div>
                                <label class="form-label">المسؤول عن الجهاز</label>
                                <input type="text" id="asset-responsible" class="form-input" value="${Utils.escapeHTML(asset?.responsible || '')}" placeholder="اسم المسؤول أو القسم">
                            </div>
                            <div class="md:col-span-2">
                                <label class="form-label">ملاحظات</label>
                                <textarea id="asset-notes" class="form-input" rows="3" placeholder="أي معلومات إضافية">${Utils.escapeHTML(asset?.notes || '')}</textarea>
                            </div>
                        </div>
                        <div class="flex items-center justify-center gap-3 pt-4 border-t form-actions-centered">
                            <button type="button" class="btn-secondary" onclick="FireEquipment.confirmClose(this)">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? 'حفظ التغييرات' : 'إضافة الجهاز'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        // إزالة الإغلاق التلقائي عند النقر على الخلفية

        const form = modal.querySelector('#fire-asset-form');
        form.addEventListener('submit', async event => {
            event.preventDefault();
            
            // منع النقر المتكرر
            const submitBtn = form?.querySelector('button[type="submit"]');
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

            try {
                const now = new Date().toISOString();

                const assets = this.getAssets();
            const index = assets.findIndex(item => item.id === assetId);

            // إضافة نوع جديد إذا لم يكن موجوداً
            const typeValue = document.getElementById('asset-type').value.trim();
            if (typeValue && !this.assetTypes.includes(typeValue)) {
                this.assetTypes.push(typeValue);
            }

            // Helper function to safely get element value
                const getElementValue = (id) => {
                    const element = document.getElementById(id);
                    return element ? element.value.trim() : '';
                };

                const getElementValueOrNull = (id) => {
                    const element = document.getElementById(id);
                    return element ? element.value.trim() : null;
                };

                // الحصول على بيانات المصنع والموقع الفرعي (ID واسم)
                const factoryId = getElementValue('asset-factory');
                const subLocationId = getElementValue('asset-sub-location');
                const sites = this.getSiteOptions();
                const selectedSite = sites.find(s => s.id === factoryId);
                const places = this.getPlaceOptions(factoryId);
                const selectedPlace = places.find(p => p.id === subLocationId);

                const updatedAsset = {
                id: assetId,
                number: getElementValue('asset-site-number') || assetId,
                siteNumber: getElementValue('asset-site-number') || assetId,
                type: typeValue,
                location: getElementValue('asset-location'),
                subLocation: subLocationId,
                subLocationId: subLocationId ? String(subLocationId).trim() : null,
                subLocationName: selectedPlace ? selectedPlace.name : '',
                manufacturer: getElementValue('asset-manufacturer'),
                factory: factoryId,
                factoryId: factoryId ? String(factoryId).trim() : null,
                factoryName: selectedSite ? selectedSite.name : '',
                model: getElementValue('asset-model'),
                capacity: getElementValue('asset-capacity'),
                capacityKg: getElementValue('asset-capacity'),
                manufacturingYear: (() => {
                    const element = document.getElementById('asset-manufacturing-year');
                    return element && element.value ? parseInt(element.value) : null;
                })(),
                productionDate: (() => {
                    const element = document.getElementById('asset-production-date');
                    return element ? this.toISODate(element.value) : null;
                })(),
                serialNumber: getElementValue('asset-serial-number'),
                installationMethod: getElementValue('asset-installation-method'),
                installationDate: (() => {
                    const element = document.getElementById('asset-installation');
                    return element ? this.toISODate(element.value) : null;
                })(),
                lastServiceDate: (() => {
                    const element = document.getElementById('asset-last-service');
                    return element ? this.toISODate(element.value) : null;
                })(),
                status: getElementValue('asset-status'),
                responsible: getElementValue('asset-responsible'),
                notes: getElementValue('asset-notes'),
                    qrCodeData: asset?.qrCodeData || this.generateQrData(assetId),
                    createdAt: asset?.createdAt || now,
                    updatedAt: now
                };

                // تحديث AppState مباشرة قبل الحفظ في Backend
                // هذا يضمن بقاء البيانات في الواجهة حتى لو فشل التحميل من Backend
                if (index > -1) {
                    assets[index] = { ...assets[index], ...updatedAsset };
                } else {
                    assets.push(updatedAsset);
                }

                // حفظ مباشر في Backend بدلاً من persistAll
                Loading.show();
                
                let backendResult;

                if (GoogleIntegration && AppState.googleConfig?.appsScript?.enabled) {
                    // استخدام saveOrUpdateFireEquipmentAsset للحفظ المباشر
                    backendResult = await GoogleIntegration.sendRequest({
                        action: 'saveOrUpdateFireEquipmentAsset',
                        data: updatedAsset
                    });

                    if (!backendResult.success) {
                        throw new Error(backendResult.message || 'فشل حفظ الجهاز');
                    }

                    Utils.safeLog('✅ تم حفظ الجهاز في Backend:', updatedAsset.id);
                    
                    // بعد الحفظ الناجح في Backend، تحديث AppState بالبيانات المحدثة من Backend
                    // هذا يضمن التطابق مع قاعدة البيانات
                    try {
                        await this.loadAssetsFromBackend();
                    } catch (loadError) {
                        // إذا فشل التحميل، البيانات المحلية تبقى في AppState
                        Utils.safeWarn('⚠️ فشل تحميل البيانات من Backend، سيتم استخدام البيانات المحلية:', loadError);
                    }
                }

                // حفظ محلياً - دائماً بعد تحديث AppState
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                Loading.hide();
                Notification.success(isEdit ? 'تم تحديث بيانات الجهاز' : 'تم إضافة الجهاز بنجاح');
                
                // استعادة الزر بعد النجاح
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
                
                modal.remove();

                // تحديث التبويب الحالي - البيانات موجودة بالفعل في AppState
                if (this.state.currentTab === 'database') {
                    this.renderAssets();
                } else if (this.state.currentTab === 'register') {
                    // استخدام refreshRegisterTable() لتحديث الجدول والكروت الإحصائية
                    await this.refreshRegisterTable();
                } else {
                    // إذا كان التبويب مختلف، تحديث عام
                    await this.refreshCurrentTab();
                }
            } catch (error) {
                Loading.hide();
                Utils.safeError('خطأ في حفظ الجهاز:', error);
                Notification.error('فشل حفظ الجهاز: ' + (error.message || error));
                
                // استعادة الزر في حالة الخطأ
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            }
        });

        // زر إدارة أنواع الأجهزة
        const manageTypesBtn = modal.querySelector('#manage-types-btn');
        if (manageTypesBtn) {
            manageTypesBtn.addEventListener('click', () => {
                this.showManageTypesModal();
            });
        }

        // ربط المصنع بالموقع الفرعي
        setTimeout(() => {
            const factorySelect = modal.querySelector('#asset-factory');
            const subLocationSelect = modal.querySelector('#asset-sub-location');

            if (factorySelect && subLocationSelect) {
                factorySelect.addEventListener('change', () => {
                    const factoryId = factorySelect.value;
                    const places = this.getPlaceOptions(factoryId);

                    // مسح الخيارات الحالية
                    subLocationSelect.innerHTML = '<option value="">اختر الموقع الفرعي</option>';

                    // إضافة الأماكن الجديدة
                    places.forEach(place => {
                        const option = document.createElement('option');
                        option.value = place.id;
                        option.textContent = place.name;
                        subLocationSelect.appendChild(option);
                    });
                });
            }
        }, 100);

        // إزالة الإغلاق التلقائي عند النقر على الخلفية
    },

    /**
     * بدء مسح QR Code للفحص الشهري
     */
    async startQRScan() {
        // التحقق من دعم الكاميرا
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            Notification.error('المتصفح لا يدعم الوصول إلى الكاميرا. يرجى استخدام متصفح حديث.');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <style>
                .qr-scanner-modal {
                    max-width: 95%;
                    width: 100%;
                    max-height: 95vh;
                    overflow-y: auto;
                }
                @media (min-width: 768px) {
                    .qr-scanner-modal {
                        max-width: 650px;
                    }
                }
                #qr-scanner-container {
                    position: relative;
                    width: 100%;
                    max-width: 100%;
                    margin: 0 auto;
                    background: #000;
                    border-radius: 12px;
                    overflow: hidden;
                }
                #qr-video {
                    width: 100%;
                    height: auto;
                    min-height: 300px;
                    max-height: 60vh;
                    object-fit: cover;
                    display: block;
                }
                #qr-scan-overlay {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 70%;
                    max-width: 250px;
                    height: 250px;
                    border: 3px solid #3B82F6;
                    border-radius: 12px;
                    pointer-events: none;
                    animation: pulse-border 2s infinite;
                }
                @keyframes pulse-border {
                    0%, 100% { border-color: #3B82F6; box-shadow: 0 0 20px rgba(59, 130, 246, 0.5); }
                    50% { border-color: #60A5FA; box-shadow: 0 0 30px rgba(96, 165, 250, 0.8); }
                }
                .qr-scan-status {
                    position: absolute;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 500;
                }
                .manual-input-section {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    padding: 20px;
                    border-radius: 12px;
                    margin-top: 20px;
                }
            </style>
            <div class="modal-content qr-scanner-modal">
                <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <h2 class="modal-title" style="font-size: 1.5rem; font-weight: 700; color: white;">
                        <i class="fas fa-qrcode ml-2"></i>
                        مسح QR Code للفحص الشهري
                    </h2>
                    <button class="modal-close" onclick="if(confirm('هل أنت متأكد من إغلاق نافذة المسح؟')) { this.closest('.modal-overlay').remove(); FireEquipment.stopQRScan(); }" style="color: white; font-size: 1.5rem;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div id="qr-scanner-container">
                        <video id="qr-video" autoplay playsinline muted></video>
                        <canvas id="qr-canvas" style="display: none;"></canvas>
                        <div id="qr-scan-overlay"></div>
                        <div class="qr-scan-status">
                            <i class="fas fa-camera ml-2"></i>
                            جاري المسح...
                        </div>
                    </div>
                    <div class="text-center mt-4">
                        <p class="text-base font-semibold text-gray-700 mb-2">
                            <i class="fas fa-info-circle ml-2 text-blue-500"></i>
                            وجّه الكاميرا نحو QR Code المُلصق على الجهاز
                        </p>
                        <p class="text-sm text-gray-500">
                            تأكد من وضوح الإضاءة والتركيز على الكود
                        </p>
                    </div>
                    <div class="manual-input-section">
                        <label class="form-label" style="font-weight: 600; color: #495057; margin-bottom: 10px; display: block;">
                            <i class="fas fa-keyboard ml-2"></i>
                            أو أدخل DeviceID يدوياً:
                        </label>
                        <div class="flex gap-2">
                            <input type="text" id="manual-device-id" class="form-input flex-1" placeholder="مثال: EFA-0001" style="border: 2px solid #667eea; font-size: 1rem; padding: 12px;">
                            <button type="button" id="manual-submit-btn" class="btn-primary" style="padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); white-space: nowrap;">
                                <i class="fas fa-check ml-2"></i>تأكيد
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-2">
                            <i class="fas fa-lightbulb ml-1"></i>
                            التنسيق المتوقع: EFA-0000
                        </p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const video = modal.querySelector('#qr-video');
        const canvas = modal.querySelector('#qr-canvas');
        const context = canvas.getContext('2d');
        let stream = null;
        let scanInterval = null;

        // إزالة الإغلاق التلقائي - سيتم التعامل معه عبر confirmClose

        // زر الإدخال اليدوي
        const manualSubmitBtn = modal.querySelector('#manual-submit-btn');
        const manualDeviceIdInput = modal.querySelector('#manual-device-id');
        const statusEl = modal.querySelector('.qr-scan-status');

        manualSubmitBtn.addEventListener('click', async () => {
            const deviceId = manualDeviceIdInput.value.trim();
            if (!deviceId) {
                Notification.warning('يرجى إدخال DeviceID');
                return;
            }
            this.stopQRScan();
            modal.remove();
            await this.processScannedDeviceId(deviceId);
        });

        // السماح بالإدخال عند الضغط على Enter
        manualDeviceIdInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                manualSubmitBtn.click();
            }
        });

        // بدء الكاميرا
        try {
            // محاولة استخدام الكاميرا الخلفية للهواتف
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;

            if (statusEl) {
                statusEl.innerHTML = '<i class="fas fa-camera ml-2"></i>جاري المسح...';
                statusEl.style.background = 'rgba(34, 197, 94, 0.8)';
            }

            // ضبط حجم Canvas
            video.addEventListener('loadedmetadata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            });

            // بدء المسح
            scanInterval = setInterval(() => {
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

                    if (typeof jsQR !== 'undefined') {
                        const code = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: 'dontInvert'
                        });
                        if (code && code.data) {
                            const deviceId = code.data.trim();
                            if (statusEl) {
                                statusEl.innerHTML = '<i class="fas fa-check-circle ml-2"></i>تم المسح!';
                                statusEl.style.background = 'rgba(34, 197, 94, 0.9)';
                            }
                            this.stopQRScan();
                            setTimeout(() => modal.remove(), 300);
                            this.processScannedDeviceId(deviceId);
                        }
                    }
                }
            }, 100);
        } catch (error) {
            // قمع تحذيرات Permissions Policy - تم إضافة Permissions-Policy في meta tag
            const errorMessage = error?.message || error?.toString() || '';
            const isPermissionsPolicyError = 
                errorMessage.includes('Permissions policy') ||
                errorMessage.includes('Permission policy') ||
                errorMessage.includes('[Violation]') ||
                errorMessage.includes('not allowed in this document');
            
            // استخدام safeError فقط للأخطاء الحقيقية (ليس تحذيرات Permissions Policy)
            if (!isPermissionsPolicyError) {
            Utils.safeError('خطأ في الوصول إلى الكاميرا:', error);
            }
            
            if (statusEl) {
                statusEl.innerHTML = '<i class="fas fa-exclamation-triangle ml-2"></i>فشل الوصول للكاميرا';
                statusEl.style.background = 'rgba(239, 68, 68, 0.8)';
            }
            
            // رسالة مستخدم محسّنة
            if (isPermissionsPolicyError) {
                Notification.warning('يرجى السماح بالوصول إلى الكاميرا في إعدادات المتصفح أو استخدام الإدخال اليدوي.');
            } else {
            Notification.error('فشل الوصول إلى الكاميرا. يرجى السماح بالوصول إلى الكاميرا أو استخدام الإدخال اليدوي.');
            }
        }

        // حفظ مرجع stream للإيقاف لاحقاً
        modal.dataset.stream = 'active';
        window._fireEquipmentStream = stream;
        window._fireEquipmentScanInterval = scanInterval;
    },

    /**
     * إيقاف مسح QR Code
     */
    stopQRScan() {
        if (window._fireEquipmentStream) {
            window._fireEquipmentStream.getTracks().forEach(track => track.stop());
            window._fireEquipmentStream = null;
        }
        if (window._fireEquipmentScanInterval) {
            clearInterval(window._fireEquipmentScanInterval);
            window._fireEquipmentScanInterval = null;
        }
    },

    /**
     * معالجة DeviceID الممسوح
     * @param {string} deviceId - DeviceID المستخرج من QR Code
     */
    async processScannedDeviceId(deviceId) {
        if (!deviceId) {
            Notification.error('DeviceID غير صحيح');
            return;
        }

        Loading.show();
        try {
            // جلب بيانات الجهاز من قاعدة البيانات
            const deviceData = await this.getDeviceDataFromRegister(deviceId);

            if (!deviceData) {
                Notification.error(`لم يتم العثور على جهاز برقم: ${deviceId}`);
                Loading.hide();
                return;
            }

            // عرض بيانات الجهاز
            await this.showDeviceDataFromQR(deviceData);
        } catch (error) {
            console.error('خطأ في معالجة DeviceID:', error);
            Notification.error('حدث خطأ أثناء جلب بيانات الجهاز: ' + error.message);
        } finally {
            Loading.hide();
        }
    },

    /**
     * جلب بيانات الجهاز من Fire Inspection Register عبر DeviceID
     * @param {string} deviceId - DeviceID الفريد للجهاز
     * @returns {object|null} بيانات الجهاز أو null إذا لم يتم العثور عليه
     */
    getDeviceDataFromRegister(deviceId) {
        // البحث في FireEquipmentAssets أولاً
        const asset = this.getAssets().find(a => a.id === deviceId);
        if (!asset) {
            return null;
        }

        // جلب آخر فحص من FireEquipmentInspections
        const latestInspection = this.getLatestInspection(deviceId);

        return {
            deviceId: asset.id,
            deviceNumber: asset.number || asset.id,
            deviceType: asset.type || '',
            location: asset.location || '',
            capacity: asset.capacity || '',
            // بيانات آخر فحص
            lastInspectionDate: latestInspection ? latestInspection.checkDate : null,
            lastInspector: latestInspection ? latestInspection.inspector : '',
            deviceStatus: asset.status || '',
            // بيانات إضافية
            manufacturer: asset.manufacturer || '',
            model: asset.model || '',
            installationDate: asset.installationDate || ''
        };
    },

    /**
     * عرض بيانات الجهاز بعد مسح QR Code
     * @param {object} deviceData - بيانات الجهاز
     */
    async showDeviceDataFromQR(deviceData) {
        // التحقق من أن الجهاز لم يُفحص هذا الشهر
        const canInspect = this.checkMonthlyInspectionAllowed(deviceData.deviceId);
        
        if (!canInspect.allowed) {
            Notification.warning(canInspect.reason || 'لا يمكن إجراء الفحص في هذا الوقت');
            return;
        }

        // التحقق من الصلاحيات - السماح لمراقبي السلامة أيضاً
        const currentUser = AppState.currentUser;
        const isAdmin = currentUser && (
            currentUser.role === 'admin' ||
            currentUser.role === 'مدير النظام' ||
            currentUser.role === 'system_admin' ||
            (typeof Permissions !== 'undefined' && Permissions.isCurrentUserAdmin && Permissions.isCurrentUserAdmin())
        );

        // السماح لمراقبي السلامة مع صلاحية الفحص
        const isSafetyOfficer = currentUser && (
            currentUser.role === 'safety_officer' ||
            currentUser.role === 'مسئول السلامة'
        );
        
        const hasInspectionPermission = typeof Permissions !== 'undefined' && 
            Permissions.hasDetailedPermission && 
            Permissions.hasDetailedPermission('fire-equipment', 'inspections');

        // إذا لم يكن مدير ولا مراقب سلامة مع صلاحية، نعرض رسالة خطأ
        if (!isAdmin && !(isSafetyOfficer && hasInspectionPermission)) {
            // إذا كان المستخدم لديه صلاحية عامة للموديول، نسمح له
            const hasModuleAccess = typeof Permissions !== 'undefined' && 
                Permissions.hasAccess && 
                Permissions.hasAccess('fire-equipment');
            
            if (!hasModuleAccess) {
                Notification.error('هذا الإجراء يتطلب صلاحية فحص معدات الإطفاء. يرجى التواصل مع مدير النظام.');
                return;
            }
        }

        // فتح نموذج الفحص المبسط للموبايل مباشرة
        this.showMobileInspectionForm(null, deviceData.deviceId);
    },

    /**
     * بدء عملية الفحص الشهري (مع التحقق من القيود)
     * @param {string} deviceId - DeviceID للجهاز
     */
    async initiateMonthlyInspection(deviceId) {
        // التحقق من الفحص الشهري
        const canInspect = this.checkMonthlyInspectionAllowed(deviceId);

        if (!canInspect.allowed) {
            Notification.warning(canInspect.reason || 'لا يمكن إجراء الفحص في هذا الوقت');
            return;
        }

        // طلب موافقة المدير
        const approved = await this.requestAdminApproval(deviceId);
        if (!approved) {
            Notification.info('تم إلغاء العملية - مطلوب موافقة المدير');
            return;
        }

        // فتح نموذج الفحص
        this.showInspectionForm(null, deviceId);
    },

    /**
     * التحقق من إمكانية إجراء الفحص الشهري
     * @param {string} deviceId - DeviceID للجهاز
     * @returns {object} {allowed: boolean, reason: string}
     */
    checkMonthlyInspectionAllowed(deviceId) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // البحث عن فحوصات هذا الشهر للجهاز
        const monthlyInspections = this.getInspections().filter(inspection => {
            if (inspection.assetId !== deviceId) return false;
            const inspectionDate = new Date(inspection.checkDate || inspection.createdAt);
            return inspectionDate.getMonth() === currentMonth &&
                inspectionDate.getFullYear() === currentYear;
        });

        // إذا كان هناك فحص في نفس الشهر → منع
        if (monthlyInspections.length > 0) {
            const lastInspection = monthlyInspections[0];
            const lastDate = Utils.formatDate(lastInspection.checkDate || lastInspection.createdAt);
            return {
                allowed: false,
                reason: `تم فحص هذا الجهاز بالفعل في هذا الشهر (${lastDate}). لا يمكن إجراء فحص آخر في نفس الشهر.`
            };
        }

        // إذا لم يُفحص في هذا الشهر → مسموح
        return {
            allowed: true,
            reason: ''
        };
    },

    /**
     * طلب موافقة المدير قبل فتح نموذج الفحص
     * @param {string} deviceId - DeviceID للجهاز
     * @returns {Promise<boolean>} true إذا تمت الموافقة
     */
    async requestAdminApproval(deviceId) {
        return new Promise(async (resolve) => {
            // التحقق من أن المستخدم الحالي هو مدير
            const currentUser = AppState.currentUser;
            const isAdmin = currentUser && (
                currentUser.role === 'admin' ||
                currentUser.role === 'مدير النظام' ||
                (typeof Permissions !== 'undefined' && Permissions.isCurrentUserAdmin && Permissions.isCurrentUserAdmin())
            );

            // إذا كان المستخدم مدير → موافقة تلقائية
            if (isAdmin) {
                resolve(true);
                return;
            }

            // إذا لم يكن مديراً، إنشاء طلب موافقة
            try {
                const asset = this.getAssets().find(a => a.id === deviceId);
                const assetNumber = asset ? (asset.number || asset.id) : deviceId;
                const assetLocation = asset ? (asset.location || '') : '';

                // إنشاء طلب موافقة
                const approvalRequest = await this.createInspectionApprovalRequest(deviceId, assetNumber, assetLocation);

                if (approvalRequest) {
                    Notification.info('تم إرسال طلب الموافقة. سيتم إشعار المدير للمراجعة.');
                    
                    // تحديث الإشعارات
                    if (typeof AppUI !== 'undefined' && AppUI.updateNotificationsBadge) {
                        AppUI.updateNotificationsBadge();
                    }

                    // إرسال إشعار Real-time للمديرين
                    if (typeof RealtimeSyncManager !== 'undefined' && RealtimeSyncManager.notifyChange) {
                        RealtimeSyncManager.notifyChange('fireEquipmentApprovalRequests', 'add', approvalRequest.id);
                    }
                }

                resolve(false); // لا يتم فتح النموذج حتى تتم الموافقة
            } catch (error) {
                Utils.safeError('خطأ في إنشاء طلب الموافقة:', error);
                Notification.error('حدث خطأ أثناء إرسال طلب الموافقة');
            resolve(false);
            }
        });
    },

    /**
     * إنشاء طلب موافقة للفحص الشهري
     * @param {string} deviceId - DeviceID للجهاز
     * @param {string} assetNumber - رقم الجهاز
     * @param {string} assetLocation - موقع الجهاز
     * @returns {Promise<object>} بيانات الطلب
     */
    async createInspectionApprovalRequest(deviceId, assetNumber, assetLocation) {
        const currentUser = AppState.currentUser;
        if (!currentUser) {
            throw new Error('المستخدم غير مسجل دخول');
        }

        const requestId = Utils.generateId('FEAR');
        const now = new Date().toISOString();

        const approvalRequest = {
            id: requestId,
            type: 'inspection',
            assetId: deviceId,
            assetNumber: assetNumber,
            assetLocation: assetLocation,
            requestedBy: currentUser.name || currentUser.email || 'مستخدم غير محدد',
            requestedById: currentUser.id || currentUser.email || '',
            userEmail: currentUser.email || '',
            requestedAt: now,
            status: 'pending',
            comments: `طلب موافقة لإجراء فحص شهري على الجهاز: ${assetNumber}${assetLocation ? ` - ${assetLocation}` : ''}`,
            createdAt: now,
            updatedAt: now
        };

        // حفظ محلياً
        if (!AppState.appData) AppState.appData = {};
        if (!AppState.appData.fireEquipmentApprovalRequests) {
            AppState.appData.fireEquipmentApprovalRequests = [];
        }
        AppState.appData.fireEquipmentApprovalRequests.push(approvalRequest);
        
        // حفظ في localStorage أيضاً
        if (typeof DataManager !== 'undefined' && DataManager.save) {
            DataManager.save();
        } else {
            localStorage.setItem('fire_equipment_approval_requests', JSON.stringify(AppState.appData.fireEquipmentApprovalRequests));
        }

        // ✅ تحديث الإشعارات فوراً بعد الحفظ المحلي
        if (typeof AppUI !== 'undefined' && AppUI.updateNotificationsBadge) {
            AppUI.updateNotificationsBadge();
        }

        // حفظ في Backend (في الخلفية)
        (async () => {
            try {
                if (GoogleIntegration && AppState.googleConfig?.appsScript?.enabled) {
                    const result = await GoogleIntegration.sendRequest({
                        action: 'addFireEquipmentApprovalRequest',
                        data: approvalRequest
                    });

                    if (!result.success) {
                        Utils.safeWarn('⚠️ فشل حفظ الطلب في Backend:', result.message);
                    } else {
                        Utils.safeLog('✅ تم حفظ طلب الموافقة في Backend:', requestId);
                        // تحديث الطلبات بعد الحفظ
                        await this.loadApprovalRequestsFromBackend();
                        // ✅ تحديث الإشعارات مرة أخرى بعد تحميل البيانات من Backend
                        if (typeof AppUI !== 'undefined' && AppUI.updateNotificationsBadge) {
                            AppUI.updateNotificationsBadge();
                        }
                    }
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في حفظ الطلب في Backend:', error);
            }
        })();

        // إرسال إشعارات للمديرين (في الخلفية)
        this.notifyAdminsAboutApprovalRequest(approvalRequest).catch(error => {
            Utils.safeWarn('⚠️ خطأ في إرسال إشعارات للمديرين:', error);
        });

        return approvalRequest;
    },

    /**
     * إرسال إشعارات للمديرين عند إنشاء طلب موافقة جديد
     * @param {object} request - بيانات الطلب
     */
    async notifyAdminsAboutApprovalRequest(request) {
        try {
            // الحصول على قائمة المديرين
            const admins = [];
            if (AppState.appData && AppState.appData.users) {
                admins.push(...AppState.appData.users.filter(user => 
                    user.role === 'admin' || 
                    user.role === 'مدير النظام' ||
                    (typeof Permissions !== 'undefined' && Permissions.isUserAdmin && Permissions.isUserAdmin(user))
                ));
            }

            // إذا لم يتم العثور على مديرين في البيانات المحلية، إرسال إشعار عام
            if (admins.length === 0) {
                // إرسال إشعار عام للمديرين
                if (GoogleIntegration && AppState.googleConfig?.appsScript?.enabled) {
                    await GoogleIntegration.sendRequest({
                        action: 'addNotification',
                        data: {
                            userId: 'admin', // إشعار عام للمديرين
                            title: 'طلب موافقة على فحص معدات الإطفاء',
                            message: `طلب ${request.requestedBy} الموافقة على فحص الجهاز: ${request.assetNumber}${request.assetLocation ? ` - ${request.assetLocation}` : ''}`,
                            type: 'approval_request',
                            priority: 'high',
                            link: '#fire-equipment-approval-requests',
                            data: {
                                module: 'fire-equipment',
                                action: 'inspection_approval',
                                requestId: request.id
                            }
                        }
                    }).catch(error => {
                        Utils.safeWarn('⚠️ فشل إرسال الإشعار:', error);
                    });
                }
            } else {
                // إرسال إشعار لكل مدير
                for (const admin of admins) {
                    if (admin.id || admin.email) {
                        try {
                            if (GoogleIntegration && AppState.googleConfig?.appsScript?.enabled) {
                                await GoogleIntegration.sendRequest({
                                    action: 'addNotification',
                                    data: {
                                        userId: admin.id || admin.email,
                                        title: 'طلب موافقة على فحص معدات الإطفاء',
                                        message: `طلب ${request.requestedBy} الموافقة على فحص الجهاز: ${request.assetNumber}${request.assetLocation ? ` - ${request.assetLocation}` : ''}`,
                                        type: 'approval_request',
                                        priority: 'high',
                                        link: '#fire-equipment-approval-requests',
                                        data: {
                                            module: 'fire-equipment',
                                            action: 'inspection_approval',
                                            requestId: request.id
                                        }
                                    }
                                }).catch(error => {
                                    Utils.safeWarn(`⚠️ فشل إرسال الإشعار للمدير ${admin.name || admin.email}:`, error);
                                });
                            }
                        } catch (error) {
                            Utils.safeWarn(`⚠️ خطأ في إرسال الإشعار للمدير ${admin.name || admin.email}:`, error);
                        }
                    }
                }
            }

            Utils.safeLog('✅ تم إرسال إشعارات للمديرين بخصوص طلب الموافقة:', request.id);
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في إرسال إشعارات الموافقة:', error);
        }
    },

    /**
     * عرض نموذج الفحص الشهري (يُفتح فقط بعد QR Scan وموافقة المدير)
     * @param {object} inspection - بيانات الفحص (للتعديل)
     * @param {string} assetId - DeviceID من QR Scan (مطلوب)
     */
    showInspectionForm(inspection = null, assetId = null) {
        // الفحص الشهري يتم فقط عبر QR Scan
        if (!assetId && !inspection?.assetId) {
            Notification.warning('يجب مسح QR Code أولاً لبدء الفحص الشهري');
            return;
        }

        const isEdit = !!inspection;
        const inspectionId = inspection?.id || Utils.generateId('FEI');
        const targetAssetId = inspection?.assetId || assetId;

        // التحقق من وجود الجهاز
        const asset = this.getAssets().find(a => a.id === targetAssetId);
        if (!asset) {
            Notification.error('لم يتم العثور على بيانات الجهاز');
            return;
        }

        const defaultDate = inspection?.checkDate
            ? new Date(inspection.checkDate).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">${isEdit ? 'تعديل فحص جهاز' : 'تسجيل فحص شهري للجهاز'}</h2>
                    <button class="modal-close" onclick="FireEquipment.confirmClose(this)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="fire-inspection-form" class="space-y-4">
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                            <p class="text-sm text-blue-800">
                                <i class="fas fa-info-circle ml-2"></i>
                                <strong>DeviceID:</strong> ${Utils.escapeHTML(asset.id)} | 
                                <strong>الجهاز:</strong> ${Utils.escapeHTML(asset.number || asset.id)} | 
                                <strong>الموقع:</strong> ${Utils.escapeHTML(asset.location || '-')}
                            </p>
                        </div>
                        <input type="hidden" id="inspection-asset" value="${targetAssetId}">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="form-label">تاريخ الفحص *</label>
                                <input type="date" id="inspection-date" required class="form-input" value="${defaultDate}">
                            </div>
                            <div>
                                <label class="form-label">المفتش *</label>
                                <input type="text" id="inspection-inspector" required class="form-input" value="${Utils.escapeHTML(inspection?.inspector || '')}" placeholder="اسم المفتش">
                            </div>
                            <div>
                                <label class="form-label">الحالة *</label>
                                <select id="inspection-status" class="form-input" required>
                                    ${this.statusOptions.map(option => `<option value="${option.value}" ${inspection?.status === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="form-label">قراءة العداد / الضغط</label>
                                <input type="text" id="inspection-gauge" class="form-input" value="${Utils.escapeHTML(inspection?.gaugeReading || '')}" placeholder="مثال: 150 PSI">
                            </div>
                            <div>
                                <label class="form-label">ختم الأمان</label>
                                <select id="inspection-seal" class="form-input">
                                    <option value="unknown">غير محدد</option>
                                    <option value="true" ${inspection?.sealIntact === true ? 'selected' : ''}>سليم</option>
                                    <option value="false" ${inspection?.sealIntact === false ? 'selected' : ''}>مكسور</option>
                                </select>
                            </div>
                            <div class="md:col-span-2">
                                <label class="form-label">الملاحظات</label>
                                <textarea id="inspection-remarks" class="form-input" rows="3" placeholder="أية ملاحظات إضافية">${Utils.escapeHTML(inspection?.remarks || '')}</textarea>
                            </div>
                            <div class="md:col-span-2">
                                <label class="form-label">الإجراءات المتخذة</label>
                                <textarea id="inspection-actions" class="form-input" rows="2" placeholder="إجراءات الصيانة أو التوصيات">${Utils.escapeHTML(inspection?.actions || '')}</textarea>
                            </div>
                        </div>
                        <div class="flex items-center justify-center gap-3 pt-4 border-t form-actions-centered">
                            <button type="button" class="btn-secondary" onclick="FireEquipment.confirmClose(this)">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? 'حفظ التغييرات' : 'تسجيل الفحص'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const form = modal.querySelector('#fire-inspection-form');
        if (!form) {
            Utils.safeError('❌ لم يتم العثور على النموذج #fire-inspection-form');
            return;
        }

        // منع إرسال متعدد
        let isSubmitting = false;

        form.addEventListener('submit', async event => {
            event.preventDefault();
            event.stopPropagation();

            // منع الإرسال المتعدد
            if (isSubmitting) {
                Utils.safeWarn('⚠️ النموذج قيد المعالجة بالفعل');
                return;
            }

            isSubmitting = true;
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

            try {
                // تعطيل الزر أثناء المعالجة
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري الحفظ...';
                }

            const now = new Date().toISOString();

            // Helper function to safely get element value
            const getElementValue = (id) => {
                const element = document.getElementById(id);
                return element ? element.value.trim() : '';
            };

            const getElementValueOrNull = (id) => {
                const element = document.getElementById(id);
                return element ? element.value : null;
            };

            const assetElement = document.getElementById('inspection-asset');
            const selectedAssetId = (assetElement ? assetElement.value : '') || targetAssetId;
            if (!selectedAssetId) {
                Notification.error('خطأ: DeviceID غير موجود');
                    isSubmitting = false;
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnText;
                    }
                return;
            }

            // التحقق مرة أخرى من الفحص الشهري قبل الحفظ
            if (!isEdit) {
                const canInspect = this.checkMonthlyInspectionAllowed(selectedAssetId);
                if (!canInspect.allowed) {
                    Notification.warning(canInspect.reason || 'لا يمكن إجراء الفحص في هذا الوقت');
                        isSubmitting = false;
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalBtnText;
                        }
                    return;
                }
            }

            const inspectionPayload = {
                id: inspectionId,
                assetId: selectedAssetId,
                checkDate: (() => {
                    const element = document.getElementById('inspection-date');
                    return element ? (this.toISODate(element.value) || now) : now;
                })(),
                inspector: getElementValue('inspection-inspector'),
                status: getElementValue('inspection-status'),
                gaugeReading: getElementValue('inspection-gauge'),
                sealIntact: (() => {
                    const element = document.getElementById('inspection-seal');
                    if (!element) return null;
                    const value = element.value;
                    if (value === 'true') return true;
                    if (value === 'false') return false;
                    return null;
                })(),
                remarks: getElementValue('inspection-remarks'),
                actions: getElementValue('inspection-actions'),
                createdAt: inspection?.createdAt || now,
                updatedAt: now
            };

                // ✅ حفظ الفحص الشهري في FireEquipmentInspections فقط (وليس في Assets)
            if (!AppState.appData.fireEquipmentInspections) {
                AppState.appData.fireEquipmentInspections = [];
            }
            
            const inspections = AppState.appData.fireEquipmentInspections;
            const existingIndex = inspections.findIndex(item => item.id === inspectionId);
            if (existingIndex > -1) {
                inspections[existingIndex] = { ...inspections[existingIndex], ...inspectionPayload };
            } else {
                inspections.push(inspectionPayload);
            }

                // ✅ تحديث حالة الجهاز فقط (lastServiceDate و status) - الفحص نفسه لا يُضاف في Assets
            const asset = this.getAssets().find(item => item.id === selectedAssetId);
            if (asset) {
                    // تحديث تاريخ آخر خدمة وحالة الجهاز فقط
                asset.lastServiceDate = inspectionPayload.checkDate;
                asset.status = inspectionPayload.status;
                asset.updatedAt = now;
                    // ملاحظة: الفحص نفسه (inspectionPayload) يُحفظ فقط في FireEquipmentInspections
                }

                // ✅ حفظ محلياً أولاً (فوري)
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                // ✅ إغلاق النموذج فوراً
                if (modal && modal.parentNode) {
                    modal.remove();
                }

                // ✅ تحديث التبويب فوراً
                this.refreshCurrentTab().catch(err => {
                    Utils.safeError('خطأ في تحديث التبويب:', err);
                });

                // ✅ إظهار رسالة النجاح
                Notification.success(isEdit ? 'تم تحديث بيانات الفحص' : 'تم تسجيل الفحص بنجاح');

                // ✅ المزامنة في الخلفية (بدون انتظار)
                (async () => {
            try {
                if (GoogleIntegration && AppState.googleConfig?.appsScript?.enabled) {
                            // حفظ الفحص في Backend
                    const inspectionResult = await GoogleIntegration.sendRequest({
                        action: isEdit ? 'updateFireEquipmentInspection' : 'addFireEquipmentInspection',
                        data: inspectionPayload
                    });

                    if (!inspectionResult.success) {
                        throw new Error(inspectionResult.message || 'فشل حفظ الفحص');
                    }

                    Utils.safeLog('✅ تم حفظ الفحص في Backend:', inspectionPayload.id);

                    // تحديث asset في Backend إذا تغير status
                    if (asset) {
                        await GoogleIntegration.sendRequest({
                            action: 'saveOrUpdateFireEquipmentAsset',
                            data: asset
                        });
                        Utils.safeLog('✅ تم تحديث حالة الجهاز:', asset.id);
                    }

                            // تحديث التبويب مرة أخرى بعد المزامنة
                            this.refreshCurrentTab().catch(err => {
                                Utils.safeError('خطأ في تحديث التبويب بعد المزامنة:', err);
                            });
                        }
                    } catch (error) {
                        Utils.safeError('خطأ في مزامنة الفحص:', error);
                        // لا نعرض رسالة خطأ للمستخدم لأن النموذج أُغلق بالفعل
                        // يمكن إضافة إشعار خفيف إذا لزم الأمر
                    }
                })();

                // ✅ إعادة تفعيل الزر
                isSubmitting = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            } catch (error) {
                Loading.hide();
                Utils.safeError('خطأ غير متوقع في النموذج:', error);
                Notification.error('حدث خطأ غير متوقع: ' + (error.message || error));
                isSubmitting = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            }
        });

        // إزالة الإغلاق التلقائي عند النقر على الخلفية
    },

    /**
     * واجهة فحص مبسطة للموبايل
     * @param {object} inspection - بيانات الفحص (للتعديل)
     * @param {string} assetId - DeviceID من QR Scan
     */
    showMobileInspectionForm(inspection = null, assetId = null) {
        if (!assetId && !inspection?.assetId) {
            Notification.warning('يجب مسح QR Code أولاً لبدء الفحص الشهري');
            return;
        }

        const isEdit = !!inspection;
        const inspectionId = inspection?.id || Utils.generateId('FEI');
        const targetAssetId = inspection?.assetId || assetId;
        const asset = this.getAssets().find(a => a.id === targetAssetId);
        
        if (!asset) {
            Notification.error('لم يتم العثور على بيانات الجهاز');
            return;
        }

        const defaultDate = inspection?.checkDate
            ? new Date(inspection.checkDate).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <style>
                .mobile-inspection-modal {
                    max-width: 100%;
                    width: 100%;
                    max-height: 100vh;
                    height: 100vh;
                    margin: 0;
                    border-radius: 0;
                    display: flex;
                    flex-direction: column;
                }
                @media (min-width: 768px) {
                    .mobile-inspection-modal {
                        max-width: 600px;
                        max-height: 95vh;
                        height: auto;
                        margin: auto;
                        border-radius: 12px;
                    }
                }
                .mobile-inspection-header {
                    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                    color: white;
                    padding: 1.25rem;
                    border-radius: 0;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                @media (min-width: 768px) {
                    .mobile-inspection-header {
                        border-radius: 12px 12px 0 0;
                    }
                }
                .mobile-inspection-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.25rem;
                    -webkit-overflow-scrolling: touch;
                }
                .mobile-inspection-form-group {
                    margin-bottom: 1.5rem;
                }
                .mobile-inspection-label {
                    display: block;
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 0.5rem;
                    font-size: 0.95rem;
                }
                .mobile-inspection-input {
                    width: 100%;
                    padding: 0.875rem;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 1rem;
                    transition: border-color 0.2s;
                }
                .mobile-inspection-input:focus {
                    outline: none;
                    border-color: #dc2626;
                }
                .mobile-inspection-select {
                    width: 100%;
                    padding: 0.875rem;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 1rem;
                    background: white;
                }
                .mobile-inspection-textarea {
                    width: 100%;
                    padding: 0.875rem;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 1rem;
                    min-height: 100px;
                    resize: vertical;
                }
                .mobile-inspection-actions {
                    position: sticky;
                    bottom: 0;
                    background: white;
                    padding: 1rem;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    gap: 0.75rem;
                }
                .mobile-inspection-btn {
                    flex: 1;
                    padding: 1rem;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 1rem;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .mobile-inspection-btn-primary {
                    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                    color: white;
                }
                .mobile-inspection-btn-secondary {
                    background: #f3f4f6;
                    color: #374151;
                }
                .device-info-card {
                    background: #f9fafb;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                }
                .device-info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.5rem 0;
                    border-bottom: 1px solid #e5e7eb;
                }
                .device-info-row:last-child {
                    border-bottom: none;
                }
                .device-info-label {
                    font-weight: 600;
                    color: #6b7280;
                    font-size: 0.875rem;
                }
                .device-info-value {
                    color: #111827;
                    font-weight: 500;
                }
                @media (max-width: 480px) {
                    .mobile-inspection-body {
                        padding: 1rem;
                    }
                    .mobile-inspection-form-group {
                        margin-bottom: 1.25rem;
                    }
                }
            </style>
            <div class="modal-content mobile-inspection-modal">
                <div class="mobile-inspection-header">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: white;">
                            <i class="fas fa-clipboard-check ml-2"></i>
                            ${isEdit ? 'تعديل فحص' : 'فحص شهري'}
                        </h2>
                        <button class="modal-close" onclick="FireEquipment.confirmClose(this)" style="color: white; font-size: 1.5rem; background: rgba(255,255,255,0.2); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="mobile-inspection-body">
                    <form id="mobile-inspection-form">
                        <div class="device-info-card">
                            <div class="device-info-row">
                                <span class="device-info-label">DeviceID:</span>
                                <span class="device-info-value">${Utils.escapeHTML(asset.id)}</span>
                            </div>
                            <div class="device-info-row">
                                <span class="device-info-label">الجهاز:</span>
                                <span class="device-info-value">${Utils.escapeHTML(asset.number || asset.id)}</span>
                            </div>
                            <div class="device-info-row">
                                <span class="device-info-label">الموقع:</span>
                                <span class="device-info-value">${Utils.escapeHTML(asset.location || '-')}</span>
                            </div>
                            <div class="device-info-row">
                                <span class="device-info-label">النوع:</span>
                                <span class="device-info-value">${Utils.escapeHTML(asset.type || asset.equipmentType || '-')}</span>
                            </div>
                        </div>

                        <input type="hidden" id="mobile-inspection-asset" value="${targetAssetId}">

                        <div class="mobile-inspection-form-group">
                            <label class="mobile-inspection-label">
                                <i class="fas fa-calendar ml-2"></i>
                                تاريخ الفحص *
                            </label>
                            <input type="date" id="mobile-inspection-date" required class="mobile-inspection-input" value="${defaultDate}">
                        </div>

                        <div class="mobile-inspection-form-group">
                            <label class="mobile-inspection-label">
                                <i class="fas fa-user ml-2"></i>
                                اسم المفتش *
                            </label>
                            <input type="text" id="mobile-inspection-inspector" required class="mobile-inspection-input" 
                                   value="${Utils.escapeHTML(inspection?.inspector || '')}" 
                                   placeholder="أدخل اسم المفتش">
                        </div>

                        <div class="mobile-inspection-form-group">
                            <label class="mobile-inspection-label">
                                <i class="fas fa-check-circle ml-2"></i>
                                حالة الجهاز *
                            </label>
                            <select id="mobile-inspection-status" class="mobile-inspection-select" required>
                                ${this.statusOptions.map(option => 
                                    `<option value="${option.value}" ${inspection?.status === option.value ? 'selected' : ''}>${option.label}</option>`
                                ).join('')}
                            </select>
                        </div>

                        <div class="mobile-inspection-form-group">
                            <label class="mobile-inspection-label">
                                <i class="fas fa-gauge ml-2"></i>
                                قراءة العداد / الضغط
                            </label>
                            <input type="text" id="mobile-inspection-gauge" class="mobile-inspection-input" 
                                   value="${Utils.escapeHTML(inspection?.gaugeReading || '')}" 
                                   placeholder="مثال: 150 PSI">
                        </div>

                        <div class="mobile-inspection-form-group">
                            <label class="mobile-inspection-label">
                                <i class="fas fa-shield-alt ml-2"></i>
                                ختم الأمان
                            </label>
                            <select id="mobile-inspection-seal" class="mobile-inspection-select">
                                <option value="unknown">غير محدد</option>
                                <option value="true" ${inspection?.sealIntact === true ? 'selected' : ''}>سليم</option>
                                <option value="false" ${inspection?.sealIntact === false ? 'selected' : ''}>مكسور</option>
                            </select>
                        </div>

                        <div class="mobile-inspection-form-group">
                            <label class="mobile-inspection-label">
                                <i class="fas fa-comment ml-2"></i>
                                الملاحظات
                            </label>
                            <textarea id="mobile-inspection-remarks" class="mobile-inspection-textarea" 
                                      placeholder="أية ملاحظات إضافية عن حالة الجهاز">${Utils.escapeHTML(inspection?.remarks || '')}</textarea>
                        </div>

                        <div class="mobile-inspection-form-group">
                            <label class="mobile-inspection-label">
                                <i class="fas fa-tools ml-2"></i>
                                الإجراءات المتخذة
                            </label>
                            <textarea id="mobile-inspection-actions" class="mobile-inspection-textarea" 
                                      placeholder="إجراءات الصيانة أو التوصيات">${Utils.escapeHTML(inspection?.actions || '')}</textarea>
                        </div>
                    </form>
                </div>
                <div class="mobile-inspection-actions">
                    <button type="button" class="mobile-inspection-btn mobile-inspection-btn-secondary" onclick="FireEquipment.confirmClose(this)">
                        <i class="fas fa-times ml-2"></i>
                        إلغاء
                    </button>
                    <button type="submit" form="mobile-inspection-form" class="mobile-inspection-btn mobile-inspection-btn-primary">
                        <i class="fas fa-save ml-2"></i>
                        ${isEdit ? 'حفظ' : 'تسجيل الفحص'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const form = modal.querySelector('#mobile-inspection-form');
        if (!form) {
            Utils.safeError('❌ لم يتم العثور على النموذج #mobile-inspection-form');
            return;
        }

        // منع إرسال متعدد
        let isSubmitting = false;
        
        form.addEventListener('submit', async event => {
            event.preventDefault();
            event.stopPropagation();

            // منع الإرسال المتعدد
            if (isSubmitting) {
                Utils.safeWarn('⚠️ النموذج قيد المعالجة بالفعل');
                return;
            }

            isSubmitting = true;
            const submitBtn = modal.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
            
            try {
                // تعطيل الزر أثناء المعالجة
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري الحفظ...';
                }

                const now = new Date().toISOString();

                const getElementValue = (id) => {
                    const element = document.getElementById(id);
                    return element ? element.value.trim() : '';
                };

                const assetElement = document.getElementById('mobile-inspection-asset');
                const selectedAssetId = (assetElement ? assetElement.value : '') || targetAssetId;
                
                if (!selectedAssetId) {
                    Notification.error('خطأ: DeviceID غير موجود');
                    isSubmitting = false;
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnText;
                    }
                    return;
                }

                if (!isEdit) {
                    const canInspect = this.checkMonthlyInspectionAllowed(selectedAssetId);
                    if (!canInspect.allowed) {
                        Notification.warning(canInspect.reason || 'لا يمكن إجراء الفحص في هذا الوقت');
                        isSubmitting = false;
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalBtnText;
                        }
                        return;
                    }
                }

                const inspectionPayload = {
                    id: inspectionId,
                    assetId: selectedAssetId,
                    checkDate: (() => {
                        const element = document.getElementById('mobile-inspection-date');
                        return element ? (this.toISODate(element.value) || now) : now;
                    })(),
                    inspector: getElementValue('mobile-inspection-inspector'),
                    status: getElementValue('mobile-inspection-status'),
                    gaugeReading: getElementValue('mobile-inspection-gauge'),
                    sealIntact: (() => {
                        const element = document.getElementById('mobile-inspection-seal');
                        if (!element) return null;
                        const value = element.value;
                        if (value === 'true') return true;
                        if (value === 'false') return false;
                        return null;
                    })(),
                    remarks: getElementValue('mobile-inspection-remarks'),
                    actions: getElementValue('mobile-inspection-actions'),
                    createdAt: inspection?.createdAt || now,
                    updatedAt: now
                };

                // ✅ حفظ الفحص الشهري في FireEquipmentInspections فقط (وليس في Assets)
                if (!AppState.appData.fireEquipmentInspections) {
                    AppState.appData.fireEquipmentInspections = [];
                }
                
                const inspections = AppState.appData.fireEquipmentInspections;
                const existingIndex = inspections.findIndex(item => item.id === inspectionId);
                if (existingIndex > -1) {
                    inspections[existingIndex] = { ...inspections[existingIndex], ...inspectionPayload };
                } else {
                    inspections.push(inspectionPayload);
                }

                // ✅ تحديث حالة الجهاز فقط (lastServiceDate و status) - الفحص نفسه لا يُضاف في Assets
                const asset = this.getAssets().find(item => item.id === selectedAssetId);
                if (asset) {
                    // تحديث تاريخ آخر خدمة وحالة الجهاز فقط
                    asset.lastServiceDate = inspectionPayload.checkDate;
                    asset.status = inspectionPayload.status;
                    asset.updatedAt = now;
                    // ملاحظة: الفحص نفسه (inspectionPayload) يُحفظ فقط في FireEquipmentInspections
                }

                // ✅ حفظ محلياً أولاً (فوري)
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                // ✅ إغلاق النموذج فوراً
                if (modal && modal.parentNode) {
                modal.remove();
                }

                // ✅ تحديث التبويب فوراً
                this.refreshCurrentTab().catch(err => {
                    Utils.safeError('خطأ في تحديث التبويب:', err);
                });

                // ✅ إظهار رسالة النجاح
                Notification.success(isEdit ? 'تم تحديث بيانات الفحص' : 'تم تسجيل الفحص بنجاح');

                // ✅ المزامنة في الخلفية (بدون انتظار)
                (async () => {
                    try {
                        if (GoogleIntegration && AppState.googleConfig?.appsScript?.enabled) {
                            // حفظ الفحص في Backend
                            const inspectionResult = await GoogleIntegration.sendRequest({
                                action: isEdit ? 'updateFireEquipmentInspection' : 'addFireEquipmentInspection',
                                data: inspectionPayload
                            });

                            if (!inspectionResult.success) {
                                throw new Error(inspectionResult.message || 'فشل حفظ الفحص');
                            }

                            Utils.safeLog('✅ تم حفظ الفحص في Backend:', inspectionPayload.id);

                            // تحديث asset في Backend إذا تغير status
                            if (asset) {
                                await GoogleIntegration.sendRequest({
                                    action: 'saveOrUpdateFireEquipmentAsset',
                                    data: asset
                                });
                                Utils.safeLog('✅ تم تحديث حالة الجهاز:', asset.id);
                            }

                            // تحديث التبويب مرة أخرى بعد المزامنة
                            this.refreshCurrentTab().catch(err => {
                                Utils.safeError('خطأ في تحديث التبويب بعد المزامنة:', err);
                            });
                        }
                    } catch (error) {
                        Utils.safeError('خطأ في مزامنة الفحص:', error);
                        // لا نعرض رسالة خطأ للمستخدم لأن النموذج أُغلق بالفعل
                        // يمكن إضافة إشعار خفيف إذا لزم الأمر
                    }
                })();

                // ✅ إعادة تفعيل الزر
                isSubmitting = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            } catch (error) {
                Loading.hide();
                Utils.safeError('خطأ غير متوقع في النموذج:', error);
                Notification.error('حدث خطأ غير متوقع: ' + (error.message || error));
                isSubmitting = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            }
        });
    },

    viewAsset(assetId) {
        const asset = this.getAssets().find(item => item.id === assetId);
        if (!asset) {
            Notification.error('لم يتم العثور على بيانات الجهاز.');
            return;
        }

        const inspections = this.getInspectionsByAsset(assetId);
        const qrImage = typeof QRCode !== 'undefined'
            ? QRCode.generate(asset.qrCodeData || this.generateQrData(asset.id), 200)
            : null;
        const assetJson = JSON.stringify(asset).replace(/"/g, '&quot;');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 820px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">تفاصيل الجهاز ${Utils.escapeHTML(asset.number || '')}</h2>
                    <button class="modal-close" onclick="FireEquipment.closeModal(this)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="content-card">
                            <div class="card-header">
                                <h3 class="card-title"><i class="fas fa-info-circle ml-2"></i>بيانات الجهاز</h3>
                            </div>
                            <div class="card-body space-y-2 text-sm">
                                <p><strong>مكان / موقع الجهاز:</strong> ${Utils.escapeHTML(asset.location || '-')}</p>
                                <p><strong>الموقع الفرعي:</strong> ${Utils.escapeHTML(asset.subLocationName || asset.subLocation || '-')}</p>
                                <p><strong>نوع الجهاز:</strong> ${Utils.escapeHTML(asset.type || '-')}</p>
                                <p><strong>السعة / كجم:</strong> ${Utils.escapeHTML(asset.capacity || asset.capacityKg || '-')}</p>
                                <p><strong>رقم الجهاز بالموقع:</strong> ${Utils.escapeHTML(asset.siteNumber || asset.number || '-')}</p>
                                <p><strong>الشركة المصنعة:</strong> ${Utils.escapeHTML(asset.manufacturer || '-')}</p>
                                <p><strong>المصنع:</strong> ${Utils.escapeHTML(asset.factoryName || asset.factory || '-')}</p>
                                <p><strong>سنة الصنع:</strong> ${asset.manufacturingYear || '-'}</p>
                                <p><strong>تاريخ الانتاج:</strong> ${asset.productionDate ? Utils.formatDate(asset.productionDate) : '-'}</p>
                                <p><strong>رقم مسلسل الجهاز:</strong> ${Utils.escapeHTML(asset.serialNumber || '-')}</p>
                                <p><strong>حالة الجهاز:</strong> ${this.getStatusBadge(asset.status)}</p>
                                <p><strong>طريقة تثبيت:</strong> ${Utils.escapeHTML(asset.installationMethod || '-')}</p>
                                <p><strong>الموديل:</strong> ${Utils.escapeHTML(asset.model || '-')}</p>
                                <p><strong>تاريخ التركيب:</strong> ${asset.installationDate ? Utils.formatDate(asset.installationDate) : '-'}</p>
                                <p><strong>آخر صيانة:</strong> ${asset.lastServiceDate ? Utils.formatDate(asset.lastServiceDate) : '-'}</p>
                                <p><strong>المسؤول:</strong> ${Utils.escapeHTML(asset.responsible || '-')}</p>
                                ${asset.notes ? `<p><strong>ملاحظات:</strong> ${Utils.escapeHTML(asset.notes)}</p>` : ''}
                            </div>
                        </div>
                        <div class="content-card">
                            <div class="card-header">
                                <h3 class="card-title"><i class="fas fa-qrcode ml-2"></i>QR Code للجهاز</h3>
                            </div>
                            <div class="card-body text-center space-y-3">
                                ${qrImage ? `<img src="${qrImage}" alt="QR Code" class="mx-auto h-40 w-40 border border-gray-200 p-2 bg-white">` : '<p class="text-gray-500">لم يتم توليد QR Code</p>'}
                                <div class="flex flex-wrap justify-center gap-2">
                                    <button class="btn-secondary" onclick="FireEquipment.printQr('${asset.id}')">
                                        <i class="fas fa-print ml-2"></i>طباعة QR Code
                                    </button>
                                </div>
                                <p class="text-xs text-gray-500 mt-2">
                                    <i class="fas fa-info-circle ml-1"></i>
                                    للفحص الشهري: استخدم زر "مسح QR Code للفحص الشهري" في الصفحة الرئيسية
                                </p>
                                <p class="text-xs text-gray-400 break-words">${Utils.escapeHTML(asset.qrCodeData || this.generateQrData(asset.id))}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="card-header flex items-center justify-between">
                            <h3 class="card-title"><i class="fas fa-history ml-2"></i>سجل الفحوصات</h3>
                            <span class="text-xs text-gray-400">${inspections.length} فحص</span>
                        </div>
                        <div class="card-body">
                            ${inspections.length ? `
                                <div class="table-wrapper" style="width: 100%; max-width: 100%; overflow-x: auto;">
                                    <table class="data-table text-sm" style="width: 100%; min-width: 100%; table-layout: auto;">
                                        <thead>
                                            <tr>
                                                <th style="min-width: 120px;">التاريخ</th>
                                                <th style="min-width: 120px;">المفتش</th>
                                                <th style="min-width: 100px;">الحالة</th>
                                                <th style="min-width: 200px; word-wrap: break-word;">الملاحظات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${inspections.map(item => `
                                                <tr>
                                                    <td style="word-wrap: break-word; white-space: normal;">${Utils.formatDate(item.checkDate)}</td>
                                                    <td style="word-wrap: break-word; white-space: normal;">${Utils.escapeHTML(item.inspector || '-')}</td>
                                                    <td style="word-wrap: break-word;">${this.getStatusBadge(item.status)}</td>
                                                    <td style="word-wrap: break-word; white-space: normal; max-width: 250px;">${Utils.escapeHTML(item.remarks || '-')}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : '<div class="empty-state"><p class="text-gray-500">لا توجد فحوصات مسجلة لهذا الجهاز.</p></div>'}
                        </div>
                    </div>
                </div>
                <div class="modal-footer flex justify-center gap-2 form-actions-centered">
                    <button class="btn-secondary" onclick="FireEquipment.closeModal(this)">إغلاق</button>
                    <button class="btn-primary" onclick="FireEquipment.showAssetForm(${assetJson}); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>تعديل الجهاز
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // إضافة معالج لإغلاق النموذج عند النقر على الخلفية
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // منع إغلاق النموذج عند النقر على المحتوى
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    },

    getInspectionsByAsset(assetId) {
        return this.getInspections()
            .filter(item => item.assetId === assetId)
            .sort((a, b) => new Date(b.checkDate || b.createdAt || 0) - new Date(a.checkDate || a.createdAt || 0));
    },

    getLatestInspection(assetId) {
        const inspections = this.getInspectionsByAsset(assetId);
        return inspections.length ? inspections[0] : null;
    },

    getAssetStats() {
        const assets = this.getAssets();
        const total = assets.length;
        const active = assets.filter(asset => asset.status === 'صالح').length;
        const needsMaintenance = assets.filter(asset => asset.status && asset.status !== 'صالح').length;
        return { total, active, needsMaintenance };
    },

    /**
     * توليد QR Code Data - يحتوي على DeviceID فقط (ثابت ومُلصق على الجهاز)
     * @param {string} assetId - DeviceID الفريد للجهاز
     * @returns {string} DeviceID فقط
     */
    generateQrData(assetId) {
        // QR Code يحتوي على DeviceID فقط - ثابت ولا يتغير
        return String(assetId || '').trim();
    },

    async persistAll() {
        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }

        // حفظ في Google Sheets - استخدام الطريقة الآمنة
        if (AppState.googleConfig?.appsScript?.enabled) {
            try {
                Utils.safeLog('🔄 بدء حفظ بيانات معدات الحريق...');

                // حفظ Assets - واحد تلو الآخر لتجنب فقدان البيانات
                const assetsPayload = AppState.appData.fireEquipmentAssets || [];
                if (assetsPayload.length > 0) {
                    Utils.safeLog(`📦 حفظ ${assetsPayload.length} جهاز...`);

                    // استخدام saveOrUpdateFireEquipmentAsset بدلاً من saveToSheet
                    const savePromises = assetsPayload.map(async (asset) => {
                        try {
                            await GoogleIntegration.sendRequest({
                                action: 'saveOrUpdateFireEquipmentAsset',
                                data: asset
                            });
                            return { success: true, id: asset.id };
                        } catch (err) {
                            Utils.safeWarn(`⚠️ فشل حفظ الجهاز ${asset.id}:`, err);
                            return { success: false, id: asset.id, error: err };
                        }
                    });

                    const results = await Promise.allSettled(savePromises);
                    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
                    const failCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

                    Utils.safeLog(`✅ تم حفظ ${successCount} جهاز، فشل ${failCount}`);
                }

                // حفظ Inspections - نفس الطريقة
                const inspectionsPayload = AppState.appData.fireEquipmentInspections || [];
                if (inspectionsPayload.length > 0) {
                    Utils.safeLog(`📋 حفظ ${inspectionsPayload.length} فحص...`);

                    // يمكن استخدام saveToSheet للفحوصات لأنها لا تسبب نفس المشكلة
                    await GoogleIntegration.sendRequest({
                        action: 'saveToSheet',
                        data: {
                            sheetName: 'FireEquipmentInspections',
                            data: inspectionsPayload
                        }
                    });
                }

                Utils.safeLog('✅ تم حفظ جميع البيانات بنجاح');
            } catch (error) {
                Utils.safeWarn('⚠️ فشل حفظ بيانات معدات الحريق في Google Sheets:', error);

                // استخدام autoSave كبديل فقط في حالة الفشل
                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                    try {
                        const assetsPayload = AppState.appData.fireEquipmentAssets.map(asset => ({ ...asset }));
                        const inspectionsPayload = AppState.appData.fireEquipmentInspections.map(inspection => ({ ...inspection }));
                        await Promise.allSettled([
                            GoogleIntegration.autoSave('FireEquipmentAssets', assetsPayload),
                            GoogleIntegration.autoSave('FireEquipmentInspections', inspectionsPayload)
                        ]);
                    } catch (fallbackError) {
                        Utils.safeWarn('⚠️ فشل حفظ البيانات حتى باستخدام autoSave:', fallbackError);
                    }
                }
            }
        } else if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
            // إذا لم يكن Google Apps Script مفعّل، نستخدم autoSave
            try {
                const assetsPayload = AppState.appData.fireEquipmentAssets.map(asset => ({ ...asset }));
                const inspectionsPayload = AppState.appData.fireEquipmentInspections.map(inspection => ({ ...inspection }));
                await Promise.allSettled([
                    GoogleIntegration.autoSave('FireEquipmentAssets', assetsPayload),
                    GoogleIntegration.autoSave('FireEquipmentInspections', inspectionsPayload)
                ]);
            } catch (error) {
                Utils.safeWarn('⚠️ فشل حفظ بيانات معدات الحريق في Google Sheets', error);
            }
        }
    },

    printQr(assetId) {
        const asset = this.getAssets().find(item => item.id === assetId);
        if (!asset) {
            Notification.error('لا يمكن العثور على الجهاز المحدد.');
            return;
        }

        const qrData = asset.qrCodeData || this.generateQrData(asset.id);
        const qrImage = typeof QRCode !== 'undefined' ? QRCode.generate(qrData, 240) : null;

        if (!qrImage) {
            Notification.error('تعذر توليد QR Code.');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            Notification.error('يرجى السماح للنوافذ المنبثقة لطباعة QR Code');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>QR Code - ${Utils.escapeHTML(asset.number || asset.id)}</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
                    img { max-width: 320px; margin: 20px auto; display: block; }
                    .info { margin-top: 10px; font-size: 14px; }
                </style>
            </head>
            <body>
                <h2>QR Code لجهاز الإطفاء</h2>
                <p class="info"><strong>رقم الجهاز:</strong> ${Utils.escapeHTML(asset.number || asset.id)}</p>
                <p class="info"><strong>الموقع:</strong> ${Utils.escapeHTML(asset.location || '-')}</p>
                <img src="${qrImage}" alt="QR Code">
                <p class="info">${qrData}</p>
                <script>window.onload = () => window.print();</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },

    toISODate(value) {
        if (!value) return '';
        try {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return '';
            return date.toISOString();
        } catch (error) {
            return '';
        }
    },

    /**
     * عرض نافذة إدارة أنواع الأجهزة
     */
    showManageTypesModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">
                        <i class="fas fa-cog"></i>
                        إدارة أنواع الأجهزة
                    </h2>
                    <button class="modal-close" onclick="FireEquipment.confirmClose(this)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="mb-4">
                        <label class="form-label">إضافة نوع جديد</label>
                        <div class="flex gap-2">
                            <input type="text" id="new-type-input" class="form-input flex-1" placeholder="أدخل نوع الجهاز الجديد">
                            <button type="button" id="add-type-btn" class="btn-primary">
                                <i class="fas fa-plus ml-2"></i>إضافة
                            </button>
                        </div>
                    </div>
                    <div>
                        <label class="form-label">الأنواع الحالية</label>
                        <div id="types-list" class="space-y-2 max-h-64 overflow-y-auto p-3 border rounded">
                            ${this.assetTypes.map((type, index) => `
                                <div class="flex items-center justify-between p-2 bg-gray-50 rounded" data-type-index="${index}">
                                    <span>${Utils.escapeHTML(type)}</span>
                                    <button type="button" class="btn-icon btn-icon-danger btn-remove-type" data-type-index="${index}" title="حذف">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="modal-footer form-actions-centered">
                    <button type="button" class="btn-secondary" onclick="FireEquipment.confirmClose(this)">إغلاق</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // زر إضافة نوع جديد
        const addTypeBtn = modal.querySelector('#add-type-btn');
        const newTypeInput = modal.querySelector('#new-type-input');
        addTypeBtn.addEventListener('click', () => {
            const newType = newTypeInput.value.trim();
            if (!newType) {
                Notification.warning('يرجى إدخال نوع الجهاز');
                return;
            }
            if (this.assetTypes.includes(newType)) {
                Notification.warning('هذا النوع موجود بالفعل');
                return;
            }
            this.assetTypes.push(newType);
            newTypeInput.value = '';
            this.refreshTypesList(modal);
            Notification.success('تم إضافة النوع بنجاح');
        });

        // أزرار حذف الأنواع
        modal.addEventListener('click', (e) => {
            if (e.target.closest('.btn-remove-type')) {
                const index = parseInt(e.target.closest('.btn-remove-type').dataset.typeIndex);
                if (confirm('هل أنت متأكد من حذف هذا النوع؟')) {
                    this.assetTypes.splice(index, 1);
                    this.refreshTypesList(modal);
                    Notification.success('تم حذف النوع بنجاح');
                }
            }
        });

        // إزالة الإغلاق التلقائي عند النقر على الخلفية
    },

    /**
     * تحديث قائمة الأنواع في النافذة
     */
    refreshTypesList(modal) {
        const typesList = modal.querySelector('#types-list');
        if (typesList) {
            typesList.innerHTML = this.assetTypes.map((type, index) => `
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded" data-type-index="${index}">
                    <span>${Utils.escapeHTML(type)}</span>
                    <button type="button" class="btn-icon btn-icon-danger btn-remove-type" data-type-index="${index}" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }
    },

    /**
     * عرض نافذة استيراد Excel
     */
    showImportExcelModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-file-import ml-2"></i>
                        استيراد من ملف Excel
                    </h2>
                    <button class="modal-close" onclick="FireEquipment.confirmClose(this)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="mb-4">
                        <label class="form-label">اختر ملف Excel</label>
                        <input type="file" id="excel-file-input" accept=".xlsx,.xls" class="form-input">
                        <p class="text-xs text-gray-500 mt-2">يجب أن يحتوي الملف على الأعمدة: مكان/موقع الجهاز، الموقع الفرعي، نوع الجهاز، السعة/كجم، رقم الجهاز بالموقع، الشركة المصنعة، المصنع، سنة الصنع، تاريخ الانتاج، رقم مسلسل الجهاز، حالة الجهاز، طريقة تثبيت، ملاحظات</p>
                    </div>
                    <div id="import-preview" class="hidden">
                        <h3 class="text-lg font-semibold mb-2">معاينة البيانات</h3>
                        <div class="table-wrapper" style="width: 100%; max-width: 100%; max-height: 16rem; overflow-x: auto; overflow-y: auto;">
                            <table class="data-table" id="preview-table" style="width: 100%; min-width: 100%; table-layout: auto;">
                                <thead id="preview-head"></thead>
                                <tbody id="preview-body"></tbody>
                            </table>
                        </div>
                        <p class="text-sm text-gray-600 mt-2" id="preview-count"></p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="FireEquipment.confirmClose(this)">إلغاء</button>
                    <button type="button" id="confirm-import-btn" class="btn-primary" disabled>
                        <i class="fas fa-check ml-2"></i>استيراد البيانات
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const fileInput = modal.querySelector('#excel-file-input');
        const confirmBtn = modal.querySelector('#confirm-import-btn');
        const previewContainer = modal.querySelector('#import-preview');
        const previewHead = modal.querySelector('#preview-head');
        const previewBody = modal.querySelector('#preview-body');
        const previewCount = modal.querySelector('#preview-count');
        let importedData = [];

        // تحميل SheetJS إذا لم يكن محملاً
        const loadSheetJS = () => {
            if (typeof XLSX === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                script.onerror = function () {
                    this.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                };
                script.onload = () => {
                    fileInput.addEventListener('change', (e) => {
                        this.handleExcelFile(e.target.files[0], modal, confirmBtn, previewContainer, previewHead, previewBody, previewCount, (data) => {
                            importedData = data;
                        });
                    });
                };
                document.head.appendChild(script);
            } else {
                fileInput.addEventListener('change', (e) => {
                    this.handleExcelFile(e.target.files[0], modal, confirmBtn, previewContainer, previewHead, previewBody, previewCount, (data) => {
                        importedData = data;
                    });
                });
            }
        };

        loadSheetJS();

        confirmBtn.addEventListener('click', async () => {
            if (importedData.length === 0) {
                Notification.error('يرجى تحميل ملف Excel أولاً');
                return;
            }
            await this.processImport(importedData, modal);
        });

        // إزالة الإغلاق التلقائي عند النقر على الخلفية
    },

    /**
     * معالجة ملف Excel
     */
    async handleExcelFile(file, modal, confirmBtn, previewContainer, previewHead, previewBody, previewCount, callback) {
        if (!file) return;

        if (typeof XLSX === 'undefined') {
            Notification.error('مكتبة Excel غير متوفرة. جاري تحميلها...');
            return;
        }

        Loading.show('جاري قراءة الملف...');
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                Notification.error('الملف فارغ أو لا يحتوي على بيانات');
                Loading.hide();
                return;
            }

            // حساب آخر رقم مستخدم حالياً لتوليد أرقام متسلسلة صحيحة
            const assets = this.getAssets();
            const existingNumbers = assets
                .map(a => a.id)
                .filter(id => id && id.match(/^EFA-\d{4}$/))
                .map(id => parseInt(id.split('-')[1]))
                .filter(num => !isNaN(num));

            let nextSequenceNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

            const data = jsonData.map(row => {
                // توليد ID متسلسل بناءً على العداد المحلي للحلقة
                const paddedNumber = String(nextSequenceNumber).padStart(4, '0');
                const assetId = `EFA-${paddedNumber}`;
                nextSequenceNumber++; // زيادة العداد للصف التالي

                return {
                    id: assetId,
                    location: row['مكان / موقع الجهاز'] || row['مكان الجهاز'] || row['الموقع'] || '',
                    subLocation: row['الموقع الفرعي'] || '',
                    type: row['نوع الجهاز'] || '',
                    capacity: row['السعة / كجم'] || row['السعة'] || '',
                    capacityKg: row['السعة / كجم'] || row['السعة'] || '',
                    siteNumber: row['رقم الجهاز بالموقع'] || row['رقم الجهاز'] || '',
                    number: row['رقم الجهاز بالموقع'] || row['رقم الجهاز'] || '',
                    manufacturer: row['الشركة المصنعة'] || '',
                    factory: row['المصنع'] || '',
                    manufacturingYear: row['سنة الصنع'] ? parseInt(row['سنة الصنع']) : null,
                    productionDate: row['تاريخ الانتاج'] ? this.parseDate(row['تاريخ الانتاج']) : '',
                    serialNumber: row['رقم مسلسل الجهاز'] || row['الرقم المسلسل'] || '',
                    status: row['حالة الجهاز'] || 'صالح',
                    installationMethod: row['طريقة تثبيت'] || '',
                    notes: row['ملاحظات'] || '',
                    qrCodeData: this.generateQrData(assetId),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }).filter(item => item.location && item.type);

            if (data.length > 0) {
                const headers = Object.keys(jsonData[0]);
                previewHead.innerHTML = `<tr>${headers.map(h => `<th>${Utils.escapeHTML(h)}</th>`).join('')}</tr>`;
                previewBody.innerHTML = jsonData.slice(0, 5).map(row =>
                    `<tr>${headers.map(h => `<td>${Utils.escapeHTML(String(row[h] || ''))}</td>`).join('')}</tr>`
                ).join('');
                previewCount.textContent = `إجمالي الصفوف المراد استيرادها: ${data.length}`;
                previewContainer.classList.remove('hidden');
                confirmBtn.disabled = false;
                callback(data);
            } else {
                Notification.error('لا توجد بيانات صحيحة للاستيراد');
            }

            Loading.hide();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ أثناء قراءة الملف: ' + error.message);
            console.error(error);
        }
    },

    /**
     * معالجة البيانات المستوردة
     */
    /**
     * معالجة البيانات المستوردة
     */
    async processImport(importedData, modal) {
        if (!importedData || importedData.length === 0) {
            Notification.error('لا توجد بيانات للمعالجة');
            return;
        }

        Loading.show('جاري استيراد البيانات وحفظها في قاعدة البيانات...');
        try {
            let successCount = 0;
            let failCount = 0;
            const total = importedData.length;

            // استخدام Backend للحفظ المباشر
            if (GoogleIntegration && AppState.googleConfig?.appsScript?.enabled) {
                // تقسيم البيانات إلى دفعات صغيرة لتجنب مشاكل الشبكة
                const BATCH_SIZE = 5;

                for (let i = 0; i < total; i += BATCH_SIZE) {
                    const batch = importedData.slice(i, i + BATCH_SIZE);
                    const promises = batch.map(item => {
                        return GoogleIntegration.sendRequest({
                            action: 'saveOrUpdateFireEquipmentAsset',
                            data: item
                        }).then(res => {
                            if (res.success) successCount++;
                            else failCount++;
                            return res;
                        }).catch(err => {
                            failCount++;
                            console.error(`Failed to save asset ${item.id}:`, err);
                            return { success: false, error: err };
                        });
                    });

                    // انتظار انتهاء الدفعة
                    await Promise.allSettled(promises);

                    // تحديث نسبة التقدم
                    const progress = Math.min(100, Math.round(((i + batch.length) / total) * 100));
                    Loading.show(`جاري استيراد البيانات... ${progress}% (${successCount} ناجح)`);
                }

                // إعادة تحميل البيانات بالكامل من Backend لضمان التطابق
                await this.loadAssetsFromBackend();

            } else {
                // Fallback للوضع المحلي (غير متصل)
                // هذا الجزء يعمل فقط في حالة عدم وجود اتصال بالخادم
                const assets = this.getAssets();
                let localUpdates = 0;
                let localAdds = 0;

                importedData.forEach(item => {
                    const existing = assets.find(a => a.id === item.id);
                    if (existing) {
                        Object.assign(existing, item);
                        existing.updatedAt = new Date().toISOString();
                        localUpdates++;
                    } else {
                        assets.push(item);
                        localAdds++;
                    }
                });

                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }
                successCount = localAdds + localUpdates;
            }

            Loading.hide();

            if (failCount > 0) {
                Notification.warning(`تم الاستيراد: ${successCount} ناجح، ${failCount} فشل.`);
            } else {
                Notification.success(`تم استيراد ${successCount} سجل بنجاح.`);
            }

            if (modal) modal.remove();

            // تحديث الواجهة
            if (this.state.currentTab === 'register') {
                const tableContainer = document.getElementById('fire-register-table');
                if (tableContainer) {
                    tableContainer.innerHTML = this.renderRegisterTable();
                    this.bindRegisterTableEvents(tableContainer);
                }
            } else {
                this.renderAssets();
            }

            // تحديث الإحصائيات إذا لزم الأمر
            this.renderStats();

        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ أثناء الاستيراد: ' + error.message);
            console.error(error);
        }
    },

    /**
     * تحويل تاريخ من تنسيقات مختلفة
     */
    parseDate(dateValue) {
        if (!dateValue) return '';
        if (dateValue instanceof Date) {
            return dateValue.toISOString();
        }
        // معالجة Excel serial date مع دعم الوقت (الجزء الكسري)
        if (typeof dateValue === 'number') {
            // Excel يخزن التاريخ كعدد الأيام من 1899-12-30
            // والوقت كجزء كسري من اليوم
            const totalDays = Math.floor(dateValue);
            const timeFraction = dateValue - totalDays;
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
            return date.toISOString();
        }
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            return date.toISOString();
        }
        return '';
    },

    /**
     * تصدير السجل إلى Excel
     */
    exportToExcel() {
        if (typeof XLSX === 'undefined') {
            Notification.error('مكتبة Excel غير متوفرة. جاري تحميلها...');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
            script.onerror = function () {
                this.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            };
            script.onload = () => this.exportToExcel();
            document.head.appendChild(script);
            return;
        }

        Loading.show('جاري تصدير البيانات...');
        try {
            const assets = this.getAssets();
            const data = assets.map(asset => ({
                'المصنع': asset.factoryName || asset.factory || '',
                'الموقع الفرعي': asset.subLocationName || asset.subLocation || '',
                'مكان / موقع الجهاز': asset.location || '',
                'نوع الجهاز': asset.type || '',
                'السعة / كجم': asset.capacity || asset.capacityKg || '',
                'رقم الجهاز بالموقع': asset.siteNumber || asset.number || '',
                'الشركة المصنعة': asset.manufacturer || '',
                'سنة الصنع': asset.manufacturingYear || '',
                'رقم مسلسل الجهاز': asset.serialNumber || '',
                'حالة الجهاز': asset.status || '',
                'طريقة تثبيت': asset.installationMethod || '',
                'ملاحظات': asset.notes || ''
            }));

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل معدات الاطفاء');

            const fileName = `سجل_معدات_الاطفاء_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, fileName);

            Loading.hide();
            Notification.success('تم تصدير البيانات بنجاح');
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ أثناء التصدير: ' + error.message);
            console.error(error);
        }
    },

    /**
     * تصدير السجل إلى PDF
     */
    async exportRegisterToPDF() {
        const assets = this.getAssets();
        if (assets.length === 0) {
            Notification.warning('لا توجد بيانات للتصدير');
            return;
        }

        Loading.show('جاري إنشاء PDF...');
        try {
            // استخدام window.print() إذا لم تكن مكتبة jsPDF متوفرة
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
                Loading.hide();
                return;
            }

            const rows = assets.map(asset => `
                <tr>
                    <td>${Utils.escapeHTML(asset.factoryName || asset.factory || '-')}</td>
                    <td>${Utils.escapeHTML(asset.subLocationName || asset.subLocation || '-')}</td>
                    <td>${Utils.escapeHTML(asset.location || '-')}</td>
                    <td>${Utils.escapeHTML(asset.type || '-')}</td>
                    <td>${Utils.escapeHTML(asset.capacity || asset.capacityKg || '-')}</td>
                    <td>${Utils.escapeHTML(asset.siteNumber || asset.number || '-')}</td>
                    <td>${Utils.escapeHTML(asset.manufacturer || '-')}</td>
                    <td>${Utils.escapeHTML(asset.manufacturingYear || '-')}</td>
                    <td>${Utils.escapeHTML(asset.serialNumber || '-')}</td>
                    <td>${Utils.escapeHTML(asset.status || '-')}</td>
                    <td>${Utils.escapeHTML(asset.installationMethod || '-')}</td>
                    <td>${Utils.escapeHTML(asset.notes || '-')}</td>
                </tr>
            `).join('');

            const htmlContent = `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="UTF-8">
                    <title>سجل معدات الاطفاء والانذار</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            direction: rtl;
                            padding: 20px;
                        }
                        h1 {
                            text-align: center;
                            margin-bottom: 20px;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 20px;
                            font-size: 11px;
                        }
                        th, td {
                            border: 1px solid #ddd;
                            padding: 8px;
                            text-align: right;
                        }
                        th {
                            background-color: #3b82f6;
                            color: white;
                            font-weight: bold;
                        }
                        tr:nth-child(even) {
                            background-color: #f9fafb;
                        }
                        @media print {
                            body { padding: 10px; }
                            table { font-size: 9px; }
                            th, td { padding: 5px; }
                        }
                    </style>
                </head>
                <body>
                    <h1>سجل معدات الاطفاء والانذار</h1>
                    <p style="text-align: center;">تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>المصنع</th>
                                <th>الموقع الفرعي</th>
                                <th>مكان / موقع الجهاز</th>
                                <th>نوع الجهاز</th>
                                <th>السعة / كجم</th>
                                <th>رقم الجهاز بالموقع</th>
                                <th>الشركة المصنعة</th>
                                <th>سنة الصنع</th>
                                <th>رقم مسلسل الجهاز</th>
                                <th>حالة الجهاز</th>
                                <th>طريقة تثبيت</th>
                                <th>ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                    <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
                </body>
                </html>
            `;

            printWindow.document.write(htmlContent);
            printWindow.document.close();

            Loading.hide();
            Notification.success('تم إنشاء PDF بنجاح');
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ أثناء إنشاء PDF: ' + error.message);
            console.error(error);
        }
    },

    /**
     * التحقق من أن المستخدم الحالي هو مدير النظام
     */
    isAdmin() {
        if (typeof Permissions !== 'undefined' && typeof Permissions.isCurrentUserEffectiveAdmin === 'function') {
            return Permissions.isCurrentUserEffectiveAdmin();
        }
        const currentUser = (typeof AppState !== 'undefined' && AppState) ? AppState.currentUser : null;
        return !!(currentUser && (
            currentUser.role === 'admin' ||
            currentUser.role === 'مدير النظام' ||
            currentUser.role === 'system_admin' ||
            (currentUser.permissions && (currentUser.permissions.admin === true || currentUser.permissions['manage-modules'] === true))
        ));
    },

    /**
     * التحقق من صلاحية الوصول لتبويب معين
     */
    hasTabAccess(tabName) {
        const user = (typeof AppState !== 'undefined' && AppState) ? AppState.currentUser : null;

        // عند عدم توفر المستخدم بعد (تحميل متأخر)، إظهار التبويب الأساسي لتجنب واجهة فارغة
        if (!user) return tabName === 'database';

        // المدير لديه صلاحيات كاملة
        if (this.isAdmin()) return true;

        // التحقق من الصلاحيات التفصيلية
        if (typeof Permissions !== 'undefined') {
            return Permissions.hasDetailedPermission('fire-equipment', tabName);
        }

        // افتراضياً، نعطي الوصول (للتوافق مع المستخدمين القدامى)
        return true;
    },

    /**
     * التحقق من صلاحية المستخدم للإضافة
     */
    canAdd() {
        const user = (typeof AppState !== 'undefined' && AppState) ? AppState.currentUser : null;

        if (!user) return false;

        // المدير لديه صلاحيات كاملة
        if (this.isAdmin()) return true;

        // التحقق من الصلاحيات المخصصة
        const permissions = user.permissions?.fireEquipment || {};
        return permissions.add === true || permissions.edit === true;
    },

    /**
     * التحقق من صلاحية المستخدم للتعديل
     */
    canEdit() {
        const user = (typeof AppState !== 'undefined' && AppState) ? AppState.currentUser : null;

        if (!user) return false;

        // المدير لديه صلاحيات كاملة
        if (this.isAdmin()) return true;

        // التحقق من الصلاحيات المخصصة
        const permissions = user.permissions?.fireEquipment || {};
        return permissions.edit === true;
    },

    /**
     * التحقق من صلاحية المستخدم للحذف
     */
    canDelete() {
        const user = (typeof AppState !== 'undefined' && AppState) ? AppState.currentUser : null;

        if (!user) return false;

        // المدير لديه صلاحيات كاملة
        if (this.isAdmin()) return true;

        // التحقق من الصلاحيات المخصصة
        const permissions = user.permissions?.fireEquipment || {};
        return permissions.delete === true;
    },

    /**
     * حذف جهاز
     */
    async deleteAsset(assetId) {
        if (!this.canDelete()) {
            Notification.error('ليس لديك صلاحية لحذف الأجهزة. يجب أن تكون مدير النظام أو لديك صلاحية الحذف.');
            return;
        }

        const asset = this.getAssets().find(a => a.id === assetId);
        if (!asset) {
            Notification.error('لم يتم العثور على الجهاز');
            return;
        }

        const confirmed = confirm(`هل أنت متأكد من حذف الجهاز "${asset.number || assetId}"؟\n\nسيتم حذف الجهاز وجميع الفحوصات المرتبطة به نهائياً.`);
        if (!confirmed) return;

        Loading.show();
        try {
            // ✅ حذف من Google Sheets أولاً (قبل الحذف المحلي)
            let deleteSuccess = false;
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                try {
                    const deleteResult = await GoogleIntegration.sendRequest({
                        action: 'deleteFireEquipment',
                        data: { assetId: assetId }
                    });

                    if (deleteResult && deleteResult.success) {
                        deleteSuccess = true;
                        Utils.safeLog('✅ تم حذف الجهاز من Backend بنجاح');
                    } else {
                        const errorMsg = deleteResult?.message || 'فشل حذف الجهاز من Backend';
                        Utils.safeWarn('⚠️ فشل حذف الجهاز من Backend:', errorMsg);
                        // استمرار الحذف المحلي حتى لو فشل Backend
                    }
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في حذف الجهاز من Backend:', error);
                    // استمرار الحذف المحلي حتى لو فشل Backend
                }
            } else {
                // إذا لم يكن Backend متاحاً، نعتبر الحذف ناجحاً محلياً
                deleteSuccess = true;
            }

            // ✅ حذف من القائمة المحلية
            const assets = this.getAssets();
            const assetIndex = assets.findIndex(a => a.id === assetId);
            if (assetIndex > -1) {
                assets.splice(assetIndex, 1);
            }

            // ✅ حذف الفحوصات المرتبطة
            const inspections = this.getInspections();
            const relatedInspections = inspections.filter(ins => ins.assetId === assetId);
            relatedInspections.forEach(ins => {
                const insIndex = inspections.findIndex(i => i.id === ins.id);
                if (insIndex > -1) {
                    inspections.splice(insIndex, 1);
                }
            });

            // ✅ حذف طلبات الموافقة المرتبطة (إن وجدت)
            if (AppState.appData && AppState.appData.fireEquipmentApprovalRequests) {
                const approvalRequests = AppState.appData.fireEquipmentApprovalRequests;
                const relatedRequests = approvalRequests.filter(req => req.assetId === assetId);
                relatedRequests.forEach(req => {
                    const reqIndex = approvalRequests.findIndex(r => r.id === req.id);
                    if (reqIndex > -1) {
                        approvalRequests.splice(reqIndex, 1);
                    }
                });
            }

            // ✅ حفظ التغييرات محلياً (بدون مزامنة مع Backend)
            if (!AppState.appData) AppState.appData = {};
            AppState.appData.fireEquipmentAssets = assets;
            AppState.appData.fireEquipmentInspections = inspections;
            
            // حفظ في localStorage مباشرة (بدون استدعاء persistAll الذي قد يزامن مع Backend)
            if (typeof DataManager !== 'undefined' && DataManager.save) {
                DataManager.save();
            } else {
                localStorage.setItem('fire_equipment_assets', JSON.stringify(assets));
                localStorage.setItem('fire_equipment_inspections', JSON.stringify(inspections));
            }

            Utils.safeLog('✅ تم حذف الجهاز محلياً');

            Notification.success('تم حذف الجهاز بنجاح');

            // ✅ تحديث التبويب الحالي (بدون إعادة تحميل من Backend)
            // skipSync = true يمنع إعادة تحميل البيانات من Backend
            await this.refreshCurrentTab(true);

            // ✅ منع المزامنة التلقائية بعد الحذف
            // لا نستدعي loadFireEquipmentDataAsync() أو أي دالة تحميل من Backend
            // لأن ذلك قد يعيد الجهاز المحذوف إذا لم يتم حذفه من Backend بشكل صحيح
            
            // ✅ تحديث الإحصائيات والفلترة بعد الحذف
            if (this.state.currentTab === 'database') {
                this.refreshFilterOptions();
                this.renderSummary();
            } else if (this.state.currentTab === 'register') {
                this.updateRegisterStatisticsCards();
            }
            
        } catch (error) {
            Utils.safeError('❌ خطأ في حذف الجهاز:', error);
            Notification.error('حدث خطأ أثناء حذف الجهاز');
        } finally {
            Loading.hide();
        }
    },

    /**
     * عرض تبويب تحليل البيانات (للمدير فقط)
     */
    async renderAnalyticsTab() {
        if (!this.isAdmin()) {
            return '<div class="empty-state"><p class="text-gray-500">ليس لديك صلاحية للوصول إلى هذا القسم</p></div>';
        }

        return `
            <div class="space-y-6">
                <!-- فلترة الفترة الزمنية -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-filter ml-2"></i>
                            فلترة البيانات
                        </h2>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label class="form-label">من تاريخ</label>
                                <input type="date" id="analytics-date-from" class="form-input">
                            </div>
                            <div>
                                <label class="form-label">إلى تاريخ</label>
                                <input type="date" id="analytics-date-to" class="form-input">
                            </div>
                            <div>
                                <label class="form-label">نوع الجهاز</label>
                                <select id="analytics-type-filter" class="form-input">
                                    <option value="all">جميع الأنواع</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label">الموقع</label>
                                <select id="analytics-location-filter" class="form-input">
                                    <option value="all">جميع المواقع</option>
                                </select>
                            </div>
                        </div>
                        <div class="mt-4 flex gap-2">
                            <button id="analytics-apply-filters" class="btn-primary">
                                <i class="fas fa-search ml-2"></i>
                                تطبيق الفلترة
                            </button>
                            <button id="analytics-reset-filters" class="btn-secondary">
                                <i class="fas fa-redo ml-2"></i>
                                إعادة تعيين
                            </button>
                            <button id="analytics-export-data" class="btn-secondary">
                                <i class="fas fa-download ml-2"></i>
                                تصدير البيانات
                            </button>
                        </div>
                    </div>
                </div>

                <!-- إحصائيات عامة -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="content-card">
                        <div class="text-center">
                            <i class="fas fa-fire-extinguisher text-4xl text-blue-600 mb-2"></i>
                            <p class="text-sm text-gray-500">إجمالي الأجهزة</p>
                            <p class="text-3xl font-bold" id="analytics-total-assets">0</p>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="text-center">
                            <i class="fas fa-check-circle text-4xl text-green-600 mb-2"></i>
                            <p class="text-sm text-gray-500">أجهزة صالحة</p>
                            <p class="text-3xl font-bold text-green-600" id="analytics-active-assets">0</p>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="text-center">
                            <i class="fas fa-tools text-4xl text-yellow-600 mb-2"></i>
                            <p class="text-sm text-gray-500">بحاجة صيانة</p>
                            <p class="text-3xl font-bold text-yellow-600" id="analytics-maintenance-assets">0</p>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="text-center">
                            <i class="fas fa-times-circle text-4xl text-red-600 mb-2"></i>
                            <p class="text-sm text-gray-500">خارج الخدمة</p>
                            <p class="text-3xl font-bold text-red-600" id="analytics-out-service-assets">0</p>
                        </div>
                    </div>
                </div>

                <!-- إحصائيات الفحوصات -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="content-card">
                        <div class="text-center">
                            <i class="fas fa-clipboard-check text-4xl text-blue-600 mb-2"></i>
                            <p class="text-sm text-gray-500">إجمالي الفحوصات</p>
                            <p class="text-3xl font-bold" id="analytics-total-inspections">0</p>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="text-center">
                            <i class="fas fa-check-double text-4xl text-green-600 mb-2"></i>
                            <p class="text-sm text-gray-500">فحوصات مكتملة</p>
                            <p class="text-3xl font-bold text-green-600" id="analytics-completed-inspections">0</p>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="text-center">
                            <i class="fas fa-exclamation-triangle text-4xl text-yellow-600 mb-2"></i>
                            <p class="text-sm text-gray-500">فحوصات تحتاج صيانة</p>
                            <p class="text-3xl font-bold text-yellow-600" id="analytics-maintenance-inspections">0</p>
                        </div>
                    </div>
                    <div class="content-card">
                        <div class="text-center">
                            <i class="fas fa-percentage text-4xl text-purple-600 mb-2"></i>
                            <p class="text-sm text-gray-500">نسبة الاكتمال</p>
                            <p class="text-3xl font-bold text-purple-600" id="analytics-completion-rate">0%</p>
                        </div>
                    </div>
                </div>

                <!-- تحليل حسب النوع -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-chart-pie ml-2"></i>
                            تحليل حسب نوع الجهاز
                        </h2>
                    </div>
                    <div class="card-body">
                        <div id="analytics-by-type-table"></div>
                    </div>
                </div>

                <!-- تحليل حسب الموقع -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-map-marker-alt ml-2"></i>
                            تحليل حسب الموقع
                        </h2>
                    </div>
                    <div class="card-body">
                        <div id="analytics-by-location-table"></div>
                    </div>
                </div>

                <!-- تحليل زمني للفحوصات -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-chart-line ml-2"></i>
                            تحليل زمني للفحوصات
                        </h2>
                    </div>
                    <div class="card-body">
                        <div id="analytics-timeline-table"></div>
                    </div>
                </div>

                <!-- تحليل المفتشين -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-user-check ml-2"></i>
                            تحليل حسب المفتش
                        </h2>
                    </div>
                    <div class="card-body">
                        <div id="analytics-by-inspector-table"></div>
                    </div>
                </div>

                <!-- تحليل الحالة -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-chart-bar ml-2"></i>
                            تحليل حسب الحالة
                        </h2>
                    </div>
                    <div class="card-body">
                        <div id="analytics-by-status-table"></div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * جمع وتحليل البيانات
     */
    getAnalyticsData(filters = {}) {
        const assets = this.getAssets();
        const inspections = this.getInspections();

        // تطبيق الفلترة على الفحوصات
        let filteredInspections = inspections;
        if (filters.dateFrom || filters.dateTo) {
            filteredInspections = inspections.filter(inspection => {
                const inspectionDate = new Date(inspection.checkDate || inspection.createdAt);
                if (filters.dateFrom && inspectionDate < new Date(filters.dateFrom)) return false;
                if (filters.dateTo) {
                    const toDate = new Date(filters.dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (inspectionDate > toDate) return false;
                }
                return true;
            });
        }

        // تطبيق الفلترة على الأجهزة
        let filteredAssets = assets;
        if (filters.type && filters.type !== 'all') {
            filteredAssets = filteredAssets.filter(asset => asset.type === filters.type);
        }
        if (filters.location && filters.location !== 'all') {
            filteredAssets = filteredAssets.filter(asset => asset.location === filters.location);
        }

        // إحصائيات الأجهزة
        const assetStats = {
            total: filteredAssets.length,
            active: filteredAssets.filter(a => a.status === 'صالح').length,
            needsMaintenance: filteredAssets.filter(a => a.status === 'يحتاج صيانة').length,
            outOfService: filteredAssets.filter(a => a.status === 'خارج الخدمة').length
        };

        // إحصائيات الفحوصات
        const inspectionStats = {
            total: filteredInspections.length,
            completed: filteredInspections.filter(i => i.status === 'صالح').length,
            needsMaintenance: filteredInspections.filter(i => i.status === 'يحتاج صيانة').length,
            outOfService: filteredInspections.filter(i => i.status === 'خارج الخدمة').length,
            completionRate: filteredInspections.length > 0
                ? ((filteredInspections.filter(i => i.status === 'صالح').length / filteredInspections.length) * 100).toFixed(1)
                : 0
        };

        // تحليل حسب النوع
        const byType = {};
        filteredAssets.forEach(asset => {
            const type = asset.type || 'غير محدد';
            if (!byType[type]) {
                byType[type] = { total: 0, active: 0, needsMaintenance: 0, outOfService: 0 };
            }
            byType[type].total++;
            if (asset.status === 'صالح') byType[type].active++;
            else if (asset.status === 'يحتاج صيانة') byType[type].needsMaintenance++;
            else if (asset.status === 'خارج الخدمة') byType[type].outOfService++;
        });

        // تحليل حسب الموقع
        const byLocation = {};
        filteredAssets.forEach(asset => {
            const location = asset.location || 'غير محدد';
            if (!byLocation[location]) {
                byLocation[location] = { total: 0, active: 0, needsMaintenance: 0, outOfService: 0 };
            }
            byLocation[location].total++;
            if (asset.status === 'صالح') byLocation[location].active++;
            else if (asset.status === 'يحتاج صيانة') byLocation[location].needsMaintenance++;
            else if (asset.status === 'خارج الخدمة') byLocation[location].outOfService++;
        });

        // تحليل زمني للفحوصات (حسب الشهر)
        const byMonth = {};
        filteredInspections.forEach(inspection => {
            const date = new Date(inspection.checkDate || inspection.createdAt);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthLabel = date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' });
            if (!byMonth[monthKey]) {
                byMonth[monthKey] = { label: monthLabel, total: 0, completed: 0, needsMaintenance: 0, outOfService: 0 };
            }
            byMonth[monthKey].total++;
            if (inspection.status === 'صالح') byMonth[monthKey].completed++;
            else if (inspection.status === 'يحتاج صيانة') byMonth[monthKey].needsMaintenance++;
            else if (inspection.status === 'خارج الخدمة') byMonth[monthKey].outOfService++;
        });

        // تحليل حسب المفتش
        const byInspector = {};
        filteredInspections.forEach(inspection => {
            const inspector = inspection.inspector || 'غير محدد';
            if (!byInspector[inspector]) {
                byInspector[inspector] = { total: 0, completed: 0, needsMaintenance: 0, outOfService: 0 };
            }
            byInspector[inspector].total++;
            if (inspection.status === 'صالح') byInspector[inspector].completed++;
            else if (inspection.status === 'يحتاج صيانة') byInspector[inspector].needsMaintenance++;
            else if (inspection.status === 'خارج الخدمة') byInspector[inspector].outOfService++;
        });

        // تحليل حسب الحالة
        const byStatus = {
            'صالح': filteredInspections.filter(i => i.status === 'صالح').length,
            'يحتاج صيانة': filteredInspections.filter(i => i.status === 'يحتاج صيانة').length,
            'خارج الخدمة': filteredInspections.filter(i => i.status === 'خارج الخدمة').length
        };

        return {
            assetStats,
            inspectionStats,
            byType,
            byLocation,
            byMonth,
            byInspector,
            byStatus
        };
    },

    /**
     * عرض بيانات التحليل
     */
    renderAnalyticsData() {
        if (!this.isAdmin()) return;

        // التحقق من وجود تبويب التحليل في DOM
        const analyticsTab = document.getElementById('fire-tab-content');
        if (!analyticsTab || this.state.currentTab !== 'analytics') {
            return; // التبويب غير موجود أو غير نشط
        }

        // جمع الفلاتر
        const dateFrom = document.getElementById('analytics-date-from')?.value || '';
        const dateTo = document.getElementById('analytics-date-to')?.value || '';
        const typeFilter = document.getElementById('analytics-type-filter')?.value || 'all';
        const locationFilter = document.getElementById('analytics-location-filter')?.value || 'all';

        const filters = {
            dateFrom,
            dateTo,
            type: typeFilter,
            location: locationFilter
        };

        const analytics = this.getAnalyticsData(filters);

        // تحديث الإحصائيات العامة - مع فحص وجود العناصر
        const totalAssetsEl = document.getElementById('analytics-total-assets');
        if (totalAssetsEl) totalAssetsEl.textContent = analytics.assetStats.total;

        const activeAssetsEl = document.getElementById('analytics-active-assets');
        if (activeAssetsEl) activeAssetsEl.textContent = analytics.assetStats.active;

        const maintenanceAssetsEl = document.getElementById('analytics-maintenance-assets');
        if (maintenanceAssetsEl) maintenanceAssetsEl.textContent = analytics.assetStats.needsMaintenance;

        const outServiceAssetsEl = document.getElementById('analytics-out-service-assets');
        if (outServiceAssetsEl) outServiceAssetsEl.textContent = analytics.assetStats.outOfService;

        const totalInspectionsEl = document.getElementById('analytics-total-inspections');
        if (totalInspectionsEl) totalInspectionsEl.textContent = analytics.inspectionStats.total;

        const completedInspectionsEl = document.getElementById('analytics-completed-inspections');
        if (completedInspectionsEl) completedInspectionsEl.textContent = analytics.inspectionStats.completed;

        const maintenanceInspectionsEl = document.getElementById('analytics-maintenance-inspections');
        if (maintenanceInspectionsEl) maintenanceInspectionsEl.textContent = analytics.inspectionStats.needsMaintenance;

        const completionRateEl = document.getElementById('analytics-completion-rate');
        if (completionRateEl) completionRateEl.textContent = analytics.inspectionStats.completionRate + '%';

        // عرض تحليل حسب النوع
        const byTypeTableEl = document.getElementById('analytics-by-type-table');
        if (byTypeTableEl) {
            const byTypeTable = this.renderAnalyticsTable(analytics.byType, ['النوع', 'الإجمالي', 'صالح', 'يحتاج صيانة', 'خارج الخدمة']);
            byTypeTableEl.innerHTML = byTypeTable;
        }

        // عرض تحليل حسب الموقع
        const byLocationTableEl = document.getElementById('analytics-by-location-table');
        if (byLocationTableEl) {
            const byLocationTable = this.renderAnalyticsTable(analytics.byLocation, ['الموقع', 'الإجمالي', 'صالح', 'يحتاج صيانة', 'خارج الخدمة']);
            byLocationTableEl.innerHTML = byLocationTable;
        }

        // عرض التحليل الزمني
        const timelineTableEl = document.getElementById('analytics-timeline-table');
        if (timelineTableEl) {
            const timelineTable = this.renderTimelineTable(analytics.byMonth);
            timelineTableEl.innerHTML = timelineTable;
        }

        // عرض تحليل حسب المفتش
        const byInspectorTableEl = document.getElementById('analytics-by-inspector-table');
        if (byInspectorTableEl) {
            const byInspectorTable = this.renderAnalyticsTable(analytics.byInspector, ['المفتش', 'الإجمالي', 'مكتمل', 'يحتاج صيانة', 'خارج الخدمة'], ['total', 'completed', 'needsMaintenance', 'outOfService']);
            byInspectorTableEl.innerHTML = byInspectorTable;
        }

        // عرض تحليل حسب الحالة
        const byStatusTableEl = document.getElementById('analytics-by-status-table');
        if (byStatusTableEl) {
            const byStatusTable = this.renderStatusTable(analytics.byStatus);
            byStatusTableEl.innerHTML = byStatusTable;
        }
    },

    /**
     * عرض جدول تحليلي
     */
    renderAnalyticsTable(data, headers, keys = ['total', 'active', 'needsMaintenance', 'outOfService']) {
        if (!data || Object.keys(data).length === 0) {
            return '<div class="empty-state"><p class="text-gray-500">لا توجد بيانات للعرض</p></div>';
        }

        const rows = Object.entries(data)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([key, stats]) => {
                return `
                    <tr>
                        <td class="font-semibold">${Utils.escapeHTML(key)}</td>
                        <td>${stats.total || 0}</td>
                        <td>${stats[keys[1]] || 0}</td>
                        <td>${stats[keys[2]] || 0}</td>
                        <td>${stats[keys[3]] || 0}</td>
                    </tr>
                `;
            }).join('');

        return `
            <div class="table-wrapper" style="width: 100%; max-width: 100%; overflow-x: auto;">
                <table class="data-table table-header-red" style="width: 100%; min-width: 100%; table-layout: auto;">
                    <thead>
                        <tr>
                            ${headers.map(h => `<th style="min-width: 100px; word-wrap: break-word;">${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * عرض جدول زمني
     */
    renderTimelineTable(data) {
        if (!data || Object.keys(data).length === 0) {
            return '<div class="empty-state"><p class="text-gray-500">لا توجد بيانات زمنية للعرض</p></div>';
        }

        const rows = Object.entries(data)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, stats]) => {
                return `
                    <tr>
                        <td class="font-semibold">${Utils.escapeHTML(stats.label)}</td>
                        <td>${stats.total || 0}</td>
                        <td>${stats.completed || 0}</td>
                        <td>${stats.needsMaintenance || 0}</td>
                        <td>${stats.outOfService || 0}</td>
                    </tr>
                `;
            }).join('');

        return `
            <div class="table-wrapper" style="width: 100%; max-width: 100%; overflow-x: auto;">
                <table class="data-table table-header-red" style="width: 100%; min-width: 100%; table-layout: auto;">
                    <thead>
                        <tr>
                            <th style="min-width: 120px;">الشهر</th>
                            <th style="min-width: 100px;">الإجمالي</th>
                            <th style="min-width: 100px;">مكتمل</th>
                            <th style="min-width: 120px;">يحتاج صيانة</th>
                            <th style="min-width: 120px;">خارج الخدمة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * عرض جدول الحالة
     */
    renderStatusTable(data) {
        if (!data || Object.keys(data).length === 0) {
            return '<div class="empty-state"><p class="text-gray-500">لا توجد بيانات للعرض</p></div>';
        }

        const total = Object.values(data).reduce((sum, val) => sum + val, 0);
        const rows = Object.entries(data)
            .map(([status, count]) => {
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                let badgeClass = 'badge-info';
                if (status === 'صالح') badgeClass = 'badge-success';
                else if (status === 'يحتاج صيانة') badgeClass = 'badge-warning';
                else if (status === 'خارج الخدمة') badgeClass = 'badge-danger';

                return `
                    <tr>
                        <td><span class="badge ${badgeClass}">${Utils.escapeHTML(status)}</span></td>
                        <td class="font-semibold">${count}</td>
                        <td>${percentage}%</td>
                        <td>
                            <div class="w-full bg-gray-200 rounded-full h-2.5">
                                <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${percentage}%"></div>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

        return `
            <div class="table-wrapper" style="width: 100%; max-width: 100%; overflow-x: auto;">
                <table class="data-table table-header-red" style="width: 100%; min-width: 100%; table-layout: auto;">
                    <thead>
                        <tr>
                            <th style="min-width: 120px;">الحالة</th>
                            <th style="min-width: 100px;">العدد</th>
                            <th style="min-width: 100px;">النسبة</th>
                            <th style="min-width: 150px;">التمثيل</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * إعداد أحداث تبويب التحليل
     */
    setupAnalyticsEventListeners() {
        // تحديث قوائم الفلترة
        const assets = this.getAssets();
        const typeSelect = document.getElementById('analytics-type-filter');
        const locationSelect = document.getElementById('analytics-location-filter');

        if (typeSelect) {
            const types = Array.from(new Set(assets.map(a => a.type).filter(Boolean)));
            typeSelect.innerHTML = '<option value="all">جميع الأنواع</option>' +
                types.map(type => `<option value="${Utils.escapeHTML(type)}">${Utils.escapeHTML(type)}</option>`).join('');
        }

        if (locationSelect) {
            const locations = Array.from(new Set(assets.map(a => a.location).filter(Boolean)));
            locationSelect.innerHTML = '<option value="all">جميع المواقع</option>' +
                locations.map(loc => `<option value="${Utils.escapeHTML(loc)}">${Utils.escapeHTML(loc)}</option>`).join('');
        }

        // زر تطبيق الفلترة
        const applyBtn = document.getElementById('analytics-apply-filters');
        if (applyBtn) {
            const newApplyBtn = applyBtn.cloneNode(true);
            applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
            newApplyBtn.addEventListener('click', () => {
                this.renderAnalyticsData();
            });
        }

        // زر إعادة التعيين
        const resetBtn = document.getElementById('analytics-reset-filters');
        if (resetBtn) {
            const newResetBtn = resetBtn.cloneNode(true);
            resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);
            newResetBtn.addEventListener('click', () => {
                document.getElementById('analytics-date-from').value = '';
                document.getElementById('analytics-date-to').value = '';
                document.getElementById('analytics-type-filter').value = 'all';
                document.getElementById('analytics-location-filter').value = 'all';
                this.renderAnalyticsData();
            });
        }

        // زر تصدير البيانات
        const exportBtn = document.getElementById('analytics-export-data');
        if (exportBtn) {
            const newExportBtn = exportBtn.cloneNode(true);
            exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
            newExportBtn.addEventListener('click', () => {
                this.exportAnalyticsData();
            });
        }

        // تحميل البيانات الأولية
        this.renderAnalyticsData();
    },

    /**
     * تصدير بيانات التحليل
     */
    exportAnalyticsData() {
        try {
            const dateFrom = document.getElementById('analytics-date-from')?.value || '';
            const dateTo = document.getElementById('analytics-date-to')?.value || '';
            const typeFilter = document.getElementById('analytics-type-filter')?.value || 'all';
            const locationFilter = document.getElementById('analytics-location-filter')?.value || 'all';

            const filters = {
                dateFrom,
                dateTo,
                type: typeFilter,
                location: locationFilter
            };

            const analytics = this.getAnalyticsData(filters);
            const assets = this.getAssets();
            const inspections = this.getInspections();

            // إنشاء CSV
            let csv = 'تحليل بيانات معدات الحريق\n';
            csv += `تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}\n\n`;

            // إحصائيات الأجهزة
            csv += 'إحصائيات الأجهزة\n';
            csv += 'الإجمالي,صالح,يحتاج صيانة,خارج الخدمة\n';
            csv += `${analytics.assetStats.total},${analytics.assetStats.active},${analytics.assetStats.needsMaintenance},${analytics.assetStats.outOfService}\n\n`;

            // إحصائيات الفحوصات
            csv += 'إحصائيات الفحوصات\n';
            csv += 'الإجمالي,مكتمل,يحتاج صيانة,خارج الخدمة,نسبة الاكتمال\n';
            csv += `${analytics.inspectionStats.total},${analytics.inspectionStats.completed},${analytics.inspectionStats.needsMaintenance},${analytics.inspectionStats.outOfService},${analytics.inspectionStats.completionRate}%\n\n`;

            // تحليل حسب النوع
            csv += 'تحليل حسب النوع\n';
            csv += 'النوع,الإجمالي,صالح,يحتاج صيانة,خارج الخدمة\n';
            Object.entries(analytics.byType)
                .sort((a, b) => b[1].total - a[1].total)
                .forEach(([type, stats]) => {
                    csv += `${type},${stats.total},${stats.active},${stats.needsMaintenance},${stats.outOfService}\n`;
                });
            csv += '\n';

            // تحليل حسب الموقع
            csv += 'تحليل حسب الموقع\n';
            csv += 'الموقع,الإجمالي,صالح,يحتاج صيانة,خارج الخدمة\n';
            Object.entries(analytics.byLocation)
                .sort((a, b) => b[1].total - a[1].total)
                .forEach(([location, stats]) => {
                    csv += `${location},${stats.total},${stats.active},${stats.needsMaintenance},${stats.outOfService}\n`;
                });

            // تحميل الملف
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `تحليل_معدات_الحريق_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            Notification.success('تم تصدير البيانات بنجاح');
        } catch (error) {
            Notification.error('حدث خطأ أثناء تصدير البيانات: ' + error.message);
            console.error(error);
        }
    },

    /**
     * عرض تبويب طلبات الموافقة (للمدير فقط)
     */
    async renderApprovalRequestsTab() {
        if (!this.isAdmin()) {
            return '<div class="empty-state"><p class="text-gray-500">ليس لديك صلاحية للوصول إلى هذا القسم. يجب أن تكون مدير النظام.</p></div>';
        }

        // ✅ التأكد من تهيئة البيانات أولاً
        this.ensureData();

        // ✅ تحميل طلبات الموافقة من Backend أولاً
        try {
            const loaded = await this.loadApprovalRequestsFromBackend();
            if (loaded && loaded.length > 0) {
                Utils.safeLog(`✅ تم تحميل ${loaded.length} طلب موافقة من Backend`);
            }
        } catch (error) {
            Utils.safeWarn('⚠️ فشل تحميل طلبات الموافقة:', error);
        }

        // الحصول على طلبات الموافقة (يمكن تخزينها في AppState أو جلبها من الخادم)
        const approvalRequests = this.getApprovalRequests();
        
        // ✅ التأكد من أن الطلبات موجودة
        if (!approvalRequests || !Array.isArray(approvalRequests)) {
            Utils.safeWarn('⚠️ لا توجد طلبات موافقة متاحة');
            return '<div class="empty-state"><p class="text-gray-500">لا توجد طلبات موافقة حالياً</p></div>';
        }

        // ترتيب الطلبات: قيد الانتظار أولاً، ثم الموافق عليها، ثم المرفوضة
        const sortedRequests = [...approvalRequests].sort((a, b) => {
            const statusOrder = { 'pending': 1, 'approved': 2, 'rejected': 3 };
            const aOrder = statusOrder[a.status] || 99;
            const bOrder = statusOrder[b.status] || 99;
            if (aOrder !== bOrder) return aOrder - bOrder;
            // إذا كانت الحالة نفسها، ترتيب حسب التاريخ (الأحدث أولاً)
            const aDate = new Date(a.requestedAt || 0);
            const bDate = new Date(b.requestedAt || 0);
            return bDate - aDate;
        });

        const rows = sortedRequests.map(request => {
            const statusBadge = request.status === 'approved'
                ? '<span class="badge badge-success"><i class="fas fa-check-circle ml-1"></i>موافق عليه</span>'
                : request.status === 'rejected'
                    ? '<span class="badge badge-danger"><i class="fas fa-times-circle ml-1"></i>مرفوض</span>'
                    : '<span class="badge badge-warning"><i class="fas fa-clock ml-1"></i>قيد الانتظار</span>';

            const requestType = request.type === 'inspection' ? '<i class="fas fa-clipboard-check ml-1"></i>فحص شهري'
                : request.type === 'add' ? '<i class="fas fa-plus-circle ml-1"></i>إضافة جهاز'
                    : request.type === 'edit' ? '<i class="fas fa-edit ml-1"></i>تعديل جهاز'
                        : request.type === 'delete' ? '<i class="fas fa-trash ml-1"></i>حذف جهاز'
                            : '<i class="fas fa-question-circle ml-1"></i>طلب غير محدد';

            const asset = this.getAssets().find(a => a.id === request.assetId || a.number === request.assetNumber);
            const assetLabel = asset ? `${asset.number || asset.id} - ${asset.location || ''}` : (request.assetNumber || request.assetId || '-');

            return `
                <tr data-request-id="${request.id}" data-status="${request.status || 'pending'}" style="${request.status === 'pending' ? 'background-color: rgba(255, 193, 7, 0.05);' : ''}">
                    <td>
                        <div class="font-semibold text-gray-800">${Utils.escapeHTML(request.id || '-')}</div>
                        ${request.status === 'pending' ? '<div class="text-xs text-yellow-600 mt-1"><i class="fas fa-exclamation-circle ml-1"></i>يتطلب مراجعة</div>' : ''}
                    </td>
                    <td>${requestType}</td>
                    <td>
                        <div class="font-semibold">${Utils.escapeHTML(assetLabel)}</div>
                        ${asset ? `<div class="text-xs text-gray-500">${Utils.escapeHTML(asset.type || '')}</div>` : ''}
                    </td>
                    <td>
                        <div class="font-semibold">${Utils.escapeHTML(request.requestedBy || request.userName || '-')}</div>
                        ${request.userEmail ? `<div class="text-xs text-gray-500">${Utils.escapeHTML(request.userEmail)}</div>` : ''}
                    </td>
                    <td>
                        <div>${request.requestedAt ? Utils.formatDate(request.requestedAt) : '-'}</div>
                        ${request.approvedAt || request.rejectedAt ? 
                            `<div class="text-xs text-gray-500 mt-1">
                                ${request.status === 'approved' && request.approvedAt ? `موافق: ${Utils.formatDate(request.approvedAt)}` : ''}
                                ${request.status === 'rejected' && request.rejectedAt ? `مرفوض: ${Utils.formatDate(request.rejectedAt)}` : ''}
                            </div>` : ''}
                    </td>
                    <td>${statusBadge}</td>
                    <td style="word-wrap: break-word; max-width: 200px; white-space: normal;">
                        <div class="text-sm">${Utils.escapeHTML(request.comments || request.reason || '-')}</div>
                        ${request.rejectionReason ? `<div class="text-xs text-red-600 mt-1"><i class="fas fa-info-circle ml-1"></i>سبب الرفض: ${Utils.escapeHTML(request.rejectionReason)}</div>` : ''}
                    </td>
                    <td>
                        <div class="flex flex-wrap gap-2">
                            ${request.status === 'pending' ? `
                            <button class="btn-icon btn-icon-success" data-action="approve-request" data-id="${request.id}" title="الموافقة على الطلب">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn-icon btn-icon-danger" data-action="reject-request" data-id="${request.id}" title="رفض الطلب">
                                <i class="fas fa-times"></i>
                            </button>
                            ` : ''}
                            <button class="btn-icon btn-icon-primary" data-action="view-request" data-id="${request.id}" title="عرض تفاصيل الطلب">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${request.status === 'pending' ? `
                            <button class="btn-icon btn-icon-warning" data-action="edit-request" data-id="${request.id}" title="تعديل الطلب">
                                <i class="fas fa-edit"></i>
                            </button>
                            ` : ''}
                            <button class="btn-icon btn-icon-danger" data-action="delete-request" data-id="${request.id}" title="حذف الطلب">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-check-circle ml-2"></i>
                            طلبات الموافقة
                        </h2>
                        <div class="flex items-center gap-2">
                            <input type="text" id="approval-requests-search" class="form-input" placeholder="بحث..." style="width: 250px;">
                            <button id="approval-requests-refresh" class="btn-secondary">
                                <i class="fas fa-sync-alt ml-2"></i>
                                تحديث
                            </button>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    ${approvalRequests.length === 0 ? `
                        <div class="empty-state">
                            <i class="fas fa-inbox text-4xl text-gray-400 mb-4"></i>
                            <p class="text-gray-500">لا توجد طلبات موافقة حالياً</p>
                        </div>
                    ` : `
                        <div class="table-wrapper approval-requests-table-wrapper" style="width: 100%; max-width: 100%; overflow-x: auto; overflow-y: auto; max-height: 70vh; position: relative;">
                            <table class="data-table" style="width: 100%; min-width: 100%; table-layout: auto;">
                                <thead style="position: sticky; top: 0; background: var(--card-bg); z-index: 10;">
                                    <tr>
                                        <th style="min-width: 100px;">رقم الطلب</th>
                                        <th style="min-width: 120px;">نوع الطلب</th>
                                        <th style="min-width: 120px;">رقم الجهاز</th>
                                        <th style="min-width: 150px;">مقدم الطلب</th>
                                        <th style="min-width: 120px;">تاريخ الطلب</th>
                                        <th style="min-width: 100px;">الحالة</th>
                                        <th style="min-width: 200px; word-wrap: break-word;">ملاحظات</th>
                                        <th style="min-width: 150px;">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody id="approval-requests-table-body">
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    /**
     * تحميل طلبات الموافقة من Backend
     */
    async loadApprovalRequestsFromBackend() {
        try {
            if (GoogleIntegration && AppState.googleConfig?.appsScript?.enabled) {
                const result = await GoogleIntegration.sendRequest({
                    action: 'getFireEquipmentApprovalRequests',
                    data: {}
                });

                if (result && result.success && result.data) {
                    if (!AppState.appData) AppState.appData = {};
                    const loadedRequests = Array.isArray(result.data) ? result.data : [];
                    
                    // ✅ دمج الطلبات المحلية مع الطلبات من Backend (تجنب التكرار)
                    const localRequests = AppState.appData.fireEquipmentApprovalRequests || [];
                    const mergedRequests = [...localRequests];
                    
                    loadedRequests.forEach(loadedReq => {
                        const existingIndex = mergedRequests.findIndex(req => req.id === loadedReq.id);
                        if (existingIndex >= 0) {
                            // تحديث الطلب الموجود
                            mergedRequests[existingIndex] = { ...mergedRequests[existingIndex], ...loadedReq };
                        } else {
                            // إضافة طلب جديد
                            mergedRequests.push(loadedReq);
                        }
                    });
                    
                    AppState.appData.fireEquipmentApprovalRequests = mergedRequests;
                    
                    // حفظ في localStorage
                    if (typeof DataManager !== 'undefined' && DataManager.save) {
                        DataManager.save();
                    } else {
                        localStorage.setItem('fire_equipment_approval_requests', JSON.stringify(mergedRequests));
                    }
                    
                    Utils.safeLog(`✅ تم تحميل ودمج ${mergedRequests.length} طلب موافقة (${loadedRequests.length} من Backend)`);
                    return mergedRequests;
                } else {
                    Utils.safeWarn('⚠️ استجابة غير صحيحة من Backend:', result);
                }
            } else {
                Utils.safeWarn('⚠️ GoogleIntegration غير متاح أو غير مفعّل');
            }
        } catch (error) {
            Utils.safeWarn('⚠️ فشل تحميل طلبات الموافقة من Backend:', error);
        }
        
        // ✅ إرجاع البيانات المحلية إن وجدت
        const localRequests = this.getApprovalRequests();
        return localRequests || [];
    },

    /**
     * الحصول على طلبات الموافقة
     */
    getApprovalRequests() {
        // ✅ التأكد من تهيئة AppState
        if (!AppState.appData) {
            AppState.appData = {};
        }

        // يمكن جلبها من AppState أو من الخادم
        if (AppState.appData.fireEquipmentApprovalRequests && Array.isArray(AppState.appData.fireEquipmentApprovalRequests)) {
            return AppState.appData.fireEquipmentApprovalRequests;
        }

        // يمكن إرجاع قائمة فارغة أو جلبها من localStorage كبديل مؤقت
        const stored = localStorage.getItem('fire_equipment_approval_requests');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    AppState.appData.fireEquipmentApprovalRequests = parsed;
                    return parsed;
                }
            } catch (e) {
                Utils.safeWarn('⚠️ خطأ في تحليل طلبات الموافقة من localStorage:', e);
            }
        }

        // ✅ تهيئة قائمة فارغة إذا لم تكن موجودة
        AppState.appData.fireEquipmentApprovalRequests = [];
        return [];
    },

    /**
     * تهيئة أحداث تبويب طلبات الموافقة
     */
    setupApprovalRequestsEventListeners() {
        // البحث
        const searchInput = document.getElementById('approval-requests-search');
        if (searchInput) {
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            newSearchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('#approval-requests-table-body tr[data-request-id]');
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            });
        }

        // زر التحديث
        const refreshBtn = document.getElementById('approval-requests-refresh');
        if (refreshBtn) {
            // إزالة Event Listeners القديمة
            const newRefreshBtn = refreshBtn.cloneNode(true);
            if (refreshBtn.parentNode) {
            refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
            }
            newRefreshBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    Loading.show();
                    // تحميل الطلبات من Backend
                    await this.loadApprovalRequestsFromBackend();
                    // تحديث الإشعارات
                    if (typeof AppUI !== 'undefined' && AppUI.updateNotificationsBadge) {
                        AppUI.updateNotificationsBadge();
                    }
                    // تحديث التبويب
                await this.switchTab('approval-requests');
                    Notification.success('تم تحديث الطلبات بنجاح');
                } catch (error) {
                    Utils.safeError('خطأ في تحديث طلبات الموافقة:', error);
                    Notification.error('حدث خطأ أثناء تحديث الطلبات');
                } finally {
                    Loading.hide();
                }
            });
        }

        // أحداث الأزرار في الجدول
        const tableBody = document.getElementById('approval-requests-table-body');
        if (tableBody) {
            tableBody.addEventListener('click', async (e) => {
                const target = e.target.closest('[data-action]');
                if (!target) return;

                const action = target.dataset.action;
                const requestId = target.dataset.id;

                switch (action) {
                    case 'approve-request':
                        await this.approveRequest(requestId);
                        break;
                    case 'reject-request':
                        await this.rejectRequest(requestId);
                        break;
                    case 'view-request':
                        await this.viewRequest(requestId);
                        break;
                    case 'edit-request':
                        await this.editRequest(requestId);
                        break;
                    case 'delete-request':
                        await this.deleteRequest(requestId);
                        break;
                }
            });
        }
    },

    /**
     * الموافقة على طلب
     */
    async approveRequest(requestId) {
        if (!this.isAdmin()) {
            Notification.error('ليس لديك صلاحية للموافقة على الطلبات');
            return;
        }

        const confirmed = confirm('هل أنت متأكد من الموافقة على هذا الطلب؟');
        if (!confirmed) return;

        Loading.show();
        try {
            const requests = this.getApprovalRequests();
            const request = requests.find(r => r.id === requestId);
            if (!request) {
                Notification.error('لم يتم العثور على الطلب');
                return;
            }

            request.status = 'approved';
            request.approvedBy = AppState.currentUser?.name || AppState.currentUser?.email || 'مدير النظام';
            request.approvedAt = new Date().toISOString();

            // حفظ التغييرات
            if (!AppState.appData) AppState.appData = {};
            AppState.appData.fireEquipmentApprovalRequests = requests;
            
            // حفظ في localStorage
            if (typeof DataManager !== 'undefined' && DataManager.save) {
                DataManager.save();
            } else {
                localStorage.setItem('fire_equipment_approval_requests', JSON.stringify(requests));
            }

            // حفظ في Google Sheets إذا كان متاحاً
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                try {
                    const updateResult = await GoogleIntegration.sendRequest({
                        action: 'updateFireEquipmentApprovalRequest',
                        data: { 
                            requestId, 
                            status: 'approved', 
                            approvedBy: request.approvedBy,
                            approvedAt: request.approvedAt
                        }
                    });

                    if (updateResult && !updateResult.success) {
                        Utils.safeWarn('⚠️ فشل حفظ التغييرات في Backend:', updateResult.message);
                    } else {
                        Utils.safeLog('✅ تم حفظ الموافقة في Backend بنجاح');
                    }
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في حفظ الموافقة في Backend:', error);
                }
            }

            Notification.success('تمت الموافقة على الطلب بنجاح');
            
            // إرسال إشعار للمستخدم الذي طلب الموافقة (في الخلفية)
            this.notifyUserAboutRequestStatus(request, 'approved').catch(error => {
                Utils.safeWarn('⚠️ خطأ في إرسال إشعار للمستخدم:', error);
            });
            
            // تحديث الإشعارات
            if (typeof AppUI !== 'undefined' && AppUI.updateNotificationsBadge) {
                AppUI.updateNotificationsBadge();
            }

            // إرسال إشعار Real-time
            if (typeof RealtimeSyncManager !== 'undefined' && RealtimeSyncManager.notifyChange) {
                RealtimeSyncManager.notifyChange('fireEquipmentApprovalRequests', 'update', requestId);
            }

            // تحديث التبويب بعد التغيير
            await this.switchTab('approval-requests');

            // إذا كان الطلب للفحص الشهري، فتح نموذج الفحص تلقائياً
            if (request.type === 'inspection' && request.assetId) {
                // الانتظار قليلاً ثم فتح نموذج الفحص
                setTimeout(() => {
                    this.switchTab('inspections').then(() => {
                        setTimeout(() => {
                            this.showInspectionForm(null, request.assetId);
                        }, 300);
                    });
                }, 500);
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في الموافقة على الطلب:', error);
            Notification.error('حدث خطأ أثناء الموافقة على الطلب');
        } finally {
            Loading.hide();
        }
    },

    /**
     * رفض طلب
     */
    async rejectRequest(requestId) {
        if (!this.isAdmin()) {
            Notification.error('ليس لديك صلاحية لرفض الطلبات');
            return;
        }

        const reason = prompt('أدخل سبب الرفض (اختياري):');
        if (reason === null) return; // المستخدم ألغى

        Loading.show();
        try {
            const requests = this.getApprovalRequests();
            const request = requests.find(r => r.id === requestId);
            if (!request) {
                Notification.error('لم يتم العثور على الطلب');
                return;
            }

            request.status = 'rejected';
            request.rejectedBy = AppState.currentUser?.name || AppState.currentUser?.email || 'مدير النظام';
            request.rejectedAt = new Date().toISOString();
            request.rejectionReason = reason || '';

            // حفظ التغييرات
            if (!AppState.appData) AppState.appData = {};
            AppState.appData.fireEquipmentApprovalRequests = requests;
            
            // حفظ في localStorage
            if (typeof DataManager !== 'undefined' && DataManager.save) {
                DataManager.save();
            } else {
                localStorage.setItem('fire_equipment_approval_requests', JSON.stringify(requests));
            }

            // حفظ في Google Sheets إذا كان متاحاً
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                try {
                    const updateResult = await GoogleIntegration.sendRequest({
                        action: 'updateFireEquipmentApprovalRequest',
                        data: { 
                            requestId, 
                            status: 'rejected', 
                            rejectedBy: request.rejectedBy,
                            rejectedAt: request.rejectedAt,
                            rejectionReason: request.rejectionReason 
                        }
                    });

                    if (updateResult && !updateResult.success) {
                        Utils.safeWarn('⚠️ فشل حفظ التغييرات في Backend:', updateResult.message);
                    } else {
                        Utils.safeLog('✅ تم حفظ الرفض في Backend بنجاح');
                    }
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في حفظ الرفض في Backend:', error);
                }
            }

            Notification.success('تم رفض الطلب بنجاح');
            
            // إرسال إشعار للمستخدم الذي طلب الموافقة (في الخلفية)
            this.notifyUserAboutRequestStatus(request, 'rejected', reason).catch(error => {
                Utils.safeWarn('⚠️ خطأ في إرسال إشعار للمستخدم:', error);
            });
            
            // تحديث الإشعارات
            if (typeof AppUI !== 'undefined' && AppUI.updateNotificationsBadge) {
                AppUI.updateNotificationsBadge();
            }

            // إرسال إشعار Real-time
            if (typeof RealtimeSyncManager !== 'undefined' && RealtimeSyncManager.notifyChange) {
                RealtimeSyncManager.notifyChange('fireEquipmentApprovalRequests', 'update', requestId);
            }

            // تحديث التبويب بعد التغيير
            await this.switchTab('approval-requests');
        } catch (error) {
            Utils.safeError('❌ خطأ في رفض الطلب:', error);
            Notification.error('حدث خطأ أثناء رفض الطلب');
        } finally {
            Loading.hide();
        }
    },

    /**
     * إرسال إشعار للمستخدم عند تغيير حالة طلبه
     * @param {object} request - بيانات الطلب
     * @param {string} status - الحالة الجديدة ('approved' أو 'rejected')
     * @param {string} reason - سبب الرفض (اختياري)
     */
    async notifyUserAboutRequestStatus(request, status, reason = '') {
        try {
            const userId = request.requestedById || request.userEmail || '';
            if (!userId) {
                Utils.safeWarn('⚠️ لا يمكن إرسال إشعار: معرف المستخدم غير موجود');
                return;
            }

            const assetLabel = request.assetNumber || request.assetId || 'جهاز غير محدد';
            let title, message, type;

            if (status === 'approved') {
                title = 'تمت الموافقة على طلبك';
                message = `تمت الموافقة على طلبك لإجراء فحص شهري على الجهاز: ${assetLabel}`;
                type = 'success';
            } else if (status === 'rejected') {
                title = 'تم رفض طلبك';
                message = `تم رفض طلبك لإجراء فحص شهري على الجهاز: ${assetLabel}${reason ? `. السبب: ${reason}` : ''}`;
                type = 'error';
            } else {
                return; // حالة غير معروفة
            }

            if (GoogleIntegration && AppState.googleConfig?.appsScript?.enabled) {
                await GoogleIntegration.sendRequest({
                    action: 'addNotification',
                    data: {
                        userId: userId,
                        title: title,
                        message: message,
                        type: type,
                        priority: status === 'approved' ? 'normal' : 'high',
                        link: '#fire-equipment-inspections',
                        data: {
                            module: 'fire-equipment',
                            action: 'inspection_approval_status',
                            requestId: request.id,
                            status: status
                        }
                    }
                }).catch(error => {
                    Utils.safeWarn('⚠️ فشل إرسال الإشعار للمستخدم:', error);
                });
            }

            Utils.safeLog(`✅ تم إرسال إشعار للمستخدم بخصوص حالة الطلب: ${status}`);
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في إرسال إشعار حالة الطلب:', error);
        }
    },

    /**
     * عرض تفاصيل طلب الموافقة
     */
    async viewRequest(requestId) {
        const requests = this.getApprovalRequests();
        const request = requests.find(r => r.id === requestId);
        if (!request) {
            Notification.error('لم يتم العثور على الطلب');
            return;
        }

        const asset = this.getAssets().find(a => a.id === request.assetId || a.number === request.assetNumber);
        const statusBadge = request.status === 'approved'
            ? '<span class="badge badge-success"><i class="fas fa-check-circle ml-1"></i>موافق عليه</span>'
            : request.status === 'rejected'
                ? '<span class="badge badge-danger"><i class="fas fa-times-circle ml-1"></i>مرفوض</span>'
                : '<span class="badge badge-warning"><i class="fas fa-clock ml-1"></i>قيد الانتظار</span>';

        const requestType = request.type === 'inspection' ? 'فحص شهري'
            : request.type === 'add' ? 'إضافة جهاز'
                : request.type === 'edit' ? 'تعديل جهاز'
                    : request.type === 'delete' ? 'حذف جهاز'
                        : 'طلب غير محدد';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">
                        <i class="fas fa-file-alt ml-2"></i>
                        تفاصيل طلب الموافقة
                    </h2>
                    <button class="modal-close" onclick="FireEquipment.confirmClose(this)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-sm font-semibold text-gray-600">رقم الطلب:</label>
                                <p class="text-gray-800 font-mono">${Utils.escapeHTML(request.id || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">نوع الطلب:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(requestType)}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">رقم الجهاز:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(request.assetNumber || request.assetId || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الجهاز:</label>
                                <p class="text-gray-800">${asset ? `${Utils.escapeHTML(asset.number || asset.id)} - ${Utils.escapeHTML(asset.location || '')}` : '-'}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">مقدم الطلب:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(request.requestedBy || request.userName || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">البريد الإلكتروني:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(request.userEmail || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">تاريخ الطلب:</label>
                                <p class="text-gray-800">${request.requestedAt ? Utils.formatDate(request.requestedAt) : '-'}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الحالة:</label>
                                <p class="text-gray-800">${statusBadge}</p>
                            </div>
                            ${request.status === 'approved' ? `
                            <div>
                                <label class="text-sm font-semibold text-gray-600">موافق عليه من:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(request.approvedBy || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">تاريخ الموافقة:</label>
                                <p class="text-gray-800">${request.approvedAt ? Utils.formatDate(request.approvedAt) : '-'}</p>
                            </div>
                            ` : ''}
                            ${request.status === 'rejected' ? `
                            <div>
                                <label class="text-sm font-semibold text-gray-600">مرفوض من:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(request.rejectedBy || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">تاريخ الرفض:</label>
                                <p class="text-gray-800">${request.rejectedAt ? Utils.formatDate(request.rejectedAt) : '-'}</p>
                            </div>
                            ` : ''}
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">الملاحظات / السبب:</label>
                            <p class="text-gray-800 bg-gray-50 p-3 rounded-lg border">${Utils.escapeHTML(request.comments || request.reason || '-')}</p>
                        </div>
                        ${request.rejectionReason ? `
                        <div>
                            <label class="text-sm font-semibold text-red-600">سبب الرفض:</label>
                            <p class="text-red-800 bg-red-50 p-3 rounded-lg border border-red-200">${Utils.escapeHTML(request.rejectionReason)}</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 0.75rem;">
                    <button type="button" class="btn-secondary" onclick="FireEquipment.confirmClose(this)">
                        <i class="fas fa-times ml-2"></i>
                        إغلاق
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    /**
     * تعديل طلب
     */
    async editRequest(requestId) {
        if (!this.isAdmin()) {
            Notification.error('ليس لديك صلاحية لتعديل الطلبات');
            return;
        }

        const requests = this.getApprovalRequests();
        const request = requests.find(r => r.id === requestId);
        if (!request) {
            Notification.error('لم يتم العثور على الطلب');
            return;
        }

        const comments = prompt('تعديل الملاحظات:', request.comments || '');
        if (comments === null) return;

        Loading.show();
        try {
            request.comments = comments;
            request.updatedAt = new Date().toISOString();

            // حفظ التغييرات
            if (!AppState.appData) AppState.appData = {};
            AppState.appData.fireEquipmentApprovalRequests = requests;
            
            // حفظ في localStorage
            if (typeof DataManager !== 'undefined' && DataManager.save) {
                DataManager.save();
            } else {
                localStorage.setItem('fire_equipment_approval_requests', JSON.stringify(requests));
            }

            Notification.success('تم تحديث الطلب بنجاح');
            await this.switchTab('approval-requests');
        } catch (error) {
            Utils.safeError('❌ خطأ في تعديل الطلب:', error);
            Notification.error('حدث خطأ أثناء تعديل الطلب');
        } finally {
            Loading.hide();
        }
    },

    /**
     * حذف طلب
     */
    async deleteRequest(requestId) {
        if (!this.isAdmin()) {
            Notification.error('ليس لديك صلاحية لحذف الطلبات');
            return;
        }

        const confirmed = confirm('هل أنت متأكد من حذف هذا الطلب؟');
        if (!confirmed) return;

        Loading.show();
        try {
            const requests = this.getApprovalRequests();
            const requestIndex = requests.findIndex(r => r.id === requestId);
            if (requestIndex === -1) {
                Notification.error('لم يتم العثور على الطلب');
                return;
            }

            requests.splice(requestIndex, 1);

            // حفظ التغييرات
            if (!AppState.appData) AppState.appData = {};
            AppState.appData.fireEquipmentApprovalRequests = requests;
            
            // حفظ في localStorage
            if (typeof DataManager !== 'undefined' && DataManager.save) {
                DataManager.save();
            } else {
                localStorage.setItem('fire_equipment_approval_requests', JSON.stringify(requests));
            }

            // حذف من Google Sheets إذا كان متاحاً
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                await GoogleIntegration.sendRequest({
                    action: 'deleteFireEquipmentApprovalRequest',
                    data: { requestId }
                }).catch(error => {
                    Utils.safeWarn('⚠️ تعذر حذف الطلب من Google Sheets:', error);
                });
            }

            Notification.success('تم حذف الطلب بنجاح');
            await this.switchTab('approval-requests');
        } catch (error) {
            Utils.safeError('❌ خطأ في حذف الطلب:', error);
            Notification.error('حدث خطأ أثناء حذف الطلب');
        } finally {
            Loading.hide();
        }
    },

    /**
     * الحصول على قائمة المواقع من إعدادات النماذج
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

    refreshSiteDropdowns() {
        try {
            var sites = this.getSiteOptions();
            var esc = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML : function(s) { return String(s == null ? '' : s); };
            var opts = '<option value="">اختر المصنع</option>' + (sites || []).map(function(s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
            ['asset-factory', 'fire-assets-location'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el && el.tagName === 'SELECT') { var v = el.value; el.innerHTML = opts; if (v) el.value = v; }
            });
            var sub = document.getElementById('asset-sub-location');
            if (sub && sub.tagName === 'SELECT') {
                var factoryId = (document.getElementById('asset-factory') || {}).value;
                var places = this.getPlaceOptions(factoryId);
                sub.innerHTML = '<option value="">اختر الموقع الفرعي</option>' + (places || []).map(function(p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');
            }
        } catch (e) { if (typeof Utils !== 'undefined' && Utils.safeWarn) Utils.safeWarn('⚠️ FireEquipment.refreshSiteDropdowns:', e); }
    },

    /**
     * الحصول على قائمة الأماكن الفرعية لموقع محدد
     */
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
            Utils.safeWarn('⚠️ خطأ في الحصول على قائمة الأماكن الفرعية:', error);
            return [];
        }
    }
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof FireEquipment !== 'undefined') {
            window.FireEquipment = FireEquipment;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ FireEquipment module loaded and available on window.FireEquipment');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير FireEquipment:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof FireEquipment !== 'undefined') {
            try {
                window.FireEquipment = FireEquipment;
            } catch (e) {
                console.error('❌ فشل تصدير FireEquipment:', e);
            }
        }
    }
})();