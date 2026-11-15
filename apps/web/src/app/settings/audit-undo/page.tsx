'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  History,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  ArrowRight,
  RefreshCw,
  Clock,
  User,
  Layers,
  Database,
  Undo2,
  ShieldCheck,
  X
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

interface ChangeLogEntry {
  id: number;
  entity_type: string;
  entity_id: string | number;
  action: 'create' | 'update' | 'delete' | 'swap' | 'move' | string;
  before_state: any;
  after_state: any;
  changed_by?: string | number | null;
  created_at: string;
  reverted_at?: string | null;
  reverted_by?: string | number | null;
}

export default function AuditUndoPage() {
  const [entries, setEntries] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  // Diff Modal
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ChangeLogEntry | null>(null);

  // Undo Confirmation Modal
  const [undoModalOpen, setUndoModalOpen] = useState(false);
  const [entryToUndo, setEntryToUndo] = useState<ChangeLogEntry | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadChanges = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await api.listChanges({ limit: 100 });
      setEntries(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load change log:', err);
      showToast('error', 'فشل تحميل سجل التغييرات والتراجع');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadChanges();
  }, [loadChanges]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (entityFilter !== 'all' && e.entity_type !== entityFilter) return false;
      if (actionFilter !== 'all' && e.action.toLowerCase() !== actionFilter.toLowerCase()) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const entityMatch = e.entity_type.toLowerCase().includes(q);
        const actionMatch = e.action.toLowerCase().includes(q);
        const idMatch = String(e.entity_id).includes(q);
        if (!entityMatch && !actionMatch && !idMatch) return false;
      }
      return true;
    });
  }, [entries, entityFilter, actionFilter, searchTerm]);

  // Check 24-hour eligibility
  const isWithin24Hours = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    return diffMs <= 24 * 60 * 60 * 1000;
  };

  // Execute Undo
  const handleConfirmUndo = async () => {
    if (!entryToUndo) return;

    try {
      setIsUndoing(true);
      await api.undoChange(entryToUndo.id);
      showToast('success', `تم التراجع الذري عن التعديل رقم #${entryToUndo.id} بنجاح وإعادة الحالة الأصلية`);
      setUndoModalOpen(false);
      setEntryToUndo(null);
      await loadChanges();
    } catch (err: any) {
      showToast('error', err?.messageAr || err?.message || 'فشلت عملية التراجع عن التعديل');
    } finally {
      setIsUndoing(false);
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
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-600 to-rose-500 flex items-center justify-center text-white shadow-md">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  سجل التغييرات ومركز التراجع (Audit & 24h Undo)
                </h1>
                <Badge variant="warning">UnitOfWork Atomic Rollback</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تدقيق التعديلات الحرجة، فحص الفروقات، والتراجع الفوري عن العمليات الخاطئة خلال 24 ساعة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadChanges}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>تحديث السجل</span>
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
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span>العمليات والأنشطة المسجلة ({filteredEntries.length})</span>
                </CardTitle>
                <CardDescription>
                  يمكن التراجع عن أي عملية تعديل أو حذف أو نقل تمت خلال آخر 24 ساعة بنقرة واحدة
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Input
                  type="text"
                  placeholder="بحث بنوع الكيان أو المعرف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48 text-xs"
                />

                <select
                  value={entityFilter}
                  onChange={(e) => setEntityFilter(e.target.value)}
                  className="py-1.5 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="all">جميع الكيانات</option>
                  <option value="assignments">التكليفات والحصص</option>
                  <option value="professors">الأساتذة</option>
                  <option value="rooms">القاعات</option>
                  <option value="courses">المقاييس</option>
                  <option value="groups">الأفواج</option>
                  <option value="extra_sessions">الحصص التعويضية</option>
                  <option value="departments">الأقسام</option>
                </select>

                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="py-1.5 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="all">جميع الإجراءات</option>
                  <option value="create">إضافة (Create)</option>
                  <option value="update">تعديل (Update)</option>
                  <option value="delete">حذف (Delete)</option>
                  <option value="swap">تبديل (Swap)</option>
                  <option value="move">نقل (Move)</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <EmptyState
                title="لا توجد سجلات مطابقة"
                description="لم يتم تسجيل أي تعديل يطابق معايير الفلترة المحددة"
              />
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3.5 px-3 text-start font-bold">المعرف</th>
                      <th className="py-3.5 px-3 text-start font-bold">الوقت والتاريخ</th>
                      <th className="py-3.5 px-3 text-start font-bold">نوع الكيان</th>
                      <th className="py-3.5 px-3 text-start font-bold">معرف الكيان</th>
                      <th className="py-3.5 px-3 text-start font-bold">نوع العملية</th>
                      <th className="py-3.5 px-3 text-start font-bold">المنفذ</th>
                      <th className="py-3.5 px-3 text-center font-bold">الحالة</th>
                      <th className="py-3.5 px-3 text-center font-bold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredEntries.map(entry => {
                      const within24h = isWithin24Hours(entry.created_at);
                      const isReverted = !!entry.reverted_at;
                      const canUndo = within24h && !isReverted;

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-slate-500">
                            #{entry.id}
                          </td>
                          <td className="py-3 px-3 font-mono">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {new Date(entry.created_at).toLocaleTimeString('ar-DZ')}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(entry.created_at).toLocaleDateString('ar-DZ')}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">
                              {entry.entity_type}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                            {entry.entity_id}
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant={
                                entry.action === 'delete'
                                  ? 'danger'
                                  : entry.action === 'create'
                                  ? 'success'
                                  : entry.action === 'swap' || entry.action === 'move'
                                  ? 'info'
                                  : 'warning'
                              }
                            >
                              {entry.action.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                            {entry.changed_by ? `مستخدم #${entry.changed_by}` : 'النظام'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isReverted ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <RotateCcw className="h-3 w-3" />
                                <span>تم التراجع</span>
                              </span>
                            ) : within24h ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <ShieldCheck className="h-3 w-3" />
                                <span>قابل للتراجع (24h)</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">مؤرشف ثابت</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* View Diff Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedEntry(entry);
                                  setDiffModalOpen(true);
                                }}
                                className="h-7 w-7 p-0 text-slate-600 hover:text-indigo-600"
                                title="عرض تفاصيل الحالة قبل وبعد"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>

                              {/* Undo Button */}
                              {canUndo && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEntryToUndo(entry);
                                    setUndoModalOpen(true);
                                  }}
                                  className="text-[11px] gap-1 py-1 h-7 text-rose-700 border-rose-300 hover:bg-rose-50"
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                  <span>تراجع</span>
                                </Button>
                              )}
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
      </div>

      {/* Diff Inspector Modal */}
      <Dialog open={diffModalOpen} onClose={() => setDiffModalOpen(false)}>
        <div className="p-6 text-start max-w-2xl" dir="rtl">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Eye className="h-5 w-5 text-indigo-600" />
              <span>فحص تفاصيل العملية #{selectedEntry?.id}</span>
            </DialogTitle>
            <button
              onClick={() => setDiffModalOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {selectedEntry && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                <div><strong>الكيان:</strong> {selectedEntry.entity_type}</div>
                <div><strong>المعرف:</strong> {selectedEntry.entity_id}</div>
                <div><strong>العملية:</strong> {selectedEntry.action}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Before State */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="font-bold text-slate-700 dark:text-slate-300 border-b pb-1.5 mb-2">
                    الحالة السابقة (Before)
                  </div>
                  <pre className="text-[10px] font-mono overflow-auto max-h-56 p-2 bg-slate-50 dark:bg-slate-950 rounded text-slate-800 dark:text-slate-200">
                    {selectedEntry.before_state
                      ? JSON.stringify(selectedEntry.before_state, null, 2)
                      : '— (سجل جديد / لا توجد حالة سابقة)'}
                  </pre>
                </div>

                {/* After State */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="font-bold text-slate-700 dark:text-slate-300 border-b pb-1.5 mb-2">
                    الحالة بعد التعديل (After)
                  </div>
                  <pre className="text-[10px] font-mono overflow-auto max-h-56 p-2 bg-slate-50 dark:bg-slate-950 rounded text-slate-800 dark:text-slate-200">
                    {selectedEntry.after_state
                      ? JSON.stringify(selectedEntry.after_state, null, 2)
                      : '— (تم الحذف)'}
                  </pre>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end border-t mt-4">
            <Button variant="outline" onClick={() => setDiffModalOpen(false)}>
              إغلاق
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Undo Confirmation Modal */}
      <Dialog open={undoModalOpen} onClose={() => setUndoModalOpen(false)}>
        <div className="p-6 text-start max-w-md" dir="rtl">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-600">
            <Undo2 className="h-5 w-5" />
            <span>تأكيد التراجع عن التعديل</span>
          </DialogTitle>
          <DialogDescription className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <p>
              أنت على وشك التراجع عن العملية رقم <strong>#{entryToUndo?.id}</strong> على كيان ({entryToUndo?.entity_type} #{entryToUndo?.entity_id}).
            </p>
            <p className="p-2.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-[11px]">
              سيتم التراجع الذري (Atomic Rollback) وإعادة البيانات للحالة السابقة وتسجيل هذا الإجراء في سجل التدقيق.
            </p>
          </DialogDescription>

          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t">
            <Button variant="outline" onClick={() => setUndoModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              disabled={isUndoing}
              onClick={handleConfirmUndo}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              {isUndoing ? 'جاري التراجع...' : 'تأكيد التراجع الآن'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
