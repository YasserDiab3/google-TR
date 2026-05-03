/* ========================================
   واجهة إدارة النسخ الاحتياطية
   Backup Management UI
   ======================================== */

/**
 * واجهة إدارة النسخ الاحتياطية
 */
const backupUiLog = (...args) => {
    try {
        if (typeof Utils !== 'undefined' && typeof Utils.safeLog === 'function') {
            Utils.safeLog(...args);
        }
    } catch (e) { /* ignore */ }
};

const BackupUI = {
    eventsBound: false,
    
    /**
     * تهيئة الواجهة
     */
    async init() {
        try {
            // التحقق من الصلاحيات (يجب أن يكون المستخدم مديراً)
            if (!this.isAdmin()) {
                backupUiLog('ℹ️ المستخدم ليس مديراً، لن يتم عرض قسم النسخ الاحتياطية');
                return;
            }
            
            // إظهار قسم النسخ الاحتياطية
            const backupSection = document.getElementById('backup-management-section');
            if (backupSection) {
                backupSection.style.display = 'block';
            } else {
                console.warn('⚠️ قسم النسخ الاحتياطية غير موجود في DOM');
            }
            
            // ربط الأحداث (فقط إذا لم يتم ربطها من قبل)
            if (!this.eventsBound) {
                this.setupEventListeners();
                this.eventsBound = true;
            }
            
            // تحميل البيانات
            await this.loadBackupStatistics();
            await this.loadBackupList();
            await this.loadBackupSettings();
            
            backupUiLog('✅ تم تهيئة واجهة النسخ الاحتياطية بنجاح');
        } catch (error) {
            console.error('❌ خطأ في تهيئة واجهة النسخ الاحتياطية:', error);
        }
    },

    /**
     * التحقق من صلاحيات المدير
     */
    isAdmin() {
        try {
            if (typeof AppState !== 'undefined' && AppState.currentUser) {
                const user = AppState.currentUser;
                if (user.role === 'admin') {
                    return true;
                }
            }
            
            if (typeof Permissions !== 'undefined' && typeof AppState !== 'undefined') {
                const user = AppState.currentUser;
                if (user) {
                    const perms = Permissions.getEffectivePermissions(user);
                    return perms && perms.__isAdmin === true;
                }
            }
        } catch (error) {
            console.warn('⚠️ خطأ في التحقق من صلاحيات المدير:', error);
        }
        
        return false;
    },

    /**
     * ربط الأحداث
     */
    setupEventListeners() {
        // زر إنشاء نسخة احتياطية يدوية
        const createBackupBtn = document.getElementById('create-manual-backup-btn');
        if (createBackupBtn) {
            createBackupBtn.addEventListener('click', () => this.createManualBackup());
        }
        
        // زر تحديث قائمة النسخ
        const refreshBtn = document.getElementById('refresh-backups-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadBackupList());
        }
        
        // زر حفظ الإعدادات
        const saveSettingsBtn = document.getElementById('save-backup-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveBackupSettings());
        }
    },

    /**
     * إنشاء نسخة احتياطية يدوية
     */
    async createManualBackup() {
        if (!this.isAdmin()) {
            this.showNotification('يجب أن تكون مديراً لإنشاء نسخة احتياطية', 'error');
            return;
        }
        
        const createBtn = document.getElementById('create-manual-backup-btn');
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري إنشاء النسخة الاحتياطية...';
        }
        
        try {
            const userData = AppState.currentUser || {
                id: 'unknown',
                name: 'Unknown',
                email: '',
                role: 'admin'
            };
            
            // استدعاء API
            const result = await GoogleIntegration.fetchData('createManualBackup', {
                userData: userData
            });
            
            if (result && result.success) {
                this.showNotification('تم إنشاء النسخة الاحتياطية بنجاح', 'success');
                
                // تحديث القوائم
                await this.loadBackupStatistics();
                await this.loadBackupList();
            } else {
                this.showNotification(
                    result?.message || 'فشل في إنشاء النسخة الاحتياطية',
                    'error'
                );
            }
        } catch (error) {
            console.error('❌ خطأ في إنشاء النسخة الاحتياطية:', error);
            this.showNotification('حدث خطأ أثناء إنشاء النسخة الاحتياطية: ' + error.message, 'error');
        } finally {
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.innerHTML = '<i class="fas fa-database ml-2"></i> إنشاء نسخة احتياطية يدوية';
            }
        }
    },

    /**
     * تحميل إحصائيات النسخ الاحتياطية
     */
    async loadBackupStatistics() {
        try {
            const result = await GoogleIntegration.fetchData('getBackupStatistics', {});
            
            if (result && result.success && result.data) {
                const stats = result.data;
                
                // تحديث الإحصائيات في الواجهة
                const totalBackupsEl = document.getElementById('total-backups-count');
                if (totalBackupsEl) {
                    totalBackupsEl.textContent = stats.totalBackups || 0;
                }
                
                const successfulBackupsEl = document.getElementById('successful-backups-count');
                if (successfulBackupsEl) {
                    successfulBackupsEl.textContent = stats.successfulBackups || 0;
                }
                
                const failedBackupsEl = document.getElementById('failed-backups-count');
                if (failedBackupsEl) {
                    failedBackupsEl.textContent = stats.failedBackups || 0;
                }
                
                const successRateEl = document.getElementById('backup-success-rate');
                if (successRateEl) {
                    successRateEl.textContent = stats.successRate || '0%';
                }
                
                const lastBackupEl = document.getElementById('last-backup-time');
                if (lastBackupEl && stats.lastSuccessfulBackup) {
                    const date = new Date(stats.lastSuccessfulBackup.date);
                    lastBackupEl.textContent = date.toLocaleString('ar-SA');
                } else if (lastBackupEl) {
                    lastBackupEl.textContent = '-';
                }
                
                const storageUsedEl = document.getElementById('backup-storage-used');
                if (storageUsedEl) {
                    storageUsedEl.textContent = stats.totalStorageUsed || '0 Bytes';
                }
            }
        } catch (error) {
            // تجاهل أخطاء Circuit Breaker و Google Apps Script غير المفعل
            const errorMsg = String(error?.message || '').toLowerCase();
            if (!errorMsg.includes('circuit breaker') && 
                !errorMsg.includes('google apps script غير مفعل') &&
                !errorMsg.includes('غير مفعل')) {
                // تسجيل الأخطاء الأخرى فقط
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('❌ خطأ في تحميل إحصائيات النسخ الاحتياطية:', error);
                } else {
                    console.error('❌ خطأ في تحميل إحصائيات النسخ الاحتياطية:', error);
                }
            }
        }
    },

    /**
     * تحميل قائمة النسخ الاحتياطية
     */
    async loadBackupList() {
        const listContainer = document.getElementById('backups-list');
        if (!listContainer) return;
        
        try {
            const result = await GoogleIntegration.fetchData('getAllBackups', {});
            
            if (result && result.success && result.data) {
                const backups = result.data || [];
                
                if (backups.length === 0) {
                    listContainer.innerHTML = '<p class="text-gray-500 text-center py-4">لا توجد نسخ احتياطية</p>';
                    return;
                }
                
                listContainer.innerHTML = backups.map(backup => {
                    const date = new Date(backup.createdAt);
                    const statusClass = backup.status === 'completed' ? 'badge-success' : 'badge-danger';
                    const statusText = backup.status === 'completed' ? 'نجح' : 'فشل';
                    const typeText = backup.backupType === 'manual' ? 'يدوي' : backup.backupType === 'automatic' ? 'تلقائي' : 'استعادة';
                    
                    return `
                        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600 mb-3">
                            <div class="flex justify-between items-start mb-2">
                                <div class="flex-1">
                                    <h5 class="font-semibold text-lg">${Utils.escapeHTML(backup.backupName || backup.id)}</h5>
                                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        <i class="fas fa-calendar ml-1"></i>
                                        ${date.toLocaleString('ar-SA')}
                                    </p>
                                    <p class="text-sm text-gray-600 dark:text-gray-400">
                                        <i class="fas fa-user ml-1"></i>
                                        ${Utils.escapeHTML(backup.createdBy || 'غير معروف')}
                                    </p>
                                </div>
                                <div class="flex flex-col items-end gap-2">
                                    <span class="badge ${statusClass}">${statusText}</span>
                                    <span class="badge badge-info">${typeText}</span>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                                <div>
                                    <span class="text-gray-600 dark:text-gray-400">الحجم:</span>
                                    <span class="font-semibold mr-2">${backup.fileSizeFormatted || 'N/A'}</span>
                                </div>
                                <div>
                                    <span class="text-gray-600 dark:text-gray-400">الأوراق:</span>
                                    <span class="font-semibold mr-2">${backup.sheetsCount || 0}</span>
                                </div>
                                <div>
                                    <span class="text-gray-600 dark:text-gray-400">السجلات:</span>
                                    <span class="font-semibold mr-2">${backup.totalRecords || 0}</span>
                                </div>
                                <div>
                                    <span class="text-gray-600 dark:text-gray-400">المدة:</span>
                                    <span class="font-semibold mr-2">${backup.duration ? backup.duration + ' ث' : 'N/A'}</span>
                                </div>
                            </div>
                            <div class="flex gap-2 mt-3">
                                ${backup.fileUrl ? `
                                    <a href="${backup.fileUrl}" target="_blank" class="btn btn-sm btn-primary">
                                        <i class="fas fa-external-link-alt ml-1"></i>
                                        فتح في Drive
                                    </a>
                                ` : ''}
                                ${backup.status === 'completed' ? `
                                    <button class="btn btn-sm btn-success" onclick="BackupUI.downloadBackup('${backup.id}')">
                                        <i class="fas fa-download ml-1"></i>
                                        تحميل
                                    </button>
                                ` : ''}
                                <button class="btn btn-sm btn-danger" onclick="BackupUI.deleteBackup('${backup.id}')">
                                    <i class="fas fa-trash ml-1"></i>
                                    حذف
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                listContainer.innerHTML = '<p class="text-red-500 text-center py-4">خطأ في تحميل النسخ الاحتياطية</p>';
            }
        } catch (error) {
            // تجاهل أخطاء Circuit Breaker و Google Apps Script غير المفعل
            const errorMsg = String(error?.message || '').toLowerCase();
            if (!errorMsg.includes('circuit breaker') && 
                !errorMsg.includes('google apps script غير مفعل') &&
                !errorMsg.includes('غير مفعل')) {
                // تسجيل الأخطاء الأخرى فقط
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('❌ خطأ في تحميل قائمة النسخ الاحتياطية:', error);
                } else {
                    console.error('❌ خطأ في تحميل قائمة النسخ الاحتياطية:', error);
                }
            }
            listContainer.innerHTML = '<p class="text-red-500 text-center py-4">خطأ في تحميل النسخ الاحتياطية</p>';
        }
    },

    /**
     * تحميل إعدادات النسخ الاحتياطية
     */
    async loadBackupSettings() {
        try {
            const result = await GoogleIntegration.fetchData('getBackupSettings', {});
            
            if (result && result.success && result.data) {
                const settings = result.data;
                
                // تحديث الإعدادات في الواجهة
                const autoBackupEnabled = document.getElementById('auto-backup-enabled');
                if (autoBackupEnabled) {
                    autoBackupEnabled.checked = settings.autoBackupEnabled || false;
                }
                
                const maxBackupFiles = document.getElementById('max-backup-files');
                if (maxBackupFiles) {
                    maxBackupFiles.value = settings.maxBackupFiles || 30;
                }
                
                const retentionDays = document.getElementById('retention-days');
                if (retentionDays) {
                    retentionDays.value = settings.retentionDays || 30;
                }
            }
        } catch (error) {
            // تجاهل أخطاء Circuit Breaker و Google Apps Script غير المفعل
            const errorMsg = String(error?.message || '').toLowerCase();
            if (!errorMsg.includes('circuit breaker') && 
                !errorMsg.includes('google apps script غير مفعل') &&
                !errorMsg.includes('غير مفعل')) {
                // تسجيل الأخطاء الأخرى فقط
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('❌ خطأ في تحميل إعدادات النسخ الاحتياطية:', error);
                } else {
                    console.error('❌ خطأ في تحميل إعدادات النسخ الاحتياطية:', error);
                }
            }
        }
    },

    /**
     * حفظ إعدادات النسخ الاحتياطية
     */
    async saveBackupSettings() {
        const saveBtn = document.getElementById('save-backup-settings-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الحفظ...';
        }
        
        try {
            const settings = {
                autoBackupEnabled: document.getElementById('auto-backup-enabled')?.checked || false,
                maxBackupFiles: parseInt(document.getElementById('max-backup-files')?.value) || 30,
                retentionDays: parseInt(document.getElementById('retention-days')?.value) || 30,
                notifyOnBackup: document.getElementById('notify-on-backup')?.checked || true,
                notifyOnFailure: document.getElementById('notify-on-failure')?.checked || true
            };
            
            const userData = AppState.currentUser || {
                id: 'unknown',
                name: 'Unknown',
                email: '',
                role: 'admin'
            };
            
            const result = await GoogleIntegration.fetchData('saveBackupSettings', {
                ...settings,
                userData: userData
            });
            
            if (result && result.success) {
                this.showNotification('تم حفظ الإعدادات بنجاح', 'success');
            } else {
                this.showNotification(
                    result?.message || 'فشل في حفظ الإعدادات',
                    'error'
                );
            }
        } catch (error) {
            console.error('❌ خطأ في حفظ إعدادات النسخ الاحتياطية:', error);
            this.showNotification('حدث خطأ أثناء حفظ الإعدادات: ' + error.message, 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save ml-2"></i> حفظ الإعدادات';
            }
        }
    },

    /**
     * تحميل نسخة احتياطية
     */
    async downloadBackup(backupId) {
        try {
            const result = await GoogleIntegration.fetchData('downloadBackup', {
                backupId: backupId
            });
            
            if (result && result.success && result.data) {
                // فتح رابط التحميل في نافذة جديدة
                window.open(result.data.downloadUrl || result.data.fileUrl, '_blank');
                this.showNotification('جاري تحميل النسخة الاحتياطية...', 'info');
            } else {
                this.showNotification(
                    result?.message || 'فشل في تحميل النسخة الاحتياطية',
                    'error'
                );
            }
        } catch (error) {
            console.error('❌ خطأ في تحميل النسخة الاحتياطية:', error);
            this.showNotification('حدث خطأ أثناء تحميل النسخة الاحتياطية: ' + error.message, 'error');
        }
    },

    /**
     * حذف نسخة احتياطية
     */
    async deleteBackup(backupId) {
        if (!confirm('هل أنت متأكد من حذف هذه النسخة الاحتياطية؟')) {
            return;
        }
        
        try {
            const userData = AppState.currentUser || {
                id: 'unknown',
                name: 'Unknown',
                email: '',
                role: 'admin'
            };
            
            const result = await GoogleIntegration.fetchData('deleteBackup', {
                backupId: backupId,
                userData: userData
            });
            
            if (result && result.success) {
                this.showNotification('تم حذف النسخة الاحتياطية بنجاح', 'success');
                
                // تحديث القوائم
                await this.loadBackupStatistics();
                await this.loadBackupList();
            } else {
                this.showNotification(
                    result?.message || 'فشل في حذف النسخة الاحتياطية',
                    'error'
                );
            }
        } catch (error) {
            console.error('❌ خطأ في حذف النسخة الاحتياطية:', error);
            this.showNotification('حدث خطأ أثناء حذف النسخة الاحتياطية: ' + error.message, 'error');
        }
    },

    /**
     * إظهار إشعار
     */
    showNotification(message, type = 'info') {
        if (typeof Notification !== 'undefined' && Notification.show) {
            Notification.show('النسخ الاحتياطي', message, type);
        } else {
            alert(message);
        }
    }
};

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.BackupUI = BackupUI;
}
