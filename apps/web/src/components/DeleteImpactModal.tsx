'use client';

import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  entityName: string;
  impact?: {
    affected_assignments_count?: number;
    affected_extra_sessions_count?: number;
    affected_groups_count?: number;
    affected_courses_count?: number;
    warning_ar?: string;
    can_soft_delete?: boolean;
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
  if (!isOpen) return null;

  const totalAffected =
    (impact?.affected_assignments_count || 0) +
    (impact?.affected_extra_sessions_count || 0) +
    (impact?.affected_groups_count || 0) +
    (impact?.affected_courses_count || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="my-5 space-y-4 text-sm text-gray-600">
          <p>
            هل أنت متأكد من رغبتك في حذف العنصر:{' '}
            <strong className="text-gray-900">{entityName}</strong>؟
          </p>

          {/* P7 Impact Assessment Details */}
          {impact && totalAffected > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-semibold text-amber-900">
                ⚠️ معاينة أثر الحذف (Delete Impact Analysis):
              </div>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-800">
                {impact.affected_assignments_count ? (
                  <li>
                    سيؤثر الحذف على{' '}
                    <strong>{impact.affected_assignments_count}</strong> حصة جدول أسبوعي.
                  </li>
                ) : null}
                {impact.affected_extra_sessions_count ? (
                  <li>
                    سيؤثر الحذف على{' '}
                    <strong>{impact.affected_extra_sessions_count}</strong> حصة إضافية/امتحان.
                  </li>
                ) : null}
                {impact.affected_groups_count ? (
                  <li>
                    سيؤثر على <strong>{impact.affected_groups_count}</strong> فوج مرتبط.
                  </li>
                ) : null}
                {impact.affected_courses_count ? (
                  <li>
                    سيؤثر على <strong>{impact.affected_courses_count}</strong> مقياس مرتبط.
                  </li>
                ) : null}
              </ul>
              {impact.warning_ar && (
                <p className="mt-2 text-xs font-medium text-amber-900">
                  {impact.warning_ar}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              ✅ لا توجد حصص أو عناصر حيوية مرتبطة مباشرة بهذا العنصر.
            </div>
          )}

          <p className="text-xs text-gray-500">
            * يتم الحذف بنمط الحذف الآمن (Soft Delete) مع إمكانية التراجع الفوري من سجل التغييرات.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isLoading ? 'جارٍ الحذف...' : 'تأكيد الحذف الآمن'}
          </button>
        </div>
      </div>
    </div>
  );
}
