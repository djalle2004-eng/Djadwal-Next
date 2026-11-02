'use client';

import React, { useEffect, useState } from 'react';
import {
  DoorOpen,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Building,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import DeleteImpactModal from '@/components/DeleteImpactModal';
import UndoToast from '@/components/UndoToast';

interface Room {
  id: number;
  name: string;
  capacity: number;
  type?: string;
  building?: string;
  version?: number;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Delete Impact Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Undo Toast State
  const [undoToast, setUndoToast] = useState<{
    show: boolean;
    message: string;
    changeLogId?: number | null;
  }>({ show: false, message: '' });
  const [isUndoing, setIsUndoing] = useState(false);

  // Add Room Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', capacity: 40, type: 'CLASSROOM', building: 'المجمع أ' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const data = await api.get('/catalog/rooms?limit=200');
      if (Array.isArray(data)) {
        setRooms(data);
      }
    } catch (err: any) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleOpenDelete = async (room: Room) => {
    setSelectedRoom(room);
    setDeleteModalOpen(true);
    try {
      const res = await api.getDeleteImpact('rooms', room.id);
      setDeleteImpact(res.impact);
    } catch (_) {
      setDeleteImpact(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedRoom) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/catalog/rooms/${selectedRoom.id}`);
      setDeleteModalOpen(false);
      setRooms((prev) => prev.filter((r) => r.id !== selectedRoom.id));

      setUndoToast({
        show: true,
        message: `تم حذف القاعة ${selectedRoom.name} بنجاح.`,
        changeLogId: res?.changeLogId || null,
      });
    } catch (err: any) {
      alert(err.message || 'فشل حذف القاعة');
    } finally {
      setIsDeleting(false);
      setSelectedRoom(null);
    }
  };

  const handleUndo = async (id: number) => {
    setIsUndoing(true);
    try {
      await api.undoChange(id);
      setUndoToast({ show: false, message: '' });
      await loadRooms();
      alert('✅ تم التراجع عن حذف القاعة بنجاح واستعادتها!');
    } catch (err: any) {
      alert('فشل التراجع: ' + err.message);
    } finally {
      setIsUndoing(false);
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoom.name.trim()) return;

    setIsSubmitting(true);
    try {
      await api.post('/catalog/rooms', newRoom);
      setShowAddModal(false);
      setNewRoom({ name: '', capacity: 40, type: 'CLASSROOM', building: 'المجمع أ' });
      await loadRooms();
    } catch (err: any) {
      alert(err.message || 'فشل إضافة القاعة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRooms = rooms.filter(
    (r) =>
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.building?.toLowerCase().includes(search.toLowerCase()) ||
      r.type?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <DoorOpen className="h-6 w-6 text-amber-600" />
            <h1 className="text-2xl font-bold text-gray-900">إدارة القاعات والمدرجات (Rooms)</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            جرد القاعات والمدرجات وطاقتها الاستيعابية مع الحذف الآمن وتتبع الأثر
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>إضافة قاعة جديدة</span>
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
            placeholder="بحث باسم القاعة أو المبنى..."
            className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>إجمالي القاعات: <strong className="text-gray-900 font-semibold">{rooms.length}</strong></span>
          <span>المطابق للبحث: <strong className="text-amber-600 font-semibold">{filteredRooms.length}</strong></span>
        </div>
      </div>

      {/* Rooms Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-600 text-xs border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4 font-semibold">#</th>
                <th className="py-3.5 px-4 font-semibold">اسم القاعة</th>
                <th className="py-3.5 px-4 font-semibold">النوع</th>
                <th className="py-3.5 px-4 font-semibold">السعة (طالب)</th>
                <th className="py-3.5 px-4 font-semibold">المبنى / الجناح</th>
                <th className="py-3.5 px-4 font-semibold">إصدار (v)</th>
                <th className="py-3.5 px-4 font-semibold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-500" />
                    جارٍ جلب القاعات من قاعدة البيانات...
                  </td>
                </tr>
              ) : filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    لا توجد قاعات مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filteredRooms.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-gray-400">{r.id}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{r.name}</td>
                    <td className="py-3 px-4 text-gray-600">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs bg-amber-50 text-amber-800 border border-amber-200">
                        {r.type || 'قاعة تدريس'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-700 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-gray-400" />
                        {r.capacity || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Building className="h-3.5 w-3.5 text-gray-400" />
                        {r.building || 'الرئيسي'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 font-mono text-xs">
                      v{r.version || 1}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenDelete(r)}
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
        title="تأكيد حذف قاعة تدريس مع تقييم الأثر"
        entityName={selectedRoom?.name || ''}
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

      {/* Add Room Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3">إضافة قاعة جديدة</h3>
            <form onSubmit={handleAddRoom} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">اسم القاعة *</label>
                <input
                  type="text"
                  required
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="قاعة 12، مدرج أ..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">السعة (عدد الطلاب)</label>
                <input
                  type="number"
                  min="1"
                  value={newRoom.capacity}
                  onChange={(e) => setNewRoom({ ...newRoom, capacity: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">النوع</label>
                <select
                  value={newRoom.type}
                  onChange={(e) => setNewRoom({ ...newRoom, type: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="CLASSROOM">قاعة تدريس عادية (TD)</option>
                  <option value="AMPHI">مدرج محاضرات (Amphi)</option>
                  <option value="LAB_TP">مخبر إعلام آلي / TP</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">المبنى / الجناح</label>
                <input
                  type="text"
                  value={newRoom.building}
                  onChange={(e) => setNewRoom({ ...newRoom, building: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                  className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ القاعة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

