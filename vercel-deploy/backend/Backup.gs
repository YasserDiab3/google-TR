/**
 * Google Apps Script for HSE System - Backup Module
 * 
 * نظام النسخ الاحتياطي للبيانات
 * 
 * الميزات:
 * - نسخ احتياطي تلقائي مرتين يومياً (الساعة 6 صباحاً و 6 مساءً)
 * - نسخ احتياطي يدوي من قبل المدير
 * - حفظ النسخ في مجلد Google Drive مخصص
 * - سجل شامل لجميع عمليات النسخ الاحتياطي
 * - إمكانية استعادة البيانات من النسخ الاحتياطية
 */

// ============================================
// الثوابت والإعدادات
// ============================================

const BACKUP_FOLDER_NAME = 'HSE_System_Backups';
const MAX_BACKUP_FILES = 30; // الاحتفاظ بآخر 30 نسخة احتياطية
const BACKUP_TIMES = [6, 18]; // الساعة 6 صباحاً و 6 مساءً

/**
 * ============================================
 * Helpers: قراءة/تطبيع إعدادات النسخ الاحتياطي
 * ============================================
 */
function _backup_toBool_(v, fallback) {
    if (v === true || v === false) return v;
    if (v === 1 || v === '1') return true;
    if (v === 0 || v === '0') return false;
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s === 'true' || s === 'yes' || s === 'y' || s === 'on') return true;
        if (s === 'false' || s === 'no' || s === 'n' || s === 'off') return false;
    }
    return fallback;
}

function _backup_toPositiveInt_(v, fallback) {
    const n = Number(v);
    if (isFinite(n) && !isNaN(n) && n > 0) return Math.floor(n);
    return fallback;
}

function _backup_extractDriveFileId_(s) {
    if (!s) return '';
    const str = String(s).trim();
    if (!str) return '';

    // Common patterns:
    // - https://docs.google.com/spreadsheets/d/<ID>/edit
    // - https://drive.google.com/file/d/<ID>/view
    // - https://drive.google.com/open?id=<ID>
    // - raw <ID>
    const m1 = str.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (m1 && m1[1]) return m1[1];
    const m2 = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m2 && m2[1]) return m2[1];
    const m3 = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m3 && m3[1]) return m3[1];

    // Fallback: if it looks like an ID
    if (/^[a-zA-Z0-9_-]{20,}$/.test(str)) return str;
    return '';
}

function _backup_normalizeTimes_(times, fallbackTimes) {
    const fallback = Array.isArray(fallbackTimes) && fallbackTimes.length ? fallbackTimes : ['06:00', '18:00'];

    let arr = times;
    if (typeof arr === 'string') {
        const s = arr.trim();
        // Try parse JSON array
        if (s.startsWith('[')) {
            try {
                arr = JSON.parse(s);
            } catch (e) {
                arr = [s];
            }
        } else {
            arr = [s];
        }
    }
    if (!Array.isArray(arr)) arr = fallback;

    const normalized = [];
    arr.forEach(function(t) {
        if (t === null || t === undefined) return;
        const s = String(t).trim();
        if (!s) return;

        // Accept "6", "06", "06:00", "18:30"
        let hour = null;
        let minute = 0;
        const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
        if (m) {
            hour = Number(m[1]);
            minute = m[2] !== undefined ? Number(m[2]) : 0;
        }
        if (hour === null || !isFinite(hour) || isNaN(hour)) return;
        if (hour < 0 || hour > 23) return;
        if (!isFinite(minute) || isNaN(minute) || minute < 0 || minute > 59) minute = 0;

        // Triggers support only hour granularity; keep display format but schedule by hour
        const hh = String(hour).padStart(2, '0');
        const mm = String(minute).padStart(2, '0');
        normalized.push(hh + ':' + mm);
    });

    // de-dupe preserving order
    const seen = {};
    const unique = normalized.filter(function(t) {
        if (seen[t]) return false;
        seen[t] = true;
        return true;
    });

    return unique.length ? unique : fallback;
}

function _backup_getEffectiveSettings_() {
    const defaults = {
        autoBackupEnabled: false,
        backupTimes: ['06:00', '18:00'],
        maxBackupFiles: MAX_BACKUP_FILES,
        backupFolderName: BACKUP_FOLDER_NAME,
        retentionDays: 30,
        notifyOnBackup: true,
        notifyOnFailure: true
    };

    try {
        const res = getBackupSettings();
        const s = (res && res.success && res.data) ? res.data : {};
        const out = Object.assign({}, defaults, s || {});

        out.autoBackupEnabled = _backup_toBool_(out.autoBackupEnabled, defaults.autoBackupEnabled);
        out.notifyOnBackup = _backup_toBool_(out.notifyOnBackup, defaults.notifyOnBackup);
        out.notifyOnFailure = _backup_toBool_(out.notifyOnFailure, defaults.notifyOnFailure);

        out.maxBackupFiles = _backup_toPositiveInt_(out.maxBackupFiles, defaults.maxBackupFiles);
        out.retentionDays = _backup_toPositiveInt_(out.retentionDays, defaults.retentionDays);

        out.backupFolderName = (out.backupFolderName === null || out.backupFolderName === undefined)
            ? defaults.backupFolderName
            : String(out.backupFolderName).trim();
        if (!out.backupFolderName) out.backupFolderName = defaults.backupFolderName;

        out.backupTimes = _backup_normalizeTimes_(out.backupTimes, defaults.backupTimes);

        return out;
    } catch (e) {
        Logger.log('Error reading backup settings, using defaults: ' + e.toString());
        return defaults;
    }
}

/**
 * ============================================
 * إنشاء نسخة احتياطية يدوية
 * ============================================
 * 
 * @param {object} userData - بيانات المستخدم الذي يقوم بالنسخ
 * @param {string} spreadsheetId - معرف جدول البيانات (اختياري)
 * @return {object} - نتيجة العملية
 */
function createManualBackup(userData, spreadsheetId) {
    try {
        const ssId = spreadsheetId || getSpreadsheetId();
        
        if (!ssId) {
            return {
                success: false,
                message: 'معرف جدول البيانات غير محدد'
            };
        }
        
        // إنشاء النسخة الاحتياطية
        const result = performBackup('manual', userData, ssId);
        
        return result;
        
    } catch (error) {
        Logger.log('Error in createManualBackup: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء إنشاء النسخة الاحتياطية: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * إنشاء نسخة احتياطية تلقائية
 * ============================================
 * 
 * هذه الدالة يتم استدعاؤها تلقائياً من Triggers
 */
function createAutomaticBackup() {
    try {
        const ssId = getSpreadsheetId();
        
        if (!ssId) {
            Logger.log('Automatic backup failed: Spreadsheet ID not configured');
            return {
                success: false,
                message: 'معرف جدول البيانات غير محدد'
            };
        }
        
        const result = performBackup('automatic', { name: 'النظام (تلقائي)', id: 'system' }, ssId);
        
        Logger.log('Automatic backup result: ' + JSON.stringify(result));
        
        return result;
        
    } catch (error) {
        Logger.log('Error in createAutomaticBackup: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء النسخ الاحتياطي التلقائي: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * تنفيذ عملية النسخ الاحتياطي
 * ============================================
 * 
 * @param {string} backupType - نوع النسخ (manual/automatic)
 * @param {object} userData - بيانات المستخدم
 * @param {string} spreadsheetId - معرف جدول البيانات
 * @return {object} - نتيجة العملية
 */
function performBackup(backupType, userData, spreadsheetId) {
    try {
        const startTime = new Date();
        const settings = _backup_getEffectiveSettings_();
        
        // الحصول على جدول البيانات الأصلي
        const sourceSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sourceName = sourceSpreadsheet.getName();
        
        // إنشاء أو الحصول على مجلد النسخ الاحتياطية
        const backupFolder = getOrCreateBackupFolder(settings.backupFolderName);
        
        // إنشاء اسم النسخة الاحتياطية
        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
        const backupName = sourceName + '_Backup_' + timestamp + '_' + backupType;
        
        // نسخ الجدول بالكامل
        const backupFile = sourceSpreadsheet.copy(backupName);
        const backupFileId = backupFile.getId();
        
        // نقل الملف إلى مجلد النسخ الاحتياطية
        const file = DriveApp.getFileById(backupFileId);
        try {
            file.moveTo(backupFolder);
        } catch (moveErr) {
            // في بعض البيئات (Shared Drive/قيود صلاحيات) moveTo قد يفشل
            try {
                backupFolder.addFile(file);
                try {
                    DriveApp.getRootFolder().removeFile(file);
                } catch (removeErr) {
                    // ignore
                }
            } catch (addErr) {
                Logger.log('Failed to place backup file into folder. moveTo error: ' + moveErr + ' addFile error: ' + addErr);
                throw moveErr;
            }
        }
        
        // حساب حجم النسخة الاحتياطية
        const fileSize = file.getSize();
        const fileSizeFormatted = formatFileSize(fileSize);
        
        // حساب عدد الأوراق والسجلات
        const sheetsInfo = getBackupSheetsInfo(sourceSpreadsheet);
        
        const endTime = new Date();
        const duration = (endTime - startTime) / 1000; // بالثواني
        
        // تسجيل النسخة الاحتياطية في السجل
        const backupLog = {
            id: generateBackupId(),
            backupType: backupType,
            backupName: backupName,
            fileId: backupFileId,
            fileUrl: file.getUrl(),
            fileName: backupName,
            fileSize: fileSize,
            fileSizeFormatted: fileSizeFormatted,
            sheetsCount: sheetsInfo.sheetsCount,
            totalRecords: sheetsInfo.totalRecords,
            sheetsDetails: JSON.stringify(sheetsInfo.details),
            sourceSpreadsheetId: spreadsheetId,
            sourceSpreadsheetName: sourceName,
            status: 'completed',
            duration: duration,
            createdBy: userData ? userData.name : 'System',
            createdById: userData ? userData.id : 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // حفظ السجل
        saveBackupLog(backupLog, spreadsheetId);
        
        // حذف النسخ الاحتياطية القديمة (حسب الإعدادات)
        cleanupOldBackups(backupFolder, settings);
        
        return {
            success: true,
            message: 'تم إنشاء النسخة الاحتياطية بنجاح',
            data: {
                backupId: backupLog.id,
                backupName: backupName,
                fileId: backupFileId,
                fileUrl: file.getUrl(),
                fileSize: fileSizeFormatted,
                sheetsCount: sheetsInfo.sheetsCount,
                totalRecords: sheetsInfo.totalRecords,
                duration: duration + ' ثانية',
                backupType: backupType,
                createdAt: backupLog.createdAt
            }
        };
        
    } catch (error) {
        Logger.log('Error in performBackup: ' + error.toString());
        
        // تسجيل الفشل
        const failedLog = {
            id: generateBackupId(),
            backupType: backupType,
            status: 'failed',
            errorMessage: error.toString(),
            createdBy: userData ? userData.name : 'System',
            createdById: userData ? userData.id : 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        try {
            saveBackupLog(failedLog, spreadsheetId);
        } catch (logError) {
            Logger.log('Error saving failed backup log: ' + logError.toString());
        }
        
        return {
            success: false,
            message: 'فشل في إنشاء النسخة الاحتياطية: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * الحصول على أو إنشاء مجلد النسخ الاحتياطية
 * ============================================
 */
function getOrCreateBackupFolder(folderName) {
    try {
        const name = (folderName === null || folderName === undefined) ? BACKUP_FOLDER_NAME : String(folderName).trim();
        const finalName = name || BACKUP_FOLDER_NAME;

        const folders = DriveApp.getFoldersByName(finalName);
        
        if (folders.hasNext()) {
            return folders.next();
        }
        
        // إنشاء مجلد جديد
        const newFolder = DriveApp.createFolder(finalName);
        Logger.log('Created backup folder: ' + newFolder.getId());
        return newFolder;
        
    } catch (error) {
        Logger.log('Error in getOrCreateBackupFolder: ' + error.toString());
        throw error;
    }
}

/**
 * ============================================
 * الحصول على معلومات الأوراق للنسخة الاحتياطية
 * ============================================
 */
function getBackupSheetsInfo(spreadsheet) {
    try {
        const sheets = spreadsheet.getSheets();
        const details = [];
        let totalRecords = 0;
        
        sheets.forEach(function(sheet) {
            const sheetName = sheet.getName();
            const lastRow = sheet.getLastRow();
            const recordCount = lastRow > 1 ? lastRow - 1 : 0; // استثناء صف الرأس
            
            details.push({
                name: sheetName,
                records: recordCount
            });
            
            totalRecords += recordCount;
        });
        
        return {
            sheetsCount: sheets.length,
            totalRecords: totalRecords,
            details: details
        };
        
    } catch (error) {
        Logger.log('Error in getBackupSheetsInfo: ' + error.toString());
        return {
            sheetsCount: 0,
            totalRecords: 0,
            details: []
        };
    }
}

/**
 * ============================================
 * حفظ سجل النسخة الاحتياطية
 * ============================================
 */
function saveBackupLog(logData, spreadsheetId) {
    try {
        const ssId = spreadsheetId || getSpreadsheetId();
        const ss = SpreadsheetApp.openById(ssId);
        
        // الحصول على أو إنشاء ورقة السجل
        let sheet = ss.getSheetByName('BackupLog');
        
        if (!sheet) {
            sheet = ss.insertSheet('BackupLog');
            const headers = getDefaultHeaders('BackupLog');
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
            sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4a90d9').setFontColor('#ffffff');
        }
        
        const headers = getDefaultHeaders('BackupLog');
        const rowData = headers.map(function(header) {
            return logData[header] || '';
        });
        
        sheet.appendRow(rowData);
        
        return true;
        
    } catch (error) {
        Logger.log('Error in saveBackupLog: ' + error.toString());
        return false;
    }
}

/**
 * ============================================
 * حذف النسخ الاحتياطية القديمة
 * ============================================
 */
function cleanupOldBackups(backupFolder, settings) {
    try {
        settings = settings || _backup_getEffectiveSettings_();
        const maxFiles = _backup_toPositiveInt_(settings.maxBackupFiles, MAX_BACKUP_FILES);
        const retentionDays = _backup_toPositiveInt_(settings.retentionDays, 30);
        const cutoff = retentionDays > 0 ? new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000)) : null;

        const files = backupFolder.getFiles();
        const fileList = [];
        
        while (files.hasNext()) {
            const file = files.next();
            try {
                // نحتفظ فقط بملفات Google Sheets داخل مجلد النسخ الاحتياطية
                if (file.getMimeType) {
                    const mt = file.getMimeType();
                    if (mt && mt !== MimeType.GOOGLE_SHEETS) {
                        continue;
                    }
                }
            } catch (eMime) {
                // ignore and include
            }

            fileList.push({ file: file, date: file.getDateCreated() });
        }
        
        // حذف حسب مدة الاحتفاظ
        if (cutoff) {
            fileList.forEach(function(item) {
                try {
                    if (item.date && item.date < cutoff) {
                        Logger.log('Trashing backup due to retentionDays: ' + item.file.getName());
                        item.file.setTrashed(true);
                    }
                } catch (eTrash) {
                    Logger.log('Error trashing old backup: ' + eTrash.toString());
                }
            });
        }

        // ترتيب حسب التاريخ (الأحدث أولاً)
        fileList.sort(function(a, b) {
            return b.date - a.date;
        });
        
        // حذف الملفات الزائدة
        if (fileList.length > maxFiles) {
            for (var i = maxFiles; i < fileList.length; i++) {
                Logger.log('Deleting old backup: ' + fileList[i].file.getName());
                try {
                    fileList[i].file.setTrashed(true);
                } catch (eTrash2) {
                    Logger.log('Error trashing backup: ' + eTrash2.toString());
                }
            }
        }
        
    } catch (error) {
        Logger.log('Error in cleanupOldBackups: ' + error.toString());
    }
}

/**
 * ============================================
 * الحصول على قائمة النسخ الاحتياطية
 * ============================================
 */
function getAllBackups(filters) {
    try {
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return {
                success: false,
                message: 'معرف جدول البيانات غير محدد'
            };
        }
        
        const data = readFromSheet('BackupLog', spreadsheetId);
        
        if (!data || !Array.isArray(data)) {
            return {
                success: true,
                data: [],
                count: 0
            };
        }
        
        // تطبيق الفلاتر إذا وجدت
        let filteredData = data;
        
        if (filters) {
            if (filters.backupType) {
                filteredData = filteredData.filter(function(backup) {
                    return backup.backupType === filters.backupType;
                });
            }
            
            if (filters.status) {
                filteredData = filteredData.filter(function(backup) {
                    return backup.status === filters.status;
                });
            }
            
            if (filters.startDate) {
                filteredData = filteredData.filter(function(backup) {
                    return new Date(backup.createdAt) >= new Date(filters.startDate);
                });
            }
            
            if (filters.endDate) {
                filteredData = filteredData.filter(function(backup) {
                    return new Date(backup.createdAt) <= new Date(filters.endDate);
                });
            }
        }
        
        // ترتيب من الأحدث للأقدم
        filteredData.sort(function(a, b) {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        return {
            success: true,
            data: filteredData,
            count: filteredData.length
        };
        
    } catch (error) {
        Logger.log('Error in getAllBackups: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء جلب النسخ الاحتياطية: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * الحصول على نسخة احتياطية محددة
 * ============================================
 */
function getBackup(backupId) {
    try {
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet('BackupLog', spreadsheetId);
        
        if (!data || !Array.isArray(data)) {
            return {
                success: false,
                message: 'لا توجد نسخ احتياطية'
            };
        }
        
        const backup = data.find(function(item) {
            return item.id === backupId;
        });
        
        if (!backup) {
            return {
                success: false,
                message: 'النسخة الاحتياطية غير موجودة'
            };
        }
        
        return {
            success: true,
            data: backup
        };
        
    } catch (error) {
        Logger.log('Error in getBackup: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء جلب النسخة الاحتياطية: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * حذف نسخة احتياطية
 * ============================================
 */
function deleteBackup(backupId, userData) {
    try {
        const spreadsheetId = getSpreadsheetId();
        const ss = SpreadsheetApp.openById(spreadsheetId);
        const sheet = ss.getSheetByName('BackupLog');
        
        if (!sheet) {
            return {
                success: false,
                message: 'جدول سجل النسخ الاحتياطية غير موجود'
            };
        }
        
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const idIndex = headers.indexOf('id');
        const fileIdIndex = headers.indexOf('fileId');
        
        // البحث عن السجل
        for (var i = 1; i < data.length; i++) {
            if (data[i][idIndex] === backupId) {
                const fileId = data[i][fileIdIndex];
                
                // حذف الملف من Drive
                if (fileId) {
                    try {
                        const file = DriveApp.getFileById(fileId);
                        file.setTrashed(true);
                    } catch (driveError) {
                        Logger.log('File already deleted or not found: ' + fileId);
                    }
                }
                
                // حذف السجل
                sheet.deleteRow(i + 1);
                
                // تسجيل العملية
                addAuditLogToSheet({
                    userId: userData ? userData.id : 'unknown',
                    userName: userData ? userData.name : 'Unknown',
                    action: 'DELETE_BACKUP',
                    module: 'Backup',
                    details: 'حذف نسخة احتياطية: ' + backupId
                });
                
                return {
                    success: true,
                    message: 'تم حذف النسخة الاحتياطية بنجاح'
                };
            }
        }
        
        return {
            success: false,
            message: 'النسخة الاحتياطية غير موجودة'
        };
        
    } catch (error) {
        Logger.log('Error in deleteBackup: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء حذف النسخة الاحتياطية: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * استعادة البيانات من نسخة احتياطية
 * ============================================
 * 
 * ملاحظة: هذه الدالة تستبدل البيانات الحالية بالنسخة الاحتياطية
 * يُنصح بإنشاء نسخة احتياطية قبل الاستعادة
 */
function restoreFromBackup(backupId, userData, options) {
    try {
        options = options || {};
        const spreadsheetId = getSpreadsheetId();
        
        // الحصول على معلومات النسخة الاحتياطية
        const backupResult = getBackup(backupId);
        
        if (!backupResult.success) {
            return backupResult;
        }
        
        const backup = backupResult.data;
        
        if (!backup.fileId) {
            return {
                success: false,
                message: 'ملف النسخة الاحتياطية غير موجود'
            };
        }
        
        // إنشاء نسخة احتياطية من الوضع الحالي قبل الاستعادة
        if (options.createBackupFirst !== false) {
            Logger.log('Creating backup before restore...');
            const preRestoreBackup = performBackup('pre-restore', userData, spreadsheetId);
            if (!preRestoreBackup.success) {
                Logger.log('Warning: Could not create pre-restore backup');
            }
        }
        
        // فتح ملف النسخة الاحتياطية
        const backupSpreadsheet = SpreadsheetApp.openById(backup.fileId);
        const currentSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
        
        // الأوراق المراد استعادتها (يمكن تحديدها أو استعادة الكل)
        const sheetsToRestore = options.sheets || null;
        const backupSheets = backupSpreadsheet.getSheets();
        
        let restoredSheets = [];
        let errors = [];
        
        backupSheets.forEach(function(backupSheet) {
            const sheetName = backupSheet.getName();
            
            // تجاهل ورقة سجل النسخ الاحتياطية
            if (sheetName === 'BackupLog' || sheetName === 'BackupSettings') {
                return;
            }
            
            // التحقق من أن الورقة في القائمة (إذا تم تحديد أوراق معينة)
            if (sheetsToRestore && !sheetsToRestore.includes(sheetName)) {
                return;
            }
            
            try {
                // الحصول على بيانات النسخة الاحتياطية
                const backupData = backupSheet.getDataRange().getValues();
                
                // الحصول على أو إنشاء الورقة في الجدول الحالي
                let currentSheet = currentSpreadsheet.getSheetByName(sheetName);
                
                if (!currentSheet) {
                    currentSheet = currentSpreadsheet.insertSheet(sheetName);
                }
                
                // مسح البيانات الحالية
                currentSheet.clear();
                
                // كتابة البيانات من النسخة الاحتياطية
                if (backupData.length > 0) {
                    currentSheet.getRange(1, 1, backupData.length, backupData[0].length).setValues(backupData);
                    
                    // تنسيق الرأس
                    currentSheet.getRange(1, 1, 1, backupData[0].length).setFontWeight('bold').setBackground('#4a90d9').setFontColor('#ffffff');
                }
                
                restoredSheets.push(sheetName);
                
            } catch (sheetError) {
                Logger.log('Error restoring sheet ' + sheetName + ': ' + sheetError.toString());
                errors.push({
                    sheet: sheetName,
                    error: sheetError.toString()
                });
            }
        });
        
        // تسجيل عملية الاستعادة
        saveBackupLog({
            id: generateBackupId(),
            backupType: 'restore',
            status: errors.length === 0 ? 'completed' : 'completed_with_errors',
            restoredFromBackupId: backupId,
            restoredSheets: JSON.stringify(restoredSheets),
            errors: errors.length > 0 ? JSON.stringify(errors) : '',
            createdBy: userData ? userData.name : 'Unknown',
            createdById: userData ? userData.id : 'unknown',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }, spreadsheetId);
        
        // تسجيل في سجل المراجعة
        addAuditLogToSheet({
            userId: userData ? userData.id : 'unknown',
            userName: userData ? userData.name : 'Unknown',
            action: 'RESTORE_BACKUP',
            module: 'Backup',
            details: 'استعادة من نسخة احتياطية: ' + backupId + ' - أوراق تم استعادتها: ' + restoredSheets.join(', ')
        });
        
        return {
            success: true,
            message: 'تمت استعادة البيانات بنجاح',
            data: {
                restoredSheets: restoredSheets,
                restoredCount: restoredSheets.length,
                errors: errors,
                errorsCount: errors.length
            }
        };
        
    } catch (error) {
        Logger.log('Error in restoreFromBackup: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء استعادة البيانات: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * إعداد النسخ الاحتياطي التلقائي
 * ============================================
 * 
 * يتم استدعاء هذه الدالة لإنشاء Triggers للنسخ الاحتياطي التلقائي
 */
function setupAutomaticBackup() {
    try {
        const settings = _backup_getEffectiveSettings_();
        const times = _backup_normalizeTimes_(settings.backupTimes, ['06:00', '18:00']);
        const hours = times.map(function(t) {
            const m = String(t).match(/^(\d{2}):(\d{2})$/);
            return m ? Number(m[1]) : null;
        }).filter(function(h) {
            return h !== null && isFinite(h) && !isNaN(h) && h >= 0 && h <= 23;
        });
        const uniqueHours = [...new Set(hours.length ? hours : BACKUP_TIMES)];

        // حذف Triggers القديمة
        const triggers = ScriptApp.getProjectTriggers();
        triggers.forEach(function(trigger) {
            if (trigger.getHandlerFunction() === 'createAutomaticBackup') {
                ScriptApp.deleteTrigger(trigger);
            }
        });
        
        // إنشاء Triggers حسب الإعدادات (Apps Script يدعم atHour فقط)
        uniqueHours.forEach(function(h) {
            ScriptApp.newTrigger('createAutomaticBackup')
                .timeBased()
                .atHour(h)
                .everyDays(1)
                .create();
        });
        
        Logger.log('Automatic backup triggers created successfully');
        
        return {
            success: true,
            message: 'تم إعداد النسخ الاحتياطي التلقائي بنجاح (الساعات: ' + uniqueHours.map(h => String(h).padStart(2,'0') + ':00').join(', ') + ')'
        };
        
    } catch (error) {
        Logger.log('Error in setupAutomaticBackup: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء إعداد النسخ الاحتياطي التلقائي: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * إيقاف النسخ الاحتياطي التلقائي
 * ============================================
 */
function disableAutomaticBackup() {
    try {
        const triggers = ScriptApp.getProjectTriggers();
        let deletedCount = 0;
        
        triggers.forEach(function(trigger) {
            if (trigger.getHandlerFunction() === 'createAutomaticBackup') {
                ScriptApp.deleteTrigger(trigger);
                deletedCount++;
            }
        });
        
        Logger.log('Disabled ' + deletedCount + ' automatic backup triggers');
        
        return {
            success: true,
            message: 'تم إيقاف النسخ الاحتياطي التلقائي بنجاح',
            deletedTriggers: deletedCount
        };
        
    } catch (error) {
        Logger.log('Error in disableAutomaticBackup: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء إيقاف النسخ الاحتياطي التلقائي: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * الحصول على حالة النسخ الاحتياطي التلقائي
 * ============================================
 */
function getAutomaticBackupStatus() {
    try {
        const settings = _backup_getEffectiveSettings_();
        const triggers = ScriptApp.getProjectTriggers();
        const backupTriggers = [];
        
        triggers.forEach(function(trigger) {
            if (trigger.getHandlerFunction() === 'createAutomaticBackup') {
                backupTriggers.push({
                    id: trigger.getUniqueId(),
                    type: trigger.getEventType().toString(),
                    handlerFunction: trigger.getHandlerFunction()
                });
            }
        });
        
        return {
            success: true,
            data: {
                enabled: backupTriggers.length > 0,
                triggersCount: backupTriggers.length,
                triggers: backupTriggers,
                scheduledTimes: backupTriggers.length > 0 ? (settings.backupTimes || ['06:00', '18:00']) : []
            }
        };
        
    } catch (error) {
        Logger.log('Error in getAutomaticBackupStatus: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء جلب حالة النسخ الاحتياطي التلقائي: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * الحصول على إعدادات النسخ الاحتياطي
 * ============================================
 */
function getBackupSettings() {
    try {
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet('BackupSettings', spreadsheetId);
        
        if (!data || data.length === 0) {
            // إرجاع الإعدادات الافتراضية
            return {
                success: true,
                data: {
                    autoBackupEnabled: false,
                    backupTimes: ['06:00', '18:00'],
                    maxBackupFiles: MAX_BACKUP_FILES,
                    backupFolderName: BACKUP_FOLDER_NAME,
                    retentionDays: 30,
                    notifyOnBackup: true,
                    notifyOnFailure: true
                }
            };
        }
        
        return {
            success: true,
            data: data[0]
        };
        
    } catch (error) {
        Logger.log('Error in getBackupSettings: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء جلب إعدادات النسخ الاحتياطي: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * حفظ إعدادات النسخ الاحتياطي
 * ============================================
 */
function saveBackupSettings(settings, userData) {
    try {
        const spreadsheetId = getSpreadsheetId();
        const ss = SpreadsheetApp.openById(spreadsheetId);
        
        // الحصول على أو إنشاء ورقة الإعدادات
        let sheet = ss.getSheetByName('BackupSettings');
        
        if (!sheet) {
            sheet = ss.insertSheet('BackupSettings');
            const headers = getDefaultHeaders('BackupSettings');
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
            sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4a90d9').setFontColor('#ffffff');
        }
        
        // تحديث أو إضافة الإعدادات (مع تنظيف/دمج الافتراضيات)
        const existingData = sheet.getDataRange().getValues();
        
        // اقرأ الإعدادات السابقة إن وجدت لتفادي فقد القيم
        let prev = {};
        try {
            const prevRes = getBackupSettings();
            prev = (prevRes && prevRes.success && prevRes.data) ? prevRes.data : {};
        } catch (ePrev) {
            prev = {};
        }

        const merged = Object.assign({}, _backup_getEffectiveSettings_(), prev || {}, settings || {});

        merged.id = merged.id || 'backup_settings_1';
        merged.updatedAt = new Date().toISOString();
        merged.updatedBy = userData ? userData.name : 'Unknown';
        merged.updatedById = userData ? userData.id : 'unknown';

        // تطبيع الأنواع قبل الحفظ
        merged.autoBackupEnabled = _backup_toBool_(merged.autoBackupEnabled, false);
        merged.notifyOnBackup = _backup_toBool_(merged.notifyOnBackup, true);
        merged.notifyOnFailure = _backup_toBool_(merged.notifyOnFailure, true);
        merged.maxBackupFiles = _backup_toPositiveInt_(merged.maxBackupFiles, MAX_BACKUP_FILES);
        merged.retentionDays = _backup_toPositiveInt_(merged.retentionDays, 30);
        merged.backupFolderName = (merged.backupFolderName === null || merged.backupFolderName === undefined)
            ? BACKUP_FOLDER_NAME
            : String(merged.backupFolderName).trim();
        if (!merged.backupFolderName) merged.backupFolderName = BACKUP_FOLDER_NAME;
        merged.backupTimes = _backup_normalizeTimes_(merged.backupTimes, ['06:00', '18:00']);
        
        const headers = getDefaultHeaders('BackupSettings');
        const rowData = headers.map(function(header) {
            if (typeof merged[header] === 'object') {
                return JSON.stringify(merged[header]);
            }
            return merged[header] || '';
        });
        
        if (existingData.length > 1) {
            // تحديث الصف الموجود
            sheet.getRange(2, 1, 1, headers.length).setValues([rowData]);
        } else {
            // إضافة صف جديد
            sheet.appendRow(rowData);
        }
        
        // تطبيق إعدادات النسخ التلقائي
        if (merged.autoBackupEnabled) {
            setupAutomaticBackup();
        } else {
            disableAutomaticBackup();
        }
        
        return {
            success: true,
            message: 'تم حفظ إعدادات النسخ الاحتياطي بنجاح'
        };
        
    } catch (error) {
        Logger.log('Error in saveBackupSettings: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء حفظ إعدادات النسخ الاحتياطي: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * استيراد نسخة احتياطية من ملف Google Sheets (ID/URL)
 * ============================================
 * - الهدف: إضافة النسخة لقائمة النسخ الاحتياطية ثم يمكن الاستعادة منها
 * - ملاحظة: ملفات XLSX لا يمكن فتحها كـ Spreadsheet مباشرة. يجب تحويلها إلى Google Sheets أولاً.
 */
function importBackupFromFile(fileIdOrUrl, userData, options) {
    try {
        options = options || {};
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            return { success: false, message: 'معرف جدول البيانات غير محدد' };
        }

        const fileId = _backup_extractDriveFileId_(fileIdOrUrl);
        if (!fileId) {
            return { success: false, message: 'معرف/رابط الملف غير صالح. الرجاء إرسال File ID أو رابط Google Sheets.' };
        }

        let sourceFile;
        try {
            sourceFile = DriveApp.getFileById(fileId);
        } catch (eFile) {
            return { success: false, message: 'لا يمكن الوصول للملف. تحقق من الصلاحيات/المعرف.' };
        }

        const mime = (() => { try { return sourceFile.getMimeType(); } catch (e) { return ''; } })();
        if (mime && mime !== MimeType.GOOGLE_SHEETS) {
            return {
                success: false,
                message: 'الملف ليس Google Sheets. إذا كانت النسخة بصيغة XLSX: افتحها في Google Drive ثم "Save as Google Sheets" وبعدها أعد المحاولة.'
            };
        }

        // تحقق أن الملف يمكن فتحه كـ Spreadsheet
        try {
            SpreadsheetApp.openById(fileId);
        } catch (eOpen) {
            return { success: false, message: 'تعذر فتح الملف كـ Google Sheets. تحقق من أن الملف Spreadsheet وصالح.' };
        }

        const settings = _backup_getEffectiveSettings_();
        const backupFolder = getOrCreateBackupFolder(settings.backupFolderName);

        // افتراضياً: نعمل Copy داخل مجلد النسخ الاحتياطية حتى لا نعتمد على ملف خارجي قد يُحذف
        let importedFileId = fileId;
        let importedFileUrl = sourceFile.getUrl();
        let importedName = sourceFile.getName();

        if (options.makeCopy !== false) {
            const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
            const targetName = (options.backupName ? String(options.backupName).trim() : importedName) || importedName;
            const copyFile = sourceFile.makeCopy(targetName + '_Imported_' + timestamp, backupFolder);
            importedFileId = copyFile.getId();
            importedFileUrl = copyFile.getUrl();
            importedName = copyFile.getName();
        }

        const importedSpreadsheet = SpreadsheetApp.openById(importedFileId);
        const sheetsInfo = getBackupSheetsInfo(importedSpreadsheet);

        const file = DriveApp.getFileById(importedFileId);
        const fileSize = file.getSize();

        let sourceSpreadsheetName = '';
        try {
            sourceSpreadsheetName = SpreadsheetApp.openById(spreadsheetId).getName();
        } catch (eName) {
            sourceSpreadsheetName = '';
        }

        const backupLog = {
            id: generateBackupId(),
            backupType: 'import',
            backupName: importedName,
            fileId: importedFileId,
            fileUrl: importedFileUrl,
            fileName: importedName,
            fileSize: fileSize,
            fileSizeFormatted: formatFileSize(fileSize),
            sheetsCount: sheetsInfo.sheetsCount,
            totalRecords: sheetsInfo.totalRecords,
            sheetsDetails: JSON.stringify(sheetsInfo.details),
            sourceSpreadsheetId: spreadsheetId,
            sourceSpreadsheetName: sourceSpreadsheetName,
            status: 'completed',
            duration: '',
            createdBy: userData ? userData.name : 'Unknown',
            createdById: userData ? userData.id : 'unknown',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        saveBackupLog(backupLog, spreadsheetId);
        cleanupOldBackups(backupFolder, settings);

        addAuditLogToSheet({
            userId: userData ? userData.id : 'unknown',
            userName: userData ? userData.name : 'Unknown',
            action: 'IMPORT_BACKUP',
            module: 'Backup',
            details: 'استيراد نسخة احتياطية من ملف: ' + fileId + ' => ' + importedFileId
        });

        return {
            success: true,
            message: 'تم استيراد النسخة الاحتياطية بنجاح',
            data: {
                backupId: backupLog.id,
                backupName: importedName,
                fileId: importedFileId,
                fileUrl: importedFileUrl,
                fileSize: backupLog.fileSizeFormatted,
                sheetsCount: sheetsInfo.sheetsCount,
                totalRecords: sheetsInfo.totalRecords,
                createdAt: backupLog.createdAt
            }
        };
    } catch (error) {
        Logger.log('Error in importBackupFromFile: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء استيراد النسخة الاحتياطية: ' + error.toString() };
    }
}

/**
 * ============================================
 * الحصول على إحصائيات النسخ الاحتياطي
 * ============================================
 */
function getBackupStatistics() {
    try {
        const backupsResult = getAllBackups({});
        
        if (!backupsResult.success) {
            return backupsResult;
        }
        
        const backups = backupsResult.data;
        
        // حساب الإحصائيات
        const totalBackups = backups.length;
        const successfulBackups = backups.filter(function(b) { return b.status === 'completed'; }).length;
        const failedBackups = backups.filter(function(b) { return b.status === 'failed'; }).length;
        const manualBackups = backups.filter(function(b) { return b.backupType === 'manual'; }).length;
        const automaticBackups = backups.filter(function(b) { return b.backupType === 'automatic'; }).length;
        
        // آخر نسخة احتياطية ناجحة
        const lastSuccessful = backups.find(function(b) { return b.status === 'completed'; });
        
        // حجم جميع النسخ الاحتياطية
        let totalSize = 0;
        backups.forEach(function(b) {
            if (b.fileSize) {
                totalSize += parseInt(b.fileSize) || 0;
            }
        });
        
        return {
            success: true,
            data: {
                totalBackups: totalBackups,
                successfulBackups: successfulBackups,
                failedBackups: failedBackups,
                manualBackups: manualBackups,
                automaticBackups: automaticBackups,
                successRate: totalBackups > 0 ? ((successfulBackups / totalBackups) * 100).toFixed(1) + '%' : '0%',
                lastSuccessfulBackup: lastSuccessful ? {
                    id: lastSuccessful.id,
                    date: lastSuccessful.createdAt,
                    type: lastSuccessful.backupType
                } : null,
                totalStorageUsed: formatFileSize(totalSize)
            }
        };
        
    } catch (error) {
        Logger.log('Error in getBackupStatistics: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء جلب إحصائيات النسخ الاحتياطي: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * تحميل نسخة احتياطية
 * ============================================
 */
function downloadBackup(backupId) {
    try {
        const backupResult = getBackup(backupId);
        
        if (!backupResult.success) {
            return backupResult;
        }
        
        const backup = backupResult.data;
        
        if (!backup.fileId) {
            return {
                success: false,
                message: 'ملف النسخة الاحتياطية غير موجود'
            };
        }
        
        try {
            const file = DriveApp.getFileById(backup.fileId);
            
            return {
                success: true,
                data: {
                    fileUrl: file.getUrl(),
                    downloadUrl: 'https://docs.google.com/spreadsheets/d/' + backup.fileId + '/export?format=xlsx',
                    fileName: backup.backupName || backup.fileName,
                    fileSize: backup.fileSizeFormatted
                }
            };
        } catch (driveError) {
            return {
                success: false,
                message: 'ملف النسخة الاحتياطية غير متاح أو تم حذفه'
            };
        }
        
    } catch (error) {
        Logger.log('Error in downloadBackup: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء جلب رابط التحميل: ' + error.toString()
        };
    }
}

/**
 * ============================================
 * دوال مساعدة
 * ============================================
 */

/**
 * إنشاء معرف فريد للنسخة الاحتياطية
 */
function generateBackupId() {
    return 'BKP_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * تنسيق حجم الملف
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * ============================================
 * دالة اختبار النسخ الاحتياطي
 * ============================================
 */
function testBackupSystem() {
    try {
        Logger.log('Testing backup system...');
        const settings = _backup_getEffectiveSettings_();
        
        // اختبار إنشاء مجلد النسخ الاحتياطية
        const folder = getOrCreateBackupFolder(settings.backupFolderName);
        Logger.log('Backup folder ID: ' + folder.getId());
        
        // اختبار الحصول على الإحصائيات
        const stats = getBackupStatistics();
        Logger.log('Backup statistics: ' + JSON.stringify(stats));
        
        // اختبار حالة النسخ التلقائي
        const status = getAutomaticBackupStatus();
        Logger.log('Automatic backup status: ' + JSON.stringify(status));
        
        return {
            success: true,
            message: 'اختبار نظام النسخ الاحتياطي ناجح',
            folderReady: true,
            effectiveSettings: settings,
            statistics: stats.data,
            automaticBackupStatus: status.data
        };
        
    } catch (error) {
        Logger.log('Error in testBackupSystem: ' + error.toString());
        return {
            success: false,
            message: 'فشل اختبار نظام النسخ الاحتياطي: ' + error.toString()
        };
    }
}
