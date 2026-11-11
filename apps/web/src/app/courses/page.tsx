'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Search,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Download,
  Archive,
  CheckCircle2,
  GraduationCap,
  Award,
  Layers,
  ArrowRightLeft,
  Calendar,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Dialog,
  DialogTitle,
  DialogDescription,
} from '@djadwal/ui';
import { api, ApiError } from '@/lib/api';
import DeleteImpactModal from '@/components/DeleteImpactModal';
import UndoToast from '@/components/UndoToast';

export interface Course {
  id: number;
  name: string;
  code?: string;
  description?: string;
  credits?: number;
  coefficient?: number;
  department_id?: number;
  department_name?: string;
  metadata?: string | Record<string, any>;
  deleted_at?: string | null;
  version?: number;
  created_at?: string;
}

interface ParsedCourseMetadata {
  credits: number;
  coefficient: number;
  semester: string;
  session_types: string[];
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [archivedCourses, setArchivedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'coefficient' | 'credits'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  // Delete Impact Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Undo Toast State
  const [undoToast, setUndoToast] = useState<{
    show: boolean;
    message: string;
    changeLogId?: number | null;
  }>({ show: false, message: '' });
  const [isUndoing, setIsUndoing] = useState(false);

  // Add / Edit Course Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    credits: 3,
    coefficient: 2,
    semester: 'S1',
    hasLecture: true,
    hasTD: true,
    hasTP: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Helper to extract course metadata safely
  const parseCourseMeta = (course: Course): ParsedCourseMetadata => {
    let meta: Record<string, any> = {};
    if (typeof course.metadata === 'string') {
      try {
        meta = JSON.parse(course.metadata || '{}');
      } catch {
        meta = {};
      }
    } else if (typeof course.metadata === 'object' && course.metadata !== null) {
      meta = course.metadata;
    }

    return {
      credits: Number(meta.credits ?? course.credits ?? 3),
      coefficient: Number(meta.coefficient ?? course.coefficient ?? 2),
      semester: meta.semester || 'S1',
      session_types: Array.isArray(meta.session_types)
        ? meta.session_types
        : ['lecture', 'td'],
    };
  };

  const loadCourses = async () => {
    setLoading(true);
    try {
      const [activeData, allData] = await Promise.all([
        api.get('/catalog/courses?limit=1000'),
        api.get('/catalog/courses?withArchived=true&limit=1000'),
      ]);

      if (Array.isArray(activeData)) {
        setCourses(activeData);
      }
      if (Array.isArray(allData)) {
        const archived = allData.filter((c: Course) => c.deleted_at !== null && c.deleted_at !== undefined);
        setArchivedCourses(archived);
      }
    } catch (err: any) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  // Open Delete Impact Modal
  const handleOpenDelete = async (course: Course) => {
    setSelectedCourse(course);
    setDeleteModalOpen(true);
    try {
      const impactRes = await api.getDeleteImpact('courses', course.id);
      setDeleteImpact(impactRes);
    } catch {
      setDeleteImpact(null);
    }
  };

  // Confirm Soft Delete
  const handleConfirmDelete = async () => {
    if (!selectedCourse) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/catalog/courses/${selectedCourse.id}`);
      setDeleteModalOpen(false);
      setCourses((prev) => prev.filter((c) => c.id !== selectedCourse.id));
      setArchivedCourses((prev) => [...prev, { ...selectedCourse, deleted_at: new Date().toISOString() }]);

      setUndoToast({
        show: true,
        message: `تم نقل المقياس "${selectedCourse.name}" إلى سلة المؤرشفات بنجاح.`,
        changeLogId: res?.changeLogId || null,
      });
    } catch (err: any) {
      alert(err.message || 'فشل حذف المقياس');
    } finally {
      setIsDeleting(false);
      setSelectedCourse(null);
    }
  };

  // Undo Delete
  const handleUndo = async (id: number) => {
    setIsUndoing(true);
    try {
      await api.undoChange(id);
      setUndoToast({ show: false, message: '' });
      await loadCourses();
      alert('✅ تم التراجع عن الحذف بنجاح واستعادة المقياس إلى القائمة النشطة!');
    } catch (err: any) {
      alert('فشل التراجع: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsUndoing(false);
    }
  };

  // Restore Archived Course
  const handleRestore = async (course: Course) => {
    try {
      await api.restore('courses', course.id);
      setArchivedCourses((prev) => prev.filter((c) => c.id !== course.id));
      setCourses((prev) => [...prev, { ...course, deleted_at: null }]);
      alert(`✅ تم استعادة المقياس "${course.name}" بنجاح!`);
    } catch (err: any) {
      alert('فشل الاستعادة: ' + (err.message || 'خطأ غير معروف'));
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingCourse(null);
    setFormData({
      name: '',
      code: '',
      credits: 3,
      coefficient: 2,
      semester: 'S1',
      hasLecture: true,
      hasTD: true,
      hasTP: false,
    });
    setConflictError(null);
    setShowFormModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (course: Course) => {
    setEditingCourse(course);
    const meta = parseCourseMeta(course);
    setFormData({
      name: course.name || '',
      code: course.code || '',
      credits: meta.credits,
      coefficient: meta.coefficient,
      semester: meta.semester,
      hasLecture: meta.session_types.includes('lecture'),
      hasTD: meta.session_types.includes('td'),
      hasTP: meta.session_types.includes('tp'),
    });
    setConflictError(null);
    setShowFormModal(true);
  };

  // Save Course (Add or Edit with OCC version and Idempotency-Key)
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    setConflictError(null);

    const idempotencyKey = `course-${editingCourse ? 'edit-' + editingCourse.id : 'create'}-${Date.now()}`;

    const session_types: string[] = [];
    if (formData.hasLecture) session_types.push('lecture');
    if (formData.hasTD) session_types.push('td');
    if (formData.hasTP) session_types.push('tp');

    const metadataPayload = {
      credits: Number(formData.credits) || 0,
      coefficient: Number(formData.coefficient) || 1,
      semester: formData.semester,
      session_types,
    };

    try {
      if (editingCourse) {
        // Optimistic Locking Update
        await api.put(
          `/catalog/courses/${editingCourse.id}`,
          {
            name: formData.name.trim(),
            code: formData.code.trim() || undefined,
            metadata: metadataPayload,
            version: editingCourse.version,
          },
          {
            headers: {
              'Idempotency-Key': idempotencyKey,
            },
          }
        );
      } else {
        // Create
        await api.post(
          '/catalog/courses',
          {
            name: formData.name.trim(),
            code: formData.code.trim() || undefined,
            metadata: metadataPayload,
          },
          {
            headers: {
              'Idempotency-Key': idempotencyKey,
            },
          }
        );
      }

      setShowFormModal(false);
      await loadCourses();
    } catch (err: any) {
      if (err.statusCode === 409 || err.status === 409 || err.code === 'CONFLICT' || err.name === 'OptimisticLockError') {
        setConflictError(
          '⚠️ تنبيه تعارض التعديل المتزامن (409 Conflict): تم تحديث بيانات هذا المقياس مسبقاً من قِبل مستخدم آخر. يرجى إغلاق النافذة وتحديث الصفحة لتفادي الكتابة فوق التعديلات الأحدث.'
        );
      } else {
        alert(err.message || 'حدث خطأ أثناء حفظ بيانات المقياس');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const listToExport = activeTab === 'active' ? filteredCourses : archivedCourses;
    const headers = ['#', 'اسم المقياس', 'رمز المقياس', 'السداسي', 'المعامل', 'الرصيد', 'نوع الحصص', 'الحالة'];
    const rows = listToExport.map((c) => {
      const meta = parseCourseMeta(c);
      const typesAr = meta.session_types
        .map((t) => (t === 'lecture' ? 'محاضرة' : t === 'td' ? 'TD' : 'TP'))
        .join(' + ');
      return [
        c.id,
        `"${c.name || ''}"`,
        `"${c.code || ''}"`,
        `"${meta.semester}"`,
        meta.coefficient,
        meta.credits,
        `"${typesAr}"`,
        c.deleted_at ? 'مؤرشف' : 'نشط',
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `courses-list-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered and sorted courses
  const filteredCourses = useMemo(() => {
    return courses
      .filter((c) => {
        const matchesSearch =
          (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.code || '').toLowerCase().includes(search.toLowerCase());

        const meta = parseCourseMeta(c);
        const matchesSemester = semesterFilter === 'all' || meta.semester === semesterFilter;

        let matchesType = true;
        if (typeFilter === 'tp') matchesType = meta.session_types.includes('tp');
        else if (typeFilter === 'td') matchesType = meta.session_types.includes('td');
        else if (typeFilter === 'lecture') matchesType = meta.session_types.includes('lecture');

        return matchesSearch && matchesSemester && matchesType;
      })
      .sort((a, b) => {
        const metaA = parseCourseMeta(a);
        const metaB = parseCourseMeta(b);

        let comparison = 0;
        if (sortBy === 'name') comparison = (a.name || '').localeCompare(b.name || '', 'ar');
        else if (sortBy === 'code') comparison = (a.code || '').localeCompare(b.code || '');
        else if (sortBy === 'coefficient') comparison = metaA.coefficient - metaB.coefficient;
        else if (sortBy === 'credits') comparison = metaA.credits - metaB.credits;

        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [courses, search, semesterFilter, typeFilter, sortBy, sortOrder]);

  // Statistics
  const totalCredits = useMemo(() => {
    return courses.reduce((sum, c) => sum + parseCourseMeta(c).credits, 0);
  }, [courses]);

  const tpCoursesCount = useMemo(() => {
    return courses.filter((c) => parseCourseMeta(c).session_types.includes('tp')).length;
  }, [courses]);

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                إدارة المقاييس والمواد (Courses)
                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200">
                  V1 Production
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                تحديد المعاملات والأرصدة، السداسيات ونوعية الحصص (محاضرات، أعمال موجهة وتطبيقية)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Legacy Switcher */}
          <Link
            href="/legacy/courses"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-xl transition-colors border border-border"
            title="الانتقال إلى الواجهة الكلاسيكية القديمة"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>الواجهة الكلاسيكية (Legacy)</span>
          </Link>

          <Button
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl border-border hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            <span>تصدير CSV</span>
          </Button>

          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة مقياس جديد</span>
          </Button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">إجمالي المقاييس النشطة</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{courses.length}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <BookOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">مجموع الأرصدة (ECTS)</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {totalCredits} <span className="text-xs font-normal text-muted-foreground">رصيد</span>
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Award className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">مقاييس بأعمال تطبيقية (TP)</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{tpCoursesCount}</h3>
              <p className="text-xs text-muted-foreground">تتطلب قاعات مخابر</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">سلة المؤرشفات</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{archivedCourses.length}</h3>
              <p className="text-xs text-muted-foreground">مقاييس محذوفة بأمان</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Archive className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs (Active vs Archived) */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-colors border-b-2 ${
            activeTab === 'active'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-500/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>المقاييس النشطة</span>
          <Badge variant="neutral" className="mr-1 text-xs px-2 py-0.5">
            {courses.length}
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab('archived')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-colors border-b-2 ${
            activeTab === 'archived'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400 bg-rose-500/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Archive className="h-4 w-4" />
          <span>المؤرشفات / المحذوفات</span>
          <Badge variant="outline" className="mr-1 text-xs px-2 py-0.5 text-rose-600 border-rose-200">
            {archivedCourses.length}
          </Badge>
        </button>
      </div>

      {/* Filters & Search Toolbar (Only for Active tab) */}
      {activeTab === 'active' && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
            <div className="relative w-full sm:w-72">
              <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم المقياس أو الرمز..."
                className="w-full pl-4 pr-10 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">كل السداسيات</option>
              <option value="S1">السداسي الأول (S1)</option>
              <option value="S2">السداسي الثاني (S2)</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">كل الحصص</option>
              <option value="lecture">تحتوي محاضرات</option>
              <option value="td">تحتوي أعمال موجهة (TD)</option>
              <option value="tp">تحتوي أعمال تطبيقية (TP)</option>
            </select>

            <div className="flex items-center gap-1.5 border border-input rounded-xl px-2.5 py-1.5 bg-background">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">ترتيب:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer"
              >
                <option value="name">الاسم</option>
                <option value="code">الرمز</option>
                <option value="coefficient">المعامل</option>
                <option value="credits">الرصيد</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="text-xs text-muted-foreground hover:text-foreground px-1"
                title="عكس اتجاه الترتيب"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground whitespace-nowrap">
            <span>
              المطابق للبحث: <strong className="text-blue-600 dark:text-blue-400 font-semibold">{filteredCourses.length}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Main Content Table */}
      {activeTab === 'active' ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted/50 text-muted-foreground text-xs border-b border-border">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">#</th>
                  <th className="py-3.5 px-4 font-semibold">المقياس / المادة</th>
                  <th className="py-3.5 px-4 font-semibold">الرمز</th>
                  <th className="py-3.5 px-4 font-semibold">السداسي</th>
                  <th className="py-3.5 px-4 font-semibold">المعامل</th>
                  <th className="py-3.5 px-4 font-semibold">الرصيد</th>
                  <th className="py-3.5 px-4 font-semibold">أنواع الحصص</th>
                  <th className="py-3.5 px-4 font-semibold">الإصدار (OCC)</th>
                  <th className="py-3.5 px-4 font-semibold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                      جارٍ جلب المقاييس من قاعدة البيانات الآمنة...
                    </td>
                  </tr>
                ) : filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-muted-foreground">
                      <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                      لا توجد مقاييس مطابقة لمعايير البحث والتصفية.
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map((course) => {
                    const meta = parseCourseMeta(course);
                    return (
                      <tr key={course.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{course.id}</td>
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {course.name}
                        </td>
                        <td className="py-3.5 px-4">
                          {course.code ? (
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                              {course.code}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200">
                            {meta.semester}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-foreground">
                          {meta.coefficient}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {meta.credits} ECTS
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            {meta.session_types.includes('lecture') && (
                              <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                                محاضرة
                              </span>
                            )}
                            {meta.session_types.includes('td') && (
                              <span className="px-1.5 py-0.5 rounded text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 font-medium">
                                TD
                              </span>
                            )}
                            {meta.session_types.includes('tp') && (
                              <span className="px-1.5 py-0.5 rounded text-[11px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 font-medium">
                                TP
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                          v{course.version || 1}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(course)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                              title="تعديل بيانات المقياس"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span>تعديل</span>
                            </button>

                            <button
                              onClick={() => handleOpenDelete(course)}
                              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                              title="حذف مع تقييم الأثر المتبادل"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Archived Tab Content */
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border-b border-border flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
            <Archive className="h-4 w-4 shrink-0" />
            <span>
              سلة المؤرشفات تحتوي على المقاييس المحذوفة بأمان (Soft Deleted). يمكنك استعادتها فوراً بنقرة واحدة مع كامل تفاصيلها.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted/50 text-muted-foreground text-xs border-b border-border">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">#</th>
                  <th className="py-3.5 px-4 font-semibold">اسم المقياس</th>
                  <th className="py-3.5 px-4 font-semibold">الرمز</th>
                  <th className="py-3.5 px-4 font-semibold">تاريخ الأرشفة</th>
                  <th className="py-3.5 px-4 font-semibold text-center">استعادة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {archivedCourses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-muted-foreground">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40 text-emerald-500" />
                      سلة المؤرشفات فارغة تماماً.
                    </td>
                  </tr>
                ) : (
                  archivedCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{course.id}</td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">{course.name}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{course.code || '—'}</td>
                      <td className="py-3.5 px-4 text-xs font-mono text-muted-foreground">
                        {course.deleted_at ? new Date(course.deleted_at).toLocaleString('ar-DZ') : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleRestore(course)}
                          className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 px-3 py-1 rounded-lg text-xs font-semibold transition-colors border border-emerald-200 dark:border-emerald-800"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>استعادة المقياس</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Impact Modal */}
      <DeleteImpactModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="تأكيد حذف مقياس تدريسي مع تقييم الأثر المتبادل"
        entityName={selectedCourse?.name || ''}
        impact={deleteImpact}
        isLoading={isDeleting}
      />

      {/* Undo Toast */}
      <UndoToast
        show={undoToast.show}
        message={undoToast.message}
        changeLogId={undoToast.changeLogId}
        onUndo={handleUndo}
        onClose={() => setUndoToast({ show: false, message: '' })}
        isLoading={isUndoing}
      />

      {/* Add / Edit Course Modal */}
      <Dialog open={showFormModal} onClose={() => setShowFormModal(false)} size="md">
        <div className="p-6 space-y-4 max-w-lg w-full bg-card rounded-2xl text-right max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <BookOpen className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold text-foreground">
                {editingCourse ? 'تعديل بيانات المقياس' : 'إضافة مقياس جديد'}
              </DialogTitle>
            </div>
            {editingCourse && (
              <Badge variant="outline" className="text-xs font-mono">
                v{editingCourse.version || 1}
              </Badge>
            )}
          </div>

          <DialogDescription className="text-xs text-muted-foreground">
            حدد اسم المقياس، الرمز، المعامل والرصيد ونوع الحصص التي يتطلبها المقياس.
          </DialogDescription>

          {conflictError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{conflictError}</p>
            </div>
          )}

          <form onSubmit={handleSaveCourse} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                اسم المقياس <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: الخوارزميات وهياكل البيانات..."
                className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                رمز المقياس (Code)
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="مثال: INF101, ALG2..."
                className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  السداسي
                </label>
                <select
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="S1">السداسي 1</option>
                  <option value="S2">السداسي 2</option>
                  <option value="S3">السداسي 3</option>
                  <option value="S4">السداسي 4</option>
                  <option value="S5">السداسي 5</option>
                  <option value="S6">السداسي 6</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  المعامل
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={formData.coefficient}
                  onChange={(e) => setFormData({ ...formData, coefficient: Number(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  الرصيد (ECTS)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  required
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: Number(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="border border-border rounded-xl p-3 bg-muted/20">
              <label className="block text-xs font-semibold text-foreground mb-2">
                أنواع الحصص المقررة في المقياس:
              </label>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasLecture}
                    onChange={(e) => setFormData({ ...formData, hasLecture: e.target.checked })}
                    className="rounded border-input text-blue-600 focus:ring-blue-500"
                  />
                  <span>محاضرة (Cours)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasTD}
                    onChange={(e) => setFormData({ ...formData, hasTD: e.target.checked })}
                    className="rounded border-input text-blue-600 focus:ring-blue-500"
                  />
                  <span>أعمال موجهة (TD)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasTP}
                    onChange={(e) => setFormData({ ...formData, hasTP: e.target.checked })}
                    className="rounded border-input text-blue-600 focus:ring-blue-500"
                  />
                  <span>أعمال تطبيقية (TP)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFormModal(false)}
                className="rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>جارٍ الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>{editingCourse ? 'تحديث البيانات' : 'حفظ المقياس'}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </div>
  );
}
