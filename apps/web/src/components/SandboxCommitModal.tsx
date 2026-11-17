'use client';

import React, { useState } from 'react';
import {
  Dialog,
  Button,
  Badge,
} from '@djadwal/ui';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import { useSandbox, SimulatedChange } from '@/context/SandboxContext';

export default function SandboxCommitModal() {
  const {
    isCommitModalOpen,
    setIsCommitModalOpen,
    simulatedChanges,
    commitChanges,
    isCommitting,
    commitProgress,
  } = useSandbox();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isCommitModalOpen) return null;

  const handleConfirmCommit = async () => {
    setErrorMessage(null);
    try {
      const result = await commitChanges();
      if (!result.success && result.errors && result.errors.length > 0) {
        setErrorMessage(
          `تم تطبيق ${result.appliedCount} من أصل ${simulatedChanges.length} تعديل، مع وجود ${result.errors.length} أخطاء.`
        );
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'حدث خطأ أثناء اعتماد التعديلات في قاعدة البيانات');
    }
  };

  return (
    <Dialog
      open={isCommitModalOpen}
      onClose={() => !isCommitting && setIsCommitModalOpen(false)}
      size="lg"
      className="max-h-[90vh] flex flex-col"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              اعتماد ونشر تعديلات المحاكاة
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مراجعة التعديلات التجريبية المعلقة قبل كتابتها نهائياً في قاعدة بيانات الإنتاج (Neon/Turso)
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-bold px-2.5 py-1">
          {simulatedChanges.length} تعديل معلق
        </Badge>
      </div>

      {errorMessage && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Progress Bar when committing */}
      {isCommitting && commitProgress && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              جاري كتابة التعديلات وتطبيق قفل OCC...
            </span>
            <span>
              {commitProgress.current} / {commitProgress.total}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-2 transition-all duration-300"
              style={{
                width: `${Math.round((commitProgress.current / commitProgress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Changes List */}
      <div className="mt-4 flex-1 overflow-y-auto max-h-[50vh] space-y-2.5 pr-1 pl-1">
        {simulatedChanges.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            لا توجد تعديلات معلقة للاعتماد.
          </div>
        ) : (
          simulatedChanges.map((change, idx) => (
            <div
              key={change.id}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold px-1.5 py-0.5 ${
                      change.actionType === 'delete'
                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                        : change.actionType === 'create'
                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                        : change.actionType === 'update'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    }`}
                  >
                    {change.actionType === 'delete'
                      ? 'حذف'
                      : change.actionType === 'create'
                      ? 'إضافة'
                      : change.actionType === 'update'
                      ? 'تعديل'
                      : 'نقل'}
                  </Badge>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    #{idx + 1} — {change.courseName}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {change.groupName} • {change.professorName}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* From */}
                <div className="p-2 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 text-slate-700 dark:text-slate-300">
                  <div className="font-semibold text-rose-700 dark:text-rose-400 text-[11px] mb-1">
                    الموقع السابق (قبل المحاكاة):
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{change.from.dayName}</span>
                    <Clock className="w-3 h-3 text-slate-400 ms-1" />
                    <span>{change.from.startTime} - {change.from.endTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{change.from.roomName || 'غير محددة'}</span>
                  </div>
                </div>

                {/* To */}
                <div className="p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 text-slate-700 dark:text-slate-300">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400 text-[11px] mb-1">
                    الموقع الجديد (بعد الاعتماد):
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Calendar className="w-3 h-3 text-emerald-500" />
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">{change.to.dayName}</span>
                    <Clock className="w-3 h-3 text-emerald-500 ms-1" />
                    <span>{change.to.startTime} - {change.to.endTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                    <MapPin className="w-3 h-3 text-emerald-500" />
                    <span className="font-semibold">{change.to.roomName || 'غير محددة'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setIsCommitModalOpen(false)}
          disabled={isCommitting}
          className="text-xs"
        >
          إلغاء والعودة للمحاكاة
        </Button>

        <Button
          variant="primary"
          onClick={handleConfirmCommit}
          disabled={isCommitting || simulatedChanges.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2"
        >
          {isCommitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري النشر الفعلي...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>تأكيد النشر الفعلي ({simulatedChanges.length} تعديل)</span>
            </>
          )}
        </Button>
      </div>
    </Dialog>
  );
}
