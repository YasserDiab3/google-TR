/**
 * Smart Cache System - نظام Cache ذكي حسب الصلاحيات والمستخدم
 * يحسن الأداء ويقلل من تحميل البيانات غير الضرورية
 */

const SmartCache = {
    // مدة الـ cache الافتراضية (24 ساعة)
    DEFAULT_CACHE_DURATION: 24 * 60 * 60 * 1000,

    // مدد مختلفة حسب نوع البيانات
    CACHE_DURATIONS: {
        'user_specific': 60 * 60 * 1000, // ساعة واحدة لبيانات المستخدم
        'shared_data': 6 * 60 * 60 * 1000, // 6 ساعات لبيانات مشتركة
        'static_data': 24 * 60 * 60 * 1000, // 24 ساعة لبيانات ثابتة
        'frequent_updates': 30 * 60 * 1000 // 30 دقيقة لبيانات تتحدث كثيراً
    },

    /**
     * إنشاء مفتاح cache ذكي
     * ملاحظة: لا يتضمن timestamp في المفتاح — صلاحية الـ cache تُتحقق عبر isCacheValid() بالـ TTL
     */
    getCacheKey(action, data, userId, permissions) {
        try {
            const keyData = {
                action,
                data: this._normalizeData(data),
                userId,
                permissionsHash: this.hashPermissions(permissions)
            };
            return btoa(JSON.stringify(keyData));
        } catch (e) {
            // Fallback للمفتاح البسيط
            return `${action}_${userId}_${JSON.stringify(data || {})}`;
        }
    },

    /**
     * تطبيع البيانات للمفتاح
     */
    _normalizeData(data) {
        if (!data) return {};

        // إزالة الحقول غير المهمة للمفتاح
        const normalized = { ...data };
        delete normalized.timestamp;
        delete normalized._cache;
        delete normalized._temp;

        return normalized;
    },

    /**
     * إنشاء hash للصلاحيات
     */
    hashPermissions(permissions) {
        if (!permissions) return 'none';

        try {
            // ترتيب الصلاحيات لضمان hash متسق
            const sortedPerms = Object.keys(permissions || {})
                .sort()
                .reduce((result, key) => {
                    result[key] = permissions[key];
                    return result;
                }, {});

            const permString = JSON.stringify(sortedPerms);
            return this._simpleHash(permString);
        } catch (e) {
            return 'error';
        }
    },

    /**
     * Hash بسيط للنصوص
     */
    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    },

    /**
     * التحقق من صحة الـ cache
     */
    isCacheValid(cacheEntry, userPermissions, dataType = 'static_data') {
        if (!cacheEntry || !cacheEntry.timestamp) return false;

        const now = Date.now();
        const age = now - cacheEntry.timestamp;
        const maxAge = this.CACHE_DURATIONS[dataType] || this.DEFAULT_CACHE_DURATION;

        // فحص الصلاحيات
        if (!this.hasSamePermissions(cacheEntry.permissions, userPermissions)) {
            return false;
        }

        // فحص الوقت
        if (age > maxAge) {
            return false;
        }

        return true;
    },

    /**
     * التحقق من تطابق الصلاحيات
     */
    hasSamePermissions(cachedPerms, currentPerms) {
        if (!cachedPerms && !currentPerms) return true;
        if (!cachedPerms || !currentPerms) return false;

        try {
            return this.hashPermissions(cachedPerms) === this.hashPermissions(currentPerms);
        } catch (e) {
            return false;
        }
    },

    /**
     * حفظ في الـ cache
     */
    setCache(key, data, userPermissions, dataType = 'static_data') {
        try {
            const cacheEntry = {
                data,
                timestamp: Date.now(),
                permissions: { ...userPermissions },
                dataType,
                version: '2.0' // للتحقق من توافق الإصدارات
            };

            const cacheKey = `hse_smart_cache_${key}`;
            localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));

            if (AppState?.debugMode) {
                Utils?.safeLog(`✅ تم حفظ في Smart Cache: ${key}`);
            }
        } catch (e) {
            Utils?.safeWarn('⚠️ فشل حفظ Smart Cache:', e);
        }
    },

    /**
     * استرجاع من الـ cache
     */
    getCache(key, userPermissions, dataType = 'static_data') {
        try {
            const cacheKey = `hse_smart_cache_${key}`;
            const cached = localStorage.getItem(cacheKey);

            if (!cached) return null;

            const cacheEntry = JSON.parse(cached);

            // التحقق من صحة الـ cache
            if (!this.isCacheValid(cacheEntry, userPermissions, dataType)) {
                // حذف الـ cache القديم
                localStorage.removeItem(cacheKey);
                return null;
            }

            if (AppState?.debugMode) {
                Utils?.safeLog(`✅ تم استرجاع من Smart Cache: ${key}`);
            }

            return cacheEntry.data;
        } catch (e) {
            Utils?.safeWarn('⚠️ خطأ في استرجاع Smart Cache:', e);
            return null;
        }
    },

    /**
     * تنظيف الـ cache القديم
     */
    cleanupOldCache() {
        try {
            const keys = Object.keys(localStorage);
            const smartCacheKeys = keys.filter(key => key.startsWith('hse_smart_cache_'));

            let cleaned = 0;
            smartCacheKeys.forEach(key => {
                try {
                    const cached = localStorage.getItem(key);
                    if (cached) {
                        const cacheEntry = JSON.parse(cached);
                        const age = Date.now() - (cacheEntry.timestamp || 0);

                        // حذف إذا كان أقدم من 7 أيام
                        if (age > 7 * 24 * 60 * 60 * 1000) {
                            localStorage.removeItem(key);
                            cleaned++;
                        }
                    }
                } catch (e) {
                    // حذف الـ cache التالف
                    localStorage.removeItem(key);
                    cleaned++;
                }
            });

            if (cleaned > 0 && AppState?.debugMode) {
                Utils?.safeLog(`🧹 تم تنظيف ${cleaned} عنصر من Smart Cache`);
            }
        } catch (e) {
            Utils?.safeWarn('⚠️ خطأ في تنظيف Smart Cache:', e);
        }
    },

    /**
     * مسح جميع الـ cache
     */
    clearAllCache() {
        try {
            const keys = Object.keys(localStorage);
            const smartCacheKeys = keys.filter(key => key.startsWith('hse_smart_cache_'));

            smartCacheKeys.forEach(key => localStorage.removeItem(key));

            if (AppState?.debugMode) {
                Utils?.safeLog(`🗑️ تم مسح جميع Smart Cache (${smartCacheKeys.length} عنصر)`);
            }
        } catch (e) {
            Utils?.safeWarn('⚠️ خطأ في مسح Smart Cache:', e);
        }
    }
};

// تنظيف دوري للـ cache القديم
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => SmartCache.cleanupOldCache(), 5000);
    });
}