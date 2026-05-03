/**
 * HSE Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
// ===== HSE Module (إدارة السلامة والصحة المهنية) =====
const HSE = {
    currentView: 'dashboard', // dashboard, audits, non-conformities, corrective-actions, objectives, risk-assessments
    currentTab: 'dashboard',

    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        // محاولة البحث عن القسم الصحيح
        let section = document.getElementById('hse-section');
        if (!section) {
            section = document.getElementById('safety-health-management-section');
        }
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('قسم hse-section غير موجود!');
            } else {
                console.error('قسم hse-section غير موجود!');
            }
            return;
        }

        try {
            // تحميل المحتوى بشكل آمن مع timeout
            let content = '';
            try {
                const contentPromise = this.render();
                content = await Utils.promiseWithTimeout(
                    contentPromise,
                    5000,
                    () => new Error('Timeout: render took too long')
                );
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                    Utils.safeWarn('⚠️ خطأ في تحميل محتوى الواجهة:', error);
                } else {
                    console.warn('⚠️ خطأ في تحميل محتوى الواجهة:', error);
                }
                content = `
                    <div class="section-header">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-user-shield ml-3"></i>
                                إدارة السلامة والصحة المهنية (HSE)
                            </h1>
                        </div>
                    </div>
                    <div class="content-card mt-6">
                        <div class="card-body">
                            <div class="empty-state">
                                <div style="width: 300px; margin: 0 auto 16px;">
                                    <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                        <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                    </div>
                                </div>
                                <p class="text-gray-500 mb-4">جاري تحميل البيانات...</p>
                            </div>
                        </div>
                    </div>
                `;
            }

            section.innerHTML = content;
            
            // تهيئة الأحداث بعد عرض الواجهة
            try {
                this.setupEventListeners();
                this.loadDashboard();
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                    Utils.safeWarn('⚠️ خطأ في setupEventListeners أو loadDashboard:', error);
                } else {
                    console.warn('⚠️ خطأ في setupEventListeners أو loadDashboard:', error);
                }
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في تحميل مديول HSE:', error);
            } else {
                console.error('❌ خطأ في تحميل مديول HSE:', error);
            }
            section.innerHTML = `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-4">حدث خطأ أثناء تحميل البيانات</p>
                            <button onclick="HSE.load()" class="btn-primary">
                                <i class="fas fa-redo ml-2"></i>
                                إعادة المحاولة
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    async render() {
        return `
            <div class="section-header">
                <div class="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-user-shield ml-3"></i>
                            إدارة السلامة والصحة المهنية (HSE)
                        </h1>
                        <p class="section-subtitle">إدارة شاملة لأنشطة السلامة والصحة المهنية والبيئة</p>
                    </div>
                    <div class="flex gap-2">
                        <button id="hse-export-excel-btn" class="btn-success">
                            <i class="fas fa-file-excel ml-2"></i>
                            تصدير Excel
                        </button>
                        <button id="hse-export-pdf-btn" class="btn-secondary">
                            <i class="fas fa-file-pdf ml-2"></i>
                            تصدير PDF
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tabs Navigation -->
            <div class="mt-6">
                <div class="flex items-center gap-2 border-b border-gray-200" style="border-bottom: 2px solid #e5e7eb; flex-wrap: nowrap; overflow-x: auto; overflow-y: visible; min-width: 0; width: 100%; max-width: 100%; box-sizing: border-box;">
                    <button class="hse-tab-btn active" data-tab="dashboard" onclick="HSE.switchTab('dashboard')" style="padding: 12px 20px; border: none; background: transparent; color: #6b7280; font-weight: 500; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s; flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                        <i class="fas fa-chart-pie ml-2"></i>
                        لوحة التحكم
                    </button>
                    <button class="hse-tab-btn" data-tab="audits" onclick="HSE.switchTab('audits')" style="padding: 12px 20px; border: none; background: transparent; color: #6b7280; font-weight: 500; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s; flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                        <i class="fas fa-clipboard-check ml-2"></i>
                        التدقيقات
                    </button>
                    <button class="hse-tab-btn" data-tab="non-conformities" onclick="HSE.switchTab('non-conformities')" style="padding: 12px 20px; border: none; background: transparent; color: #6b7280; font-weight: 500; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s; flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                        <i class="fas fa-exclamation-triangle ml-2"></i>
                        عدم المطابقة
                    </button>
                    <button class="hse-tab-btn" data-tab="corrective-actions" onclick="HSE.switchTab('corrective-actions')" style="padding: 12px 20px; border: none; background: transparent; color: #6b7280; font-weight: 500; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s; flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                        <i class="fas fa-tools ml-2"></i>
                        الإجراءات التصحيحية
                    </button>
                    <button class="hse-tab-btn" data-tab="objectives" onclick="HSE.switchTab('objectives')" style="padding: 12px 20px; border: none; background: transparent; color: #6b7280; font-weight: 500; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s; flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                        <i class="fas fa-bullseye ml-2"></i>
                        الأهداف
                    </button>
                    <button class="hse-tab-btn" data-tab="risk-assessments" onclick="HSE.switchTab('risk-assessments')" style="padding: 12px 20px; border: none; background: transparent; color: #6b7280; font-weight: 500; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s; flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                        <i class="fas fa-shield-alt ml-2"></i>
                        تقييمات المخاطر
                    </button>
                </div>
                <style>
                    .hse-tab-btn:hover {
                        color: #3b82f6 !important;
                    }
                    .hse-tab-btn.active {
                        color: #3b82f6 !important;
                        border-bottom-color: #3b82f6 !important;
                        font-weight: 600 !important;
                    }
                </style>
            </div>
            
            <!-- Tab Content -->
            <div id="hse-tab-content" class="mt-6">
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p class="text-gray-500">جاري تحميل لوحة المعلومات...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // ✅ تحميل لوحة المعلومات فوراً بعد عرض الواجهة
        setTimeout(async () => {
            try {
                const contentArea = document.getElementById('hse-tab-content');
                if (!contentArea) return;
                
                const dashboardContent = await this.renderDashboard().catch(error => {
                    Utils.safeWarn('⚠️ خطأ في تحميل لوحة المعلومات:', error);
                    return `
                        <div class="content-card">
                            <div class="card-body">
                                <div class="empty-state">
                                    <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                    <p class="text-gray-500 mb-4">حدث خطأ في تحميل البيانات</p>
                                    <button onclick="HSE.load()" class="btn-primary">
                                        <i class="fas fa-redo ml-2"></i>
                                        إعادة المحاولة
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                contentArea.innerHTML = dashboardContent;
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في تحميل لوحة المعلومات:', error);
            }
        }, 0);
    },

    async switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        const tabBtns = document.querySelectorAll('.hse-tab-btn');
        tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
            // التأكد من الحفاظ على styles لمنع التكسير
            if (!btn.style.flexShrink) {
                btn.style.setProperty('flex-shrink', '0', 'important');
                btn.style.setProperty('min-width', 'fit-content', 'important');
                btn.style.setProperty('white-space', 'nowrap', 'important');
                btn.style.setProperty('width', 'auto', 'important');
                btn.style.setProperty('max-width', 'none', 'important');
            }
        });

        // التأكد من الحفاظ على styles للـ container
        const tabContainer = document.querySelector('.flex.items-center.gap-2.border-b.border-gray-200');
        if (tabContainer && !tabContainer.style.flexWrap) {
            tabContainer.style.setProperty('flex-wrap', 'nowrap', 'important');
            tabContainer.style.setProperty('overflow-x', 'auto', 'important');
            tabContainer.style.setProperty('overflow-y', 'visible', 'important');
        }

        // Load appropriate content
        const contentContainer = document.getElementById('hse-tab-content');
        if (!contentContainer) return;

        if (tabName === 'dashboard') {
            contentContainer.innerHTML = await this.renderDashboard();
            this.loadDashboard();
        } else if (tabName === 'audits') {
            contentContainer.innerHTML = await this.renderAudits();
            this.loadAudits();
        } else if (tabName === 'non-conformities') {
            contentContainer.innerHTML = await this.renderNonConformities();
            this.loadNonConformities();
        } else if (tabName === 'corrective-actions') {
            contentContainer.innerHTML = await this.renderCorrectiveActions();
            this.loadCorrectiveActions();
        } else if (tabName === 'objectives') {
            contentContainer.innerHTML = await this.renderObjectives();
            this.loadObjectives();
        } else if (tabName === 'risk-assessments') {
            contentContainer.innerHTML = await this.renderRiskAssessments();
            this.loadRiskAssessments();
        }
    },

    async renderDashboard() {
        const audits = AppState.appData?.hseAudits || [];
        const nonConformities = AppState.appData?.hseNonConformities || [];
        const correctiveActions = AppState.appData?.hseCorrectiveActions || [];
        const objectives = AppState.appData?.hseObjectives || [];
        const riskAssessments = AppState.appData?.hseRiskAssessments || [];

        const pendingActions = correctiveActions.filter(a => a.status === 'قيد التنفيذ' || a.status === 'pending').length;
        const completedActions = correctiveActions.filter(a => a.status === 'مكتمل' || a.status === 'completed').length;
        const overdueActions = correctiveActions.filter(a => {
            if (!a.dueDate) return false;
            const dueDate = new Date(a.dueDate);
            return dueDate < new Date() && (a.status === 'قيد التنفيذ' || a.status === 'pending');
        }).length;

        return `
            <!-- KPI Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                <div class="content-card">
                    <div class="card-body">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">التدقيقات</p>
                                <p class="text-2xl font-bold text-blue-600">${audits.length}</p>
                            </div>
                            <div class="bg-blue-100 rounded-full p-4">
                                <i class="fas fa-clipboard-check text-2xl text-blue-600"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-body">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">عدم المطابقة</p>
                                <p class="text-2xl font-bold text-red-600">${nonConformities.length}</p>
                            </div>
                            <div class="bg-red-100 rounded-full p-4">
                                <i class="fas fa-exclamation-triangle text-2xl text-red-600"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-body">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">الإجراءات التصحيحية</p>
                                <p class="text-2xl font-bold text-yellow-600">${correctiveActions.length}</p>
                            </div>
                            <div class="bg-yellow-100 rounded-full p-4">
                                <i class="fas fa-tools text-2xl text-yellow-600"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-body">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">الأهداف</p>
                                <p class="text-2xl font-bold text-green-600">${objectives.length}</p>
                            </div>
                            <div class="bg-green-100 rounded-full p-4">
                                <i class="fas fa-bullseye text-2xl text-green-600"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-body">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">تقييمات المخاطر</p>
                                <p class="text-2xl font-bold text-purple-600">${riskAssessments.length}</p>
                            </div>
                            <div class="bg-purple-100 rounded-full p-4">
                                <i class="fas fa-shield-alt text-2xl text-purple-600"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Status Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="content-card">
                    <div class="card-header bg-yellow-50">
                        <h2 class="card-title text-yellow-800">
                            <i class="fas fa-clock ml-2"></i>
                            الإجراءات قيد التنفيذ
                        </h2>
                    </div>
                    <div class="card-body">
                        <p class="text-3xl font-bold text-yellow-600">${pendingActions}</p>
                        <p class="text-sm text-gray-600 mt-2">من إجمالي ${correctiveActions.length} إجراء</p>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-header bg-green-50">
                        <h2 class="card-title text-green-800">
                            <i class="fas fa-check-circle ml-2"></i>
                            الإجراءات المكتملة
                        </h2>
                    </div>
                    <div class="card-body">
                        <p class="text-3xl font-bold text-green-600">${completedActions}</p>
                        <p class="text-sm text-gray-600 mt-2">من إجمالي ${correctiveActions.length} إجراء</p>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-header bg-red-50">
                        <h2 class="card-title text-red-800">
                            <i class="fas fa-exclamation-circle ml-2"></i>
                            الإجراءات المتأخرة
                        </h2>
                    </div>
                    <div class="card-body">
                        <p class="text-3xl font-bold text-red-600">${overdueActions}</p>
                        <p class="text-sm text-gray-600 mt-2">يحتاج متابعة عاجلة</p>
                    </div>
                </div>
            </div>

            <!-- Recent Activity -->
            <div class="content-card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-history ml-2"></i>
                        النشاط الأخير
                    </h2>
                </div>
                <div class="card-body">
                    <div id="hse-recent-activity" class="space-y-4">
                        <div class="text-center text-gray-500 py-8">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p>جاري التحميل...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async renderAudits() {
        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-clipboard-check ml-2"></i>
                            تدقيقات HSE
                        </h2>
                        <button id="add-audit-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة تدقيق جديد
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="hse-audits-list" class="space-y-4">
                        <div class="text-center text-gray-500 py-8">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p>جاري التحميل...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async renderNonConformities() {
        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-exclamation-triangle ml-2"></i>
                            عدم المطابقة HSE
                        </h2>
                        <button id="add-non-conformity-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة عدم مطابقة جديد
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="hse-non-conformities-list" class="space-y-4">
                        <div class="text-center text-gray-500 py-8">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p>جاري التحميل...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async renderCorrectiveActions() {
        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-tools ml-2"></i>
                            الإجراءات التصحيحية HSE
                        </h2>
                        <button id="add-corrective-action-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة إجراء تصحيحي جديد
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="hse-corrective-actions-list" class="space-y-4">
                        <div class="text-center text-gray-500 py-8">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p>جاري التحميل...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async renderObjectives() {
        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-bullseye ml-2"></i>
                            أهداف HSE
                        </h2>
                        <button id="add-objective-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة هدف جديد
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="hse-objectives-list" class="space-y-4">
                        <div class="text-center text-gray-500 py-8">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p>جاري التحميل...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async renderRiskAssessments() {
        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-shield-alt ml-2"></i>
                            تقييمات مخاطر HSE
                        </h2>
                        <button id="add-risk-assessment-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة تقييم مخاطر جديد
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="hse-risk-assessments-list" class="space-y-4">
                        <div class="text-center text-gray-500 py-8">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p>جاري التحميل...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    loadDashboard() {
        const recentActivity = document.getElementById('hse-recent-activity');
        if (!recentActivity) return;

        const audits = AppState.appData?.hseAudits || [];
        const nonConformities = AppState.appData?.hseNonConformities || [];
        const correctiveActions = AppState.appData?.hseCorrectiveActions || [];
        const objectives = AppState.appData?.hseObjectives || [];
        const riskAssessments = AppState.appData?.hseRiskAssessments || [];

        // Combine all activities and sort by date
        const allActivities = [
            ...audits.map(a => ({ ...a, type: 'audit', icon: 'fa-clipboard-check', color: 'blue' })),
            ...nonConformities.map(nc => ({ ...nc, type: 'non-conformity', icon: 'fa-exclamation-triangle', color: 'red' })),
            ...correctiveActions.map(ca => ({ ...ca, type: 'corrective-action', icon: 'fa-tools', color: 'yellow' })),
            ...objectives.map(o => ({ ...o, type: 'objective', icon: 'fa-bullseye', color: 'green' })),
            ...riskAssessments.map(ra => ({ ...ra, type: 'risk-assessment', icon: 'fa-shield-alt', color: 'purple' }))
        ].sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0);
            const dateB = new Date(b.date || b.createdAt || 0);
            return dateB - dateA;
        }).slice(0, 10);

        if (allActivities.length === 0) {
            recentActivity.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>لا توجد أنشطة حديثة</p>
                </div>
            `;
            return;
        }

        recentActivity.innerHTML = allActivities.map(activity => {
            const date = new Date(activity.date || activity.createdAt);
            const dateStr = date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
            const title = activity.title || activity.description || activity.name || 'بدون عنوان';

            return `
                <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div class="bg-${activity.color}-100 rounded-full p-3">
                        <i class="fas ${activity.icon} text-${activity.color}-600"></i>
                    </div>
                    <div class="flex-1">
                        <h3 class="font-semibold text-gray-800">${Utils.escapeHTML(title)}</h3>
                        <p class="text-sm text-gray-600">${dateStr}</p>
                    </div>
                </div>
            `;
        }).join('');
    },

    loadAudits() {
        const container = document.getElementById('hse-audits-list');
        if (!container) return;

        const audits = AppState.appData?.hseAudits || [];

        if (audits.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>لا توجد تدقيقات مسجلة</p>
                </div>
            `;
            return;
        }

        container.innerHTML = audits.map(audit => {
            const date = audit.date ? new Date(audit.date).toLocaleDateString('ar-SA') : 'غير محدد';
            return `
                <div class="p-4 bg-gray-50 rounded-lg">
                    <h3 class="font-semibold text-gray-800">${Utils.escapeHTML(audit.title || audit.type || 'تدقيق')}</h3>
                    <p class="text-sm text-gray-600 mt-2">التاريخ: ${date}</p>
                </div>
            `;
        }).join('');
    },

    loadNonConformities() {
        const container = document.getElementById('hse-non-conformities-list');
        if (!container) return;

        const nonConformities = AppState.appData?.hseNonConformities || [];

        if (nonConformities.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>لا توجد حالات عدم مطابقة مسجلة</p>
                </div>
            `;
            return;
        }

        container.innerHTML = nonConformities.map(nc => {
            const date = nc.date ? new Date(nc.date).toLocaleDateString('ar-SA') : 'غير محدد';
            return `
                <div class="p-4 bg-gray-50 rounded-lg">
                    <h3 class="font-semibold text-gray-800">${Utils.escapeHTML(nc.title || nc.description || 'عدم مطابقة')}</h3>
                    <p class="text-sm text-gray-600 mt-2">التاريخ: ${date}</p>
                </div>
            `;
        }).join('');
    },

    loadCorrectiveActions() {
        const container = document.getElementById('hse-corrective-actions-list');
        if (!container) return;

        const actions = AppState.appData?.hseCorrectiveActions || [];

        if (actions.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>لا توجد إجراءات تصحيحية مسجلة</p>
                </div>
            `;
            return;
        }

        container.innerHTML = actions.map(action => {
            const date = action.date ? new Date(action.date).toLocaleDateString('ar-SA') : 'غير محدد';
            const status = action.status || 'غير محدد';
            const statusColor = status === 'مكتمل' || status === 'completed' ? 'green' :
                status === 'قيد التنفيذ' || status === 'pending' ? 'yellow' : 'gray';
            return `
                <div class="p-4 bg-gray-50 rounded-lg">
                    <h3 class="font-semibold text-gray-800">${Utils.escapeHTML(action.title || action.description || 'إجراء تصحيحي')}</h3>
                    <p class="text-sm text-gray-600 mt-2">التاريخ: ${date}</p>
                    <span class="inline-block mt-2 px-3 py-1 bg-${statusColor}-100 text-${statusColor}-800 rounded-full text-xs">${status}</span>
                </div>
            `;
        }).join('');
    },

    loadObjectives() {
        const container = document.getElementById('hse-objectives-list');
        if (!container) return;

        const objectives = AppState.appData?.hseObjectives || [];

        if (objectives.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>لا توجد أهداف مسجلة</p>
                </div>
            `;
            return;
        }

        container.innerHTML = objectives.map(objective => {
            const date = objective.date ? new Date(objective.date).toLocaleDateString('ar-SA') : 'غير محدد';
            return `
                <div class="p-4 bg-gray-50 rounded-lg">
                    <h3 class="font-semibold text-gray-800">${Utils.escapeHTML(objective.title || objective.description || 'هدف')}</h3>
                    <p class="text-sm text-gray-600 mt-2">التاريخ: ${date}</p>
                </div>
            `;
        }).join('');
    },

    loadRiskAssessments() {
        const container = document.getElementById('hse-risk-assessments-list');
        if (!container) return;

        const assessments = AppState.appData?.hseRiskAssessments || [];

        if (assessments.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-inbox text-4xl mb-2"></i>
                    <p>لا توجد تقييمات مخاطر مسجلة</p>
                </div>
            `;
            return;
        }

        container.innerHTML = assessments.map(assessment => {
            const date = assessment.date ? new Date(assessment.date).toLocaleDateString('ar-SA') : 'غير محدد';
            return `
                <div class="p-4 bg-gray-50 rounded-lg">
                    <h3 class="font-semibold text-gray-800">${Utils.escapeHTML(assessment.title || assessment.description || 'تقييم مخاطر')}</h3>
                    <p class="text-sm text-gray-600 mt-2">التاريخ: ${date}</p>
                </div>
            `;
        }).join('');
    },

    setupEventListeners() {
        // Export buttons
        const exportExcelBtn = document.getElementById('hse-export-excel-btn');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => {
                Notification.info('ميزة التصدير قيد التطوير');
            });
        }

        const exportPdfBtn = document.getElementById('hse-export-pdf-btn');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => {
                Notification.info('ميزة التصدير قيد التطوير');
            });
        }

        // Add buttons
        const addAuditBtn = document.getElementById('add-audit-btn');
        if (addAuditBtn) {
            addAuditBtn.addEventListener('click', () => {
                Notification.info('ميزة الإضافة قيد التطوير');
            });
        }

        const addNonConformityBtn = document.getElementById('add-non-conformity-btn');
        if (addNonConformityBtn) {
            addNonConformityBtn.addEventListener('click', () => {
                Notification.info('ميزة الإضافة قيد التطوير');
            });
        }

        const addCorrectiveActionBtn = document.getElementById('add-corrective-action-btn');
        if (addCorrectiveActionBtn) {
            addCorrectiveActionBtn.addEventListener('click', () => {
                Notification.info('ميزة الإضافة قيد التطوير');
            });
        }

        const addObjectiveBtn = document.getElementById('add-objective-btn');
        if (addObjectiveBtn) {
            addObjectiveBtn.addEventListener('click', () => {
                Notification.info('ميزة الإضافة قيد التطوير');
            });
        }

        const addRiskAssessmentBtn = document.getElementById('add-risk-assessment-btn');
        if (addRiskAssessmentBtn) {
            addRiskAssessmentBtn.addEventListener('click', () => {
                Notification.info('ميزة الإضافة قيد التطوير');
            });
        }
    }
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof HSE !== 'undefined') {
            window.HSE = HSE;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ HSE module loaded and available on window.HSE');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير HSE:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof HSE !== 'undefined') {
            try {
                window.HSE = HSE;
            } catch (e) {
                console.error('❌ فشل تصدير HSE:', e);
            }
        }
    }
})();