# تجهيز المشروع للنشر على Render

هذا المشروع تطبيق كامل يحتوي على واجهة وخادم وقاعدة بيانات، ولذلك يجب نشره كـ **Web Service** وليس **Static Site**.

## الطريقة الأسرع: Blueprint

1. ارفع محتويات هذا المجلد كاملة إلى GitHub.
2. من Render اختر **New +** ثم **Blueprint**.
3. اربط مستودع GitHub الذي يحتوي على المشروع.
4. سيقرأ Render ملف `render.yaml` ويضبط تلقائياً:
   - Runtime: Node
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
   - Health Check: `/api/health`
   - Node Environment: `production`
5. عند ظهور حقل `DATABASE_URL`، الصق فيه رابط اتصال PostgreSQL الذي نسخته من Neon.
6. أنشئ الخدمة وانتظر اكتمال البناء.

## إذا كانت خدمة Web Service موجودة بالفعل

افتح الخدمة في Render ثم انتقل إلى **Environment** وأضف:

```text
DATABASE_URL=رابط_الاتصال_الكامل_من_Neon
NODE_ENV=production
```

لا حاجة لإضافة `CLIENT_ORIGIN` لرابط Render العادي؛ يتعرّف التطبيق عليه تلقائياً. عند استعمال نطاق مخصص، يمكن إضافة:

```text
CLIENT_ORIGIN=https://example.com
```

إذا كان لديك أكثر من نطاق مسموح، افصل بينها بفاصلة:

```text
CLIENT_ORIGIN=https://example.com,https://www.example.com
```

بعد الحفظ اختر **Manual Deploy** ثم **Deploy latest commit**.

## تنبيه أمني

- لا تكتب رابط `DATABASE_URL` الحقيقي داخل `render.yaml` أو `.env.example`.
- لا ترفع ملف `.env` إلى GitHub.
- رابط قاعدة البيانات يحتوي على اسم مستخدم وكلمة مرور ويجب أن يبقى داخل إعدادات Render السرية فقط.
- للاستخدام الطبي الحقيقي، استخدم خطة استضافة وقاعدة بيانات مناسبة للنسخ الاحتياطي ومتطلبات حماية البيانات المحلية.
