'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2,
  CalendarDays,
  Plus,
  RefreshCw,
  RotateCcw,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Users,
  BookOpen,
  Users2,
  ShieldAlert,
  ArrowRight
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

interface Department {
  id: number;
  name: string;
  code?: string;
  created_at?: string;
  specializations_count?: number;
  professors_count?: number;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Impact Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<any>(null);
  const [isCheckingImpact, setIsCheckingImpact] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadDepartments = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await api.listDepartments();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load departments:', err);
      showToast('error', 'فشل في تحميل قائمة الأقسام');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const handleOpenAdd = () => {
    setEditingDept(null);
    setDeptName('');
    setDeptCode('');
    setModalOpen(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setDeptName(dept.name);
    setDeptCode(dept.code || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;

    try {
      setIsSubmitting(true);
      if (editingDept) {
        await api.updateDepartment(editingDept.id, {
          name: deptName.trim(),
          code: deptCode.trim() || undefined
        });
        showToast('success', 'تم تعديل بيانات القسم بنجاح');
      } else {
        await api.createDepartment({
          name: deptName.trim(),
          code: deptCode.trim() || undefined
        });
        showToast('success', 'تمت إضافة القسم الجديد بنجاح');
      }
      setModalOpen(false);
      await loadDepartments();
    } catch (err: any) {
      showToast('error', err?.messageAr || err?.message || 'فشلت العملية');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Delete Impact
  const handleOpenDelete = async (dept: Department) => {
    setDeptToDelete(dept);
    setDeleteImpact(null);
    setDeleteModalOpen(true);
    setIsCheckingImpact(true);

    try {
      const impact = await api.getDeleteImpact('departments', dept.id);
      setDeleteImpact(impact);
    } catch (err) {
      console.error('Impact check error:', err);
    } finally {
      setIsCheckingImpact(false);
    }
  };

  // Confirm Archive / Delete
  const handleConfirmDelete = async () => {
    if (!deptToDelete) return;

    try {
      setIsDeleting(true);
      await api.archiveCascadeDepartment(deptToDelete.id);
      showToast('success', `تمت أرشفة قسم (${deptToDelete.name}) بنجاح`);
      setDeleteModalOpen(false);
      setDeptToDelete(null);
      await loadDepartments();
    } catch (err: any) {
      showToast('error', err?.messageAr || err?.message || 'فشلت عملية الحذف');
    } finally {
      setIsDeleting(false);
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

      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  إدارة الأقسام البيداغوجية
                </h1>
                <Badge variant="primary">الهيكل الأكاديمي</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                أقسام الكلية، التخصصات التابعة، وحماية العلاقات البيداغوجية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings/academic-years"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>السنوات الدراسية والفصول</span>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={loadDepartments}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  <span>قائمة الأقسام المعتمدة ({departments.length})</span>
                </CardTitle>
                <CardDescription>
                  الأقسام الأكاديمية الرسمية بكلية العلوم الاقتصادية والتجارية وعلوم التسيير
                </CardDescription>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenAdd}
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة قسم جديد</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : departments.length === 0 ? (
              <EmptyState
                title="لا توجد أقسام مسجلة"
                description="ابدأ بإضافة أول قسم للكلية"
              />
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3.5 px-4 text-start font-bold">اسم القسم</th>
                      <th className="py-3.5 px-4 text-start font-bold">الرمز الأكاديمي</th>
                      <th className="py-3.5 px-4 text-start font-bold">تاريخ الإنشاء</th>
                      <th className="py-3.5 px-4 text-center font-bold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {departments.map(dept => (
                      <tr key={dept.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {dept.name}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          {dept.code || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {dept.created_at ? new Date(dept.created_at).toLocaleDateString('ar-DZ') : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEdit(dept)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-indigo-600"
                              title="تعديل بيانات القسم"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDelete(dept)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-rose-600"
                              title="أرشفة / حذف القسم"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="p-6 text-start max-w-md" dir="rtl">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <span>{editingDept ? 'تعديل بيانات القسم' : 'إضافة قسم جديد'}</span>
          </DialogTitle>

          <form onSubmit={handleSave} className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                اسم القسم *
              </label>
              <Input
                type="text"
                placeholder="مثال: قسم العلوم الاقتصادية"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                required
                className="w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                الرمز الأكاديمي (اختياري)
              </label>
              <Input
                type="text"
                placeholder="مثال: ECO"
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                className="w-full text-xs font-mono uppercase"
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !deptName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                {isSubmitting ? 'جاري الحفظ...' : editingDept ? 'تحديث القسم' : 'حفظ القسم'}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Delete Impact & Confirmation Modal */}
      <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <div className="p-6 text-start max-w-md" dir="rtl">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
            <span>تأكيد أرشفة / حذف القسم</span>
          </DialogTitle>

          <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 space-y-3">
            <p>
              هل أنت متأكد من رغبتك في أرشفة قسم <strong>"{deptToDelete?.name}"</strong>؟
            </p>

            {/* Delete Impact Analysis Display */}
            {isCheckingImpact ? (
              <div className="p-3 rounded-xl bg-slate-50 text-slate-500 text-center animate-pulse">
                جاري حساب الأثر البيداغوجي المترتب على الحذف...
              </div>
            ) : deleteImpact ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>معاينة الأثر البيداغوجي المباشر:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li>الأساتذة المتأثرون: <strong>{deleteImpact.impact?.affected_professors_count ?? 0}</strong></li>
                  <li>المقاييس المتأثرة: <strong>{deleteImpact.impact?.affected_courses_count ?? 0}</strong></li>
                  <li>الأفواج المتأثرة: <strong>{deleteImpact.impact?.affected_groups_count ?? 0}</strong></li>
                </ul>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 pt-1">
                  سيتم تطبيق الحذف الناعم (Soft Delete) لحفظ التاريخ والتراجع بأمان عند الحاجة.
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              تراجع
            </Button>
            <Button
              variant="danger"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              {isDeleting ? 'جاري الأرشفة...' : 'نعم، أرشف القسم'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
