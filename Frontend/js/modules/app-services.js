/**
 * App Services - Main Loader/Index File
 * 
 * This file serves as the main entry point for all service modules.
 * All service modules are loaded via script tags before this file,
 * and they expose themselves to the global window object.
 * 
 * This file ensures all services are available and adds any helper functions.
 * 
 * Refactored from a single 5000+ line file into modular services:
 * - services/data-manager.js - Data management and sync queue
 * - services/periodic-inspection-store.js - Periodic inspection management
 * - services/approval-circuits.js - Approval circuit management
 * - services/audit-log.js - Audit logging
 * - services/user-activity-log.js - User activity logging
 * - services/cloud-storage-integration.js - Cloud storage (OneDrive, Google Drive, SharePoint)
 * - services/workflow.js - Workflow engine
 * - services/google-integration.js - Google Apps Script and Sheets integration
 */

// All services are already loaded via script tags and exposed to window
// This file ensures they're all available and adds helper functions

// Verify all services are loaded (for debugging)
if (typeof window !== 'undefined') {
    // Services should already be on window from their respective modules
    // Just verify they exist and add helper functions if needed
    
    // Verify all services are loaded
    if (!window.DataManager) {
        console.error('❌ DataManager not loaded! Make sure services/data-manager.js is loaded before app-services.js');
    }
    if (!window.GoogleIntegration) {
        console.error('❌ GoogleIntegration not loaded! Make sure services/google-integration.js is loaded before app-services.js');
    }
    
    // Add syncSpecificSheets helper function if it doesn't exist
    if (window.GoogleIntegration && !window.GoogleIntegration.syncSpecificSheets) {
        window.GoogleIntegration.syncSpecificSheets = async function(sheetNames = [], options = {}) {
            const { silent = false, showLoader = false, notifyOnSuccess = !silent, notifyOnError = !silent } = options;
            if (!AppState.googleConfig.appsScript.enabled || !AppState.googleConfig.appsScript.scriptUrl) {
                if (!silent) Utils.safeLog('Google Sheets غير مفعّل');
                return false;
            }
            if (!Array.isArray(sheetNames) || sheetNames.length === 0) {
                if (!silent) Utils.safeWarn('لا توجد أوراق محددة للمزامنة');
                return false;
            }
            try {
                if (!silent) Utils.safeLog(`جاري مزامنة ${sheetNames.length} أوراق...`);
                if (showLoader && typeof Loading !== 'undefined') Loading.show();
                const sheetMapping = { 'users': 'Users', 'incidents': 'Incidents', 'training': 'Training', 'employees': 'Employees' };
                const mappedSheets = sheetNames.map(name => sheetMapping[name.toLowerCase()] || name);
                const syncPromises = mappedSheets.map(async (sheetName) => {
                    try {
                        const result = await window.GoogleIntegration.sendRequest({
                            action: 'readFromSheet',
                            data: { sheetName, spreadsheetId: AppState.googleConfig.sheets.spreadsheetId }
                        });
                        if (result && result.success) {
                            const dataKey = sheetName.charAt(0).toLowerCase() + sheetName.slice(1);
                            AppState.appData[dataKey] = result.data || [];
                            if (!silent) Utils.safeLog(`✅ تم مزامنة ${sheetName}: ${AppState.appData[dataKey].length} سجل`);
                            return { sheet: sheetName, success: true, count: AppState.appData[dataKey].length };
                        }
                        return { sheet: sheetName, success: false };
                    } catch (error) {
                        if (!silent) Utils.safeWarn(`⚠️ فشل مزامنة ${sheetName}:`, error);
                        return { sheet: sheetName, success: false, error };
                    }
                });
                const results = await Promise.all(syncPromises);
                const successCount = results.filter(r => r.success).length;
                window.DataManager.save();
                if (showLoader && typeof Loading !== 'undefined') Loading.hide();
                if (notifyOnSuccess && successCount > 0) Notification.success(`✅ تم مزامنة ${successCount} من ${sheetNames.length} أوراق بنجاح`);
                if (!silent) Utils.safeLog(`✅ تمت مزامنة البيانات بنجاح: ${successCount}/${sheetNames.length}`);
                return true;
            } catch (error) {
                if (showLoader && typeof Loading !== 'undefined') Loading.hide();
                if (!silent) Utils.safeError('❌ خطأ في مزامنة البيانات:', error);
                if (notifyOnError) Notification.error('فشل مزامنة البيانات');
                return false;
            }
        };
    }
}
