/**
 * Issue Tracking Module
 * موديول تتبع المشاكل وحلولها
 */
const IssueTracking = {
    state: {
        currentView: 'list', // 'list', 'create', 'detail', 'statistics'
        filters: {
            status: 'all',
            priority: 'all',
            module: 'all',
            category: 'all',
            search: ''
        },
        currentIssue: null
    },

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

        const section = document.getElementById('issue-tracking-section');
        if (!section) {
            Utils.safeError('قسم issue-tracking-section غير موجود!');
            return;
        }

        // Skeleton فوري
        section.innerHTML = `
            <div class="section-header">
                <div class="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-bug ml-3"></i>
                            نظام تتبع المشاكل وحلولها
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

        try {
            // التأكد من وجود البيانات
            if (!AppState || !AppState.appData) {
                AppState = AppState || {};
                AppState.appData = AppState.appData || {};
            }
            if (!AppState.appData.issueTracking) {
                AppState.appData.issueTracking = [];
            }

            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-bug ml-3"></i>
                                نظام تتبع المشاكل وحلولها
                            </h1>
                            <p class="section-subtitle">تتبع وحل المشاكل التقنية والوظيفية</p>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="IssueTracking.showStatistics()" class="btn-secondary">
                                <i class="fas fa-chart-bar ml-2"></i>
                                الإحصائيات
                            </button>
                            <button onclick="IssueTracking.showCreateForm()" class="btn-primary">
                                <i class="fas fa-plus ml-2"></i>
                                إضافة مشكلة جديدة
                            </button>
                        </div>
                    </div>
                </div>
                <div class="mt-6">
                    ${this.renderFilters()}
                    ${this.renderIssuesList()}
                </div>
            `;

            await this.loadIssues();
            this.setupEventListeners();
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل موديول تتبع المشاكل:', error);
            section.innerHTML = `
                <div class="section-header">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-bug ml-3"></i>
                            نظام تتبع المشاكل وحلولها
                        </h1>
                    </div>
                </div>
                <div class="mt-6">
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">حدث خطأ أثناء تحميل البيانات</p>
                                <button onclick="IssueTracking.load()" class="btn-primary">
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

    /**
     * إعداد مستمعي الأحداث
     */
    setupEventListeners() {
        // سيتم إضافة event listeners عند الحاجة
    },

    /**
     * عرض الفلاتر
     */
    renderFilters() {
        return `
            <div class="content-card mb-4">
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">البحث</label>
                            <input 
                                type="text" 
                                id="issue-search" 
                                placeholder="ابحث في المشاكل..."
                                class="form-input"
                                oninput="IssueTracking.handleSearch(this.value)"
                            >
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">الحالة</label>
                            <select id="issue-status-filter" class="form-select" onchange="IssueTracking.applyFilters()">
                                <option value="all">الكل</option>
                                <option value="New">جديدة</option>
                                <option value="In Progress">قيد التنفيذ</option>
                                <option value="Resolved">تم الحل</option>
                                <option value="Closed">مغلقة</option>
                                <option value="Reopened">مفتوحة مجدداً</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">الأولوية</label>
                            <select id="issue-priority-filter" class="form-select" onchange="IssueTracking.applyFilters()">
                                <option value="all">الكل</option>
                                <option value="Low">منخفضة</option>
                                <option value="Medium">متوسطة</option>
                                <option value="High">عالية</option>
                                <option value="Critical">حرجة</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">الموديول</label>
                            <select id="issue-module-filter" class="form-select" onchange="IssueTracking.applyFilters()">
                                <option value="all">الكل</option>
                                ${this.getModuleOptions()}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">الفئة</label>
                            <select id="issue-category-filter" class="form-select" onchange="IssueTracking.applyFilters()">
                                <option value="all">الكل</option>
                                <option value="Bug">خطأ برمجي</option>
                                <option value="Feature Request">طلب ميزة</option>
                                <option value="Performance">أداء</option>
                                <option value="UI/UX">واجهة المستخدم</option>
                                <option value="Integration">تكامل</option>
                                <option value="Other">أخرى</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض قائمة المشاكل
     */
    renderIssuesList() {
        return `
            <div class="content-card">
                <div class="card-body">
                    <div id="issues-list-container">
                        <div class="empty-state">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p class="text-gray-500">جاري تحميل المشاكل...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * تحميل المشاكل
     */
    async loadIssues() {
        try {
            const filters = this.buildFilters();
            
            // التحقق من تفعيل Google Integration
            if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
                this.showEmptyState('يجب تفعيل Google Integration أولاً');
                return;
            }

            const response = await GoogleIntegration.sendRequest({
                action: 'getAllIssues',
                data: { filters: filters }
            });

            if (response.success) {
                this.renderIssues(response.data);
            } else {
                Utils.safeError('خطأ في تحميل المشاكل:', response.message);
                this.showEmptyState('حدث خطأ أثناء تحميل المشاكل');
            }
        } catch (error) {
            Utils.safeError('خطأ في تحميل المشاكل:', error);
            this.showEmptyState('حدث خطأ أثناء تحميل المشاكل');
        }
    },

    /**
     * بناء الفلاتر
     */
    buildFilters() {
        const filters = {};
        
        const status = document.getElementById('issue-status-filter')?.value;
        if (status && status !== 'all') filters.status = status;
        
        const priority = document.getElementById('issue-priority-filter')?.value;
        if (priority && priority !== 'all') filters.priority = priority;
        
        const module = document.getElementById('issue-module-filter')?.value;
        if (module && module !== 'all') filters.module = module;
        
        const category = document.getElementById('issue-category-filter')?.value;
        if (category && category !== 'all') filters.category = category;
        
        const search = document.getElementById('issue-search')?.value;
        if (search) filters.search = search;
        
        return filters;
    },

    /**
     * عرض المشاكل
     */
    renderIssues(issues) {
        const container = document.getElementById('issues-list-container');
        if (!container) return;

        if (!issues || issues.length === 0) {
            container.innerHTML = this.showEmptyState('لا توجد مشاكل');
            return;
        }

        container.innerHTML = `
            <div class="space-y-4">
                ${issues.map(issue => this.renderIssueCard(issue)).join('')}
            </div>
        `;
    },

    /**
     * عرض بطاقة مشكلة
     */
    renderIssueCard(issue) {
        const priorityColors = {
            Low: 'bg-green-100 text-green-800',
            Medium: 'bg-yellow-100 text-yellow-800',
            High: 'bg-orange-100 text-orange-800',
            Critical: 'bg-red-100 text-red-800'
        };

        const statusColors = {
            New: 'bg-blue-100 text-blue-800',
            'In Progress': 'bg-purple-100 text-purple-800',
            Resolved: 'bg-green-100 text-green-800',
            Closed: 'bg-gray-100 text-gray-800',
            Reopened: 'bg-red-100 text-red-800'
        };

        const safeId = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(issue.id) : issue.id;
        const safeTitle = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(issue.title || 'بدون عنوان') : (issue.title || 'بدون عنوان');
        const safeDescription = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML((issue.description || '').substring(0, 150)) : ((issue.description || '').substring(0, 150));
        const safeReportedBy = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(issue.reportedBy || 'غير محدد') : (issue.reportedBy || 'غير محدد');
        const safeModule = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(issue.module || '') : (issue.module || '');
        
        return `
            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" 
                 onclick="IssueTracking.showIssueDetail('${safeId}')">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <h3 class="font-semibold text-lg">${safeTitle}</h3>
                            <span class="px-2 py-1 rounded text-xs font-medium ${priorityColors[issue.priority] || 'bg-gray-100'}">
                                ${this.getPriorityLabel(issue.priority)}
                            </span>
                            <span class="px-2 py-1 rounded text-xs font-medium ${statusColors[issue.status] || 'bg-gray-100'}">
                                ${this.getStatusLabel(issue.status)}
                            </span>
                        </div>
                        <p class="text-gray-600 mb-2">${safeDescription}${(issue.description || '').length > 150 ? '...' : ''}</p>
                        <div class="flex items-center gap-4 text-sm text-gray-500">
                            <span><i class="fas fa-user ml-1"></i> ${safeReportedBy}</span>
                            <span><i class="fas fa-calendar ml-1"></i> ${this.formatDate(issue.createdAt)}</span>
                            ${safeModule ? `<span><i class="fas fa-cube ml-1"></i> ${safeModule}</span>` : ''}
                        </div>
                    </div>
                    <div class="ml-4">
                        <button onclick="event.stopPropagation(); IssueTracking.showIssueDetail('${safeId}')" 
                                class="btn-secondary btn-sm">
                            <i class="fas fa-eye ml-1"></i>
                            عرض
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض نموذج إنشاء مشكلة
     */
    async showCreateForm() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title">إضافة مشكلة جديدة</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="issue-form" onsubmit="IssueTracking.handleSubmit(event)">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="md:col-span-2">
                                <label class="form-label">العنوان *</label>
                                <input type="text" name="title" class="form-input" required>
                            </div>
                            <div class="md:col-span-2">
                                <label class="form-label">الوصف *</label>
                                <textarea name="description" class="form-textarea" rows="4" required></textarea>
                            </div>
                            <div>
                                <label class="form-label">الموديول</label>
                                <select name="module" class="form-select">
                                    <option value="">اختر الموديول</option>
                                    ${this.getModuleOptions()}
                                </select>
                            </div>
                            <div>
                                <label class="form-label">الفئة</label>
                                <select name="category" class="form-select">
                                    <option value="Bug">خطأ برمجي</option>
                                    <option value="Feature Request">طلب ميزة</option>
                                    <option value="Performance">أداء</option>
                                    <option value="UI/UX">واجهة المستخدم</option>
                                    <option value="Integration">تكامل</option>
                                    <option value="Other">أخرى</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label">الأولوية *</label>
                                <select name="priority" class="form-select" required>
                                    <option value="Low">منخفضة</option>
                                    <option value="Medium" selected>متوسطة</option>
                                    <option value="High">عالية</option>
                                    <option value="Critical">حرجة</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label">تاريخ الاستحقاق</label>
                                <input type="date" name="dueDate" class="form-input">
                            </div>
                            <div>
                                <label class="form-label">المسؤول</label>
                                <input type="text" name="assignedTo" class="form-input" 
                                       placeholder="اسم المسؤول">
                            </div>
                            <div>
                                <label class="form-label">خطوات إعادة الإنتاج</label>
                                <textarea name="reproductionSteps" class="form-textarea" rows="3" 
                                          placeholder="1. ...&#10;2. ...&#10;3. ..."></textarea>
                            </div>
                            <div>
                                <label class="form-label">البيئة</label>
                                <input type="text" name="environment" class="form-input" 
                                       placeholder="مثال: Chrome 120, Windows 10">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" onclick="this.closest('.modal-overlay').remove()" 
                                    class="btn-secondary">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>
                                حفظ
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    /**
     * معالجة إرسال النموذج
     */
    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        const issueData = {
            title: formData.get('title'),
            description: formData.get('description'),
            module: formData.get('module') || '',
            category: formData.get('category') || 'Bug',
            priority: formData.get('priority'),
            dueDate: formData.get('dueDate') || '',
            assignedTo: formData.get('assignedTo') || '',
            reproductionSteps: formData.get('reproductionSteps') || '',
            environment: formData.get('environment') || '',
            reportedBy: AppState.currentUser?.name || AppState.currentUser?.email || 'Unknown',
            createdBy: AppState.currentUser?.email || 'Unknown'
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الحفظ...';

        try {
            const response = await GoogleIntegration.sendRequest({
                action: 'addIssue',
                data: issueData
            });

            if (response.success) {
                Notification.success('تم إضافة المشكلة بنجاح');
                form.closest('.modal-overlay').remove();
                await this.loadIssues();
            } else {
                Notification.error('فشل إضافة المشكلة: ' + response.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        } catch (error) {
            Utils.safeError('خطأ في إضافة المشكلة:', error);
            Notification.error('حدث خطأ أثناء إضافة المشكلة');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    },

    /**
     * عرض تفاصيل المشكلة
     */
    async showIssueDetail(issueId) {
        try {
            const response = await GoogleIntegration.sendRequest({
                action: 'getIssue',
                data: { issueId: issueId }
            });

            if (response.success) {
                this.renderIssueDetail(response.data);
            } else {
                Notification.error('فشل تحميل المشكلة: ' + response.message);
            }
        } catch (error) {
            Utils.safeError('خطأ في تحميل المشكلة:', error);
            Notification.error('حدث خطأ أثناء تحميل المشكلة');
        }
    },

    /**
     * عرض تفاصيل المشكلة
     */
    renderIssueDetail(issue) {
        const safeId = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(issue.id) : issue.id;
        const safeTitle = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(issue.title || 'بدون عنوان') : (issue.title || 'بدون عنوان');
        const safeDescription = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(issue.description || 'لا يوجد وصف') : (issue.description || 'لا يوجد وصف');
        const safeReproductionSteps = issue.reproductionSteps ? ((typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(issue.reproductionSteps) : issue.reproductionSteps) : '';
        const safeModule = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(issue.module || 'غير محدد') : (issue.module || 'غير محدد');
        const safeCategory = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(issue.category || 'غير محدد') : (issue.category || 'غير محدد');
        const safeReportedBy = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(issue.reportedBy || 'غير محدد') : (issue.reportedBy || 'غير محدد');
        const safeAssignedTo = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(issue.assignedTo || 'غير محدد') : (issue.assignedTo || 'غير محدد');
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1000px;">
                <div class="modal-header">
                    <h2 class="modal-title">${safeTitle}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="md:col-span-2 space-y-4">
                            <div>
                                <h3 class="font-semibold mb-2">الوصف</h3>
                                <p class="text-gray-700">${safeDescription}</p>
                            </div>
                            ${safeReproductionSteps ? `
                                <div>
                                    <h3 class="font-semibold mb-2">خطوات إعادة الإنتاج</h3>
                                    <pre class="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">${safeReproductionSteps}</pre>
                                </div>
                            ` : ''}
                            ${this.renderSolutions(issue.solutions)}
                            ${this.renderComments(issue.comments)}
                        </div>
                        <div class="space-y-4">
                            <div class="bg-gray-50 p-4 rounded">
                                <h3 class="font-semibold mb-3">معلومات المشكلة</h3>
                                <div class="space-y-2 text-sm">
                                    <div><strong>الحالة:</strong> ${this.getStatusLabel(issue.status)}</div>
                                    <div><strong>الأولوية:</strong> ${this.getPriorityLabel(issue.priority)}</div>
                                    <div><strong>الموديول:</strong> ${safeModule}</div>
                                    <div><strong>الفئة:</strong> ${safeCategory}</div>
                                    <div><strong>تم الإبلاغ بواسطة:</strong> ${safeReportedBy}</div>
                                    <div><strong>المسؤول:</strong> ${safeAssignedTo}</div>
                                    <div><strong>تاريخ الإنشاء:</strong> ${this.formatDate(issue.createdAt)}</div>
                                    ${issue.dueDate ? `<div><strong>تاريخ الاستحقاق:</strong> ${this.formatDate(issue.dueDate)}</div>` : ''}
                                </div>
                            </div>
                            <div class="bg-gray-50 p-4 rounded">
                                <h3 class="font-semibold mb-3">الإجراءات</h3>
                                <div class="space-y-2">
                                    <button onclick="IssueTracking.addSolution('${safeId}')" class="btn-primary btn-sm w-full">
                                        <i class="fas fa-wrench ml-1"></i> إضافة حل
                                    </button>
                                    <button onclick="IssueTracking.updateStatus('${safeId}')" class="btn-secondary btn-sm w-full">
                                        <i class="fas fa-edit ml-1"></i> تحديث الحالة
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    /**
     * عرض الحلول
     */
    renderSolutions(solutions) {
        if (!solutions || solutions.length === 0) {
            return `
                <div>
                    <h3 class="font-semibold mb-2">الحلول</h3>
                    <p class="text-gray-500">لا توجد حلول مضافة بعد</p>
                </div>
            `;
        }

        let solutionsList = [];
        try {
            if (Array.isArray(solutions)) {
                solutionsList = solutions;
            } else if (typeof solutions === 'string' && solutions.trim()) {
                solutionsList = JSON.parse(solutions);
            }
        } catch (e) {
            Utils.safeError('خطأ في تحليل الحلول:', e);
            solutionsList = [];
        }

        return `
            <div>
                <h3 class="font-semibold mb-2">الحلول (${solutionsList.length})</h3>
                <div class="space-y-3">
                    ${solutionsList.map((sol, idx) => {
                        const safeSolution = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(sol.solution || '') : (sol.solution || '');
                        const safeNotes = sol.notes ? ((typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(sol.notes) : sol.notes) : '';
                        const safeImplementedBy = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(sol.implementedBy || '') : (sol.implementedBy || '');
                        return `
                        <div class="border rounded p-3">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-500">الحل #${idx + 1}</span>
                                <span class="text-xs px-2 py-1 rounded ${this.getEffectivenessColor(sol.effectiveness)}">
                                    ${this.getEffectivenessLabel(sol.effectiveness)}
                                </span>
                            </div>
                            <p class="text-gray-700">${safeSolution}</p>
                            ${safeNotes ? `<p class="text-sm text-gray-500 mt-2">${safeNotes}</p>` : ''}
                            <div class="text-xs text-gray-400 mt-2">
                                بواسطة: ${safeImplementedBy} - ${this.formatDate(sol.implementedAt)}
                            </div>
                        </div>
                    `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    /**
     * عرض التعليقات
     */
    renderComments(comments) {
        if (!comments || comments.length === 0) {
            return `
                <div>
                    <h3 class="font-semibold mb-2">التعليقات</h3>
                    <p class="text-gray-500">لا توجد تعليقات</p>
                </div>
            `;
        }

        let commentsList = [];
        try {
            if (Array.isArray(comments)) {
                commentsList = comments;
            } else if (typeof comments === 'string' && comments.trim()) {
                commentsList = JSON.parse(comments);
            }
        } catch (e) {
            Utils.safeError('خطأ في تحليل التعليقات:', e);
            commentsList = [];
        }

        return `
            <div>
                <h3 class="font-semibold mb-2">التعليقات (${commentsList.length})</h3>
                <div class="space-y-2">
                    ${commentsList.map(comment => {
                        const safeComment = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(comment.comment || '') : (comment.comment || '');
                        const safeUser = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(comment.user || '') : (comment.user || '');
                        return `
                        <div class="border-l-4 border-blue-500 pl-3 py-2">
                            <p class="text-gray-700">${safeComment}</p>
                            <div class="text-xs text-gray-400 mt-1">
                                ${safeUser} - ${this.formatDate(comment.timestamp)}
                            </div>
                        </div>
                    `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    /**
     * عرض الإحصائيات
     */
    async showStatistics() {
        try {
            const response = await GoogleIntegration.sendRequest({
                action: 'getIssueStatistics',
                data: { filters: this.buildFilters() }
            });

            if (response.success) {
                this.renderStatistics(response.data);
            } else {
                Notification.error('فشل تحميل الإحصائيات');
            }
        } catch (error) {
            Utils.safeError('خطأ في تحميل الإحصائيات:', error);
            Notification.error('حدث خطأ أثناء تحميل الإحصائيات');
        }
    },

    /**
     * عرض الإحصائيات
     */
    renderStatistics(stats) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">إحصائيات المشاكل</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div class="bg-blue-50 p-4 rounded text-center">
                            <div class="text-3xl font-bold text-blue-600">${stats.total || 0}</div>
                            <div class="text-sm text-gray-600">إجمالي المشاكل</div>
                        </div>
                        <div class="bg-red-50 p-4 rounded text-center">
                            <div class="text-3xl font-bold text-red-600">${stats.overdue || 0}</div>
                            <div class="text-sm text-gray-600">متأخرة</div>
                        </div>
                        <div class="bg-green-50 p-4 rounded text-center">
                            <div class="text-3xl font-bold text-green-600">${stats.byStatus?.Resolved || 0}</div>
                            <div class="text-sm text-gray-600">تم حلها</div>
                        </div>
                        <div class="bg-purple-50 p-4 rounded text-center">
                            <div class="text-3xl font-bold text-purple-600">${stats.byStatus?.['In Progress'] || 0}</div>
                            <div class="text-sm text-gray-600">قيد التنفيذ</div>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 class="font-semibold mb-3">حسب الحالة</h3>
                            ${this.renderStatusChart(stats.byStatus)}
                        </div>
                        <div>
                            <h3 class="font-semibold mb-3">حسب الأولوية</h3>
                            ${this.renderPriorityChart(stats.byPriority)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    /**
     * عرض مخطط الحالات
     */
    renderStatusChart(byStatus) {
        if (!byStatus) return '<p class="text-gray-500">لا توجد بيانات</p>';
        const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
        if (total === 0) return '<p class="text-gray-500">لا توجد بيانات</p>';
        
        return Object.entries(byStatus).map(([status, count]) => {
            const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
            return `
                <div class="mb-2">
                    <div class="flex justify-between text-sm mb-1">
                        <span>${this.getStatusLabel(status)}</span>
                        <span>${count} (${percentage}%)</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * عرض مخطط الأولويات
     */
    renderPriorityChart(byPriority) {
        if (!byPriority) return '<p class="text-gray-500">لا توجد بيانات</p>';
        const total = Object.values(byPriority).reduce((a, b) => a + b, 0);
        if (total === 0) return '<p class="text-gray-500">لا توجد بيانات</p>';
        
        return Object.entries(byPriority).map(([priority, count]) => {
            const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
            return `
                <div class="mb-2">
                    <div class="flex justify-between text-sm mb-1">
                        <span>${this.getPriorityLabel(priority)}</span>
                        <span>${count} (${percentage}%)</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-yellow-600 h-2 rounded-full" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    },

    // Helper functions
    getModuleOptions() {
        const modules = ['FireEquipment', 'Incidents', 'Training', 'Clinic', 'Users', 'PTW', 'Contractors', 'Other'];
        return modules.map(m => `<option value="${m}">${m}</option>`).join('');
    },

    getStatusLabel(status) {
        const labels = {
            'New': 'جديدة',
            'In Progress': 'قيد التنفيذ',
            'Resolved': 'تم الحل',
            'Closed': 'مغلقة',
            'Reopened': 'مفتوحة مجدداً'
        };
        return labels[status] || status;
    },

    getPriorityLabel(priority) {
        const labels = {
            'Low': 'منخفضة',
            'Medium': 'متوسطة',
            'High': 'عالية',
            'Critical': 'حرجة'
        };
        return labels[priority] || priority;
    },

    getEffectivenessLabel(effectiveness) {
        const labels = {
            'Effective': 'فعال',
            'Partially Effective': 'فعال جزئياً',
            'Not Effective': 'غير فعال',
            'Unknown': 'غير معروف'
        };
        return labels[effectiveness] || effectiveness;
    },

    getEffectivenessColor(effectiveness) {
        const colors = {
            'Effective': 'bg-green-100 text-green-800',
            'Partially Effective': 'bg-yellow-100 text-yellow-800',
            'Not Effective': 'bg-red-100 text-red-800',
            'Unknown': 'bg-gray-100 text-gray-800'
        };
        return colors[effectiveness] || 'bg-gray-100';
    },

    formatDate(dateString) {
        if (!dateString) return 'غير محدد';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ar-SA');
        } catch (e) {
            return dateString;
        }
    },

    handleSearch(value) {
        this.state.filters.search = value;
        setTimeout(() => this.loadIssues(), 500);
    },

    applyFilters() {
        this.loadIssues();
    },

    showEmptyState(message) {
        return `
            <div class="empty-state">
                <i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">${message}</p>
            </div>
        `;
    },

    addSolution(issueId) {
        // TODO: تنفيذ إضافة حل
        Notification.info('ميزة إضافة الحل قيد التطوير');
    },

    updateStatus(issueId) {
        // TODO: تنفيذ تحديث الحالة
        Notification.info('ميزة تحديث الحالة قيد التطوير');
    }
};

// ===== Export module to global scope =====
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof IssueTracking !== 'undefined') {
            window.IssueTracking = IssueTracking;
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ IssueTracking module loaded and available on window.IssueTracking');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير IssueTracking:', error);
        if (typeof window !== 'undefined' && typeof IssueTracking !== 'undefined') {
            try {
                window.IssueTracking = IssueTracking;
            } catch (e) {
                console.error('❌ فشل تصدير IssueTracking:', e);
            }
        }
    }
})();

