'use client';

import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Award,
  Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import DeleteImpactModal from '@/components/DeleteImpactModal';
import UndoToast from '@/components/UndoToast';

interface Course {
  id: number;
  name: string;
  code?: string;
  credits?: number;
  hours?: number;
  department_id?: number;
  department_name?: string;
  version?: number;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCourse, setNewCourse] = useState({ name: '', code: '', credits: 3, hours: 45 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await api.get('/catalog/courses?limit=500');
      if (Array.isArray(data)) {
        setCourses(data);
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

  const handleOpenDelete = async (course: Course) => {
    setSelectedCourse(course);
    setDeleteModalOpen(true);
    try {
      const res = await api.getDeleteImpact('courses', course.id);
      setDeleteImpact(res.impact);
    } catch (_) {
      setDeleteImpact(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedCourse) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/catalog/courses/${selectedCourse.id}`);
      setDeleteModalOpen(false);
      setCourses((prev) => prev.filter((c) => c.id !== selectedCourse.id));

      setUndoToast({
        show: true,
        message: `تم حذف المقياس ${selectedCourse.name} بنجاح.`,
        changeLogId: res?.changeLogId || null,
      });
    } catch (err: any) {
      alert(err.message || 'فشل حذف المقياس');
    } finally {
      setIsDeleting(false);
      setSelectedCourse(null);
    }
  };

  const handleUndo = async (id: number) => {
    setIsUndoing(true);
    try {
      await api.undoChange(id);
      setUndoToast({ show: false, message: '' });
      await loadCourses();
      alert('✅ تم التراجع عن حذف المقياس بنجاح واستعادته!');
    } catch (err: any) {
      alert('فشل التراجع: ' + err.message);
    } finally {
      setIsUndoing(false);
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.name.trim()) return;

    setIsSubmitting(true);
    try {
      await api.post('/catalog/courses', newCourse);
      setShowAddModal(false);
      setNewCourse({ name: '', code: '', credits: 3, hours: 45 });
      await loadCourses();
    } catch (err: any) {
      alert(err.message || 'فشل إضافة المقياس');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCourses = courses.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">إدارة المقاييس والمقررات (Courses)</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            دليل الوحدات والمقاييس التعليمية مع الحجم الساعي والمعاملات
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>إضافة مقياس جديد</span>
        </button>
      </div>

      {/* Search & Stats */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم المقياس أو الرمز..."
            className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>إجمالي المقاييس: <strong className="text-gray-900 font-semibold">{courses.length}</strong></span>
          <span>المطابق للبحث: <strong className="text-blue-600 font-semibold">{filteredCourses.length}</strong></span>
        </div>
      </div>

      {/* Courses Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-600 text-xs border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4 font-semibold">#</th>
                <th className="py-3.5 px-4 font-semibold">اسم المقياس</th>
                <th className="py-3.5 px-4 font-semibold">الرمز (Code)</th>
                <th className="py-3.5 px-4 font-semibold">المعامل / الأرصدة</th>
                <th className="py-3.5 px-4 font-semibold">الحجم الساعي</th>
                <th className="py-3.5 px-4 font-semibold">إصدار (v)</th>
                <th className="py-3.5 px-4 font-semibold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    جارٍ جلب المقاييس من قاعدة البيانات...
                  </td>
                </tr>
              ) : filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    لا توجد مقاييس مطابقة لمعايير البحث.
                  </td>
                </tr>
              ) : (
                filteredCourses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-gray-400">{c.id}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{c.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-blue-600">
                      {c.code ? (
                        <span className="bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {c.code}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Award className="h-3.5 w-3.5 text-gray-400" />
                        {c.credits || 3} أرصدة
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        {c.hours || 45} ساعة
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 font-mono text-xs">
                      v{c.version || 1}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenDelete(c)}
                        className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                        title="حذف مع معاينة الأثر"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>حذف</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteImpactModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="تأكيد حذف مقياس تعليمي مع تقييم الأثر"
        entityName={selectedCourse?.name || ''}
        impact={deleteImpact}
        isLoading={isDeleting}
      />

      <UndoToast
        show={undoToast.show}
        message={undoToast.message}
        changeLogId={undoToast.changeLogId}
        onUndo={handleUndo}
        onClose={() => setUndoToast({ show: false, message: '' })}
        isLoading={isUndoing}
      />

      {/* Add Course Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3">إضافة مقياس جديد</h3>
            <form onSubmit={handleAddCourse} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">اسم المقياس *</label>
                <input
                  type="text"
                  required
                  value={newCourse.name}
                  onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="رياضيات، إحصاء، قواعد بيانات..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">رمز المقياس (Code)</label>
                <input
                  type="text"
                  value={newCourse.code}
                  onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="MATH101"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">الأرصدة / المعامل</label>
                  <input
                    type="number"
                    min="1"
                    value={newCourse.credits}
                    onChange={(e) => setNewCourse({ ...newCourse, credits: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">الحجم الساعي</label>
                  <input
                    type="number"
                    min="1"
                    value={newCourse.hours}
                    onChange={(e) => setNewCourse({ ...newCourse, hours: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ المقياس'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

