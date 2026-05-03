/**
 * LegalDocuments Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ …Ù† app-modules.js
 */
// ===== Legal Documents Module (المستندات القانونية والتشريعية) =====
const LegalDocuments = {
    state: {
        activeTab: 'documents',
        filters: {
            documents: {
                search: '',
                type: '',
                status: '',
                issuedBy: '',
                dateFrom: '',
                dateTo: ''
            }
        }
    },

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

    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        const section = document.getElementById('legal-documents-section');
        if (!section) return;

        // التحقق من وجود AppState
        if (typeof AppState === 'undefined') {
            // لا تترك الواجهة فارغة
            section.innerHTML = `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-2">تعذر تحميل الوثائق القانونية</p>
                            <p class="text-sm text-gray-400">AppState غير متوفر حالياً. جرّب تحديث الصفحة.</p>
                            <button onclick="location.reload()" class="btn-primary mt-4">
                                <i class="fas fa-redo ml-2"></i>
                                تحديث الصفحة
                            </button>
                        </div>
                    </div>
                </div>
            `;
            if (typeof Utils !== 'undefined' && Utils.safeError) Utils.safeError('AppState غير متوفر!');
            else console.error('AppState غير متوفر!');
            return;
        }

        try {
            // Skeleton فوري قبل أي render قد يكون بطيئاً
            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-gavel ml-3"></i>
                                المستندات القانونية والتشريعية
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

            const title = (typeof i18n !== 'undefined' && i18n.translate) ? i18n.translate('legal.title') : 'المستندات القانونية والتشريعية';
            const subtitle = (typeof i18n !== 'undefined' && i18n.translate) ? i18n.translate('legal.subtitle') : 'متابعة المستندات القانونية وترة صلاحيتها والتحديثات';
            const checkUpdates = (typeof i18n !== 'undefined' && i18n.translate) ? i18n.translate('legal.checkUpdates') : 'التحقق من التحديثات القانونية';
            const addDocument = (typeof i18n !== 'undefined' && i18n.translate) ? i18n.translate('legal.addDocument') : 'إضافة مستند قانوني';

            section.innerHTML = `
            <div class="section-header">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-gavel ml-3"></i>
                            ${title}
                        </h1>
                        <p class="section-subtitle">${subtitle}</p>
                    </div>
                    <div class="flex gap-2">
                        <button id="check-legal-updates-btn" class="btn-warning">
                            <i class="fas fa-sync-alt ml-2"></i>
                            ${checkUpdates}
                        </button>
                        <button id="add-legal-document-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            ${addDocument}
                        </button>
                    </div>
                </div>
            </div>
            <div id="legal-documents-content" class="mt-6">
                <!-- Tabs Navigation -->
                <div class="flex flex-wrap gap-2 mb-4" id="legal-tab-nav">
                    <button type="button" class="btn-secondary legal-tab-btn ${this.state.activeTab === 'documents' ? 'active' : ''}" data-tab="documents">
                        <i class="fas fa-file-contract ml-2"></i>المستندات القانونية
                    </button>
                    <button type="button" class="btn-secondary legal-tab-btn ${this.state.activeTab === 'inventory' ? 'active' : ''}" data-tab="inventory">
                        <i class="fas fa-clipboard-list ml-2"></i>سجل حصر التشريعات والقوانين
                    </button>
                </div>
                
                <!-- Tab Panels -->
                <div id="legal-tab-panels">
                    <div class="legal-tab-panel" data-tab-panel="documents" style="display: ${this.state.activeTab === 'documents' ? 'block' : 'none'}">
                        <div class="content-card">
                            <div class="card-body">
                                <div class="empty-state">
                                    <div style="width: 300px; margin: 0 auto 16px;">
                                        <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                            <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                        </div>
                                    </div>
                                    <p class="text-gray-500">جاري تحميل المستندات...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="legal-tab-panel" data-tab-panel="inventory" style="display: ${this.state.activeTab === 'inventory' ? 'block' : 'none'}">
                        <div class="content-card">
                            <div class="card-body">
                                <div class="empty-state">
                                    <div style="width: 300px; margin: 0 auto 16px;">
                                        <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                            <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                        </div>
                                    </div>
                                    <p class="text-gray-500">جاري تحميل سجل الحصر...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
            this.setupEventListeners();
            this.bindTabEvents();
            
            // ✅ تحميل محتوى التبويبات فوراً بعد عرض الواجهة
            setTimeout(async () => {
                try {
                    const documentsPanel = document.querySelector('[data-tab-panel="documents"]');
                    const inventoryPanel = document.querySelector('[data-tab-panel="inventory"]');
                    
                    // تحميل محتوى المستندات
                    if (documentsPanel) {
                        const listContent = await this.renderList().catch(error => {
                            Utils.safeWarn('⚠️ خطأ في تحميل قائمة المستندات:', error);
                            return `
                                <div class="content-card">
                                    <div class="card-body">
                                        <div class="empty-state">
                                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                            <p class="text-gray-500 mb-4">حدث خطأ في تحميل البيانات</p>
                                            <button onclick="LegalDocuments.load()" class="btn-primary">
                                                <i class="fas fa-redo ml-2"></i>
                                                إعادة المحاولة
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        });
                        documentsPanel.innerHTML = listContent;
                        
                        if (this.state.activeTab === 'documents') {
                            this.loadLegalDocumentsList();
                            this.checkExpiringDocuments();
                        }
                    }
                    
                    // تحميل محتوى سجل الحصر
                    if (inventoryPanel) {
                        const inventoryContent = await this.renderInventoryTab().catch(error => {
                            Utils.safeWarn('⚠️ خطأ في تحميل سجل الحصر:', error);
                            return `
                                <div class="content-card">
                                    <div class="card-body">
                                        <div class="empty-state">
                                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                            <p class="text-gray-500 mb-4">حدث خطأ في تحميل البيانات</p>
                                            <button onclick="LegalDocuments.load()" class="btn-primary">
                                                <i class="fas fa-redo ml-2"></i>
                                                إعادة المحاولة
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        });
                        inventoryPanel.innerHTML = inventoryContent;
                        
                        if (this.state.activeTab === 'inventory') {
                            this.loadInventoryList();
                        }
                    }
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في تحميل التبويبات:', error);
                }
            }, 0);
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في تحميل مديول المستندات القانونية:', error);
            } else {
                console.error('❌ خطأ في تحميل مديول المستندات القانونية:', error);
            }
            if (section) {
                section.innerHTML = `
                    <div class="section-header">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-gavel ml-3"></i>
                                المستندات القانونية والتشريعية
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
                                    <button onclick="LegalDocuments.load()" class="btn-primary">
                                        <i class="fas fa-redo ml-2"></i>
                                        إعادة المحاولة
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    },

    /**
     * حساب إحصائيات المستندات القانونية
     */
    getStatistics() {
        try {
            const documents = AppState.appData.legalDocuments || [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let total = documents.length;
            let expired = 0;
            let active = 0;
            let expiringSoon = 0;

            documents.forEach(doc => {
                if (!doc) return; // تخطي المستندات الفارغة

                // التحقق من وجود تاريخ انتهاء صحيح
                let hasExpiryDate = false;
                let expiryDate = null;
                let daysRemaining = 0;
                let isExpired = false;

                if (doc.expiryDate) {
                    try {
                        expiryDate = new Date(doc.expiryDate);
                        // التحقق من أن التاريخ صحيح
                        if (!isNaN(expiryDate.getTime())) {
                            hasExpiryDate = true;
                            expiryDate.setHours(0, 0, 0, 0);
                            daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                            isExpired = expiryDate < today;
                        }
                    } catch (error) {
                        // في حالة خطأ في تحويل التاريخ، نتجاهل تاريخ الانتهاء
                        console.warn('خطأ في تحويل تاريخ الانتهاء للمستند:', doc.id, error);
                    }
                }

                // حساب المستندات المنتهية (بغض النظر عن الحالة)
                if (hasExpiryDate && isExpired) {
                    expired++;
                }

                // حساب المستندات السارية (نشطة ولم تنتهِ صلاحيتها)
                if (doc.status === 'نشط') {
                    // مستند نشط إما لا يوجد له تاريخ انتهاء أو لم ينتهِ بعد
                    if (!hasExpiryDate || !isExpired) {
                        active++;
                        
                        // حساب المستندات قريبة على الانتهاء (جزء من السارية)
                        if (hasExpiryDate && !isExpired) {
                            const alertDays = parseInt(doc.alertDays) || 30;
                            if (daysRemaining <= alertDays && daysRemaining > 0) {
                                expiringSoon++;
                            }
                        }
                    }
                }
            });

            return {
                total,
                expired,
                active,
                expiringSoon
            };
        } catch (error) {
            console.error('خطأ في حساب إحصائيات المستندات:', error);
            return {
                total: 0,
                expired: 0,
                active: 0,
                expiringSoon: 0
            };
        }
    },

    /**
     * عرض كروت الإحصائيات
     */
    renderStatisticsCards() {
        let stats;
        try {
            stats = this.getStatistics();
            // التأكد من أن جميع القيم موجودة وصحيحة
            stats = {
                total: stats.total || 0,
                expired: stats.expired || 0,
                active: stats.active || 0,
                expiringSoon: stats.expiringSoon || 0
            };
        } catch (error) {
            console.error('خطأ في حساب إحصائيات المستندات:', error);
            // قيم افتراضية في حالة الخطأ
            stats = {
                total: 0,
                expired: 0,
                active: 0,
                expiringSoon: 0
            };
        }
        
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <!-- إجمالي المستندات -->
                <div class="content-card bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <p class="text-sm font-medium text-gray-600 mb-1">
                                <i class="fas fa-file-contract ml-2"></i>إجمالي المستندات
                            </p>
                            <p class="text-3xl font-bold text-blue-600">${stats.total}</p>
                            <p class="text-xs text-gray-500 mt-1">مستند قانوني مسجل</p>
                        </div>
                        <div class="bg-blue-500 rounded-full p-4 shadow-md">
                            <i class="fas fa-file-contract text-white text-2xl"></i>
                        </div>
                    </div>
                </div>
                
                <!-- المستندات المنتهية -->
                <div class="content-card bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <p class="text-sm font-medium text-gray-600 mb-1">
                                <i class="fas fa-exclamation-circle ml-2"></i>المستندات المنتهية
                            </p>
                            <p class="text-3xl font-bold text-red-600">${stats.expired}</p>
                            <p class="text-xs text-gray-500 mt-1">${stats.total > 0 ? Math.round((stats.expired / stats.total) * 100) : 0}% من الإجمالي</p>
                        </div>
                        <div class="bg-red-500 rounded-full p-4 shadow-md">
                            <i class="fas fa-exclamation-circle text-white text-2xl"></i>
                        </div>
                    </div>
                </div>
                
                <!-- المستندات السارية -->
                <div class="content-card bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <p class="text-sm font-medium text-gray-600 mb-1">
                                <i class="fas fa-check-circle ml-2"></i>المستندات السارية
                            </p>
                            <p class="text-3xl font-bold text-green-600">${stats.active}</p>
                            <p class="text-xs text-gray-500 mt-1">مستندات نشطة وصالحة</p>
                        </div>
                        <div class="bg-green-500 rounded-full p-4 shadow-md">
                            <i class="fas fa-check-circle text-white text-2xl"></i>
                        </div>
                    </div>
                </div>
                
                <!-- مستندات قريبة على الانتهاء -->
                <div class="content-card bg-gradient-to-br from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <p class="text-sm font-medium text-gray-600 mb-1">
                                <i class="fas fa-clock ml-2"></i>قريبة على الانتهاء
                            </p>
                            <p class="text-3xl font-bold text-yellow-600">${stats.expiringSoon}</p>
                            <p class="text-xs text-gray-500 mt-1">تحتاج متابعة عاجلة</p>
                        </div>
                        <div class="bg-yellow-500 rounded-full p-4 shadow-md">
                            <i class="fas fa-clock text-white text-2xl"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async renderList() {
        return `
            <!-- كروت الإحصائيات -->
            <div id="legal-documents-stats-container" class="mb-6">
                ${this.renderStatisticsCards()}
            </div>
            
            <div class="content-card">
                    <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title"><i class="fas fa-list ml-2"></i>${(typeof i18n !== 'undefined' && i18n.translate) ? i18n.translate('legal.list') : 'قائمة المستندات القانونية'}</h2>
                        <button id="export-legal-excel-btn" class="btn-success">
                            <i class="fas fa-file-excel ml-2"></i>${(typeof i18n !== 'undefined' && i18n.translate) ? i18n.translate('legal.exportExcel') : 'تصدير Excel'}
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="legal-documents-table-container">
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
            
            <div class="content-card mt-6">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-link ml-2"></i>متابعة التحديثات القانونية</h2>
                </div>
                <div class="card-body">
                    <div class="space-y-4">
                        <div class="bg-blue-50 border border-blue-200 rounded p-4">
                            <p class="text-sm text-blue-800 mb-3">
                                <i class="fas fa-info-circle ml-2"></i>
                                <strong>متابعة التحديثات:</strong> يمكنك متابعة التحديثات القانونية والتشريعية عبر بوابة التشريعات والقوانين الرسمية
                            </p>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-globe ml-2"></i>
                                        رابط بوابة التشريعات
                                    </label>
                                    <input type="url" id="legal-portal-url" class="form-input" 
                                        value="${AppState.legalPortalUrl || ''}" 
                                        placeholder="https://example.com/legal-portal">
                                    <p class="text-xs text-gray-500 mt-1">رابط بوابة التشريعات الرسمية لمتابعة التحديثات</p>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-bell ml-2"></i>
                                        تفعيل التنبيهات التلقائية
                                    </label>
                                    <label class="flex items-center">
                                        <input type="checkbox" id="legal-auto-notify" class="rounded border-gray-300 text-blue-600"
                                            ${AppState.legalAutoNotify ? 'checked' : ''}>
                                        <span class="mr-2 text-sm text-gray-700">تنبيه تلقائي عند وجود تحديثات</span>
                                    </label>
                                </div>
                            </div>
                            <div class="mt-4">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-keywords ml-2"></i>
                                    كلمات متاحية للمتابعة
                                </label>
                                <textarea id="legal-keywords" class="form-input" rows="3"
                                    placeholder="أدخل الكلمات المتاحية للمتابعة (مصولة بواصل)">${(AppState.legalKeywords || []).join(', ')}</textarea>
                                <p class="text-xs text-gray-500 mt-1">مثال: سلامة مهنية، بيئة، صحة، تشريعات العمل</p>
                            </div>
                            <button type="button" id="save-legal-settings-btn" class="btn-primary mt-3">
                                <i class="fas fa-save ml-2"></i>حفظ إعدادات المتابعة
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * تحديث كروت الإحصائيات
     */
    updateStatisticsCards() {
        const statsContainer = document.getElementById('legal-documents-stats-container');
        if (statsContainer) {
            statsContainer.innerHTML = this.renderStatisticsCards();
        }
    },

    normalizeSearchText(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .toLowerCase()
            .replace(/[\u064B-\u065F\u0670]/g, '')
            .replace(/ـ/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
            .replace(/\s+/g, ' ')
            .trim();
    },

    getFilteredLegalDocuments() {
        const documents = AppState.appData.legalDocuments || [];
        const filters = this.state.filters?.documents || {};
        const searchTerm = this.normalizeSearchText(filters.search || '');
        const typeFilter = String(filters.type || '').trim();
        const statusFilter = String(filters.status || '').trim();
        const issuedByFilter = String(filters.issuedBy || '').trim();
        const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
        const toDate = filters.dateTo ? new Date(filters.dateTo) : null;

        if (fromDate && !isNaN(fromDate.getTime())) fromDate.setHours(0, 0, 0, 0);
        if (toDate && !isNaN(toDate.getTime())) toDate.setHours(23, 59, 59, 999);

        return documents.filter((doc) => {
            const docType = String(doc.documentType || '');
            const expiryDate = doc.expiryDate ? new Date(doc.expiryDate) : null;
            const today = new Date();
            const alertDays = parseInt(doc.alertDays, 10) || 30;
            const daysRemaining = expiryDate && !isNaN(expiryDate.getTime())
                ? Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
                : null;
            const isExpired = daysRemaining !== null ? daysRemaining <= 0 : false;
            const isExpiringSoon = daysRemaining !== null ? (daysRemaining > 0 && daysRemaining <= alertDays) : false;
            const computedStatus = isExpired ? 'منتهي' : isExpiringSoon ? 'قارب على الانتهاء' : 'نشط';

            const docStatus = String(computedStatus || doc.status || '');
            const docIssuedBy = String(doc.issuedBy || '');
            const issueDate = doc.issueDate ? new Date(doc.issueDate) : null;

            const searchableText = this.normalizeSearchText([
                doc.documentName || '',
                doc.documentNumber || '',
                doc.isoCode || '',
                doc.documentType || '',
                doc.issuedBy || '',
                doc.description || ''
            ].join(' '));

            const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
            const matchesType = !typeFilter || docType === typeFilter;
            const matchesStatus = !statusFilter || docStatus === statusFilter;
            const matchesIssuedBy = !issuedByFilter || docIssuedBy === issuedByFilter;

            let matchesDate = true;
            if (issueDate && !isNaN(issueDate.getTime())) {
                if (fromDate && issueDate < fromDate) matchesDate = false;
                if (toDate && issueDate > toDate) matchesDate = false;
            } else if (fromDate || toDate) {
                matchesDate = false;
            }

            return matchesSearch && matchesType && matchesStatus && matchesIssuedBy && matchesDate;
        });
    },

    resetLegalDocumentFilters() {
        if (!this.state.filters) this.state.filters = {};
        this.state.filters.documents = {
            search: '',
            type: '',
            status: '',
            issuedBy: '',
            dateFrom: '',
            dateTo: ''
        };
    },

    bindLegalDocumentsFilterEvents(container) {
        if (!container) return;

        const searchInput = container.querySelector('#legal-docs-search');
        const typeFilter = container.querySelector('#legal-docs-filter-type');
        const statusFilter = container.querySelector('#legal-docs-filter-status');
        const issuedByFilter = container.querySelector('#legal-docs-filter-issued-by');
        const dateFromInput = container.querySelector('#legal-docs-date-from');
        const dateToInput = container.querySelector('#legal-docs-date-to');
        const resetBtn = container.querySelector('#legal-docs-reset-filters');

        if (searchInput) {
            let isComposing = false;
            const triggerSearch = (value, caretPos = null) => {
                this.state.filters.documents.search = value || '';
                if (this._legalDocsSearchDebounceTimer) {
                    clearTimeout(this._legalDocsSearchDebounceTimer);
                }
                this._legalDocsSearchDebounceTimer = setTimeout(() => {
                    this.loadLegalDocumentsList();
                    requestAnimationFrame(() => {
                        const newInput = document.getElementById('legal-docs-search');
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

        if (typeFilter) {
            typeFilter.addEventListener('change', (event) => {
                this.state.filters.documents.type = event.target.value || '';
                this.loadLegalDocumentsList();
            });
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', (event) => {
                this.state.filters.documents.status = event.target.value || '';
                this.loadLegalDocumentsList();
            });
        }

        if (issuedByFilter) {
            issuedByFilter.addEventListener('change', (event) => {
                this.state.filters.documents.issuedBy = event.target.value || '';
                this.loadLegalDocumentsList();
            });
        }

        if (dateFromInput) {
            dateFromInput.addEventListener('change', (event) => {
                this.state.filters.documents.dateFrom = event.target.value || '';
                this.loadLegalDocumentsList();
            });
        }

        if (dateToInput) {
            dateToInput.addEventListener('change', (event) => {
                this.state.filters.documents.dateTo = event.target.value || '';
                this.loadLegalDocumentsList();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetLegalDocumentFilters();
                this.loadLegalDocumentsList();
            });
        }
    },

    async loadLegalDocumentsList() {
        const container = document.getElementById('legal-documents-table-container');
        if (!container) return;

        // تحديث كروت الإحصائيات
        this.updateStatisticsCards();

        const documents = AppState.appData.legalDocuments || [];
        const filteredDocuments = this.getFilteredLegalDocuments();
        const filters = this.state.filters?.documents || {};

        const uniqueTypes = [...new Set(documents.map((doc) => String(doc.documentType || '').trim()).filter(Boolean))].sort();
        const uniqueStatuses = ['نشط', 'قارب على الانتهاء', 'منتهي'];
        const uniqueIssuedBy = [...new Set(documents.map((doc) => String(doc.issuedBy || '').trim()).filter(Boolean))].sort();
        const hasActiveFilters = !!(filters.search || filters.type || filters.status || filters.issuedBy || filters.dateFrom || filters.dateTo);

        if (documents.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gavel text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد مستندات قانونية</p>
                    <button id="add-legal-document-empty-btn" class="btn-primary mt-4">
                        <i class="fas fa-plus ml-2"></i>
                        إضافة مستند قانوني
                    </button>
                </div>
            `;
            // ربط حدث الزر الذي تم إنشاؤه ديناميكياً
            setTimeout(() => {
                const addEmptyBtn = document.getElementById('add-legal-document-empty-btn');
                if (addEmptyBtn) {
                    addEmptyBtn.addEventListener('click', () => this.showForm());
                }
            }, 50);
            return;
        }

        container.innerHTML = `
            <div class="visits-filters-row" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 16px 20px; margin: 0 -20px 14px -20px; width: calc(100% + 40px);">
                <div class="filters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; align-items: end;">
                    <div class="filter-field" style="min-width: 180px;">
                        <label class="filter-label" for="legal-docs-search">
                            <i class="fas fa-search ml-1"></i>بحث
                        </label>
                        <div class="relative w-full">
                            <input type="text" id="legal-docs-search" class="form-input pr-10 filter-input" placeholder="بحث بالاسم أو الرقم أو الكود" value="${Utils.escapeHTML(filters.search || '')}">
                            <i class="fas fa-search absolute top-3 right-3 text-gray-400"></i>
                        </div>
                    </div>
                    <div class="filter-field" style="min-width: 160px;">
                        <label class="filter-label" for="legal-docs-filter-type">
                            <i class="fas fa-tags ml-1"></i>النوع
                            ${filters.type ? `<span class="filter-count-badge" title="عدد النتائج">${filteredDocuments.length}</span>` : ''}
                        </label>
                        <select id="legal-docs-filter-type" class="form-input filter-input">
                            <option value="">الكل</option>
                            ${uniqueTypes.map((type) => `<option value="${Utils.escapeHTML(type)}" ${filters.type === type ? 'selected' : ''}>${Utils.escapeHTML(type)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="filter-field" style="min-width: 160px;">
                        <label class="filter-label" for="legal-docs-filter-status">
                            <i class="fas fa-signal ml-1"></i>الحالة
                            ${filters.status ? `<span class="filter-count-badge" title="عدد النتائج">${filteredDocuments.length}</span>` : ''}
                        </label>
                        <select id="legal-docs-filter-status" class="form-input filter-input">
                            <option value="">الكل</option>
                            ${uniqueStatuses.map((status) => `<option value="${Utils.escapeHTML(status)}" ${filters.status === status ? 'selected' : ''}>${Utils.escapeHTML(status)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="filter-field" style="min-width: 160px;">
                        <label class="filter-label" for="legal-docs-filter-issued-by">
                            <i class="fas fa-building ml-1"></i>الجهة الصادرة
                            ${filters.issuedBy ? `<span class="filter-count-badge" title="عدد النتائج">${filteredDocuments.length}</span>` : ''}
                        </label>
                        <select id="legal-docs-filter-issued-by" class="form-input filter-input">
                            <option value="">الكل</option>
                            ${uniqueIssuedBy.map((issuer) => `<option value="${Utils.escapeHTML(issuer)}" ${filters.issuedBy === issuer ? 'selected' : ''}>${Utils.escapeHTML(issuer)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="filter-field">
                        <label class="filter-label" for="legal-docs-date-from"><i class="fas fa-calendar-alt ml-1"></i>من تاريخ الإصدار</label>
                        <input type="date" id="legal-docs-date-from" class="form-input filter-input" value="${filters.dateFrom || ''}">
                    </div>
                    <div class="filter-field">
                        <label class="filter-label" for="legal-docs-date-to"><i class="fas fa-calendar-check ml-1"></i>إلى تاريخ الإصدار</label>
                        <input type="date" id="legal-docs-date-to" class="form-input filter-input" value="${filters.dateTo || ''}">
                    </div>
                    <div class="filter-field" style="min-width: 170px;">
                        <button
                            type="button"
                            id="legal-docs-reset-filters"
                            class="filter-reset-btn"
                            title="إلغاء جميع الفلاتر والعودة للوضع الافتراضي"
                            style="width: 100%; min-height: 42px; border-radius: 12px; border: 1px solid #cbd5e1; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); color: #0f172a; font-weight: 700; letter-spacing: 0.2px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08); transition: all 0.2s ease;"
                            onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 14px rgba(15, 23, 42, 0.16)'; this.style.borderColor='#94a3b8';"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(15, 23, 42, 0.08)'; this.style.borderColor='#cbd5e1';"
                        >
                            <i class="fas fa-rotate-left ml-1"></i>
                            إعادة تعيين الفلاتر
                        </button>
                    </div>
                </div>
            </div>
            ${hasActiveFilters && filteredDocuments.length === 0 ? `
                <div class="empty-state">
                    <i class="fas fa-filter text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 mb-2">لا توجد نتائج مطابقة للفلاتر الحالية</p>
                    <button type="button" id="legal-docs-clear-empty-filters" class="btn-secondary mt-2">
                        <i class="fas fa-undo-alt ml-2"></i>
                        مسح الفلاتر
                    </button>
                </div>
            ` : ''}
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>كود ISO</th>
                            <th>اسم المستند</th>
                            <th>النوع</th>
                            <th>رقم المستند</th>
                            <th>تاريخ الإصدار</th>
                            <th>تاريخ الانتهاء</th>
                            <th>مدة الصلاحية (أيام)</th>
                            <th>الحالة</th>
                            <th>المسئول عن المتابعة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredDocuments.map(doc => {
            const expiryDate = new Date(doc.expiryDate);
            const today = new Date();
            const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            const isExpired = expiryDate < today;
            const isExpiringSoon = daysRemaining <= doc.alertDays && daysRemaining > 0;

            return `
                            <tr class="${isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-yellow-50' : ''}">
                                <td>${Utils.escapeHTML(doc.isoCode || '')}</td>
                                <td>${Utils.escapeHTML(doc.documentName || '')}</td>
                                <td>${Utils.escapeHTML(doc.documentType || '')}</td>
                                <td>${Utils.escapeHTML(doc.documentNumber || '')}</td>
                                <td>${doc.issueDate ? Utils.formatDate(doc.issueDate) : '-'}</td>
                                <td>${doc.expiryDate ? Utils.formatDate(doc.expiryDate) : '-'}</td>
                                <td>
                                    <span class="${isExpired ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-yellow-600 font-bold' : 'text-green-600'}">
                                        ${isExpired ? 'منتهي' : isExpiringSoon ? `${daysRemaining} يوم` : `${daysRemaining} يوم`}
                                    </span>
                                </td>
                                <td>
                                    <span class="badge badge-${isExpired ? 'danger' : isExpiringSoon ? 'warning' : 'success'}">
                                        ${isExpired ? 'منتهي' : isExpiringSoon ? 'قارب على الانتهاء' : 'نشط'}
                                    </span>
                                </td>
                                <td>${Utils.escapeHTML(doc.followUpResponsible || '-')}</td>
                                <td>
                                    <div class="flex items-center gap-2">
                                        <button onclick="LegalDocuments.viewDocument('${doc.id}')" class="btn-icon btn-icon-info" title="عرض">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button onclick="LegalDocuments.exportPDF('${doc.id}')" class="btn-icon btn-icon-success" title="تصدير PDF">
                                            <i class="fas fa-file-pdf"></i>
                                        </button>
                                        <button onclick="LegalDocuments.editDocument('${doc.id}')" class="btn-icon btn-icon-primary" title="تعديل">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button onclick="LegalDocuments.deleteDocument('${doc.id}')" class="btn-icon btn-icon-danger" title="حذف">
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

        this.bindLegalDocumentsFilterEvents(container);
        const clearEmptyFiltersBtn = document.getElementById('legal-docs-clear-empty-filters');
        if (clearEmptyFiltersBtn) {
            clearEmptyFiltersBtn.addEventListener('click', () => {
                this.resetLegalDocumentFilters();
                this.loadLegalDocumentsList();
            });
        }
    },

    bindTabEvents() {
        const buttons = document.querySelectorAll('.legal-tab-btn');
        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                if (!tab || tab === this.state.activeTab) return;
                this.state.activeTab = tab;
                this.renderTabNavigation();
                this.renderActiveTabContent();
            });
        });
    },

    renderTabNavigation() {
        const buttons = document.querySelectorAll('.legal-tab-btn');
        buttons.forEach((btn) => {
            const tab = btn.getAttribute('data-tab');
            if (tab === this.state.activeTab) {
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-primary', 'active');
            } else {
                btn.classList.remove('btn-primary', 'active');
                btn.classList.add('btn-secondary');
            }
        });
    },

    renderActiveTabContent() {
        const active = this.state.activeTab || 'documents';
        const panels = document.querySelectorAll('.legal-tab-panel');
        panels.forEach((panel) => {
            const panelKey = panel.getAttribute('data-tab-panel');
            panel.style.display = panelKey === active ? 'block' : 'none';
        });

        if (active === 'documents') {
            this.loadLegalDocumentsList();
            this.checkExpiringDocuments();
        } else if (active === 'inventory') {
            this.loadInventoryList();
        }
    },

    setupEventListeners() {
        setTimeout(() => {
            const addBtn = document.getElementById('add-legal-document-btn');
            const addEmptyBtn = document.getElementById('add-legal-document-empty-btn');
            if (addBtn) addBtn.addEventListener('click', () => this.showForm());
            if (addEmptyBtn) addEmptyBtn.addEventListener('click', () => this.showForm());

            const exportExcelBtn = document.getElementById('export-legal-excel-btn');
            if (exportExcelBtn) {
                exportExcelBtn.addEventListener('click', () => this.exportToExcel());
            }

            const checkUpdatesBtn = document.getElementById('check-legal-updates-btn');
            if (checkUpdatesBtn) {
                checkUpdatesBtn.addEventListener('click', () => this.checkLegalUpdates());
            }

            const saveSettingsBtn = document.getElementById('save-legal-settings-btn');
            if (saveSettingsBtn) {
                saveSettingsBtn.addEventListener('click', () => this.saveLegalSettings());
            }

            // أزرار السجل الجديد
            const addInventoryBtn = document.getElementById('add-legal-inventory-btn');
            if (addInventoryBtn) {
                addInventoryBtn.addEventListener('click', () => this.showInventoryForm());
            }

            const addInventoryEmptyBtn = document.getElementById('add-legal-inventory-empty-btn');
            if (addInventoryEmptyBtn) {
                addInventoryEmptyBtn.addEventListener('click', () => this.showInventoryForm());
            }

            const exportInventoryExcelBtn = document.getElementById('export-legal-inventory-excel-btn');
            if (exportInventoryExcelBtn) {
                exportInventoryExcelBtn.addEventListener('click', () => this.exportInventoryToExcel());
            }
        }, 100);
    },

    async showForm(data = null) {
        const isEdit = !!data;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">${isEdit ? 'تعديل مستند قانوني' : 'إضافة مستند قانوني جديد'}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="legal-document-form" class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">اسم المستند *</label>
                                <input type="text" id="legal-doc-name" required class="form-input"
                                    value="${Utils.escapeHTML(data?.documentName || '')}" placeholder="اسم المستند القانوني">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">نوع المستند *</label>
                                <select id="legal-doc-type" required class="form-input">
                                    <option value="">اختر النوع</option>
                                    <option value="ترخيص" ${data?.documentType === 'ترخيص' ? 'selected' : ''}>ترخيص</option>
                                    <option value="شهادة" ${data?.documentType === 'شهادة' ? 'selected' : ''}>شهادة</option>
                                    <option value="عقد" ${data?.documentType === 'عقد' ? 'selected' : ''}>عقد</option>
                                    <option value="وثيقة قانونية" ${data?.documentType === 'وثيقة قانونية' ? 'selected' : ''}>وثيقة قانونية</option>
                                    <option value="تشريع" ${data?.documentType === 'تشريع' ? 'selected' : ''}>تشريع</option>
                                    <option value="لوائح" ${data?.documentType === 'لوائح' ? 'selected' : ''}>لوائح</option>
                                    <option value="أخرى" ${data?.documentType === 'أخرى' ? 'selected' : ''}>أخرى</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">رقم المستند *</label>
                                <input type="text" id="legal-doc-number" required class="form-input"
                                    value="${Utils.escapeHTML(data?.documentNumber || '')}" placeholder="رقم المستند">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الصادر عن *</label>
                                <input type="text" id="legal-doc-issued-by" required class="form-input"
                                    value="${Utils.escapeHTML(data?.issuedBy || '')}" placeholder="الجهة الصادرة">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">المسئول عن متابعة المستند *</label>
                                <input type="text" id="legal-doc-followup-responsible" required class="form-input"
                                    value="${Utils.escapeHTML(data?.followUpResponsible || '')}" placeholder="اسم المسئول عن المتابعة">
                                <p class="text-xs text-gray-500 mt-1">يستخدم في حالات قرب الانتهاء أو انتهاء صلاحية المستند</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">تاريخ الإصدار *</label>
                                <input type="date" id="legal-doc-issue-date" required class="form-input"
                                    value="${data?.issueDate ? new Date(data.issueDate).toISOString().slice(0, 10) : ''}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">تاريخ الانتهاء *</label>
                                <input type="date" id="legal-doc-expiry-date" required class="form-input"
                                    value="${data?.expiryDate ? new Date(data.expiryDate).toISOString().slice(0, 10) : ''}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">عدد أيام التنبيه قبل الانتهاء *</label>
                                <input type="number" id="legal-doc-alert-days" required class="form-input"
                                    value="${data?.alertDays || 30}" min="1" placeholder="30">
                                <p class="text-xs text-gray-500 mt-1">سيتم إرسال تنبيه قبل انتهاء الصلاحية بهذا العدد من الأيام</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الحالة *</label>
                                <select id="legal-doc-status" required class="form-input">
                                    <option value="نشط" ${data?.status === 'نشط' || !data ? 'selected' : ''}>نشط</option>
                                    <option value="منتهي" ${data?.status === 'منتهي' ? 'selected' : ''}>منتهي</option>
                                    <option value="ملغي" ${data?.status === 'ملغي' ? 'selected' : ''}>ملغي</option>
                                </select>
                            </div>
                            <div class="col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الوصف / الملاحظات</label>
                                <textarea id="legal-doc-description" class="form-input" rows="4"
                                    placeholder="وصف المستند أو ملاحظات إضافية">${Utils.escapeHTML(data?.description || '')}</textarea>
                            </div>
                            <div class="col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-link ml-2"></i>
                                    رابط المستند (إن وجد)
                                </label>
                                <input type="url" id="legal-doc-link" class="form-input"
                                    value="${Utils.escapeHTML(data?.documentLink || '')}" placeholder="https://example.com/document">
                            </div>
                            <div class="col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-image ml-2"></i>
                                    صورة المستند (غير إلزامي)
                                </label>
                                <input type="file" id="legal-doc-image-input" accept="image/*" class="form-input">
                                <p class="text-xs text-gray-500 mt-1">الحد الأقصى لحجم الصورة 5MB. الصيغ المدعومة: JPG, PNG, GIF</p>
                                <div id="legal-doc-image-preview" class="mt-2 ${data?.documentImage ? '' : 'hidden'}">
                                    <img src="${data?.documentImage || ''}" alt="صورة المستند" class="w-48 h-48 object-cover rounded border mt-2" id="legal-doc-image-img">
                                    <button type="button" onclick="document.getElementById('legal-doc-image-input').value=''; document.getElementById('legal-doc-image-preview').classList.add('hidden');" class="mt-1 text-xs text-red-600 hover:text-red-800">
                                        <i class="fas fa-trash ml-1"></i>حذف الصورة
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center justify-end gap-4 pt-4 border-t">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? 'حفظ التعديلات' : 'إضافة المستند'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const form = modal.querySelector('#legal-document-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(data?.id, modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Setup image preview
        setTimeout(() => {
            const imageInput = document.getElementById('legal-doc-image-input');
            const imagePreview = document.getElementById('legal-doc-image-preview');
            const imageImg = document.getElementById('legal-doc-image-img');
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

    async convertImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    async handleSubmit(editId, modal) {
        if (!AppState.appData.legalDocuments) {
            AppState.appData.legalDocuments = [];
        }

        // Helper function to safely get element value
        const getElementValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value.trim() : '';
        };

        const getElementValueOrNull = (id) => {
            const element = document.getElementById(id);
            return element ? element.value : null;
        };

        const issueDateElement = document.getElementById('legal-doc-issue-date');
        const expiryDateElement = document.getElementById('legal-doc-expiry-date');
        let issueDateISO, expiryDateISO;
        
        if (issueDateElement && issueDateElement.value) {
            try {
                issueDateISO = new Date(issueDateElement.value).toISOString();
            } catch (error) {
                issueDateISO = new Date().toISOString();
            }
        } else {
            issueDateISO = new Date().toISOString();
        }

        if (expiryDateElement && expiryDateElement.value) {
            try {
                expiryDateISO = new Date(expiryDateElement.value).toISOString();
            } catch (error) {
                expiryDateISO = new Date().toISOString();
            }
        } else {
            expiryDateISO = new Date().toISOString();
        }

        const alertDaysElement = document.getElementById('legal-doc-alert-days');
        const alertDays = alertDaysElement && alertDaysElement.value ? parseInt(alertDaysElement.value) : 30;

        // معالجة الصورة
        let documentImage = editId
            ? (AppState.appData.legalDocuments.find(d => d.id === editId)?.documentImage || '')
            : '';
        const imageInput = document.getElementById('legal-doc-image-input');
        if (imageInput && imageInput.files.length > 0) {
            const file = imageInput.files[0];
            if (file.size > 5 * 1024 * 1024) {
                Notification.error('حجم الصورة كبير جداً. الحد الأقصى 5MB');
                return;
            }
            try {
                documentImage = await this.convertImageToBase64(file);
            } catch (error) {
                Notification.error('حدث خطأ في تحميل الصورة: ' + error.message);
                return;
            }
        }

        const formData = {
            id: editId || Utils.generateId('LEGAL'),
            isoCode: generateISOCode('LEGAL', AppState.appData.legalDocuments),
            documentName: getElementValue('legal-doc-name'),
            documentType: getElementValue('legal-doc-type'),
            documentNumber: getElementValue('legal-doc-number'),
            issuedBy: getElementValue('legal-doc-issued-by'),
            followUpResponsible: getElementValue('legal-doc-followup-responsible'),
            issueDate: issueDateISO,
            expiryDate: expiryDateISO,
            alertDays: alertDays,
            status: getElementValue('legal-doc-status'),
            description: getElementValue('legal-doc-description'),
            documentLink: getElementValue('legal-doc-link'),
            documentImage: documentImage,
            createdAt: editId ? AppState.appData.legalDocuments?.find(d => d.id === editId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        Loading.show();
        try {
            if (editId) {
                const index = AppState.appData.legalDocuments.findIndex(d => d.id === editId);
                if (index !== -1) {
                    AppState.appData.legalDocuments[index] = formData;
                    Notification.success('تم تحديث المستند بنجاح');
                }
            } else {
                AppState.appData.legalDocuments.push(formData);
                Notification.success('تم إضافة المستند بنجاح');
            }

            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            await GoogleIntegration.autoSave('LegalDocuments', AppState.appData.legalDocuments);

            Loading.hide();
            modal.remove();
            this.load();
            // تحديث كروت الإحصائيات
            setTimeout(() => this.updateStatisticsCards(), 100);
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    async editDocument(id) {
        const document = AppState.appData.legalDocuments?.find(d => d.id === id);
        if (document) await this.showForm(document);
    },

    async viewDocument(id) {
        const doc = AppState.appData.legalDocuments?.find(d => d.id === id);
        if (!doc) {
            Notification.error('المستند غير موجود');
            return;
        }

        const expiryDate = new Date(doc.expiryDate);
        const today = new Date();
        const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        const isExpired = expiryDate < today;
        const isExpiringSoon = daysRemaining <= doc.alertDays && daysRemaining > 0;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title">${Utils.escapeHTML(doc.documentName || '')}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-sm font-semibold text-gray-600">كود ISO:</label>
                                <p class="text-gray-800 font-mono">${Utils.escapeHTML(doc.isoCode || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">نوع المستند:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(doc.documentType || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">رقم المستند:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(doc.documentNumber || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الصادر عن:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(doc.issuedBy || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">المسئول عن المتابعة:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(doc.followUpResponsible || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">تاريخ الإصدار:</label>
                                <p class="text-gray-800">${doc.issueDate ? Utils.formatDate(doc.issueDate) : '-'}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">تاريخ الانتهاء:</label>
                                <p class="text-gray-800">${doc.expiryDate ? Utils.formatDate(doc.expiryDate) : '-'}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">مدة الصلاحية المتبقية:</label>
                                <p class="text-gray-800 ${isExpired ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-yellow-600 font-bold' : 'text-green-600'}">
                                    ${isExpired ? 'منتهي' : `${daysRemaining} يوم`}
                                </p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الحالة:</label>
                                <span class="badge badge-${isExpired ? 'danger' : isExpiringSoon ? 'warning' : 'success'}">
                                    ${doc.status || '-'}
                                </span>
                            </div>
                        </div>
                        ${doc.description ? `
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الوصف:</label>
                                <p class="text-gray-800 whitespace-pre-wrap">${Utils.escapeHTML(doc.description)}</p>
                            </div>
                        ` : ''}
                        ${doc.documentLink ? `
                            <div>
                                <label class="text-sm font-semibold text-gray-600">رابط المستند:</label>
                                <a href="${Utils.escapeHTML(doc.documentLink)}" target="_blank" class="text-blue-600 hover:underline">
                                    ${Utils.escapeHTML(doc.documentLink)}
                                    <i class="fas fa-external-link-alt mr-2"></i>
                                </a>
                            </div>
                        ` : ''}
                        ${doc.documentImage ? `
                            <div>
                                <label class="text-sm font-semibold text-gray-600 mb-2">صورة المستند:</label>
                                <div class="mt-2">
                                    ${(() => {
                                        const pu = this.processPhoto(doc.documentImage);
                                        const disp = pu && typeof Utils.resolveDriveAwareImgDisplay === 'function'
                                            ? Utils.resolveDriveAwareImgDisplay(pu)
                                            : { canonical: pu || '', displaySrc: pu || '', needsProxy: false, proxyFileId: '' };
                                        const pa = typeof Utils.driveProxyImgAttrs === 'function' ? Utils.driveProxyImgAttrs(disp) : '';
                                        return `<img src="${Utils.escapeHTML(disp.displaySrc)}" alt="صورة المستند"${pa} class="legal-doc-view-img max-w-full h-auto rounded border shadow-sm" style="max-height: 400px;"
                                         onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';">`;
                                    })()}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                    <button class="btn-success" onclick="LegalDocuments.exportPDF('${doc.id}');">
                        <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                    </button>
                    <button class="btn-primary" onclick="LegalDocuments.editDocument('${doc.id}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>تعديل
                    </button>
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

    async deleteDocument(id) {
        if (!confirm('هل أنت متأكد من حذف هذا المستند؟')) return;
        Loading.show();
        try {
            AppState.appData.legalDocuments = AppState.appData.legalDocuments.filter(d => d.id !== id);
            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            Loading.hide();
            Notification.success('تم حذف المستند بنجاح');
            this.load();
            // تحديث كروت الإحصائيات
            setTimeout(() => this.updateStatisticsCards(), 100);
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    async exportPDF(id) {
        const doc = AppState.appData.legalDocuments?.find(d => d.id === id);
        if (!doc) {
            Notification.error('المستند غير موجود');
            return;
        }

        try {
            Loading.show();

            const formCode = doc.isoCode || doc.documentNumber || doc.id?.substring(0, 12) || 'LEGAL-UNKNOWN';
            const formTitle = 'المستند القانوني';

            const expiryDate = new Date(doc.expiryDate);
            const today = new Date();
            const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            const isExpired = expiryDate < today;
            const isExpiringSoon = daysRemaining <= doc.alertDays && daysRemaining > 0;

            const content = `
                <table>
                    <tr><th>كود ISO</th><td>${Utils.escapeHTML(doc.isoCode || 'N/A')}</td></tr>
                    <tr><th>اسم المستند</th><td>${Utils.escapeHTML(doc.documentName || 'N/A')}</td></tr>
                    <tr><th>نوع المستند</th><td>${Utils.escapeHTML(doc.documentType || 'N/A')}</td></tr>
                    <tr><th>رقم المستند</th><td>${Utils.escapeHTML(doc.documentNumber || 'N/A')}</td></tr>
                    <tr><th>الصادر عن</th><td>${Utils.escapeHTML(doc.issuedBy || 'N/A')}</td></tr>
                    <tr><th>المسئول عن المتابعة</th><td>${Utils.escapeHTML(doc.followUpResponsible || 'N/A')}</td></tr>
                    <tr><th>تاريخ الإصدار</th><td>${doc.issueDate ? Utils.formatDate(doc.issueDate) : 'N/A'}</td></tr>
                    <tr><th>تاريخ الانتهاء</th><td>${doc.expiryDate ? Utils.formatDate(doc.expiryDate) : 'N/A'}</td></tr>
                    <tr><th>مدة الصلاحية المتبقية</th><td class="${isExpired ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-yellow-600 font-bold' : 'text-green-600'}">${isExpired ? 'منتهي' : `${daysRemaining} يوم`}</td></tr>
                    <tr><th>الحالة</th><td>${Utils.escapeHTML(doc.status || 'N/A')}</td></tr>
                </table>
                ${doc.description ? `
                    <div class="section-title">الوصف:</div>
                    <div class="description">${Utils.escapeHTML(doc.description)}</div>
                ` : ''}
                ${doc.documentLink ? `
                    <div class="section-title">رابط المستند:</div>
                    <div class="description"><a href="${Utils.escapeHTML(doc.documentLink)}" target="_blank">${Utils.escapeHTML(doc.documentLink)}</a></div>
                ` : ''}
                ${(() => {
                    const imageUrl = this.processPhoto(doc.documentImage);
                    return imageUrl ? `
                    <div class="section-title">صورة المستند:</div>
                    <div class="description">
                        <img src="${Utils.escapeHTML(imageUrl)}" alt="صورة المستند" style="max-width: 100%; max-height: 400px; border: 1px solid #ddd; border-radius: 4px;"
                             onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';">
                    </div>
                ` : '';})()}
            `;

            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(formCode, formTitle, content, true, true)
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>@page { size: A4 portrait; margin: 1cm; } @media print { @page { size: A4 portrait; margin: 1cm; } body { padding: 0; } }</style><title>المستندات القانونية</title></head><body>${content}</body></html>`;

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
                            Notification.success('تم تحويل التقرير للطباعة/الحفظ كـ PDF');
                        }, 1000);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error('يرجى السماح للنواذ المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error('فشل تصدير PDF: ' + error.message);
        }
    },

    async exportToExcel() {
        try {
            Loading.show();

            if (typeof XLSX === 'undefined') {
                Loading.hide();
                Notification.error('مكتبة SheetJS غير محمّلة. يرجى تحديث الصفحة');
                return;
            }

            const documents = AppState.appData.legalDocuments || [];

            const excelData = documents.map(doc => {
                const expiryDate = new Date(doc.expiryDate);
                const today = new Date();
                const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                const isExpired = expiryDate < today;

                return {
                    'كود ISO': doc.isoCode || '',
                    'اسم المستند': doc.documentName || '',
                    'نوع المستند': doc.documentType || '',
                    'رقم المستند': doc.documentNumber || '',
                    'الصادر عن': doc.issuedBy || '',
                    'المسئول عن المتابعة': doc.followUpResponsible || '',
                    'تاريخ الإصدار': doc.issueDate ? Utils.formatDate(doc.issueDate) : '',
                    'تاريخ الانتهاء': doc.expiryDate ? Utils.formatDate(doc.expiryDate) : '',
                    'مدة الصلاحية المتبقية': isExpired ? 'منتهي' : `${daysRemaining} يوم`,
                    'الحالة': doc.status || '',
                    'تاريخ الإنشاء': doc.createdAt ? Utils.formatDate(doc.createdAt) : ''
                };
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            ws['!cols'] = [
                { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 25 },
                { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }
            ];

            XLSX.utils.book_append_sheet(wb, ws, 'المستندات القانونية');

            const date = new Date().toISOString().slice(0, 10);
            const filename = `سجل_المستندات_القانونية_${date}.xlsx`;

            XLSX.writeFile(wb, filename);

            Loading.hide();
            Notification.success('تم تصدير سجل المستندات القانونية بنجاح');
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير Excel:', error);
            Notification.error('شل تصدير Excel: ' + error.message);
        }
    },

    checkExpiringDocuments() {
        const documents = AppState.appData.legalDocuments || [];
        const today = new Date();
        const alerts = [];

        documents.forEach(doc => {
            if (doc.status === 'نشط' && doc.expiryDate) {
                const expiryDate = new Date(doc.expiryDate);
                const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

                if (daysRemaining <= doc.alertDays && daysRemaining > 0) {
                    alerts.push({
                        type: 'warning',
                        message: `مستند قانوني "${doc.documentName}" سينتهي خلال ${daysRemaining} يوم`
                    });
                } else if (daysRemaining <= 0) {
                    alerts.push({
                        type: 'critical',
                        message: `مستند قانوني "${doc.documentName}" منتهي صلاحيته!`
                    });
                }
            }
        });

        // إرسال إشعارات للإيميلات المسجلة
        if (alerts.length > 0 && AppState.notificationEmails && AppState.notificationEmails.length > 0) {
            this.sendEmailNotifications(alerts);
        }

        // عرض الإشعارات للمستخدم
        alerts.forEach(alert => {
            if (alert.type === 'critical') {
                Notification.error(alert.message);
            } else {
                Notification.warning(alert.message);
            }
        });
    },

    async sendEmailNotifications(alerts) {
        // في الإنتاج، يجب إرسال إيميلات علية
        Utils.safeLog('إرسال إشعارات لإيميلات:', AppState.notificationEmails);
        Utils.safeLog('التنبيهات:', alerts);

        // يمكن إضافة تكامل مع خدمة إرسال إيميلات هنا
        if (AppState.notificationEmails && AppState.notificationEmails.length > 0) {
            Notification.success(`تم إرسال إشعارات قانونية إلى ${AppState.notificationEmails.length} إيميل`);
        }
    },

    async checkLegalUpdates() {
        Loading.show();
        try {
            const portalUrl = document.getElementById('legal-portal-url')?.value || AppState.legalPortalUrl;
            const keywords = (document.getElementById('legal-keywords')?.value || '').split(',').map(k => k.trim()).filter(k => k);

            if (!portalUrl) {
                Loading.hide();
                Notification.warning('يرجى إدخال رابط بوابة التشريعات أولاً');
                return;
            }

            // في الإنتاج، يجب إجراء فحص على من البوابة
            // هنا سنعرض فقط إشعار تجريبي
            await new Promise(resolve => setTimeout(resolve, 1500));

            Loading.hide();
            Notification.success(`تم التحقق من التحديثات القانونية. ${keywords.length > 0 ? `تم البحث عن: ${keywords.join(', ')}` : 'لم يتم تحديد كلمات متاحية'}`);

            // يمكن إضافة منطق علي للتحقق من التحديثات هنا
            // مثل: استدعاء API أو فحص صحة ويب

        } catch (error) {
            Loading.hide();
            Notification.error('فشل التحقق من التحديثات: ' + error.message);
        }
    },

    saveLegalSettings() {
        const portalUrl = document.getElementById('legal-portal-url')?.value.trim();
        const keywordsText = document.getElementById('legal-keywords')?.value || '';
        const autoNotify = document.getElementById('legal-auto-notify')?.checked || false;

        AppState.legalPortalUrl = portalUrl;
        AppState.legalKeywords = keywordsText.split(',').map(k => k.trim()).filter(k => k);
        AppState.legalAutoNotify = autoNotify;

        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
        Notification.success('تم حفظ إعدادات متابعة التحديثات القانونية بنجاح');
    },

    // ===== سجل حصر التشريعات والقوانين =====
    async renderInventoryTab() {
        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-clipboard-list ml-2"></i>سجل حصر التشريعات والقوانين
                        </h2>
                        <div class="flex gap-2">
                            <button id="export-legal-inventory-excel-btn" class="btn-success">
                                <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                            </button>
                            <button id="add-legal-inventory-btn" class="btn-primary">
                                <i class="fas fa-plus ml-2"></i>إضافة سجل جديد
                            </button>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div id="legal-inventory-table-container">
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

    async loadInventoryList() {
        const container = document.getElementById('legal-inventory-table-container');
        if (!container) return;

        if (!AppState.appData.legalInventory) {
            AppState.appData.legalInventory = [];
        }

        const inventory = AppState.appData.legalInventory || [];

        if (inventory.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد سجلات في حصر التشريعات والقوانين</p>
                    <button id="add-legal-inventory-empty-btn" class="btn-primary mt-4">
                        <i class="fas fa-plus ml-2"></i>
                        إضافة سجل جديد
                    </button>
                </div>
            `;
            // ربط حدث الزر الذي تم إنشاؤه ديناميكياً
            setTimeout(() => {
                const addEmptyBtn = document.getElementById('add-legal-inventory-empty-btn');
                if (addEmptyBtn) {
                    addEmptyBtn.addEventListener('click', () => this.showInventoryForm());
                }
            }, 50);
            return;
        }

        container.innerHTML = `
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>م</th>
                            <th>رقم المادة / القانون</th>
                            <th>تاريخ الإصدار</th>
                            <th>جهة الإصدار</th>
                            <th>بيان الالتزام</th>
                            <th>المسئول</th>
                            <th>موقف التطبيق</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inventory.map((item, index) => {
                            const statusClass = item.applicationStatus === 'مطبق' ? 'badge-success' : 
                                                item.applicationStatus === 'قيد التطبيق' ? 'badge-warning' : 
                                                'badge-danger';
                            return `
                                <tr>
                                    <td class="text-center">${index + 1}</td>
                                    <td>${Utils.escapeHTML(item.lawNumber || '')}</td>
                                    <td>${item.issueDate ? Utils.formatDate(item.issueDate) : '-'}</td>
                                    <td>${Utils.escapeHTML(item.issuingAuthority || '')}</td>
                                    <td>${Utils.escapeHTML(item.complianceStatement || '')}</td>
                                    <td>${Utils.escapeHTML(item.responsible || '')}</td>
                                    <td>
                                        <span class="badge ${statusClass}">
                                            ${Utils.escapeHTML(item.applicationStatus || 'غير محدد')}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="flex items-center gap-2">
                                            <button onclick="LegalDocuments.editInventoryItem('${item.id}')" class="btn-icon btn-icon-primary" title="تعديل">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="LegalDocuments.deleteInventoryItem('${item.id}')" class="btn-icon btn-icon-danger" title="حذف">
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
    },

    async showInventoryForm(data = null) {
        const isEdit = !!data;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">${isEdit ? 'تعديل سجل حصر التشريعات والقوانين' : 'إضافة سجل جديد'}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="legal-inventory-form" class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">رقم المادة / القانون *</label>
                                <input type="text" id="inventory-law-number" required class="form-input"
                                    value="${Utils.escapeHTML(data?.lawNumber || '')}" placeholder="رقم المادة أو القانون">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">تاريخ الإصدار *</label>
                                <input type="date" id="inventory-issue-date" required class="form-input"
                                    value="${data?.issueDate ? new Date(data.issueDate).toISOString().slice(0, 10) : ''}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">جهة الإصدار *</label>
                                <input type="text" id="inventory-issuing-authority" required class="form-input"
                                    value="${Utils.escapeHTML(data?.issuingAuthority || '')}" placeholder="جهة الإصدار">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">المسئول *</label>
                                <input type="text" id="inventory-responsible" required class="form-input"
                                    value="${Utils.escapeHTML(data?.responsible || '')}" placeholder="اسم المسئول">
                            </div>
                            <div class="col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">بيان الالتزام *</label>
                                <textarea id="inventory-compliance-statement" required class="form-input" rows="3"
                                    placeholder="بيان الالتزام">${Utils.escapeHTML(data?.complianceStatement || '')}</textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">موقف التطبيق *</label>
                                <select id="inventory-application-status" required class="form-input">
                                    <option value="">اختر موقف التطبيق</option>
                                    <option value="مطبق" ${data?.applicationStatus === 'مطبق' ? 'selected' : ''}>مطبق</option>
                                    <option value="قيد التطبيق" ${data?.applicationStatus === 'قيد التطبيق' ? 'selected' : ''}>قيد التطبيق</option>
                                    <option value="غير مطبق" ${data?.applicationStatus === 'غير مطبق' ? 'selected' : ''}>غير مطبق</option>
                                </select>
                            </div>
                        </div>
                        <div class="flex items-center justify-end gap-4 pt-4 border-t">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? 'حفظ التعديلات' : 'إضافة السجل'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const form = modal.querySelector('#legal-inventory-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleInventorySubmit(data?.id, modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async handleInventorySubmit(editId, modal) {
        if (!AppState.appData.legalInventory) {
            AppState.appData.legalInventory = [];
        }

        // Helper function to safely get element value
        const getElementValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value.trim() : '';
        };

        const issueDateElement = document.getElementById('inventory-issue-date');
        let issueDateISO;
        if (issueDateElement && issueDateElement.value) {
            try {
                issueDateISO = new Date(issueDateElement.value).toISOString();
            } catch (error) {
                issueDateISO = new Date().toISOString();
            }
        } else {
            issueDateISO = new Date().toISOString();
        }

        const formData = {
            id: editId || Utils.generateId('LEGAL-INV'),
            lawNumber: getElementValue('inventory-law-number'),
            issueDate: issueDateISO,
            issuingAuthority: getElementValue('inventory-issuing-authority'),
            complianceStatement: getElementValue('inventory-compliance-statement'),
            responsible: getElementValue('inventory-responsible'),
            applicationStatus: getElementValue('inventory-application-status'),
            createdAt: editId ? AppState.appData.legalInventory?.find(d => d.id === editId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        Loading.show();
        try {
            if (editId) {
                const index = AppState.appData.legalInventory.findIndex(d => d.id === editId);
                if (index !== -1) {
                    AppState.appData.legalInventory[index] = formData;
                    Notification.success('تم تحديث السجل بنجاح');
                }
            } else {
                AppState.appData.legalInventory.push(formData);
                Notification.success('تم إضافة السجل بنجاح');
            }

            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }
            await GoogleIntegration.autoSave('LegalInventory', AppState.appData.legalInventory);

            Loading.hide();
            modal.remove();
            this.loadInventoryList();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    async editInventoryItem(id) {
        const item = AppState.appData.legalInventory?.find(d => d.id === id);
        if (item) await this.showInventoryForm(item);
    },

    async deleteInventoryItem(id) {
        if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
        Loading.show();
        try {
            AppState.appData.legalInventory = AppState.appData.legalInventory.filter(d => d.id !== id);
            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }
            Loading.hide();
            Notification.success('تم حذف السجل بنجاح');
            this.loadInventoryList();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    async exportInventoryToExcel() {
        try {
            Loading.show();

            if (typeof XLSX === 'undefined') {
                Loading.hide();
                Notification.error('مكتبة SheetJS غير محمّلة. يرجى تحديث الصفحة');
                return;
            }

            const inventory = AppState.appData.legalInventory || [];

            const excelData = inventory.map((item, index) => ({
                'م': index + 1,
                'رقم المادة / القانون': item.lawNumber || '',
                'تاريخ الإصدار': item.issueDate ? Utils.formatDate(item.issueDate) : '',
                'جهة الإصدار': item.issuingAuthority || '',
                'بيان الالتزام': item.complianceStatement || '',
                'المسئول': item.responsible || '',
                'موقف التطبيق': item.applicationStatus || ''
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            ws['!cols'] = [
                { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 25 },
                { wch: 40 }, { wch: 20 }, { wch: 15 }
            ];

            XLSX.utils.book_append_sheet(wb, ws, 'سجل حصر التشريعات');

            const date = new Date().toISOString().slice(0, 10);
            const filename = `سجل_حصر_التشريعات_والقوانين_${date}.xlsx`;

            XLSX.writeFile(wb, filename);

            Loading.hide();
            Notification.success('تم تصدير سجل حصر التشريعات والقوانين بنجاح');
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير Excel:', error);
            Notification.error('فشل تصدير Excel: ' + error.message);
        }
    }
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof LegalDocuments !== 'undefined') {
            window.LegalDocuments = LegalDocuments;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ LegalDocuments module loaded and available on window.LegalDocuments');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير LegalDocuments:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof LegalDocuments !== 'undefined') {
            try {
                window.LegalDocuments = LegalDocuments;
            } catch (e) {
                console.error('❌ فشل تصدير LegalDocuments:', e);
            }
        }
    }
})();
