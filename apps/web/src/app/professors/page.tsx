'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit,
  Mail,
  Phone,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import DeleteImpactModal from '@/components/DeleteImpactModal';
import UndoToast from '@/components/UndoToast';

interface Professor {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  department_id?: number;
  department_name?: string;
  version?: number;
}

export default function ProfessorsPage() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Delete Impact Modal State (P7)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProf, setSelectedProf] = useState<Professor | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Undo Toast State (P7)
  const [undoToast, setUndoToast] = useState<{
    show: boolean;
    message: string;
    changeLogId?: number | null;
  }>({ show: false, message: '' });
  const [isUndoing, setIsUndoing] = useState(false);

  // New Professor Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProf, setNewProf] = useState({ name: '', email: '', phone: '', title: 'أستاذ محاضر' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProfessors = async () => {
    setLoading(true);
    try {
      const data = await api.get('/professors?limit=500');
      if (Array.isArray(data)) {
        setProfessors(data);
      }
    } catch (err: any) {
      console.error('Failed to load professors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfessors();
  }, []);

  // Open Delete Impact Modal (P7 feature)
  const handleOpenDelete = async (prof: Professor) => {
    setSelectedProf(prof);
    setDeleteModalOpen(true);
    try {
      const impactRes = await api.getDeleteImpact('professors', prof.id);
      setDeleteImpact(impactRes.impact);
    } catch (err) {
      setDeleteImpact(null);
    }
  };

  // Confirm Delete with Soft Delete & Change Log (P7 feature)
  const handleConfirmDelete = async () => {
    if (!selectedProf) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/professors/${selectedProf.id}`);
      setDeleteModalOpen(false);
      setProfessors((prev) => prev.filter((p) => p.id !== selectedProf.id));

      // Show Undo Toast
      setUndoToast({
        show: true,
        message: `تم حذف الأستاذ ${selectedProf.name} بنجاح.`,
        changeLogId: res?.changeLogId || null,
      });
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert(err.message || 'فشل حذف الأستاذ');
    } finally {
      setIsDeleting(false);
      setSelectedProf(null);
    }
  };

  // Undo Delete (P7 feature)
  const handleUndo = async (id: number) => {
    setIsUndoing(true);
    try {
      await api.undoChange(id);
      setUndoToast({ show: false, message: '' });
      await loadProfessors();
      alert('✅ تم التراجع عن الحذف بنجاح واستعادة السجل!');
    } catch (err: any) {
      alert('فشل التراجع: ' + err.message);
    } finally {
      setIsUndoing(false);
    }
  };

  // Add Professor with Idempotency-Key (P8 feature)
  const handleAddProfessor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProf.name.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await api.post('/professors', newProf);
      setShowAddModal(false);
      setNewProf({ name: '', email: '', phone: '', title: 'أستاذ محاضر' });
      await loadProfessors();
    } catch (err: any) {
      alert(err.message || 'فشل إضافة الأستاذ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProfessors = professors.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      p.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">إدارة الأساتذة (Professors)</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            قائمة الأساتذة الدائمين والمؤقتين مع الحذف الآمن وتتبع الأثر (Unit of Work)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة أستاذ جديد</span>
          </button>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو البريد أو الرتبة..."
            className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>العدد الإجمالي: <strong className="text-gray-900 font-semibold">{professors.length}</strong></span>
          <span>المطابق للبحث: <strong className="text-indigo-600 font-semibold">{filteredProfessors.length}</strong></span>
        </div>
      </div>

      {/* Professors Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-600 text-xs border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4 font-semibold">#</th>
                <th className="py-3.5 px-4 font-semibold">اسم الأستاذ</th>
                <th className="py-3.5 px-4 font-semibold">الرتبة الأكاديمية</th>
                <th className="py-3.5 px-4 font-semibold">البريد الإلكتروني</th>
                <th className="py-3.5 px-4 font-semibold">الهاتف</th>
                <th className="py-3.5 px-4 font-semibold">إصدار القفل (v)</th>
                <th className="py-3.5 px-4 font-semibold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    جارٍ جلب قائمة الأساتذة من Neon PostgreSQL...
                  </td>
                </tr>
              ) : filteredProfessors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    لا يوجد أساتذة مطابقين لمعايير البحث.
                  </td>
                </tr>
              ) : (
                filteredProfessors.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-gray-400">{p.id}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{p.name}</td>
                    <td className="py-3 px-4 text-gray-600">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {p.title || 'أستاذ'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-xs">
                      {p.email ? (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3 text-gray-400" />
                          {p.email}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-xs">
                      {p.phone || '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-400 font-mono text-xs">
                      v{p.version || 1}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenDelete(p)}
                          className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                          title="حذف آمن مع معاينة الأثر (Delete Impact)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Impact Modal (P7 Feature) */}
      <DeleteImpactModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="تأكيد حذف أستاذ مع تقييم الأثر"
        entityName={selectedProf?.name || ''}
        impact={deleteImpact}
        isLoading={isDeleting}
      />

      {/* Undo Toast (P7 Feature) */}
      <UndoToast
        show={undoToast.show}
        message={undoToast.message}
        changeLogId={undoToast.changeLogId}
        onUndo={handleUndo}
        onClose={() => setUndoToast({ show: false, message: '' })}
        isLoading={isUndoing}
      />

      {/* Add Professor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3">إضافة أستاذ جديد</h3>
            <form onSubmit={handleAddProfessor} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">اسم الأستاذ *</label>
                <input
                  type="text"
                  required
                  value={newProf.name}
                  onChange={(e) => setNewProf({ ...newProf, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="د. فلان الفلاني"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">الرتبة الأكاديمية</label>
                <select
                  value={newProf.title}
                  onChange={(e) => setNewProf({ ...newProf, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="أستاذ التعليم العالي">أستاذ التعليم العالي (Prof)</option>
                  <option value="أستاذ محاضر أ">أستاذ محاضر أ (MCA)</option>
                  <option value="أستاذ محاضر ب">أستاذ محاضر ب (MCB)</option>
                  <option value="أستاذ مساعد أ">أستاذ مساعد أ (MAA)</option>
                  <option value="أستاذ مساعد ب">أستاذ مساعد ب (MAB)</option>
                  <option value="أستاذ مؤقت">أستاذ مؤقت / مشارك</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={newProf.email}
                  onChange={(e) => setNewProf({ ...newProf, email: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="professor@univ-eloued.dz"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">الهاتف</label>
                <input
                  type="text"
                  value={newProf.phone}
                  onChange={(e) => setNewProf({ ...newProf, phone: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="06xxxxxxxx"
                />
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
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ الأستاذ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
