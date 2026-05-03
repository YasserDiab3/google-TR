# Frontend ↔ Backend Change Checklist

هذا الملف هو **قالب إلزامي** لأي ميزة/إصلاح يمس بيانات أو مزامنة بين `Frontend` و`Backend` في هذا المشروع.

## مصدر الحقيقة (Source of truth)
- **Backend (Google Apps Script + Google Sheets)**: التخزين الدائم والمرجع النهائي للبيانات.
- **Frontend `AppState.appData`**: حالة تشغيل + كاش محلي (localStorage) قابلة لإعادة البناء من الشيت.

## قبل ما تبدأ (تشخيص سريع)
- **هل الواجهة تفتح؟** هل شاشة الدخول تظهر؟
- **هل فيه خطأ JavaScript قاتل؟** (ReferenceError/TypeError يمنع الإقلاع أو التنقل)
- **هل ربط Google Apps Script مضبوط؟** (scriptUrl + spreadsheetId + CSRF/session)

## تحديد نوع التغيير
اختر نوع/أنواع التغيير (ممكن أكثر من واحد):
- **A) تعديل UI فقط**: لا بيانات جديدة ولا مزامنة.
- **B) إضافة/تعديل حقول لشييت موجود**: schema change.
- **C) إضافة Sheet جديد**.
- **D) إضافة Action/API جديد في GAS** (مخصص أو عام).
- **E) تعديل Mapping للتزامن** بين أسماء الشيت ومفاتيح `AppState.appData`.

## A) UI فقط (Frontend فقط)
- **Frontend module**: حدّد الملف داخل `Frontend/js/modules/modules/<module>.js`.
- **App UI**: لو التغيير يخص الإقلاع/التنقل راجع `Frontend/js/modules/app-ui.js`.
- **i18n**: لو فيه نصوص جديدة تأكد أنها إما مفاتيح i18n أو fallback نصي واضح.

## B) حقول جديدة/معدلة على Sheet موجود
### Backend
- **Headers**: أضف/حدّث الأعمدة في `Backend/Headers.gs` ضمن `getDefaultHeaders()` للشيت المعني.
- **Validation**: ضع في اعتبارك أن الكتابة قد تكون مُتحقَّقة (رفض مفاتيح غير موجودة في headers).

### Frontend
- **Payload compatibility**: تأكد أن أسماء المفاتيح في الـ payload تطابق headers حرفيًا.
- **Local storage**: إذا كانت البيانات كبيرة/مجزأة، تأكد من أن `DataManager` يتعامل معها بدون فقد.

## C) إضافة Sheet جديد
### Backend (Provision + Schema)
- **Config**: أضف الشيت في `Backend/Config.gs` ضمن `getRequiredSheets()` إذا مطلوب إنشاؤه تلقائيًا.
- **Headers**: أضف headers الافتراضية في `Backend/Headers.gs`.
- **(اختياري)**: أي معالجة خاصة بالكتابة/التطبيع تكون في `Backend/Utils.gs` حسب نمط المشروع.

### Frontend (State + Sync)
- **AppState**: أضف مفتاح/هيكل جديد في `Frontend/js/modules/app-utils.js` (ضمن `AppState.appData` defaults).
- **GoogleIntegration sync**:
  - أضف الشيت إلى قائمة القراءة/المزامنة في `Frontend/js/modules/services/google-integration.js` (مثل `baseSheets`/`sheetMapping`/أي خرائط صلاحيات).
- **DataManager mapping**:
  - إن كان الشيت مرتبط بحقل قابل للتخفيف/التجزئة، حدّث الخرائط في `Frontend/js/modules/services/data-manager.js` (مثل `fieldToSheetMap` أو ما يعادلها).

## D) إضافة Action/API جديد في GAS
### Backend
- أضف handler داخل `Backend/Code.gs` (عادة في `doPost` switch أو dispatcher).
- التزم بصيغة الاستجابة الحالية (نجاح/خطأ) حتى لا تكسر `GoogleIntegration`.

### Frontend
- استدعاء عبر `GoogleIntegration.sendRequest/sendToAppsScript` من `Frontend/js/modules/services/google-integration.js`.
- تأكد من تمرير `spreadsheetId` وبيانات الجلسة/CSRF حسب النمط الموجود.

## E) تعديل Mapping للتزامن
- **GoogleIntegration**: أي تغيير في أسماء الشيت أو key داخل `AppState.appData` يجب أن يتزامن في `sheetMapping`.
- **عدم إغفال القراءة**: إضافة كتابة فقط بدون إضافة قراءة/مزامنة = “بيانات موجودة في الشيت لكن لا تظهر بعد refresh”.

## مخاطر شائعة يجب منعها
- **Drift بين `Config.gs` و`Headers.gs`**: شيت مضاف في واحد ومش مضاف في الآخر.
- **فشل validation بسبب key جديد**: Frontend يرسل حقول قبل تحديث headers.
- **Overwrite غير مقصود**: `saveToSheet` قد يستبدل كامل الشيت بدل patch.
- **Pending sync coalescing**: queue قد يحتفظ بآخر snapshot فقط لكل sheetName.

## اختبار سريع إلزامي بعد أي تغيير بيانات
- تشغيل Fresh (مسح localStorage) ثم Login ثم Sync.
- تعديل/حفظ عنصر ثم Refresh والتأكد أنه يرجع من Sheets.
- تجربة Offline تعديل ثم Online والتأكد أن pending sync يفلَش بدون فقد.

