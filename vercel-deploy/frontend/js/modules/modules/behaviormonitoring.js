/**
 * BehaviorMonitoring Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ …Ù† app-modules.js
 */
// ===== Behavior Monitoring Module (مراقبة السلوكيات) =====
const BehaviorMonitoring = {
    // مراجع لتنظيف الموارد
    _setupTimeoutId: null,
    _eventListenersAbortController: null,
    _modalAbortController: null,

    /**
     * معالجة الصور (تحويل روابط Google Drive القديمة و Base64)
     */
    processPhoto(photoData) {
        if (typeof Utils !== 'undefined' && typeof Utils.normalizeImageSource === 'function') {
            return Utils.normalizeImageSource(photoData) || null;
        }
        if (!photoData || typeof photoData !== 'string') return null;
        return photoData.trim() || null;
    },

    state: {
        activeTab: 'log', // overview | log | form
        filters: {
            search: '',
            behaviorType: '',
            rating: '',
            dateFrom: '',
            dateTo: ''
        },
        sort: 'date_desc' // date_desc | date_asc
    },

    NEGATIVE_ACTIONS: [
        'توعية / توجيه',
        'إعادة تدريب',
        'تحذير شفهي',
        'إنذار كتابي',
        'إيقاف مؤقت عن العمل',
        'تطبيق / تعديل إجراء عمل',
        'تحسينات هندسية (Engineering)',
        'توفير / إلزام PPE',
        'أخرى'
    ],

    // الحصول على قائمة المواقع (المصانع) من الإعدادات (نفس نمط Training/Clinic)
    getSiteOptions() {
        try {
            if (typeof Permissions !== 'undefined' && Permissions.formSettingsState && Permissions.formSettingsState.sites) {
                return Permissions.formSettingsState.sites.map(site => ({ id: site.id, name: site.name }));
            }

            if (Array.isArray(AppState.appData?.observationSites) && AppState.appData.observationSites.length > 0) {
                return AppState.appData.observationSites.map(site => ({
                    id: site.id || site.siteId || Utils.generateId('SITE'),
                    name: site.name || site.title || site.label || 'موقع غير محدد'
                }));
            }

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

    // الحصول على قائمة الأماكن الفرعية لموقع محدد
    getPlaceOptions(siteId) {
        try {
            if (!siteId) return [];

            if (typeof Permissions !== 'undefined' && Permissions.formSettingsState && Permissions.formSettingsState.sites) {
                const site = Permissions.formSettingsState.sites.find(s => s.id === siteId);
                if (site && Array.isArray(site.places)) {
                    return site.places.map(place => ({ id: place.id, name: place.name }));
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
            Utils.safeWarn('⚠️ خطأ في الحصول على قائمة الأماكن:', error);
            return [];
        }
    },

    refreshSiteDropdowns() {
        try {
            var sites = this.getSiteOptions();
            if (!sites || !sites.length) return;
            var esc = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML : function(s) { return String(s == null ? '' : s); };
            document.querySelectorAll('select[id$="-factory"]').forEach(function(el) {
                if (el.tagName !== 'SELECT') return;
                var v = el.value;
                el.innerHTML = '<option value="">اختر المصنع</option>' + sites.map(function(s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
                if (v) el.value = v;
            });
        } catch (e) { if (typeof Utils !== 'undefined' && Utils.safeWarn) Utils.safeWarn('⚠️ BehaviorMonitoring.refreshSiteDropdowns:', e); }
    },

    resolveSiteName(siteIdOrName) {
        const v = (siteIdOrName || '').toString();
        if (!v) return '';
        const sites = this.getSiteOptions();
        const site = sites.find(s => s.id === v) || sites.find(s => (s.name || '') === v);
        return site?.name || v;
    },

    resolvePlaceName(placeIdOrName, siteIdOrName) {
        const v = (placeIdOrName || '').toString();
        if (!v) return '';
        const parent = (siteIdOrName || '').toString();
        const places = this.getPlaceOptions(parent);
        const place = places.find(p => p.id === v) || places.find(p => (p.name || '') === v);
        return place?.name || v;
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
        if (typeof AppState === 'undefined') {
            // لا تترك الواجهة فارغة
            const section = document.getElementById('behavior-monitoring-section');
            if (section) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-2">تعذر تحميل مراقبة السلوكيات</p>
                                <p class="text-sm text-gray-400">AppState غير متوفر حالياً. جرّب تحديث الصفحة.</p>
                                <button onclick="location.reload()" class="btn-primary mt-4">
                                    <i class="fas fa-redo ml-2"></i>
                                    تحديث الصفحة
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
            Utils.safeError('AppState غير متوفر!');
            return;
        }

        const section = document.getElementById('behavior-monitoring-section');
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ قسم behavior-monitoring-section غير موجود');
            } else {
                console.warn('⚠️ قسم behavior-monitoring-section غير موجود');
            }
            return;
        }

        // التأكد من وجود البيانات
        if (!AppState.appData) {
            AppState.appData = {};
        }
        if (!AppState.appData.behaviorMonitoring) {
            AppState.appData.behaviorMonitoring = [];
        }

        // عرض الواجهة أولاً لتحسين تجربة المستخدم
        try {
            const activeTab = this.state?.activeTab || 'log';

            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-eye ml-3"></i>
                                مراقبة السلوكيات
                            </h1>
                            <p class="section-subtitle">تسجيل ومتابعة سلوكيات الموظفين</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button id="behavior-refresh-btn" class="btn-secondary">
                                <i class="fas fa-sync-alt ml-2"></i>
                                تحديث
                            </button>
                            <button id="behavior-add-btn" class="btn-primary">
                                <i class="fas fa-plus ml-2"></i>
                                تسجيل تصرف جديد
                            </button>
                        </div>
                    </div>
                </div>

                <div class="mt-6">
                    <div class="module-tabs-wrapper">
                        <div class="module-tabs-container">
                            <button class="module-tab-btn ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview" onclick="BehaviorMonitoring.switchTab('overview')">
                                <i class="fas fa-chart-pie ml-2"></i>نظرة عامة
                            </button>
                            <button class="module-tab-btn ${activeTab === 'log' ? 'active' : ''}" data-tab="log" onclick="BehaviorMonitoring.switchTab('log')">
                                <i class="fas fa-list ml-2"></i>سجل التصرفات
                            </button>
                            <button class="module-tab-btn ${activeTab === 'form' ? 'active' : ''}" data-tab="form" onclick="BehaviorMonitoring.switchTab('form')">
                                <i class="fas fa-pen-to-square ml-2"></i>تسجيل تصرف
                            </button>
                        </div>
                    </div>
                </div>

                <div id="behavior-content" class="mt-6">
                    ${this.renderTabSkeleton(activeTab)}
                </div>
            `;

            this.setupEventListeners();
            // render active tab (sync) then bind events
            await this.switchTab(activeTab, { initial: true });
            
            // تحميل البيانات بشكل غير متزامن بعد عرض الواجهة
            setTimeout(() => {
                this.loadBehaviorDataAsync().then(() => {
                    // تحديث الواجهة بعد تحميل البيانات لضمان عدم بقاء الواجهة فارغة
                    const activeTab = this.state?.activeTab || 'log';
                    this.switchTab(activeTab, { silent: true }).catch(() => {
                        // في حالة الفشل، على الأقل تأكد من أن الواجهة ليست فارغة
                        this.refreshCurrentTab();
                    });
                }).catch(error => {
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                        Utils.safeWarn('⚠️ تعذر تحميل بيانات مراقبة السلوك:', error);
                    } else {
                        console.warn('⚠️ تعذر تحميل بيانات مراقبة السلوك:', error);
                    }
                    // حتى في حالة الخطأ، تأكد من تحديث التبويب الحالي
                    this.refreshCurrentTab();
                });
            }, 100);
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل مديول مراقبة السلوكيات:', error);
            section.innerHTML = `
                <div class="section-header">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-eye ml-3"></i>
                            مراقبة السلوكيات
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
                                <button onclick="BehaviorMonitoring.load()" class="btn-primary">
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

    async loadBehaviorDataAsync() {
        try {
            const behaviorResult = await GoogleIntegration.sendRequest({
                action: 'getAllBehaviors',
                data: {}
            }).catch(error => {
                const errorMsg = error.message || error.toString() || '';
                if (errorMsg.includes('انتهت مهلة الاتصال') || errorMsg.includes('timeout')) {
                    Utils.safeWarn('⚠️ انتهت مهلة الاتصال بالخادم');
                    return { success: false, data: [] };
                }
                Utils.safeWarn('⚠️ تعذر تحميل بيانات مراقبة السلوك:', error);
                return { success: false, data: [] };
            });

            // معالجة نتائج البيانات
            if (behaviorResult && behaviorResult.success && Array.isArray(behaviorResult.data)) {
                AppState.appData.behaviorMonitoring = behaviorResult.data;
                Utils.safeLog(`✅ تم تحميل ${behaviorResult.data.length} سجل من Google Sheets`);
                
                // تحديث التبويب الحالي بعد تحميل البيانات
                this.refreshCurrentTab();
            }

            // حفظ البيانات محلياً
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }
        } catch (error) {
            const errorMsg = error.message || error.toString() || '';
            Utils.safeError('❌ خطأ في تحميل بيانات مراقبة السلوك من Google Sheets:', error);
            
            // عرض رسالة خطأ واضحة للمستخدم
            if (errorMsg.includes('انتهت مهلة الاتصال') || errorMsg.includes('timeout')) {
                Notification.error({
                    title: 'الربط مع الخلفية',
                    message: 'انتهت مهلة الاتصال بالخادم. سيتم استخدام البيانات المحلية.',
                    duration: 5000,
                    persistent: false
                });
            } else {
                Notification.warning('حدث خطأ في تحميل بعض البيانات. سيتم استخدام البيانات المحلية.');
            }
        }
    },

    renderTabSkeleton(tab) {
        if (tab === 'overview') return this.renderOverviewTab(true);
        if (tab === 'form') return this.renderFormTab(true);
        return this.renderLogTab(true);
    },

    getBehaviors() {
        if (!AppState?.appData?.behaviorMonitoring || !Array.isArray(AppState.appData.behaviorMonitoring)) return [];
        return AppState.appData.behaviorMonitoring.map((b) => this.presentBehavior(b));
    },

    getRawBehaviorById(id) {
        const list = AppState?.appData?.behaviorMonitoring;
        if (!Array.isArray(list)) return null;
        return list.find((b) => b && b.id === id) || null;
    },

    /**
     * دمج مفاتيح بديلة (عربي / أسماء أعمدة قديمة / اختلاف حالة الأحرف) مع الحقول القياسية.
     */
    normalizeBehaviorRecord(raw) {
        if (!raw || typeof raw !== 'object') return raw;
        const out = { ...raw };
        const pick = (aliases) => {
            for (let i = 0; i < aliases.length; i++) {
                const k = aliases[i];
                if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
                const v = raw[k];
                if (v !== undefined && v !== null && String(v).trim() !== '') return v;
            }
            return undefined;
        };
        const setIfEmpty = (canon, aliases) => {
            const cur = out[canon];
            if (cur !== undefined && cur !== null && String(cur).trim() !== '') return;
            const pv = pick(aliases);
            if (pv !== undefined) out[canon] = pv;
        };
        setIfEmpty('isoCode', ['isoCode', 'ISO', 'IsoCode', 'كود ISO']);
        setIfEmpty('employeeCode', ['employeeCode', 'employee_number', 'EmployeeCode', 'الكود الوظيفي']);
        setIfEmpty('employeeNumber', ['employeeNumber', 'employeeCode', 'الكود الوظيفي']);
        setIfEmpty('employeeName', ['employeeName', 'EmployeeName', 'اسم الموظف']);
        setIfEmpty('department', ['department', 'Department', 'القسم', 'employeeDepartment', 'Dept']);
        setIfEmpty('job', ['job', 'Job', 'position', 'Position', 'الوظيفة', 'المسمى الوظيفي', 'jobTitle']);
        setIfEmpty('factory', ['factory', 'factoryId', 'Factory', 'FactoryId']);
        setIfEmpty('factoryId', ['factoryId', 'factory']);
        setIfEmpty('factoryName', ['factoryName', 'FactoryName', 'factory_name', 'اسم المصنع', 'المصنع', 'الموقع', 'موقع العمل', 'siteName', 'Site']);
        setIfEmpty('subLocation', ['subLocation', 'subLocationId', 'SubLocation']);
        setIfEmpty('subLocationId', ['subLocationId', 'subLocation']);
        setIfEmpty('subLocationName', ['subLocationName', 'sub_location_name', 'الموقع الفرعي', 'موقع فرعي', 'SubLocationName', 'المكان']);
        setIfEmpty('behaviorType', ['behaviorType', 'نوع التصرف', 'Type']);
        setIfEmpty('rating', ['rating', 'التقييم']);
        setIfEmpty('description', ['description', 'Description', 'الوصف', 'ملاحظات', 'Notes', 'details']);
        setIfEmpty('correctiveAction', ['correctiveAction', 'الإجراء التصحيحي']);
        setIfEmpty('correctiveActionDetails', ['correctiveActionDetails', 'تفاصيل الإجراء']);
        setIfEmpty('date', ['date', 'Date', 'التاريخ', 'behaviorDate']);
        setIfEmpty('photo', ['photo', 'Photo', 'صورة', 'image']);
        return out;
    },

    enrichBehaviorRecord(out) {
        if (!out || typeof out !== 'object') return out;
        const merged = { ...out };
        const code = String(merged.employeeCode || merged.employeeNumber || '').trim();
        const needDept = !String(merged.department || '').trim();
        const needJob = !String(merged.job || merged.position || '').trim();
        if (code && (needDept || needJob)) {
            const employees = Array.isArray(AppState?.appData?.employees) ? AppState.appData.employees : [];
            const emp = employees.find((e) =>
                String(e.employeeNumber || '').trim() === code ||
                String(e.sapId || '').trim() === code ||
                String(e.id || '').trim() === code
            );
            if (emp) {
                if (needDept) merged.department = emp.department || emp.dept || '';
                if (needJob) merged.job = emp.job || emp.position || emp.jobTitle || '';
            }
        }
        const factoryKey = String(merged.factoryId || merged.factory || '').trim();
        if (factoryKey && !String(merged.factoryName || '').trim()) {
            merged.factoryName = this.resolveSiteName(factoryKey);
        }
        if (!String(merged.factoryName || '').trim() && String(merged.factory || '').trim()) {
            merged.factoryName = this.resolveSiteName(merged.factory);
        }
        const subKey = String(merged.subLocationId || merged.subLocation || '').trim();
        if (subKey && !String(merged.subLocationName || '').trim()) {
            merged.subLocationName = this.resolvePlaceName(subKey, factoryKey || merged.factory);
        }
        return merged;
    },

    presentBehavior(raw) {
        if (!raw || typeof raw !== 'object') return raw;
        return this.enrichBehaviorRecord(this.normalizeBehaviorRecord(raw));
    },

    editBehavior(id) {
        const raw = this.getRawBehaviorById(id);
        if (!raw) {
            Notification.error('التصرف غير موجود');
            return;
        }
        this.showForm(this.presentBehavior(raw));
    },

    /** تاريخ عرض واضح بالعربية دون ترتيب غريب لـ toLocaleDateString(en-GB) */
    formatBehaviorDateDisplay(behaviorOrValue) {
        const v = behaviorOrValue && typeof behaviorOrValue === 'object' && !Array.isArray(behaviorOrValue)
            ? this.getBehaviorDate(behaviorOrValue)
            : behaviorOrValue;
        if (!v) return '—';
        try {
            let d;
            const s = String(v).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                const p = s.split('-').map(Number);
                d = new Date(p[0], p[1] - 1, p[2]);
            } else {
                d = new Date(v);
            }
            if (isNaN(d.getTime())) return '—';
            return d.toLocaleDateString('ar-EG-u-ca-gregory', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return '—';
        }
    },

    parseDateSafe(value) {
        try {
            const d = value instanceof Date ? value : new Date(value);
            if (!d || Number.isNaN(d.getTime())) return null;
            return d;
        } catch (e) {
            return null;
        }
    },

    getBehaviorDate(behavior) {
        if (!behavior) return null;
        return behavior.date || behavior.Date || behavior['التاريخ'] || behavior.behaviorDate
            || behavior.createdAt || behavior.updatedAt || null;
    },

    getBehaviorTypeBadgeClass(behaviorType) {
        if (behaviorType === 'إيجابي') return 'badge-success';
        if (behaviorType === 'سلبي') return 'badge-danger';
        return 'badge-secondary';
    },

    getRatingBadgeClass(rating) {
        if (rating === 'ممتاز') return 'badge-success';
        if (rating === 'جيد') return 'badge-primary';
        if (rating === 'مقبول') return 'badge-warning';
        if (rating === 'ضعيف') return 'badge-danger';
        return 'badge-secondary';
    },

    matchesSearch(behavior, q) {
        const query = (q || '').toString().trim().toLowerCase();
        if (!query) return true;
        const hay = [
            behavior?.isoCode,
            behavior?.employeeName,
            behavior?.employeeCode,
            behavior?.employeeNumber,
            behavior?.department,
            behavior?.factoryName,
            behavior?.subLocationName,
            behavior?.behaviorType,
            behavior?.rating,
            behavior?.description
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(query);
    },

    getFilteredBehaviors() {
        const all = this.getBehaviors();
        const filters = this.state?.filters || {};
        const behaviorType = (filters.behaviorType || '').toString().trim();
        const rating = (filters.rating || '').toString().trim();
        const q = (filters.search || '').toString();

        const from = filters.dateFrom ? this.parseDateSafe(filters.dateFrom) : null;
        const to = filters.dateTo ? this.parseDateSafe(filters.dateTo) : null;

        const filtered = all.filter((b) => {
            if (!this.matchesSearch(b, q)) return false;
            if (behaviorType && (b?.behaviorType || '') !== behaviorType) return false;
            if (rating && (b?.rating || '') !== rating) return false;

            const d = this.parseDateSafe(this.getBehaviorDate(b));
            if (from && (!d || d < from)) return false;
            if (to) {
                // include whole day for to
                const toEnd = new Date(to);
                toEnd.setHours(23, 59, 59, 999);
                if (!d || d > toEnd) return false;
            }

            return true;
        });

        const sort = this.state?.sort || 'date_desc';
        filtered.sort((a, b) => {
            const da = this.parseDateSafe(this.getBehaviorDate(a))?.getTime() || 0;
            const db = this.parseDateSafe(this.getBehaviorDate(b))?.getTime() || 0;
            return sort === 'date_asc' ? (da - db) : (db - da);
        });

        return filtered;
    },

    refreshCurrentTab() {
        const tab = this.state?.activeTab || 'log';
        if (tab === 'overview') {
            const container = document.getElementById('behavior-overview-container');
            if (container) container.innerHTML = this.renderOverviewTab(false);
            this.bindCurrentTabEvents();
            return;
        }
        if (tab === 'form') {
            const container = document.getElementById('behavior-form-container');
            if (container) container.innerHTML = this.renderFormTab(false);
            this.bindCurrentTabEvents();
            return;
        }
        // log
        const container = document.getElementById('behavior-log-container');
        if (container) container.innerHTML = this.renderLogTab(false);
        this.bindCurrentTabEvents();
    },

    async switchTab(tab, options = {}) {
        try {
            const nextTab = tab || 'log';
            this.state = this.state || {};
            this.state.activeTab = nextTab;

            // update active button style
            document.querySelectorAll('#behavior-monitoring-section .module-tab-btn').forEach((btn) => {
                const t = btn.getAttribute('data-tab');
                if (t === nextTab) btn.classList.add('active');
                else btn.classList.remove('active');
            });

            const content = document.getElementById('behavior-content');
            if (!content) return;

            if (nextTab === 'overview') content.innerHTML = this.renderOverviewTab(false);
            else if (nextTab === 'form') content.innerHTML = this.renderFormTab(false);
            else content.innerHTML = this.renderLogTab(false);

            this.bindCurrentTabEvents();

            // initial render: try show data quickly
            if (options?.initial && nextTab === 'log') {
                this.renderLogTable();
            }
        } catch (e) {
            Utils.safeError('❌ خطأ في تبديل تبويب مراقبة السلوكيات:', e);
        }
    },

    renderOverviewTab(isSkeleton = false) {
        const behaviors = this.getBehaviors();
        const total = behaviors.length;
        const positives = behaviors.filter(b => b?.behaviorType === 'إيجابي').length;
        const negatives = behaviors.filter(b => b?.behaviorType === 'سلبي').length;
        const last5 = [...behaviors].sort((a, b) => {
            const da = this.parseDateSafe(this.getBehaviorDate(a))?.getTime() || 0;
            const db = this.parseDateSafe(this.getBehaviorDate(b))?.getTime() || 0;
            return db - da;
        }).slice(0, 5);

        return `
            <div id="behavior-overview-container">
                <div class="content-card behavior-overview-card">
                    <div class="card-header">
                        <h2 class="card-title"><i class="fas fa-chart-line ml-2"></i>نظرة عامة</h2>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div class="behavior-stat">
                                <div class="behavior-stat-label">إجمالي السجلات</div>
                                <div class="behavior-stat-value">${isSkeleton ? '—' : total}</div>
                            </div>
                            <div class="behavior-stat">
                                <div class="behavior-stat-label">تصرفات إيجابية</div>
                                <div class="behavior-stat-value text-green-700">${isSkeleton ? '—' : positives}</div>
                            </div>
                            <div class="behavior-stat">
                                <div class="behavior-stat-label">تصرفات سلبية</div>
                                <div class="behavior-stat-value text-red-700">${isSkeleton ? '—' : negatives}</div>
                            </div>
                        </div>

                        <div class="content-card behavior-mini-card">
                            <div class="card-header">
                                <h3 class="card-title"><i class="fas fa-clock ml-2"></i>آخر 5 تصرفات</h3>
                            </div>
                            <div class="card-body">
                                ${isSkeleton ? `
                                    <div class="empty-state"><p class="text-gray-500">جاري التحميل...</p></div>
                                ` : (last5.length ? `
                                    <div class="table-wrapper" style="overflow-x:auto;">
                                        <table class="data-table table-header-purple">
                                            <thead>
                                                <tr>
                                                    <th>ISO</th>
                                                    <th>الموظف</th>
                                                    <th>المصنع</th>
                                                    <th>الموقع الفرعي</th>
                                                    <th>نوع التصرف</th>
                                                    <th>التاريخ</th>
                                                    <th>التقييم</th>
                                                    <th class="text-center">إجراء</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${last5.map(b => `
                                                    <tr>
                                                        <td>${Utils.escapeHTML(b.isoCode || '')}</td>
                                                        <td>${Utils.escapeHTML(b.employeeName || '')}</td>
                                                        <td>${Utils.escapeHTML(b.factoryName || b.factory || '—')}</td>
                                                        <td>${Utils.escapeHTML(b.subLocationName || b.subLocation || '—')}</td>
                                                        <td><span class="badge ${this.getBehaviorTypeBadgeClass(b.behaviorType)}">${Utils.escapeHTML(b.behaviorType || '—')}</span></td>
                                                        <td>${this.getBehaviorDate(b) ? this.formatBehaviorDateDisplay(b) : '—'}</td>
                                                        <td><span class="badge ${this.getRatingBadgeClass(b.rating)}">${Utils.escapeHTML(b.rating || '—')}</span></td>
                                                        <td class="text-center">
                                                            <button onclick="BehaviorMonitoring.viewBehavior('${b.id}')" class="btn-icon btn-icon-primary" title="عرض">
                                                                <i class="fas fa-eye"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : `<div class="empty-state"><p class="text-gray-500">لا توجد تصرفات مسجلة</p></div>`)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderLogTab(isSkeleton = false) {
        const filters = this.state?.filters || {};
        const safe = (v) => Utils.escapeHTML((v ?? '').toString());

        return `
            <div id="behavior-log-container">
                <div class="content-card behavior-filters-card">
                    <div class="card-header">
                        <h2 class="card-title"><i class="fas fa-filter ml-2"></i>سجل التصرفات (بحث/فلترة)</h2>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                            <div class="lg:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">بحث سريع</label>
                                <div class="relative">
                                    <input id="behavior-filter-search" type="text" class="form-input pr-10" placeholder="ISO / اسم / كود / وصف" value="${safe(filters.search)}">
                                    <i class="fas fa-search absolute top-3 right-3 text-gray-400"></i>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">نوع التصرف</label>
                                <select id="behavior-filter-type" class="form-input">
                                    <option value="">الكل</option>
                                    <option value="إيجابي" ${filters.behaviorType === 'إيجابي' ? 'selected' : ''}>إيجابي</option>
                                    <option value="سلبي" ${filters.behaviorType === 'سلبي' ? 'selected' : ''}>سلبي</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">التقييم</label>
                                <select id="behavior-filter-rating" class="form-input">
                                    <option value="">الكل</option>
                                    <option value="ممتاز" ${filters.rating === 'ممتاز' ? 'selected' : ''}>ممتاز</option>
                                    <option value="جيد" ${filters.rating === 'جيد' ? 'selected' : ''}>جيد</option>
                                    <option value="مقبول" ${filters.rating === 'مقبول' ? 'selected' : ''}>مقبول</option>
                                    <option value="ضعيف" ${filters.rating === 'ضعيف' ? 'selected' : ''}>ضعيف</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">من</label>
                                <input id="behavior-filter-from" type="date" class="form-input" value="${safe(filters.dateFrom)}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">إلى</label>
                                <input id="behavior-filter-to" type="date" class="form-input" value="${safe(filters.dateTo)}">
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center justify-between gap-2 mt-4">
                            <div class="text-sm text-gray-600">
                                <span class="badge badge-secondary" id="behavior-filter-count">${isSkeleton ? '—' : this.getFilteredBehaviors().length}</span>
                                <span>سجل (بعد الفلترة)</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <select id="behavior-sort" class="form-input" style="max-width: 220px;">
                                    <option value="date_desc" ${this.state?.sort === 'date_desc' ? 'selected' : ''}>الأحدث أولاً</option>
                                    <option value="date_asc" ${this.state?.sort === 'date_asc' ? 'selected' : ''}>الأقدم أولاً</option>
                                </select>
                                <button id="behavior-export-csv-btn" class="btn-success">
                                    <i class="fas fa-file-csv ml-2"></i>
                                    تصدير CSV
                                </button>
                                <button id="behavior-clear-filters-btn" class="btn-secondary">
                                    <i class="fas fa-eraser ml-2"></i>
                                    مسح الفلاتر
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="content-card mt-4">
                    <div class="card-header">
                        <h2 class="card-title"><i class="fas fa-table ml-2"></i>البيانات</h2>
                    </div>
                    <div class="card-body">
                        <div id="behavior-log-table-container">
                            ${isSkeleton ? `<div class="empty-state"><p class="text-gray-500">جاري التحميل...</p></div>` : this.renderLogTableHTML()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderLogTableHTML() {
        const behaviors = this.getFilteredBehaviors();
        if (!behaviors.length) {
            return `<div class="empty-state"><p class="text-gray-500">لا توجد نتائج مطابقة للفلاتر الحالية</p></div>`;
        }

        return `
            <div class="table-wrapper" style="overflow-x:auto;">
                <table class="data-table table-header-purple">
                    <thead>
                        <tr>
                            <th>كود ISO</th>
                            <th>اسم الموظف</th>
                            <th>المصنع</th>
                            <th>الموقع الفرعي</th>
                            <th>نوع التصرف</th>
                            <th>التاريخ</th>
                            <th>التقييم</th>
                            <th class="text-center">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${behaviors.map(b => `
                            <tr>
                                <td>${Utils.escapeHTML(b.isoCode || '')}</td>
                                <td>
                                    <div class="flex flex-col">
                                        <span class="font-semibold">${Utils.escapeHTML(b.employeeName || '')}</span>
                                        <span class="text-xs text-gray-500">${Utils.escapeHTML(b.employeeCode || b.employeeNumber || '')}</span>
                                    </div>
                                </td>
                                <td>${Utils.escapeHTML(b.factoryName || b.factory || '—')}</td>
                                <td>${Utils.escapeHTML(b.subLocationName || b.subLocation || '—')}</td>
                                <td><span class="badge ${this.getBehaviorTypeBadgeClass(b.behaviorType)}">${Utils.escapeHTML(b.behaviorType || '—')}</span></td>
                                <td>${this.getBehaviorDate(b) ? this.formatBehaviorDateDisplay(b) : '—'}</td>
                                <td><span class="badge ${this.getRatingBadgeClass(b.rating)}">${Utils.escapeHTML(b.rating || '—')}</span></td>
                                <td class="text-center bhm-log-table-actions">
                                    <div class="flex items-center justify-center gap-2 flex-wrap">
                                        <button type="button" onclick="BehaviorMonitoring.viewBehavior('${b.id}')" class="btn-icon btn-icon-primary bhm-action-icon" title="عرض">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button type="button" onclick="BehaviorMonitoring.exportPDF('${b.id}')" class="btn-icon btn-icon-success bhm-action-icon" title="تصدير PDF">
                                            <i class="fas fa-file-pdf"></i>
                                        </button>
                                        <button type="button" onclick="BehaviorMonitoring.printReport('${b.id}')" class="btn-icon btn-icon-info bhm-action-icon" title="طباعة">
                                            <i class="fas fa-print"></i>
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

    renderLogTable() {
        const tableContainer = document.getElementById('behavior-log-table-container');
        if (tableContainer) tableContainer.innerHTML = this.renderLogTableHTML();
        const countEl = document.getElementById('behavior-filter-count');
        if (countEl) countEl.textContent = String(this.getFilteredBehaviors().length);
    },

    clearFilters() {
        this.state.filters = { search: '', behaviorType: '', rating: '', dateFrom: '', dateTo: '' };
        this.state.sort = 'date_desc';
        this.refreshCurrentTab();
    },

    exportLogCSV() {
        const rows = this.getFilteredBehaviors();
        if (!rows.length) {
            Notification.info('لا توجد بيانات لتصديرها');
            return;
        }

        const escapeCsv = (v) => {
            const s = (v ?? '').toString().replace(/\r?\n/g, ' ').trim();
            if (s.includes('"') || s.includes(',') || s.includes(';')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };

        const header = ['ISO', 'EmployeeName', 'EmployeeCode', 'Department', 'Job', 'Factory', 'SubLocation', 'BehaviorType', 'Date', 'Rating', 'CorrectiveAction', 'CorrectiveActionDetails', 'Description'];
        const csv = [
            header.join(','),
            ...rows.map(b => [
                escapeCsv(b.isoCode || ''),
                escapeCsv(b.employeeName || ''),
                escapeCsv(b.employeeCode || b.employeeNumber || ''),
                escapeCsv(b.department || ''),
                escapeCsv(b.job || b.position || ''),
                escapeCsv(b.factoryName || b.factory || ''),
                escapeCsv(b.subLocationName || b.subLocation || ''),
                escapeCsv(b.behaviorType || ''),
                escapeCsv(this.getBehaviorDate(b) ? Utils.formatDateForInput(this.getBehaviorDate(b)) : ''),
                escapeCsv(b.rating || ''),
                escapeCsv(b.correctiveAction || ''),
                escapeCsv(b.correctiveActionDetails || ''),
                escapeCsv(b.description || '')
            ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BehaviorMonitoring_Log_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },

    renderFormTab(isSkeleton = false) {
        const uid = `bhm-tab-${Date.now()}`;
        return `
            <div id="behavior-form-container">
                <div class="content-card behavior-form-card">
                    <div class="card-header">
                        <h2 class="card-title"><i class="fas fa-pen-to-square ml-2"></i>تسجيل تصرف</h2>
                    </div>
                    <div class="card-body">
                        ${isSkeleton ? `<div class="empty-state"><p class="text-gray-500">جاري التحميل...</p></div>` : this.getBehaviorFormHTML(null, uid, { inline: true })}
                    </div>
                </div>
            </div>
        `;
    },

    bindCurrentTabEvents() {
        // reset listeners for current tab
        if (this._eventListenersAbortController) {
            this._eventListenersAbortController.abort();
        }
        this._eventListenersAbortController = new AbortController();
        const signal = this._eventListenersAbortController.signal;

        const tab = this.state?.activeTab || 'log';
        if (tab === 'log') {
            const search = document.getElementById('behavior-filter-search');
            const type = document.getElementById('behavior-filter-type');
            const rating = document.getElementById('behavior-filter-rating');
            const from = document.getElementById('behavior-filter-from');
            const to = document.getElementById('behavior-filter-to');
            const sort = document.getElementById('behavior-sort');
            const clearBtn = document.getElementById('behavior-clear-filters-btn');
            const exportBtn = document.getElementById('behavior-export-csv-btn');

            const onAnyChange = () => {
                this.state.filters = this.state.filters || {};
                this.state.filters.search = (search?.value || '').toString();
                this.state.filters.behaviorType = (type?.value || '').toString();
                this.state.filters.rating = (rating?.value || '').toString();
                this.state.filters.dateFrom = (from?.value || '').toString();
                this.state.filters.dateTo = (to?.value || '').toString();
                this.state.sort = (sort?.value || 'date_desc').toString();
                this.renderLogTable();
            };

            search?.addEventListener('input', onAnyChange, { signal });
            type?.addEventListener('change', onAnyChange, { signal });
            rating?.addEventListener('change', onAnyChange, { signal });
            from?.addEventListener('change', onAnyChange, { signal });
            to?.addEventListener('change', onAnyChange, { signal });
            sort?.addEventListener('change', onAnyChange, { signal });
            clearBtn?.addEventListener('click', () => this.clearFilters(), { signal });
            exportBtn?.addEventListener('click', () => this.exportLogCSV(), { signal });

            // first render
            this.renderLogTable();
            return;
        }

        if (tab === 'form') {
            // bind inline form (we rendered with unique ids)
            const form = document.querySelector('#behavior-form-container form[data-behavior-form="true"]');
            const uid = form?.getAttribute('data-form-uid');
            if (form && uid) {
                this.bindBehaviorForm({ form, uid, data: null, modal: null, signal });
                const wrap = document.getElementById('behavior-form-container');
                if (wrap && typeof Utils.hydrateDriveProxyImages === 'function') {
                    Utils.hydrateDriveProxyImages(wrap, {
                        onFetchFail: (img) => {
                            try {
                                img.onerror = null;
                                img.removeAttribute('src');
                            } catch (e) { /* ignore */ }
                        }
                    });
                }
            }
        }
    },

    setupEventListeners() {
        // تنظيف timeout القديم إن وجد
        if (this._setupTimeoutId) {
            clearTimeout(this._setupTimeoutId);
        }

        this._setupTimeoutId = setTimeout(() => {
            const addBtn = document.getElementById('behavior-add-btn');
            if (addBtn) addBtn.addEventListener('click', () => this.showForm(), { passive: true });

            const refreshBtn = document.getElementById('behavior-refresh-btn');
            if (refreshBtn) refreshBtn.addEventListener('click', () => {
                this.loadBehaviorDataAsync();
                Notification.success('تم تحديث البيانات');
            }, { passive: true });
        }, 50);
    },

    getBehaviorFormHTML(data = null, uid, options = {}) {
        const ids = {
            employeeCode: `${uid}-employee-code`,
            employeeName: `${uid}-employee-name`,
            dropdown: `${uid}-employee-dropdown`,
            department: `${uid}-department`,
            job: `${uid}-job`,
            factory: `${uid}-factory`,
            subLocation: `${uid}-sublocation`,
            photoInput: `${uid}-photo-input`,
            photoPreview: `${uid}-photo-preview`,
            photoImg: `${uid}-photo-img`,
            behaviorType: `${uid}-type`,
            behaviorDate: `${uid}-date`,
            behaviorRating: `${uid}-rating`,
            correctiveAction: `${uid}-corrective-action`,
            correctiveActionDetails: `${uid}-corrective-action-details`,
            description: `${uid}-description`,
            saveBtn: `${uid}-save-btn`
        };

        const dateValue = data?.date ? new Date(data.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const inline = !!options.inline;

        const sites = this.getSiteOptions();
        const selectedFactory = data?.factory || data?.factoryId || data?.siteId || '';
        const selectedSub = data?.subLocation || data?.subLocationId || data?.location || '';
        const resolvedFactoryId =
            sites.find(s => s.id === selectedFactory)?.id ||
            sites.find(s => s.name === selectedFactory)?.id ||
            selectedFactory;
        const places = this.getPlaceOptions(resolvedFactoryId);
        const resolvedSubId =
            places.find(p => p.id === selectedSub)?.id ||
            places.find(p => p.name === selectedSub)?.id ||
            selectedSub;
        const isNegative = (data?.behaviorType || '') === 'سلبي';

        const existingPhoto = this.processPhoto(data?.photo);
        const photoDisp = existingPhoto && typeof Utils.resolveDriveAwareImgDisplay === 'function'
            ? Utils.resolveDriveAwareImgDisplay(existingPhoto)
            : { canonical: existingPhoto || '', displaySrc: existingPhoto || '', needsProxy: false, proxyFileId: '' };
        const photoThumbSrc = photoDisp.canonical ? photoDisp.displaySrc : '';
        const photoThumbProxyAttr = typeof Utils.driveProxyImgAttrs === 'function' ? Utils.driveProxyImgAttrs(photoDisp) : '';

        return `
            <div class="behavior-form-wrapper bhm-form ${inline ? 'behavior-form-inline' : 'behavior-form-modal'}" data-behavior-type="${Utils.escapeHTML(data?.behaviorType || '')}">
                <form data-behavior-form="true" data-form-uid="${uid}" class="bhm-form-inner">
                    <section class="bhm-section" aria-labelledby="${uid}-sec-emp">
                        <div class="bhm-section-head" id="${uid}-sec-emp">
                            <span class="bhm-section-icon" aria-hidden="true"><i class="fas fa-id-card"></i></span>
                            <div>
                                <h4 class="bhm-section-title">بيانات الموظف</h4>
                                <p class="bhm-section-hint">الكود والاسم والقسم والوظيفة</p>
                            </div>
                        </div>
                        <div class="bhm-section-body">
                            <div class="bhm-grid bhm-grid-2">
                                <div class="bhm-field">
                                    <label for="${ids.employeeCode}" class="bhm-label">الكود الوظيفي <span class="bhm-req">*</span></label>
                                    <input type="text" id="${ids.employeeCode}" required class="form-input bhm-input"
                                        value="${Utils.escapeHTML(data?.employeeCode || data?.employeeNumber || '')}" placeholder="أدخل الكود الوظيفي">
                                </div>
                                <div class="bhm-field">
                                    <label for="${ids.employeeName}" class="bhm-label">اسم الموظف <span class="bhm-req">*</span></label>
                                    <div class="relative">
                                        <input type="text" id="${ids.employeeName}" required class="form-input bhm-input"
                                            value="${Utils.escapeHTML(data?.employeeName || '')}" placeholder="ابحث بالاسم أو الكود" autocomplete="off">
                                        <div id="${ids.dropdown}" class="hse-lookup-dropdown absolute z-50 hidden w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"></div>
                                    </div>
                                </div>
                                <div class="bhm-field">
                                    <label for="${ids.department}" class="bhm-label">القسم <span class="bhm-req">*</span></label>
                                    <input type="text" id="${ids.department}" required class="form-input bhm-input"
                                        value="${Utils.escapeHTML(data?.department || data?.employeeDepartment || '')}" placeholder="يُعبَّأ تلقائياً من بيانات الموظف">
                                </div>
                                <div class="bhm-field">
                                    <label for="${ids.job}" class="bhm-label">الوظيفة <span class="bhm-req">*</span></label>
                                    <input type="text" id="${ids.job}" required class="form-input bhm-input"
                                        value="${Utils.escapeHTML(data?.job || data?.position || data?.employeeJob || '')}" placeholder="يُعبَّأ تلقائياً من بيانات الموظف">
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="bhm-section" aria-labelledby="${uid}-sec-act">
                        <div class="bhm-section-head" id="${uid}-sec-act">
                            <span class="bhm-section-icon bhm-section-icon--violet" aria-hidden="true"><i class="fas fa-clipboard-list"></i></span>
                            <div>
                                <h4 class="bhm-section-title">تفاصيل التصرف</h4>
                                <p class="bhm-section-hint">النوع، التاريخ، والتقييم</p>
                            </div>
                        </div>
                        <div class="bhm-section-body">
                            <div class="bhm-grid bhm-grid-3">
                                <div class="bhm-field bhm-field-type">
                                    <div class="bhm-label-row">
                                        <label for="${ids.behaviorType}" class="bhm-label mb-0">نوع التصرف <span class="bhm-req">*</span></label>
                                        <span class="badge ${this.getBehaviorTypeBadgeClass(data?.behaviorType)} bhm-type-chip" id="${uid}-type-badge">${Utils.escapeHTML(data?.behaviorType || '—')}</span>
                                    </div>
                                    <select id="${ids.behaviorType}" required class="form-input bhm-input mt-2">
                                        <option value="">اختر النوع</option>
                                        <option value="إيجابي" ${data?.behaviorType === 'إيجابي' ? 'selected' : ''}>إيجابي</option>
                                        <option value="سلبي" ${data?.behaviorType === 'سلبي' ? 'selected' : ''}>سلبي</option>
                                    </select>
                                </div>
                                <div class="bhm-field">
                                    <label for="${ids.behaviorDate}" class="bhm-label">التاريخ <span class="bhm-req">*</span></label>
                                    <input type="date" id="${ids.behaviorDate}" required class="form-input bhm-input" value="${dateValue}">
                                </div>
                                <div class="bhm-field">
                                    <label for="${ids.behaviorRating}" class="bhm-label">التقييم <span class="bhm-req">*</span></label>
                                    <select id="${ids.behaviorRating}" required class="form-input bhm-input">
                                        <option value="">اختر التقييم</option>
                                        <option value="ممتاز" ${data?.rating === 'ممتاز' ? 'selected' : ''}>ممتاز</option>
                                        <option value="جيد" ${data?.rating === 'جيد' ? 'selected' : ''}>جيد</option>
                                        <option value="مقبول" ${data?.rating === 'مقبول' ? 'selected' : ''}>مقبول</option>
                                        <option value="ضعيف" ${data?.rating === 'ضعيف' ? 'selected' : ''}>ضعيف</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="bhm-section" aria-labelledby="${uid}-sec-loc">
                        <div class="bhm-section-head" id="${uid}-sec-loc">
                            <span class="bhm-section-icon bhm-section-icon--teal" aria-hidden="true"><i class="fas fa-map-marked-alt"></i></span>
                            <div>
                                <h4 class="bhm-section-title">الموقع</h4>
                                <p class="bhm-section-hint">المصنع والموقع الفرعي للملاحظة</p>
                            </div>
                        </div>
                        <div class="bhm-section-body">
                            <div class="bhm-grid bhm-grid-2">
                                <div class="bhm-field">
                                    <label for="${ids.factory}" class="bhm-label"><i class="fas fa-industry ml-1 opacity-70"></i> المصنع <span class="bhm-req">*</span></label>
                                    <select id="${ids.factory}" required class="form-input bhm-input">
                                        <option value="">اختر المصنع</option>
                                        ${sites.map(site => `
                                            <option value="${site.id}" ${(resolvedFactoryId === site.id || selectedFactory === site.name) ? 'selected' : ''}>${Utils.escapeHTML(site.name)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="bhm-field">
                                    <label for="${ids.subLocation}" class="bhm-label"><i class="fas fa-map-marker-alt ml-1 opacity-70"></i> الموقع الفرعي <span class="bhm-req">*</span></label>
                                    <select id="${ids.subLocation}" required class="form-input bhm-input">
                                        <option value="">اختر الموقع الفرعي</option>
                                        ${places.map(place => `
                                            <option value="${place.id}" ${(resolvedSubId === place.id || selectedSub === place.name) ? 'selected' : ''}>${Utils.escapeHTML(place.name)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="${uid}-negative-section" class="bhm-negative-panel" style="${isNegative ? '' : 'display:none;'}">
                        <div class="bhm-negative-head">
                            <span class="bhm-negative-icon" aria-hidden="true"><i class="fas fa-exclamation-triangle"></i></span>
                            <div>
                                <h4 class="bhm-negative-title">إجراء تصحيحي (للتصرف السلبي)</h4>
                                <p class="bhm-negative-sub">يظهر هذا القسم عند اختيار «سلبي» فقط</p>
                            </div>
                        </div>
                        <div class="bhm-negative-body">
                            <div class="bhm-grid bhm-grid-2">
                                <div class="bhm-field">
                                    <label for="${ids.correctiveAction}" class="bhm-label">الإجراء التصحيحي <span class="bhm-req">*</span></label>
                                    <select id="${ids.correctiveAction}" class="form-input bhm-input" ${isNegative ? 'required' : ''}>
                                        <option value="">اختر الإجراء</option>
                                        ${this.NEGATIVE_ACTIONS.map(a => `
                                            <option value="${Utils.escapeHTML(a)}" ${data?.correctiveAction === a ? 'selected' : ''}>${Utils.escapeHTML(a)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="bhm-field">
                                    <label for="${ids.correctiveActionDetails}" class="bhm-label">تفاصيل إضافية <span class="bhm-optional">(اختياري)</span></label>
                                    <input type="text" id="${ids.correctiveActionDetails}" class="form-input bhm-input"
                                        value="${Utils.escapeHTML(data?.correctiveActionDetails || '')}" placeholder="مثال: تدريب على SOP-01 / إنذار رقم…">
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="bhm-section bhm-section--media" aria-labelledby="${uid}-sec-desc">
                        <div class="bhm-section-head" id="${uid}-sec-desc">
                            <span class="bhm-section-icon bhm-section-icon--amber" aria-hidden="true"><i class="fas fa-align-right"></i></span>
                            <div>
                                <h4 class="bhm-section-title">الوصف والمرفقات</h4>
                                <p class="bhm-section-hint">وصف التصرف وصورة اختيارية</p>
                            </div>
                        </div>
                        <div class="bhm-section-body">
                            <div class="bhm-grid bhm-grid-media">
                                <div class="bhm-field bhm-upload-wrap">
                                    <label for="${ids.photoInput}" class="bhm-label"><i class="fas fa-image ml-1 opacity-70"></i> صورة <span class="bhm-optional">(غير إلزامي)</span></label>
                                    <div class="bhm-file-slot">
                                        <input type="file" id="${ids.photoInput}" accept="image/*" class="bhm-file-input">
                                        <span class="bhm-file-hint">PNG أو JPG — حتى 2 ميجا</span>
                                    </div>
                                    <div id="${ids.photoPreview}" class="bhm-photo-preview mt-3 ${data?.photo ? '' : 'hidden'}">
                                        <img src="${Utils.escapeHTML(photoThumbSrc)}" alt="معاينة"${photoThumbProxyAttr} class="bhm-photo-thumb" id="${ids.photoImg}">
                                        <button type="button" class="bhm-photo-clear" data-action="clear-photo">حذف الصورة</button>
                                    </div>
                                </div>
                                <div class="bhm-field bhm-field-grow">
                                    <label for="${ids.description}" class="bhm-label">الوصف <span class="bhm-req">*</span></label>
                                    <textarea id="${ids.description}" required class="form-input bhm-input bhm-textarea" rows="5" placeholder="وصف التصرف والظروف…">${Utils.escapeHTML(data?.description || '')}</textarea>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div class="bhm-form-footer">
                        ${inline ? '' : '<button type="button" class="btn-secondary bhm-btn-cancel" data-action="cancel-form">إلغاء</button>'}
                        <button type="button" id="${ids.saveBtn}" class="btn-primary bhm-btn-save">
                            <i class="fas fa-save ml-2"></i>
                            حفظ
                        </button>
                    </div>
                </form>
            </div>
        `;
    },

    bindBehaviorForm({ form, uid, data, modal, signal }) {
        // Employee autocomplete
        if (typeof EmployeeHelper !== 'undefined') {
            try {
                EmployeeHelper.setupAutocomplete(`${uid}-employee-name`, (employee) => {
                    if (employee) {
                        const codeEl = document.getElementById(`${uid}-employee-code`);
                        const nameEl = document.getElementById(`${uid}-employee-name`);
                        const depEl = document.getElementById(`${uid}-department`);
                        const jobEl = document.getElementById(`${uid}-job`);
                        if (codeEl) codeEl.value = employee.code || '';
                        if (nameEl) nameEl.value = employee.name || '';
                        if (depEl && (employee.department || employee.employeeDepartment)) depEl.value = employee.department || employee.employeeDepartment || '';
                        if (jobEl && (employee.job || employee.position || employee.title)) jobEl.value = employee.job || employee.position || employee.title || '';
                    }
                });
                EmployeeHelper.setupEmployeeCodeSearch(`${uid}-employee-code`, `${uid}-employee-name`);
            } catch (e) {
                Utils.safeWarn('⚠️ تعذر تفعيل البحث عن الموظف:', e);
            }
        }

        // مزامنة القسم/الوظيفة عند تغيير الكود/الاسم (في حال لم يعيد EmployeeHelper تفاصيل كافية)
        const syncEmployeeMeta = () => {
            try {
                const code = (document.getElementById(`${uid}-employee-code`)?.value || '').trim();
                const name = (document.getElementById(`${uid}-employee-name`)?.value || '').trim();
                const employees = Array.isArray(AppState?.appData?.employees) ? AppState.appData.employees : [];
                const emp = employees.find(e =>
                    (code && ((e.employeeNumber && e.employeeNumber === code) || (e.sapId && e.sapId === code))) ||
                    (name && (e.name === name))
                );
                if (!emp) return;
                const depEl = document.getElementById(`${uid}-department`);
                const jobEl = document.getElementById(`${uid}-job`);
                if (depEl && !depEl.value) depEl.value = emp.department || emp.employeeDepartment || '';
                if (jobEl && !jobEl.value) jobEl.value = emp.job || emp.position || emp.title || '';
            } catch (e) {
                // ignore
            }
        };
        document.getElementById(`${uid}-employee-code`)?.addEventListener('blur', syncEmployeeMeta, { signal });
        document.getElementById(`${uid}-employee-name`)?.addEventListener('blur', syncEmployeeMeta, { signal });

        // Photo preview
        const photoInput = document.getElementById(`${uid}-photo-input`);
        const photoPreview = document.getElementById(`${uid}-photo-preview`);
        const photoImg = document.getElementById(`${uid}-photo-img`);

        if (photoInput && photoPreview && photoImg) {
            photoInput.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                    Notification.error('حجم الصورة كبير جداً. الحد الأقصى 2MB');
                    photoInput.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    photoImg.src = ev.target.result;
                    photoPreview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }, { signal });
        }

        // Clear photo
        form.querySelector('[data-action="clear-photo"]')?.addEventListener('click', () => {
            const inp = document.getElementById(`${uid}-photo-input`);
            const preview = document.getElementById(`${uid}-photo-preview`);
            if (inp) inp.value = '';
            if (preview) preview.classList.add('hidden');
        }, { signal });

        // Theme badge + header tint
        const typeSelect = document.getElementById(`${uid}-type`);
        const typeBadge = document.getElementById(`${uid}-type-badge`);
        const wrapper = form.closest('.behavior-form-wrapper') || form.parentElement;
        const negativeSection = document.getElementById(`${uid}-negative-section`);
        const correctiveActionEl = document.getElementById(`${uid}-corrective-action`);
        const applyType = (t) => {
            if (wrapper) wrapper.setAttribute('data-behavior-type', t || '');
            if (typeBadge) {
                typeBadge.className = `badge ${this.getBehaviorTypeBadgeClass(t)}`;
                typeBadge.textContent = t || '—';
            }
            const modalContent = modal?.querySelector?.('.behavior-modal');
            if (modalContent) modalContent.setAttribute('data-behavior-type', t || '');

            // إظهار/إخفاء قسم الإجراء التصحيحي للتصرف السلبي
            const isNegative = (t || '') === 'سلبي';
            if (negativeSection) negativeSection.style.display = isNegative ? '' : 'none';
            if (correctiveActionEl) {
                if (isNegative) correctiveActionEl.setAttribute('required', 'required');
                else correctiveActionEl.removeAttribute('required');
            }
        };
        applyType(typeSelect?.value || data?.behaviorType || '');
        typeSelect?.addEventListener('change', () => applyType(typeSelect.value), { signal });

        // ربط المصنع -> تحديث المواقع الفرعية
        const factoryEl = document.getElementById(`${uid}-factory`);
        const subEl = document.getElementById(`${uid}-sublocation`);
        const refreshPlaces = () => {
            if (!factoryEl || !subEl) return;
            const factoryId = factoryEl.value;
            const places = this.getPlaceOptions(factoryId);
            const prev = subEl.value;
            subEl.innerHTML = `
                <option value="">اختر الموقع الفرعي</option>
                ${places.map(p => `<option value="${p.id}">${Utils.escapeHTML(p.name)}</option>`).join('')}
            `;
            if (prev && places.some(p => p.id === prev)) subEl.value = prev;
        };
        factoryEl?.addEventListener('change', refreshPlaces, { signal });

        // Cancel (modal)
        form.querySelector('[data-action="cancel-form"]')?.addEventListener('click', () => modal?.remove(), { signal });

        // Save
        const saveBtn = document.getElementById(`${uid}-save-btn`);
        saveBtn?.addEventListener('click', () => this.handleSubmit({ uid, form, editId: data?.id || null, modal }), { signal });
    },

    async showForm(data = null) {
        if (typeof Permissions !== 'undefined' && Permissions.ensureFormSettingsState) {
            try { await Permissions.ensureFormSettingsState(); } catch (e) { /* ignore */ }
        }
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        const uid = `bhm-modal-${Date.now()}`;
        modal.innerHTML = `
            <div class="modal-content behavior-modal bhm-registration-modal" data-behavior-type="${Utils.escapeHTML(data?.behaviorType || '')}">
                <div class="bhm-modal-hero">
                    <div class="bhm-modal-hero-text">
                        <p class="bhm-modal-kicker"><i class="fas fa-user-check ml-2"></i>مراقبة السلوكيات</p>
                        <h2 class="bhm-modal-title">${data ? 'تعديل التصرف' : 'تسجيل تصرف جديد'}</h2>
                        <p class="bhm-modal-sub">${data ? 'تحديث بيانات التسجيل ثم احفظ.' : 'أدخل بيانات الموظف والموقع ثم وصف التصرف.'}</p>
                    </div>
                    <button type="button" class="bhm-modal-close" onclick="this.closest('.modal-overlay').remove()" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body bhm-modal-body">
                    ${this.getBehaviorFormHTML(data, uid, { inline: false })}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // bind form in modal with isolated listeners
        if (this._modalAbortController) this._modalAbortController.abort();
        this._modalAbortController = new AbortController();
        const signal = this._modalAbortController.signal;

        const form = modal.querySelector('form[data-behavior-form="true"]');
        if (form) this.bindBehaviorForm({ form, uid, data, modal, signal });

        if (typeof Utils.hydrateDriveProxyImages === 'function') {
            Utils.hydrateDriveProxyImages(modal, {
                onFetchFail: (img) => {
                    try {
                        img.onerror = null;
                        img.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22200%22 height=%22150%22/%3E%3Ctext fill=%22%23999%22 font-size=%2212%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22%3Eمعاينة%3C/text%3E%3C/svg%3E';
                    } catch (e) { /* ignore */ }
                }
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        }, { signal });
    },

    async convertImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    async handleSubmit({ uid, form, editId = null, modal }) {
        // معالجة الصورة
        let photoBase64 = editId ? (this.getBehaviors().find(b => b.id === editId)?.photo || '') : '';
        const photoInput = document.getElementById(`${uid}-photo-input`);
        if (photoInput && photoInput.files.length > 0) {
            const file = photoInput.files[0];
            if (file.size > 2 * 1024 * 1024) {
                Notification.error('حجم الصورة كبير جداً. الحد الأقصى 2MB');
                return;
            }
            photoBase64 = await this.convertImageToBase64(file);
        }

        const employeeCode = (document.getElementById(`${uid}-employee-code`)?.value || '').trim();
        const employeeName = (document.getElementById(`${uid}-employee-name`)?.value || '').trim();
        const employees = Array.isArray(AppState?.appData?.employees) ? AppState.appData.employees : [];
        const employee = employees.find(e =>
            (e.employeeNumber && e.employeeNumber === employeeCode) ||
            (e.sapId && e.sapId === employeeCode) ||
            e.name === employeeName
        );

        // فحص العناصر قبل الاستخدام
        const behaviorTypeEl = document.getElementById(`${uid}-type`);
        const behaviorDateEl = document.getElementById(`${uid}-date`);
        const behaviorRatingEl = document.getElementById(`${uid}-rating`);
        const behaviorDescriptionEl = document.getElementById(`${uid}-description`);
        const departmentEl = document.getElementById(`${uid}-department`);
        const jobEl = document.getElementById(`${uid}-job`);
        const factoryEl = document.getElementById(`${uid}-factory`);
        const subEl = document.getElementById(`${uid}-sublocation`);
        const correctiveActionEl = document.getElementById(`${uid}-corrective-action`);
        const correctiveActionDetailsEl = document.getElementById(`${uid}-corrective-action-details`);
        
        if (!behaviorTypeEl || !behaviorDateEl || !behaviorRatingEl || !behaviorDescriptionEl || !departmentEl || !jobEl || !factoryEl || !subEl) {
            Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
            return;
        }

        // تحقق إضافي: عند التصرف السلبي يجب إدخال إجراء تصحيحي
        const isNegative = (behaviorTypeEl.value || '') === 'سلبي';
        if (isNegative && (!correctiveActionEl || !correctiveActionEl.value)) {
            Notification.error('يرجى اختيار الإجراء التصحيحي للتصرف السلبي');
            return;
        }

        const formData = {
            id: editId || Utils.generateId('BEHAV'),
            isoCode: generateISOCode('BEH', AppState.appData.behaviorMonitoring),
            employeeId: employee?.id || '',
            employeeCode: employeeCode,
            employeeNumber: employeeCode,
            employeeName: employeeName,
            department: (departmentEl.value || '').trim(),
            job: (jobEl.value || '').trim(),
            factory: (factoryEl.value || '').trim(),
            factoryId: factoryEl.value ? String(factoryEl.value).trim() : null,
            factoryName: this.resolveSiteName(factoryEl.value),
            subLocation: (subEl.value || '').trim(),
            subLocationId: subEl.value ? String(subEl.value).trim() : null,
            subLocationName: this.resolvePlaceName(subEl.value, factoryEl.value),
            photo: photoBase64,
            behaviorType: behaviorTypeEl.value,
            date: new Date(behaviorDateEl.value).toISOString(),
            rating: behaviorRatingEl.value,
            correctiveAction: isNegative ? (correctiveActionEl?.value || '') : '',
            correctiveActionDetails: isNegative ? ((correctiveActionDetailsEl?.value || '').trim()) : '',
            description: behaviorDescriptionEl.value.trim(),
            createdAt: editId ? this.getBehaviors().find(b => b.id === editId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        Loading.show();
        try {
            if (editId) {
                const index = AppState.appData.behaviorMonitoring.findIndex(b => b.id === editId);
                if (index !== -1) AppState.appData.behaviorMonitoring[index] = formData;
                Notification.success('تم تحديث التصرف بنجاح');
            } else {
                AppState.appData.behaviorMonitoring.push(formData);
                Notification.success('تم تسجيل التصرف بنجاح');
            }

            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }

            // حفظ تلقائي في Google Sheets
            await GoogleIntegration.autoSave('BehaviorMonitoring', AppState.appData.behaviorMonitoring);

            Loading.hide();
            if (modal) modal.remove();
            this.refreshCurrentTab();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    async viewBehavior(id) {
        const raw = this.getRawBehaviorById(id);
        if (!raw) {
            Notification.error('التصرف غير موجود');
            return;
        }
        const behavior = this.presentBehavior(raw);
        const esc = (v) => Utils.escapeHTML((v ?? '').toString());
        const valOrDash = (v) => {
            const s = (v ?? '').toString().trim();
            return s ? esc(s) : '<span class="bhm-detail-empty">—</span>';
        };
        const descText = (behavior.description || '').toString().trim();
        const descBlock = descText
            ? `<div class="bhm-detail-value bhm-detail-desc">${esc(descText)}</div>`
            : '<div class="bhm-detail-empty-block"><i class="fas fa-align-right ml-2"></i>لا يوجد وصف مسجل لهذا التصرف.</div>';
        const dateStr = this.getBehaviorDate(behavior) ? this.formatBehaviorDateDisplay(behavior) : '—';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay bhm-detail-overlay';
        modal.innerHTML = `
            <div class="modal-content behavior-modal bhm-detail-modal" style="max-width: 820px;">
                <div class="bhm-detail-hero">
                    <div class="bhm-detail-hero-text">
                        <p class="bhm-detail-kicker"><i class="fas fa-clipboard-list ml-2"></i>مراقبة السلوكيات</p>
                        <h2 class="bhm-detail-title">تفاصيل التصرف</h2>
                        <p class="bhm-detail-sub">${esc(behavior.isoCode || '—')} <span class="bhm-detail-sub-sep">·</span> ${esc(behavior.employeeName || '')}</p>
                    </div>
                    <button type="button" class="bhm-detail-close" onclick="this.closest('.modal-overlay').remove()" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body bhm-detail-body">
                    <div class="bhm-detail-grid">
                        <div class="bhm-detail-field">
                            <span class="bhm-detail-label">كود ISO</span>
                            <div class="bhm-detail-value">${valOrDash(behavior.isoCode)}</div>
                        </div>
                        <div class="bhm-detail-field">
                            <span class="bhm-detail-label">الكود الوظيفي</span>
                            <div class="bhm-detail-value">${valOrDash(behavior.employeeCode || behavior.employeeNumber)}</div>
                        </div>
                        <div class="bhm-detail-field bhm-detail-field-span2">
                            <span class="bhm-detail-label">اسم الموظف</span>
                            <div class="bhm-detail-value bhm-detail-value-strong">${valOrDash(behavior.employeeName)}</div>
                        </div>
                        <div class="bhm-detail-field">
                            <span class="bhm-detail-label">القسم</span>
                            <div class="bhm-detail-value">${valOrDash(behavior.department || behavior.employeeDepartment)}</div>
                        </div>
                        <div class="bhm-detail-field">
                            <span class="bhm-detail-label">الوظيفة</span>
                            <div class="bhm-detail-value">${valOrDash(behavior.job || behavior.position)}</div>
                        </div>
                        <div class="bhm-detail-field">
                            <span class="bhm-detail-label">المصنع / الموقع</span>
                            <div class="bhm-detail-value">${valOrDash(behavior.factoryName || behavior.factory)}</div>
                        </div>
                        <div class="bhm-detail-field">
                            <span class="bhm-detail-label">الموقع الفرعي</span>
                            <div class="bhm-detail-value">${valOrDash(behavior.subLocationName || behavior.subLocation)}</div>
                        </div>
                        <div class="bhm-detail-field">
                            <span class="bhm-detail-label">نوع التصرف</span>
                            <div class="bhm-detail-value">
                                <span class="badge ${this.getBehaviorTypeBadgeClass(behavior.behaviorType)}">${esc(behavior.behaviorType || '—')}</span>
                            </div>
                        </div>
                        <div class="bhm-detail-field">
                            <span class="bhm-detail-label">التاريخ</span>
                            <div class="bhm-detail-value">${dateStr === '—' ? '<span class="bhm-detail-empty">—</span>' : esc(dateStr)}</div>
                        </div>
                        <div class="bhm-detail-field">
                            <span class="bhm-detail-label">التقييم</span>
                            <div class="bhm-detail-value">
                                <span class="badge ${this.getRatingBadgeClass(behavior.rating)}">${esc(behavior.rating || '—')}</span>
                            </div>
                        </div>
                        <div class="bhm-detail-field bhm-detail-field-span2">
                            <span class="bhm-detail-label">الوصف</span>
                            ${descBlock}
                        </div>
                        ${(behavior.behaviorType === 'سلبي' && (behavior.correctiveAction || behavior.correctiveActionDetails)) ? `
                            <div class="bhm-detail-field bhm-detail-field-span2 bhm-detail-corrective">
                                <span class="bhm-detail-label">الإجراء التصحيحي</span>
                                <div class="bhm-detail-value">
                                    <span class="badge badge-danger">${esc(behavior.correctiveAction || '—')}</span>
                                    ${behavior.correctiveActionDetails ? `<div class="bhm-detail-corrective-details">${esc(behavior.correctiveActionDetails)}</div>` : ''}
                                </div>
                            </div>
                        ` : ''}
                        ${(() => {
                            const photoUrl = this.processPhoto(behavior.photo);
                            if (!photoUrl) return '';
                            const disp = typeof Utils.resolveDriveAwareImgDisplay === 'function'
                                ? Utils.resolveDriveAwareImgDisplay(photoUrl)
                                : { canonical: photoUrl, displaySrc: photoUrl, needsProxy: false, proxyFileId: '' };
                            const pa = typeof Utils.driveProxyImgAttrs === 'function' ? Utils.driveProxyImgAttrs(disp) : '';
                            return `
                            <div class="bhm-detail-field bhm-detail-field-span2">
                                <span class="bhm-detail-label">الصورة</span>
                                <div class="bhm-detail-photo-wrap">
                                    <img src="${Utils.escapeHTML(disp.displaySrc)}" alt="صورة التصرف"${pa} class="bhm-detail-photo"
                                         onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';">
                                </div>
                            </div>
                        `;})()}
                    </div>
                </div>
                <div class="bhm-detail-footer">
                    <button type="button" class="btn-primary" onclick="BehaviorMonitoring.editBehavior('${behavior.id}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-pen ml-2"></i>تعديل
                    </button>
                    <button type="button" class="btn-secondary" onclick="BehaviorMonitoring.printReport('${behavior.id}');">
                        <i class="fas fa-print ml-2"></i>طباعة
                    </button>
                    <button type="button" class="btn-secondary" onclick="BehaviorMonitoring.exportPDF('${behavior.id}');">
                        <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                    </button>
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (typeof Utils.hydrateDriveProxyImages === 'function') {
            Utils.hydrateDriveProxyImages(modal, {
                onFetchFail: (img) => {
                    try {
                        img.onerror = null;
                        img.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';
                    } catch (e) { /* ignore */ }
                }
            });
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async exportPDF(id) {
        const raw = this.getRawBehaviorById(id);
        if (!raw) {
            Notification.error('التصرف غير موجود');
            return;
        }
        const behavior = this.presentBehavior(raw);

        try {
            Loading.show();
            const formCode = behavior.isoCode || `BEH-${behavior.id?.substring(0, 8) || 'UNKNOWN'}`;
            const formTitle = 'تقرير مراقبة التصرفات';
            const pdfDate = this.getBehaviorDate(behavior) ? this.formatBehaviorDateDisplay(behavior) : '—';

            const content = `
                <table>
                    <tr><th>كود ISO</th><td>${Utils.escapeHTML(behavior.isoCode || '')}</td></tr>
                    <tr><th>الكود الوظيفي</th><td>${Utils.escapeHTML(behavior.employeeCode || behavior.employeeNumber || '')}</td></tr>
                    <tr><th>اسم الموظف</th><td>${Utils.escapeHTML(behavior.employeeName || '')}</td></tr>
                    <tr><th>القسم</th><td>${Utils.escapeHTML(behavior.department || behavior.employeeDepartment || '')}</td></tr>
                    <tr><th>الوظيفة</th><td>${Utils.escapeHTML(behavior.job || behavior.position || '')}</td></tr>
                    <tr><th>المصنع</th><td>${Utils.escapeHTML(behavior.factoryName || behavior.factory || '')}</td></tr>
                    <tr><th>الموقع الفرعي</th><td>${Utils.escapeHTML(behavior.subLocationName || behavior.subLocation || '')}</td></tr>
                    <tr><th>نوع التصرف</th><td>${Utils.escapeHTML(behavior.behaviorType || '')}</td></tr>
                    <tr><th>التاريخ</th><td>${Utils.escapeHTML(pdfDate)}</td></tr>
                    <tr><th>التقييم</th><td>${Utils.escapeHTML(behavior.rating || '')}</td></tr>
                    ${(behavior.behaviorType === 'سلبي' && (behavior.correctiveAction || behavior.correctiveActionDetails)) ? `
                        <tr><th>الإجراء التصحيحي</th><td>${Utils.escapeHTML(behavior.correctiveAction || '')}</td></tr>
                        <tr><th>تفاصيل الإجراء</th><td>${Utils.escapeHTML(behavior.correctiveActionDetails || '')}</td></tr>
                    ` : ''}
                    <tr><th colspan="2">الوصف</th></tr>
                    <tr><td colspan="2">${Utils.escapeHTML(behavior.description || '')}</td></tr>
                </table>
                ${(() => {
                    const photoUrl = this.processPhoto(behavior.photo);
                    return photoUrl ? `
                <div class="section-title">صورة التصرف:</div>
                <div style="text-align: center; margin: 20px 0;">
                    <img src="${Utils.escapeHTML(photoUrl)}" alt="صورة التصرف" style="max-width: 100%; max-height: 400px; border: 1px solid #ddd; border-radius: 8px;"
                         onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';">
                </div>
                ` : '';})()}
            `;

            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(formCode, formTitle, content, false, true, { version: '1.0' }, behavior.createdAt, behavior.updatedAt)
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>@page { size: A4 portrait; margin: 1cm; } @media print { @page { size: A4 portrait; margin: 1cm; } body { padding: 0; } }</style><title>متابعة السلوك</title></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        // Clean up blob URL after print
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                        }, 1000);
                        Loading.hide();
                    }, 500);
                };
            } else {
                URL.revokeObjectURL(url);
                Loading.hide();
                Notification.error('يرجى السماح بالنوافذ المنبثقة');
            }
        } catch (error) {
            Loading.hide();
            // Ensure cleanup on error
            if (typeof url !== 'undefined') {
                URL.revokeObjectURL(url);
            }
            Notification.error('حدث خطأ في تصدير PDF: ' + error.message);
        }
    },

    async printReport(id) {
        await this.exportPDF(id);
    },

    /**
     * تنظيف جميع الموارد عند إلغاء تحميل الموديول
     * يمنع تسريبات الذاكرة (Memory Leaks)
     */
    cleanup() {
        try {
            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('🧹 تنظيف موارد BehaviorMonitoring module...');
            }

            // تنظيف event listeners
            if (this._eventListenersAbortController) {
                this._eventListenersAbortController.abort();
                this._eventListenersAbortController = null;
            }

            // تنظيف listeners الخاصة بالمودالات
            if (this._modalAbortController) {
                this._modalAbortController.abort();
                this._modalAbortController = null;
            }

            // تنظيف timeout
            if (this._setupTimeoutId) {
                clearTimeout(this._setupTimeoutId);
                this._setupTimeoutId = null;
            }

            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ تم تنظيف موارد BehaviorMonitoring module');
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ خطأ في تنظيف BehaviorMonitoring module:', error);
            }
        }
    }
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof BehaviorMonitoring !== 'undefined') {
            window.BehaviorMonitoring = BehaviorMonitoring;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ BehaviorMonitoring module loaded and available on window.BehaviorMonitoring');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير BehaviorMonitoring:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof BehaviorMonitoring !== 'undefined') {
            try {
                window.BehaviorMonitoring = BehaviorMonitoring;
            } catch (e) {
                console.error('❌ فشل تصدير BehaviorMonitoring:', e);
            }
        }
    }
})();
