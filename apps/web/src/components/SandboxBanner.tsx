'use client';

import React from 'react';
import {
  FlaskConical,
  Check,
  RotateCcw,
  Undo2,
  Redo2,
  FolderArchive,
  Save,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Button, Badge } from '@djadwal/ui';
import { useSandbox } from '@/context/SandboxContext';

export default function SandboxBanner() {
  const {
    isSandboxMode,
    exitSandboxMode,
    discardChanges,
    simulatedChanges,
    hasChanges,
    changeCount,
    canUndo,
    canRedo,
    undo,
    redo,
    setIsCommitModalOpen,
    setIsDraftsModalOpen,
  } = useSandbox();

  if (!isSandboxMode) return null;

  const handleDiscard = () => {
    if (changeCount > 0) {
      if (
        !window.confirm(
          `هل أنت متأكد من إلغاء كافة التعديلات التجريبية (${changeCount} تعديل) والعودة إلى البيانات الأصلية؟`
        )
      ) {
        return;
      }
    }
    discardChanges();
  };

  const handleExit = () => {
    if (changeCount > 0) {
      if (
        !window.confirm(
          `لديك ${changeCount} تعديل معلق في وضع التجربة. عند الخروج سيتم إلغاء التعديلات غير المعتمدة. هل ترغب بالخروج؟`
        )
      ) {
        return;
      }
    }
    exitSandboxMode();
  };

  return (
    <div className="sticky top-0 z-40 w-full bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-b-2 border-amber-500/40 backdrop-blur-md shadow-xs transition-all animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left: Mode Title & Info */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              <span className="relative flex h-2.5 w-2.5 me-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <FlaskConical className="w-4 h-4" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-amber-950 dark:text-amber-100">
                  وضع التجربة والمحاكاة (Sandbox Mode)
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    changeCount > 0
                      ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-zinc-800 dark:text-slate-400'
                  }`}
                >
                  {changeCount > 0 ? `${changeCount} تعديل معلق` : 'لا توجد تعديلات معلقة'}
                </Badge>
              </div>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 hidden md:block">
                جميع عمليات السحب والإفلات وتغيير القاعات تجري محلياً في الذاكرة دون المساس بقاعدة بيانات الإنتاج.
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
            {/* Undo / Redo */}
            <div className="inline-flex items-center rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-amber-500/30 p-0.5">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  canUndo
                    ? 'text-slate-700 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                    : 'text-slate-300 dark:text-zinc-600 cursor-not-allowed'
                }`}
                title="تراجع عن آخر حركة محاكاة (Undo)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  canRedo
                    ? 'text-slate-700 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                    : 'text-slate-300 dark:text-zinc-600 cursor-not-allowed'
                }`}
                title="إعادة آخر حركة محاكاة (Redo)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Drafts */}
            <button
              type="button"
              onClick={() => setIsDraftsModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/80 dark:bg-zinc-900/80 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">المسودات</span>
            </button>

            {/* Discard */}
            {changeCount > 0 && (
              <button
                type="button"
                onClick={handleDiscard}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/80 dark:bg-zinc-900/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1.5 shadow-2xs"
                title="إلغاء التعديلات والرجوع للأصل"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إلغاء التعديلات</span>
              </button>
            )}

            {/* Commit to DB Button */}
            <button
              type="button"
              onClick={() => setIsCommitModalOpen(true)}
              disabled={changeCount === 0}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                changeCount > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-emerald-600/40 text-white/70 cursor-not-allowed'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>اعتماد التعديلات ({changeCount})</span>
            </button>

            {/* Exit Button */}
            <button
              type="button"
              onClick={handleExit}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-amber-500/20 transition-colors"
              title="الخروج من وضع التجربة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
