'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit,
  FolderTree,
  Table as TableIcon,
  RefreshCw,
  Layers,
  GraduationCap,
  Building2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Download,
  Archive,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
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

export interface Group {
  id: number;
  name: string;
  year?: string;
  specialization?: string;
  group_type?: string;
  department_id?: number;
  department_name?: string;
  parent_group_id?: number;
  deleted_at?: string | null;
  version?: number;
  created_at?: string;
}

const YEAR_LEVELS = ['L1', 'L2', 'L3', 'M1', 'M2'];
const GROUP_TYPES = [
  { value: 'group', label: 'فوج أعمال موجهة (TD/TP)' },
  { value: 'section', label: 'دفعة / قسم رئيسي (Section)' },
];

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  // Expanded Tree nodes state
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    L1: true,
    L2: true,
    L3: true,
    M1: true,
    M2: true,
  });

  // Delete Impact Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Undo Toast State
  const [undoToast, setUndoToast] = useState<{
    show: boolean;
    message: string;
    changeLogId?: number | null;
  }>({ show: false, message: '' });
  const [isUndoing, setIsUndoing] = useState(false);

  // Add / Edit Group Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    year: 'L1',
    specialization: '',
    group_type: 'group',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const [activeData, allData] = await Promise.all([
        api.get('/catalog/groups?limit=1000'),
        api.get('/catalog/groups?withArchived=true&limit=1000'),
      ]);

      if (Array.isArray(activeData)) {
        setGroups(activeData);
      }
      if (Array.isArray(allData)) {
        const archived = allData.filter((g: Group) => g.deleted_at !== null && g.deleted_at !== undefined);
        setArchivedGroups(archived);
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

  // Open Delete Impact Modal
  const handleOpenDelete = async (group: Group) => {
    setSelectedGroup(group);
    setDeleteModalOpen(true);
    try {
      const impactRes = await api.getDeleteImpact('groups', group.id);
      setDeleteImpact(impactRes);
    } catch {
      setDeleteImpact(null);
    }
  };

  // Confirm Soft Delete
  const handleConfirmDelete = async () => {
    if (!selectedGroup) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/catalog/groups/${selectedGroup.id}`);
      setDeleteModalOpen(false);
      setGroups((prev) => prev.filter((g) => g.id !== selectedGroup.id));
      setArchivedGroups((prev) => [...prev, { ...selectedGroup, deleted_at: new Date().toISOString() }]);

      setUndoToast({
        show: true,
        message: `تم نقل الفوج "${selectedGroup.name}" إلى سلة المؤرشفات بنجاح.`,
        changeLogId: res?.changeLogId || null,
      });
    } catch (err: any) {
      alert(err.message || 'فشل حذف الفوج');
    } finally {
      setIsDeleting(false);
      setSelectedGroup(null);
    }
  };

  // Undo Delete
  const handleUndo = async (id: number) => {
    setIsUndoing(true);
    try {
      await api.undoChange(id);
      setUndoToast({ show: false, message: '' });
      await loadGroups();
      alert('✅ تم التراجع عن الحذف بنجاح واستعادة الفوج إلى القائمة النشطة!');
    } catch (err: any) {
      alert('فشل التراجع: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsUndoing(false);
    }
  };

  // Restore Archived Group
  const handleRestore = async (group: Group) => {
    try {
      await api.restore('groups', group.id);
      setArchivedGroups((prev) => prev.filter((g) => g.id !== group.id));
      setGroups((prev) => [...prev, { ...group, deleted_at: null }]);
      alert(`✅ تم استعادة الفوج "${group.name}" بنجاح!`);
    } catch (err: any) {
      alert('فشل الاستعادة: ' + (err.message || 'خطأ غير معروف'));
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      year: 'L1',
      specialization: '',
      group_type: 'group',
    });
    setConflictError(null);
    setShowFormModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name || '',
      year: group.year || 'L1',
      specialization: group.specialization || '',
      group_type: group.group_type || 'group',
    });
    setConflictError(null);
    setShowFormModal(true);
  };

  // Save Group (Add or Edit with OCC version and Idempotency-Key)
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    setConflictError(null);

    const idempotencyKey = `group-${editingGroup ? 'edit-' + editingGroup.id : 'create'}-${Date.now()}`;

    try {
      if (editingGroup) {
        // Optimistic Locking Update
        await api.put(
          `/catalog/groups/${editingGroup.id}`,
          {
            name: formData.name.trim(),
            year: formData.year,
            specialization: formData.specialization.trim() || undefined,
            group_type: formData.group_type,
            version: editingGroup.version,
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
          '/catalog/groups',
          {
            name: formData.name.trim(),
            year: formData.year,
            specialization: formData.specialization.trim() || undefined,
            group_type: formData.group_type,
          },
          {
            headers: {
              'Idempotency-Key': idempotencyKey,
            },
          }
        );
      }

      setShowFormModal(false);
      await loadGroups();
    } catch (err: any) {
      if (err.statusCode === 409 || err.status === 409 || err.code === 'CONFLICT' || err.name === 'OptimisticLockError') {
        setConflictError(
          '⚠️ تنبيه تعارض التعديل المتزامن (409 Conflict): تم تحديث بيانات هذا الفوج مسبقاً من قِبل مستخدم آخر. يرجى إغلاق النافذة وتحديث الصفحة لتفادي الكتابة فوق التعديلات الأحدث.'
        );
      } else {
        alert(err.message || 'حدث خطأ أثناء حفظ بيانات الفوج');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const listToExport = activeTab === 'active' ? filteredGroups : archivedGroups;
    const headers = ['#', 'اسم الفوج', 'المستوى / السنة', 'التخصص', 'نوع الفوج', 'الحالة'];
    const rows = listToExport.map((g) => [
      g.id,
      `"${g.name || ''}"`,
      `"${g.year || ''}"`,
      `"${g.specialization || ''}"`,
      `"${g.group_type === 'section' ? 'دفعة / Section' : 'فوج / Group'}"`,
      g.deleted_at ? 'مؤرشف' : 'نشط',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `groups-list-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered groups
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

  // Tree view grouping (Year -> Specialization -> Groups)
  const treeData = useMemo(() => {
    const tree: Record<string, Record<string, Group[]>> = {};

    filteredGroups.forEach((group) => {
      const yr = group.year || 'غير محدد';
      const spec = group.specialization || 'عام (بدون تخصص)';

      if (!tree[yr]) tree[yr] = {};
      if (!tree[yr][spec]) tree[yr][spec] = [];
      tree[yr][spec].push(group);
    });

    return tree;
  }, [filteredGroups]);

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  // Statistics
  const l1Count = useMemo(() => groups.filter((g) => g.year === 'L1').length, [groups]);
  const masterCount = useMemo(() => groups.filter((g) => g.year?.startsWith('M')).length, [groups]);

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                إدارة الأفواج والطلبة (Groups)
                <Badge variant="outline" className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200">
                  V1 Production
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                تنظيم الأفواج والدفعات الأكاديمية حسب التخصص والطور الدراسي مع العرض الهرمي والجدولي
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Legacy Switcher */}
          <Link
            href="/legacy/groups"
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
            className="gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة فوج جديد</span>
          </Button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">إجمالي الأفواج النشطة</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{groups.length}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">أفواج الجذع المشترك (L1)</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{l1Count}</h3>
              <p className="text-xs text-muted-foreground">السنة الأولى ليسانس</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">أفواج الماستر (M1 & M2)</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{masterCount}</h3>
              <p className="text-xs text-muted-foreground">تخصصات متقدمة</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">سلة المؤرشفات</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{archivedGroups.length}</h3>
              <p className="text-xs text-muted-foreground">أفواج محذوفة بأمان</p>
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
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>الأفواج النشطة</span>
          <Badge variant="neutral" className="mr-1 text-xs px-2 py-0.5">
            {groups.length}
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
            {archivedGroups.length}
          </Badge>
        </button>
      </div>

      {/* Filters & View Switcher (Only for Active tab) */}
      {activeTab === 'active' && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
            <div className="relative w-full sm:w-72">
              <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم الفوج أو التخصص..."
                className="w-full pl-4 pr-10 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">كل المستويات (L1 - M2)</option>
              {YEAR_LEVELS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">كل أنواع الأفواج</option>
              <option value="group">أفواج أعمال موجهة (TD/TP)</option>
              <option value="section">دفعات رئيسية (Section)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>جدول</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'tree'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FolderTree className="h-3.5 w-3.5" />
                <span>هرمي</span>
              </button>
            </div>

            <div className="text-xs text-muted-foreground whitespace-nowrap">
              المطابق: <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{filteredGroups.length}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'active' ? (
        viewMode === 'table' ? (
          /* Table View */
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 text-muted-foreground text-xs border-b border-border">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">#</th>
                    <th className="py-3.5 px-4 font-semibold">اسم الفوج</th>
                    <th className="py-3.5 px-4 font-semibold">المستوى الأكاديمي</th>
                    <th className="py-3.5 px-4 font-semibold">التخصص</th>
                    <th className="py-3.5 px-4 font-semibold">النوع</th>
                    <th className="py-3.5 px-4 font-semibold">الإصدار (OCC)</th>
                    <th className="py-3.5 px-4 font-semibold text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        جارٍ جلب الأفواج من قاعدة البيانات الآمنة...
                      </td>
                    </tr>
                  ) : filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                        لا توجد أفواج مطابقة لمعايير البحث والتصفية.
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((group) => (
                      <tr key={group.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{group.id}</td>
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {group.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200">
                            {group.year || 'غير محدد'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground text-xs">
                          {group.specialization || 'جذع مشترك (عام)'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            group.group_type === 'section'
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {group.group_type === 'section' ? 'دفعة (Section)' : 'فوج (TD)'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                          v{group.version || 1}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(group)}
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                              title="تعديل بيانات الفوج"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span>تعديل</span>
                            </button>

                            <button
                              onClick={() => handleOpenDelete(group)}
                              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                              title="حذف مع تقييم الأثر المتبادل"
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
        ) : (
          /* Tree / Hierarchy View */
          <div className="space-y-4">
            {Object.keys(treeData).length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                لا توجد أفواج لعرضها في الشجرة الهرمية.
              </div>
            ) : (
              Object.entries(treeData).map(([year, specs]) => {
                const isYearExpanded = expandedNodes[year] ?? true;
                const totalYearGroups = Object.values(specs).reduce((acc, curr) => acc + curr.length, 0);

                return (
                  <div key={year} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleNode(year)}
                      className="w-full p-4 flex items-center justify-between bg-muted/40 hover:bg-muted/60 transition-colors text-right"
                    >
                      <div className="flex items-center gap-3">
                        {isYearExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-bold text-foreground text-base">
                          السنة / الطور: {year}
                        </span>
                      </div>
                      <Badge variant="neutral" className="text-xs">
                        {totalYearGroups} أفواج
                      </Badge>
                    </button>

                    {isYearExpanded && (
                      <div className="p-4 space-y-4 divide-y divide-border/60">
                        {Object.entries(specs).map(([spec, specGroups]) => (
                          <div key={spec} className="pt-3 first:pt-0">
                            <div className="flex items-center gap-2 mb-3">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                                {spec} ({specGroups.length})
                              </h4>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                              {specGroups.map((g) => (
                                <div
                                  key={g.id}
                                  className="p-3 rounded-xl border border-border bg-background hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors flex items-center justify-between"
                                >
                                  <div>
                                    <div className="font-semibold text-sm text-foreground">
                                      {g.name}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                      {g.group_type === 'section' ? 'دفعة (Section)' : 'فوج (TD)'}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleOpenEdit(g)}
                                      className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                      title="تعديل"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenDelete(g)}
                                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                      title="حذف"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )
      ) : (
        /* Archived Tab Content */
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border-b border-border flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
            <Archive className="h-4 w-4 shrink-0" />
            <span>
              سلة المؤرشفات تحتوي على الأفواج المحذوفة بأمان (Soft Deleted). يمكنك استعادتها فوراً بنقرة واحدة مع كامل سجلاتها وتكليفاتها.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted/50 text-muted-foreground text-xs border-b border-border">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">#</th>
                  <th className="py-3.5 px-4 font-semibold">اسم الفوج</th>
                  <th className="py-3.5 px-4 font-semibold">المستوى</th>
                  <th className="py-3.5 px-4 font-semibold">التخصص</th>
                  <th className="py-3.5 px-4 font-semibold">تاريخ الأرشفة</th>
                  <th className="py-3.5 px-4 font-semibold text-center">استعادة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {archivedGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted-foreground">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40 text-emerald-500" />
                      سلة المؤرشفات فارغة تماماً.
                    </td>
                  </tr>
                ) : (
                  archivedGroups.map((group) => (
                    <tr key={group.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{group.id}</td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">{group.name}</td>
                      <td className="py-3.5 px-4 text-xs font-mono text-muted-foreground">{group.year || '—'}</td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs">{group.specialization || '—'}</td>
                      <td className="py-3.5 px-4 text-xs font-mono text-muted-foreground">
                        {group.deleted_at ? new Date(group.deleted_at).toLocaleString('ar-DZ') : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleRestore(group)}
                          className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 px-3 py-1 rounded-lg text-xs font-semibold transition-colors border border-emerald-200 dark:border-emerald-800"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>استعادة الفوج</span>
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
        title="تأكيد حذف فوج دراسي مع تقييم الأثر المتبادل"
        entityName={selectedGroup?.name || ''}
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

      {/* Add / Edit Group Modal */}
      <Dialog open={showFormModal} onClose={() => setShowFormModal(false)} size="md">
        <div className="p-6 space-y-4 max-w-lg w-full bg-card rounded-2xl text-right">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Users className="h-5 w-5" />
                <DialogTitle className="text-lg font-bold text-foreground">
                  {editingGroup ? 'تعديل بيانات الفوج' : 'إضافة فوج جديد'}
                </DialogTitle>
              </div>
              {editingGroup && (
                <Badge variant="outline" className="text-xs font-mono">
                  v{editingGroup.version || 1}
                </Badge>
              )}
            </div>

            <DialogDescription className="text-xs text-muted-foreground">
              حدد اسم الفوج، المستوى الأكاديمي، التخصص ونوع الفوج (أعمال موجهة أو دفعة).
            </DialogDescription>

            {conflictError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{conflictError}</p>
              </div>
            )}

            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  اسم الفوج <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: فوج 1 (G1)، الدفعة أ (Section A)..."
                  className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    المستوى الأكاديمي
                  </label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {YEAR_LEVELS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    نوع الفوج
                  </label>
                  <select
                    value={formData.group_type}
                    onChange={(e) => setFormData({ ...formData, group_type: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {GROUP_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  التخصص (Specialization)
                </label>
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder="مثال: Informatique, Génie Logiciel, ISIL..."
                  className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>جارٍ الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>{editingGroup ? 'تحديث البيانات' : 'حفظ الفوج'}</span>
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
