'use client';

import React, { useState } from 'react';
import {
  Button,
  Input,
  Select,
  Checkbox,
  Switch,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  Drawer,
  Tabs,
  TabsList,
  TabTrigger,
  TabContent,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  ToastProvider,
  useToast,
  Skeleton,
  EmptyState,
  ErrorState,
  ErrorDisplay,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  DataGrid,
  Badge,
  Tooltip,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Breadcrumbs,
  Pagination,
  Avatar,
} from '@djadwal/ui';
import {
  Sparkles,
  Search,
  Calendar,
  Layers,
  Users,
  Settings,
  Sun,
  Moon,
  ArrowLeftRight,
  MoreVertical,
  Trash2,
  Edit,
  ExternalLink,
  BookOpen,
} from 'lucide-react';

function DesignSystemContent() {
  const [direction, setDirection] = useState<'rtl' | 'ltr'>('rtl');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Interactive component states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(true);
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [paginationPage, setPaginationPage] = useState(2);

  const { showToast } = useToast();

  const dummyGridData = [
    { id: 1, name: 'د. عبد الله محمد', department: 'علوم اقتصادية', status: 'نشط', workload: '18 ساعة' },
    { id: 2, name: 'أ. فاطمة الزهراء', department: 'علوم التسيير', status: 'نشط', workload: '12 ساعة' },
    { id: 3, name: 'د. يوسف علي', department: 'علوم تجارية', status: 'في عطلة', workload: '0 ساعة' },
    { id: 4, name: 'أ. سارة بن عيسى', department: 'مالية ومحاسبة', status: 'نشط', workload: '16 ساعة' },
    { id: 5, name: 'د. كريم سلطاني', department: 'علوم اقتصادية', status: 'نشط', workload: '14 ساعة' },
  ];

  const gridColumns = [
    { key: 'name', header: 'الأستاذ', sortable: true },
    { key: 'department', header: 'القسم', sortable: true },
    {
      key: 'status',
      header: 'الحالة',
      sortable: true,
      render: (row: any) => (
        <Badge variant={row.status === 'نشط' ? 'success' : 'warning'}>
          {row.status}
        </Badge>
      ),
    },
    { key: 'workload', header: 'الحجم الساعي', sortable: true },
  ];

  return (
    <div
      dir={direction}
      className={theme === 'dark' ? 'dark' : ''}
    >
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-8 transition-colors">
        <div className="max-w-7xl mx-auto space-y-10">
          {/* Header Controls Bar */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight">نظام تصميم Djadwal العربي (UI Design System)</h1>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                حزمة مستقلة (@djadwal/ui) — تدعم RTL أصالةً بخصائص CSS المنطقية، ومعايير WCAG 2.2 AA، وخلو تام من MUI.
              </p>
            </div>

            {/* Quick Interactive Direction and Theme Switchers */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDirection(d => d === 'rtl' ? 'ltr' : 'rtl')}
                startIcon={<ArrowLeftRight className="w-4 h-4" />}
              >
                الاتجاه: {direction.toUpperCase()}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                startIcon={theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              >
                الوضع: {theme === 'light' ? 'داكن' : 'فاتح'}
              </Button>
            </div>
          </header>

          {/* Breadcrumbs Showcase */}
          <section className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Breadcrumbs
              items={[
                { label: 'الرئيسية', href: '/' },
                { label: 'نظام التصميم العربي', href: '/design-system' },
                { label: 'دليل المكونات (20 مكوناً)', current: true },
              ]}
            />
          </section>

          {/* SECTION 1: Buttons & Inputs */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>1. الأزرار وحقول الإدخال (Buttons & Inputs)</span>
              <Badge variant="primary">5 مكونات</Badge>
            </h2>

            <Card>
              <CardHeader>
                <CardTitle>الأزرار (Button Variants & Sizes)</CardTitle>
                <CardDescription>تدعم مختلف الحالات والأنماط والأحجام مع مؤشرات التحميل والرموز المنطقية.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary">أساسي (Primary)</Button>
                  <Button variant="secondary">ثانوي (Secondary)</Button>
                  <Button variant="outline">حدود (Outline)</Button>
                  <Button variant="ghost">شفاف (Ghost)</Button>
                  <Button variant="danger">خطر (Danger)</Button>
                  <Button variant="warning">تحذير (Warning)</Button>
                  <Button variant="primary" isLoading>تحميل...</Button>
                  <Button variant="primary" startIcon={<Calendar className="w-4 h-4" />}>مع أيقونة</Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Input */}
              <Card>
                <CardHeader>
                  <CardTitle>حقول الإدخال (Input)</CardTitle>
                  <CardDescription>مع دعم الأيقونات المنطقية وحالات الخطأ والـ helperText.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="اسم القاعة أو المدرج"
                    placeholder="مثال: قاعة المحاضرات كبرى 1"
                    startIcon={<Search className="w-4 h-4" />}
                    helperText="أدخل التسمية الرسمية للقاعة"
                  />
                  <Input
                    label="الحقل مع حالة خطأ"
                    defaultValue="قاعة غير موجودة"
                    error="هذا المعرف محجوز مسبقاً في قاعدة البيانات"
                  />
                </CardContent>
              </Card>

              {/* Select */}
              <Card>
                <CardHeader>
                  <CardTitle>القوائم المنسدلة (Select)</CardTitle>
                  <CardDescription>مؤشر منسدل في الموضع المنطقي (end-3) مع إمكانية الوصول الكاملة.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select
                    label="السنة الجامعية"
                    options={[
                      { value: '2026-2027', label: '2026-2027 (الحالية)' },
                      { value: '2025-2026', label: '2025-2026' },
                      { value: '2024-2025', label: '2024-2025' },
                    ]}
                  />
                  <Select
                    label="السداسي"
                    options={[
                      { value: 's1', label: 'السداسي الأول (S1)' },
                      { value: 's2', label: 'السداسي الثاني (S2)' },
                    ]}
                  />
                </CardContent>
              </Card>

              {/* Checkbox & Switch */}
              <Card>
                <CardHeader>
                  <CardTitle>الخيارات والمفاتيح (Checkbox & Switch)</CardTitle>
                  <CardDescription>مفاتيح تبديل مع تحويلات اتجاه RTL/LTR آمنة وعلامات اختيار.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Checkbox
                      label="تفعيل التحقق التلقائي من تعارض القاعات"
                      description="يمنع حجز قاعتين لنفس الفوج في نفس التوقيت"
                      checked={checkboxChecked}
                      onChange={(e) => setCheckboxChecked(e.target.checked)}
                    />
                    <Checkbox
                      label="خيار معطل"
                      disabled
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Switch
                      label="وضع النسخ الاحتياطي السحابي المتزامن"
                      description="كتابة متزامنة مع Turso وNeon"
                      checked={switchChecked}
                      onChange={setSwitchChecked}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* SECTION 2: Containers & Overlays */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>2. الحاويات والنوافذ (Containers & Overlays)</span>
              <Badge variant="primary">4 مكونات</Badge>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tabs Showcase */}
              <Card>
                <CardHeader>
                  <CardTitle>الألسنة والتبويبات (Tabs)</CardTitle>
                  <CardDescription>تنقل سهل مع دعم أزرار لوحة المفاتيح والخصائص المنطقية.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="schedule">
                    <TabsList>
                      <TabTrigger value="schedule">جدول الحصص</TabTrigger>
                      <TabTrigger value="rooms">توفر القاعات</TabTrigger>
                      <TabTrigger value="workload">أعباء الأساتذة</TabTrigger>
                    </TabsList>
                    <TabContent value="schedule" className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      محتوى جدول الحصص الأسبوعي مع دعم التلوين والتوزيع حسب الأفواج.
                    </TabContent>
                    <TabContent value="rooms" className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      مصفوفة القاعات الشاغرة وبرمجة الحصص الإضافية والتعويضات.
                    </TabContent>
                    <TabContent value="workload" className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      نصاب الساعات الأسبوعي وجداول التكليف الفردية للأساتذة.
                    </TabContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Dialog & Drawer Triggers */}
              <Card>
                <CardHeader>
                  <CardTitle>النوافذ المنبثقة والأدراج (Dialog & Drawer)</CardTitle>
                  <CardDescription>مع إغلاق بزر Esc، تركيز لوحة المفاتيح، وعزل التمرير الخلفي.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="primary" onClick={() => setDialogOpen(true)}>
                      فتح نافذة حوار (Dialog)
                    </Button>
                    <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                      فتح درج جانبي (Drawer)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} size="md">
              <DialogHeader>
                <DialogTitle>تأكيد ترحيل البيانات</DialogTitle>
                <DialogDescription>
                  هل أنت متأكد من رغبتك في تطبيق التغييرات على قاعدة البيانات الحية؟
                </DialogDescription>
              </DialogHeader>
              <DialogContent>
                <p className="text-sm">
                  تم التحقق من خلو العملية من أي تعارضات (Conflict-Free)، ولن يتم حذف أي بيانات سابقة.
                </p>
              </DialogContent>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                <Button variant="primary" onClick={() => setDialogOpen(false)}>تأكيد ومتابعة</Button>
              </DialogFooter>
            </Dialog>

            {/* Live Drawer */}
            <Drawer
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              side="end"
              title="إعدادات النظام والطباعة"
            >
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  لوحة تحكم جانبية مجهزة بخيارات التهيئة السريعة وتخصيص قوالب الطباعة المعيارية.
                </p>
                <Input label="عنوان الوثيقة الرسمي" defaultValue="جامعة الشهيد حمه لخضر - الوادي" />
                <Select
                  label="تنسيق الصفحة"
                  options={[
                    { value: 'A4_landscape', label: 'A4 أفقي (Landscape)' },
                    { value: 'A4_portrait', label: 'A4 عمودي (Portrait)' },
                  ]}
                />
                <Button variant="primary" className="w-full mt-4" onClick={() => setDrawerOpen(false)}>
                  حفظ الإعدادات
                </Button>
              </div>
            </Drawer>
          </section>

          {/* SECTION 3: Feedback & Error Display */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>3. التغذية الراجعة ورسائل الأخطاء (Feedback & Errors)</span>
              <Badge variant="primary">5 مكونات</Badge>
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Toasts */}
              <Card>
                <CardHeader>
                  <CardTitle>التنبيهات العائمة (Toast Notifications)</CardTitle>
                  <CardDescription>تنبيهات فورية تدعم الإغلاق التلقائي والتصنيفات الأربعة.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        showToast({
                          type: 'success',
                          title: 'تم الحفظ بنجاح',
                          message: 'تم تحديث جدول التوقيت ومزامنة التغييرات في Neon.',
                        })
                      }
                    >
                      نجاح (Success)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        showToast({
                          type: 'warning',
                          title: 'تنبيه تعارض',
                          message: 'القاعة محجوزة جزئياً في هذا التوقيت.',
                        })
                      }
                    >
                      تحذير (Warning)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        showToast({
                          type: 'danger',
                          title: 'فشل العملية',
                          message: 'تعذر الاتصال بقاعدة البيانات. تم التراجع التلقائي.',
                        })
                      }
                    >
                      خطر (Danger)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        showToast({
                          type: 'info',
                          title: 'معلومة',
                          message: 'الواجهة تعمل على إصدار التصميم P10 المعتمد.',
                        })
                      }
                    >
                      معلومة (Info)
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Skeletons */}
              <Card>
                <CardHeader>
                  <CardTitle>هياكل التحميل (Skeleton Placeholders)</CardTitle>
                  <CardDescription>حركة نبضية سلسة لحالات انتظار تحميل البيانات.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton variant="circular" className="w-10 h-10" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            </div>

            {/* Standard Arabic ErrorDisplay */}
            <Card>
              <CardHeader>
                <CardTitle>مكون عرض الأخطاء المعياري العربي (ErrorDisplay)</CardTitle>
                <CardDescription>
                  يعرض بوضوح: ماذا حدث باللغة العربية + الخطوة المقترحة + رمز التتبع trace_id + زر النسخ وإعادة المحاولة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ErrorDisplay
                  title="تعذر حفظ تعديل الحصة الدراسية"
                  errorMessage="حدث تعارض قفل تفاؤلي (409 Conflict): تم تعديل هذه الحصة بواسطة مستخدم آخر في نفس اللحظة."
                  suggestedAction="يرجى الضغط على زر 'إعادة المحاولة' لتحديث بيانات الحصة لأحدث نسخة وتطبيق تعديلك مجدداً."
                  traceId="trace-req-8f4b-2026-neon-prod"
                  errorCode="409_CONFLICT"
                  onRetry={() => showToast({ type: 'info', title: 'إعادة المحاولة', message: 'جارٍ جلب أحدث نسخة...' })}
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <EmptyState
                title="لم يتم تسجيل أي أفواج بعد"
                description="ابدأ بإضافة أول فوج أو تخصص عبر الضغط على الزر أدناه."
                action={<Button variant="primary" size="sm">إضافة فوج جديد</Button>}
              />
              <ErrorState
                title="فشل تحميل جدول التوزيع"
                message="تعذر استرداد بيانات السداسي الحالي، يرجى المحاولة بعد لحظات."
                onRetry={() => {}}
              />
            </div>
          </section>

          {/* SECTION 4: Data Display */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>4. عرض البيانات والتنقل (Data Display & Navigation)</span>
              <Badge variant="primary">6 مكونات</Badge>
            </h2>

            {/* Badges, Avatars, Tooltips, Dropdown */}
            <Card>
              <CardHeader>
                <CardTitle>الشارات، الصور الرمزية، والتلميحات (Badges, Avatars, Tooltips & Menus)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="primary">أساسي (Primary)</Badge>
                  <Badge variant="success">ناجح (Success)</Badge>
                  <Badge variant="warning">تحذير (Warning)</Badge>
                  <Badge variant="danger">ملغى (Danger)</Badge>
                  <Badge variant="info">معلومة (Info)</Badge>
                  <Badge variant="neutral">محايد (Neutral)</Badge>
                  <Badge variant="outline">حدود (Outline)</Badge>
                </div>

                {/* Avatars */}
                <div className="flex items-center gap-4">
                  <Avatar name="علي حسين" status="online" size="lg" />
                  <Avatar name="أحمد بن علي" status="away" size="md" />
                  <Avatar name="د. مريم" status="busy" size="md" />
                  <Avatar name="سارة" status="offline" size="sm" />
                </div>

                {/* Tooltip & Dropdown Menu */}
                <div className="flex items-center gap-4">
                  <Tooltip content="توليد جدول PDF معتمد وموقع">
                    <Button variant="outline" size="sm">مرر الفأرة هنا (Tooltip)</Button>
                  </Tooltip>

                  <DropdownMenu
                    trigger={
                      <Button variant="secondary" size="sm" endIcon={<MoreVertical className="w-4 h-4" />}>
                        قائمة الخيارات (Dropdown)
                      </Button>
                    }
                  >
                    <DropdownMenuItem icon={<Edit className="w-4 h-4" />}>
                      تعديل الحصة
                    </DropdownMenuItem>
                    <DropdownMenuItem icon={<BookOpen className="w-4 h-4" />}>
                      عرض التفاصيل الأكاديمية
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem danger icon={<Trash2 className="w-4 h-4" />}>
                      حذف الحصة مع معاينة الأثر
                    </DropdownMenuItem>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>

            {/* Lightweight DataGrid Showcase */}
            <Card>
              <CardHeader>
                <CardTitle>شبكة البيانات خفيفة الوزن (DataGrid)</CardTitle>
                <CardDescription>
                  مكون سريع ومتاح للوصول يدعم البحث الفوري والترتيب والتصفح دون أي مكتبات ثقيلة (بديل نظيف لـ MUI وag-grid).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataGrid
                  columns={gridColumns}
                  data={dummyGridData}
                  pageSize={3}
                  searchPlaceholder="البحث في الأساتذة أو الأقسام..."
                />
              </CardContent>
            </Card>

            {/* Standalone Pagination */}
            <Card>
              <CardHeader>
                <CardTitle>شريط التصفح المستقل (Pagination)</CardTitle>
              </CardHeader>
              <CardContent>
                <Pagination
                  currentPage={paginationPage}
                  totalPages={8}
                  onPageChange={setPaginationPage}
                />
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <ToastProvider>
      <DesignSystemContent />
    </ToastProvider>
  );
}

