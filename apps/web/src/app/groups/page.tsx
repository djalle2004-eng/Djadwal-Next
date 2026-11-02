'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit,
  FolderTree,
  List,
  RefreshCw,
  Layers,
  GraduationCap,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import DeleteImpactModal from '@/components/DeleteImpactModal';
import UndoToast from '@/components/UndoToast';

interface Group {
  id: number;
  name: string;
  year?: string;
  specialization?: string;
  group_type?: string;
  department_id?: number;
  department_name?: string;
  parent_group_id?: number;
  version?: number;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');

  // P7 Delete Impact Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // P7 Undo Toast State
  const [undoToast, setUndoToast] = useState<{
    show: boolean;
    message: string;
    changeLogId?: number | null;
  }>({ show: false, message: '' });
  const [isUndoing, setIsUndoing] = useState(false);

  // Add / Edit Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    year: 'L1',
    specialization: '',
    group_type: 'group',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await api.get('/groups?limit=500');
      if (Array.isArray(data)) {
        setGroups(data);
      }
    } catch (err: any) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchesSearch =
        (g.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (g.specialization || '').toLowerCase().includes(search.toLowerCase());
      const matchesYear = selectedYear === 'all' || g.year === selectedYear;
      const matchesType = selectedType === 'all' || g.group_type === selectedType;
      return matchesSearch && matchesYear && matchesType;
    });
  }, [groups, search, selectedYear, selectedType]);

  const handleOpenDelete = async (group: Group) => {
    setSelectedGroup(group);
    setDeleteModalOpen(true);
    try {
      const impactRes = await api.getDeleteImpact('groups', group.id);
      setDeleteImpact(impactRes.impact);
    } catch (err) {
      setDeleteImpact(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedGroup) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/groups/${selectedGroup.id}`);
      setDeleteModalOpen(false);
      setGroups((prev) => prev.filter((g) => g.id !== selectedGroup.id));

      setUndoToast({
        show: true,
        message: `تم حذف الفوج/الدفعة "${selectedGroup.name}" بنجاح.`,
        changeLogId: res?.changeLogId || null,
      });
    } catch (err: any) {
      alert(err.messageAr || err.message || 'فشل حذف الفوج');
    } finally {
      setIsDeleting(false);
      setSelectedGroup(null);
    }
  };

  const handleUndo = async (logId?: number) => {
    const idToUndo = logId || undoToast.changeLogId;
    if (!idToUndo) return;
    setIsUndoing(true);
    try {
      await api.undoChange(idToUndo);
      setUndoToast({ show: false, message: '' });
      await loadGroups();
    } catch (err: any) {
      alert(err.messageAr || err.message || 'فشل التراجع عن الحذف');
    } finally {
      setIsUndoing(false);
    }
  };

  const handleOpenEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      year: group.year || 'L1',
      specialization: group.specialization || '',
      group_type: group.group_type || 'group',
    });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('يرجى إدخال اسم الفوج أو الدفعة');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingGroup) {
        await api.put(`/groups/${editingGroup.id}`, {
          ...formData,
          version: editingGroup.version,
        });
      } else {
        await api.post('/groups', formData);
      }
      setShowAddModal(false);
      setEditingGroup(null);
      setFormData({ name: '', year: 'L1', specialization: '', group_type: 'group' });
      await loadGroups();
    } catch (err: any) {
      if (err instanceof ApiError && err.statusCode === 409) {
        setFormError('تم تعديل هذا الفوج من قبل مستخدم آخر، يرجى تحديث الصفحة والمحاولة مجددًا.');
      } else {
        setFormError(err.messageAr || err.message || 'فشل حفظ بيانات الفوج');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">إدارة الأفواج والدفعات</h1>
            <p className="text-sm text-slate-500">
              إجمالي الأفواج المسجلة: <span className="font-semibold text-slate-700">{groups.length}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingGroup(null);
              setFormData({ name: '', year: 'L1', specialization: '', group_type: 'group' });
              setFormError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة فوج جديد</span>
          </button>
          <button
            onClick={loadGroups}
            disabled={loading}
            className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="البحث باسم الفوج أو التخصص..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Level Filter */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="all">كل المستويات</option>
            <option value="L1">السنة الأولى ليسانس (L1)</option>
            <option value="L2">السنة الثانية ليسانس (L2)</option>
            <option value="L3">السنة الثالثة ليسانس (L3)</option>
            <option value="M1">السنة الأولى ماستر (M1)</option>
            <option value="M2">السنة الثانية ماستر (M2)</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="all">كل الأنواع</option>
            <option value="group">فوج فرعي (Group)</option>
            <option value="section">دفعة كاملة (Section)</option>
            <option value="specialization">تخصص (Specialization)</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 transition-colors ${
                viewMode === 'cards' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="عرض بطاقات"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 transition-colors ${
                viewMode === 'table' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="عرض جدول"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500 font-medium">جاري تحميل قائمة الأفواج...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200 text-center">
          <Users className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-800">لا توجد نتائج مطابقة</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            {search ? 'لم نتمكن من العثور على أفواج مطابقة لمعايير البحث.' : 'لم يتم تسجيل أي أفواج بعد.'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-purple-200 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                        {group.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {group.specialization || 'بدون تخصص محدد'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      group.group_type === 'section'
                        ? 'bg-blue-50 text-blue-700'
                        : group.group_type === 'specialization'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {group.group_type === 'section'
                      ? 'دفعة'
                      : group.group_type === 'specialization'
                      ? 'تخصص'
                      : 'فوج'}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    <span>المستوى: {group.year || 'غير محدد'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>القسم: {group.department_name || 'عام'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleOpenEdit(group)}
                  className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  title="تعديل"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleOpenDelete(group)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="حذف (P7 حذف ناعم)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs">
              <tr>
                <th className="py-3.5 px-4">اسم الفوج</th>
                <th className="py-3.5 px-4">المستوى</th>
                <th className="py-3.5 px-4">التخصص</th>
                <th className="py-3.5 px-4">النوع</th>
                <th className="py-3.5 px-4">القسم</th>
                <th className="py-3.5 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGroups.map((group) => (
                <tr key={group.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{group.name}</td>
                  <td className="py-3 px-4 text-slate-600">{group.year || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{group.specialization || '—'}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        group.group_type === 'section'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {group.group_type === 'section' ? 'دفعة' : 'فوج'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{group.department_name || '—'}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(group)}
                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(group)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف ناعم"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">
                {editingGroup ? 'تعديل بيانات الفوج' : 'إضافة فوج أو دفعة جديدة'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم الفوج / الدفعة *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: الفوج 1 أو الدفعة أ"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    المستوى الدراسي
                  </label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="L1">L1 - أولى ليسانس</option>
                    <option value="L2">L2 - ثانية ليسانس</option>
                    <option value="L3">L3 - ثالثة ليسانس</option>
                    <option value="M1">M1 - أولى ماستر</option>
                    <option value="M2">M2 - ثانية ماستر</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    نوع الكيان
                  </label>
                  <select
                    value={formData.group_type}
                    onChange={(e) => setFormData({ ...formData, group_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="group">فوج فرعي (Group)</option>
                    <option value="section">دفعة كاملة (Section)</option>
                    <option value="specialization">تخصص (Specialization)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  التخصص (Specialization)
                </label>
                <input
                  type="text"
                  placeholder="مثال: علوم التسيير والمالية"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الحفظ...' : editingGroup ? 'حفظ التعديلات' : 'إضافة الفوج'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* P7 Delete Impact Modal */}
      <DeleteImpactModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="تأكيد حذف الفوج مع تقييم الأثر"
        entityName={selectedGroup?.name || ''}
        impact={deleteImpact}
        isLoading={isDeleting}
      />

      {/* P7 Undo Toast */}
      <UndoToast
        show={undoToast.show}
        message={undoToast.message}
        changeLogId={undoToast.changeLogId}
        onUndo={handleUndo}
        onClose={() => setUndoToast({ show: false, message: '' })}
        isLoading={isUndoing}
      />
    </div>
  );
}
