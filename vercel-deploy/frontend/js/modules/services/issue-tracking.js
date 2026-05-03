/**
 * Issue Tracking Service
 * نظام تتبع المشاكل العرضي - يعمل في كل مكان في التطبيق
 * 
 * يمكن استخدامه من أي موديول لإبلاغ عن مشاكل بسرعة
 */

const IssueTrackingService = {
    // Cache للبيانات
    _issuesCache: null,
    _lastFetch: null,
    _cacheTimeout: 5 * 60 * 1000, // 5 دقائق

    /**
     * إبلاغ عن مشكلة من أي موديول
     * @param {Object} issueData - بيانات المشكلة
     * @param {Object} context - السياق الحالي (module, recordId, etc.)
     */
    async reportIssue(issueData, context = {}) {
        try {
            // اكتشاف السياق تلقائياً إذا لم يتم تمريره
            if (!context.module) {
                context = this._detectContext();
            }

            const fullIssueData = {
                ...issueData,
                module: context.module || 'Unknown',
                recordId: context.recordId || null,
                pageUrl: context.pageUrl || window.location.href,
                userAgent: context.userAgent || navigator.userAgent,
                reportedBy: AppState.currentUser?.name || AppState.currentUser?.email || 'Unknown',
                createdBy: AppState.currentUser?.email || 'Unknown',
                priority: issueData.priority || this._determinePriority(issueData),
                category: issueData.category || 'Bug',
                status: 'New',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                // ربط تلقائي بالسياق
                context: {
                    module: context.module,
                    recordId: context.recordId,
                    section: context.section,
                    action: context.action
                }
            };

            // التحقق من تفعيل Google Integration
            if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
                throw new Error('يجب تفعيل Google Integration أولاً');
            }

            const response = await GoogleIntegration.sendRequest({
                action: 'addIssue',
                data: fullIssueData
            });

            if (response.success) {
                // تسجيل في AuditLog
                if (typeof AuditLog !== 'undefined') {
                    AuditLog.log('issue_reported', context.module || 'Unknown', context.recordId || null, {
                        issueId: response.data?.id,
                        title: issueData.title
                    });
                }

                // إشعار
                if (typeof Notification !== 'undefined') {
                    const issueId = response.data?.id || response.issueId || '';
                    if (issueId) {
                        Notification.success('تم إبلاغ المشكلة بنجاح. رقم المشكلة: ' + issueId);
                    } else {
                        Notification.success('تم إبلاغ المشكلة بنجاح');
                    }
                }

                // تحديث الـ cache
                this._invalidateCache();

                return { success: true, issueId: response.data?.id, data: response.data };
            } else {
                throw new Error(response.message || 'فشل إبلاغ المشكلة');
            }
        } catch (error) {
            Utils.safeError('خطأ في إبلاغ المشكلة:', error);
            if (typeof Notification !== 'undefined') {
                Notification.error('فشل إبلاغ المشكلة: ' + (error.message || 'خطأ غير معروف'));
            }
            return { success: false, error: error.message };
        }
    },

    /**
     * اكتشاف السياق الحالي تلقائياً
     */
    _detectContext() {
        const context = {
            module: null,
            recordId: null,
            section: null,
            action: null
        };

        // اكتشاف الموديول من URL أو section
        const currentSection = document.querySelector('.module-section:not([style*="display: none"]), .section:not([style*="display: none"])');
        if (currentSection) {
            const sectionId = currentSection.id;
            context.section = sectionId;
            context.module = this._extractModuleName(sectionId);
        }

        // اكتشاف recordId من URL parameters أو DOM
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('id')) {
            context.recordId = urlParams.get('id');
        }

        // اكتشاف من DOM (مثل data-record-id)
        const activeRecord = document.querySelector('[data-record-id]');
        if (activeRecord) {
            context.recordId = activeRecord.getAttribute('data-record-id');
        }

        return context;
    },

    /**
     * استخراج اسم الموديول من section ID
     */
    _extractModuleName(sectionId) {
        if (!sectionId) return 'Unknown';
        
        // fire-equipment-section -> FireEquipment
        // incidents-section -> Incidents
        const parts = sectionId.replace('-section', '').split('-');
        return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    },

    /**
     * تحديد الأولوية تلقائياً
     */
    _determinePriority(issueData) {
        const title = (issueData.title || '').toLowerCase();
        const description = (issueData.description || '').toLowerCase();

        // كلمات مفتاحية للأولوية العالية
        const criticalKeywords = ['crash', 'error', 'فشل', 'خطأ', 'تعطل', 'لا يعمل', 'broken', 'حرج'];
        const highKeywords = ['slow', 'بطيء', 'مشكلة', 'issue', 'bug', 'عالية'];

        const allText = title + ' ' + description;
        
        if (criticalKeywords.some(kw => allText.includes(kw))) {
            return 'Critical';
        }
        if (highKeywords.some(kw => allText.includes(kw))) {
            return 'High';
        }
        
        return 'Medium';
    },

    /**
     * فتح نموذج الإبلاغ السريع
     */
    async showQuickReportModal(context = {}) {
        // اكتشاف السياق إذا لم يتم تمريره
        if (!context.module) {
            context = this._detectContext();
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-bug ml-2"></i>
                        إبلاغ عن مشكلة
                    </h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="quick-issue-form" onsubmit="IssueTrackingService.handleQuickReport(event)">
                        <input type="hidden" name="module" value="${context.module || ''}">
                        <input type="hidden" name="recordId" value="${context.recordId || ''}">
                        
                        <div class="mb-4">
                            <label class="form-label">العنوان *</label>
                            <input type="text" name="title" class="form-input" required 
                                   placeholder="وصف مختصر للمشكلة">
                        </div>
                        
                        <div class="mb-4">
                            <label class="form-label">الوصف *</label>
                            <textarea name="description" class="form-textarea" rows="4" required
                                      placeholder="وصف تفصيلي للمشكلة..."></textarea>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label class="form-label">الأولوية</label>
                                <select name="priority" class="form-select">
                                    <option value="Low">منخفضة</option>
                                    <option value="Medium" selected>متوسطة</option>
                                    <option value="High">عالية</option>
                                    <option value="Critical">حرجة</option>
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
                        </div>
                        
                        ${context.module ? `
                            <div class="mb-4 p-3 bg-blue-50 rounded">
                                <p class="text-sm text-gray-600">
                                    <i class="fas fa-info-circle ml-1"></i>
                                    سيتم ربط هذه المشكلة تلقائياً بـ: <strong>${context.module}</strong>
                                    ${context.recordId ? ` (السجل: ${context.recordId})` : ''}
                                </p>
                            </div>
                        ` : ''}
                        
                        <div class="modal-footer">
                            <button type="button" onclick="this.closest('.modal-overlay').remove()" 
                                    class="btn-secondary">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-paper-plane ml-2"></i>
                                إرسال
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Focus على حقل العنوان
        setTimeout(() => {
            const titleInput = modal.querySelector('input[name="title"]');
            if (titleInput) titleInput.focus();
        }, 100);
    },

    /**
     * معالجة نموذج الإبلاغ السريع
     */
    async handleQuickReport(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        const issueData = {
            title: formData.get('title'),
            description: formData.get('description'),
            priority: formData.get('priority'),
            category: formData.get('category')
        };

        const context = {
            module: formData.get('module') || null,
            recordId: formData.get('recordId') || null
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الإرسال...';

        try {
            const result = await this.reportIssue(issueData, context);
            if (result.success) {
                form.closest('.modal-overlay').remove();
            } else {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        } catch (error) {
            Utils.safeError('خطأ في إرسال المشكلة:', error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    },

    /**
     * الحصول على عدد المشاكل المفتوحة
     */
    async getOpenIssuesCount() {
        try {
            // التحقق من تفعيل Google Integration
            if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
                return 0;
            }

            const response = await GoogleIntegration.sendRequest({
                action: 'getAllIssues',
                data: { filters: { status: 'New' } }
            });

            if (response.success) {
                return response.data?.length || 0;
            }
            return 0;
        } catch (error) {
            Utils.safeError('خطأ في جلب عدد المشاكل:', error);
            return 0;
        }
    },

    /**
     * الحصول على المشاكل الحرجة
     */
    async getCriticalIssues() {
        try {
            // التحقق من تفعيل Google Integration
            if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
                return [];
            }

            const response = await GoogleIntegration.sendRequest({
                action: 'getAllIssues',
                data: { filters: { priority: 'Critical', status: 'New' } }
            });

            if (response.success) {
                return response.data || [];
            }
            return [];
        } catch (error) {
            Utils.safeError('خطأ في جلب المشاكل الحرجة:', error);
            return [];
        }
    },

    /**
     * إبطال الـ cache
     */
    _invalidateCache() {
        this._issuesCache = null;
        this._lastFetch = null;
    },

    /**
     * تهيئة النظام (إضافة Floating Button)
     */
    init() {
        this._addFloatingButton();
        this._setupKeyboardShortcut();
    },

    /**
     * إضافة زر عائم (Floating Button) قابل للسحب
     */
    _addFloatingButton() {
        // التحقق من وجود الزر مسبقاً
        if (document.getElementById('issue-tracking-floating-btn')) {
            return;
        }

        const button = document.createElement('button');
        button.id = 'issue-tracking-floating-btn';
        button.className = 'issue-tracking-floating-btn';
        button.setAttribute('aria-label', 'إبلاغ عن مشكلة');
        button.setAttribute('title', 'إبلاغ عن مشكلة (Ctrl+Shift+B) - اسحب لتحريك');
        button.innerHTML = `
            <i class="fas fa-bug"></i>
            <span class="issue-tracking-badge" id="issue-tracking-badge" style="display: none;">!</span>
        `;
        
        // استعادة الموضع المحفوظ
        this._restoreButtonPosition(button);
        
        // إضافة وظيفة السحب
        this._makeDraggable(button);
        
        button.addEventListener('click', (e) => {
            // منع فتح النموذج عند السحب
            if (!button.classList.contains('dragging')) {
                this.showQuickReportModal();
            }
        });

        document.body.appendChild(button);

        // تحديث العداد بشكل دوري
        this._updateBadge();
        setInterval(() => this._updateBadge(), 5 * 60 * 1000); // كل 5 دقائق
    },

    /**
     * جعل الزر قابلاً للسحب
     */
    _makeDraggable(button) {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        // استعادة الموضع المحفوظ
        const savedPosition = this._getSavedPosition();
        if (savedPosition) {
            xOffset = savedPosition.x;
            yOffset = savedPosition.y;
            this._setTransform(button, xOffset, yOffset);
        }

        button.addEventListener('mousedown', dragStart);
        button.addEventListener('touchstart', dragStart, { passive: false });

        function dragStart(e) {
            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }

            if (e.target === button || button.contains(e.target)) {
                isDragging = true;
                button.classList.add('dragging');
                button.style.cursor = 'grabbing';
            }
        }

        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag, { passive: false });

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                
                if (e.type === "touchmove") {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }

                xOffset = currentX;
                yOffset = currentY;

                // تحديد الحدود (منع الزر من الخروج من الشاشة)
                const buttonRect = button.getBoundingClientRect();
                const maxX = window.innerWidth - buttonRect.width;
                const maxY = window.innerHeight - buttonRect.height;
                
                xOffset = Math.max(0, Math.min(xOffset, maxX));
                yOffset = Math.max(0, Math.min(yOffset, maxY));

                IssueTrackingService._setTransform(button, xOffset, yOffset);
            }
        }

        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);

        function dragEnd() {
            if (isDragging) {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                button.classList.remove('dragging');
                button.style.cursor = 'grab';
                
                // حفظ الموضع
                IssueTrackingService._saveButtonPosition(xOffset, yOffset);
            }
        }
    },

    /**
     * تطبيق التحويل (transform) على الزر
     */
    _setTransform(element, x, y) {
        element.style.transform = `translate(${x}px, ${y}px)`;
    },

    /**
     * حفظ موضع الزر في localStorage
     */
    _saveButtonPosition(x, y) {
        try {
            localStorage.setItem('issue-tracking-btn-position', JSON.stringify({ x, y }));
        } catch (e) {
            // تجاهل الأخطاء في localStorage
        }
    },

    /**
     * الحصول على الموضع المحفوظ
     */
    _getSavedPosition() {
        try {
            const saved = localStorage.getItem('issue-tracking-btn-position');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            // تجاهل الأخطاء
        }
        return null;
    },

    /**
     * استعادة موضع الزر
     */
    _restoreButtonPosition(button) {
        const saved = this._getSavedPosition();
        if (saved) {
            // استخدام transform بدلاً من top/right
            button.style.right = 'auto';
            button.style.bottom = 'auto';
            button.style.left = '0';
            button.style.top = '0';
        }
    },

    /**
     * تحديث شارة العدد
     */
    async _updateBadge() {
        try {
            const count = await this.getOpenIssuesCount();
            const badge = document.getElementById('issue-tracking-badge');
            if (badge) {
                if (count > 0) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (error) {
            // تجاهل الأخطاء في التحديث
        }
    },

    /**
     * إعداد اختصار لوحة المفاتيح
     */
    _setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+B (أو Cmd+Shift+B على Mac)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
                e.preventDefault();
                this.showQuickReportModal();
            }
        });
    }
};

// Export to global window
if (typeof window !== 'undefined') {
    window.IssueTrackingService = IssueTrackingService;
}

