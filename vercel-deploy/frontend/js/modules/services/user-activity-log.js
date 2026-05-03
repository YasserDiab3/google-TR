/**
 * User Activity Log Service
 * Handles user activity logging with UI rendering and export functionality
 */

const UserActivityLog = {
    /** آخر استجابة تقرير الجلسات اليومي (للتصدير والنسخ) */
    _lastDailyReport: null,

    /**
     * معرف الجلسة الحالي لربط السجلات من الدخول حتى الخروج
     */
    getCurrentSessionId() {
        try {
            if (typeof AppState !== 'undefined' && AppState.currentUser && AppState.currentUser.sessionId) {
                return String(AppState.currentUser.sessionId);
            }
            const fromStorage = sessionStorage.getItem('hse_session_id');
            return fromStorage ? String(fromStorage) : '';
        } catch (e) {
            return '';
        }
    },

    /**
     * الحصول على عنوان IP للمستخدم الحالي
     */
    async getUserIP() {
        // إضافة timeout للطلب (مع تنظيف الـ timer لتجنب unhandled rejections)
        const timeoutMs = 5000;

        // 1) Prefer server-side (Apps Script) to avoid Firefox ETP/CORS blocks
        try {
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration?.sendToAppsScript) {
                const result = await Utils.promiseWithTimeout(
                    GoogleIntegration.sendToAppsScript('getPublicIP', {}),
                    timeoutMs,
                    'Timeout'
                );

                const ip = result?.data?.ip || result?.ip;
                if (result?.success && ip) {
                    return ip;
                }
            }
        } catch (error) {
            // تجاهل أخطاء getPublicIP بصمت - هذه عملية غير حرجة
            // لا نريد إظهار أخطاء للمستخدم لأن جلب IP هو فقط لتسجيل النشاط
            // الخطأ قد يكون بسبب: CORS, timeout, أو مشاكل في خدمة ipify
        }

        // No direct client-side IP lookup fallback here.
        // Rationale: browsers (especially Firefox with Enhanced Tracking Protection)
        // may block third-party IP services and still log noisy console CORS errors.
        return 'Unknown';
    },

    /**
     * تسجيل نشاط المستخدم
     * @param {string} actionType - نوع العملية (login, logout, add, update, delete, settings, upload, delete_file)
     * @param {string} module - اسم الموديول الذي تمت فيه العملية
     * @param {string} recordId - معرف السجل (اختياري)
     * @param {object} details - تفاصيل إضافية
     */
    async log(actionType, module, recordId = null, details = {}) {
        // التحقق من وجود سجل الأنشطة في حالة التطبيق
        if (!AppState.appData.user_activity_log) {
            AppState.appData.user_activity_log = [];
        }

        const user = AppState.currentUser;
        if (!user) {
            Utils.safeWarn('⚠️ لا يوجد مستخدم مسجل - لم يتم حفظ سجل النشاط');
            return null;
        }

        // الحصول على عنوان IP
        const ipAddress = await this.getUserIP();
        const sessionId = this.getCurrentSessionId();
        const sessionLoginTime = user.loginTime || null;

        const entry = {
            id: Utils.generateId('UAL'),
            username: user.name || user.displayName || user.email || 'مستخدم غير معروف',
            userEmail: user.email || '',
            userId: user.id || null,
            timestamp: new Date().toISOString(),
            actionType: actionType, // login, logout, add, update, delete, settings, upload, delete_file
            module: module || 'Unknown',
            recordId: recordId,
            details: typeof details === 'string' ? details : (details.description || JSON.stringify(details)),
            ipAddress: ipAddress,
            sessionId: sessionId || '',
            sessionLoginTime: sessionLoginTime || ''
        };

        AppState.appData.user_activity_log.push(entry);

        // حفظ البيانات
        try {
            DataManager.save();
            // حفظ السجلات في Google Sheets
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                GoogleIntegration.autoSave('UserActivityLog', AppState.appData.user_activity_log).catch(() => {});
            }
            
            // إرسال السجل مباشرة إلى قاعدة البيانات (Backend)
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                GoogleIntegration.sendToAppsScript('addUserActivityLog', entry).catch(err => {
                    // لا نسجل الخطأ إذا كانت Google Apps Script غير مفعّلة (متوقع)
                    const errorMsg = err?.message || String(err || '');
                    if (!errorMsg.includes('Google Apps Script غير مفعل')) {
                        Utils.safeWarn('فشل إرسال سجل النشاط إلى قاعدة البيانات:', err);
                    }
                });
            }
        } catch (error) {
            Utils.safeWarn('فشل حفظ سجل النشاط:', error);
        }

        return entry;
    },

    /**
     * الحصول على جميع السجلات مع إمكانية التصفية
     */
    getAll(filters = {}) {
        let logs = AppState.appData.user_activity_log || [];
        
        // ترتيب السجلات حسب التاريخ (الأحدث أولاً)
        logs = logs.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        // تطبيق الفلاتر
        if (filters.username) {
            logs = logs.filter(log => 
                log.username?.toLowerCase().includes(filters.username.toLowerCase()) ||
                log.userEmail?.toLowerCase().includes(filters.username.toLowerCase())
            );
        }

        if (filters.actionType && filters.actionType !== 'all') {
            logs = logs.filter(log => log.actionType === filters.actionType);
        }

        if (filters.module && filters.module !== 'all') {
            logs = logs.filter(log => log.module === filters.module);
        }

        if (filters.dateFrom) {
            logs = logs.filter(log => {
                const logDate = new Date(log.timestamp);
                const filterDate = new Date(filters.dateFrom);
                return logDate >= filterDate;
            });
        }

        if (filters.dateTo) {
            logs = logs.filter(log => {
                const logDate = new Date(log.timestamp);
                const filterDate = new Date(filters.dateTo);
                filterDate.setHours(23, 59, 59, 999); // نهاية اليوم
                return logDate <= filterDate;
            });
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            logs = logs.filter(log => 
                log.username?.toLowerCase().includes(searchTerm) ||
                log.userEmail?.toLowerCase().includes(searchTerm) ||
                log.module?.toLowerCase().includes(searchTerm) ||
                log.details?.toLowerCase().includes(searchTerm) ||
                log.actionType?.toLowerCase().includes(searchTerm)
            );
        }

        if (filters.sessionId && String(filters.sessionId).trim()) {
            const sid = String(filters.sessionId).trim();
            logs = logs.filter(log => String(log.sessionId || '').trim() === sid);
        }

        return logs;
    },

    /**
     * الحصول على قائمة أنواع الأنشطة المتاحة
     */
    getActionTypes() {
        return [
            { value: 'all', label: 'جميع الأنشطة' },
            { value: 'login', label: 'تسجيل الدخول' },
            { value: 'logout', label: 'تسجيل الخروج' },
            { value: 'add', label: 'إضافة' },
            { value: 'update', label: 'تحديث' },
            { value: 'delete', label: 'حذف' },
            { value: 'settings', label: 'الإعدادات' },
            { value: 'upload', label: 'رفع ملف' },
            { value: 'delete_file', label: 'حذف ملف' },
            { value: 'export', label: 'تصدير' },
            { value: 'import', label: 'استيراد' }
        ];
    },

    /**
     * الحصول على قائمة الموديولات المستخدمة في السجلات
     */
    getModules() {
        const logs = AppState.appData.user_activity_log || [];
        const modules = [...new Set(logs.map(log => log.module).filter(Boolean))];
        return modules.sort();
    },

    /**
     * تصدير السجلات إلى ملف Excel
     */
    exportToExcel(filters = {}) {
        const logs = this.getAll(filters);
        
        if (logs.length === 0) {
            Notification.warning('لا توجد سجلات للتصدير');
            return;
        }

        try {
            // تحضير البيانات
            const data = logs.map(log => ({
                'اسم المستخدم': log.username || '',
                'البريد الإلكتروني': log.userEmail || '',
                'التاريخ والوقت': Utils.formatDateTime(log.timestamp) || '',
                'نوع العملية': this.getActionTypeLabel(log.actionType),
                'الموديول': log.module || '',
                'معرف السجل': log.recordId || '',
                'التفاصيل': typeof log.details === 'string' ? log.details : JSON.stringify(log.details),
                'عنوان IP': log.ipAddress || '',
                'معرف الجلسة': log.sessionId || ''
            }));

            // إنشاء ورقة العمل
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'سجل الأنشطة');

            // حفظ الملف
            const fileName = `سجل_الأنشطة_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            Notification.success('✅ تم تصدير السجلات بنجاح');
        } catch (error) {
            Utils.safeError('❌ خطأ في تصدير Excel:', error);
            Notification.error('❌ فشل تصدير السجلات');
        }
    },

    /**
     * تصدير السجلات كـ PDF عبر نافذة طباعة HTML (دعم العربية وRTL).
     * jsPDF/Helvetica لا يدعمان الحروف العربية فيظهر النص مشوّهاً.
     */
    exportToPDF(filters = {}) {
        const logs = this.getAll(filters);

        if (logs.length === 0) {
            Notification.warning('لا توجد سجلات للتصدير');
            return;
        }

        try {
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                Notification.error('يرجى السماح للنوافذ المنبثقة، ثم اختر «حفظ كـ PDF» من مربع الطباعة');
                return;
            }

            const exportTime = Utils.formatDateTime(new Date().toISOString());
            const rowsHtml = logs.map(log => {
                const detRaw = typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {});
                const det = detRaw.length > 120 ? detRaw.substring(0, 120) + '…' : detRaw;
                return '<tr>' +
                    '<td>' + Utils.escapeHTML(String(log.username || '')) + '</td>' +
                    '<td>' + Utils.escapeHTML(String(Utils.formatDateTime(log.timestamp) || '')) + '</td>' +
                    '<td>' + Utils.escapeHTML(String(this.getActionTypeLabel(log.actionType))) + '</td>' +
                    '<td>' + Utils.escapeHTML(String(log.module || '')) + '</td>' +
                    '<td>' + Utils.escapeHTML(det) + '</td>' +
                    '<td>' + Utils.escapeHTML(String(log.ipAddress || '')) + '</td>' +
                    '</tr>';
            }).join('');

            const html = '<!DOCTYPE html>' +
                '<html dir="rtl" lang="ar">' +
                '<head>' +
                '<meta charset="UTF-8">' +
                '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">' +
                '<title>سجل أنشطة المستخدمين</title>' +
                '<link rel="preconnect" href="https://fonts.googleapis.com">' +
                '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
                '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">' +
                '<style>' +
                '* { font-family: \'Cairo\', \'Arial\', \'Tahoma\', sans-serif; box-sizing: border-box; }' +
                'body { direction: rtl; text-align: right; padding: 20px; margin: 0; }' +
                'h1 { color: #1e40af; font-size: 1.25rem; margin: 0 0 12px 0; }' +
                '.meta { color: #4b5563; font-size: 0.9rem; margin-bottom: 16px; }' +
                'table { border-collapse: collapse; width: 100%; font-size: 0.72rem; }' +
                'th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; word-break: break-word; }' +
                'th { background: #3b82f6; color: #fff; }' +
                'tr:nth-child(even) { background: #f8fafc; }' +
                '@media print { body { padding: 12px; } }' +
                '</style></head><body>' +
                '<h1>سجل أنشطة المستخدمين</h1>' +
                '<div class="meta">تاريخ التصدير: ' + Utils.escapeHTML(exportTime) + ' — عدد السجلات: ' + logs.length + '</div>' +
                '<table><thead><tr>' +
                '<th>اسم المستخدم</th><th>التاريخ والوقت</th><th>نوع العملية</th><th>الموديول</th><th>التفاصيل</th><th>IP</th>' +
                '</tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
                '</body></html>';

            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();

            let didPrint = false;
            const triggerPrintOnce = () => {
                if (didPrint) return;
                didPrint = true;
                try {
                    printWindow.focus();
                    printWindow.print();
                    Notification.success('استخدم «حفظ كـ PDF» أو الطابعة من مربع الحوار');
                } catch (printErr) {
                    Utils.safeWarn('print dialog:', printErr);
                    Notification.warning('تم فتح التقرير في نافذة جديدة — استخدم طباعة المتصفح');
                }
            };

            printWindow.onload = () => {
                setTimeout(triggerPrintOnce, 900);
            };
            setTimeout(triggerPrintOnce, 1400);
        } catch (error) {
            Utils.safeError('❌ خطأ في تصدير PDF:', error);
            Notification.error('❌ فشل تصدير السجلات');
        }
    },

    /**
     * الحصول على تسمية نوع العملية
     */
    getActionTypeLabel(actionType) {
        const types = {
            'login': 'تسجيل الدخول',
            'logout': 'تسجيل الخروج',
            'add': 'إضافة',
            'update': 'تحديث',
            'delete': 'حذف',
            'settings': 'الإعدادات',
            'upload': 'رفع ملف',
            'delete_file': 'حذف ملف',
            'export': 'تصدير',
            'import': 'استيراد'
        };
        return types[actionType] || actionType;
    },

    /**
     * عرض واجهة سجل الأنشطة
     */
    render() {
        // التحقق من صلاحيات المستخدم
        const isAdmin = (typeof Permissions !== 'undefined' && typeof Permissions.isCurrentUserAdmin === 'function') 
            ? Permissions.isCurrentUserAdmin() 
            : (AppState.currentUser?.role || '').toLowerCase() === 'admin';
        
        if (!isAdmin) {
            return `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-lock text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">لا توجد صلاحيات لعرض سجل الأنشطة. يرجى التواصل مع المدير.</p>
                        </div>
                    </div>
                </div>
            `;
        }

        const actionTypes = this.getActionTypes();
        const modules = this.getModules();
        
        return `
            <div class="content-card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-history ml-2"></i>
                        سجل أنشطة المستخدمين
                    </h2>
                    <div class="flex items-center gap-2">
                        <button class="btn-primary" onclick="UserActivityLog.exportToExcel(UserActivityLog.currentFilters || {})" title="تصدير إلى Excel">
                            <i class="fas fa-file-excel ml-2"></i>Excel
                        </button>
                        <button class="btn-primary" onclick="UserActivityLog.exportToPDF(UserActivityLog.currentFilters || {})" title="تصدير إلى PDF">
                            <i class="fas fa-file-pdf ml-2"></i>PDF
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <!-- الفلاتر -->
                    <div class="bg-gray-50 p-4 rounded-lg mb-4 space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <!-- البحث -->
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-search ml-2"></i>البحث
                                </label>
                                <input 
                                    type="text" 
                                    id="activity-log-search" 
                                    class="form-input" 
                                    placeholder="ادخل البحث هنا..."
                                >
                            </div>
                            
                            <!-- نوع العملية -->
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-filter ml-2"></i>نوع العملية
                                </label>
                                <select id="activity-log-action-type" class="form-input">
                                    ${actionTypes.map(type => `
                                        <option value="${type.value}">${type.label}</option>
                                    `).join('')}
                                </select>
                            </div>
                            
                            <!-- الموديول -->
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-folder ml-2"></i>الموديول
                                </label>
                                <select id="activity-log-module" class="form-input">
                                    <option value="all">جميع الموديولات</option>
                                    ${modules.map(module => `
                                        <option value="${module}">${Utils.escapeHTML(module)}</option>
                                    `).join('')}
                                </select>
                            </div>
                            
                            <!-- اسم المستخدم -->
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-user ml-2"></i>اسم المستخدم
                                </label>
                                <input 
                                    type="text" 
                                    id="activity-log-username" 
                                    class="form-input" 
                                    placeholder="ادخل اسم المستخدم هنا..."
                                >
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- التاريخ من -->
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-calendar-alt ml-2"></i>التاريخ من
                                </label>
                                <input 
                                    type="date" 
                                    id="activity-log-date-from" 
                                    class="form-input"
                                >
                            </div>
                            
                                <!-- التاريخ إلى -->
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-calendar-alt ml-2"></i>التاريخ إلى
                                </label>
                                <input 
                                    type="date" 
                                    id="activity-log-date-to" 
                                    class="form-input"
                                >
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-2">
                            <button class="btn-primary" onclick="UserActivityLog.applyFilters()">
                                <i class="fas fa-filter ml-2"></i>تطبيق الفلاتر
                            </button>
                            <button class="btn-secondary" onclick="UserActivityLog.resetFilters()">
                                <i class="fas fa-redo ml-2"></i>إعادة تعيين الفلاتر
                            </button>
                        </div>
                    </div>

                    <!-- تقرير الجلسات اليومي -->
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-4">
                        <h3 class="text-lg font-semibold text-slate-800 mb-2">
                            <i class="fas fa-user-clock ml-2"></i>تقرير الجلسات اليومي (من الدخول حتى الخروج)
                        </h3>
                        <p class="text-xs text-gray-600 mb-3">
                            يعرض الأحداث المسجّلة في سجل النشاط فقط. للبريد اليومي: أنشئ <strong>Trigger</strong> زمنياً في Google Apps Script يستدعي الدالة
                            <code class="text-xs bg-white px-1 rounded">runDailyUserSessionEmailReport</code>
                            ويمكن تعيين المستلمين عبر خاصية السكربت <code class="text-xs bg-white px-1 rounded">DAILY_ACTIVITY_REPORT_EMAILS</code>.
                        </p>
                        <div class="flex flex-wrap items-end gap-3 mb-3">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">تاريخ التقرير</label>
                                <input type="date" id="daily-session-report-date" class="form-input">
                            </div>
                            <button type="button" class="btn-primary" onclick="UserActivityLog.loadDailySessionReport()">
                                <i class="fas fa-sync ml-2"></i>تحميل التقرير
                            </button>
                            <button type="button" class="btn-secondary" onclick="UserActivityLog.exportDailySessionsToExcel()" title="آخر تقرير محمّل">
                                <i class="fas fa-file-excel ml-2"></i>تصدير الجلسات Excel
                            </button>
                            <button type="button" class="btn-secondary" onclick="UserActivityLog.copyDailyReportText()">
                                <i class="fas fa-copy ml-2"></i>نسخ الملخص
                            </button>
                        </div>
                        <div id="daily-session-report-container" class="text-sm">
                            <p class="text-gray-500">اختر التاريخ ثم اضغط «تحميل التقرير».</p>
                        </div>
                    </div>
                    
                    <!-- جدول السجلات -->
                    <div id="activity-log-table-container">
                        ${this.renderTable()}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض جدول السجلات
     */
    renderTable(filters = {}) {
        const logs = this.getAll(filters);
        this.currentFilters = filters;
        
        if (logs.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد سجلات لعرض</p>
                </div>
            `;
        }

        return `
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                                <th>اسم المستخدم</th>
                            <th>التاريخ والوقت</th>
                            <th>نوع العملية</th>
                            <th>الموديول</th>
                            <th>التفاصيل</th>
                            <th>عنوان IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => `
                            <tr>
                                <td>
                                    <div class="font-semibold">${Utils.escapeHTML(log.username || '')}</div>
                                    <div class="text-xs text-gray-500">${Utils.escapeHTML(log.userEmail || '')}</div>
                                </td>
                                <td>${Utils.formatDateTime(log.timestamp)}</td>
                                <td>
                                    <span class="badge badge-${this.getActionTypeBadgeColor(log.actionType)}">
                                        ${this.getActionTypeLabel(log.actionType)}
                                    </span>
                                </td>
                                <td>${Utils.escapeHTML(log.module || '')}</td>
                                <td class="max-w-xs truncate" title="${Utils.escapeHTML(typeof log.details === 'string' ? log.details : JSON.stringify(log.details))}">
                                    ${Utils.escapeHTML(typeof log.details === 'string' ? log.details.substring(0, 50) : JSON.stringify(log.details).substring(0, 50))}
                                    ${(typeof log.details === 'string' ? log.details.length : JSON.stringify(log.details).length) > 50 ? '...' : ''}
                                </td>
                                <td class="font-mono text-xs">${Utils.escapeHTML(log.ipAddress || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="mt-4 text-sm text-gray-600">
                <i class="fas fa-info-circle ml-2"></i>
                عدد السجلات: <strong>${logs.length}</strong>
            </div>
        `;
    },

    /**
     * الحصول على لون العلامة المرجعية لنوع العملية
     */
    getActionTypeBadgeColor(actionType) {
        const colors = {
            'login': 'success',
            'logout': 'secondary',
            'add': 'primary',
            'update': 'warning',
            'delete': 'danger',
            'settings': 'info',
            'upload': 'primary',
            'delete_file': 'danger',
            'export': 'success',
            'import': 'info'
        };
        return colors[actionType] || 'secondary';
    },

    /**
     * تطبيق الفلاتر
     */
    applyFilters() {
        const filters = {
            search: document.getElementById('activity-log-search')?.value.trim() || '',
            actionType: document.getElementById('activity-log-action-type')?.value || 'all',
            module: document.getElementById('activity-log-module')?.value || 'all',
            username: document.getElementById('activity-log-username')?.value.trim() || '',
            dateFrom: document.getElementById('activity-log-date-from')?.value || '',
            dateTo: document.getElementById('activity-log-date-to')?.value || ''
        };

        const container = document.getElementById('activity-log-table-container');
        if (container) {
            container.innerHTML = this.renderTable(filters);
        }
    },

    /**
     * إعادة تعيين الفلاتر
     */
    resetFilters() {
        document.getElementById('activity-log-search').value = '';
        document.getElementById('activity-log-action-type').value = 'all';
        document.getElementById('activity-log-module').value = 'all';
        document.getElementById('activity-log-username').value = '';
        document.getElementById('activity-log-date-from').value = '';
        document.getElementById('activity-log-date-to').value = '';
        this.applyFilters();
    },

    /**
     * تحميل تقرير الجلسات ليوم محدد من الخادم (تجميع حسب sessionId أو استنتاج من login/logout)
     */
    async loadDailySessionReport() {
        const dateInput = document.getElementById('daily-session-report-date');
        const container = document.getElementById('daily-session-report-container');
        if (!dateInput || !container) return;
        const dateStr = dateInput.value || new Date().toISOString().split('T')[0];
        if (typeof GoogleIntegration === 'undefined' || !GoogleIntegration.sendToAppsScript) {
            Notification.error('التكامل مع الخادم غير متاح');
            return;
        }
        container.innerHTML = '<p class="text-gray-600"><i class="fas fa-spinner fa-spin ml-2"></i>جارٍ التحميل...</p>';
        try {
            let tz = 'UTC';
            try {
                tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            } catch (e) { /* ignore */ }
            const result = await GoogleIntegration.sendToAppsScript('getDailyUserSessionActivityReport', {
                date: dateStr,
                timezone: tz
            });
            this._lastDailyReport = result;
            if (!result || !result.success) {
                const msg = result?.message || 'فشل تحميل التقرير';
                container.innerHTML = '<div class="text-red-600">' + Utils.escapeHTML(msg) + '</div>';
                return;
            }
            container.innerHTML = this.renderDailySessionReportHTML(result);
        } catch (err) {
            Utils.safeWarn('loadDailySessionReport', err);
            container.innerHTML = '<div class="text-red-600">تعذر تحميل التقرير</div>';
            Notification.error('تعذر تحميل تقرير الجلسات');
        }
    },

    /**
     * HTML جدول تقرير الجلسات
     */
    renderDailySessionReportHTML(report) {
        const sessions = report.sessions || [];
        if (!sessions.length) {
            return '<p class="text-gray-500">لا توجد جلسات مسجّلة في هذا التاريخ (حسب المنطقة الزمنية والبيانات المتوفرة).</p>';
        }
        let rows = '';
        for (let i = 0; i < sessions.length; i++) {
            const s = sessions[i];
            const who = Utils.escapeHTML(s.userEmail || s.username || s.userKey || '');
            const infer = (s.inferred || s.orphan) ? '<span class="text-xs text-amber-700 mr-1">(استنتاج/يتيم)</span>' : '';
            const sidCell = s.sessionId
                ? '<span class="font-mono text-xs break-all">' + Utils.escapeHTML(String(s.sessionId)) + '</span>'
                : (s.inferred ? '<span class="text-amber-700 text-xs">مستنتج</span>' : '—');
            const loginAt = s.loginAt ? Utils.formatDateTime(s.loginAt) : '—';
            const logoutAt = s.logoutAt ? Utils.formatDateTime(s.logoutAt) : '<span class="text-gray-500">بدون تسجيل خروج</span>';
            const detailId = 'daily-session-detail-' + i;
            const evRows = (s.events || []).map(ev => {
                const t = Utils.formatDateTime(ev.timestamp);
                const act = Utils.escapeHTML(this.getActionTypeLabel(ev.actionType || ev.action));
                const mod = Utils.escapeHTML(ev.module || '');
                const detRaw = String(ev.details || '');
                const det = Utils.escapeHTML(detRaw.substring(0, 120));
                return '<tr><td class="text-xs">' + t + '</td><td class="text-xs">' + act + '</td><td class="text-xs">' + mod + '</td><td class="text-xs max-w-md truncate" title="' + Utils.escapeHTML(detRaw) + '">' + det + '</td></tr>';
            }).join('');
            rows += '<tr class="border-b border-slate-200">' +
                '<td class="py-2 px-2">' + who + infer + '</td>' +
                '<td class="py-2 px-2">' + sidCell + '</td>' +
                '<td class="py-2 px-2 text-xs">' + loginAt + '</td>' +
                '<td class="py-2 px-2 text-xs">' + logoutAt + '</td>' +
                '<td class="py-2 px-2 text-center">' + (s.eventCount || 0) + '</td>' +
                '<td class="py-2 px-2"><button type="button" class="btn-secondary text-xs" onclick="UserActivityLog.toggleDailySessionDetail(\'' + detailId + '\')">تفاصيل</button></td></tr>' +
                '<tr id="' + detailId + '" style="display:none"><td colspan="6" class="bg-white p-2"><table class="data-table w-full"><thead><tr><th>وقت</th><th>نوع</th><th>موديول</th><th>تفاصيل</th></tr></thead><tbody>' + (evRows || '<tr><td colspan="4">لا تفاصيل</td></tr>') + '</tbody></table>' + (s.note ? '<p class="text-xs text-amber-800 mt-2">' + Utils.escapeHTML(s.note) + '</p>' : '') + '</td></tr>';
        }
        return '<div class="mb-2 text-gray-700">عدد الجلسات: <strong>' + sessions.length + '</strong> — سجلات اليوم: <strong>' + (report.rawLogCount || 0) + '</strong></div>' +
            '<div class="overflow-x-auto"><table class="data-table w-full text-sm"><thead><tr><th>مستخدم</th><th>جلسة</th><th>بداية</th><th>نهاية</th><th>أحداث</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    },

    toggleDailySessionDetail(detailId) {
        const el = document.getElementById(detailId);
        if (!el) return;
        el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
    },

    exportDailySessionsToExcel() {
        const report = this._lastDailyReport;
        if (!report || !report.success || !Array.isArray(report.sessions) || !report.sessions.length) {
            Notification.warning('حمّل تقرير الجلسات أولاً');
            return;
        }
        if (typeof XLSX === 'undefined') {
            Notification.error('مكتبة Excel غير متاحة');
            return;
        }
        try {
            const rows = [];
            (report.sessions || []).forEach(s => {
                const who = s.userEmail || s.username || s.userKey || '';
                const sess = s.sessionId || (s.inferred ? '(مستنتج)' : '');
                (s.events || []).forEach(ev => {
                    rows.push({
                        'تاريخ التقرير': report.date || '',
                        'المستخدم': who,
                        'معرف الجلسة': sess,
                        'بداية الجلسة': s.loginAt ? Utils.formatDateTime(s.loginAt) : '',
                        'نهاية الجلسة': s.logoutAt ? Utils.formatDateTime(s.logoutAt) : '',
                        'وقت الحدث': Utils.formatDateTime(ev.timestamp),
                        'نوع الحدث': this.getActionTypeLabel(ev.actionType || ev.action),
                        'الموديول': ev.module || '',
                        'التفاصيل': String(ev.details || '')
                    });
                });
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'جلسات');
            XLSX.writeFile(wb, 'تقرير_جلسات_' + (report.date || '') + '.xlsx');
            Notification.success('تم تصدير تقرير الجلسات');
        } catch (e) {
            Utils.safeError('exportDailySessionsToExcel', e);
            Notification.error('فشل التصدير');
        }
    },

    async copyDailyReportText() {
        const report = this._lastDailyReport;
        if (!report || !report.success) {
            Notification.warning('حمّل تقرير الجلسات أولاً');
            return;
        }
        const lines = [];
        lines.push('تقرير الجلسات — ' + (report.date || ''));
        lines.push('المنطقة الزمنية: ' + (report.timezone || '') + ' | جلسات: ' + (report.count || 0) + ' | سجلات خام: ' + (report.rawLogCount || 0));
        (report.sessions || []).forEach(s => {
            const who = s.userEmail || s.username || s.userKey || '';
            lines.push('— ' + who + ' | ' + (s.sessionId || 'مستنتج') + ' | أحداث: ' + (s.eventCount || 0));
        });
        const text = lines.join('\n');
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                Notification.success('تم نسخ الملخص');
            } else {
                Notification.warning('المتصفح لا يدعم النسخ التلقائي');
            }
        } catch (e) {
            Notification.error('فشل النسخ');
        }
    },

    /**
     * عرض النموذج
     */
    showModal() {
        // التحقق من صلاحيات المستخدم
        const isAdmin = (typeof Permissions !== 'undefined' && typeof Permissions.isCurrentUserAdmin === 'function') 
            ? Permissions.isCurrentUserAdmin() 
            : (AppState.currentUser?.role || '').toLowerCase() === 'admin';
        
        if (!isAdmin) {
            Notification.error('لا توجد صلاحيات لعرض سجل الأنشطة. يرجى التواصل مع المدير.');
            return;
        }

        const modalHTML = `
            <div class="modal-overlay" id="activity-log-modal">
                <div class="modal-content" style="max-width: 95%; width: 1400px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h2 class="modal-title">
                            <i class="fas fa-history ml-2"></i>
                            سجل أنشطة المستخدمين
                        </h2>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove(); UserActivityLog.stopAutoRefresh();">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${this.render()}
                    </div>
                </div>
            </div>
        `;

        // إزالة النموذج الموجود مسبقاً
        const existingModal = document.getElementById('activity-log-modal');
        if (existingModal) {
            existingModal.remove();
        }

            // إضافة النموذج
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // ربط أحداث الفلاتر
        setTimeout(() => {
            const searchInput = document.getElementById('activity-log-search');
            if (searchInput) {
                searchInput.addEventListener('input', () => this.applyFilters());
            }
            
            const actionTypeSelect = document.getElementById('activity-log-action-type');
            if (actionTypeSelect) {
                actionTypeSelect.addEventListener('change', () => this.applyFilters());
            }
            
            const moduleSelect = document.getElementById('activity-log-module');
            if (moduleSelect) {
                moduleSelect.addEventListener('change', () => this.applyFilters());
            }
            
            const usernameInput = document.getElementById('activity-log-username');
            if (usernameInput) {
                usernameInput.addEventListener('input', () => this.applyFilters());
            }
            
            const dateFromInput = document.getElementById('activity-log-date-from');
            if (dateFromInput) {
                dateFromInput.addEventListener('change', () => this.applyFilters());
            }
            
            const dateToInput = document.getElementById('activity-log-date-to');
            if (dateToInput) {
                dateToInput.addEventListener('change', () => this.applyFilters());
            }

            const dailyDate = document.getElementById('daily-session-report-date');
            if (dailyDate && !dailyDate.value) {
                dailyDate.value = new Date().toISOString().split('T')[0];
            }
            
            // بدء التحديث الدوري التلقائي
            this.startAutoRefresh();
            
            // تحميل السجلات من قاعدة البيانات
            this.loadLogsFromBackend();
        }, 100);
    },
    
    /**
     * متغيرات التحديث الدوري
     */
    autoRefreshInterval: null,
    autoRefreshEnabled: true,
    
    /**
     * بدء التحديث الدوري التلقائي (كل 30 ثانية)
     */
    startAutoRefresh() {
        this.stopAutoRefresh(); // إيقاف أي تحديث سابق
        
        if (!this.autoRefreshEnabled) return;
        
        this.autoRefreshInterval = setInterval(() => {
            // تحديث السجلات من قاعدة البيانات
            this.loadLogsFromBackend();
            // إعادة تطبيق الفلاتر الحالية
            this.applyFilters();
        }, 30000); // كل 30 ثانية
    },
    
    /**
     * إيقاف التحديث الدوري
     */
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    },
    
    /**
     * تحميل السجلات من قاعدة البيانات
     */
    async loadLogsFromBackend() {
        if (typeof GoogleIntegration === 'undefined' || !GoogleIntegration.sendToAppsScript) {
            return;
        }
        
        try {
            const result = await GoogleIntegration.sendToAppsScript('getAllUserActivityLogs', {});
            
            if (result && result.success && Array.isArray(result.data)) {
                // دمج السجلات من قاعدة البيانات مع السجلات المحلية
                const backendLogs = result.data || [];
                const localLogs = AppState.appData.user_activity_log || [];
                
                // إنشاء خريطة للسجلات المحلية لتجنب التكرار
                const localLogsMap = new Map();
                localLogs.forEach(log => {
                    if (log.id) {
                        localLogsMap.set(log.id, log);
                    }
                });
                
                // إضافة السجلات من قاعدة البيانات
                backendLogs.forEach(log => {
                    if (log.id && !localLogsMap.has(log.id)) {
                        localLogsMap.set(log.id, log);
                    }
                });
                
                // تحديث AppState
                AppState.appData.user_activity_log = Array.from(localLogsMap.values());
                
                // ترتيب حسب التاريخ (الأحدث أولاً)
                AppState.appData.user_activity_log.sort((a, b) => {
                    const dateA = new Date(a.timestamp || a.createdAt || 0);
                    const dateB = new Date(b.timestamp || b.createdAt || 0);
                    return dateB - dateA;
                });
                
                // حفظ محلي
                DataManager.save();
            }
        } catch (error) {
            Utils.safeWarn('فشل تحميل السجلات من قاعدة البيانات:', error);
        }
    },
    
    /**
     * دالة مساعدة لتسجيل عمليات CRUD بشكل موحد.
     * لتوسيع تغطية «ما تم إجراؤه» في تقارير الجلسات، استدعِ هذه الدالة من مسارات الحفظ
     * في الموديولات (بعد نجاح العملية) دون انتظار — انظر أيضاً `log`.
     * @param {string} action - 'add', 'update', 'delete'
     * @param {string} module - اسم الموديول
     * @param {string} recordId - معرف السجل
     * @param {object} recordData - بيانات السجل (اختياري)
     */
    logOperation(action, module, recordId, recordData = {}) {
        if (!['add', 'update', 'delete'].includes(action)) {
            Utils.safeWarn('عملية غير صحيحة:', action);
            return;
        }
        
        const details = {
            description: this.getActionDescription(action, module, recordId),
            recordData: recordData
        };
        
        return this.log(action, module, recordId, details);
    },
    
    /**
     * الحصول على وصف العملية
     */
    getActionDescription(action, module, recordId) {
        const actionLabels = {
            'add': 'إضافة',
            'update': 'تحديث',
            'delete': 'حذف'
        };
        
        return `${actionLabels[action] || action} سجل في ${module}${recordId ? ` (ID: ${recordId})` : ''}`;
    }
};

// Export to global window (for script tag loading)
if (typeof window !== 'undefined') {
    window.UserActivityLog = UserActivityLog;
}

