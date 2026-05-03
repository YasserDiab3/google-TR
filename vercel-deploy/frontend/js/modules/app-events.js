// ===== Inline Authentication Helper Functions =====
// ملاحظة أمنية (إنتاج):
// - لا يتم إنشاء أي "حسابات افتراضية" أو كلمات مرور داخل الكود.
// - يجب إنشاء المستخدمين (وخاصة المدير الأول) عبر قاعدة البيانات أو لوحة المستخدمين.

/**
 * تحويل كلمات المرور النصية إلى مشفرة
 */
async function migrateUsersToHashedPasswords() {
    if (!AppState.appData.users || !Array.isArray(AppState.appData.users)) {
        return;
    }
    
    const usersToMigrate = AppState.appData.users.filter(user => {
        // تخطي المستخدمين الذين لديهم passwordHash بالفعل
        if (user.passwordHash) return false;
        // تحويل المستخدمين الذين لديهم password نصي فقط
        return user.password && typeof user.password === 'string';
    });

    if (usersToMigrate.length === 0) {
        // لا يوجد مستخدمون بحاجة للتحويل
        return;
    }

    Utils.safeLog(`🔄 بدء تحويل ${usersToMigrate.length} مستخدم إلى passwordHash...`);

    for (const user of usersToMigrate) {
        try {
            // تشفير كلمة المرور
            user.passwordHash = await Utils.hashPassword(user.password);
            // حذف كلمة المرور النصية
            delete user.password;
            Utils.safeLog(`✅ تم تحويل كلمة المرور للمستخدم: ${user.email}`);
        } catch (error) {
            Utils.safeError(`❌ فشل تحويل كلمة المرور للمستخدم ${user.email}:`, error);
        }
    }

    // حفظ التغييرات باستخدام window.DataManager
    if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
        window.DataManager.save();
    } else {
        Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ التغييرات');
    }
    Utils.safeLog(`✅ تم تحويل ${usersToMigrate.length} مستخدم بنجاح`);
}

// ===== Event Listeners =====
// Note: App initialization is handled in modules-loader.js
// This file only contains inline helper functions

// Export helper functions to global scope
if (typeof window !== 'undefined') {
    window.migrateUsersToHashedPasswords = migrateUsersToHashedPasswords;
}
