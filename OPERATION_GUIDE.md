# Operation and Deployment Documentation (Operation Guide)

هذا المستند يوضح كيفية تشغيل ونشر المشروع باستخدام **Vercel** للواجهة الأمامية و **Supabase** للواجهة الخلفية وقاعدة البيانات.

## 1. المتطلبات الأساسية
- حساب على [Supabase](https://supabase.com/).
- حساب على [Vercel](https://vercel.com/).
- Supabase CLI مثبت (اختياري للتطوير المحلي).

## 2. إعداد قاعدة البيانات (Supabase)
1. قم بإنشاء مشروع جديد على Supabase.
2. اذهب إلى **SQL Editor** وقم بتشغيل ملفات الهجرة الموجودة في المجلد `supabase/migrations/` بالترتيب التاريخي لإنشاء الجداول والقيود.
3. تأكد من تفعيل **Storage** وإنشاء bucket باسم `hse-attachments` وجعله Public (أو ضبط سياسات الوصول RLS).

## 3. إعداد الواجهة الخلفية (Supabase Edge Functions)
1. قم بنشر الدالة الموجودة في `supabase/functions/hse-api`:
   ```bash
   supabase functions deploy hse-api
   ```
2. قم بضبط المتغيرات السرية (Secrets) في Supabase:
   - `DATABASE_URL`: رابط الاتصال المباشر بقاعدة البيانات (Direct Connection String).
   - `HSE_API_KEY`: (اختياري) مفتاح حماية إضافي لمطابقة الطلبات.
   - `OPENAI_API_KEY`: (اختياري) لمميزات الذكاء الاصطناعي.

## 4. إعداد الواجهة الأمامية (Frontend)
تعتمد الواجهة الأمامية على ملف `Frontend/dist/bundle.js`. لإنشاء هذا الملف:
```bash
cd Frontend
npm install
npm run build
```

### متغيرات البيئة (Vercel)
عند النشر على Vercel، تأكد من ضبط الإعدادات التالية في لوحة تحكم Vercel (Environment Variables) أو عبر ملف محلي:
- `__HSE_RPC_URL__`: رابط الـ Edge Function المنشورة (مثلاً `https://[project-ref].supabase.co/functions/v1/hse-api`).
- `__HSE_USE_SUPABASE__`: ضبطه على `true`.
- `__HSE_SUPABASE_ANON_KEY__`: مفتاح anon من لوحة تحكم Supabase.

## 5. التشغيل المحلي (Development)
للإقلاع السريع محلياً دون نشر:
1. أنشئ ملف `Frontend/secrets.local.js` (مستوحى من `secrets.local.example.js`).
2. ضع فيه الروابط والمفاتيح الخاصة ببيئة الاختبار الخاصة بك.
3. استخدم خادم محلي مثل `http-server`:
   ```bash
   cd Frontend
   npx http-server . -p 8080
   ```

## 6. التحقق من الاتصال
يمكنك التأكد من أن كل شيء يعمل عبر:
1. فتح التطبيق في المتصفح.
2. تسجيل الدخول باستخدام حساب المسؤول (الافتراضي: `yasser@icapp.com` / `admin123`).
3. التحقق من ظهور علامة "متصل" في القائمة الجانبية.
4. مراجعة سجلات المتصفح (Console) للتأكد من عدم وجود أخطاء `NOT_IMPLEMENTED`.
