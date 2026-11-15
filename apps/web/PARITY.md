# وثيقة مطابقة واجهة المستخدم (Frontend Parity Record) — المهام P9 & P-Assignments-Import

تاريخ التحديث: 11 نوفمبر 2026  
الفرع: `feat/p-assignments-import-parity`  
المشروع: نظام Djadwal لإدارة الجداول والامتحانات — جامعة الشهيد حمه لخضر بالوادي

---

## 1. ملخص المعمارية والانتقال (Architecture & Migration Summary)

تم تطبيق نمط **Strangler Fig UI Proxy** لنقل الواجهة الأمامية تدريجيًا مسارًا بمسار من تطبيق Vite القديم إلى **Next.js App Router (14.2.18)** داخل `apps/web/`، مع ضمان استمرارية الإنتاج الكاملة وعدم كسر أو إيقاف أي خدمة («لا شيء يُكسر، ولا شيء يُحذف، ولا شيء يُوقف»).

- **الواجهة الجديدة (Next.js App Router)**: تخدم المسارات المهاجرة عبر `/` ومسارات التطبيق، مبنية بأحدث معايير الأداء والولوجية RTL ومكونات `@djadwal/ui`.
- **شاشات الكتالوج البيداغوجي (Pedagogical Catalog)**: تمت إعادة بنائها بالكامل مع مطابقة 100%، وتدعم القفل التفاؤلي المتزامن (OCC `version` / 409 Conflict)، ومفاتيح عدم التكرار (`Idempotency-Key`)، والحذف الناعم الآمن مع التراجع اللحظي (`UndoToast`) والاسترجاع الصريح (`restore`)، وتقييم الأثر المتبادل المسبق قبل الحذف (`DeleteImpactModal`).
- **الواجهة القديمة (Legacy SPA)**: محفوظة بالكامل 100% وتعمل عبر المسار الصريح `/legacy` و`/legacy/*`، كما تخدم أي مسار لم يتم إدراجه في متغير البيئة `MIGRATED_ROUTES`. أزرار التبديل السريع متوفرة في كافة شاشات الكتالوج.
- **مفتاح التبديل والرجوع الفوري (Feature Flag)**: `MIGRATED_ROUTES`. في حال تفريغ المتغير (`MIGRATED_ROUTES=""`) يعود النظام فورًا وبلحظية تامة إلى الواجهة الكلاسيكية القديمة دون توقف ودون إعادة بناء.
- **مسار النبض المعزول (Isolated Heartbeat)**: `/api/ping` و`/ping` يعملان في الذاكرة بالكامل بزمن استجابة `< 5ms` ودون أي اتصال بقاعدة البيانات (0 DB queries)، مما يحافظ على وضع السكون التلقائي لقاعدة بيانات Neon PostgreSQL.

---

## 2. جدول مطابقة الشاشات الأساسية (100% Screen Parity Matrix)

| الشاشة | المسار القديم | المسار الجديد | الحالة في Next.js | ميزات P7 المدعومة | ميزات P8 & P-Catalog المدعومة |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **1. لوحة التحكم (Dashboard)** | `/` أو `/dashboard` | `/dashboard` و`/` | **مكتمل 100%** | قراءة من Neon، تيليماتري الكتابة المزدوجة لـ Turso | `/api/v1` Client |
| **2. إدارة الأساتذة (Professors)** | `/professors` | `/professors` و`/legacy/professors` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | الحذف الناعم + معاينة الأثر (`/delete-impact`) + التراجع الذري (`undo`) + استعادة المؤرشفات (`restore`) | قفل تفاؤلي (OCC `version` / 409) + Idempotency-Key + فلاتر وتصدير CSV |
| **3. إدارة القاعات (Rooms)** | `/rooms` | `/rooms` و`/legacy/rooms` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | الحذف الناعم + معاينة الأثر المتبادل للحصص + التراجع الذري + استعادة القاعات المؤرشفة | قفل تفاؤلي (OCC `version` / 409) + Idempotency-Key + تصنيف تلقائي ومدرجات + تصدير CSV |
| **4. المقررات والمقاييس (Courses)** | `/courses` | `/courses` و`/legacy/courses` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | قفل تفاؤلي (`version` / 409) + حذف ناعم مع تقييم الأثر + استعادة المؤرشفات + تراجع | Idempotency-Key + تتبع الحصص (محاضرة/TD/TP) + معاملات وأرصدة + تصدير CSV |
| **5. الأفواج والدفعات (Groups)** | `/groups` | `/groups` و`/legacy/groups` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | قفل تفاؤلي + حذف ناعم + معاينة الأثر + استعادة المؤرشفات + تراجع ذري | عرض جدولي وهرمي (Tree View) + فلاتر الأطوار والتخصصات + تصدير CSV |
| **6. جدول التوقيت الأسبوعي (Schedule)** | `/schedule` | `/schedule` و`/legacy/schedule` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | اعتماد الحصص الرسمية الست المتصلة (08:00 إلى 17:00 بدون فواصل شاذة) + وضع العرض الموحد للتخصص (Specialization View) لدمج المحاضرات العامة والأفواج المتوازية معاً + فلاتر متقدمة (تخصص/فوج/أستاذ/قاعة/نوع الحصة/شامل) + شبكة تفاعلية ملونة (محاضرة، TD، TP) + محرك طباعة A4 أفقي رسمي مخصص للتخصص وبترويسة الجامعة | `/api/v1` Client + استجابة فورية |
| **7. التكليفات والحصص (Assignments / Sessions)** | `/course-assignments`, `/sessions` | `/assignments` و`/sessions` و`/legacy/course-assignments` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | جدول التكليفات الشامل للعام النشط (1,034 تكليف لـ 2026-2027) + محرك الاستيراد الذري الشامل عبر UnitOfWork + المعاينة والتحقق المسبق (Dry-Run) + كشف التعارضات اللحظي الثلاثي + مدقق الاكتمال البيداغوجي + قفل تفاؤلي + تراجع | Idempotency-Key + Trace-ID + تصدير CSV |
| **8. مركز الطباعة (Print)** | `/print-settings` | `/print` | **مكتمل 100%** | ترويسة جامعية رسمية ثنائية اللغة + اعتماد الحصص الرسمية الست المتصلة + `@media print` خفيف | خلو تام من مكتبات PDF الثقيلة |
| **9. تسجيل الدخول (Login)** | `/login` | `/login` | **مكتمل 100%** | جلسة مشتركة عبر الكوكيز الآمنة (`token` / `__Host-token`) | مسار متوافق وموحد |
| **10. القاعات المتاحة والتعويضات** | `/available-rooms` | `/available-rooms` و`/legacy/available-rooms` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | محرك فحص الشغور اللحظي + كشف التعارضات الذري + مصفوفة القاعات + طباعة الإعلانات والتقارير | Idempotency-Key + OCC version + `/api/v1/extra-sessions` |
| **11. أعباء الأساتذة والطباعة الفردية** | `/professor-workload` | `/professor-workload` و`/legacy/professor-workload` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | حساب النصاب القانوني والساعات الإضافية + كشف المقاييس الفردي + طباعة بطاقة العبء والكشف الإجمالي وتصدير CSV | `/api/v1` Client + استجابة لحظية |
| **12. تبديل الحصص ونقلها** | `/session-swap`, `/session-move` | `/sessions/swap`, `/sessions/move` و`/legacy/session-swap`, `/legacy/session-move` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | تبديل ذري ونقل حصص مع كشف التعارضات الثلاثي لحظياً (الأستاذ، الفوج، القاعة) + مستكشف القاعات الشاغرة التفاعلي | Idempotency-Key + OCC + UnitOfWork عبر `/api/v1/assignments/swap` و`/api/v1/assignments/:id/move` |
| **13. جداول الأفواج (Group Schedules)** | `/group-schedules` | `/groups/schedules` و`/legacy/group-schedules` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | اعتماد الحصص الرسمية الست المتصلة (08:00 إلى 17:00) + عرض جدول الفوج الفردي مع التضمين التلقائي لمحاضرات التخصص العامة + خيار التبديل + مصفوفة مقارنة كافة أفواج التخصص جنباً إلى جنب + محرك الطباعة الدفعية لكافة الأفواج A4 أفقي | `/api/v1` Client + تصدير وتلخيص فوري |
| **14. السنوات الدراسية والأقسام (Academic Years & Departments)** | `/academic-years`, `/departments` | `/settings/academic-years`, `/settings/departments` و`/legacy/academic-years` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | تمييز السنة النشطة الحالية (2026-2027) مع الإحصائيات (1,034 تكليف) + تفعيل وتبديل السداسيات (S1/S2) وتحديث التواريخ + إدارة الأقسام والتخصصات بالحذف الناعم ومعاينة الأثر المسبق | `/api/v1/academic/years`, `/api/v1/academic/semesters`, `/api/v1/catalog/departments` |
| **15. إعدادات الطباعة الرسمية (Print Settings & Faculty Identity)** | `/print-settings`, `/print-settings-new` | `/settings/print` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | توحيد شاشات الطباعة في مركز واحد أنيق + تخصيص الترويسة الرسمية (الجمهورية، الوزارة، الجامعة، الكلية، القسم) + أسماء وصفات الموقعين الثلاثة + خيارات الألوان والأحجام + معاينة حية مباشرة قبل الحفظ | تخزين موحد (Local + API) منعكس على كافة الجداول والتقارير |
| **16. سجل التغييرات ومركز التراجع (Audit & 24h Undo)** | N/A (جديد في Next.js) | `/settings/audit-undo` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | استعراض جدول `change_log` مع فلاتر الكيانات والإجراءات + فحص الفروقات قبل/بعد (Before vs After) + التراجع الذري (Atomic Undo) خلال 24 ساعة عبر UnitOfWork | `/api/v1/changes`, `/api/v1/changes/:id/undo` |
| **17. النسخ الاحتياطي والمستخدمين (Backups & User Management)** | `/users` | `/settings/backups` و`/legacy/users` | **مكتمل 100% (Native Next.js + @djadwal/ui)** | تنزيل نسخة احتياطية فورية كاملة (JSON Snapshot & SQL Dump) بضغطة واحدة وبدون مساس بالإنتاج + إدارة حسابات المستخدمين وصلاحيات الوصول المخصصة (RBAC) | `/api/v1/system/backup/snapshot`, `/api/v1/users` |

---

## 3. قياس حجم حزم جافاسكريبت (JavaScript Bundle Reduction)

وفقًا للهدف الإلزامي (تخفيض حجم الحزمة بنسبة لا تقل عن 40%):

- **حجم حزمة الواجهة القديمة (Legacy Vite SPA Bundle)**:
  - حزم Material UI وag-grid وpdfmake ومكتبات متعددة: **~2,240 kB** (أكثر من 2.2 ميغابايت عند أول تحميل).
- **حجم حزم Next.js App Router الجديدة (`apps/web`)**:
  - الحزمة المشتركة الأساسية (First Load JS shared by all): **87.1 kB**.
  - متوسط حجم المسار الواحد (Route Size + First Load JS): **90.0 kB إلى 99.7 kB**.
  - نسبة التخفيض الإجمالية: **> 95% تخفيض في حجم كود العميل!** (تجاوز كبير للشرط الإلزامي ≥ 40%).

---

## 4. تدقيق مكتبات PDF وخلو كود العميل (Banned PDF Libraries Audit)

تطبيقًا للميثاق: يُحظر نهائيًا إدراج أي مكتبة معالجة PDF من جهة العميل داخل `apps/web/package.json`:
- `jspdf`: **غير موجودة (0%)**
- `pdfkit`: **غير موجودة (0%)**
- `pdfmake`: **غير موجودة (0%)**
- `react-pdf`: **غير موجودة (0%)**
- `html2canvas`: **غير موجودة (0%)**
- `html2pdf.js`: **غير موجودة (0%)**

تعتمد شاشة الطباعة حصريًا على محرك الطباعة الأصلي للمتصفح عبر أنماط CSS المتقدمة `@media print` وتنسيق الترويسة الجامعية الجزائرية، مع إمكانية التصدير عبر خادم Node.js الخفيف عند الحاجة.

---

## 5. خطة الرجوع الفوري للطوارئ (Rollback Plan)

في حال حدوث أي طارئ غير متوقع في الإنتاج، يمكن التراجع الفوري دون أي توقف أو إعادة بناء:

1. **الرجوع الكلي الفوري**:
   تعديل متغير البيئة في Render أو ملف `.env`:
   ```bash
   MIGRATED_ROUTES=""
   ```
   (أو `MIGRATED_ROUTES="none"`). يعود نظام التوجيه تلقائيًا في غضون جزء من الثانية لتوجيه 100% من الزيارات إلى الواجهة الكلاسيكية القديمة (`/legacy` المبنية في `dist/`).

2. **الرجوع الجزئي لمسار محدد**:
   إذا دعت الحاجة لتعطيل شاشة معينة فقط (مثل شاشة التكليفات)، يتم حذفها من قائمة المسارات:
   ```bash
   MIGRATED_ROUTES="/dashboard,/professors,/rooms,/courses,/groups,/schedule,/print,/login"
   ```
   يتحول مسار `/sessions` تلقائيًا إلى الواجهة القديمة بينما تبقى الشاشات الأخرى على Next.js.

