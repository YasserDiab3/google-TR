/**
 * Map Coordinates Manager
 * مدير إحداثيات المواقع للخريطة
 * ملف منفصل لإدارة إحداثيات المواقع بشكل مركزي لجميع المستخدمين
 */

const MapCoordinatesManager = {
    // مفتاح التخزين في localStorage
    STORAGE_KEY: 'ptw_map_coordinates',
    // مفتاح التخزين في Google Sheets
    SHEETS_KEY: 'PTW_MAP_SITES',
    // مفتاح الإحداثيات الافتراضية
    DEFAULT_COORDS_KEY: 'ptw_default_coordinates',

    /**
     * تحميل إحداثيات المواقع من جميع المصادر
     */
    async loadMapSites() {
        try {
            // 1. محاولة التحميل من Google Sheets (الأولوية الأولى - مشترك لجميع المستخدمين)
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.getData) {
                try {
                    const sheetsData = await GoogleIntegration.getData(this.SHEETS_KEY);
                    if (sheetsData && Array.isArray(sheetsData) && sheetsData.length > 0) {
                        if (typeof Utils !== 'undefined' && Utils.safeLog) {
                            Utils.safeLog('✅ تم تحميل إحداثيات المواقع من Google Sheets:', sheetsData.length, 'موقع');
                        }
                        // حفظ محلياً للنسخ الاحتياطي
                        this.saveMapSitesLocal(sheetsData);
                        return sheetsData;
                    }
                } catch (error) {
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                        Utils.safeWarn('⚠️ تعذر تحميل إحداثيات المواقع من Google Sheets:', error);
                    }
                }
            }

            // 2. محاولة التحميل من AppState (مشترك بين الجلسات)
            if (typeof AppState !== 'undefined' && AppState.appData && AppState.appData.ptwMapSites) {
                const appStateData = AppState.appData.ptwMapSites;
                if (Array.isArray(appStateData) && appStateData.length > 0) {
                    if (typeof Utils !== 'undefined' && Utils.safeLog) {
                        Utils.safeLog('✅ تم تحميل إحداثيات المواقع من AppState:', appStateData.length, 'موقع');
                    }
                    return appStateData;
                }
            }

            // 3. محاولة التحميل من localStorage (نسخة احتياطية محلية)
            const localData = this.loadMapSitesLocal();
            if (localData && localData.length > 0) {
                if (typeof Utils !== 'undefined' && Utils.safeLog) {
                    Utils.safeLog('✅ تم تحميل إحداثيات المواقع من localStorage:', localData.length, 'موقع');
                }
                return localData;
            }

            // 4. إرجاع مصفوفة فارغة إذا لم يتم العثور على بيانات
            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('ℹ️ لا توجد إحداثيات مواقع محفوظة');
            }
            return [];
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في تحميل إحداثيات المواقع:', error);
            }
            return [];
        }
    },

    /**
     * حفظ إحداثيات المواقع في جميع المصادر
     */
    async saveMapSites(sites) {
        if (!Array.isArray(sites)) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ sites يجب أن يكون مصفوفة');
            }
            return false;
        }

        try {
            // 1. حفظ في Google Sheets (مشترك لجميع المستخدمين)
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                try {
                    await GoogleIntegration.autoSave(this.SHEETS_KEY, sites);
                    if (typeof Utils !== 'undefined' && Utils.safeLog) {
                        Utils.safeLog('✅ تم حفظ إحداثيات المواقع في Google Sheets');
                    }
                } catch (error) {
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                        Utils.safeWarn('⚠️ تعذر حفظ إحداثيات المواقع في Google Sheets:', error);
                    }
                }
            }

            // 2. حفظ في AppState (مشترك بين الجلسات)
            if (typeof AppState !== 'undefined') {
                if (!AppState.appData) AppState.appData = {};
                AppState.appData.ptwMapSites = [...sites];
                if (typeof Utils !== 'undefined' && Utils.safeLog) {
                    Utils.safeLog('✅ تم حفظ إحداثيات المواقع في AppState');
                }
            }

            // 3. حفظ في localStorage (نسخة احتياطية محلية)
            this.saveMapSitesLocal(sites);

            // 4. حفظ في DataManager إذا كان متاحاً
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
                if (typeof Utils !== 'undefined' && Utils.safeLog) {
                    Utils.safeLog('✅ تم حفظ إحداثيات المواقع في DataManager');
                }
            }

            return true;
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في حفظ إحداثيات المواقع:', error);
            }
            return false;
        }
    },

    /**
     * تحميل إحداثيات المواقع من localStorage
     */
    loadMapSitesLocal() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ خطأ في تحميل إحداثيات المواقع من localStorage:', error);
            }
        }
        return [];
    },

    /**
     * حفظ إحداثيات المواقع في localStorage
     */
    saveMapSitesLocal(sites) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sites));
            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ تم حفظ إحداثيات المواقع في localStorage');
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ خطأ في حفظ إحداثيات المواقع في localStorage:', error);
            }
        }
    },

    /**
     * تحميل الإحداثيات الافتراضية
     */
    async loadDefaultCoordinates() {
        try {
            // 1. محاولة التحميل من Google Sheets
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.getData) {
                try {
                    const sheetsData = await GoogleIntegration.getData('PTW_DEFAULT_COORDINATES');
                    if (sheetsData && sheetsData.latitude && sheetsData.longitude) {
                        if (typeof Utils !== 'undefined' && Utils.safeLog) {
                            Utils.safeLog('✅ تم تحميل الإحداثيات الافتراضية من Google Sheets');
                        }
                        this.saveDefaultCoordinatesLocal(sheetsData);
                        return {
                            lat: parseFloat(sheetsData.latitude),
                            lng: parseFloat(sheetsData.longitude),
                            zoom: parseInt(sheetsData.zoom) || 15
                        };
                    }
                } catch (error) {
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                        Utils.safeWarn('⚠️ تعذر تحميل الإحداثيات الافتراضية من Google Sheets:', error);
                    }
                }
            }

            // 2. محاولة التحميل من AppState
            if (typeof AppState !== 'undefined' && AppState.companySettings) {
                const settings = AppState.companySettings;
                if (settings.latitude && settings.longitude) {
                    if (typeof Utils !== 'undefined' && Utils.safeLog) {
                        Utils.safeLog('✅ تم تحميل الإحداثيات الافتراضية من AppState');
                    }
                    return {
                        lat: parseFloat(settings.latitude),
                        lng: parseFloat(settings.longitude),
                        zoom: parseInt(settings.mapZoom) || 15
                    };
                }
            }

            // 3. محاولة التحميل من localStorage
            const localData = this.loadDefaultCoordinatesLocal();
            if (localData && localData.lat && localData.lng) {
                if (typeof Utils !== 'undefined' && Utils.safeLog) {
                    Utils.safeLog('✅ تم تحميل الإحداثيات الافتراضية من localStorage');
                }
                return localData;
            }

            // 4. إرجاع القيم الافتراضية
            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('ℹ️ استخدام الإحداثيات الافتراضية');
            }
            return {
                lat: 24.7136, // الرياض
                lng: 46.6753,
                zoom: 15
            };
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في تحميل الإحداثيات الافتراضية:', error);
            }
            return {
                lat: 24.7136,
                lng: 46.6753,
                zoom: 15
            };
        }
    },

    /**
     * حفظ الإحداثيات الافتراضية
     */
    async saveDefaultCoordinates(coords) {
        if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ الإحداثيات غير صحيحة');
            }
            return false;
        }

        try {
            const data = {
                latitude: coords.lat,
                longitude: coords.lng,
                zoom: coords.zoom || 15,
                updatedAt: new Date().toISOString(),
                updatedBy: (typeof AppState !== 'undefined' && AppState.currentUser) ? 
                    (AppState.currentUser.email || AppState.currentUser.name || 'unknown') : 'unknown'
            };

            // 1. حفظ في Google Sheets
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                try {
                    await GoogleIntegration.autoSave('PTW_DEFAULT_COORDINATES', data);
                    if (typeof Utils !== 'undefined' && Utils.safeLog) {
                        Utils.safeLog('✅ تم حفظ الإحداثيات الافتراضية في Google Sheets');
                    }
                } catch (error) {
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                        Utils.safeWarn('⚠️ تعذر حفظ الإحداثيات الافتراضية في Google Sheets:', error);
                    }
                }
            }

            // 2. حفظ في AppState
            if (typeof AppState !== 'undefined') {
                if (!AppState.companySettings) AppState.companySettings = {};
                AppState.companySettings.latitude = coords.lat;
                AppState.companySettings.longitude = coords.lng;
                AppState.companySettings.mapZoom = coords.zoom || 15;
                if (typeof Utils !== 'undefined' && Utils.safeLog) {
                    Utils.safeLog('✅ تم حفظ الإحداثيات الافتراضية في AppState');
                }
            }

            // 3. حفظ في localStorage
            this.saveDefaultCoordinatesLocal(coords);

            // 4. حفظ في DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
                if (typeof Utils !== 'undefined' && Utils.safeLog) {
                    Utils.safeLog('✅ تم حفظ الإحداثيات الافتراضية في DataManager');
                }
            }

            return true;
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في حفظ الإحداثيات الافتراضية:', error);
            }
            return false;
        }
    },

    /**
     * تحميل الإحداثيات الافتراضية من localStorage
     */
    loadDefaultCoordinatesLocal() {
        try {
            const stored = localStorage.getItem(this.DEFAULT_COORDS_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ خطأ في تحميل الإحداثيات الافتراضية من localStorage:', error);
            }
        }
        return null;
    },

    /**
     * حفظ الإحداثيات الافتراضية في localStorage
     */
    saveDefaultCoordinatesLocal(coords) {
        try {
            localStorage.setItem(this.DEFAULT_COORDS_KEY, JSON.stringify(coords));
            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ تم حفظ الإحداثيات الافتراضية في localStorage');
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ خطأ في حفظ الإحداثيات الافتراضية في localStorage:', error);
            }
        }
    },

    /**
     * مزامنة البيانات من Google Sheets إلى التخزين المحلي
     */
    async syncFromGoogleSheets() {
        try {
            if (typeof GoogleIntegration === 'undefined' || !GoogleIntegration.getData) {
                // لا نعرض تحذير - هذا طبيعي عند عدم تفعيل Google Integration
                return false;
            }

            // تحميل المواقع
            const sites = await GoogleIntegration.getData(this.SHEETS_KEY);
            if (sites && Array.isArray(sites)) {
                this.saveMapSitesLocal(sites);
                if (typeof AppState !== 'undefined') {
                    if (!AppState.appData) AppState.appData = {};
                    AppState.appData.ptwMapSites = [...sites];
                }
                if (typeof Utils !== 'undefined' && Utils.safeLog) {
                    Utils.safeLog('✅ تم مزامنة المواقع من Google Sheets:', sites.length, 'موقع');
                }
            }

            // تحميل الإحداثيات الافتراضية
            const defaultCoords = await GoogleIntegration.getData('PTW_DEFAULT_COORDINATES');
            if (defaultCoords && defaultCoords.latitude && defaultCoords.longitude) {
                const coords = {
                    lat: parseFloat(defaultCoords.latitude),
                    lng: parseFloat(defaultCoords.longitude),
                    zoom: parseInt(defaultCoords.zoom) || 15
                };
                this.saveDefaultCoordinatesLocal(coords);
                if (typeof AppState !== 'undefined') {
                    if (!AppState.companySettings) AppState.companySettings = {};
                    AppState.companySettings.latitude = coords.lat;
                    AppState.companySettings.longitude = coords.lng;
                    AppState.companySettings.mapZoom = coords.zoom;
                }
                if (typeof Utils !== 'undefined' && Utils.safeLog) {
                    Utils.safeLog('✅ تم مزامنة الإحداثيات الافتراضية من Google Sheets');
                }
            }

            return true;
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في مزامنة البيانات من Google Sheets:', error);
            }
            return false;
        }
    },

    /**
     * التحقق من تطابق البيانات بين المصادر المختلفة
     */
    async verifyDataConsistency() {
        try {
            const sources = {
                googleSheets: null,
                appState: null,
                localStorage: null
            };

            // تحميل من Google Sheets
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.getData) {
                try {
                    sources.googleSheets = await GoogleIntegration.getData(this.SHEETS_KEY);
                } catch (e) {
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                        Utils.safeWarn('⚠️ تعذر تحميل من Google Sheets:', e);
                    }
                }
            }

            // تحميل من AppState
            if (typeof AppState !== 'undefined' && AppState.appData && AppState.appData.ptwMapSites) {
                sources.appState = AppState.appData.ptwMapSites;
            }

            // تحميل من localStorage
            sources.localStorage = this.loadMapSitesLocal();

            // التحقق من التطابق
            const counts = {
                googleSheets: sources.googleSheets ? sources.googleSheets.length : 0,
                appState: sources.appState ? sources.appState.length : 0,
                localStorage: sources.localStorage ? sources.localStorage.length : 0
            };

            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('📊 عدد المواقع في كل مصدر:', counts);
            }

            // إذا كانت هناك اختلافات، نستخدم Google Sheets كمرجع
            if (sources.googleSheets && Array.isArray(sources.googleSheets) && sources.googleSheets.length > 0) {
                if (JSON.stringify(sources.googleSheets) !== JSON.stringify(sources.appState) ||
                    JSON.stringify(sources.googleSheets) !== JSON.stringify(sources.localStorage)) {
                    if (typeof Utils !== 'undefined' && Utils.safeLog) {
                        Utils.safeLog('⚠️ تم اكتشاف اختلافات في البيانات - سيتم استخدام Google Sheets كمرجع');
                    }
                    await this.saveMapSites(sources.googleSheets);
                    return sources.googleSheets;
                }
            }

            // إرجاع البيانات الأكثر اكتمالاً
            if (sources.appState && sources.appState.length > 0) {
                return sources.appState;
            }
            if (sources.localStorage && sources.localStorage.length > 0) {
                return sources.localStorage;
            }

            return [];
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في التحقق من تطابق البيانات:', error);
            }
            return [];
        }
    }
};

// تصدير المدير إلى window
if (typeof window !== 'undefined') {
    window.MapCoordinatesManager = MapCoordinatesManager;
}

