'use client';

import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert, Check } from 'lucide-react';

interface ImpactItem {
  labelArabic: string;
  count: number;
  entityType?: string;
}

interface DeleteImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  entityName: string;
  impact?: {
    totalImpactCount?: number;
    impacts?: ImpactItem[];
    affected_assignments_count?: number;
    affected_extra_sessions_count?: number;
    affected_groups_count?: number;
    affected_courses_count?: number;
    warning_ar?: string;
    can_soft_delete?: boolean;
    blockReason?: string;
  } | null;
  isLoading?: boolean;
}

export default function DeleteImpactModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  entityName,
  impact,
  isLoading = false,
}: DeleteImpactModalProps) {
  const [confirmedByUser, setConfirmedByUser] = useState(false);

  if (!isOpen) return null;

  const totalAffected =
    impact?.totalImpactCount !== undefined
      ? impact.totalImpactCount
      : (impact?.affected_assignments_count || 0) +
        (impact?.affected_extra_sessions_count || 0) +
        (impact?.affected_groups_count || 0) +
        (impact?.affected_courses_count || 0);

  const impactsList = impact?.impacts && impact.impacts.length > 0
    ? impact.impacts
    : [
        impact?.affected_assignments_count
          ? { labelArabic: 'الحصص الدراسية المجدولة', count: impact.affected_assignments_count }
          : null,
        impact?.affected_extra_sessions_count
          ? { labelArabic: 'الحصص الإضافية والتعويضية', count: impact.affected_extra_sessions_count }
          : null,
        impact?.affected_groups_count
          ? { labelArabic: 'الأفواج والفرق المرتبطة', count: impact.affected_groups_count }
          : null,
        impact?.affected_courses_count
          ? { labelArabic: 'المقاييس والمواد التابعة', count: impact.affected_courses_count }
          : null,
      ].filter(Boolean) as ImpactItem[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 shadow-2xl transition-all text-start">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">فحص الأثر المسبق والحذف الناعم</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="my-5 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p className="leading-relaxed">
            هل أنت متأكد من رغبتك في حذف العنصر:{' '}
            <strong className="text-slate-900 dark:text-white font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
              {entityName}
            </strong>؟
          </p>

          {/* Impact Assessment Details */}
          {totalAffected > 0 ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>⚠️ معاينة أثر الحذف (سيؤثر الحذف على {totalAffected} عنصراً):</span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200 pt-1">
                {impactsList.map((imp, idx) => (
                  <li key={idx} className="flex items-center justify-between py-0.5 border-b border-amber-200/40 dark:border-amber-900/30 last:border-0">
                    <span>{imp.labelArabic}:</span>
                    <strong className="font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 font-bold">
                      {imp.count}
                    </strong>
                  </li>
                ))}
              </ul>
              {impact?.warning_ar && (
                <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-300 bg-white/60 dark:bg-zinc-900/60 p-2 rounded-lg">
                  {impact.warning_ar}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/90 dark:bg-emerald-950/30 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>لا توجد حصص نشطة أو تبعيات مرتبطة مباشرة بهذا العنصر.</span>
            </div>
          )}

          {/* Explicit Confirmation Checkbox if items are affected */}
          {totalAffected > 0 && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/60 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedByUser}
                onChange={(e) => setConfirmedByUser(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="font-semibold">
                أفهم أثر هذا الحذف على الجداول، وأؤكد رغبتي في النقل إلى سلة الأرشفة الآمنة (Soft Delete).
              </span>
            </label>
          )}

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            * الحذف يتم بنمط الحذف الناعم (Soft Delete) مع تسجيل العملية في سجل التدقيق (<span className="font-mono">change_log</span>) وإمكانية الاسترجاع في أي وقت من تبويب المؤرشفات.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-zinc-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-slate-200 dark:border-zinc-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || (totalAffected > 0 && !confirmedByUser)}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            <span>{isLoading ? 'جارٍ الحذف...' : 'تأكيد الحذف الناعم'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
