# تشغيل رابط GitHub Pages

هذه النسخة تحتوي على صفحة دخول ثابتة في جذر المستودع تحول الزائر تلقائياً إلى التطبيق الكامل:

`https://medical-raghad-h.onrender.com/`

بهذه الطريقة تبقى الواجهة والخادم والجلسة وقاعدة البيانات على نطاق Render نفسه، وتتجنب مشاكل الكوكيز وتسجيل الدخول التي تنتج عن فصل الواجهة عن الخادم.

## الإعداد

1. ارفع محتويات هذا الفولدر إلى جذر مستودع GitHub.
2. تأكد من وجود `index.html` و`.nojekyll` في جذر المستودع.
3. احذف أي Workflow قديم خاص بـJekyll مثل `jekyll-gh-pages.yml` إن كنت أضفته سابقاً. لا تحذف `.github/workflows/ci.yml` لأنه مسؤول عن اختبارات المشروع.
4. لا تضغط Configure على Jekyll أو Static HTML؛ الملف `.github/workflows/pages.yml` مضاف وجاهز للنشر تلقائياً.
5. من **Settings → Pages** اجعل Source هو **GitHub Actions**.
6. افتح تبويب **Actions** وانتظر نجاح `Publish clinic gateway to GitHub Pages`.
7. افتح رابط `github.io`؛ سينقلك تلقائياً إلى تطبيق Render الكامل.

## ملاحظة مهمة

GitHub Pages يعرض بوابة الانتقال فقط. التطبيق الكامل وقاعدة البيانات يعملان على Render وNeon. يجب أن ينجح نشر Render ويستجيب الرابط العام قبل اختبار رابط GitHub Pages.
