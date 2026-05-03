/**
 * Google Apps Script for HSE System - Budget Module
 * 
 * موديول الميزانية - النسخة المحسنة
 */

/**
 * ============================================
 * الميزانية العامة (Budget)
 * ============================================
 */

/**
 * إضافة ميزانية
 */
function addBudgetToSheet(budgetData) {
    try {
        if (!budgetData) {
            return { success: false, message: 'بيانات الميزانية غير موجودة' };
        }
        
        // محاولة تحديد نوع الورقة من البيانات
        let sheetName = 'Budget';
        if (budgetData && budgetData.category && (budgetData.category.includes('سلامة') || budgetData.category.includes('safety'))) {
            sheetName = 'SafetyBudget';
        }
        
        // إضافة حقول تلقائية
        if (!budgetData.id) {
            budgetData.id = generateSequentialId('SAB', sheetName);
        }
        if (!budgetData.createdAt) {
            budgetData.createdAt = new Date();
        }
        if (!budgetData.updatedAt) {
            budgetData.updatedAt = new Date();
        }
        if (!budgetData.status) {
            budgetData.status = 'مقترح';
        }
        
        return appendToSheet(sheetName, budgetData);
    } catch (error) {
        Logger.log('Error in addBudgetToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الميزانية: ' + error.toString() };
    }
}

/**
 * تحديث ميزانية
 */
function updateBudget(budgetId, updateData) {
    try {
        if (!budgetId) {
            return { success: false, message: 'معرف الميزانية غير محدد' };
        }
        
        const sheetName = 'Budget';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const budgetIndex = data.findIndex(b => b.id === budgetId);
        
        if (budgetIndex === -1) {
            return { success: false, message: 'الميزانية غير موجودة' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[budgetIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating budget: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الميزانية: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الميزانيات
 */
function getAllBudgets(filters = {}) {
    try {
        const sheetName = 'Budget';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.category) {
            data = data.filter(b => b.category === filters.category);
        }
        if (filters.status) {
            data = data.filter(b => b.status === filters.status);
        }
        if (filters.year) {
            data = data.filter(b => b.year === filters.year);
        }
        
        // ترتيب حسب السنة
        data.sort((a, b) => {
            return (b.year || 0) - (a.year || 0);
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all budgets: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الميزانيات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * ميزانية السلامة (Safety Budgets)
 * ============================================
 */

/**
 * إضافة ميزانية سلامة
 */
function addSafetyBudgetsToSheet(budgetData) {
    try {
        if (!budgetData) {
            return { success: false, message: 'بيانات الميزانية غير موجودة' };
        }
        
        const sheetName = 'SafetyBudgets';
        
        // إضافة حقول تلقائية
        if (!budgetData.id) {
            budgetData.id = generateSequentialId('SAB', sheetName);
        }
        if (!budgetData.createdAt) {
            budgetData.createdAt = new Date();
        }
        if (!budgetData.updatedAt) {
            budgetData.updatedAt = new Date();
        }
        if (!budgetData.status) {
            budgetData.status = 'مقترح';
        }
        
        return appendToSheet(sheetName, budgetData);
    } catch (error) {
        Logger.log('Error in addSafetyBudgetsToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الميزانية: ' + error.toString() };
    }
}

/**
 * تحديث ميزانية سلامة
 */
function updateSafetyBudget(budgetId, updateData) {
    try {
        if (!budgetId) {
            return { success: false, message: 'معرف الميزانية غير محدد' };
        }
        
        const sheetName = 'SafetyBudgets';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const budgetIndex = data.findIndex(b => b.id === budgetId);
        
        if (budgetIndex === -1) {
            return { success: false, message: 'الميزانية غير موجودة' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[budgetIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating safety budget: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الميزانية: ' + error.toString() };
    }
}

/**
 * الحصول على جميع ميزانيات السلامة
 */
function getAllSafetyBudgets(filters = {}) {
    try {
        const sheetName = 'SafetyBudgets';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.category) {
            data = data.filter(b => b.category === filters.category);
        }
        if (filters.status) {
            data = data.filter(b => b.status === filters.status);
        }
        if (filters.year) {
            data = data.filter(b => b.year === filters.year);
        }
        
        // ترتيب حسب السنة
        data.sort((a, b) => {
            return (b.year || 0) - (a.year || 0);
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all safety budgets: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الميزانيات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * معاملات ميزانية السلامة (Safety Budget Transactions)
 * ============================================
 */

/**
 * إضافة معاملة ميزانية سلامة
 */
function addSafetyBudgetTransactionToSheet(transactionData) {
    try {
        if (!transactionData) {
            return { success: false, message: 'بيانات المعاملة غير موجودة' };
        }
        
        const sheetName = 'SafetyBudgetTransactions';
        
        // إضافة حقول تلقائية
        if (!transactionData.id) {
            transactionData.id = generateSequentialId('SBT', sheetName);
        }
        if (!transactionData.createdAt) {
            transactionData.createdAt = new Date();
        }
        if (!transactionData.updatedAt) {
            transactionData.updatedAt = new Date();
        }
        if (!transactionData.status) {
            transactionData.status = 'مكتمل';
        }
        
        return appendToSheet(sheetName, transactionData);
    } catch (error) {
        Logger.log('Error in addSafetyBudgetTransactionToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة المعاملة: ' + error.toString() };
    }
}

/**
 * تحديث معاملة ميزانية سلامة
 */
function updateSafetyBudgetTransaction(transactionId, updateData) {
    try {
        if (!transactionId) {
            return { success: false, message: 'معرف المعاملة غير محدد' };
        }
        
        const sheetName = 'SafetyBudgetTransactions';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const transactionIndex = data.findIndex(t => t.id === transactionId);
        
        if (transactionIndex === -1) {
            return { success: false, message: 'المعاملة غير موجودة' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[transactionIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating safety budget transaction: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث المعاملة: ' + error.toString() };
    }
}

/**
 * الحصول على جميع معاملات ميزانية السلامة
 */
function getAllSafetyBudgetTransactions(filters = {}) {
    try {
        const sheetName = 'SafetyBudgetTransactions';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.budgetId) {
            data = data.filter(t => t.budgetId === filters.budgetId);
        }
        if (filters.category) {
            data = data.filter(t => t.category === filters.category);
        }
        if (filters.status) {
            data = data.filter(t => t.status === filters.status);
        }
        if (filters.startDate) {
            data = data.filter(t => {
                if (!t.date) return false;
                return new Date(t.date) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(t => {
                if (!t.date) return false;
                return new Date(t.date) <= new Date(filters.endDate);
            });
        }
        
        // ترتيب حسب التاريخ
        data.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0);
            const dateB = new Date(b.date || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all safety budget transactions: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة المعاملات: ' + error.toString(), data: [] };
    }
}

/**
 * الحصول على إحصائيات الميزانية
 */
function getBudgetStatistics(filters = {}) {
    try {
        const budgets = getAllSafetyBudgets(filters);
        const transactions = getAllSafetyBudgetTransactions(filters);
        
        if (!budgets.success || !transactions.success) {
            return { success: false, message: 'فشل في قراءة البيانات' };
        }
        
        let totalBudget = 0;
        let totalSpent = 0;
        let totalRemaining = 0;
        const byCategory = {};
        
        budgets.data.forEach(budget => {
            const amount = parseFloat(budget.amount || budget.budgetAmount || 0);
            totalBudget += amount;
            
            const category = budget.category || 'غير محدد';
            if (!byCategory[category]) {
                byCategory[category] = { budget: 0, spent: 0 };
            }
            byCategory[category].budget += amount;
        });
        
        transactions.data.forEach(transaction => {
            const amount = parseFloat(transaction.amount || 0);
            totalSpent += amount;
            
            const category = transaction.category || 'غير محدد';
            if (!byCategory[category]) {
                byCategory[category] = { budget: 0, spent: 0 };
            }
            byCategory[category].spent += amount;
        });
        
        totalRemaining = totalBudget - totalSpent;
        
        // حساب النسب المئوية
        Object.keys(byCategory).forEach(category => {
            byCategory[category].remaining = byCategory[category].budget - byCategory[category].spent;
            byCategory[category].percentage = byCategory[category].budget > 0 
                ? (byCategory[category].spent / byCategory[category].budget) * 100 
                : 0;
        });
        
        return {
            success: true,
            data: {
                totalBudget: totalBudget,
                totalSpent: totalSpent,
                totalRemaining: totalRemaining,
                utilizationPercentage: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
                byCategory: byCategory
            }
        };
    } catch (error) {
        Logger.log('Error getting budget statistics: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حساب الإحصائيات: ' + error.toString() };
    }
}

