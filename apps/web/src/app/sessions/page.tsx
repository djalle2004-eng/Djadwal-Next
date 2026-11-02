'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Plus,
  Trash2,
  Edit,
  ArrowRightLeft,
  Move,
  AlertTriangle,
  RefreshCw,
  Clock,
  BookOpen,
  User,
  DoorClosed,
  Users,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import DeleteImpactModal from '@/components/DeleteImpactModal';
import UndoToast from '@/components/UndoToast';

interface Assignment {
  id: number;
  course_id?: number;
  course_name?: string;
  professor_id?: number;
  professor_name?: string;
  room_id?: number;
  room_name?: string;
  group_id?: number;
  group_name?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  session_type?: string;
  academic_year?: string;
  semester?: string;
  specialization?: string;
  version?: number;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState('السداسي الأول');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // P7 Delete Impact Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Assignment | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // P7 Undo Toast State
  const [undoToast, setUndoToast] = useState<{
    show: boolean;
    message: string;
    changeLogId?: number | null;
  }>({ show: false, message: '' });
  const [isUndoing, setIsUndoing] = useState(false);

  // Swap Modal State
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTargetId, setSwapTargetId] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.get(
        `/assignments?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&limit=2000`
      );
      if (Array.isArray(data)) {
        setSessions(data);
      }
    } catch (err: any) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [academicYear, semester]);

  // Conflict Detection
  const conflicts = useMemo(() => {
    const conflictSet = new Set<number>();
    const len = sessions.length;

    for (let i = 0; i < len; i++) {
      const a = sessions[i];
      for (let j = i + 1; j < len; j++) {
        const b = sessions[j];
        if (a.day_of_week === b.day_of_week) {
          // Time overlap check
          const overlap = a.start_time < b.end_time && a.end_time > b.start_time;
          if (overlap) {
            // Room conflict
            if (a.room_id && b.room_id && a.room_id === b.room_id) {
              conflictSet.add(a.id);
              conflictSet.add(b.id);
            }
            // Professor conflict
            if (a.professor_id && b.professor_id && a.professor_id === b.professor_id) {
              conflictSet.add(a.id);
              conflictSet.add(b.id);
            }
            // Group conflict
            if (a.group_id && b.group_id && a.group_id === b.group_id) {
              conflictSet.add(a.id);
              conflictSet.add(b.id);
            }
          }
        }
      }
    }
    return conflictSet;
  }, [sessions]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const q = search.toLowerCase();
      return (
        (s.course_name || '').toLowerCase().includes(q) ||
        (s.professor_name || '').toLowerCase().includes(q) ||
        (s.group_name || '').toLowerCase().includes(q) ||
        (s.room_name || '').toLowerCase().includes(q) ||
        (s.day_of_week || '').toLowerCase().includes(q)
      );
    });
  }, [sessions, search]);

  // Paginated Sessions
  const totalPages = Math.ceil(filteredSessions.length / pageSize) || 1;
  const paginatedSessions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, page, pageSize]);

  // Open Delete Impact Modal
  const handleOpenDelete = async (session: Assignment) => {
    setSelectedSession(session);
    setDeleteModalOpen(true);
    try {
      const impactRes = await api.getDeleteImpact('assignments', session.id);
      setDeleteImpact(impactRes.impact);
    } catch (err) {
      setDeleteImpact(null);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!selectedSession) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/assignments/${selectedSession.id}`);
      setDeleteModalOpen(false);
      setSessions((prev) => prev.filter((s) => s.id !== selectedSession.id));

      setUndoToast({
        show: true,
        message: `تم حذف الحصة "${selectedSession.course_name || 'حصة'}" بنجاح.`,
        changeLogId: res?.changeLogId || null,
      });
    } catch (err: any) {
      alert(err.messageAr || err.message || 'فشل حذف الحصة');
    } finally {
      setIsDeleting(false);
      setSelectedSession(null);
    }
  };

  // Handle Undo
  const handleUndo = async (logId?: number) => {
    const idToUndo = logId || undoToast.changeLogId;
    if (!idToUndo) return;
    setIsUndoing(true);
    try {
      await api.undoChange(idToUndo);
      setUndoToast({ show: false, message: '' });
      await loadSessions();
    } catch (err: any) {
      alert(err.messageAr || err.message || 'فشل التراجع');
    } finally {
      setIsUndoing(false);
    }
  };

  // Open Swap Modal
  const handleOpenSwap = (session: Assignment) => {
    setSelectedSession(session);
    setSwapTargetId('');
    setSwapError(null);
    setShowSwapModal(true);
  };

  // Perform Atomic Swap (P7 Unit of Work)
  const handlePerformSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !swapTargetId) return;

    setIsSwapping(true);
    setSwapError(null);
    try {
      await api.post('/assignments/swap', {
        idA: selectedSession.id,
        idB: Number(swapTargetId),
      });
      setShowSwapModal(false);
      setSelectedSession(null);
      await loadSessions();
    } catch (err: any) {
      setSwapError(err.messageAr || err.message || 'فشل إجراء التبديل الذري');
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">إدارة التكليفات والحصص (Sessions)</h1>
            <p className="text-sm text-slate-500">
              إجمالي الحصص المسجلة: <span className="font-semibold text-slate-700">{sessions.length}</span>
              {conflicts.size > 0 && (
                <span className="mr-3 text-amber-600 font-semibold inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 inline" />
                  يوجد {conflicts.size} حصة بها تعارض محتمل!
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSessions}
            disabled={loading}
            className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالمقرر، الأستاذ، الفوج، القاعة..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="2026-2027">2026-2027</option>
            <option value="2025-2026">2025-2026</option>
            <option value="2024-2025">2024-2025</option>
          </select>

          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="السداسي الأول">السداسي الأول</option>
            <option value="السداسي الثاني">السداسي الثاني</option>
          </select>
        </div>
      </div>

      {/* Content Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500 font-medium">جاري تحميل بيانات الحصص والتكليفات...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-800">لا توجد حصص مسجلة</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            {search ? 'لم نتمكن من العثور على حصص تطابق بحثك.' : 'لا توجد حصص لهذه السنة الجامعية والسداسي.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs">
                <tr>
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">المقرر الدراسي</th>
                  <th className="py-3.5 px-4">الأستاذ</th>
                  <th className="py-3.5 px-4">الفوج / الدفعة</th>
                  <th className="py-3.5 px-4">القاعة</th>
                  <th className="py-3.5 px-4">اليوم والتوقيت</th>
                  <th className="py-3.5 px-4">النوع</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedSessions.map((session) => {
                  const hasConflict = conflicts.has(session.id);
                  return (
                    <tr
                      key={session.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        hasConflict ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-xs font-mono text-slate-400">{session.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          {hasConflict && (
                            <span title="يوجد تعارض محتمل في الوقت أو القاعة أو الأستاذ">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 inline" />
                            </span>
                          )}
                          <span>{session.course_name || 'مقرر بدون اسم'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{session.professor_name || '—'}</td>
                      <td className="py-3 px-4 text-slate-700">{session.group_name || '—'}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-800">
                          {session.room_name || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700">
                        {session.day_of_week} ({session.start_time} - {session.end_time})
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            session.session_type === 'cours'
                              ? 'bg-blue-50 text-blue-700'
                              : session.session_type === 'tp'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {session.session_type || 'TD'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenSwap(session)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="تبديل مع حصة أخرى (P7 Swap الذري)"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(session)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="حذف الحصة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
            <div>
              عرض {(page - 1) * pageSize + 1} إلى {Math.min(page * pageSize, filteredSessions.length)} من أصل {filteredSessions.length} حصة
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                السابق
              </button>
              <span className="font-semibold px-2">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                التالي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* P7 Swap Modal */}
      {showSwapModal && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">تبديل حصتين دراسيتين (Atomic Swap)</h3>
              </div>
              <button
                onClick={() => setShowSwapModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePerformSwap} className="p-6 space-y-4">
              {swapError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                  {swapError}
                </div>
              )}

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900">
                <span className="font-bold block mb-1">الحصة الأصلية (A):</span>
                <span>
                  {selectedSession.course_name} ({selectedSession.day_of_week} {selectedSession.start_time} - {selectedSession.end_time}) - {selectedSession.room_name}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اختر الحصة المراد التبديل معها (B)
                </label>
                <select
                  required
                  value={swapTargetId}
                  onChange={(e) => setSwapTargetId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">-- اختر الحصة المستهدفة --</option>
                  {sessions
                    .filter((s) => s.id !== selectedSession.id)
                    .slice(0, 100)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.id}: {s.course_name} ({s.day_of_week} {s.start_time}) - {s.professor_name} - {s.room_name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSwapModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSwapping || !swapTargetId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSwapping ? 'جاري التبديل الذري...' : 'تأكيد التبديل الذري'}
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
        title="تأكيد حذف الحصة مع تقييم الأثر"
        entityName={selectedSession?.course_name || 'الحصة'}
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
