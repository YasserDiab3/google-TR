/**
 * ============================================================
 * ربط نموذج الفحص اليومي للسلامة (Google Form) بجدول التطبيق
 * ============================================================
 *
 * جدول الفورم:
 *   مصنع 1 (ICAPP 1): البيانات من العمود B إلى Y
 *   مصنع 2 (ICAPP 2): البيانات من العمود Y إلى AQ
 *
 * البيانات الأساسية (الموقع، التاريخ، المفتش، الوردية) تُقرأ دائماً من A,B,C,D,E.
 * التاريخ يُخزّن بصيغة YYYY-MM-DD فقط. عمود "الملاحظات الموجودة أثناء المرور" → notes.
 *
 * الفورم:     https://docs.google.com/forms/d/1Ca-Xz2nvqwf45S8aivFLrvlDqJapAwhvFeVIoWfB7jk/
 * جدول الفورم: https://docs.google.com/spreadsheets/d/1dqCGcfLKxjyx0beFjunRymVb_lva-JLSv7Ssy31EVEI/edit
 * جدول المشروع: https://docs.google.com/spreadsheets/d/1EanavJ2OodOmq8b1GagSj8baa-KF-o4mVme_Jlwmgxc/edit
 */

var FORM_SHEET_ID = '1dqCGcfLKxjyx0beFjunRymVb_lva-JLSv7Ssy31EVEI';
var APP_SPREADSHEET_ID = '1EanavJ2OodOmq8b1GagSj8baa-KF-o4mVme_Jlwmgxc';
var FORM_RESPONSES_SHEET_NAME = 'Form Responses 1';
var LAST_PROCESSED_ROW_KEY = 'LAST_PROCESSED_ROW_DAILY_SAFETY_FORM';

var COL_A = 0;
var COL_B = 1;
var COL_X = 23; // عمود X لملاحظات مصنع 1
var COL_F = 5;
var COL_Y = 24;
var COL_AQ = 42; // عمود AQ لملاحظات مصنع 2
var QUESTION_COUNT = 18;

/**
 * تحويل نص التاريخ (مع أو بدون وقت) إلى تاريخ فقط بصيغة YYYY-MM-DD
 */
function formatDateOnly(dateInput) {
  if (!dateInput) return '';
  var s = (typeof dateInput === 'string') ? dateInput.trim() : String(dateInput);
  if (!s) return '';
  var d = new Date(s.replace(/\//g, '-'));
  if (isNaN(d.getTime())) return s.split(' ')[0] || s;
  var y = d.getFullYear();
  var m = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}

/**
 * معالجة البيانات من جدول إجابات الفورم وحفظها في DailySafetyCheckList
 */
function processFormDataFromSheet() {
  try {
    var spreadsheet = SpreadsheetApp.openById(FORM_SHEET_ID);
    var sheet = spreadsheet.getSheetByName(FORM_RESPONSES_SHEET_NAME);
    if (!sheet) {
      sheet = spreadsheet.getSheets()[0];
    }
    if (!sheet) {
      return { success: false, message: 'ورقة إجابات الفورم غير موجودة' };
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'لا توجد إرسالات جديدة' };
    }

    var properties = PropertiesService.getScriptProperties();
    var lastProcessedRow = parseInt(properties.getProperty(LAST_PROCESSED_ROW_KEY) || '0', 10);

    if (lastProcessedRow > lastRow) {
      lastProcessedRow = 0;
      properties.setProperty(LAST_PROCESSED_ROW_KEY, '0');
    }

    if (lastRow <= lastProcessedRow) {
      return { success: false, message: 'لا توجد إرسالات جديدة' };
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var startRow = lastProcessedRow > 0 ? lastProcessedRow + 1 : 2;
    var targetRow = lastRow;
    var rowData = [];
    var foundData = false;

    for (var row = lastRow; row >= startRow; row--) {
      var currentRowData = sheet.getRange(row, 1, row, sheet.getLastColumn()).getValues()[0];
      var nonEmpty = 0;
      for (var c = 0; c < currentRowData.length; c++) {
        if (currentRowData[c] !== null && currentRowData[c] !== undefined && String(currentRowData[c]).trim() !== '') {
          nonEmpty++;
        }
      }
      if (nonEmpty >= 2) {
        targetRow = row;
        rowData = currentRowData;
        foundData = true;
        break;
      }
    }

    if (!foundData && lastRow >= 2 && startRow === 2) {
      for (var row = lastRow - 1; row >= 2; row--) {
        var currentRowData = sheet.getRange(row, 1, row, sheet.getLastColumn()).getValues()[0];
        var nonEmpty = 0;
        for (var c = 0; c < currentRowData.length; c++) {
          if (currentRowData[c] !== null && currentRowData[c] !== undefined && String(currentRowData[c]).trim() !== '') {
            nonEmpty++;
          }
        }
        if (nonEmpty >= 2) {
          targetRow = row;
          rowData = currentRowData;
          foundData = true;
          break;
        }
      }
    }

    if (!foundData) {
      return { success: false, message: 'لا توجد بيانات كافية في الجدول' };
    }

    var recordData = mapFormRowToDailySafetyCheckList(rowData, headers);
    if (!recordData) {
      return { success: false, message: 'فشل تحويل بيانات الصف' };
    }

    var result = saveDailySafetyCheckListToAppSheet(recordData);
    if (result && result.success) {
      properties.setProperty(LAST_PROCESSED_ROW_KEY, String(targetRow));
      return {
        success: true,
        message: 'تم حفظ سجل الفحص اليومي في جدول التطبيق',
        data: recordData,
        originalSheet: FORM_SHEET_ID,
        appSheet: APP_SPREADSHEET_ID
      };
    }
    return { success: false, message: (result && result.message) ? result.message : 'فشل الحفظ' };
  } catch (error) {
    Logger.log('processFormDataFromSheet (DSC): ' + error.toString());
    return { success: false, message: 'حدث خطأ: ' + error.toString() };
  }
}

/**
 * تحديد هل الصف لمصنع 2 (البيانات في Y–AQ)
 */
function isFactory2Row(rowData, headers) {
  if (!rowData || rowData.length <= COL_Y) return false;
  var hasDataInYtoAQ = false;
  for (var c = COL_Y; c < Math.min(COL_Y + QUESTION_COUNT + 2, rowData.length); c++) {
    if (rowData[c] !== null && rowData[c] !== undefined && String(rowData[c]).trim() !== '') {
      hasDataInYtoAQ = true;
      break;
    }
  }
  if (hasDataInYtoAQ) {
    var hasDataInBtoX = false;
    for (var c = COL_F; c < COL_Y && c < rowData.length; c++) {
      if (rowData[c] !== null && rowData[c] !== undefined && String(rowData[c]).trim() !== '') {
        hasDataInBtoX = true;
        break;
      }
    }
    if (!hasDataInBtoX) return true;
    var siteB = (rowData[COL_B] || '').toString().trim();
    if (siteB.indexOf('2') >= 0 || siteB.toLowerCase().indexOf('icapp 2') >= 0 || siteB.indexOf('مصنع 2') >= 0) {
      return true;
    }
  }
  return false;
}

/**
 * تحويل صف من جدول إجابات الفورم إلى كائن مطابق لـ DailySafetyCheckList
 * مصنع 1: أسئلة من F. مصنع 2: أسئلة من Y.
 * الموقع، التاريخ، المفتش، الوردية تُقرأ دائماً من A,B,C,D,E فقط.
 * التاريخ يُخزّن بصيغة YYYY-MM-DD. الوردية لا تأخذ "مطابق"/"غير مطابق".
 */
function mapFormRowToDailySafetyCheckList(rowData, headers) {
  if (!rowData || !headers || rowData.length === 0) return null;

  var useFactory2 = isFactory2Row(rowData, headers);
  var firstQuestionCol = useFactory2 ? COL_Y : COL_F;

  var siteName = (rowData[COL_B] !== undefined && rowData[COL_B] !== null && String(rowData[COL_B]).trim() !== '')
    ? String(rowData[COL_B]).trim() : '';
  var dateStr = (rowData[2] !== undefined && rowData[2] !== null && String(rowData[2]).trim() !== '')
    ? String(rowData[2]).trim() : ((rowData[COL_A] !== undefined && rowData[COL_A] !== null) ? String(rowData[COL_A]).trim() : '');
  var inspectorName = (rowData[3] !== undefined && rowData[3] !== null && String(rowData[3]).trim() !== '')
    ? String(rowData[3]).trim() : '';
  var rawShift = (rowData[4] !== undefined && rowData[4] !== null && String(rowData[4]).trim() !== '')
    ? String(rowData[4]).trim() : '';

  dateStr = formatDateOnly(dateStr);
  if (rawShift === 'الاولي' || rawShift === 'الأولى') rawShift = 'الأولى';
  if (rawShift === 'الثانية') rawShift = 'الثانية';
  if (rawShift === 'الثالية' || rawShift === 'الثالثة') rawShift = 'الثالثة';
  if (rawShift === 'مطابق' || rawShift === 'غير مطابق') rawShift = '';

  var out = {
    id: '',
    siteId: siteName || '',
    siteName: siteName || '',
    date: dateStr || '',
    inspectorName: inspectorName || '',
    shift: rawShift || '',
    q1: '', q2: '', q3: '', q4: '', q5: '', q6: '', q7: '', q8: '', q9: '', q10: '',
    q11: '', q12: '', q13: '', q14: '', q15: '',
    q15Reading: '',
    q16: '', q17: '',
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  var questionKeys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q15Reading', 'q16', 'q17'];
  for (var i = 0; i < questionKeys.length && (firstQuestionCol + i) < rowData.length; i++) {
    var val = rowData[firstQuestionCol + i];
    if (val !== undefined && val !== null) {
      out[questionKeys[i]] = String(val).trim();
    }
  }

  var notesValue = '';
  var notesColIndex = useFactory2 ? COL_AQ : COL_X;

  if (rowData.length > notesColIndex &&
      rowData[notesColIndex] !== undefined &&
      rowData[notesColIndex] !== null &&
      String(rowData[notesColIndex]).trim() !== '') {
    notesValue = String(rowData[notesColIndex]).trim();
  } else {
    var notesStart = useFactory2 ? COL_Y : 0;
    var notesEnd = useFactory2 ? Math.min(COL_Y + QUESTION_COUNT + 5, headers.length) : headers.length;
    for (var c = notesStart; c < notesEnd && c < headers.length; c++) {
      var h = (headers[c] || '').toString().trim();
      if (h === 'الملاحظات الموجودة أثناء المرور' || h.indexOf('ملاحظات') >= 0 || h.toLowerCase() === 'notes') {
        if (rowData[c] !== undefined && rowData[c] !== null && String(rowData[c]).trim() !== '') {
          notesValue = String(rowData[c]).trim();
        }
        break;
      }
    }
  }
  out.notes = notesValue;

  if (!out.date) out.date = formatDateOnly(new Date());

  return out;
}

/**
 * حفظ السجل في ورقة DailySafetyCheckList في جدول التطبيق
 */
function saveDailySafetyCheckListToAppSheet(recordData) {
  try {
    if (!recordData) {
      return { success: false, message: 'بيانات السجل غير موجودة' };
    }

    var sheetName = 'DailySafetyCheckList';
    if (!recordData.id) {
      recordData.id = typeof generateSequentialId === 'function'
        ? generateSequentialId('DSC', sheetName, APP_SPREADSHEET_ID)
        : 'DSC-' + Date.now();
    }
    if (!recordData.siteId && recordData.siteName) {
      recordData.siteId = recordData.siteName;
    }
    if (!recordData.createdAt) {
      recordData.createdAt = new Date();
    }
    if (!recordData.updatedAt) {
      recordData.updatedAt = new Date();
    }

    return typeof appendToSheet === 'function'
      ? appendToSheet(sheetName, recordData, APP_SPREADSHEET_ID)
      : { success: false, message: 'دالة appendToSheet غير متوفرة' };
  } catch (error) {
    Logger.log('saveDailySafetyCheckListToAppSheet: ' + error.toString());
    return { success: false, message: 'حدث خطأ: ' + error.toString() };
  }
}

/**
 * تُستدعى من المشغّل الزمني (كل دقيقة)
 */
function checkForNewDailySafetyFormSubmissions() {
  try {
    var result = processFormDataFromSheet();
    if (result && result.success) {
      Logger.log('DSC Form: تم حفظ سجل - ' + (result.data && result.data.id ? result.data.id : ''));
    }
  } catch (error) {
    Logger.log('checkForNewDailySafetyFormSubmissions: ' + error.toString());
  }
}

/**
 * إعداد المشغّل الزمني (تشغيل يدوي مرة واحدة)
 */
function setupDailySafetyFormTrigger() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'checkForNewDailySafetyFormSubmissions') {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
    ScriptApp.newTrigger('checkForNewDailySafetyFormSubmissions')
      .timeBased()
      .everyMinutes(1)
      .create();
    Logger.log('تم إعداد مشغّل الفحص اليومي (كل دقيقة)');
    return { success: true, message: 'تم إعداد المشغّل بنجاح' };
  } catch (error) {
    Logger.log('setupDailySafetyFormTrigger: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}
