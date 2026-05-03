/**
 * Periodic Inspection Store Service
 * Handles periodic inspection categories, records, schedules, and checklists
 */

const PeriodicInspectionStore = {
    ensureInitialized() {
        if (!AppState || !AppState.appData) return;
        const data = AppState.appData;

        if (!Array.isArray(data.periodicInspectionCategories)) {
            data.periodicInspectionCategories = [];
        }
        if (!Array.isArray(data.periodicInspectionRecords)) {
            data.periodicInspectionRecords = [];
        }
        if (!Array.isArray(data.periodicInspectionSchedules)) {
            data.periodicInspectionSchedules = [];
        }
        if (!Array.isArray(data.periodicInspectionChecklists)) {
            data.periodicInspectionChecklists = [];
        }

        const now = new Date().toISOString();
        DEFAULT_PERIODIC_INSPECTION_CATEGORIES.forEach(defaultCategory => {
            const exists = data.periodicInspectionCategories.some(cat => cat.id === defaultCategory.id || cat.name === defaultCategory.name);
            if (!exists) {
                data.periodicInspectionCategories.push({
                    id: defaultCategory.id,
                    name: defaultCategory.name,
                    description: defaultCategory.description || '',
                    defaultFrequency: defaultCategory.defaultFrequency || 'monthly',
                    defaultReminderDays: typeof defaultCategory.defaultReminderDays === 'number' ? defaultCategory.defaultReminderDays : 5,
                    isDefault: true,
                    active: true,
                    createdAt: now,
                    updatedAt: now
                });
            }

            const checklistExists = data.periodicInspectionChecklists.find(list => list.categoryId === defaultCategory.id);
            if (!checklistExists) {
                data.periodicInspectionChecklists.push({
                    id: Utils.generateId('PINCHECK'),
                    categoryId: defaultCategory.id,
                    items: (defaultCategory.checklist || []).map((item, index) => ({
                        id: item.id || Utils.generateId('PINCHECKITEM'),
                        label: item.label,
                        required: item.required !== false,
                        order: typeof item.order === 'number' ? item.order : index
                    })),
                    isDefault: true,
                    createdAt: now,
                    updatedAt: now
                });
            }
        });
    },

    listCategories() {
        this.ensureInitialized();
        const categories = Array.isArray(AppState.appData.periodicInspectionCategories)
            ? AppState.appData.periodicInspectionCategories.slice()
            : [];
        return categories.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar', { sensitivity: 'base' }));
    },

    getCategoryById(categoryId) {
        if (!categoryId) return null;
        this.ensureInitialized();
        return (AppState.appData.periodicInspectionCategories || []).find(cat => cat.id === categoryId) || null;
    },

    upsertCategory(category, options = {}) {
        if (!category) throw new Error('يجب إدخال بيانات الفئة المطلوبة');
        this.ensureInitialized();

        const data = AppState.appData.periodicInspectionCategories;
        const now = new Date().toISOString();
        const normalized = {
            id: category.id || Utils.generateId('PINCATEGORY'),
            name: category.name ? String(category.name).trim() : '',
            description: category.description ? String(category.description).trim() : '',
            defaultFrequency: category.defaultFrequency || 'monthly',
            defaultReminderDays: typeof category.defaultReminderDays === 'number' ? category.defaultReminderDays : 5,
            isDefault: category.isDefault === true,
            active: category.active !== false,
            createdAt: category.createdAt || now,
            updatedAt: now
        };

        if (!normalized.name) {
            throw new Error('يجب إدخال اسم الفئة المطلوبة');
        }

        const duplicate = data.find(cat => cat.id !== normalized.id && cat.name.toLowerCase() === normalized.name.toLowerCase());
        if (duplicate) {
            throw new Error('يوجد فئة بنفس الاسم موجودة مسبقاً');
        }

        const index = data.findIndex(cat => cat.id === normalized.id);
        if (index !== -1) {
            data[index] = normalized;
        } else {
            data.push(normalized);
        }

        DataManager.save();

        if (options.autoSave !== false && GoogleIntegration && typeof GoogleIntegration.autoSave === 'function') {
            GoogleIntegration.autoSave('PeriodicInspectionCategories', data).catch(() => {});
        }

        return normalized;
    },

    deleteCategory(categoryId) {
        if (!categoryId) return false;
        this.ensureInitialized();

        const data = AppState.appData;
        const category = data.periodicInspectionCategories.find(cat => cat.id === categoryId);
        if (!category) {
            throw new Error('الفئة المطلوبة غير موجودة');
        }
        if (category.isDefault) {
            throw new Error('لا يمكن حذف الفئة الافتراضية المحددة مسبقاً');
        }

        const hasRecords = (data.periodicInspectionRecords || []).some(record => record.categoryId === categoryId);
        if (hasRecords) {
            throw new Error('لا يمكن حذف الفئة لأنها تحتوي على سجلات فحوصات مرتبطة بها');
        }
        const hasSchedules = (data.periodicInspectionSchedules || []).some(schedule => schedule.categoryId === categoryId);
        if (hasSchedules) {
            throw new Error('لا يمكن حذف الفئة لأنها تحتوي على جداول فحوصات مرتبطة بها');
        }

        data.periodicInspectionCategories = data.periodicInspectionCategories.filter(cat => cat.id !== categoryId);
        data.periodicInspectionChecklists = data.periodicInspectionChecklists.filter(list => list.categoryId !== categoryId);

        DataManager.save();
        if (GoogleIntegration && typeof GoogleIntegration.autoSave === 'function') {
            GoogleIntegration.autoSave('PeriodicInspectionCategories', data.periodicInspectionCategories).catch(() => {});
            GoogleIntegration.autoSave('PeriodicInspectionChecklists', data.periodicInspectionChecklists).catch(() => {});
        }
        return true;
    },

    listChecklistItems(categoryId) {
        this.ensureInitialized();
        if (!categoryId) return [];
        const checklist = (AppState.appData.periodicInspectionChecklists || []).find(list => list.categoryId === categoryId);
        if (!checklist || !Array.isArray(checklist.items)) return [];
        return checklist.items
            .slice()
            .sort((a, b) => {
                const orderDiff = (a.order || 0) - (b.order || 0);
                if (orderDiff !== 0) return orderDiff;
                return (a.label || '').localeCompare(b.label || '', 'ar', { sensitivity: 'base' });
            });
    },

    setChecklistItems(categoryId, items, options = {}) {
        if (!categoryId) throw new Error('معرف الفئة المطلوب غير محدد');
        this.ensureInitialized();

        const normalizedItems = (items || []).map((item, index) => ({
            id: item.id || Utils.generateId('PINCHECKITEM'),
            label: item.label ? String(item.label).trim() : '',
            required: item.required !== false,
            order: typeof item.order === 'number' ? item.order : index
        })).filter(item => item.label);

        const now = new Date().toISOString();

        let checklist = (AppState.appData.periodicInspectionChecklists || []).find(list => list.categoryId === categoryId);
        if (checklist) {
            checklist.items = normalizedItems;
            checklist.updatedAt = now;
            checklist.isDefault = false;
        } else {
            checklist = {
                id: Utils.generateId('PINCHECK'),
                categoryId,
                items: normalizedItems,
                isDefault: false,
                createdAt: now,
                updatedAt: now
            };
            AppState.appData.periodicInspectionChecklists.push(checklist);
        }

        DataManager.save();
        if (options.autoSave !== false && GoogleIntegration && typeof GoogleIntegration.autoSave === 'function') {
            GoogleIntegration.autoSave('PeriodicInspectionChecklists', AppState.appData.periodicInspectionChecklists).catch(() => {});
        }

        return checklist;
    },

    listSchedules() {
        this.ensureInitialized();
        const schedules = Array.isArray(AppState.appData.periodicInspectionSchedules)
            ? AppState.appData.periodicInspectionSchedules.slice()
            : [];
        return schedules.sort((a, b) => {
            const dateA = a.nextDueDate ? new Date(a.nextDueDate).getTime() : 0;
            const dateB = b.nextDueDate ? new Date(b.nextDueDate).getTime() : 0;
            return dateA - dateB;
        });
    },

    upsertSchedule(schedule, options = {}) {
        if (!schedule) throw new Error('يجب إدخال بيانات الجدول المطلوبة');
        this.ensureInitialized();

        const now = new Date().toISOString();
        const normalized = {
            id: schedule.id || Utils.generateId('PINSCHED'),
            categoryId: schedule.categoryId,
            title: schedule.title ? String(schedule.title).trim() : '',
            responsible: schedule.responsible ? String(schedule.responsible).trim() : '',
            location: schedule.location ? String(schedule.location).trim() : '',
            assetCode: schedule.assetCode ? String(schedule.assetCode).trim() : '',
            frequency: schedule.frequency || schedule.defaultFrequency || 'monthly',
            reminderDays: typeof schedule.reminderDays === 'number'
                ? schedule.reminderDays
                : (this.getCategoryById(schedule.categoryId)?.defaultReminderDays || 5),
            notes: schedule.notes ? String(schedule.notes).trim() : '',
            status: schedule.status || 'pending',
            nextDueDate: schedule.nextDueDate || this.calculateNextDueDate(schedule.frequency, schedule.startDate || now),
            startDate: schedule.startDate || now,
            lastCompletedDate: schedule.lastCompletedDate || null,
            lastResult: schedule.lastResult || null,
            createdAt: schedule.createdAt || now,
            updatedAt: now
        };

        if (!normalized.categoryId) {
            throw new Error('يجب تحديد معرف الفئة المطلوبة');
        }

        const schedules = AppState.appData.periodicInspectionSchedules;
        const index = schedules.findIndex(item => item.id === normalized.id);
        if (index !== -1) {
            schedules[index] = normalized;
        } else {
            schedules.push(normalized);
        }

        DataManager.save();
        if (options.autoSave !== false && GoogleIntegration && typeof GoogleIntegration.autoSave === 'function') {
            GoogleIntegration.autoSave('PeriodicInspectionSchedules', schedules).catch(() => {});
        }

        return normalized;
    },

    deleteSchedule(scheduleId) {
        if (!scheduleId) return false;
        this.ensureInitialized();
        const schedules = AppState.appData.periodicInspectionSchedules || [];
        const exists = schedules.some(schedule => schedule.id === scheduleId);
        if (!exists) {
            throw new Error('الجدول المطلوب غير موجود أو تم حذفه مسبقاً');
        }
        AppState.appData.periodicInspectionSchedules = schedules.filter(schedule => schedule.id !== scheduleId);
        DataManager.save();
        if (GoogleIntegration && typeof GoogleIntegration.autoSave === 'function') {
            GoogleIntegration.autoSave('PeriodicInspectionSchedules', AppState.appData.periodicInspectionSchedules).catch(() => {});
        }
        return true;
    },

    listRecords() {
        this.ensureInitialized();
        const records = Array.isArray(AppState.appData.periodicInspectionRecords)
            ? AppState.appData.periodicInspectionRecords.slice()
            : [];
        return records.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });
    },

    upsertRecord(record, options = {}) {
        if (!record) throw new Error('يجب إدخال بيانات السجل المطلوبة');
        this.ensureInitialized();

        const category = this.getCategoryById(record.categoryId);
        if (!category) {
            throw new Error('الفئة المحددة غير موجودة');
        }

        const now = new Date().toISOString();
        const normalized = {
            id: record.id || Utils.generateId('PINREC'),
            categoryId: category.id,
            categoryName: category.name,
            date: record.date || now,
            responsible: record.responsible ? String(record.responsible).trim() : '',
            supervisor: record.supervisor ? String(record.supervisor).trim() : '',
            location: record.location ? String(record.location).trim() : '',
            assetCode: record.assetCode ? String(record.assetCode).trim() : '',
            internalCode: record.internalCode ? String(record.internalCode).trim() : '',
            notes: record.notes ? String(record.notes).trim() : '',
            result: record.result || 'مطابق',
            status: record.status || (record.result === 'مطابق' ? 'مكتمل' : 'يحتاج إجراء'),
            correctiveActionId: record.correctiveActionId || '',
            correctiveActionSummary: record.correctiveActionSummary || '',
            attachments: Array.isArray(record.attachments) ? record.attachments : [],
            checklistResults: Array.isArray(record.checklistResults) ? record.checklistResults : [],
            scheduleId: record.scheduleId || '',
            nextDueDate: record.nextDueDate || null,
            createdAt: record.createdAt || now,
            updatedAt: now
        };

        const records = AppState.appData.periodicInspectionRecords;
        const index = records.findIndex(item => item.id === normalized.id);
        if (index !== -1) {
            records[index] = normalized;
        } else {
            records.push(normalized);
        }

        DataManager.save();
        if (options.autoSave !== false && GoogleIntegration && typeof GoogleIntegration.autoSave === 'function') {
            GoogleIntegration.autoSave('PeriodicInspectionRecords', records).catch(() => {});
        }

        // تحديث الجدول بعد الفحص
        try {
            this.updateScheduleAfterInspection(normalized, { autoSave: options.autoSave !== false });
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في تحديث الجدول بعد الفحص:', error);
        }

        return normalized;
    },

    deleteRecord(recordId) {
        if (!recordId) return false;
        this.ensureInitialized();
        const records = AppState.appData.periodicInspectionRecords || [];
        const exists = records.some(record => record.id === recordId);
        if (!exists) {
            throw new Error('السجل المطلوب غير موجود أو تم حذفه مسبقاً');
        }
        AppState.appData.periodicInspectionRecords = records.filter(record => record.id !== recordId);

        DataManager.save();
        if (GoogleIntegration && typeof GoogleIntegration.autoSave === 'function') {
            GoogleIntegration.autoSave('PeriodicInspectionRecords', AppState.appData.periodicInspectionRecords).catch(() => {});
        }
        return true;
    },

    calculateNextDueDate(frequency = 'monthly', referenceDate = new Date()) {
        if (!referenceDate) return null;
        const baseDate = new Date(referenceDate);
        if (Number.isNaN(baseDate.getTime())) return null;

        const result = new Date(baseDate);
        switch (frequency) {
            case 'daily':
                result.setDate(result.getDate() + 1);
                break;
            case 'weekly':
                result.setDate(result.getDate() + 7);
                break;
            case 'monthly':
                result.setMonth(result.getMonth() + 1);
                break;
            case 'quarterly':
                result.setMonth(result.getMonth() + 3);
                break;
            case 'semiannual':
                result.setMonth(result.getMonth() + 6);
                break;
            case 'yearly':
            case 'annual':
                result.setFullYear(result.getFullYear() + 1);
                break;
            default:
                result.setMonth(result.getMonth() + 1);
        }
        return result.toISOString();
    },

    updateScheduleAfterInspection(record, options = {}) {
        if (!record) return;
        this.ensureInitialized();
        const schedules = AppState.appData.periodicInspectionSchedules || [];
        if (schedules.length === 0) return;

        let schedule = null;
        if (record.scheduleId) {
            schedule = schedules.find(item => item.id === record.scheduleId);
        }
        if (!schedule) {
            schedule = schedules.find(item =>
                item.categoryId === record.categoryId &&
                (!item.assetCode || !record.assetCode || item.assetCode === record.assetCode) &&
                (!item.responsible || !record.responsible || item.responsible === record.responsible)
            );
        }

        if (!schedule) return;

        schedule.lastCompletedDate = record.date;
        schedule.lastResult = record.result;
        schedule.status = record.result === 'مطابق' ? 'مكتمل' : (record.status || 'pending');
        schedule.nextDueDate = this.calculateNextDueDate(schedule.frequency, record.date);
        schedule.updatedAt = new Date().toISOString();

        DataManager.save();
        if (options.autoSave !== false && GoogleIntegration && typeof GoogleIntegration.autoSave === 'function') {
            GoogleIntegration.autoSave('PeriodicInspectionSchedules', schedules).catch(() => {});
        }
    },

    getUpcomingSchedules(daysAhead = 7) {
        this.ensureInitialized();
        const now = new Date();
        const limitDate = new Date(now);
        limitDate.setDate(limitDate.getDate() + daysAhead);

        return (AppState.appData.periodicInspectionSchedules || []).filter(schedule => {
            if (!schedule.nextDueDate) return false;
            const dueDate = new Date(schedule.nextDueDate);
            if (Number.isNaN(dueDate.getTime())) return false;
            if (dueDate < now) return true;
            return dueDate <= limitDate;
        });
    },

    getNonCompliantRecords() {
        this.ensureInitialized();
        return (AppState.appData.periodicInspectionRecords || []).filter(record => {
            return record.result === 'غير مطابق' ||
                record.result === 'مطابق جزئياً' ||
                record.status === 'يحتاج إجراء';
        });
    },

    getStatistics() {
        this.ensureInitialized();
        const records = AppState.appData.periodicInspectionRecords || [];
        const schedules = AppState.appData.periodicInspectionSchedules || [];
        const categories = this.listCategories();

        const totalRecords = records.length;
        const compliant = records.filter(r => r.result === 'مطابق').length;
        const needsFix = records.filter(r => r.result === 'مطابق جزئياً').length;
        const nonCompliant = records.filter(r => r.result === 'غير مطابق').length;
        const pendingSchedules = schedules.filter(schedule => schedule.status !== 'مكتمل').length;
        const dueSoon = this.getUpcomingSchedules().length;

        return {
            totalRecords,
            compliant,
            needsFix,
            nonCompliant,
            pendingSchedules,
            dueSoon,
            categoriesCount: categories.length
        };
    }
};

// Export to global window (for script tag loading)
if (typeof window !== 'undefined') {
    window.PeriodicInspectionStore = PeriodicInspectionStore;
}

