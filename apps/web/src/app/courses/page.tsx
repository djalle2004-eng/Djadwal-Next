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
  FileSpreadsheet,
  Upload,
  Check,
  PowerOff,
  Ban,
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
import ImportCoursesModal from '@/components/ImportCoursesModal';
import MultiSelectSpecialties from '@/components/MultiSelectSpecialties';

export interface Course {
  id: number;
  name: string;
  code?: string;
  description?: string;
  credits?: number;
  coefficient?: number;
  semester?: string;
  study_level?: string;
  specialization_id?: number;
  specialization_name?: string;
  specialization?: string;
  specialties?: string[];
  department_id?: number;
  department_name?: string;
  has_lecture?: boolean;
  has_td?: boolean;
  has_tp?: boolean;
  weekly_hours?: number;
  lecture_hours?: number;
  td_hours?: number;
  tp_hours?: number;
  is_active?: boolean;
  disabled_academic_year?: string | null;
  disabled_at?: string | null;
  disabled_reason?: string | null;
  metadata?: string | Record<string, any>;
  deleted_at?: string | null;
  version?: number;
  created_at?: string;
}

interface ParsedCourseMetadata {
  credits: number;
  coefficient: number;
  semester: string;
  study_level: string;
  specialization: string;
  specialties: string[];
  weekly_hours: number;
  lecture_hours: number;
  td_hours: number;
  tp_hours: number;
  is_active: boolean;
  disabled_academic_year?: string | null;
  disabled_at?: string | null;
  disabled_reason?: string | null;
  session_types: string[];
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [archivedCourses, setArchivedCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [studyLevelFilter, setStudyLevelFilter] = useState('all');
  const [specializationFilter, setSpecializationFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [togglingCourseId, setTogglingCourseId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'coefficient' | 'credits' | 'semester'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  // Excel Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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
    studyLevel: 'L1',
    specialization: '',
    specialties: [] as string[],
    departmentId: '',
    weeklyHours: 3.0,
    lectureHours: 1.5,
    tdHours: 1.5,
    tpHours: 0.0,
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

    const sessionTypes = Array.isArray(meta.session_types)
      ? meta.session_types
      : [
          course.has_lecture !== false ? 'lecture' : null,
          course.has_td !== false ? 'td' : null,
          course.has_tp ? 'tp' : null,
        ].filter(Boolean);

    let specialties: string[] = [];
    if (Array.isArray(course.specialties) && course.specialties.length > 0) {
      specialties = course.specialties.map(String).filter(Boolean);
    } else if (Array.isArray(meta.specialties) && meta.specialties.length > 0) {
      specialties = meta.specialties.map(String).filter(Boolean);
    } else if (typeof course.specialization === 'string' && course.specialization.trim()) {
      specialties = course.specialization.split(/[،,]/).map((s: string) => s.trim()).filter(Boolean);
    } else if (typeof meta.specialization === 'string' && meta.specialization.trim()) {
      specialties = meta.specialization.split(/[،,]/).map((s: string) => s.trim()).filter(Boolean);
    } else if (course.specialization_name) {
      specialties = [course.specialization_name];
    }

    const specializationStr = specialties.length > 0
      ? specialties.join('، ')
      : (course.specialization || course.specialization_name || meta.specialization || '');

    const explicitLecture = meta.lecture_hours !== undefined ? Number(meta.lecture_hours) : (course.lecture_hours !== undefined ? Number(course.lecture_hours) : null);
    const explicitTD = meta.td_hours !== undefined ? Number(meta.td_hours) : (course.td_hours !== undefined ? Number(course.td_hours) : null);
    const explicitTP = meta.tp_hours !== undefined ? Number(meta.tp_hours) : (course.tp_hours !== undefined ? Number(course.tp_hours) : null);

    const hasLecture = course.has_lecture !== false && (sessionTypes.length === 0 || sessionTypes.includes('lecture'));
    const hasTD = course.has_td !== false && (sessionTypes.length === 0 || sessionTypes.includes('td'));
    const hasTP = Boolean(course.has_tp) || sessionTypes.includes('tp');

    const lectureHours = explicitLecture !== null ? explicitLecture : (hasLecture ? 1.5 : 0);
    const tdHours = explicitTD !== null ? explicitTD : (hasTD ? 1.5 : 0);
    const tpHours = explicitTP !== null ? explicitTP : (hasTP ? 1.5 : 0);
    const calculatedTotal = lectureHours + tdHours + tpHours;
    const weeklyHours = Number(course.weekly_hours ?? meta.weekly_hours ?? (calculatedTotal > 0 ? calculatedTotal : 3.0));

    const isActive = (course.is_active !== undefined ? Boolean(course.is_active) : (meta.is_active !== undefined ? Boolean(meta.is_active) : true)) && !course.deleted_at;
    const disabledAcademicYear = course.disabled_academic_year || meta.disabled_academic_year || null;
    const disabledAt = course.disabled_at || meta.disabled_at || null;
    const disabledReason = course.disabled_reason || meta.disabled_reason || null;

    return {
      credits: Number(course.credits ?? meta.credits ?? 3),
      coefficient: Number(course.coefficient ?? meta.coefficient ?? 2),
      semester: course.semester || meta.semester || 'S1',
      study_level: course.study_level || meta.study_level || 'L1',
      specialization: specializationStr,
      specialties,
      weekly_hours: weeklyHours,
      lecture_hours: lectureHours,
      td_hours: tdHours,
      tp_hours: tpHours,
      is_active: isActive,
      disabled_academic_year: disabledAcademicYear,
      disabled_at: disabledAt,
      disabled_reason: disabledReason,
      session_types: sessionTypes.length > 0 ? sessionTypes : ['lecture', 'td'],
    };
  };

  const loadCourses = async () => {
    setLoading(true);
    try {
      const [activeData, allData, deptsData, groupsData] = await Promise.all([
        api.get('/catalog/courses?limit=1000'),
        api.get('/catalog/courses?withArchived=true&limit=1000'),
        api.get('/catalog/departments').catch(() => []),
        api.get('/catalog/groups').catch(() => []),
      ]);

      if (Array.isArray(activeData)) {
        setCourses(activeData);
      }
      if (Array.isArray(allData)) {
        const archived = allData.filter((c: Course) => c.deleted_at !== null && c.deleted_at !== undefined);
        setArchivedCourses(archived);
      }
      if (Array.isArray(deptsData)) {
        setDepartments(deptsData);
      }

      // Extract unique specializations from courses and groups
      const specSet = new Set<string>();
      if (Array.isArray(groupsData)) {
        groupsData.forEach((g: any) => {
          if (g.specialization && g.specialization.trim()) specSet.add(g.specialization.trim());
        });
      }
      if (Array.isArray(activeData)) {
        activeData.forEach((c: Course) => {
          const meta = parseCourseMeta(c);
          if (Array.isArray(meta.specialties)) {
            meta.specialties.forEach((s) => {
              if (s && s.trim()) specSet.add(s.trim());
            });
          }
          if (meta.specialization && meta.specialization.trim()) specSet.add(meta.specialization.trim());
        });
      }
      setSpecializations(Array.from(specSet).sort());
    } catch (err: any) {
      console.error('Failed to load courses data:', err);
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

  // Toggle Active / Disabled for current academic year (تعطيل أو تفعيل المقياس للسنة الحالية)
  const handleToggleActive = async (course: Course) => {
    setTogglingCourseId(course.id);
    try {
      const res = await api.post(`/catalog/courses/${course.id}/toggle-active`, {});
      const updatedCourse = res?.course || {
        ...course,
        is_active: !parseCourseMeta(course).is_active
      };
      setCourses((prev) => prev.map((c) => (c.id === course.id ? updatedCourse : c)));

      const isNowActive = parseCourseMeta(updatedCourse).is_active;
      setUndoToast({
        show: true,
        message: res?.message_ar || (isNowActive
          ? `✅ تم تفعيل المقياس "${course.name}" وإعادته لمصفوفة الجداول والإحصائيات.`
          : `⚠️ تم تعطيل المقياس "${course.name}" للسنة الجامعية الحالية واستبعاده من الجدولة والإحصائيات.`),
      });
    } catch (err: any) {
      alert('فشل تحديث حالة المقياس: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setTogglingCourseId(null);
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
      studyLevel: 'L1',
      specialization: '',
      specialties: [],
      departmentId: '',
      weeklyHours: 3.0,
      lectureHours: 1.5,
      tdHours: 1.5,
      tpHours: 0.0,
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
      studyLevel: meta.study_level,
      specialization: meta.specialization,
      specialties: meta.specialties || [],
      departmentId: course.department_id ? String(course.department_id) : '',
      weeklyHours: meta.weekly_hours,
      lectureHours: meta.lecture_hours,
      tdHours: meta.td_hours,
      tpHours: meta.tp_hours,
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

    const payloadSpecialties = formData.specialties.length > 0
      ? formData.specialties
      : (formData.specialization ? formData.specialization.split(/[،,]/).map((s: string) => s.trim()).filter(Boolean) : []);
    const payloadSpecializationStr = payloadSpecialties.length > 0
      ? payloadSpecialties.join('، ')
      : formData.specialization.trim();

    const calculatedWeekly = (formData.hasLecture ? formData.lectureHours : 0) +
                             (formData.hasTD ? formData.tdHours : 0) +
                             (formData.hasTP ? formData.tpHours : 0);
    const effectiveWeeklyHours = Number(formData.weeklyHours) || (calculatedWeekly > 0 ? calculatedWeekly : 3.0);

    const metadataPayload = {
      credits: Number(formData.credits) || 3,
      coefficient: Number(formData.coefficient) || 2,
      semester: formData.semester,
      study_level: formData.studyLevel,
      specialization: payloadSpecializationStr,
      specialties: payloadSpecialties,
      weekly_hours: effectiveWeeklyHours,
      lecture_hours: formData.hasLecture ? formData.lectureHours : 0,
      td_hours: formData.hasTD ? formData.tdHours : 0,
      tp_hours: formData.hasTP ? formData.tpHours : 0,
      session_types,
    };

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim() || undefined,
      department_id: formData.departmentId ? Number(formData.departmentId) : undefined,
      semester: formData.semester,
      credits: Number(formData.credits) || 3,
      coefficient: Number(formData.coefficient) || 2,
      study_level: formData.studyLevel,
      specialization: payloadSpecializationStr,
      specialties: payloadSpecialties,
      has_lecture: formData.hasLecture,
      has_td: formData.hasTD,
      has_tp: formData.hasTP,
      weekly_hours: effectiveWeeklyHours,
      lecture_hours: formData.hasLecture ? formData.lectureHours : 0,
      td_hours: formData.hasTD ? formData.tdHours : 0,
      tp_hours: formData.hasTP ? formData.tpHours : 0,
      metadata: metadataPayload,
      ...(editingCourse ? { version: editingCourse.version } : {}),
    };

    try {
      if (editingCourse) {
        await api.put(
          `/catalog/courses/${editingCourse.id}`,
          payload,
          {
            headers: {
              'Idempotency-Key': idempotencyKey,
            },
          }
        );
      } else {
        await api.post(
          '/catalog/courses',
          payload,
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

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    let url = '/api/v1/courses/export';
    const params = new URLSearchParams();
    if (semesterFilter !== 'all') params.append('semester', semesterFilter);
    if (activeTab === 'archived') params.append('withArchived', 'true');
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    window.open(url, '_blank');
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
        const matchesLevel = studyLevelFilter === 'all' || meta.study_level === studyLevelFilter;
        const matchesSpec =
          specializationFilter === 'all' ||
          meta.specialization.toLowerCase() === specializationFilter.toLowerCase();

        let matchesType = true;
        if (typeFilter === 'tp') matchesType = meta.session_types.includes('tp');
        else if (typeFilter === 'td') matchesType = meta.session_types.includes('td');
        else if (typeFilter === 'lecture') matchesType = meta.session_types.includes('lecture');

        let matchesStatus = true;
        if (statusFilter === 'active') matchesStatus = meta.is_active;
        else if (statusFilter === 'disabled') matchesStatus = !meta.is_active;

        return matchesSearch && matchesSemester && matchesLevel && matchesSpec && matchesType && matchesStatus;
      })
      .sort((a, b) => {
        const metaA = parseCourseMeta(a);
        const metaB = parseCourseMeta(b);

        let comparison = 0;
        if (sortBy === 'name') comparison = (a.name || '').localeCompare(b.name || '', 'ar');
        else if (sortBy === 'code') comparison = (a.code || '').localeCompare(b.code || '');
        else if (sortBy === 'coefficient') comparison = metaA.coefficient - metaB.coefficient;
        else if (sortBy === 'credits') comparison = metaA.credits - metaB.credits;
        else if (sortBy === 'semester') comparison = metaA.semester.localeCompare(metaB.semester);

        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [courses, search, semesterFilter, studyLevelFilter, specializationFilter, typeFilter, statusFilter, sortBy, sortOrder]);

  // Statistics: strictly calculated from active courses (المقاييس المعطلة لا تدخل في الإحصائيات)
  const activeCoursesList = useMemo(() => {
    return courses.filter((c) => parseCourseMeta(c).is_active);
  }, [courses]);

  const disabledCoursesList = useMemo(() => {
    return courses.filter((c) => !parseCourseMeta(c).is_active);
  }, [courses]);

  const s1Count = useMemo(() => {
    return activeCoursesList.filter((c) => parseCourseMeta(c).semester === 'S1').length;
  }, [activeCoursesList]);

  const s2Count = useMemo(() => {
    return activeCoursesList.filter((c) => parseCourseMeta(c).semester === 'S2').length;
  }, [activeCoursesList]);

  const totalCredits = useMemo(() => {
    return activeCoursesList.reduce((sum, c) => sum + parseCourseMeta(c).credits, 0);
  }, [activeCoursesList]);

  const totalCoefficients = useMemo(() => {
    return activeCoursesList.reduce((sum, c) => sum + parseCourseMeta(c).coefficient, 0);
  }, [activeCoursesList]);

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Top Header & Pedagogical Curriculum Guide Title */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  دليل المقاييس والربط الهيكلي بالسداسيات والتخصصات
                </h1>
                <Badge variant="outline" className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 font-semibold">
                  P16 Curriculum Guide
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                دليل المقاييس البيداغوجي وفق المعايير الجزائرية وتغذية محرك الجدولة الآلي (P13) بقواعد صحيحة
              </p>
            </div>
          </div>
        </div>

        {/* Global Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setIsImportModalOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium"
          >
            <Upload className="h-4 w-4" />
            <span>استيراد من Excel</span>
          </Button>

          <Button
            onClick={handleExportExcel}
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-medium"
          >
            <Download className="h-4 w-4" />
            <span>تصدير دليل Excel</span>
          </Button>

          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة مقياس جديد</span>
          </Button>
        </div>
      </div>

      {/* KPI Pedagogical Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border bg-card shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">المقاييس النشطة في الجدولة</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-2xl font-bold text-foreground">{activeCoursesList.length} مقياس</h3>
                {disabledCoursesList.length > 0 && (
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25">
                    {disabledCoursesList.length} معطل للسنة
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {disabledCoursesList.length > 0
                  ? `المعطلة مستبعدة تماماً من الجداول والإحصائيات (${disabledCoursesList.length})`
                  : 'جميع المقاييس نشطة ومدرجة في الجداول'}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <BookOpen className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">السداسي الأول (S1)</p>
              <h3 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{s1Count} مقياس</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">الفصل الخريفي / الشتوي</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Calendar className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-700 dark:text-purple-400">السداسي الثاني (S2)</p>
              <h3 className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">{s2Count} مقياس</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">الفصل الربيعي</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Layers className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">الأرصدة والمعاملات</p>
              <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {totalCredits} <span className="text-xs font-normal text-muted-foreground">رصيد</span> / {totalCoefficients} <span className="text-xs font-normal text-muted-foreground">معامل</span>
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">معايير نظام LMD المعتمدة</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Award className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Active Courses vs Soft Deleted Archive */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-colors border-b-2 ${
            activeTab === 'active'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>دليل المقاييس المعتمد</span>
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
          <span>المقاييس المؤرشفة / المحذوفة</span>
          <Badge variant="outline" className="mr-1 text-xs px-2 py-0.5 text-rose-600 border-rose-200">
            {archivedCourses.length}
          </Badge>
        </button>
      </div>

      {/* Advanced Pedagogical Filters Toolbar */}
      {activeTab === 'active' && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2.5 w-full">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم المقياس أو الرمز..."
                className="w-full pl-4 pr-10 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Semester Filter */}
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="all">كل السداسيات (S1 & S2)</option>
              <option value="S1">السداسي الأول (S1)</option>
              <option value="S2">السداسي الثاني (S2)</option>
            </select>

            {/* Study Level Filter */}
            <select
              value={studyLevelFilter}
              onChange={(e) => setStudyLevelFilter(e.target.value)}
              className="py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">كل المستويات (L1..M2)</option>
              <option value="L1">سنة أولى ليسانس (L1)</option>
              <option value="L2">سنة ثانية ليسانس (L2)</option>
              <option value="L3">سنة ثالثة ليسانس (L3)</option>
              <option value="M1">سنة أولى ماستر (M1)</option>
              <option value="M2">سنة ثانية ماستر (M2)</option>
            </select>

            {/* Specialization Filter */}
            {specializations.length > 0 && (
              <select
                value={specializationFilter}
                onChange={(e) => setSpecializationFilter(e.target.value)}
                className="py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px]"
              >
                <option value="all">كل التخصصات والشعب</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            )}

            {/* Session Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">كل الحصص</option>
              <option value="lecture">تحتوي محاضرات (Cours)</option>
              <option value="td">تحتوي أعمال موجهة (TD)</option>
              <option value="tp">تحتوي أعمال تطبيقية (TP)</option>
            </select>

            {/* Status Filter (حالة التفعيل للسنة الجامعية الحالية) */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="all">كل الحالات (نشط ومعطل)</option>
              <option value="active">النشطة في الجدولة ({activeCoursesList.length})</option>
              <option value="disabled">المعطلة للسنة الحالية ({disabledCoursesList.length})</option>
            </select>

            {/* Sort Controls */}
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
                <option value="semester">السداسي</option>
                <option value="coefficient">المعامل</option>
                <option value="credits">الرصيد</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="text-xs text-muted-foreground hover:text-foreground px-1 font-bold"
                title="عكس اتجاه الترتيب"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground whitespace-nowrap self-end lg:self-center">
            <span>
              النتائج المطابقة: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{filteredCourses.length}</strong> مقياس
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
                  <th className="py-3.5 px-4 font-semibold w-12 text-center">#</th>
                  <th className="py-3.5 px-4 font-semibold">المقياس التدريسي والرمز</th>
                  <th className="py-3.5 px-4 font-semibold">السداسي</th>
                  <th className="py-3.5 px-4 font-semibold">المستوى والتخصص</th>
                  <th className="py-3.5 px-4 font-semibold">المعامل والرصيد</th>
                  <th className="py-3.5 px-4 font-semibold">أنواع الحصص</th>
                  <th className="py-3.5 px-4 font-semibold text-center w-28">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      جارٍ جلب وتحديث دليل المقاييس من السيرفر الآمن...
                    </td>
                  </tr>
                ) : filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-muted-foreground">
                      <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                      لا توجد مقاييس مطابقة لمعايير البحث والتصفية المختارة.
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map((course) => {
                    const meta = parseCourseMeta(course);
                    const isS1 = meta.semester === 'S1';
                    return (
                      <tr
                        key={course.id}
                        className={`transition-colors border-b border-border/60 ${
                          !meta.is_active
                            ? 'bg-amber-500/[0.04] dark:bg-amber-950/20 opacity-80'
                            : 'hover:bg-muted/30'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground text-center">
                          {course.id}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground text-base">
                              {course.name}
                            </span>
                            {!meta.is_active && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                                <PowerOff className="h-3 w-3" />
                                معطل للسنة الحالية {meta.disabled_academic_year ? `(${meta.disabled_academic_year})` : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 font-mono">
                            {course.code ? (
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-foreground border border-border">
                                {course.code}
                              </span>
                            ) : null}
                            <span>v{course.version || 1}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                              isS1
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200'
                                : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200'
                            }`}
                          >
                            {isS1 ? 'السداسي 1 (S1)' : 'السداسي 2 (S2)'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {meta.study_level ? (
                                <span className="bg-slate-800 text-slate-200 border border-slate-700 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                                  {meta.study_level}
                                </span>
                              ) : null}
                              {meta.specialties && meta.specialties.length > 0 ? (
                                meta.specialties.length <= 2 ? (
                                  meta.specialties.map((s, idx) => (
                                    <span
                                      key={idx}
                                      className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] px-2 py-0.5 rounded-md font-medium"
                                    >
                                      {s}
                                    </span>
                                  ))
                                ) : (
                                  <>
                                    <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] px-2 py-0.5 rounded-md font-medium">
                                      {meta.specialties[0]}
                                    </span>
                                    <span
                                      className="bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[10px] px-1.5 py-0.5 rounded-md cursor-help"
                                      title={meta.specialties.join('\n')}
                                    >
                                      +{meta.specialties.length - 1} تخصصات أخرى
                                    </span>
                                  </>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground font-medium">
                                  {meta.specialization || course.department_name || 'جذع مشترك'}
                                </span>
                              )}
                            </div>
                            {course.department_name && (
                              <span className="text-[10px] text-muted-foreground">
                                {course.department_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-semibold text-foreground">
                            المعامل: <span className="font-bold text-indigo-600 dark:text-indigo-400">{meta.coefficient}</span> | الرصيد: <span className="font-bold text-indigo-600 dark:text-indigo-400">{meta.credits}</span> ECTS
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-mono text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                              {meta.weekly_hours} س/أسبوع
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 font-medium">
                            {meta.lecture_hours > 0 && <span>محاضرة: {meta.lecture_hours}س</span>}
                            {meta.lecture_hours > 0 && (meta.td_hours > 0 || meta.tp_hours > 0) && <span>•</span>}
                            {meta.td_hours > 0 && <span>TD: {meta.td_hours}س</span>}
                            {meta.td_hours > 0 && meta.tp_hours > 0 && <span>•</span>}
                            {meta.tp_hours > 0 && <span>TP: {meta.tp_hours}س</span>}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {meta.session_types.includes('lecture') && (
                              <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700">
                                محاضرة {meta.lecture_hours > 0 ? `(${meta.lecture_hours}س)` : ''}
                              </span>
                            )}
                            {meta.session_types.includes('td') && (
                              <span className="px-2 py-0.5 rounded text-[11px] bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 font-medium">
                                TD {meta.td_hours > 0 ? `(${meta.td_hours}س)` : ''}
                              </span>
                            )}
                            {meta.session_types.includes('tp') && (
                              <span className="px-2 py-0.5 rounded text-[11px] bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 font-medium">
                                TP {meta.tp_hours > 0 ? `(${meta.tp_hours}س)` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(course)}
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                              title="تعديل بيانات المقياس"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span>تعديل</span>
                            </button>

                            {/* زر تعطيل / أرشفة المقياس خلال السنة الجامعية الحالية */}
                            <button
                              onClick={() => handleToggleActive(course)}
                              disabled={togglingCourseId === course.id}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                meta.is_active
                                  ? 'text-amber-700 hover:text-amber-800 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40'
                                  : 'text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40'
                              }`}
                              title={
                                meta.is_active
                                  ? 'تعطيل (أرشفة) المقياس خلال السنة الجامعية الحالية (استبعاد من الجدولة الآلية والإحصائيات)'
                                  : 'تفعيل المقياس وإعادة إدراجه في مصفوفة الجداول والإحصائيات'
                              }
                            >
                              {togglingCourseId === course.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : meta.is_active ? (
                                <PowerOff className="h-3.5 w-3.5" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              <span>{meta.is_active ? 'تعطيل' : 'تفعيل'}</span>
                            </button>

                            <button
                              onClick={() => handleOpenDelete(course)}
                              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
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
          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border-b border-border flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-medium">
            <Archive className="h-4 w-4 shrink-0" />
            <span>
              سلة المؤرشفات تحتوي على المقاييس المحذوفة بأمان (Soft Deleted). يمكنك استعادتها فوراً بنقرة واحدة مع كامل تفاصيلها البيداغوجية.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted/50 text-muted-foreground text-xs border-b border-border">
                <tr>
                  <th className="py-3.5 px-4 font-semibold w-12 text-center">#</th>
                  <th className="py-3.5 px-4 font-semibold">اسم المقياس</th>
                  <th className="py-3.5 px-4 font-semibold">الرمز</th>
                  <th className="py-3.5 px-4 font-semibold">تاريخ الأرشفة</th>
                  <th className="py-3.5 px-4 font-semibold text-center w-36">استعادة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {archivedCourses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-muted-foreground">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
                      سلة المؤرشفات فارغة تماماً.
                    </td>
                  </tr>
                ) : (
                  archivedCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground text-center">{course.id}</td>
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

      {/* Excel Import Modal */}
      <ImportCoursesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(msg) => {
          alert('✅ ' + msg);
          loadCourses();
        }}
      />

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
      <Dialog
        open={showFormModal}
        onClose={() => setShowFormModal(false)}
        size="lg"
        className="bg-slate-900 border-slate-700 text-slate-100 max-h-[92vh] overflow-y-auto max-w-2xl text-right p-6 rounded-2xl space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-indigo-400">
            <BookOpen className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold text-slate-100">
              {editingCourse ? 'تعديل بيانات المقياس التدريسي' : 'إضافة مقياس بيداغوجي جديد'}
            </DialogTitle>
          </div>
          {editingCourse && (
            <Badge variant="outline" className="text-xs font-mono text-slate-300 border-slate-700 bg-slate-800">
              v{editingCourse.version || 1}
            </Badge>
          )}
        </div>

        <DialogDescription className="text-xs text-slate-400">
          اربط المقياس بالسداسي المناسب، وحدد المستوى والتخصصات المعنية، المعامل والرصيد وفق دفتر الشروط البيداغوجي.
        </DialogDescription>

        {conflictError && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{conflictError}</p>
          </div>
        )}

        <form onSubmit={handleSaveCourse} className="space-y-4">
          {/* Course Name & Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                اسم المقياس <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: الخوارزميات وهياكل البيانات 1..."
                className="w-full px-3 py-2 border border-slate-700 rounded-xl text-sm bg-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                رمز المقياس (Code)
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="مثال: INF101"
                className="w-full px-3 py-2 border border-slate-700 rounded-xl text-sm bg-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Semester & Study Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                السداسي البيداغوجي <span className="text-rose-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, semester: 'S1' })}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                    formData.semester === 'S1'
                      ? 'border-blue-500 bg-blue-950/60 text-blue-200 ring-2 ring-blue-500/30'
                      : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  السداسي الأول (S1)
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, semester: 'S2' })}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                    formData.semester === 'S2'
                      ? 'border-purple-500 bg-purple-950/60 text-purple-200 ring-2 ring-purple-500/30'
                      : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  السداسي الثاني (S2)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                الطور والمستوى الدراسي
              </label>
              <select
                value={formData.studyLevel}
                onChange={(e) => setFormData({ ...formData, studyLevel: e.target.value })}
                className="w-full px-3 py-2 border border-slate-700 rounded-xl text-sm bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="L1">سنة أولى ليسانس (L1)</option>
                <option value="L2">سنة ثانية ليسانس (L2)</option>
                <option value="L3">سنة ثالثة ليسانس (L3)</option>
                <option value="M1">سنة أولى ماستر (M1)</option>
                <option value="M2">سنة ثانية ماستر (M2)</option>
              </select>
            </div>
          </div>

          {/* Multi-Select Specialties Component */}
          <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-xl space-y-2">
            <MultiSelectSpecialties
              selected={formData.specialties}
              onChange={(specs) =>
                setFormData({
                  ...formData,
                  specialties: specs,
                  specialization: specs.join('، '),
                })
              }
              currentStudyLevel={formData.studyLevel}
            />
          </div>

          {/* Department Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              القسم الأكاديمي
            </label>
            <select
              value={formData.departmentId}
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-700 rounded-xl text-sm bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">بدون قسم / قسم عام / جذع مشترك</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Coefficient & Credits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                المعامل (Coefficient)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                required
                value={formData.coefficient}
                onChange={(e) => setFormData({ ...formData, coefficient: Number(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-slate-700 rounded-xl text-sm bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                الرصيد (ECTS Credits)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                required
                value={formData.credits}
                onChange={(e) => setFormData({ ...formData, credits: Number(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-slate-700 rounded-xl text-sm bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>
          </div>

          {/* Session Types & Weekly Hours Allocation for Automated Scheduling Matrix */}
          <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/70 space-y-3.5 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-100">
                  أنواع الحصص وتوزيع الساعات الأسبوعية:
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  حدد الحجم الساعي الأسبوعي لكل نمط حصة لاعتمادها في مصفوفة الجداول الآلية
                </p>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/70 border border-indigo-500/40 px-2.5 py-1 rounded-xl shadow-sm inline-block">
                  الإجمالي: <strong className="text-white text-xs">{formData.weeklyHours.toFixed(1)}</strong> س/أسبوع
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Lecture (Cours) */}
              <div
                className={`p-3 rounded-xl border transition-all ${
                  formData.hasLecture
                    ? 'bg-slate-900 border-indigo-500/50 ring-1 ring-indigo-500/20'
                    : 'bg-slate-900/40 border-slate-800 opacity-60'
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer text-slate-200 mb-2">
                  <input
                    type="checkbox"
                    checked={formData.hasLecture}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const newL = checked ? (formData.lectureHours > 0 ? formData.lectureHours : 1.5) : 0;
                      const newTotal = newL + (formData.hasTD ? formData.tdHours : 0) + (formData.hasTP ? formData.tpHours : 0);
                      setFormData({
                        ...formData,
                        hasLecture: checked,
                        lectureHours: newL,
                        weeklyHours: Number(newTotal.toFixed(1))
                      });
                    }}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="font-bold text-xs">محاضرة (Cours)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    disabled={!formData.hasLecture}
                    value={formData.lectureHours}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      const newTotal = val + (formData.hasTD ? formData.tdHours : 0) + (formData.hasTP ? formData.tpHours : 0);
                      setFormData({
                        ...formData,
                        lectureHours: val,
                        weeklyHours: Number(newTotal.toFixed(1))
                      });
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-700 rounded-lg text-xs bg-slate-800 text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
                  />
                  <span className="text-[11px] text-slate-400 shrink-0 font-medium">س/أسبوع</span>
                </div>
              </div>

              {/* TD */}
              <div
                className={`p-3 rounded-xl border transition-all ${
                  formData.hasTD
                    ? 'bg-slate-900 border-amber-500/50 ring-1 ring-amber-500/20'
                    : 'bg-slate-900/40 border-slate-800 opacity-60'
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer text-slate-200 mb-2">
                  <input
                    type="checkbox"
                    checked={formData.hasTD}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const newTD = checked ? (formData.tdHours > 0 ? formData.tdHours : 1.5) : 0;
                      const newTotal = (formData.hasLecture ? formData.lectureHours : 0) + newTD + (formData.hasTP ? formData.tpHours : 0);
                      setFormData({
                        ...formData,
                        hasTD: checked,
                        tdHours: newTD,
                        weeklyHours: Number(newTotal.toFixed(1))
                      });
                    }}
                    className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500 h-4 w-4"
                  />
                  <span className="font-bold text-xs">أعمال موجهة (TD)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    disabled={!formData.hasTD}
                    value={formData.tdHours}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      const newTotal = (formData.hasLecture ? formData.lectureHours : 0) + val + (formData.hasTP ? formData.tpHours : 0);
                      setFormData({
                        ...formData,
                        tdHours: val,
                        weeklyHours: Number(newTotal.toFixed(1))
                      });
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-700 rounded-lg text-xs bg-slate-800 text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 disabled:opacity-40"
                  />
                  <span className="text-[11px] text-slate-400 shrink-0 font-medium">س/أسبوع</span>
                </div>
              </div>

              {/* TP */}
              <div
                className={`p-3 rounded-xl border transition-all ${
                  formData.hasTP
                    ? 'bg-slate-900 border-purple-500/50 ring-1 ring-purple-500/20'
                    : 'bg-slate-900/40 border-slate-800 opacity-60'
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer text-slate-200 mb-2">
                  <input
                    type="checkbox"
                    checked={formData.hasTP}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const newTP = checked ? (formData.tpHours > 0 ? formData.tpHours : 1.5) : 0;
                      const newTotal = (formData.hasLecture ? formData.lectureHours : 0) + (formData.hasTD ? formData.tdHours : 0) + newTP;
                      setFormData({
                        ...formData,
                        hasTP: checked,
                        tpHours: newTP,
                        weeklyHours: Number(newTotal.toFixed(1))
                      });
                    }}
                    className="rounded border-slate-700 bg-slate-800 text-purple-500 focus:ring-purple-500 h-4 w-4"
                  />
                  <span className="font-bold text-xs">أعمال تطبيقية (TP)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    disabled={!formData.hasTP}
                    value={formData.tpHours}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      const newTotal = (formData.hasLecture ? formData.lectureHours : 0) + (formData.hasTD ? formData.tdHours : 0) + val;
                      setFormData({
                        ...formData,
                        tpHours: val,
                        weeklyHours: Number(newTotal.toFixed(1))
                      });
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-700 rounded-lg text-xs bg-slate-800 text-slate-100 font-bold focus:ring-2 focus:ring-purple-500 disabled:opacity-40"
                  />
                  <span className="text-[11px] text-slate-400 shrink-0 font-medium">س/أسبوع</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed text-right">
              * تُعتمد هذه الساعات في مصفوفة الجداول الآلية (P13) لتحديد مدد الحصص واحتساب الأعباء البيداغوجية للأساتذة والأفواج بدقة.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFormModal(false)}
              className="rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white gap-2 font-semibold shadow-lg shadow-indigo-600/20"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>جارٍ الحفظ...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>{editingCourse ? 'تحديث بيانات المقياس' : 'حفظ المقياس في الدليل'}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
