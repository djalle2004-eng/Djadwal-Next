'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  DoorOpen,
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
  Building2,
  Users,
  Layers,
  ArrowRightLeft,
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

export interface Room {
  id: number;
  name: string;
  capacity?: number;
  type?: string;
  building?: string;
  deleted_at?: string | null;
  version?: number;
  created_at?: string;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [archivedRooms, setArchivedRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [capacityFilter, setCapacityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

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

  // Add / Edit Room Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    capacity: 40,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const [activeData, allData] = await Promise.all([
        api.get('/catalog/rooms?limit=1000'),
        api.get('/catalog/rooms?withArchived=true&limit=1000'),
      ]);

      if (Array.isArray(activeData)) {
        setRooms(activeData);
      }
      if (Array.isArray(allData)) {
        const archived = allData.filter((r: Room) => r.deleted_at !== null && r.deleted_at !== undefined);
        setArchivedRooms(archived);
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

  // Determine Room Type based on capacity or naming
  const getRoomType = (room: Room) => {
    const name = (room.name || '').toLowerCase();
    const cap = room.capacity || 0;
    if (name.includes('مدرج') || name.includes('amphi') || cap >= 100) {
      return { label: 'مدرج محاضرات (Amphi)', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' };
    }
    if (name.includes('مخبر') || name.includes('tp') || name.includes('lab') || name.includes('تطبيق')) {
      return { label: 'مخبر إعلام / TP', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' };
    }
    return { label: 'قاعة تدريس (TD)', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' };
  };

  // Open Delete Impact Modal
  const handleOpenDelete = async (room: Room) => {
    setSelectedRoom(room);
    setDeleteModalOpen(true);
    try {
      const impactRes = await api.getDeleteImpact('rooms', room.id);
      setDeleteImpact(impactRes);
    } catch {
      setDeleteImpact(null);
    }
  };

  // Confirm Soft Delete
  const handleConfirmDelete = async () => {
    if (!selectedRoom) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/catalog/rooms/${selectedRoom.id}`);
      setDeleteModalOpen(false);
      setRooms((prev) => prev.filter((r) => r.id !== selectedRoom.id));
      setArchivedRooms((prev) => [...prev, { ...selectedRoom, deleted_at: new Date().toISOString() }]);

      setUndoToast({
        show: true,
        message: `تم نقل القاعة "${selectedRoom.name}" إلى سلة المؤرشفات بنجاح.`,
        changeLogId: res?.changeLogId || null,
      });
    } catch (err: any) {
      alert(err.message || 'فشل حذف القاعة');
    } finally {
      setIsDeleting(false);
      setSelectedRoom(null);
    }
  };

  // Undo Delete
  const handleUndo = async (id: number) => {
    setIsUndoing(true);
    try {
      await api.undoChange(id);
      setUndoToast({ show: false, message: '' });
      await loadRooms();
      alert('✅ تم التراجع عن الحذف بنجاح واستعادة القاعة إلى القائمة النشطة!');
    } catch (err: any) {
      alert('فشل التراجع: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsUndoing(false);
    }
  };

  // Restore Archived Room
  const handleRestore = async (room: Room) => {
    try {
      await api.restore('rooms', room.id);
      setArchivedRooms((prev) => prev.filter((r) => r.id !== room.id));
      setRooms((prev) => [...prev, { ...room, deleted_at: null }]);
      alert(`✅ تم استعادة القاعة "${room.name}" بنجاح!`);
    } catch (err: any) {
      alert('فشل الاستعادة: ' + (err.message || 'خطأ غير معروف'));
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingRoom(null);
    setFormData({
      name: '',
      capacity: 40,
    });
    setConflictError(null);
    setShowFormModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name || '',
      capacity: room.capacity || 40,
    });
    setConflictError(null);
    setShowFormModal(true);
  };

  // Save Room (Add or Edit with OCC version and Idempotency-Key)
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    setConflictError(null);

    const idempotencyKey = `room-${editingRoom ? 'edit-' + editingRoom.id : 'create'}-${Date.now()}`;

    try {
      if (editingRoom) {
        // Optimistic Locking Update
        await api.put(
          `/catalog/rooms/${editingRoom.id}`,
          {
            name: formData.name.trim(),
            capacity: Number(formData.capacity) || 0,
            version: editingRoom.version,
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
          '/catalog/rooms',
          {
            name: formData.name.trim(),
            capacity: Number(formData.capacity) || 0,
          },
          {
            headers: {
              'Idempotency-Key': idempotencyKey,
            },
          }
        );
      }

      setShowFormModal(false);
      await loadRooms();
    } catch (err: any) {
      if (err.statusCode === 409 || err.status === 409 || err.code === 'CONFLICT' || err.name === 'OptimisticLockError') {
        setConflictError(
          '⚠️ تنبيه تعارض التعديل المتزامن (409 Conflict): تم تحديث بيانات هذه القاعة مسبقاً من قِبل مستخدم آخر. يرجى إغلاق النافذة وتحديث الصفحة لتفادي الكتابة فوق التعديلات الأحدث.'
        );
      } else {
        alert(err.message || 'حدث خطأ أثناء حفظ بيانات القاعة');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const listToExport = activeTab === 'active' ? filteredRooms : archivedRooms;
    const headers = ['#', 'اسم القاعة', 'السعة (مقعد)', 'النوع التقديري', 'الحالة'];
    const rows = listToExport.map((r) => {
      const typeInfo = getRoomType(r);
      return [
        r.id,
        `"${r.name || ''}"`,
        r.capacity || 0,
        `"${typeInfo.label}"`,
        r.deleted_at ? 'مؤرشف' : 'نشط',
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rooms-list-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesSearch = (r.name || '').toLowerCase().includes(search.toLowerCase());
      
      let matchesCapacity = true;
      const cap = r.capacity || 0;
      if (capacityFilter === 'small') matchesCapacity = cap < 40;
      else if (capacityFilter === 'medium') matchesCapacity = cap >= 40 && cap <= 80;
      else if (capacityFilter === 'large') matchesCapacity = cap > 80;

      let matchesType = true;
      const roomType = getRoomType(r).label;
      if (typeFilter === 'amphi') matchesType = roomType.includes('مدرج');
      else if (typeFilter === 'lab') matchesType = roomType.includes('مخبر');
      else if (typeFilter === 'td') matchesType = roomType.includes('تدريس');

      return matchesSearch && matchesCapacity && matchesType;
    });
  }, [rooms, search, capacityFilter, typeFilter]);

  // Statistics
  const totalCapacity = useMemo(() => {
    return rooms.reduce((acc, curr) => acc + (curr.capacity || 0), 0);
  }, [rooms]);

  const maxCapacityRoom = useMemo(() => {
    if (rooms.length === 0) return null;
    return rooms.reduce((prev, curr) => ((curr.capacity || 0) > (prev.capacity || 0) ? curr : prev), rooms[0]);
  }, [rooms]);

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Top Banner & Legacy Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <DoorOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                إدارة القاعات والمدرجات (Rooms)
                <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200">
                  V1 Production
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                جرد شامل للقاعات والمدرجات، ضبط الطاقات الاستيعابية، وتقييم الأثر المتبادل عند الحذف
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Legacy Switcher */}
          <Link
            href="/legacy/rooms"
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
            className="gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة قاعة جديدة</span>
          </Button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">إجمالي القاعات النشطة</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{rooms.length}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <DoorOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">الطاقة الاستيعابية الإجمالية</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {totalCapacity.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">طالب</span>
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">أكبر قاعة استيعاباً</p>
              <h3 className="text-lg font-bold text-foreground mt-1 truncate max-w-[150px]">
                {maxCapacityRoom?.name || '—'}
              </h3>
              <p className="text-xs text-muted-foreground">سعة {maxCapacityRoom?.capacity || 0} مقعد</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">سلة المؤرشفات</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{archivedRooms.length}</h3>
              <p className="text-xs text-muted-foreground">قاعات محذوفة آمنة للاسترجاع</p>
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
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-amber-500/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <DoorOpen className="h-4 w-4" />
          <span>القاعات النشطة</span>
          <Badge variant="neutral" className="mr-1 text-xs px-2 py-0.5">
            {rooms.length}
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
            {archivedRooms.length}
          </Badge>
        </button>
      </div>

      {/* Filters & Search Toolbar (Only for Active tab) */}
      {activeTab === 'active' && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 w-full">
            <div className="relative w-full sm:w-80">
              <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم القاعة أو المدرج..."
                className="w-full pl-4 pr-10 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <select
              value={capacityFilter}
              onChange={(e) => setCapacityFilter(e.target.value)}
              className="w-full sm:w-48 py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">كل السعات</option>
              <option value="small">أقل من 40 طالب</option>
              <option value="medium">من 40 إلى 80 طالب</option>
              <option value="large">أكثر من 80 طالب (مدرجات)</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full sm:w-48 py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">كل أنواع القاعات</option>
              <option value="amphi">مدرجات محاضرات</option>
              <option value="td">قاعات أعمال موجهة</option>
              <option value="lab">مخابر إعلام آلي / TP</option>
            </select>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground whitespace-nowrap">
            <span>
              المطابق للبحث: <strong className="text-amber-600 dark:text-amber-400 font-semibold">{filteredRooms.length}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'active' ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted/50 text-muted-foreground text-xs border-b border-border">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">#</th>
                  <th className="py-3.5 px-4 font-semibold">اسم القاعة / المدرج</th>
                  <th className="py-3.5 px-4 font-semibold">السعة المقعدية</th>
                  <th className="py-3.5 px-4 font-semibold">النوع التقديري</th>
                  <th className="py-3.5 px-4 font-semibold">الإصدار (OCC)</th>
                  <th className="py-3.5 px-4 font-semibold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-500" />
                      جارٍ جلب القاعات من قاعدة البيانات الآمنة...
                    </td>
                  </tr>
                ) : filteredRooms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted-foreground">
                      <DoorOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                      لا توجد قاعات مطابقة للبحث أو معايير التصفية.
                    </td>
                  </tr>
                ) : (
                  filteredRooms.map((room) => {
                    const typeInfo = getRoomType(room);
                    return (
                      <tr key={room.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{room.id}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{room.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-xs font-semibold">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            {room.capacity || 0} طالب
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                          v{room.version || 1}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(room)}
                              className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                              title="تعديل بيانات القاعة"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span>تعديل</span>
                            </button>

                            <button
                              onClick={() => handleOpenDelete(room)}
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
              سلة المؤرشفات تحتوي على القاعات المحذوفة بأمان (Soft Deleted). يمكنك استعادتها فوراً بنقرة واحدة مع كامل سجلاتها.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted/50 text-muted-foreground text-xs border-b border-border">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">#</th>
                  <th className="py-3.5 px-4 font-semibold">اسم القاعة</th>
                  <th className="py-3.5 px-4 font-semibold">السعة</th>
                  <th className="py-3.5 px-4 font-semibold">تاريخ الأرشفة</th>
                  <th className="py-3.5 px-4 font-semibold text-center">استعادة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {archivedRooms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-muted-foreground">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40 text-emerald-500" />
                      سلة المؤرشفات فارغة تماماً.
                    </td>
                  </tr>
                ) : (
                  archivedRooms.map((room) => (
                    <tr key={room.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{room.id}</td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">{room.name}</td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs">{room.capacity || 0} طالب</td>
                      <td className="py-3.5 px-4 text-xs font-mono text-muted-foreground">
                        {room.deleted_at ? new Date(room.deleted_at).toLocaleString('ar-DZ') : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleRestore(room)}
                          className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 px-3 py-1 rounded-lg text-xs font-semibold transition-colors border border-emerald-200 dark:border-emerald-800"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>استعادة القاعة</span>
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
        title="تأكيد حذف قاعة تدريس مع تقييم الأثر المتبادل"
        entityName={selectedRoom?.name || ''}
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

      {/* Add / Edit Room Modal */}
      <Dialog open={showFormModal} onClose={() => setShowFormModal(false)} size="md">
        <div className="p-6 space-y-4 max-w-lg w-full bg-card rounded-2xl text-right">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <DoorOpen className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold text-foreground">
                {editingRoom ? 'تعديل بيانات القاعة' : 'إضافة قاعة أو مدرج جديد'}
              </DialogTitle>
            </div>
            {editingRoom && (
              <Badge variant="outline" className="text-xs font-mono">
                v{editingRoom.version || 1}
              </Badge>
            )}
          </div>

          <DialogDescription className="text-xs text-muted-foreground">
            يرجى إدخال اسم القاعة وسعتها المقعدية بدقة لضمان دقة فحوصات التعارض والجدولة الآلية.
          </DialogDescription>

          {conflictError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{conflictError}</p>
            </div>
          )}

          <form onSubmit={handleSaveRoom} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                اسم القاعة / المدرج <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: قاعة 102، مدرج أ، مخبر إعلام آلي 1..."
                className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                السعة المقعدية (عدد الطلاب) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="1000"
                required
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px] text-muted-foreground ml-1">سعات سريعة:</span>
                {[30, 40, 60, 120, 250].map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setFormData({ ...formData, capacity: cap })}
                    className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors"
                  >
                    {cap}
                  </button>
                ))}
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
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>جارٍ الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>{editingRoom ? 'تحديث البيانات' : 'حفظ القاعة'}</span>
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
