'use client';

import React from 'react';
import { Undo2, CheckCircle2, X } from 'lucide-react';

interface UndoToastProps {
  show: boolean;
  message: string;
  changeLogId?: number | null;
  onUndo: (id: number) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export default function UndoToast({
  show,
  message,
  changeLogId,
  onUndo,
  onClose,
  isLoading = false,
}: UndoToastProps) {
  if (!show) return null;

  return (
    <div className="fixed bottom-5 left-5 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-2xl transition-all border border-slate-700 animate-slide-up">
      <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
      <span className="text-sm font-medium">{message}</span>

      {changeLogId && (
        <button
          onClick={() => onUndo(changeLogId)}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" />
          <span>{isLoading ? 'جارٍ التراجع...' : 'تراجع (Undo)'}</span>
        </button>
      )}

      <button
        onClick={onClose}
        className="rounded-md p-1 text-gray-400 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

