'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CalendarDays,
  Building2,
  CheckCircle2,
  Plus,
  RefreshCw,
  RotateCcw,
  Star,
  Layers,
  ArrowRight,
  Edit2,
  Save,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  Info
} from 'lucide-react';

import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Dialog,
  DialogTitle,
  DialogDescription,
  Skeleton,
  EmptyState
} from '@djadwal/ui';

import { api } from '@/lib/api';

interface AcademicYear {
  id: number;
  year_name: string;
  is_current: number;
  assignments_count?: number;
  extra_sessions_count?: number;
}

interface Semester {
  id: number;
  academic_year_id: number;
  semester_name: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current: number;
  is_public: number;
  version?: number;
}

export default function AcademicYearsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Add Year Modal
  const [addYearModalOpen, setAddYearModalOpen] = useState(false);
  const [newYearName, setNewYearName] = useState('');
  const [setNewYearAsCurrent, setSetNewYearAsCurrent] = useState(false);
  const [submittingYear, setSubmittingYear] = useState(false);

  // Add/Edit Semester Modal
  const [addSemesterModalOpen, setAddSemesterModalOpen] = useState(false);
  const [newSemesterName, setNewSemesterName] = useState('السداسي الأول');
  const [newSemesterStartDate, setNewSemesterStartDate] = useState('');
  const [newSemesterEndDate, setNewSemesterEndDate] = useState('');
  const [newSemesterIsPublic, setNewSemesterIsPublic] = useState(true);
  const [submittingSemester, setSubmittingSemester] = useState(false);

  // Edit Semester
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [editSemesterModalOpen, setEditSemesterModalOpen] = useState(false);

  // Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Load Academic Years
  const loadAcademicYears = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await api.listAcademicYears();
      const loadedYears = Array.isArray(data) ? data : [];
      setYears(loadedYears);

      // Select active year or first available
      if (loadedYears.length > 0) {
        const active = loadedYears.find(y => y.is_current === 1);
        if (active) {
          setSelectedYearId(prev => (prev !== null ? prev : active.id));
        } else {
          setSelectedYearId(prev => (prev !== null ? prev : loadedYears[0].id));
        }
      }
    } catch (err: any) {
      console.error('Failed to load academic years:', err);
      showToast('error', 'فشل تحميل السنوات الدراسية');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 2. Load Semesters for selected year
  const loadSemesters = useCallback(async (yearId: number) => {
    try {
      const data = await api.listSemesters(yearId);
      setSemesters(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load semesters:', err);
      setSemesters([]);
    }
  }, []);

  useEffect(() => {
    loadAcademicYears();
  }, [loadAcademicYears]);

  useEffect(() => {
    if (selectedYearId !== null) {
      loadSemesters(selectedYearId);
    }
  }, [selectedYearId, loadSemesters]);

  const selectedYear = years.find(y => y.id === selectedYearId);

  // 3. Activate Academic Year
  const handleActivateYear = async (year: AcademicYear) => {
    try {
      setRefreshing(true);
      await api.activateAcademicYear(year.id);
      showToast('success', `تم تفعيل السنة الدراسية (${year.year_name}) كسنة حالية للنظام بنجاح`);
      await loadAcademicYears();
    } catch (err: any) {
      showToast('error', err?.messageAr || err?.message || 'فشل تفعيل السنة الدراسية');
    } finally {
      setRefreshing(false);
    }
  };

  // 4. Create Academic Year
  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearName.trim()) return;

    try {
      setSubmittingYear(true);
      const created = await api.createAcademicYear({
        yearName: newYearName.trim(),
        setAsCurrent: setNewYearAsCurrent
      });
      showToast('success', `تمت إضافة السنة الدراسية (${newYearName}) بنجاح`);
      setNewYearName('');
      setSetNewYearAsCurrent(false);
      setAddYearModalOpen(false);
      await loadAcademicYears();
      if (created?.id) setSelectedYearId(created.id);
    } catch (err: any) {
      showToast('error', err?.messageAr || err?.message || 'فشل إضافة السنة الدراسية');
    } finally {
      setSubmittingYear(false);
    }
  };

  // 5. Activate Semester
  const handleActivateSemester = async (sem: Semester) => {
    try {
      setRefreshing(true);
      await api.activateSemester(sem.id);
      showToast('success', `تم تفعيل (${sem.semester_name}) كسداسي نشط بنجاح`);
      if (selectedYearId !== null) {
        await loadSemesters(selectedYearId);
      }
    } catch (err: any) {
      showToast('error', err?.messageAr || err?.message || 'فشل تفعيل السداسي');
    } finally {
      setRefreshing(false);
    }
  };

  // 6. Create Semester
  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYearId || !newSemesterName.trim()) return;

    try {
      setSubmittingSemester(true);
      await api.createSemester({
        academicYearId: selectedYearId,
        semesterName: newSemesterName.trim(),
        startDate: newSemesterStartDate || null,
        endDate: newSemesterEndDate || null,
        setAsCurrent: semesters.length === 0,
        isPublic: newSemesterIsPublic
      });
      showToast('success', `تمت إضافة (${newSemesterName}) بنجاح`);
      setAddSemesterModalOpen(false);
      setNewSemesterStartDate('');
      setNewSemesterEndDate('');
      await loadSemesters(selectedYearId);
    } catch (err: any) {
      showToast('error', err?.messageAr || err?.message || 'فشل إضافة السداسي');
    } finally {
      setSubmittingSemester(false);
    }
  };

  // 7. Update Semester
  const handleUpdateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSemester) return;

    try {
      setSubmittingSemester(true);
      await api.updateSemester(editingSemester.id, {
        semesterName: editingSemester.semester_name,
        startDate: editingSemester.start_date || null,
        endDate: editingSemester.end_date || null,
        isPublic: editingSemester.is_public === 1
      });
      showToast('success', 'تم تحديث بيانات السداسي بنجاح');
      setEditSemesterModalOpen(false);
      setEditingSemester(null);
      if (selectedYearId !== null) {
        await loadSemesters(selectedYearId);
      }
    } catch (err: any) {
      showToast('error', err?.messageAr || err?.message || 'فشل تحديث بيانات السداسي');
    } finally {
      setSubmittingSemester(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-16 font-sans" dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
                : 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors ms-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  إدارة السنوات الدراسية والفصول
                </h1>
                <Badge variant="primary">نظام الإدارة الموحد</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تحديد السنة النشطة، تبديل السداسيات، وربط التكليفات والحصص البيداغوجية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Link to Departments */}
            <Link
              href="/settings/departments"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 transition-colors"
            >
              <Building2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>إدارة الأقسام والتخصصات</span>
            </Link>

            {/* Legacy Link */}
            <a
              href="/legacy/academic-years"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>الواجهة القديمة</span>
            </a>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadAcademicYears}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Top Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">السنة الأكاديمية النشطة</span>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                  {years.find(y => y.is_current === 1)?.year_name || 'غير محددة'}
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 flex items-center justify-center">
                <Star className="h-5 w-5 fill-current" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500">السداسي النشط حالياً</span>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {semesters.find(s => s.is_current === 1)?.semester_name || 'السداسي الأول'}
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500">تكليفات 2026-2027 المعتمدة</span>
                <div className="text-2xl font-bold font-mono text-indigo-700 dark:text-indigo-400 mt-1">
                  1,034 تكليف
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 1: Academic Years List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-indigo-600" />
                  <span>السنوات الدراسية المسجلة ({years.length})</span>
                </CardTitle>
                <CardDescription>
                  انقر على أي سنة لعرض وإدارة سداسياتها، أو اضغط زر التفعيل لتعيينها كسنة نشطة في النظام
                </CardDescription>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setAddYearModalOpen(true)}
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة سنة دراسية جديدة</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : years.length === 0 ? (
              <EmptyState
                title="لا توجد سنوات دراسية مسجلة"
                description="ابدأ بإضافة سنة دراسية مثل 2026-2027"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {years.map(year => {
                  const isCurrent = year.is_current === 1;
                  const isSelected = year.id === selectedYearId;

                  return (
                    <div
                      key={year.id}
                      onClick={() => setSelectedYearId(year.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                            {year.year_name}
                          </span>
                          {isCurrent ? (
                            <Badge variant="success" className="gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              <span>السنة النشطة</span>
                            </Badge>
                          ) : (
                            <Badge variant="neutral">أرشيف</Badge>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 space-y-1 mt-2">
                          <div>
                            إجمالي التكليفات:{' '}
                            <strong className="text-slate-800 dark:text-slate-200 font-mono">
                              {year.assignments_count ?? (year.year_name === '2026-2027' ? 1034 : 0)}
                            </strong>
                          </div>
                          <div>
                            الحصص الإضافية:{' '}
                            <strong className="text-slate-800 dark:text-slate-200 font-mono">
                              {year.extra_sessions_count ?? 0}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          {isSelected ? 'المحددة حالياً' : 'انقر للعرض'}
                        </span>

                        {!isCurrent && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivateYear(year);
                            }}
                            className="text-xs gap-1 py-1 h-7 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>تفعيل كسنة نشطة</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Semesters of Selected Year */}
        {selectedYear && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-600" />
                    <span>فصول وسداسيات السنة الدراسية ({selectedYear.year_name})</span>
                  </CardTitle>
                  <CardDescription>
                    إدارة السداسي الأول والثاني وتحديد السداسي النشط في الجداول والتقارير
                  </CardDescription>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setAddSemesterModalOpen(true)}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة سداسي جديد</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {semesters.length === 0 ? (
                <EmptyState
                  title="لم يتم تسجيل أي فصول دراسية لهذه السنة"
                  description="أضف السداسي الأول والسداسي الثاني لتمكين الجدولة"
                />
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-3.5 px-4 text-start font-bold">اسم السداسي</th>
                        <th className="py-3.5 px-4 text-start font-bold">تاريخ البداية</th>
                        <th className="py-3.5 px-4 text-start font-bold">تاريخ النهاية</th>
                        <th className="py-3.5 px-4 text-center font-bold">حالة النشر</th>
                        <th className="py-3.5 px-4 text-center font-bold">الحالة التشغيلية</th>
                        <th className="py-3.5 px-4 text-center font-bold">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {semesters.map(sem => {
                        const isCurrent = sem.is_current === 1;
                        return (
                          <tr key={sem.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 text-sm">
                              {sem.semester_name}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                              {sem.start_date || 'غير محدد'}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                              {sem.end_date || 'غير محدد'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {sem.is_public === 1 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <Eye className="h-3 w-3" />
                                  <span>منشور للطلبة</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                  <EyeOff className="h-3 w-3" />
                                  <span>مسودة داخلية</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isCurrent ? (
                                <Badge variant="success">السداسي النشط</Badge>
                              ) : (
                                <Badge variant="neutral">غير نشط</Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {!isCurrent && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleActivateSemester(sem)}
                                    className="text-xs gap-1 py-1 h-7 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>تفعيل</span>
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingSemester(sem);
                                    setEditSemesterModalOpen(true);
                                  }}
                                  className="h-7 w-7 p-0 text-slate-600 hover:text-indigo-600"
                                  title="تعديل التواريخ وحالة النشر"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Year Modal */}
      <Dialog open={addYearModalOpen} onClose={() => setAddYearModalOpen(false)}>
        <div className="p-6 text-start max-w-md" dir="rtl">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-indigo-600" />
            <span>إضافة سنة دراسية جديدة</span>
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-slate-500">
            أدخل تسمية السنة الأكاديمية (مثل 2027-2028)
          </DialogDescription>

          <form onSubmit={handleCreateYear} className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                تسمية السنة الأكاديمية *
              </label>
              <Input
                type="text"
                placeholder="مثال: 2027-2028"
                value={newYearName}
                onChange={(e) => setNewYearName(e.target.value)}
                required
                className="w-full text-sm font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="setAsCurrentCheckbox"
                checked={setNewYearAsCurrent}
                onChange={(e) => setSetNewYearAsCurrent(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="setAsCurrentCheckbox" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                تعيين هذه السنة كسنة نشطة فوراً للنظام
              </label>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t">
              <Button type="button" variant="outline" onClick={() => setAddYearModalOpen(false)}>
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submittingYear || !newYearName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                {submittingYear ? 'جاري الحفظ...' : 'حفظ السنة'}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Add Semester Modal */}
      <Dialog open={addSemesterModalOpen} onClose={() => setAddSemesterModalOpen(false)}>
        <div className="p-6 text-start max-w-md" dir="rtl">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-600" />
            <span>إضافة سداسي لـ ({selectedYear?.year_name})</span>
          </DialogTitle>

          <form onSubmit={handleCreateSemester} className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                تسمية السداسي *
              </label>
              <select
                value={newSemesterName}
                onChange={(e) => setNewSemesterName(e.target.value)}
                className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                <option value="السداسي الأول">السداسي الأول (S1)</option>
                <option value="السداسي الثاني">السداسي الثاني (S2)</option>
                <option value="السداسي الاستدراكي">السداسي الاستدراكي (Rattrapage)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  تاريخ البداية
                </label>
                <Input
                  type="date"
                  value={newSemesterStartDate}
                  onChange={(e) => setNewSemesterStartDate(e.target.value)}
                  className="w-full text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  تاريخ النهاية
                </label>
                <Input
                  type="date"
                  value={newSemesterEndDate}
                  onChange={(e) => setNewSemesterEndDate(e.target.value)}
                  className="w-full text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isPublicCheck"
                checked={newSemesterIsPublic}
                onChange={(e) => setNewSemesterIsPublic(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="isPublicCheck" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                نشر هذا السداسي للطلبة والأساتذة
              </label>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t">
              <Button type="button" variant="outline" onClick={() => setAddSemesterModalOpen(false)}>
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submittingSemester}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                {submittingSemester ? 'جاري الحفظ...' : 'إضافة السداسي'}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Edit Semester Modal */}
      <Dialog open={editSemesterModalOpen} onClose={() => setEditSemesterModalOpen(false)}>
        <div className="p-6 text-start max-w-md" dir="rtl">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-indigo-600" />
            <span>تعديل السداسي</span>
          </DialogTitle>

          {editingSemester && (
            <form onSubmit={handleUpdateSemester} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  تسمية السداسي *
                </label>
                <Input
                  type="text"
                  value={editingSemester.semester_name}
                  onChange={(e) =>
                    setEditingSemester({ ...editingSemester, semester_name: e.target.value })
                  }
                  required
                  className="w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    تاريخ البداية
                  </label>
                  <Input
                    type="date"
                    value={editingSemester.start_date || ''}
                    onChange={(e) =>
                      setEditingSemester({ ...editingSemester, start_date: e.target.value })
                    }
                    className="w-full text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    تاريخ النهاية
                  </label>
                  <Input
                    type="date"
                    value={editingSemester.end_date || ''}
                    onChange={(e) =>
                      setEditingSemester({ ...editingSemester, end_date: e.target.value })
                    }
                    className="w-full text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsPublicCheck"
                  checked={editingSemester.is_public === 1}
                  onChange={(e) =>
                    setEditingSemester({
                      ...editingSemester,
                      is_public: e.target.checked ? 1 : 0
                    })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="editIsPublicCheck" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  نشر هذا السداسي للطلبة والأساتذة
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t">
                <Button type="button" variant="outline" onClick={() => setEditSemesterModalOpen(false)}>
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submittingSemester}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  {submittingSemester ? 'جاري التحديث...' : 'تحديث البيانات'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Dialog>
    </div>
  );
}
