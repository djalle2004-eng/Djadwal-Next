'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
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
  RotateCcw,
  Sparkles,
  Download,
  Archive,
  CheckCircle2,
  GraduationCap,
  Building2,
  ShieldAlert,
  History,
  Calendar,
  Clock,
  Briefcase,
  Check,
  ChevronDown,
  FileSpreadsheet,
  UploadCloud
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
import {
  OFFICIAL_ACADEMIC_RANKS,
  OfficialAcademicRank,
  normalizeAcademicRank,
  getRankDefinition,
} from '@djadwal/core/constants/professor-ranks';
import { buildProfessorsExportWorkbook } from '@djadwal/core/excel/professor-excel';
import { api, ApiError } from '@/lib/api';
import DeleteImpactModal from '@/components/DeleteImpactModal';
import UndoToast from '@/components/UndoToast';
import ImportProfessorsModal from '@/components/ImportProfessorsModal';

interface Professor {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  academic_title?: string;
  academic_rank?: OfficialAcademicRank | string;
  is_temporary?: boolean;
  specialization?: string;
  department_id?: number;
  department_name?: string;
  weekly_hours?: number;
  deleted_at?: string | null;
  version?: number;
}

interface ProfessorHistoryRecord {
  id: number;
  professor_id: number;
  academic_year: string;
  academic_rank: string;
  rank_label_arabic?: string;
  statutory_quota?: number;
  is_temporary?: boolean;
  department_id?: number;
  created_at?: string;
}

export default function ProfessorsPage() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [archivedProfessors, setArchivedProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'permanent' | 'temporary' | 'archived'>('all');

  // Delete Impact Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProf, setSelectedProf] = useState<Professor | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Undo Toast State
  const [undoToast, setUndoToast] = useState<{
    show: boolean;
    message: string;
    changeLogId?: number | null;
  }>({ show: false, message: '' });
  const [isUndoing, setIsUndoing] = useState(false);

  // Add / Edit Professor Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProf, setEditingProf] = useState<Professor | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    academic_rank: 'assistant_professor' as OfficialAcademicRank,
    is_temporary: false,
    specialization: '',
    academic_year: '2026-2027',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyProf, setHistoryProf] = useState<Professor | null>(null);
  const [historyRecords, setHistoryRecords] = useState<ProfessorHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [newHistoryYear, setNewHistoryYear] = useState('');
  const [newHistoryRank, setNewHistoryRank] = useState<OfficialAcademicRank>('lecturer_b');
  const [newHistoryTemporary, setNewHistoryTemporary] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);

  // Import Professors Modal State (P15)
  const [showImportModal, setShowImportModal] = useState(false);

  const loadProfessors = async () => {
    setLoading(true);
    try {
      const [activeData, allData] = await Promise.all([
        api.get('/professors?limit=1000'),
        api.get('/professors?withArchived=true&limit=1000'),
      ]);

      if (Array.isArray(activeData)) {
        setProfessors(activeData);
      }
      if (Array.isArray(allData)) {
        const archived = allData.filter((p: Professor) => p.deleted_at !== null && p.deleted_at !== undefined);
        setArchivedProfessors(archived);
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

  // Open Delete Impact Modal
  const handleOpenDelete = async (prof: Professor) => {
    setSelectedProf(prof);
    setDeleteModalOpen(true);
    try {
      const impactRes = await api.getDeleteImpact('professors', prof.id);
      setDeleteImpact(impactRes);
    } catch (err) {
      setDeleteImpact(null);
    }
  };

  // Confirm Soft Delete
  const handleConfirmDelete = async () => {
    if (!selectedProf) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/professors/${selectedProf.id}`);
      setDeleteModalOpen(false);
      setProfessors((prev) => prev.filter((p) => p.id !== selectedProf.id));
      setArchivedProfessors((prev) => [...prev, { ...selectedProf, deleted_at: new Date().toISOString() }]);

      setUndoToast({
        show: true,
        message: `تم نقل الأستاذ ${selectedProf.name} إلى سلة المؤرشفات بنجاح.`,
        changeLogId: res?.changeLogId || null,
      });
    } catch (err: any) {
      alert(err.message || 'فشل حذف الأستاذ');
    } finally {
      setIsDeleting(false);
      setSelectedProf(null);
    }
  };

  // Undo Delete
  const handleUndo = async (id: number) => {
    setIsUndoing(true);
    try {
      await api.undoChange(id);
      setUndoToast({ show: false, message: '' });
      await loadProfessors();
    } catch (err: any) {
      alert('فشل التراجع: ' + err.message);
    } finally {
      setIsUndoing(false);
    }
  };

  // Restore Soft-Deleted Professor
  const handleRestore = async (prof: Professor) => {
    try {
      await api.restore('professors', prof.id);
      setArchivedProfessors((prev) => prev.filter((p) => p.id !== prof.id));
      setProfessors((prev) => [...prev, { ...prof, deleted_at: null }]);
      setUndoToast({
        show: true,
        message: `تم استرجاع الأستاذ ${prof.name} بنجاح إلى القائمة النشطة!`,
      });
    } catch (err: any) {
      alert('فشل استرجاع الأستاذ: ' + err.message);
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingProf(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      academic_rank: 'assistant_professor',
      is_temporary: false,
      specialization: '',
      academic_year: '2026-2027',
    });
    setConflictError(null);
    setShowFormModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (prof: Professor) => {
    setEditingProf(prof);
    const normalized = normalizeAcademicRank(prof.academic_rank || prof.academic_title || prof.title);
    const isTemp = Boolean(prof.is_temporary || normalized === 'temporary');

    setFormData({
      name: prof.name || '',
      email: prof.email || '',
      phone: prof.phone || '',
      academic_rank: normalized,
      is_temporary: isTemp,
      specialization: prof.specialization || '',
      academic_year: '2026-2027',
    });
    setConflictError(null);
    setShowFormModal(true);
  };

  // Open History Modal
  const handleOpenHistory = async (prof: Professor) => {
    setHistoryProf(prof);
    setHistoryRecords([]);
    setHistoryLoading(true);
    setHistoryModalOpen(true);
    setNewHistoryYear('2025-2026');
    const norm = normalizeAcademicRank(prof.academic_rank || prof.academic_title || prof.title);
    setNewHistoryRank(norm);
    setNewHistoryTemporary(Boolean(prof.is_temporary || norm === 'temporary'));

    try {
      const data = await api.get(`/professors/${prof.id}/history`);
      if (Array.isArray(data)) {
        setHistoryRecords(data);
      }
    } catch (err: any) {
      console.error('Failed to load professor academic history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Add History Record
  const handleAddHistoryRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!historyProf || !newHistoryYear.trim()) return;

    setSavingHistory(true);
    try {
      await api.post(`/professors/${historyProf.id}/history`, {
        academic_year: newHistoryYear.trim(),
        academic_rank: newHistoryRank,
        is_temporary: newHistoryTemporary || newHistoryRank === 'temporary',
      });

      const updatedHistory = await api.get(`/professors/${historyProf.id}/history`);
      if (Array.isArray(updatedHistory)) {
        setHistoryRecords(updatedHistory);
      }
      await loadProfessors();
    } catch (err: any) {
      alert(err.message || 'فشل تسجيل الرتبة في هذا الموسم الأكاديمي');
    } finally {
      setSavingHistory(false);
    }
  };

  // Save Professor (Add or Edit with OCC version and Idempotency-Key)
  const handleSaveProfessor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    setConflictError(null);

    const idempotencyKey = `prof-${editingProf ? 'edit-' + editingProf.id : 'create'}-${Date.now()}`;
    const rankDef = getRankDefinition(formData.academic_rank);
    const isTemp = formData.is_temporary || formData.academic_rank === 'temporary';

    try {
      const payload: any = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        academic_rank: formData.academic_rank,
        title: rankDef.labelArabic,
        academic_title: rankDef.labelArabic,
        is_temporary: isTemp,
        specialization: formData.specialization.trim() || undefined,
        academic_year: formData.academic_year.trim() || undefined,
      };

      if (editingProf) {
        payload.version = editingProf.version;
        await api.put(`/professors/${editingProf.id}`, payload, {
          headers: { 'Idempotency-Key': idempotencyKey },
        });
      } else {
        await api.post('/professors', payload, {
          headers: { 'Idempotency-Key': idempotencyKey },
        });
      }

      setShowFormModal(false);
      await loadProfessors();
    } catch (err: any) {
      if (err.statusCode === 409 || err.status === 409 || err.code === 'CONFLICT' || err.name === 'OptimisticLockError') {
        setConflictError(
          '⚠️ تنبيه تعارض التعديل المتزامن (409 Conflict): تم تحديث بيانات هذا الأستاذ مسبقاً من قِبل مستخدم آخر. يرجى إغلاق النافذة وتحديث الصفحة لتفادي الكتابة فوق التعديلات الأحدث.'
        );
      } else {
        alert(err.message || 'حدث خطأ أثناء حفظ بيانات الأستاذ');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const listToExport = filteredProfessors;
    const headers = ['#', 'الاسم الكامل', 'الرتبة الأكاديمية الرسمية', 'النوع', 'النصاب القانوني', 'التخصص', 'البريد الإلكتروني', 'الهاتف', 'الحالة'];
    const rows = listToExport.map((p) => {
      const rankDef = getRankDefinition(p.academic_rank || p.academic_title || p.title);
      const isTemp = p.is_temporary || rankDef.isTemporary;
      return [
        p.id,
        `"${p.name || ''}"`,
        `"${rankDef.labelArabic}"`,
        isTemp ? 'مؤقت / متعاقد' : 'دائم',
        `${rankDef.statutoryQuotaHours} سا`,
        `"${p.specialization || ''}"`,
        `"${p.email || ''}"`,
        `"${p.phone || ''}"`,
        p.deleted_at ? 'مؤرشف' : 'نشط',
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `professors-list-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel (P15)
  const handleExportExcel = () => {
    try {
      const wb = buildProfessorsExportWorkbook(filteredProfessors);
      const filename = `professors-list-${activeTab}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err: any) {
      console.error('Export Excel failed:', err);
      // Fallback to backend export
      window.location.href = `/api/v1/professors/export?withArchived=${activeTab === 'archived'}`;
    }
  };

  const handleImportSuccess = (message: string) => {
    setUndoToast({
      show: true,
      message,
    });
    loadProfessors();
  };

  // Filtered List
  const filteredProfessors = useMemo(() => {
    let baseList = professors;
    if (activeTab === 'archived') {
      baseList = archivedProfessors;
    } else if (activeTab === 'permanent') {
      baseList = professors.filter((p) => {
        const norm = normalizeAcademicRank(p.academic_rank || p.academic_title || p.title);
        return !p.is_temporary && norm !== 'temporary';
      });
    } else if (activeTab === 'temporary') {
      baseList = professors.filter((p) => {
        const norm = normalizeAcademicRank(p.academic_rank || p.academic_title || p.title);
        return p.is_temporary || norm === 'temporary';
      });
    }

    return baseList.filter((p) => {
      const matchSearch =
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase()) ||
        p.phone?.toLowerCase().includes(search.toLowerCase()) ||
        p.specialization?.toLowerCase().includes(search.toLowerCase()) ||
        p.title?.toLowerCase().includes(search.toLowerCase());

      const normRank = normalizeAcademicRank(p.academic_rank || p.academic_title || p.title);
      const matchRank = rankFilter === 'all' || normRank === rankFilter;

      return matchSearch && matchRank;
    });
  }, [professors, archivedProfessors, activeTab, search, rankFilter]);

  // Counts for tabs
  const permanentCount = useMemo(() => {
    return professors.filter((p) => {
      const norm = normalizeAcademicRank(p.academic_rank || p.academic_title || p.title);
      return !p.is_temporary && norm !== 'temporary';
    }).length;
  }, [professors]);

  const temporaryCount = useMemo(() => {
    return professors.filter((p) => {
      const norm = normalizeAcademicRank(p.academic_rank || p.academic_title || p.title);
      return p.is_temporary || norm === 'temporary';
    }).length;
  }, [professors]);

  return (
    <div className="space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">إدارة الأساتذة والرتب الأكاديمية (P14)</h1>
            <p className="text-sm text-slate-500">
              القائمة المعيارية للرتب الرسمية الست، تتبع الأثر التاريخي وعزل الأرشيف الأكاديمي الموسمي
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export Excel (P15) */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="gap-1.5 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            title="تنزيل جدول الأساتذة الحالي بتنسيق Excel منسق مع دليل الرتب الرسمية"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>تنزيل ملف الأساتذة (Excel)</span>
          </Button>

          {/* Import Excel (P15) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
            className="gap-1.5 text-xs border-blue-300 text-blue-800 hover:bg-blue-50"
            title="استيراد وتحديث قائمة الأساتذة عبر ملف Excel مع المعاينة الذكية والتثبيت الذري"
          >
            <UploadCloud className="w-4 h-4 text-blue-600" />
            <span>استيراد من Excel</span>
          </Button>

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-1.5 text-xs text-slate-700"
          >
            <Download className="w-4 h-4" />
            <span>تصدير CSV</span>
          </Button>

          {/* Switch to Legacy UI */}
          <a
            href="/legacy/professors"
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-semibold transition-colors border border-amber-200 shadow-xs"
            title="فتح شاشة الأساتذة في الواجهة الكلاسيكية السابقة"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>الواجهة المعتمدة (Legacy)</span>
          </a>

          {/* Add Professor */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة أستاذ جديد</span>
          </Button>
        </div>
      </div>

      {/* 2. Filters & Tabs Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Tabs: All / Permanent / Temporary / Archived */}
            <div className="flex flex-wrap items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold w-full md:w-auto gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === 'all'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                كافة الأساتذة ({professors.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('permanent')}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'permanent'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>الأساتذة الدائمون ({permanentCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('temporary')}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'temporary'
                    ? 'bg-white text-amber-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>الأساتذة المؤقتون / متعاقدون ({temporaryCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('archived')}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'archived'
                    ? 'bg-white text-rose-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>سلة المؤرشفات ({archivedProfessors.length})</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64">
              <Search className="absolute right-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم، الرتبة، التخصص..."
                className="w-full pl-3 pr-10 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Rank Filter */}
            <div className="w-full md:w-60">
              <select
                value={rankFilter}
                onChange={(e) => setRankFilter(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">كافة الرتب الأكاديمية (6)</option>
                {OFFICIAL_ACADEMIC_RANKS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.labelArabic} ({r.statutoryQuotaHours} سا)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Professors Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 font-bold w-12 text-center">#</th>
                <th className="py-3.5 px-4 font-bold">اسم الأستاذ</th>
                <th className="py-3.5 px-4 font-bold">الرتبة الأكاديمية الرسمية</th>
                <th className="py-3.5 px-4 font-bold text-center">النصاب القانوني</th>
                <th className="py-3.5 px-4 font-bold">التخصص</th>
                <th className="py-3.5 px-4 font-bold">البريد الإلكتروني</th>
                <th className="py-3.5 px-4 font-bold">الهاتف</th>
                <th className="py-3.5 px-4 font-bold text-center w-20">الإصدار (v)</th>
                <th className="py-3.5 px-4 font-bold text-center w-36">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>جاري تحميل بيانات هيئة التدريس...</span>
                  </td>
                </tr>
              ) : filteredProfessors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    {activeTab === 'archived'
                      ? 'سلة المؤرشفات فارغة؛ لا توجد سجلات محذوفة ناعماً.'
                      : 'لا يوجد أساتذة مطابقين لمعايير البحث الحالية.'}
                  </td>
                </tr>
              ) : (
                filteredProfessors.map((p) => {
                  const rankDef = getRankDefinition(p.academic_rank || p.academic_title || p.title);
                  const isTemp = Boolean(p.is_temporary || rankDef.isTemporary);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400 text-center">{p.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-full font-bold flex items-center justify-center text-[10px] ${
                            isTemp
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {p.name.slice(0, 1)}
                        </div>
                        <div className="flex flex-col">
                          <span>{p.name}</span>
                          {isTemp && (
                            <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 inline" /> أستاذ(ة) مؤقت(ة)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                              isTemp
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : rankDef.key === 'professor'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : rankDef.key === 'lecturer_a'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {rankDef.labelArabic}
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans">({rankDef.labelFrench})</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {isTemp ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                            0 سا (تعاقد)
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {rankDef.statutoryQuotaHours} سا / أسبوع
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{p.specialization || '—'}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {p.email ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-700">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span>{p.email}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {p.phone ? (
                          <span className="inline-flex items-center gap-1 text-slate-700">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{p.phone}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-center">
                        v{p.version || 1}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {activeTab !== 'archived' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenHistory(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="عرض الأرشيف والتاريخ الأكاديمي والترقيات الموسمية"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="تعديل بيانات الأستاذ والرتبة"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDelete(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="فحص الأثر وحذف الأستاذ ناعماً"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestore(p)}
                              className="text-[11px] py-1 px-2.5 h-auto text-emerald-700 hover:bg-emerald-50 border-emerald-300 gap-1"
                            >
                              <RotateCcw className="w-3 h-3 text-emerald-600" />
                              <span>استرجاع</span>
                            </Button>
                          )}
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

      {/* 4. Add / Edit Professor Modal */}
      <Dialog open={showFormModal} onClose={() => setShowFormModal(false)} size="md">
        <div className="p-6 space-y-4 max-w-lg w-full bg-white rounded-2xl text-start">
          <DialogTitle className="text-lg font-bold text-slate-900 border-b pb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>{editingProf ? 'تعديل بيانات الأستاذ والرتبة الرسمية' : 'إضافة أستاذ جديد'}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            إدخال وتعديل بيانات الأستاذ مع القفل التفاؤلي والرتبة المعيارية
          </DialogDescription>

          {conflictError && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold">
              {conflictError}
            </div>
          )}

          <form onSubmit={handleSaveProfessor} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">الاسم الكامل للأستاذ *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: د. أحمد بن علي"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الرتبة الأكاديمية الرسمية *</label>
                <select
                  value={formData.academic_rank}
                  onChange={(e) => {
                    const rank = e.target.value as OfficialAcademicRank;
                    setFormData({
                      ...formData,
                      academic_rank: rank,
                      is_temporary: rank === 'temporary' ? true : formData.is_temporary,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                >
                  {OFFICIAL_ACADEMIC_RANKS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.labelArabic} — {r.statutoryQuotaHours} سا ({r.labelFrench})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {getRankDefinition(formData.academic_rank).descriptionArabic}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">التخصص الدقيق</label>
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder="مثال: اقتصاد نقدي وبنكي"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Temporary Teacher Toggle & Academic Year */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block text-xs">حالة الأستاذ: مؤقت / متعاقد (Vacataire)</span>
                  <span className="text-[10px] text-slate-500">
                    الأساتذة المؤقتون يُعزل نصابهم القانوني (0 سا) وتُحتسب كافة ساعاتهم كأعباء تدريس تعاقدية
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_temporary || formData.academic_rank === 'temporary'}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData({
                      ...formData,
                      is_temporary: checked,
                      academic_rank: checked && formData.academic_rank !== 'temporary' ? 'temporary' : formData.academic_rank,
                    });
                  }}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  الموسم الأكاديمي الفعّال للملف:
                </span>
                <input
                  type="text"
                  value={formData.academic_year}
                  onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                  placeholder="2026-2027"
                  className="w-32 px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-mono text-center bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="prof@univ-eloued.dz"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="06XXXXXXXX"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {editingProf && (
              <div className="p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl text-[11px] text-slate-500 flex items-center justify-between">
                <span>إصدار القفل التفاؤلي الحالي (OCC Version):</span>
                <span className="font-mono font-bold text-slate-700">v{editingProf.version || 1}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setShowFormModal(false)}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isSubmitting ? 'جارٍ الحفظ...' : editingProf ? 'تحديث البيانات' : 'حفظ الأستاذ'}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* 5. Academic History & Promotion Isolation Modal */}
      <Dialog open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} size="lg">
        <div className="p-6 space-y-5 max-w-xl w-full bg-white rounded-2xl text-start">
          <DialogTitle className="text-lg font-bold text-slate-900 border-b pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <span>الأرشيف الأكاديمي وسجل الترقيات التاريخية</span>
            </div>
            {historyProf && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                {historyProf.name}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            تاريخية الرتب الأكاديمية تضمن بقاء الجداول القديمة محفوظة برتبة الأستاذ في ذلك الموسم وتمنع تشويه حساب النصاب بأثر رجعي.
          </DialogDescription>

          {/* Chronological History List */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>المواسم الأكاديمية المسجلة:</span>
            </h4>

            {historyLoading ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                <span>جاري استرجاع الأرشيف التاريخي للأستاذ...</span>
              </div>
            ) : historyRecords.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-center text-xs">
                لا توجد سجلات تاريخية مخصصة لهذا الأستاذ بعد؛ يُعتمد الملف الحالي لكافة المواسم.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {historyRecords.map((rec) => {
                  const def = getRankDefinition(rec.academic_rank);
                  return (
                    <div key={rec.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {rec.academic_year}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">{rec.rank_label_arabic || def.labelArabic}</div>
                          <div className="text-[10px] text-slate-400">{def.labelFrench}</div>
                        </div>
                      </div>
                      <div className="text-end">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.is_temporary || def.isTemporary
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          نصاب: {rec.statutory_quota ?? def.statutoryQuotaHours} سا
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add History Record Form */}
          <form onSubmit={handleAddHistoryRecord} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>تسجيل ترقية أو رتبة لموسم أكاديمي محدد:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الموسم الأكاديمي *</label>
                <input
                  type="text"
                  required
                  value={newHistoryYear}
                  onChange={(e) => setNewHistoryYear(e.target.value)}
                  placeholder="مثال: 2024-2025"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الرتبة في هذا الموسم *</label>
                <select
                  value={newHistoryRank}
                  onChange={(e) => {
                    const r = e.target.value as OfficialAcademicRank;
                    setNewHistoryRank(r);
                    if (r === 'temporary') setNewHistoryTemporary(true);
                  }}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                >
                  {OFFICIAL_ACADEMIC_RANKS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.labelArabic} ({r.statutoryQuotaHours} سا)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newHistoryTemporary || newHistoryRank === 'temporary'}
                  onChange={(e) => setNewHistoryTemporary(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-slate-700 font-medium">أستاذ مؤقت / متعاقد في ذلك الموسم</span>
              </label>

              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={savingHistory}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 text-xs"
              >
                {savingHistory ? 'جارٍ الحفظ...' : 'تثبيت السجل التاريخي'}
              </Button>
            </div>
          </form>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <Button variant="outline" size="sm" type="button" onClick={() => setHistoryModalOpen(false)}>
              إغلاق
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 6. Delete Impact Assessment Modal */}
      <DeleteImpactModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="تأكيد الحذف الآمن للأستاذ"
        entityName={selectedProf?.name || ''}
        impact={deleteImpact}
        isLoading={isDeleting}
      />

      {/* 7. Undo Notification Toast */}
      <UndoToast
        show={undoToast.show}
        message={undoToast.message}
        changeLogId={undoToast.changeLogId}
        onUndo={handleUndo}
        onClose={() => setUndoToast({ show: false, message: '' })}
        isLoading={isUndoing}
      />

      {/* 8. P15: Excel Import & Dry-Run Modal */}
      <ImportProfessorsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
