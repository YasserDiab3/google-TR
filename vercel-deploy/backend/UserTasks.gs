/**
 * Google Apps Script for HSE System - User Tasks Module
 * 
 * موديول مهام المستخدمين - User Sub Dashboard
 * يدير المهام والتعليمات الموجهة للمستخدمين
 */

/**
 * ============================================
 * إدارة مهام المستخدمين (User Tasks Management)
 * ============================================
 */

/**
 * إضافة مهمة جديدة للمستخدمين
 * @param {Object} taskData - بيانات المهمة
 * @return {Object} - نتيجة العملية
 */
function addUserTask(taskData) {
    try {
        if (!taskData) {
            return { success: false, message: 'بيانات المهمة غير موجودة' };
        }
        
        const sheetName = 'UserTasks';
        
        // إضافة حقول تلقائية
        if (!taskData.id) {
            taskData.id = Utilities.getUuid();
        }
        if (!taskData.createdAt) {
            taskData.createdAt = new Date();
        }
        if (!taskData.updatedAt) {
            taskData.updatedAt = new Date();
        }
        if (!taskData.status) {
            taskData.status = 'قيد التنفيذ';
        }
        if (!taskData.priority) {
            taskData.priority = 'متوسط';
        }
        if (taskData.completionRate === undefined || taskData.completionRate === null) {
            taskData.completionRate = 0;
        }
        
        // معالجة assignedTo - يمكن أن يكون all أو userId أو array من userIds أو department
        if (taskData.assignedTo === 'all' || taskData.assignedTo === 'جميع المستخدمين') {
            taskData.assignedTo = 'all';
        }
        
        // ✅ assignedTo و assignedDepartments - دع toSheetCellValue_() تتعامل معها
        // لا حاجة لـ JSON.stringify - سيتم تحويلها تلقائياً
        
        return appendToSheet(sheetName, taskData);
    } catch (error) {
        Logger.log('Error in addUserTask: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة المهمة: ' + error.toString() };
    }
}

/**
 * تحديث مهمة موجودة
 * @param {string} taskId - معرف المهمة
 * @param {Object} updateData - بيانات التحديث
 * @return {Object} - نتيجة العملية
 */
function updateUserTask(taskId, updateData) {
    try {
        if (!taskId) {
            return { success: false, message: 'معرف المهمة غير موجود' };
        }
        
        const sheetName = 'UserTasks';
        const spreadsheetId = getSpreadsheetId();
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        let taskIndex = -1;
        for (let i = 0; i < data.length; i++) {
            if (data[i].id === taskId) {
                taskIndex = i;
                break;
            }
        }
        
        if (taskIndex === -1) {
            return { success: false, message: 'المهمة غير موجودة' };
        }
        
        // تحديث البيانات
        updateData.updatedAt = new Date();
        
        // إذا كانت الحالة مكتمل ومعدل الإنجاز 100%
        if (updateData.status === 'مكتمل' || updateData.status === 'completed') {
            if (!updateData.completedDate) {
                updateData.completedDate = new Date();
            }
            updateData.completionRate = 100;
        }
        
        // معالجة assignedTo
        if (updateData.assignedTo !== undefined) {
            if (updateData.assignedTo === 'all' || updateData.assignedTo === 'جميع المستخدمين') {
                updateData.assignedTo = 'all';
            }
            // ✅ لا حاجة لـ JSON.stringify
        }
        
        // ✅ معالجة assignedDepartments - لا حاجة لـ JSON.stringify
        
        // ✅ تحديث الصف مباشرة بدون إعادة كتابة الجدول بالكامل
        updateData.updatedAt = new Date().toISOString();
        return updateSingleRowInSheet(sheetName, taskId, updateData, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating user task: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء التحديث: ' + error.toString() };
    }
}

/**
 * تحديث معدل إنجاز مهمة من قبل المستخدم
 * @param {string} taskId - معرف المهمة
 * @param {number} completionRate - معدل الإنجاز (0-100)
 * @param {string} userId - معرف المستخدم
 * @return {Object} - نتيجة العملية
 */
function updateTaskCompletionRate(taskId, completionRate, userId) {
    try {
        if (!taskId) {
            return { success: false, message: 'معرف المهمة غير موجود' };
        }
        
        if (completionRate === undefined || completionRate === null) {
            return { success: false, message: 'معدل الإنجاز غير محدد' };
        }
        
        completionRate = parseFloat(completionRate);
        if (isNaN(completionRate) || completionRate < 0 || completionRate > 100) {
            return { success: false, message: 'معدل الإنجاز يجب أن يكون بين 0 و 100' };
        }
        
        const sheetName = 'UserTasks';
        const spreadsheetId = getSpreadsheetId();
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        let taskIndex = -1;
        for (let i = 0; i < data.length; i++) {
            if (data[i].id === taskId) {
                taskIndex = i;
                break;
            }
        }
        
        if (taskIndex === -1) {
            return { success: false, message: 'المهمة غير موجودة' };
        }
        
        const task = data[taskIndex];
        
        // التحقق من أن المستخدم له صلاحية تحديث هذه المهمة
        const userHasAccess = checkUserTaskAccess(task, userId);
        if (!userHasAccess) {
            return { success: false, message: 'ليس لديك صلاحية لتحديث هذه المهمة' };
        }
        
        // تحديث معدل الإنجاز
        task.completionRate = completionRate;
        task.updatedAt = new Date();
        
        // تحديث الحالة بناءً على معدل الإنجاز
        if (completionRate >= 100) {
            task.status = 'مكتمل';
            task.completedDate = new Date();
        } else if (completionRate > 0) {
            task.status = 'قيد التنفيذ';
        }
        
        // حفظ التحديثات الخاصة بالمستخدم
        if (!task.userProgress) {
            task.userProgress = '{}';
        }
        let userProgress = {};
        try {
            userProgress = JSON.parse(task.userProgress);
        } catch (e) {
            userProgress = {};
        }
        if (!userProgress[userId]) {
            userProgress[userId] = {};
        }
        userProgress[userId].completionRate = completionRate;
        userProgress[userId].updatedAt = new Date();
        // ✅ userProgress كـ object (سيتم تحويله تلقائياً)
        task.userProgress = userProgress;
        
        // ✅ تحديث الصف مباشرة
        return updateSingleRowInSheet(sheetName, taskId, {
            userProgress: userProgress,
            updatedAt: new Date().toISOString()
        }, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating task completion rate: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث معدل الإنجاز: ' + error.toString() };
    }
}

/**
 * التحقق من صلاحية المستخدم للوصول إلى المهمة
 * @param {Object} task - بيانات المهمة
 * @param {string} userId - معرف المستخدم
 * @return {boolean} - true إذا كان للمستخدم صلاحية الوصول
 */
function checkUserTaskAccess(task, userId) {
    try {
        // إذا كانت المهمة لجميع المستخدمين
        if (task.assignedTo === 'all' || task.assignedTo === 'جميع المستخدمين') {
            return true;
        }
        
        // إذا كانت المهمة معينة لمستخدم محدد
        if (task.assignedTo === userId) {
            return true;
        }
        
        // إذا كان assignedTo array أو JSON string
        let assignedUsers = [];
        if (typeof task.assignedTo === 'string') {
            try {
                assignedUsers = JSON.parse(task.assignedTo);
                if (Array.isArray(assignedUsers) && assignedUsers.includes(userId)) {
                    return true;
                }
            } catch (e) {
                // ليس JSON، جرب كـ string عادي
                if (task.assignedTo === userId) {
                    return true;
                }
            }
        }
        
        // التحقق من الإدارات (إذا كان المستخدم في إدارة مستهدفة)
        // ملاحظة: يتطلب بيانات المستخدم من ورقة Users
        if (task.assignedDepartments) {
            let departments = [];
            try {
                if (typeof task.assignedDepartments === 'string') {
                    departments = JSON.parse(task.assignedDepartments);
                } else if (Array.isArray(task.assignedDepartments)) {
                    departments = task.assignedDepartments;
                }
            } catch (e) {
                // ليس JSON
            }
            
            if (departments.length > 0) {
                // الحصول على بيانات المستخدم للتحقق من الإدارة
                const usersData = readFromSheet('Users', getSpreadsheetId());
                const user = usersData.find(u => u.id === userId);
                if (user && user.department) {
                    if (departments.includes(user.department)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    } catch (error) {
        Logger.log('Error checking user task access: ' + error.toString());
        return false;
    }
}

/**
 * الحصول على جميع المهام (للمدير)
 * @return {Object} - قائمة المهام
 */
function getAllUserTasks() {
    try {
        const sheetName = 'UserTasks';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        
        // معالجة البيانات - تحويل JSON strings إلى objects (محسّنة)
        const processedData = [];
        for (let i = 0; i < data.length; i++) {
            const task = data[i];
            const processed = Object.assign({}, task);
            
            // معالجة assignedTo
            if (processed.assignedTo && processed.assignedTo !== 'all') {
                try {
                    const parsed = JSON.parse(processed.assignedTo);
                    if (Array.isArray(parsed)) {
                        processed.assignedTo = parsed;
                    }
                } catch (e) {
                    // ليس JSON، نبقيه كما هو
                }
            }
            
            // معالجة assignedDepartments
            if (processed.assignedDepartments) {
                try {
                    const parsed = JSON.parse(processed.assignedDepartments);
                    if (Array.isArray(parsed)) {
                        processed.assignedDepartments = parsed;
                    }
                } catch (e) {
                    // ليس JSON
                }
            }
            
            // معالجة userProgress
            if (processed.userProgress) {
                try {
                    processed.userProgress = JSON.parse(processed.userProgress);
                } catch (e) {
                    processed.userProgress = {};
                }
            }
            
            processedData.push(processed);
        }
        
        return { success: true, data: processedData };
    } catch (error) {
        Logger.log('Error getting all user tasks: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على المهام: ' + error.toString(), data: [] };
    }
}

/**
 * الحصول على مهام مستخدم محدد
 * @param {string} userId - معرف المستخدم
 * @return {Object} - قائمة المهام
 */
function getUserTasksByUserId(userId) {
    try {
        if (!userId) {
            return { success: false, message: 'معرف المستخدم غير موجود', data: [] };
        }
        
        const sheetName = 'UserTasks';
        const spreadsheetId = getSpreadsheetId();
        const allData = readFromSheet(sheetName, spreadsheetId);
        
        // قراءة بيانات المستخدمين من الـ cache أو من الـ sheet
        // استخدام cache لمدة 120 ثانية (دقيقتان) لأن بيانات المستخدمين لا تتغير كثيراً
        let usersData = getCachedData('users_data', 120);
        let userDepartment = null;
        
        // فلترة المهام المتاحة للمستخدم
        const userTasks = [];
        
        for (let i = 0; i < allData.length; i++) {
            const task = allData[i];
            let hasAccess = false;
            
            // التحقق من الصلاحية بطريقة محسّنة (inline بدون استدعاء دالة منفصلة)
            // 1. إذا كانت المهمة لجميع المستخدمين
            if (task.assignedTo === 'all' || task.assignedTo === 'جميع المستخدمين') {
                hasAccess = true;
            }
            // 2. إذا كانت المهمة معينة للمستخدم مباشرة
            else if (task.assignedTo === userId) {
                hasAccess = true;
            }
            // 3. إذا كان assignedTo array أو JSON string
            else if (task.assignedTo && typeof task.assignedTo === 'string') {
                try {
                    const assignedUsers = JSON.parse(task.assignedTo);
                    if (Array.isArray(assignedUsers) && assignedUsers.indexOf(userId) !== -1) {
                        hasAccess = true;
                    }
                } catch (e) {
                    // ليس JSON، تحقق مباشر
                    if (task.assignedTo === userId) {
                        hasAccess = true;
                    }
                }
            }
            
            // 4. التحقق من الإدارات (فقط إذا لم يتم العثور على صلاحية بعد)
            if (!hasAccess && task.assignedDepartments) {
                // قراءة بيانات المستخدمين من الـ cache أو من الـ sheet
                if (usersData === null) {
                    usersData = readFromSheet('Users', spreadsheetId);
                    // حفظ في الـ cache لـ 120 ثانية
                    setCachedData('users_data', usersData);
                }
                
                // الحصول على قسم المستخدم من الـ cache
                if (userDepartment === null && usersData) {
                    const currentUser = usersData.find(function(u) { return u.id === userId; });
                    userDepartment = currentUser ? currentUser.department : null;
                }
                
                if (userDepartment) {
                    try {
                        let departments = [];
                        if (typeof task.assignedDepartments === 'string') {
                            departments = JSON.parse(task.assignedDepartments);
                        } else if (Array.isArray(task.assignedDepartments)) {
                            departments = task.assignedDepartments;
                        }
                        
                        if (departments.indexOf(userDepartment) !== -1) {
                            hasAccess = true;
                        }
                    } catch (e) {
                        // ليس JSON، تجاهل
                    }
                }
            }
            
            // إذا كان للمستخدم صلاحية، أضف المهمة
            if (hasAccess) {
                const processed = Object.assign({}, task);
                
                // معالجة assignedTo
                if (processed.assignedTo && processed.assignedTo !== 'all') {
                    try {
                        const parsed = JSON.parse(processed.assignedTo);
                        if (Array.isArray(parsed)) {
                            processed.assignedTo = parsed;
                        }
                    } catch (e) {
                        // ليس JSON، أبقه كما هو
                    }
                }
                
                // معالجة assignedDepartments
                if (processed.assignedDepartments) {
                    try {
                        const parsed = JSON.parse(processed.assignedDepartments);
                        if (Array.isArray(parsed)) {
                            processed.assignedDepartments = parsed;
                        }
                    } catch (e) {
                        // ليس JSON
                    }
                }
                
                // معالجة userProgress - الحصول على تقدم المستخدم الحالي
                if (processed.userProgress) {
                    try {
                        const progress = JSON.parse(processed.userProgress);
                        processed.userProgress = progress;
                        if (progress[userId]) {
                            processed.completionRate = progress[userId].completionRate || processed.completionRate || 0;
                        }
                    } catch (e) {
                        processed.userProgress = {};
                    }
                }
                
                userTasks.push(processed);
            }
        }
        
        return { success: true, data: userTasks };
    } catch (error) {
        Logger.log('Error getting user tasks by userId: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على المهام: ' + error.toString(), data: [] };
    }
}

/**
 * حذف مهمة
 * @param {string} taskId - معرف المهمة
 * @return {Object} - نتيجة العملية
 */
function deleteUserTask(taskId) {
    try {
        if (!taskId) {
            return { success: false, message: 'معرف المهمة غير موجود' };
        }
        
        const sheetName = 'UserTasks';
        const spreadsheetId = getSpreadsheetId();
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة' };
        }
        
        // ✅ حذف الصف مباشرة بدون إعادة كتابة الجدول بالكامل
        return deleteRowById(sheetName, taskId, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting user task: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف المهمة: ' + error.toString() };
    }
}

/**
 * ============================================
 * إدارة التعليمات والملاحظات (Instructions Management)
 * ============================================
 */

/**
 * إضافة تعليمات/ملاحظات من المدير
 * @param {Object} instructionData - بيانات التعليمات
 * @return {Object} - نتيجة العملية
 */
function addUserInstruction(instructionData) {
    try {
        if (!instructionData) {
            return { success: false, message: 'بيانات التعليمات غير موجودة' };
        }
        
        const sheetName = 'UserInstructions';
        
        // إضافة حقول تلقائية
        if (!instructionData.id) {
            instructionData.id = Utilities.getUuid();
        }
        if (!instructionData.createdAt) {
            instructionData.createdAt = new Date();
        }
        if (!instructionData.updatedAt) {
            instructionData.updatedAt = new Date();
        }
        if (!instructionData.type) {
            instructionData.type = 'تعليمات';
        }
        
        // معالجة assignedTo
        if (instructionData.assignedTo === 'all' || instructionData.assignedTo === 'جميع المستخدمين') {
            instructionData.assignedTo = 'all';
        }
        // ✅ لا حاجة لـ JSON.stringify - سيتم التحويل تلقائياً
        
        // ✅ معالجة assignedDepartments - لا حاجة لـ JSON.stringify
        
        return appendToSheet(sheetName, instructionData);
    } catch (error) {
        Logger.log('Error in addUserInstruction: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة التعليمات: ' + error.toString() };
    }
}

/**
 * الحصول على التعليمات الموجهة لمستخدم محدد
 * @param {string} userId - معرف المستخدم
 * @return {Object} - قائمة التعليمات
 */
function getUserInstructionsByUserId(userId) {
    try {
        if (!userId) {
            return { success: false, message: 'معرف المستخدم غير موجود', data: [] };
        }
        
        const sheetName = 'UserInstructions';
        const allData = readFromSheet(sheetName, getSpreadsheetId());
        
        // فلترة التعليمات المتاحة للمستخدم
        const userInstructions = [];
        
        for (let i = 0; i < allData.length; i++) {
            const instruction = allData[i];
            const hasAccess = checkUserTaskAccess(instruction, userId);
            
            if (hasAccess) {
                const processed = Object.assign({}, instruction);
                
                // معالجة assignedTo
                if (processed.assignedTo && processed.assignedTo !== 'all') {
                    try {
                        const parsed = JSON.parse(processed.assignedTo);
                        if (Array.isArray(parsed)) {
                            processed.assignedTo = parsed;
                        }
                    } catch (e) {
                        // ليس JSON
                    }
                }
                
                userInstructions.push(processed);
            }
        }
        
        return { success: true, data: userInstructions };
    } catch (error) {
        Logger.log('Error getting user instructions: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على التعليمات: ' + error.toString(), data: [] };
    }
}

