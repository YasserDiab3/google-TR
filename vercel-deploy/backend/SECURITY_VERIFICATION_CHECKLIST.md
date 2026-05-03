# Security Verification Checklist

هذه القائمة لتأكيد سلامة النظام قبل أي إطلاق إنتاجي.

## 1) Entry-point Hardening
- [ ] التحقق أن `doPost` يرفض `skipCSRF/skipCSRFCheck` من العميل.
- [ ] التحقق أن الطلبات كبيرة الحجم (>1MB) تُرفض برسالة واضحة.
- [ ] التحقق أن `action` غير المطابق للنمط الآمن يتم رفضه.
- [ ] التحقق أن `GET` يسمح فقط بالأكشنات المحددة (`getData`, `getProfileImage`, `publicProfileCard`, `getPublicProfileData`).

## 2) CSRF + Session Binding
- [ ] إرسال طلبين بنفس `csrfToken` ونفس `clientSessionId` → يجب أن ينجحا.
- [ ] إرسال طلب بنفس `csrfToken` مع `clientSessionId` مختلف → يجب أن يُرفض.
- [ ] إرسال طلب بدون `csrfToken` لأكشن كتابة → يجب أن يُرفض.

## 3) Input Validation / Injection
- [ ] تجربة `payload` يحتوي حقولًا غير مسموحة في `saveToSheet/appendToSheet` → رفض.
- [ ] تجربة قيم نصية تحتوي `script` أو `onerror` في حقول مستخدم → لا تُنفذ JavaScript في الواجهة.
- [ ] تجربة مفاتيح `__proto__/constructor/prototype` في JSON → يتم تنظيفها.

## 4) Rate Limiting
- [ ] إرسال burst سريع من الطلبات (أكثر من الحد خلال الدقيقة) → تظهر `RATE_LIMIT_EXCEEDED`.
- [ ] التأكد أن بعد انتهاء نافذة الزمن يمكن استئناف الطلبات.

## 5) Security Audit
- [ ] التحقق من إنشاء/تحديث ورقة `SecurityAuditLog`.
- [ ] ظهور أحداث: `csrf_validation_failed`, `rate_limit_blocked`, `payload_validation_failed`.
- [ ] التأكد أن السجل لا يحتوي بيانات سرية (كلمات مرور/توكنات كاملة).

## 6) Regression Checks
- [ ] إنشاء سجل جديد في كل وحدة أساسية (حوادث، تدريب، عيادة...) بدون أخطاء.
- [ ] قراءة البيانات عبر الواجهة تعمل كما كانت.
- [ ] التحقق من عدم وجود كسر في مزامنة `GoogleIntegration.sendRequest`.
