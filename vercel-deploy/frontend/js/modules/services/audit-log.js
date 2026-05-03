/**
 * Audit Log Service
 * Handles system audit logging
 */

const AuditLog = {
    log(action, module, recordId, details = {}) {
        if (!AppState.appData.auditLog) {
            AppState.appData.auditLog = [];
        }

        const entry = {
            id: Utils.generateId('AUDIT'),
            timestamp: new Date().toISOString(),
            action,
            module,
            recordId,
            details,
            user: this._extractUser(AppState.currentUser)
        };

        AppState.appData.auditLog.push(entry);

        try {
            DataManager.save();
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                GoogleIntegration.autoSave('AuditLog', AppState.appData.auditLog).catch(() => {});
            }
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في حفظ سجل التدقيق:', error);
        }

        return entry;
    },

    getAll(filter = {}) {
        const logs = AppState.appData.auditLog || [];
        if (Object.keys(filter).length === 0) {
            return logs;
        }
        return logs.filter(entry => {
            return Object.entries(filter).every(([key, value]) => {
                if (value === undefined || value === null || value === '') return true;
                return entry[key] === value;
            });
        });
    },

    getByRecord(module, recordId) {
        return this.getAll({ module, recordId });
    },

    _extractUser(user) {
        if (!user) return null;
        return {
            id: user.id || null,
            name: user.name || user.fullName || user.displayName || '',
            email: user.email || '',
            role: user.role || ''
        };
    }
};

// Export to global window (for script tag loading)
if (typeof window !== 'undefined') {
    window.AuditLog = AuditLog;
}

