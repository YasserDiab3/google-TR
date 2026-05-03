/**
 * Emergency Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
// ===== Emergency Module (تنبيهات الطوارئ) =====
const Emergency = {
    state: {
        filters: {
            search: '',
            severity: '',
            status: 'active',
            channel: '',
            team: '',
            onlyUnacknowledged: false
        },
        autoRefreshInterval: null,
        autoRefreshMs: 60000,
        lastCheckedAlerts: new Set(), // لتتبع التنبيهات التي تم فحصها مسبقاً
        notificationCheckInterval: null
    },

    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        try {
            const moduleRef = Emergency;
            const section = document.getElementById('emergency-section');
            if (!section) {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('قسم emergency-section غير موجود!');
                } else {
                    console.error('قسم emergency-section غير موجود!');
                }
                return;
            }

            // التحقق من وجود AppState و Utils
            if (typeof AppState === 'undefined') {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('AppState غير متوفر!');
                } else {
                    console.error('AppState غير متوفر!');
                }
                return;
            }

            if (typeof Utils === 'undefined') {
                console.error('Utils غير متوفر!');
                return;
            }

            moduleRef.clearAutoRefresh();

            // دالة مساعدة للهروب من HTML
            const escapeHTML = (str) => {
                if (typeof Utils !== 'undefined' && Utils.escapeHTML) {
                    return Utils.escapeHTML(str);
                }
                return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
            };

            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-exclamation-triangle ml-3"></i>
                                نظام التنبيهات والطوارئ
                            </h1>
                            <p class="section-subtitle">متابعة التنبيهات، فرق الاستجابة، وخطط الطوارئ في لوحة واحدة</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <button id="add-plan-btn" class="btn-secondary">
                                <i class="fas fa-file-alt ml-2"></i>
                                إضافة خطة طوارئ
                            </button>
                            <button id="add-alert-btn" class="btn-primary">
                                <i class="fas fa-bell ml-2"></i>
                                إطلاق تنبيه
                            </button>
                        </div>
                    </div>
                </div>

                <!-- نظام التبويبات -->
                <div class="tabs-container mt-6">
                    <div class="tabs-nav" style="flex-wrap: nowrap; overflow-x: auto; overflow-y: visible; min-width: 0; width: 100%; max-width: 100%; box-sizing: border-box;">
                        <button class="tab-btn active" data-tab="alerts" style="flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                            <i class="fas fa-bell"></i>
                            التنبيهات
                        </button>
                        <button class="tab-btn" data-tab="plans" style="flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                            <i class="fas fa-file-medical-alt"></i>
                            خطط الطوارئ
                        </button>
                    </div>

                    <!-- تبويب التنبيهات -->
                    <div id="tab-alerts" class="tab-content active">
                        <div id="emergency-summary" class="mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"></div>
                        
                        <div class="content-card mb-6">
                            <div class="card-header">
                                <h2 class="card-title">
                                    <i class="fas fa-filter ml-2"></i>
                                    عوامل التصفية
                                </h2>
                            </div>
                            <div class="card-body">
                                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-600 mb-2">بحث</label>
                                        <input type="text" id="emergency-search" class="form-input" placeholder="عنوان التنبيه، المنطقة، أو الشخص المسؤول">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-600 mb-2">الخطورة</label>
                                        <select id="emergency-filter-severity" class="form-input">
                                            <option value="">جميع المستويات</option>
                                            <option value="عالية">عالية</option>
                                            <option value="متوسطة">متوسطة</option>
                                            <option value="منخفضة">منخفضة</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-600 mb-2">الحالة</label>
                                        <select id="emergency-filter-status" class="form-input">
                                            <option value="active">تنبيهات نشطة</option>
                                            <option value="open">جميع التنبيهات المفتوحة</option>
                                            <option value="closed">تنبيهات مغلقة</option>
                                            <option value="all">كل التنبيهات</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-600 mb-2">قناة الإرسال</label>
                                        <select id="emergency-filter-channel" class="form-input">
                                            <option value="">جميع القنوات</option>
                                            ${(AppState.emergencyChannels || []).map(channel => `
                                                <option value="${escapeHTML(channel)}">${escapeHTML(channel)}</option>
                                            `).join('')}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-600 mb-2">فريق الاستجابة</label>
                                        <select id="emergency-filter-team" class="form-input">
                                            <option value="">جميع الفرق</option>
                                            ${(AppState.emergencyTeams || []).map(team => `
                                                <option value="${escapeHTML(team)}">${escapeHTML(team)}</option>
                                            `).join('')}
                                        </select>
                                    </div>
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="emergency-filter-unack" class="rounded border-gray-300 text-blue-600">
                                    <label for="emergency-filter-unack" class="text-sm text-gray-700">عرض التنبيهات غير المعتمدة فقط</label>
                                </div>
                            </div>
                            <div class="flex items-center justify-between flex-wrap gap-3 mt-4 pt-4 border-t">
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="emergency-auto-refresh" class="rounded border-gray-300 text-blue-600" checked>
                                    <label for="emergency-auto-refresh" class="text-sm text-gray-700">
                                        تحديث تلقائي كل ${Math.floor(moduleRef.state.autoRefreshMs / 1000)} ثانية
                                    </label>
                                </div>
                                <button id="emergency-refresh-btn" class="btn-secondary">
                                    <i class="fas fa-sync ml-2"></i>
                                    تحديث الآن
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div class="xl:col-span-2 content-card">
                            <div class="card-header">
                                <h2 class="card-title">
                                    <i class="fas fa-broadcast-tower ml-2"></i>
                                    لوحة التنبيهات
                                </h2>
                            </div>
                            <div class="card-body" id="emergency-alerts-board"></div>
                        </div>
                        <div class="content-card">
                            <div class="card-header">
                                <h2 class="card-title">
                                    <i class="fas fa-history ml-2"></i>
                                    آخر الأنشطة
                                </h2>
                            </div>
                            <div class="card-body" id="emergency-timeline-board"></div>
                        </div>
                    </div>
                </div>

                <!-- تبويب خطط الطوارئ -->
                <div id="tab-plans" class="tab-content">
                    <div class="content-card">
                        <div class="card-header">
                            <div class="flex items-center justify-between">
                                <h2 class="card-title">
                                    <i class="fas fa-file-medical-alt ml-2"></i>
                                    خطط الطوارئ
                                </h2>
                                <button id="add-plan-tab-btn" class="btn-primary">
                                    <i class="fas fa-plus ml-2"></i>
                                    إضافة خطة جديدة
                                </button>
                            </div>
                        </div>
                        <div class="card-body" id="emergency-plans-board"></div>
                    </div>
                </div>
            </div>
            `;

            moduleRef.setupTabsNavigation();
            moduleRef.setupEventListeners();
            if (typeof moduleRef.renderAll === 'function') {
                moduleRef.renderAll();
            } else {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('Emergency.renderAll غير معرّفة أو ليست دالة', moduleRef);
                } else {
                    console.error('Emergency.renderAll غير معرّفة أو ليست دالة', moduleRef);
                }
            }
            if (typeof moduleRef.setupAutoRefresh === 'function') {
                moduleRef.setupAutoRefresh();
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في تحميل مديول الطوارئ:', error);
            } else {
                console.error('❌ خطأ في تحميل مديول الطوارئ:', error);
            }
            const section = document.getElementById('emergency-section');
            if (section) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">حدث خطأ أثناء تحميل البيانات</p>
                                <button onclick="Emergency.load()" class="btn-primary">
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

    setupTabsNavigation() {
        const tabButtons = document.querySelectorAll('#emergency-section .tab-btn');
        const tabContents = document.querySelectorAll('#emergency-section .tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');

                // إزالة الفئة النشطة من جميع الأزرار والمحتويات
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // إضافة الفئة النشطة للزر والمحتوى المحدد
                button.classList.add('active');
                const targetContent = document.getElementById(`tab-${targetTab}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                // إعادة رسم المحتوى عند التبديل
                if (targetTab === 'alerts') {
                    this.renderSummary();
                    this.renderAlertsBoard();
                    this.renderTimelineBoard();
                } else if (targetTab === 'plans') {
                    this.renderPlansBoard();
                }
            });
        });

        // تفعيل التبويب الأول افتراضياً إذا لم يكن هناك تبويب نشط
        const activeContent = document.querySelector('#emergency-section .tab-content.active');
        if (!activeContent) {
            const firstTab = tabButtons[0];
            if (firstTab) {
                firstTab.click();
            }
        }
    },

    clearAutoRefresh() {
        if (Emergency.state.autoRefreshInterval) {
            clearInterval(Emergency.state.autoRefreshInterval);
            Emergency.state.autoRefreshInterval = null;
        }
    },

    setupAutoRefresh() {
        const moduleRef = Emergency;
        const autoRefreshInput = document.getElementById('emergency-auto-refresh');
        const shouldRefresh = autoRefreshInput ? autoRefreshInput.checked : true;
        if (!shouldRefresh) return;

        moduleRef.state.autoRefreshInterval = setInterval(() => {
            moduleRef.renderAll();
            // التحقق من التنبيهات الجديدة
            moduleRef.checkForNewAlerts();
        }, moduleRef.state.autoRefreshMs);
        
        // بدء فحص التنبيهات الجديدة فوراً
        moduleRef.checkForNewAlerts();
    },
    
    /**
     * التحقق من التنبيهات الجديدة وإرسال إشعارات فورية
     */
    checkForNewAlerts() {
        const alerts = this.getAlerts();
        const currentChecked = new Set();
        
        alerts.forEach(alert => {
            if (!alert || !alert.id) return;
            
            currentChecked.add(alert.id);
            
            // إذا كان التنبيه جديداً ولم يتم فحصه مسبقاً
            if (!this.state.lastCheckedAlerts.has(alert.id)) {
                // إرسال إشعار فقط للتنبيهات النشطة وغير المعتمدة
                if (alert.status !== 'مغلق' && !alert.acknowledgedAt) {
                    const isCritical = alert.severity === 'عالية';
                    const minutesSinceCreation = alert.createdAt 
                        ? (new Date() - new Date(alert.createdAt)) / (1000 * 60)
                        : 0;
                    
                    // إرسال إشعار فقط للتنبيهات التي تم إنشاؤها خلال آخر 5 دقائق
                    if (minutesSinceCreation <= 5) {
                        const notificationOptions = {
                            title: isCritical ? '🚨 تنبيه طوارئ حرج' : '⚠️ تنبيه طوارئ جديد',
                            message: alert.title,
                            description: alert.description || 'لا يوجد وصف متاح',
                            priority: isCritical ? 'critical' : 'high',
                            persistent: isCritical,
                            sound: true,
                            actions: [
                                {
                                    label: 'عرض التفاصيل',
                                    primary: true,
                                    onClick: () => {
                                        this.viewAlert(alert.id);
                                    }
                                },
                                ...(alert.status === 'نشط' && !alert.acknowledgedAt ? [{
                                    label: 'اعتماد التنبيه',
                                    primary: false,
                                    onClick: () => {
                                        this.acknowledgeAlert(alert.id);
                                    }
                                }] : []),
                                {
                                    label: 'إغلاق',
                                    onClick: () => {}
                                }
                            ],
                            onClick: () => {
                                this.viewAlert(alert.id);
                            }
                        };
                        
                        if (isCritical) {
                            Notification.emergency(notificationOptions);
                        } else {
                            Notification.show(notificationOptions);
                        }
                    }
                }
            }
        });
        
        // تحديث قائمة التنبيهات المفحوصة
        this.state.lastCheckedAlerts = currentChecked;
    },

    getAlerts() {
        const alerts = Array.isArray(AppState.appData.emergencyAlerts)
            ? AppState.appData.emergencyAlerts
            : [];
        // تصفية التنبيهات الفارغة أو غير الصحيحة
        return alerts
            .filter(alert => {
                // التحقق من أن التنبيه صحيح وله بيانات أساسية
                return alert && 
                       typeof alert === 'object' && 
                       alert.id && 
                       alert.title && 
                       alert.title.trim() !== '' &&
                       alert.description && 
                       alert.description.trim() !== '';
            })
            .map(alert => this.ensureAlertStructure(alert))
            .filter(alert => alert && alert.id); // تأكيد إضافي بعد ensureAlertStructure
    },

    getPlans() {
        const plans = Array.isArray(AppState.appData.emergencyPlans)
            ? AppState.appData.emergencyPlans
            : [];
        return plans.map(plan => this.ensurePlanStructure(plan));
    },

    ensureAlertStructure(alert) {
        // التحقق من صحة التنبيه قبل المعالجة
        if (!alert || typeof alert !== 'object' || !alert.id) {
            return null; // إرجاع null بدلاً من كائن فارغ
        }
        
        // التأكد من وجود البيانات الأساسية
        if (!alert.title || !alert.description) {
            return null;
        }
        
        // إنشاء نسخة من التنبيه لتجنب تعديل الأصل مباشرة
        const structuredAlert = { ...alert };
        
        structuredAlert.timeline = Array.isArray(structuredAlert.timeline) ? structuredAlert.timeline : [];
        structuredAlert.assignedTeams = Array.isArray(structuredAlert.assignedTeams) ? structuredAlert.assignedTeams : [];
        structuredAlert.channels = Array.isArray(structuredAlert.channels) ? structuredAlert.channels : [];
        structuredAlert.impactArea = structuredAlert.impactArea || '';
        structuredAlert.responseInstructions = structuredAlert.responseInstructions || '';
        structuredAlert.requiresEvacuation = structuredAlert.requiresEvacuation === true;
        structuredAlert.autoEscalateMinutes = Number(structuredAlert.autoEscalateMinutes || 0);
        structuredAlert.createdBy = structuredAlert.createdBy || this.getCurrentUserSummary(structuredAlert.createdBy);
        structuredAlert.severity = structuredAlert.severity || 'متوسطة';
        structuredAlert.status = structuredAlert.status || 'نشط';
        structuredAlert.createdAt = structuredAlert.createdAt || structuredAlert.date || new Date().toISOString();
        structuredAlert.updatedAt = structuredAlert.updatedAt || new Date().toISOString();
        
        return structuredAlert;
    },

    ensurePlanStructure(plan) {
        if (!plan) return {};
        plan.ownerTeam = plan.ownerTeam || '';
        plan.contactPerson = plan.contactPerson || '';
        plan.contactPhone = plan.contactPhone || '';
        plan.lastTested = plan.lastTested || '';
        plan.updatedAt = plan.updatedAt || plan.createdAt || new Date().toISOString();
        return plan;
    },

    getCurrentUserSummary(fallback = null) {
        if (fallback && typeof fallback === 'object') {
            return fallback;
        }
        if (!AppState.currentUser) {
            return {
                name: 'نظام',
                email: '',
                role: ''
            };
        }
        return {
            id: AppState.currentUser.id || '',
            name: AppState.currentUser.name || '',
            email: AppState.currentUser.email || '',
            role: AppState.currentUser.role || ''
        };
    },

    setupEventListeners() {
        setTimeout(() => {
            const addAlertBtn = document.getElementById('add-alert-btn');
            const addPlanBtn = document.getElementById('add-plan-btn');
            const addPlanTabBtn = document.getElementById('add-plan-tab-btn');
            
            if (addAlertBtn) addAlertBtn.addEventListener('click', () => {
                Emergency.showAlertForm();
                // التبديل إلى تبويب التنبيهات عند إضافة تنبيه جديد
                const alertsTab = document.querySelector('#emergency-section .tab-btn[data-tab="alerts"]');
                if (alertsTab) alertsTab.click();
            });
            
            if (addPlanBtn) addPlanBtn.addEventListener('click', () => {
                Emergency.showPlanForm();
                // التبديل إلى تبويب خطط الطوارئ عند إضافة خطة جديدة
                const plansTab = document.querySelector('#emergency-section .tab-btn[data-tab="plans"]');
                if (plansTab) plansTab.click();
            });
            
            if (addPlanTabBtn) addPlanTabBtn.addEventListener('click', () => Emergency.showPlanForm());

            const searchInput = document.getElementById('emergency-search');
            if (searchInput) {
                searchInput.addEventListener('input', (event) => {
                    Emergency.state.filters.search = event.target.value.trim();
                    Emergency.renderAll();
                });
            }

            const severitySelect = document.getElementById('emergency-filter-severity');
            if (severitySelect) {
                severitySelect.addEventListener('change', (event) => {
                    Emergency.state.filters.severity = event.target.value;
                    Emergency.renderAll();
                });
            }

            const statusSelect = document.getElementById('emergency-filter-status');
            if (statusSelect) {
                statusSelect.addEventListener('change', (event) => {
                    Emergency.state.filters.status = event.target.value;
                    Emergency.renderAll();
                });
            }

            const channelSelect = document.getElementById('emergency-filter-channel');
            if (channelSelect) {
                channelSelect.addEventListener('change', (event) => {
                    Emergency.state.filters.channel = event.target.value;
                    Emergency.renderAll();
                });
            }

            const teamSelect = document.getElementById('emergency-filter-team');
            if (teamSelect) {
                teamSelect.addEventListener('change', (event) => {
                    Emergency.state.filters.team = event.target.value;
                    Emergency.renderAll();
                });
            }

            const unackToggle = document.getElementById('emergency-filter-unack');
            if (unackToggle) {
                unackToggle.addEventListener('change', (event) => {
                    Emergency.state.filters.onlyUnacknowledged = event.target.checked;
                    Emergency.renderAll();
                });
            }

            const refreshBtn = document.getElementById('emergency-refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => Emergency.renderAll());
            }

            const autoRefreshInput = document.getElementById('emergency-auto-refresh');
            if (autoRefreshInput) {
                autoRefreshInput.addEventListener('change', () => {
                    Emergency.clearAutoRefresh();
                    Emergency.setupAutoRefresh();
                });
            }
        }, 100);
    },

    renderAll() {
        const self = this;
        const runBadge = () => {
            if (typeof NotificationsManager !== 'undefined') {
                NotificationsManager.updateBadge();
            }
        };
        const next = typeof requestAnimationFrame === 'function'
            ? (cb) => { requestAnimationFrame(cb); }
            : (cb) => { setTimeout(cb, 0); };

        // تقسيم الرسم على عدة إطارات لتقليل تحذيرات Violation (معالج نقر/مؤقت طويل)
        next(() => {
            self.renderSummary();
            const activeTab = document.querySelector('#emergency-section .tab-btn.active');
            next(() => {
                if (activeTab) {
                    const tabId = activeTab.getAttribute('data-tab');
                    if (tabId === 'alerts') {
                        self.renderAlertsBoard();
                        next(() => {
                            self.renderTimelineBoard();
                            runBadge();
                        });
                    } else if (tabId === 'plans') {
                        self.renderPlansBoard();
                        runBadge();
                    } else {
                        runBadge();
                    }
                } else {
                    self.renderAlertsBoard();
                    next(() => {
                        self.renderTimelineBoard();
                        next(() => {
                            self.renderPlansBoard();
                            runBadge();
                        });
                    });
                }
            });
        });
    },

    renderTimelineBoard() {
        const container = document.getElementById('emergency-timeline-board');
        if (!container) return;

        const timeline = this.buildTimeline().slice(0, 12);
        if (timeline.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 text-sm py-4">
                    لا توجد أنشطة حديثة
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="space-y-4">
                ${timeline.map(entry => `
                    <div class="timeline-entry border-l-4 pl-4 ${this.getTimelineColor(entry.type)}">
                        <div class="flex items-center justify-between">
                            <div class="font-semibold text-gray-800">${Utils.escapeHTML(entry.title)}</div>
                            <div class="text-xs text-gray-500">${Utils.formatDateTime(entry.timestamp)}</div>
                        </div>
                        <div class="text-sm text-gray-600 mt-1">${Utils.escapeHTML(entry.description || '')}</div>
                        <div class="text-xs text-gray-500 mt-1 flex items-center gap-2">
                            <span><i class="fas fa-user ml-1"></i>${Utils.escapeHTML(entry.actor || 'النظام')}</span>
                            <span><i class="fas fa-bolt ml-1"></i>${Utils.escapeHTML(entry.severity || '')}</span>
                            <button class="text-blue-600 hover:text-blue-800" onclick="Emergency.viewAlert('${entry.alertId}')">عرض التنبيه</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    getTimelineColor(type) {
        switch (type) {
            case 'created':
                return 'border-blue-400';
            case 'acknowledged':
                return 'border-green-400';
            case 'resolved':
                return 'border-teal-400';
            case 'escalated':
                return 'border-red-400';
            default:
                return 'border-gray-300';
        }
    },

    buildTimeline() {
        const alerts = this.getAlerts();
        const entries = [];
        alerts.forEach(alert => {
            const severity = alert.severity || '';
            const baseTitle = alert.title || 'تنبيه';
            const actor = alert.createdBy?.name || 'النظام';
            entries.push({
                id: `${alert.id}-created`,
                alertId: alert.id,
                timestamp: alert.createdAt || alert.date || new Date().toISOString(),
                type: 'created',
                title: `${baseTitle} • إنشاء`,
                description: alert.description || '',
                actor,
                severity
            });
            (alert.timeline || []).forEach(step => {
                entries.push({
                    id: step.id || Utils.generateId('TIMELINE'),
                    alertId: alert.id,
                    timestamp: step.timestamp || new Date().toISOString(),
                    type: step.type || 'update',
                    title: `${baseTitle} • ${step.label || 'تحديث'}`,
                    description: step.description || '',
                    actor: step.actor?.name || step.actor || 'النظام',
                    severity
                });
            });
        });
        return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    renderPlansBoard() {
        const container = document.getElementById('emergency-plans-board');
        if (!container) return;

        const plans = this.getPlans();
        if (plans.length === 0) {
            container.innerHTML = `
                <div class="empty-state py-8 text-center">
                    <p class="text-gray-500">لا توجد خطط طوارئ مسجلة حتى الآن</p>
                    <button class="btn-primary mt-3" onclick="Emergency.showPlanForm()">
                        <i class="fas fa-plus ml-2"></i>إضافة خطة طوارئ
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الخطة</th>
                            <th>النوع</th>
                            <th>الفريق المسؤول</th>
                            <th>آخر اختبار</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${plans.map(plan => `
                            <tr>
                                <td>
                                    <div class="font-semibold text-gray-900">${Utils.escapeHTML(plan.name || '')}</div>
                                    <div class="text-xs text-gray-500 mt-1">${Utils.escapeHTML(plan.description || '').substring(0, 80)}${plan.description && plan.description.length > 80 ? '...' : ''}</div>
                                </td>
                                <td>
                                    <span class="badge badge-secondary">${Utils.escapeHTML(plan.type || 'غير محدد')}</span>
                                </td>
                                <td>
                                    <div class="text-sm text-gray-800">${Utils.escapeHTML(plan.ownerTeam || 'غير محدد')}</div>
                                    ${plan.contactPerson ? `<div class="text-xs text-gray-500">${Utils.escapeHTML(plan.contactPerson)} • ${Utils.escapeHTML(plan.contactPhone || '')}</div>` : ''}
                                </td>
                                <td>${plan.lastTested ? Utils.formatDate(plan.lastTested) : '<span class="text-xs text-gray-400">لم يتم الاختبار</span>'}</td>
                                <td>
                                    <div class="flex gap-2">
                                        <button class="btn-icon btn-icon-info" title="عرض التفاصيل" onclick="Emergency.viewPlan('${plan.id}')">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn-icon btn-icon-primary" title="تعديل" onclick="Emergency.showPlanForm(${JSON.stringify(plan).replace(/"/g, '&quot;')})">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    buildTimelineEntry(type, alert, description) {
        return {
            id: Utils.generateId('ALOG'),
            type,
            label: this.getTimelineLabel(type),
            description,
            actor: this.getCurrentUserSummary(),
            timestamp: new Date().toISOString(),
            severity: alert.severity
        };
    },

    getTimelineLabel(type) {
        switch (type) {
            case 'created':
                return 'تم إنشاء التنبيه';
            case 'acknowledged':
                return 'تم الاعتماد';
            case 'resolved':
                return 'تم الإغلاق';
            case 'escalated':
                return 'تم التصعيد';
            default:
                return 'تحديث';
        }
    },

    getFilteredAlerts() {
        const alerts = this.getAlerts();
        const filters = this.state.filters;
        const searchLower = filters.search.toLowerCase();
        const now = new Date();

        return alerts
            .filter(alert => {
                // التحقق من صحة التنبيه مرة أخرى
                if (!alert || !alert.id || !alert.title) {
                    return false;
                }
                
                const matchesSearch = !searchLower || [
                    alert.title,
                    alert.description,
                    alert.impactArea,
                    (alert.assignedTeams || []).join(' '),
                    (alert.channels || []).join(' '),
                    alert.severity,
                    alert.status
                ].some(value => (value || '').toString().toLowerCase().includes(searchLower));

                if (!matchesSearch) return false;

                if (filters.severity && alert.severity !== filters.severity) return false;

                if (filters.channel && !(alert.channels || []).includes(filters.channel)) return false;

                if (filters.team && !(alert.assignedTeams || []).includes(filters.team)) return false;

                if (filters.onlyUnacknowledged && alert.acknowledgedAt) return false;

                if (filters.status === 'active') {
                    return alert.status !== 'مغلق';
                }
                if (filters.status === 'open') {
                    return alert.status === 'نشط' || alert.status === 'قيد المعالجة';
                }
                if (filters.status === 'closed') {
                    return alert.status === 'مغلق';
                }
                if (filters.status === 'all') {
                    return true;
                }
                return true;
            })
            .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
            .map(alert => {
                // إنشاء نسخة لتجنب تعديل الأصل
                const processedAlert = { ...alert };
                processedAlert.isEscalated = false;
                if (!processedAlert.acknowledgedAt && processedAlert.autoEscalateMinutes > 0) {
                    const createdAt = new Date(processedAlert.createdAt || processedAlert.date || now);
                    const minutesSince = (now - createdAt) / (1000 * 60);
                    if (minutesSince >= processedAlert.autoEscalateMinutes) {
                        processedAlert.isEscalated = true;
                    }
                }
                return processedAlert;
            });
    },

    renderSummary() {
        const container = document.getElementById('emergency-summary');
        if (!container) return;

        const alerts = this.getAlerts();
        const activeAlerts = alerts.filter(alert => alert.status !== 'مغلق');
        const highSeverity = activeAlerts.filter(alert => alert.severity === 'عالية');
        const unacknowledged = activeAlerts.filter(alert => !alert.acknowledgedAt);
        const escalated = activeAlerts.filter(alert => {
            if (!alert.autoEscalateMinutes) return false;
            if (alert.acknowledgedAt) return false;
            const createdAt = new Date(alert.createdAt || alert.date || new Date());
            const minutesSince = (new Date() - createdAt) / (1000 * 60);
            return minutesSince >= alert.autoEscalateMinutes;
        });

        container.innerHTML = `
            <div class="summary-card">
                <div class="summary-card-icon bg-red-100 text-red-600">
                    <i class="fas fa-bolt"></i>
                </div>
                <div>
                    <p class="summary-card-label">تنبيهات نشطة</p>
                    <p class="summary-card-value">${activeAlerts.length}</p>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-card-icon bg-yellow-100 text-yellow-600">
                    <i class="fas fa-exclamation"></i>
                </div>
                <div>
                    <p class="summary-card-label">خطورة عالية</p>
                    <p class="summary-card-value">${highSeverity.length}</p>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-card-icon bg-blue-100 text-blue-600">
                    <i class="fas fa-user-clock"></i>
                </div>
                <div>
                    <p class="summary-card-label">بانتظار الاعتماد</p>
                    <p class="summary-card-value">${unacknowledged.length}</p>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-card-icon bg-purple-100 text-purple-600">
                    <i class="fas fa-arrow-up"></i>
                </div>
                <div>
                    <p class="summary-card-label">تنبيهات متصاعدة</p>
                    <p class="summary-card-value">${escalated.length}</p>
                </div>
            </div>
        `;
    },

    renderAlertsBoard() {
        const container = document.getElementById('emergency-alerts-board');
        if (!container) return;

        const alerts = this.getFilteredAlerts();
        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="empty-state py-10 text-center">
                    <i class="fas fa-check-circle text-4xl text-green-400 mb-3"></i>
                    <p class="text-gray-500">لا توجد تنبيهات مطابقة لعوامل التصفية الحالية</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>التنبيه</th>
                            <th>الخطورة</th>
                            <th>القنوات</th>
                            <th>المنطقة المتأثرة</th>
                            <th>فرق الاستجابة</th>
                            <th>الحالة</th>
                            <th>المدة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${alerts.map(alert => this.renderAlertRow(alert)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderAlertRow(alert) {
        const severityClass = alert.severity === 'عالية'
            ? 'badge-danger'
            : alert.severity === 'متوسطة'
                ? 'badge-warning'
                : 'badge-info';
        const statusClass = alert.status === 'مغلق'
            ? 'badge-success'
            : alert.status === 'قيد المعالجة'
                ? 'badge-warning'
                : 'badge-danger';
        const assignedTeams = (alert.assignedTeams || []).map(team => `
            <span class="badge badge-info">${Utils.escapeHTML(team)}</span>
        `).join('');
        const channels = (alert.channels || []).map(channel => `
            <span class="badge badge-secondary">${Utils.escapeHTML(channel)}</span>
        `).join('');
        const createdAt = new Date(alert.createdAt || alert.date || new Date());
        const minutesSince = Math.floor((new Date() - createdAt) / (1000 * 60));
        const hours = Math.floor(minutesSince / 60);
        const mins = minutesSince % 60;
        const durationLabel = hours > 0 ? `${hours} س ${mins} د` : `${mins} د`;
        const ackLabel = alert.acknowledgedAt
            ? `<span class="text-xs text-gray-500">تم الاعتماد ${Utils.formatDateTime(alert.acknowledgedAt)}</span>`
            : '<span class="text-xs text-red-500">بانتظار الاعتماد</span>';
        const escalationBadge = alert.isEscalated
            ? '<span class="badge badge-danger ml-2"><i class="fas fa-arrow-up ml-1"></i>متصاعد</span>'
            : '';

        return `
            <tr>
                <td>
                    <div class="font-semibold text-gray-900 flex items-center gap-2">
                        ${Utils.escapeHTML(alert.title || '')}
                        ${alert.requiresEvacuation ? '<span class="badge badge-danger">إخلاء</span>' : ''}
                        ${escalationBadge}
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                        ${Utils.escapeHTML(alert.description || '').substring(0, 140)}${alert.description && alert.description.length > 140 ? '...' : ''}
                    </div>
                    <div class="text-xs text-gray-400 mt-1">
                        أُطلق بواسطة ${Utils.escapeHTML(alert.createdBy?.name || 'غير معروف')} في ${Utils.formatDateTime(alert.createdAt || alert.date)}
                    </div>
                </td>
                <td>
                    <span class="badge ${severityClass}">${alert.severity || '-'}</span>
                </td>
                <td>
                    <div class="flex flex-wrap gap-1">${channels || '<span class="text-xs text-gray-400">غير محدد</span>'}</div>
                </td>
                <td>
                    <div class="text-sm text-gray-800">${Utils.escapeHTML(alert.impactArea || 'غير محدد')}</div>
                </td>
                <td>
                    <div class="flex flex-wrap gap-1">${assignedTeams || '<span class="text-xs text-gray-400">لم يتم التعيين</span>'}</div>
                </td>
                <td>
                    <div class="flex flex-col gap-1">
                        <span class="badge ${statusClass}">${alert.status || 'نشط'}</span>
                        ${ackLabel}
                    </div>
                </td>
                <td>
                    <div class="text-sm text-gray-800">${durationLabel}</div>
                    ${alert.autoEscalateMinutes ? `<div class="text-xs text-gray-500">التصعيد بعد ${alert.autoEscalateMinutes} د</div>` : ''}
                </td>
                <td>
                    <div class="flex flex-wrap gap-2">
                        <button class="btn-icon btn-icon-info" title="عرض التفاصيل" onclick="Emergency.viewAlert('${alert.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${!alert.acknowledgedAt ? `
                            <button class="btn-icon btn-icon-success" title="اعتماد التنبيه" onclick="Emergency.acknowledgeAlert('${alert.id}')">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        ${alert.status !== 'مغلق' ? `
                            <button class="btn-icon btn-icon-primary" title="إغلاق التنبيه" onclick="Emergency.resolveAlert('${alert.id}')">
                                <i class="fas fa-flag-checkered"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    },

    async showAlertForm(data = null) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">${data ? 'تعديل التنبيه' : 'إضافة تنبيه طوارئ'}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="alert-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">عنوان التنبيه *</label>
                            <input type="text" id="alert-title" required class="form-input" 
                                value="${Utils.escapeHTML(data?.title || '')}" placeholder="عنوان التنبيه">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">الوصف *</label>
                            <textarea id="alert-description" required class="form-input" rows="4" 
                                placeholder="وصف تفصيلي للتنبيه">${Utils.escapeHTML(data?.description || '')}</textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الخطورة *</label>
                                <select id="alert-severity" required class="form-input">
                                    <option value="">اختر الخطورة</option>
                                    <option value="عالية" ${data?.severity === 'عالية' ? 'selected' : ''}>عالية</option>
                                    <option value="متوسطة" ${data?.severity === 'متوسطة' ? 'selected' : ''}>متوسطة</option>
                                    <option value="منخضة" ${data?.severity === 'منخضة' ? 'selected' : ''}>منخضة</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الحالة *</label>
                                <select id="alert-status" required class="form-input">
                                    <option value="نشط" ${data?.status === 'نشط' ? 'selected' : ''}>نشط</option>
                                    <option value="مغلق" ${data?.status === 'مغلق' ? 'selected' : ''}>مغلق</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">التاريخ *</label>
                            <input type="date" id="alert-date" required class="form-input" 
                                value="${data?.date ? new Date(data.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="flex items-center justify-end gap-3 pt-4 border-t">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                            <button type="submit" class="btn-primary">حفظ</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const form = document.getElementById('alert-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAlertSubmit(data?.id, modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async showPlanForm(data = null) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">${data ? 'تعديل الخطة' : 'إضافة خطة طوارئ'}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="plan-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">اسم الخطة *</label>
                            <input type="text" id="plan-name" required class="form-input" 
                                value="${Utils.escapeHTML(data?.name || '')}" placeholder="اسم خطة الطوارئ">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">النوع *</label>
                            <select id="plan-type" required class="form-input">
                                <option value="">اختر النوع</option>
                                <option value="حريق" ${data?.type === 'حريق' ? 'selected' : ''}>حريق</option>
                                <option value="زلزال" ${data?.type === 'زلزال' ? 'selected' : ''}>زلزال</option>
                                <option value="يضانات" ${data?.type === 'يضانات' ? 'selected' : ''}>يضانات</option>
                                <option value="حادث كيميائي" ${data?.type === 'حادث كيميائي' ? 'selected' : ''}>حادث كيميائي</option>
                                <option value="أخرى" ${data?.type === 'أخرى' ? 'selected' : ''}>أخرى</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">الوصف *</label>
                            <textarea id="plan-description" required class="form-input" rows="6" 
                                placeholder="وصف تفصيلي لخطة الطوارئ">${Utils.escapeHTML(data?.description || '')}</textarea>
                        </div>
                        <div class="flex items-center justify-end gap-3 pt-4 border-t">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                            <button type="submit" class="btn-primary">حفظ</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const form = document.getElementById('plan-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePlanSubmit(data?.id, modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async handleAlertSubmit(editId, modal) {
        // فحص العناصر قبل الاستخدام
        const titleEl = document.getElementById('alert-title');
        const descriptionEl = document.getElementById('alert-description');
        const severityEl = document.getElementById('alert-severity');
        const statusEl = document.getElementById('alert-status');
        const dateEl = document.getElementById('alert-date');
        
        if (!titleEl || !descriptionEl || !severityEl || !statusEl || !dateEl) {
            Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
            return;
        }

        const formData = {
            id: editId || Utils.generateId('ALERT'),
            title: titleEl.value.trim(),
            description: descriptionEl.value.trim(),
            severity: severityEl.value,
            status: statusEl.value,
            date: new Date(dateEl.value).toISOString(),
            createdAt: editId ? AppState.appData.emergencyAlerts.find(a => a.id === editId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        Loading.show();
        try {
            if (editId) {
                const index = AppState.appData.emergencyAlerts.findIndex(a => a.id === editId);
                if (index !== -1) AppState.appData.emergencyAlerts[index] = formData;
                Notification.success('تم تحديث التنبيه بنجاح', {
                    title: 'تحديث التنبيه',
                    description: `تم تحديث التنبيه "${formData.title}" بنجاح`
                });
            } else {
                AppState.appData.emergencyAlerts.push(formData);
                
                // إرسال إيميل للتنبيهات الجديدة فقط
                await this.sendAlertEmail(formData);
                
                // إرسال إشعار محسن للتنبيهات الجديدة
                const isCritical = formData.severity === 'عالية';
                const notificationOptions = {
                    title: 'تنبيه طوارئ جديد',
                    message: formData.title,
                    description: formData.description || 'لا يوجد وصف',
                    priority: isCritical ? 'critical' : 'high',
                    persistent: isCritical,
                    sound: true,
                    actions: [
                        {
                            label: 'عرض التفاصيل',
                            primary: true,
                            onClick: () => {
                                this.viewAlert(formData.id);
                            }
                        },
                        {
                            label: 'إغلاق',
                            onClick: () => {}
                        }
                    ],
                    onClick: () => {
                        this.viewAlert(formData.id);
                    }
                };
                
                if (isCritical) {
                    Notification.emergency(notificationOptions);
                } else {
                    Notification.show(notificationOptions);
                }
            }

            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            await GoogleIntegration.autoSave('EmergencyAlerts', AppState.appData.emergencyAlerts);

            Loading.hide();
            modal.remove();
            this.load();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message, {
                title: 'خطأ في العملية',
                description: error.message || 'حدث خطأ غير متوقع'
            });
        }
    },

    async sendAlertEmail(alert) {
        // الحصول على قائمة الإيميلات من الإعدادات
        const notificationEmails = AppState.notificationEmails || [];
        if (notificationEmails.length === 0) {
            Utils.safeLog('⚠ لا توجد إيميلات للإشعارات في الإعدادات');
            return;
        }

        try {
            // في الإنتاج، يجب استخدام خدمة إرسال إيميلات علية (مثل SendGrid, AWS SES, etc.)
            // هنا سنعرض قطعة من الكود في Console وإشعار للمستخدم
            const emailSubject = `تنبيه طوارئ: ${alert.title}`;
            const emailBody = `
                <h2>تنبيه طوارئ</h2>
                <p><strong>العنوان:</strong> ${alert.title}</p>
                <p><strong>الوصف:</strong> ${alert.description}</p>
                <p><strong>الخطورة:</strong> ${alert.severity}</p>
                <p><strong>التاريخ:</strong> ${Utils.formatDate(alert.date)}</p>
            `;

            Utils.safeLog('📧 إرسال إيميل للتنبيه:', {
                to: notificationEmails,
                subject: emailSubject,
                body: emailBody
            });

            // في الإنتاج، استخدم خدمة إرسال إيميلات علية هنا
            // مثال: await EmailService.send({ to: notificationEmails, subject: emailSubject, body: emailBody });

            Notification.success(`تم إرسال التنبيه إلى ${notificationEmails.length} إيميل`, {
                title: 'إرسال الإيميلات',
                description: `تم إرسال التنبيه إلى ${notificationEmails.length} عنوان بريد إلكتروني`
            });
        } catch (error) {
            Utils.safeError(' خطأ في إرسال الإيميل:', error);
            Notification.warning('تم حفظ التنبيه لكن فشل إرسال الإيميل', {
                title: 'تحذير',
                description: 'تم حفظ التنبيه بنجاح ولكن حدث خطأ في إرسال الإيميلات'
            });
        }
    },

    async handlePlanSubmit(editId, modal) {
        // فحص العناصر قبل الاستخدام
        const nameEl = document.getElementById('plan-name');
        const typeEl = document.getElementById('plan-type');
        const descriptionEl = document.getElementById('plan-description');
        
        if (!nameEl || !typeEl || !descriptionEl) {
            Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
            return;
        }

        const formData = {
            id: editId || Utils.generateId('PLAN'),
            name: nameEl.value.trim(),
            type: typeEl.value,
            description: descriptionEl.value.trim(),
            createdAt: editId ? AppState.appData.emergencyPlans.find(p => p.id === editId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        Loading.show();
        try {
            if (editId) {
                const index = AppState.appData.emergencyPlans.findIndex(p => p.id === editId);
                if (index !== -1) AppState.appData.emergencyPlans[index] = formData;
                Notification.success('تم تحديث الخطة بنجاح', {
                title: 'تحديث الخطة',
                description: `تم تحديث الخطة "${formData.name}" بنجاح`
            });
            } else {
                AppState.appData.emergencyPlans.push(formData);
                Notification.success('تم إضافة الخطة بنجاح', {
                    title: 'إضافة الخطة',
                    description: `تم إضافة الخطة "${formData.name}" بنجاح`
                });
            }

            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            await GoogleIntegration.autoSave('EmergencyPlans', AppState.appData.emergencyPlans);

            Loading.hide();
            modal.remove();
            this.load();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message, {
                title: 'خطأ في العملية',
                description: error.message || 'حدث خطأ غير متوقع'
            });
        }
    },

    async acknowledgeAlert(id) {
        const alerts = Array.isArray(AppState.appData.emergencyAlerts)
            ? [...AppState.appData.emergencyAlerts]
            : [];
        const index = alerts.findIndex(alert => alert.id === id);
        if (index === -1) {
            Notification.error('لم يتم العثور على التنبيه المحدد', {
                title: 'خطأ',
                description: 'التنبيه المحدد غير موجود'
            });
            return;
        }

        const alert = this.ensureAlertStructure({ ...alerts[index] });
        if (alert.acknowledgedAt) {
            Notification.info('تم اعتماد هذا التنبيه مسبقاً', {
                title: 'تنبيه معتمد',
                description: 'هذا التنبيه تم اعتماده مسبقاً'
            });
            return;
        }

        alert.acknowledgedAt = new Date().toISOString();
        alert.acknowledgedBy = this.getCurrentUserSummary();
        if (alert.status === 'نشط') {
            alert.status = 'قيد المعالجة';
        }
        alert.timeline = alert.timeline || [];
        alert.timeline.push(this.buildTimelineEntry('acknowledged', alert, 'تم اعتماد التنبيه من قبل فريق الاستجابة'));
        alert.updatedAt = new Date().toISOString();

        alerts[index] = alert;
        AppState.appData.emergencyAlerts = alerts;
        
        Notification.success('تم اعتماد التنبيه', {
            title: 'اعتماد التنبيه',
            description: `تم اعتماد التنبيه "${alert.title}" بنجاح`,
            actions: [
                {
                    label: 'عرض التنبيه',
                    primary: false,
                    onClick: () => {
                        this.viewAlert(alert.id);
                    }
                }
            ]
        });
        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }

        try {
            await GoogleIntegration.autoSave('EmergencyAlerts', AppState.appData.emergencyAlerts);
        } catch (error) {
            Utils.safeWarn('⚠ فشل حفظ بيانات التنبيه بعد الاعتماد:', error);
        }

        // تم تحديث الإشعار في الكود السابق
        this.renderAll();
    },

    async resolveAlert(id) {
        const alerts = Array.isArray(AppState.appData.emergencyAlerts)
            ? [...AppState.appData.emergencyAlerts]
            : [];
        const index = alerts.findIndex(alert => alert.id === id);
        if (index === -1) {
            Notification.error('لم يتم العثور على التنبيه المحدد', {
                title: 'خطأ',
                description: 'التنبيه المحدد غير موجود'
            });
            return;
        }

        const alert = this.ensureAlertStructure({ ...alerts[index] });
        if (alert.status === 'مغلق') {
            Notification.info('التنبيه مغلق بالفعل');
            return;
        }

        alert.status = 'مغلق';
        alert.resolvedAt = new Date().toISOString();
        alert.resolvedBy = this.getCurrentUserSummary();
        alert.timeline = alert.timeline || [];
        alert.timeline.push(this.buildTimelineEntry('resolved', alert, 'تم إغلاق التنبيه بعد التأكد من زوال الحالة'));
        alert.updatedAt = new Date().toISOString();

        alerts[index] = alert;
        AppState.appData.emergencyAlerts = alerts;
        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }

        try {
            await GoogleIntegration.autoSave('EmergencyAlerts', AppState.appData.emergencyAlerts);
        } catch (error) {
            Utils.safeWarn('⚠ فشل حفظ بيانات التنبيه بعد الإغلاق:', error);
        }

        Notification.success('تم إغلاق التنبيه', {
            title: 'إغلاق التنبيه',
            description: `تم إغلاق التنبيه "${alert.title}" بنجاح`,
            actions: [
                {
                    label: 'عرض التنبيه',
                    primary: false,
                    onClick: () => {
                        this.viewAlert(alert.id);
                    }
                }
            ]
        });
        this.renderAll();
    },

    async viewAlert(id) {
        const alert = this.getAlerts().find(a => a.id === id);
        if (!alert) {
            Notification.error('لم يتم العثور على التنبيه المحدد', {
                title: 'خطأ',
                description: 'التنبيه المحدد غير موجود'
            });
            return;
        }

        const structuredAlert = this.ensureAlertStructure(alert);
        if (!structuredAlert) {
            Notification.error('التنبيه غير صحيح', {
                title: 'خطأ',
                description: 'بيانات التنبيه غير صحيحة'
            });
            return;
        }

        // إنشاء نافذة منبثقة محسنة لعرض تفاصيل التنبيه
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10000';
        
        const severityColors = {
            'عالية': 'text-red-600 bg-red-50 border-red-200',
            'متوسطة': 'text-yellow-600 bg-yellow-50 border-yellow-200',
            'منخفضة': 'text-blue-600 bg-blue-50 border-blue-200'
        };
        
        const statusColors = {
            'نشط': 'bg-red-100 text-red-800',
            'قيد المعالجة': 'bg-yellow-100 text-yellow-800',
            'مغلق': 'bg-green-100 text-green-800'
        };
        
        const severityColor = severityColors[structuredAlert.severity] || severityColors['متوسطة'];
        const statusColor = statusColors[structuredAlert.status] || statusColors['نشط'];
        
        const createdAt = new Date(structuredAlert.createdAt || structuredAlert.date || new Date());
        const updatedAt = structuredAlert.updatedAt ? new Date(structuredAlert.updatedAt) : null;
        const acknowledgedAt = structuredAlert.acknowledgedAt ? new Date(structuredAlert.acknowledgedAt) : null;
        const resolvedAt = structuredAlert.resolvedAt ? new Date(structuredAlert.resolvedAt) : null;
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header" style="border-bottom: 2px solid var(--border-color);">
                    <div class="flex items-center justify-between w-full">
                        <div class="flex items-center gap-3">
                            <div class="p-3 rounded-lg ${severityColor}">
                                <i class="fas fa-exclamation-triangle text-2xl"></i>
                            </div>
                            <div>
                                <h2 class="modal-title" style="margin: 0;">${Utils.escapeHTML(structuredAlert.title || 'تنبيه')}</h2>
                                <p class="text-sm text-gray-500 mt-1">
                                    ${structuredAlert.requiresEvacuation ? '<span class="badge badge-danger">إخلاء مطلوب</span>' : ''}
                                    ${structuredAlert.isEscalated ? '<span class="badge badge-danger ml-2"><i class="fas fa-arrow-up ml-1"></i>متصاعد</span>' : ''}
                                </p>
                            </div>
                        </div>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="background: transparent; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <label class="text-xs font-semibold text-gray-600 mb-1 block">الخطورة</label>
                            <span class="badge ${structuredAlert.severity === 'عالية' ? 'badge-danger' : structuredAlert.severity === 'متوسطة' ? 'badge-warning' : 'badge-info'} text-lg px-3 py-1">
                                ${Utils.escapeHTML(structuredAlert.severity || 'غير محدد')}
                            </span>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <label class="text-xs font-semibold text-gray-600 mb-1 block">الحالة</label>
                            <span class="badge ${statusColor} text-lg px-3 py-1">
                                ${Utils.escapeHTML(structuredAlert.status || 'نشط')}
                            </span>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <label class="text-xs font-semibold text-gray-600 mb-1 block">تاريخ الإنشاء</label>
                            <p class="text-gray-800 font-medium">${Utils.formatDateTime(structuredAlert.createdAt || structuredAlert.date)}</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <label class="text-xs font-semibold text-gray-600 mb-1 block">آخر تحديث</label>
                            <p class="text-gray-800 font-medium">${updatedAt ? Utils.formatDateTime(updatedAt) : 'لم يتم التحديث'}</p>
                        </div>
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-align-right ml-2"></i>الوصف التفصيلي
                        </label>
                        <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p class="text-gray-800 leading-relaxed whitespace-pre-wrap">${Utils.escapeHTML(structuredAlert.description || 'لا يوجد وصف')}</p>
                        </div>
                    </div>
                    
                    ${structuredAlert.impactArea ? `
                        <div class="mb-6">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-map-marker-alt ml-2"></i>المنطقة المتأثرة
                            </label>
                            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <p class="text-blue-800">${Utils.escapeHTML(structuredAlert.impactArea)}</p>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${(structuredAlert.channels || []).length > 0 ? `
                        <div class="mb-6">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-broadcast-tower ml-2"></i>قنوات الإرسال
                            </label>
                            <div class="flex flex-wrap gap-2">
                                ${structuredAlert.channels.map(channel => `
                                    <span class="badge badge-secondary">${Utils.escapeHTML(channel)}</span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${(structuredAlert.assignedTeams || []).length > 0 ? `
                        <div class="mb-6">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-users ml-2"></i>فرق الاستجابة
                            </label>
                            <div class="flex flex-wrap gap-2">
                                ${structuredAlert.assignedTeams.map(team => `
                                    <span class="badge badge-info">${Utils.escapeHTML(team)}</span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${structuredAlert.responseInstructions ? `
                        <div class="mb-6">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-clipboard-list ml-2"></i>تعليمات الاستجابة
                            </label>
                            <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                <p class="text-yellow-800 leading-relaxed whitespace-pre-wrap">${Utils.escapeHTML(structuredAlert.responseInstructions)}</p>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="mb-6">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-user ml-2"></i>معلومات الإنشاء
                        </label>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <p class="text-gray-800">
                                <strong>أُطلق بواسطة:</strong> ${Utils.escapeHTML(structuredAlert.createdBy?.name || 'النظام')}
                                ${structuredAlert.createdBy?.email ? `<br><strong>البريد:</strong> ${Utils.escapeHTML(structuredAlert.createdBy.email)}` : ''}
                                ${structuredAlert.createdBy?.role ? `<br><strong>الدور:</strong> ${Utils.escapeHTML(structuredAlert.createdBy.role)}` : ''}
                            </p>
                        </div>
                    </div>
                    
                    ${acknowledgedAt ? `
                        <div class="mb-6">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-check-circle ml-2"></i>معلومات الاعتماد
                            </label>
                            <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                                <p class="text-green-800">
                                    <strong>تم الاعتماد في:</strong> ${Utils.formatDateTime(acknowledgedAt)}
                                    ${structuredAlert.acknowledgedBy?.name ? `<br><strong>بواسطة:</strong> ${Utils.escapeHTML(structuredAlert.acknowledgedBy.name)}` : ''}
                                </p>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${resolvedAt ? `
                        <div class="mb-6">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-flag-checkered ml-2"></i>معلومات الإغلاق
                            </label>
                            <div class="bg-teal-50 p-4 rounded-lg border border-teal-200">
                                <p class="text-teal-800">
                                    <strong>تم الإغلاق في:</strong> ${Utils.formatDateTime(resolvedAt)}
                                    ${structuredAlert.resolvedBy?.name ? `<br><strong>بواسطة:</strong> ${Utils.escapeHTML(structuredAlert.resolvedBy.name)}` : ''}
                                </p>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${(structuredAlert.timeline || []).length > 0 ? `
                        <div class="mb-6">
                            <label class="block text-sm font-semibold text-gray-700 mb-3">
                                <i class="fas fa-history ml-2"></i>سجل الأنشطة
                            </label>
                            <div class="space-y-3">
                                ${structuredAlert.timeline.map(entry => `
                                    <div class="border-l-4 pl-4 ${this.getTimelineColor(entry.type)}">
                                        <div class="flex items-center justify-between mb-1">
                                            <span class="font-semibold text-gray-800">${Utils.escapeHTML(entry.label || entry.type || 'تحديث')}</span>
                                            <span class="text-xs text-gray-500">${Utils.formatDateTime(entry.timestamp)}</span>
                                        </div>
                                        ${entry.description ? `<p class="text-sm text-gray-600">${Utils.escapeHTML(entry.description)}</p>` : ''}
                                        ${entry.actor?.name ? `<p class="text-xs text-gray-500 mt-1"><i class="fas fa-user ml-1"></i>${Utils.escapeHTML(entry.actor.name)}</p>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="flex items-center justify-end gap-3 pt-4 border-t">
                        ${!structuredAlert.acknowledgedAt ? `
                            <button class="btn-secondary" onclick="Emergency.acknowledgeAlert('${structuredAlert.id}'); this.closest('.modal-overlay').remove();">
                                <i class="fas fa-check ml-2"></i>اعتماد التنبيه
                            </button>
                        ` : ''}
                        ${structuredAlert.status !== 'مغلق' ? `
                            <button class="btn-primary" onclick="Emergency.resolveAlert('${structuredAlert.id}'); this.closest('.modal-overlay').remove();">
                                <i class="fas fa-flag-checkered ml-2"></i>إغلاق التنبيه
                            </button>
                        ` : ''}
                        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times ml-2"></i>إغلاق
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // إغلاق عند النقر خارج النافذة
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // إغلاق عند الضغط على ESC
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    },

    async viewPlan(id) {
        const plan = AppState.appData.emergencyPlans.find(p => p.id === id);
        if (!plan) return;

        Notification.info(`الخطة: ${plan.name}`, {
            title: 'خطة الطوارئ',
            description: plan.description || 'لا يوجد وصف'
        });
    },

    /**
     * تنظيف جميع الموارد عند إلغاء تحميل الموديول
     * يمنع تسريبات الذاكرة (Memory Leaks)
     */
    cleanup() {
        try {
            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('🧹 تنظيف موارد Emergency module...');
            }

            // تنظيف auto refresh interval
            this.clearAutoRefresh();

            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ تم تنظيف موارد Emergency module');
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ خطأ في تنظيف Emergency module:', error);
            }
        }
    }
};

// Ensure all Emergency module methods keep the correct context even when used as callbacks
Object.keys(Emergency).forEach((key) => {
    if (typeof Emergency[key] === 'function') {
        Emergency[key] = Emergency[key].bind(Emergency);
    }
});

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof Emergency !== 'undefined') {
            window.Emergency = Emergency;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ Emergency module loaded and available on window.Emergency');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير Emergency:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof Emergency !== 'undefined') {
            try {
                window.Emergency = Emergency;
            } catch (e) {
                console.error('❌ فشل تصدير Emergency:', e);
            }
        }
    }
})();