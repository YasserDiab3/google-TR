/**
 * Google Apps Script for HSE System - PPE Module
 * 
 * موديول معدات الحماية الشخصية - النسخة المحسنة
 */

/**
 * ============================================
 * معدات الحماية الشخصية (PPE)
 * ============================================
 */

/**
 * إضافة معدات الحماية الشخصية (PPE)
 */
function addPPEToSheet(ppeData) {
    try {
        if (!ppeData) {
            return { success: false, message: 'بيانات المعدات غير موجودة' };
        }
        
        const sheetName = 'PPE';
        
        // إضافة حقول تلقائية
        if (!ppeData.id) {
            ppeData.id = generateSequentialId('PPE', sheetName);
        }
        if (!ppeData.createdAt) {
            ppeData.createdAt = new Date();
        }
        if (!ppeData.updatedAt) {
            ppeData.updatedAt = new Date();
        }
        if (!ppeData.status) {
            ppeData.status = 'مستلم';
        }
        
        return appendToSheet(sheetName, ppeData);
    } catch (error) {
        Logger.log('Error in addPPEToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة المعدات: ' + error.toString() };
    }
}

/**
 * تحديث معدات الحماية الشخصية
 */
function updatePPE(ppeId, updateData) {
    try {
        if (!ppeId) {
            return { success: false, message: 'معرف المعدات غير محدد' };
        }
        
        const sheetName = 'PPE';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const ppeIndex = data.findIndex(p => p.id === ppeId);
        
        if (ppeIndex === -1) {
            return { success: false, message: 'المعدات غير موجودة' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[ppeIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating PPE: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث المعدات: ' + error.toString() };
    }
}

/**
 * حذف استلام مهمات الوقاية
 */
function deletePPE(ppeId) {
    try {
        if (!ppeId) {
            return { success: false, message: 'معرف الاستلام غير محدد' };
        }
        
        const sheetName = 'PPE';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود الاستلام قبل الحذف
        const data = readFromSheet(sheetName, spreadsheetId);
        const ppeItem = data.find(p => p.id === ppeId);
        
        if (!ppeItem) {
            return { success: false, message: 'الاستلام غير موجود' };
        }
        
        // ✅ حذف الاستلام باستخدام deleteRowById
        const deleteResult = deleteRowById(sheetName, ppeId, spreadsheetId);
        
        if (!deleteResult.success) {
            return deleteResult;
        }
        
        return { success: true, message: 'تم حذف الاستلام بنجاح' };
    } catch (error) {
        Logger.log('Error in deletePPE: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الاستلام: ' + error.toString() };
    }
}

/**
 * الحصول على جميع معدات الحماية الشخصية
 */
function getAllPPE(filters = {}) {
    try {
        const sheetName = 'PPE';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.employeeCode) {
            data = data.filter(p => p.employeeCode === filters.employeeCode);
        }
        if (filters.equipmentType) {
            data = data.filter(p => p.equipmentType === filters.equipmentType);
        }
        if (filters.status) {
            data = data.filter(p => p.status === filters.status);
        }
        if (filters.startDate) {
            data = data.filter(p => {
                if (!p.receiptDate) return false;
                return new Date(p.receiptDate) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(p => {
                if (!p.receiptDate) return false;
                return new Date(p.receiptDate) <= new Date(filters.endDate);
            });
        }
        
        // ترتيب حسب تاريخ الاستلام
        data.sort((a, b) => {
            const dateA = new Date(a.receiptDate || a.createdAt || 0);
            const dateB = new Date(b.receiptDate || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all PPE: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة المعدات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * مصفوفة معدات الحماية الشخصية (PPE Matrix)
 * ============================================
 */

/**
 * إضافة مصفوفة معدات الحماية الشخصية
 */
function addPPEMatrixToSheet(matrixData) {
    try {
        if (!matrixData) {
            return { success: false, message: 'بيانات المصفوفة غير موجودة' };
        }
        
        const sheetName = 'PPEMatrix';
        
        // إضافة حقول تلقائية
        if (!matrixData.id) {
            matrixData.id = generateSequentialId('PPM', sheetName);
        }
        if (!matrixData.createdAt) {
            matrixData.createdAt = new Date();
        }
        if (!matrixData.updatedAt) {
            matrixData.updatedAt = new Date();
        }
        if (!matrixData.lastUpdated) {
            matrixData.lastUpdated = new Date();
        }
        
        return appendToSheet(sheetName, matrixData);
    } catch (error) {
        Logger.log('Error in addPPEMatrixToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة المصفوفة: ' + error.toString() };
    }
}

/**
 * تحديث مصفوفة معدات الحماية الشخصية
 */
function updatePPEMatrix(employeeId, updateData) {
    try {
        if (!employeeId) {
            return { success: false, message: 'معرف الموظف غير محدد' };
        }
        
        const sheetName = 'PPEMatrix';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const matrixIndex = data.findIndex(m => m.employeeId === employeeId);
        
        if (matrixIndex === -1) {
            return { success: false, message: 'مصفوفة المعدات غير موجودة' };
        }
        
        updateData.updatedAt = new Date();
        updateData.lastUpdated = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[matrixIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating PPE matrix: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث المصفوفة: ' + error.toString() };
    }
}

/**
 * الحصول على مصفوفة معدات الحماية الشخصية لموظف
 */
function getPPEMatrix(employeeId) {
    try {
        if (!employeeId) {
            return { success: false, message: 'معرف الموظف غير محدد' };
        }
        
        const sheetName = 'PPEMatrix';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const matrix = data.find(m => m.employeeId === employeeId);
        
        if (!matrix) {
            return { success: false, message: 'مصفوفة المعدات غير موجودة' };
        }
        
        return { success: true, data: matrix };
    } catch (error) {
        Logger.log('Error getting PPE matrix: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة المصفوفة: ' + error.toString() };
    }
}

/**
 * الحصول على جميع مصفوفات معدات الحماية الشخصية
 */
function getAllPPEMatrices(filters = {}) {
    try {
        const sheetName = 'PPEMatrix';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.department) {
            data = data.filter(m => m.department === filters.department);
        }
        if (filters.position) {
            data = data.filter(m => m.position === filters.position);
        }
        
        // ترتيب حسب آخر تحديث
        data.sort((a, b) => {
            const dateA = new Date(a.lastUpdated || a.updatedAt || a.createdAt || 0);
            const dateB = new Date(b.lastUpdated || b.updatedAt || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all PPE matrices: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة المصفوفات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * إدارة مخزون مهمات الوقاية (PPE Stock Control)
 * ============================================
 */

/**
 * حساب الرصيد التلقائي من الحركات
 */
function calculateStockBalance(itemId) {
    try {
        const sheetName = 'PPE_Transactions';
        let transactions = readFromSheet(sheetName, getSpreadsheetId());
        
        // تصفية الحركات للصنف المحدد
        transactions = transactions.filter(t => t.itemId === itemId);
        
        let balance = 0;
        transactions.forEach(transaction => {
            if (transaction.action === 'IN') {
                balance += parseFloat(transaction.quantity || 0);
            } else if (transaction.action === 'OUT') {
                balance -= parseFloat(transaction.quantity || 0);
            }
        });
        
        return balance;
    } catch (error) {
        Logger.log('Error calculating stock balance: ' + error.toString());
        return 0;
    }
}

/**
 * إضافة/تحديث صنف في المخزون
 */
function addOrUpdatePPEStockItem(stockData) {
    try {
        if (!stockData) {
            return { success: false, message: 'بيانات المخزون غير موجودة' };
        }
        
        const sheetName = 'PPE_Stock';
        const spreadsheetId = getSpreadsheetId();
        let data = readFromSheet(sheetName, spreadsheetId);
        
        // التحقق من وجود الصنف
        const itemIndex = data.findIndex(item => item.itemId === stockData.itemId);
        
        if (itemIndex === -1) {
            // إضافة جديد
            // ✅ التحقق من عدم تكرار كود الصنف
            if (stockData.itemCode) {
                const existingItem = data.find(item => 
                    item.itemCode && 
                    String(item.itemCode).trim().toLowerCase() === String(stockData.itemCode).trim().toLowerCase()
                );
                if (existingItem) {
                    return { 
                        success: false, 
                        message: 'كود الصنف موجود بالفعل. يرجى استخدام كود آخر.' 
                    };
                }
            }
            
            // ✅ التحقق من عدم تكرار اسم الصنف
            if (stockData.itemName) {
                const existingItemByName = data.find(item => 
                    item.itemName && 
                    String(item.itemName).trim().toLowerCase() === String(stockData.itemName).trim().toLowerCase()
                );
                if (existingItemByName) {
                    return { 
                        success: false, 
                        message: 'اسم الصنف موجود بالفعل. يرجى استخدام اسم آخر.' 
                    };
                }
            }
            
            if (!stockData.itemId) {
                stockData.itemId = generateSequentialId('PPS', sheetName);
            }
            if (!stockData.createdAt) {
                stockData.createdAt = new Date();
            }
            if (!stockData.updatedAt) {
                stockData.updatedAt = new Date();
            }
            if (!stockData.lastUpdate) {
                stockData.lastUpdate = new Date();
            }
            
            // حساب الرصيد التلقائي
            stockData.balance = calculateStockBalance(stockData.itemId);
            
            return appendToSheet(sheetName, stockData);
        } else {
            // تحديث موجود
            // ✅ التحقق من عدم تكرار كود الصنف عند التحديث (إذا تم تغييره)
            if (stockData.itemCode) {
                const existingItem = data.find((item, index) => 
                    index !== itemIndex && // استثناء الصنف الحالي
                    item.itemCode && 
                    String(item.itemCode).trim().toLowerCase() === String(stockData.itemCode).trim().toLowerCase()
                );
                if (existingItem) {
                    return { 
                        success: false, 
                        message: 'كود الصنف موجود بالفعل في صنف آخر. يرجى استخدام كود آخر.' 
                    };
                }
            }
            
            // ✅ التحقق من عدم تكرار اسم الصنف عند التحديث (إذا تم تغييره)
            if (stockData.itemName) {
                const existingItemByName = data.find((item, index) => 
                    index !== itemIndex && // استثناء الصنف الحالي
                    item.itemName && 
                    String(item.itemName).trim().toLowerCase() === String(stockData.itemName).trim().toLowerCase()
                );
                if (existingItemByName) {
                    return { 
                        success: false, 
                        message: 'اسم الصنف موجود بالفعل في صنف آخر. يرجى استخدام اسم آخر.' 
                    };
                }
            }
            
            stockData.updatedAt = new Date();
            stockData.lastUpdate = new Date();
            
            // حساب الرصيد التلقائي من الحركات
            stockData.balance = calculateStockBalance(stockData.itemId);
            
            // تحديث البيانات
            for (var key in stockData) {
                if (stockData.hasOwnProperty(key) && key !== 'itemId') {
                    data[itemIndex][key] = stockData[key];
                }
            }
            
            return saveToSheet(sheetName, data, spreadsheetId);
        }
    } catch (error) {
        Logger.log('Error in addOrUpdatePPEStockItem: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة/تحديث المخزون: ' + error.toString() };
    }
}

/**
 * الحصول على جميع أصناف المخزون
 * ✅ محسّن: قراءة الحركات مرة واحدة فقط بدلاً من N مرة
 */
function getAllPPEStockItems(filters = {}) {
    try {
        const sheetName = 'PPE_Stock';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // ✅ تحسين الأداء: قراءة جميع الحركات مرة واحدة فقط قبل الحلقة
        const allTransactions = readFromSheet('PPE_Transactions', getSpreadsheetId());
        
        // إنشاء خريطة للحركات لكل صنف لتسريع البحث
        const transactionsByItemId = {};
        allTransactions.forEach(t => {
            if (!t.itemId) return;
            if (!transactionsByItemId[t.itemId]) {
                transactionsByItemId[t.itemId] = [];
            }
            transactionsByItemId[t.itemId].push(t);
        });
        
        // تحديث الرصيد لكل صنف من الحركات (باستخدام الخريطة المحضرة)
        data = data.map(item => {
            const itemId = item.itemId;
            const itemTransactions = transactionsByItemId[itemId] || [];
            
            let stockIn = 0;
            let stockOut = 0;
            
            itemTransactions.forEach(t => {
                if (t.action === 'IN') {
                    stockIn += parseFloat(t.quantity || 0);
                } else if (t.action === 'OUT') {
                    stockOut += parseFloat(t.quantity || 0);
                }
            });
            
            item.stock_IN = stockIn;
            item.stock_OUT = stockOut;
            item.balance = stockIn - stockOut;
            
            return item;
        });
        
        // تطبيق الفلاتر
        if (filters.category) {
            data = data.filter(item => item.category === filters.category);
        }
        if (filters.supplier) {
            data = data.filter(item => item.supplier === filters.supplier);
        }
        if (filters.lowStock) {
            data = data.filter(item => {
                const balance = parseFloat(item.balance || 0);
                const minThreshold = parseFloat(item.minThreshold || 0);
                return balance < minThreshold;
            });
        }
        
        // ترتيب حسب اسم الصنف
        data.sort((a, b) => {
            const nameA = (a.itemName || '').toLowerCase();
            const nameB = (b.itemName || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all PPE stock items: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة المخزون: ' + error.toString(), data: [] };
    }
}

/**
 * الحصول على أصناف المخزون المنخفضة
 */
function getLowStockItems() {
    try {
        const result = getAllPPEStockItems({ lowStock: true });
        return result;
    } catch (error) {
        Logger.log('Error getting low stock items: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة المخزون المنخفض: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة حركة جديدة (وارد/منصرف)
 */
function addPPETransaction(transactionData) {
    try {
        if (!transactionData) {
            return { success: false, message: 'بيانات الحركة غير موجودة' };
        }
        
        const sheetName = 'PPE_Transactions';
        
        // إضافة حقول تلقائية
        if (!transactionData.id) {
            transactionData.id = generateSequentialId('PPT', sheetName);
        }
        if (!transactionData.date) {
            transactionData.date = new Date();
        }
        if (!transactionData.createdAt) {
            transactionData.createdAt = new Date();
        }
        if (!transactionData.updatedAt) {
            transactionData.updatedAt = new Date();
        }
        
        // إضافة الحركة
        const result = appendToSheet(sheetName, transactionData);
        
        if (result.success) {
            // تحديث الرصيد في جدول المخزون
            const stockSheet = 'PPE_Stock';
            const spreadsheetId = getSpreadsheetId();
            let stockData = readFromSheet(stockSheet, spreadsheetId);
            
            const stockItemIndex = stockData.findIndex(item => item.itemId === transactionData.itemId);
            if (stockItemIndex !== -1) {
                // تحديث الرصيد تلقائياً
                stockData[stockItemIndex].balance = calculateStockBalance(transactionData.itemId);
                stockData[stockItemIndex].lastUpdate = new Date();
                stockData[stockItemIndex].updatedAt = new Date();
                
                // تحديث الوارد والمنصرف
                const transactions = readFromSheet('PPE_Transactions', spreadsheetId);
                const itemTransactions = transactions.filter(t => t.itemId === transactionData.itemId);
                
                let stockIn = 0;
                let stockOut = 0;
                
                itemTransactions.forEach(t => {
                    if (t.action === 'IN') {
                        stockIn += parseFloat(t.quantity || 0);
                    } else if (t.action === 'OUT') {
                        stockOut += parseFloat(t.quantity || 0);
                    }
                });
                
                stockData[stockItemIndex].stock_IN = stockIn;
                stockData[stockItemIndex].stock_OUT = stockOut;
                
                saveToSheet(stockSheet, stockData, spreadsheetId);
            }
        }
        
        return result;
    } catch (error) {
        Logger.log('Error in addPPETransaction: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الحركة: ' + error.toString() };
    }
}

/**
 * حذف صنف من المخزون
 */
function deletePPEStockItem(itemId) {
    try {
        if (!itemId) {
            return { success: false, message: 'معرف الصنف غير محدد' };
        }
        
        const sheetName = 'PPE_Stock';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود الصنف قبل الحذف
        const data = readFromSheet(sheetName, spreadsheetId);
        const stockItem = data.find(item => item.itemId === itemId);
        
        if (!stockItem) {
            return { success: false, message: 'الصنف غير موجود' };
        }
        
        // ✅ التحقق من وجود حركات مرتبطة بالصنف
        const transactions = readFromSheet('PPE_Transactions', spreadsheetId);
        const itemTransactions = transactions.filter(t => t.itemId === itemId);
        
        if (itemTransactions.length > 0) {
            return { 
                success: false, 
                message: 'لا يمكن حذف الصنف لأنه يحتوي على ' + itemTransactions.length + ' حركة مسجلة. يرجى حذف الحركات أولاً أو إلغاء تفعيل الصنف بدلاً من حذفه.' 
            };
        }
        
        // ✅ حذف الصنف باستخدام deleteRowByField (لأن PPE_Stock يستخدم itemId وليس id)
        const deleteResult = deleteRowByField(sheetName, 'itemId', itemId, spreadsheetId);
        
        if (!deleteResult.success) {
            return deleteResult;
        }
        
        return { success: true, message: 'تم حذف الصنف بنجاح' };
    } catch (error) {
        Logger.log('Error in deletePPEStockItem: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الصنف: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الحركات
 */
function getAllPPETransactions(filters = {}) {
    try {
        const sheetName = 'PPE_Transactions';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.itemId) {
            data = data.filter(t => t.itemId === filters.itemId);
        }
        if (filters.action) {
            data = data.filter(t => t.action === filters.action);
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
        Logger.log('Error getting all PPE transactions: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الحركات: ' + error.toString(), data: [] };
    }
}

/**
 * الحصول على قائمة أصناف مهمات الوقاية للمنسدلة
 */
function getPPEItemsList() {
    try {
        const stockResult = getAllPPEStockItems();
        if (!stockResult.success) {
            return { success: false, message: stockResult.message, data: [] };
        }
        
        // أيضاً جمع الأصناف من جدول PPE الموجود
        const ppeSheet = 'PPE';
        let ppeData = [];
        try {
            ppeData = readFromSheet(ppeSheet, getSpreadsheetId());
        } catch (error) {
            Logger.log('Note: Could not read PPE sheet for items list: ' + error.toString());
        }
        
        // جمع الأنواع الفريدة من PPE
        const uniqueTypes = new Set();
        ppeData.forEach(item => {
            if (item.equipmentType) {
                uniqueTypes.add(item.equipmentType);
            }
        });
        
        // دمج الأصناف من المخزون والأصناف الموجودة
        const items = [];
        stockResult.data.forEach(item => {
            items.push({
                itemId: item.itemId,
                itemCode: item.itemCode || '',
                itemName: item.itemName || '',
                category: item.category || ''
            });
        });
        
        uniqueTypes.forEach(type => {
            // التحقق من عدم التكرار
            if (!items.some(item => item.itemName === type)) {
                items.push({
                    itemId: null,
                    itemCode: '',
                    itemName: type,
                    category: ''
                });
            }
        });
        
        return { success: true, data: items };
    } catch (error) {
        Logger.log('Error getting PPE items list: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة قائمة الأصناف: ' + error.toString(), data: [] };
    }
}

