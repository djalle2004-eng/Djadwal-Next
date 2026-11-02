# خريطة توجيه الوحدات المعيارية والبروكسي (Djadwal Route & Module Architecture Map)

## نظرة عامة
توثّق هذه الوثيقة البنية المعيارية بعد تفكيك ملف `server/routes.js` الضخم إلى وحدات متخصصة تحت `server/modules/*`، مع ربطها بمسارات عقد `OpenAPI 3.1` الحديثة (`/api/v1`) ومسارات التوافق القديمة (`/api`) وفق نمط **Strangler Fig Proxy**.

---

## 1. جدول خريطة المسارات والوحدات (Route to Module Mapping)

| المسار القديم (`/api`) | المسار الحديث (`/api/v1`) | الطريقة | الوحدة المسؤولة (`server/modules/*`) | طبقة المستودع (`@djadwal/core`) | مفتاح عدم التكرار (`Idempotency-Key`) | وضع التوجيه (`Strangler Mode`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/ping` | `/api/v1/ping` | `GET` | `server/server.js` (In-Memory) | معزول (Zero DB Touch) | غير مدعوم (قراءة) | فوري (لا يخضع للبروكسي) |
| `/api/departments` | `/api/v1/catalog/departments` | `GET` | `catalog/departments.js` | `departmentsRepository.list()` | غير مدعوم (قراءة) | `ROUTE_DEPARTMENTS` (`legacy\|v1\|shadow`) |
| `/api/departments/:id` | `/api/v1/catalog/departments/:id` | `GET` | `catalog/departments.js` | `departmentsRepository.get()` | غير مدعوم (قراءة) | مباشر |
| `/api/departments` | `/api/v1/catalog/departments` | `POST` | `catalog/departments.js` | `departmentsRepository.create()` | **مدعوم** (24h TTL) | مباشر (يمنع التكرار في shadow) |
| `/api/departments/:id` | `/api/v1/catalog/departments/:id` | `PUT` | `catalog/departments.js` | `departmentsRepository.update()` | **مدعوم** (24h TTL) | مباشر |
| `/api/departments/:id` | `/api/v1/catalog/departments/:id` | `DELETE` | `catalog/departments.js` | `departmentsRepository.archive()` | **مدعوم** (24h TTL) | مباشر |
| `/api/departments/:id/archive-cascade` | `/api/v1/catalog/departments/:id/archive-cascade` | `POST` | `catalog/departments.js` | `unitOfWork` + `departmentsRepository` | **مدعوم** (24h TTL) | مباشر |
| `/api/rooms` | `/api/v1/catalog/rooms` | `GET` | `catalog/rooms.js` | `roomsRepository.list()` | غير مدعوم (قراءة) | `ROUTE_ROOMS` (`legacy\|v1\|shadow`) |
| `/api/rooms/:id` | `/api/v1/catalog/rooms/:id` | `GET` | `catalog/rooms.js` | `roomsRepository.get()` | غير مدعوم (قراءة) | مباشر |
| `/api/rooms` | `/api/v1/catalog/rooms` | `POST` | `catalog/rooms.js` | `roomsRepository.create()` | **مدعوم** (24h TTL) | مباشر |
| `/api/rooms/:id` | `/api/v1/catalog/rooms/:id` | `PUT` | `catalog/rooms.js` | `roomsRepository.update()` | **مدعوم** (24h TTL) | مباشر |
| `/api/rooms/:id` | `/api/v1/catalog/rooms/:id` | `DELETE` | `catalog/rooms.js` | `roomsRepository.archive()` | **مدعوم** (24h TTL) | مباشر |
| `/api/courses` | `/api/v1/catalog/courses` | `GET` | `catalog/courses.js` | `coursesRepository.list()` | غير مدعوم (قراءة) | `ROUTE_COURSES` (`legacy\|v1\|shadow`) |
| `/api/courses/:id` | `/api/v1/catalog/courses/:id` | `GET` | `catalog/courses.js` | `coursesRepository.get()` | غير مدعوم (قراءة) | مباشر |
| `/api/courses` | `/api/v1/catalog/courses` | `POST` | `catalog/courses.js` | `coursesRepository.create()` | **مدعوم** (24h TTL) | مباشر |
| `/api/courses/:id` | `/api/v1/catalog/courses/:id` | `PUT` | `catalog/courses.js` | `coursesRepository.update()` | **مدعوم** (24h TTL) | مباشر |
| `/api/courses/:id` | `/api/v1/catalog/courses/:id` | `DELETE` | `catalog/courses.js` | `coursesRepository.archive()` | **مدعوم** (24h TTL) | مباشر |
| `/api/groups` | `/api/v1/catalog/groups` | `GET` | `catalog/groups.js` | `groupsRepository.list()` | غير مدعوم (قراءة) | `ROUTE_GROUPS` (`legacy\|v1\|shadow`) |
| `/api/groups/:id` | `/api/v1/catalog/groups/:id` | `GET` | `catalog/groups.js` | `groupsRepository.get()` | غير مدعوم (قراءة) | مباشر |
| `/api/groups` | `/api/v1/catalog/groups` | `POST` | `catalog/groups.js` | `groupsRepository.create()` | **مدعوم** (24h TTL) | مباشر |
| `/api/groups/:id` | `/api/v1/catalog/groups/:id` | `PUT` | `catalog/groups.js` | `groupsRepository.update()` | **مدعوم** (24h TTL) | مباشر |
| `/api/groups/:id` | `/api/v1/catalog/groups/:id` | `DELETE` | `catalog/groups.js` | `groupsRepository.archive()` | **مدعوم** (24h TTL) | مباشر |
| `/api/professors` | `/api/v1/professors` | `GET` | `professors/index.js` | `professorsRepository.list()` | غير مدعوم (قراءة) | `ROUTE_PROFESSORS` (`legacy\|v1\|shadow`) |
| `/api/professors/:id` | `/api/v1/professors/:id` | `GET` | `professors/index.js` | `professorsRepository.get()` | غير مدعوم (قراءة) | مباشر |
| `/api/professors` | `/api/v1/professors` | `POST` | `professors/index.js` | `professorsRepository.create()` | **مدعوم** (24h TTL) | مباشر |
| `/api/professors/:id` | `/api/v1/professors/:id` | `PUT` | `professors/index.js` | `professorsRepository.update()` | **مدعوم** (24h TTL) | مباشر |
| `/api/professors/:id` | `/api/v1/professors/:id` | `DELETE` | `professors/index.js` | `professorsRepository.archive()` | **مدعوم** (24h TTL) | مباشر |
| `/api/professors/bulk-import` | `/api/v1/professors/bulk-import` | `POST` | `professors/index.js` | `unitOfWork` + `professorsRepository` | **مدعوم** (24h TTL) | مباشر |
| `/api/assignments` | `/api/v1/assignments` | `GET` | `assignments/index.js` | `assignmentsRepository.list()` | غير مدعوم (قراءة) | `ROUTE_ASSIGNMENTS` (`legacy\|v1\|shadow`) |
| `/api/assignments/:id` | `/api/v1/assignments/:id` | `GET` | `assignments/index.js` | `assignmentsRepository.get()` | غير مدعوم (قراءة) | مباشر |
| `/api/assignments` | `/api/v1/assignments` | `POST` | `assignments/index.js` | `assignmentsRepository.create()` | **مدعوم** (24h TTL) | مباشر |
| `/api/assignments/:id` | `/api/v1/assignments/:id` | `PUT` | `assignments/index.js` | `assignmentsRepository.update()` | **مدعوم** (24h TTL) | مباشر |
| `/api/assignments/:id` | `/api/v1/assignments/:id` | `DELETE` | `assignments/index.js` | `assignmentsRepository` | **مدعوم** (24h TTL) | مباشر |
| `/api/assignments/swap` | `/api/v1/assignments/swap` | `POST` | `assignments/index.js` | `assignmentsRepository.swap()` | **مدعوم** (24h TTL) | مباشر |
| `/api/assignments/:id/move` | `/api/v1/assignments/:id/move` | `POST` | `assignments/index.js` | `assignmentsRepository.move()` | **مدعوم** (24h TTL) | مباشر |
| `/api/academic-years` | `/api/v1/academic/years` | `GET` | `academic/index.js` | `academicYearsRepository.list()` | غير مدعوم (قراءة) | مباشر |
| `/api/academic-years` | `/api/v1/academic/years` | `POST` | `academic/index.js` | `unitOfWork` | **مدعوم** | مباشر |
| `/api/semesters` | `/api/v1/academic/semesters` | `GET` | `academic/index.js` | `semestersRepository.list()` | غير مدعوم (قراءة) | مباشر |
| `/api/semesters` | `/api/v1/academic/semesters` | `POST` | `academic/index.js` | `unitOfWork` | **مدعوم** | مباشر |
| `/api/changes` | `/api/v1/changes` | `GET` | `audit/index.js` | `changeLogRepository.getRecent()` | غير مدعوم (قراءة) | مباشر |
| `/api/changes/:id/undo` | `/api/v1/changes/:id/undo` | `POST` | `audit/index.js` | `changeLogRepository.undo()` | **مدعوم** (24h TTL) | مباشر |
| `/api/:entity/:id/delete-impact` | `/api/v1/:entity/:id/delete-impact` | `GET` | `audit/index.js` | `calculateDeleteImpact()` | غير مدعوم (قراءة) | مباشر |
| — | `/api/v1/compat-report` | `GET` | `compat/index.js` | `api_diff_report` | غير مدعوم (قراءة) | حصري لـ V1 |

---

## 2. قواعد التشغيل الظلي ومكافحة التكرار (Shadow & Idempotency Rules)
1. **التشغيل الظلي (Shadow Mode)**:
   - يقتصر حصريًا على استعلامات القراءة (`GET`).
   - تنفّذ القراءتان (القديمة والحديثة) على **Neon PostgreSQL** حصرًا دون أي استعلام على Turso.
   - في حال وجود أي تباين في الحالة أو البيانات المنظمة، يُسجَّل فورًا في `api_diff_report`.
   - تُعاد الاستجابة القديمة للعميل دون أي تأخير ملموس.
2. **عدم التكرار (Idempotency Key)**:
   - يمنع إنشاء سجلات مكررة عند إعادة المحاولة بسبب انقطاع الشبكة.
   - يتم التحقق من بصمة الطلب (`SHA-256`) ومطابقتها قبل إعادة نفس الاستجابة المخزنة.

