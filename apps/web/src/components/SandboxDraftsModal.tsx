'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Button,
  Input,
  Badge,
} from '@djadwal/ui';
import {
  FolderArchive,
  Save,
  Trash2,
  Download,
  Calendar,
  Layers,
  Check,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useSandbox, SandboxDraft } from '@/context/SandboxContext';

export default function SandboxDraftsModal() {
  const {
    isDraftsModalOpen,
    setIsDraftsModalOpen,
    saveDraft,
    loadDraft,
    listDrafts,
    deleteDraft,
    stagedAssignments,
    simulatedChanges,
  } = useSandbox();

  const [draftName, setDraftName] = useState('');
  const [draftsList, setDraftsList] = useState<SandboxDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isDraftsModalOpen) {
      loadDraftsList();
      setDraftName(`مسودة تجربة — ${new Date().toLocaleDateString('ar-DZ')}`);
      setSaveSuccess(false);
    }
  }, [isDraftsModalOpen]);

  const loadDraftsList = async () => {
    setLoading(true);
    try {
      const items = await listDrafts();
      setDraftsList(items);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim()) return;

    await saveDraft(draftName);
    setSaveSuccess(true);
    await loadDraftsList();
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleDelete = async (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('هل تريد حذف هذه المسودة نهائياً؟')) {
      await deleteDraft(id);
      await loadDraftsList();
    }
  };

  const handleLoad = (draft: SandboxDraft) => {
    if (simulatedChanges.length > 0) {
      if (
        !window.confirm(
          'لديك تعديلات حالية في وضع التجربة. استرجاع مسودة أخرى سيستبدلها. هل تريد المتابعة؟'
        )
      ) {
        return;
      }
    }
    loadDraft(draft);
  };

  if (!isDraftsModalOpen) return null;

  return (
    <Dialog
      open={isDraftsModalOpen}
      onClose={() => setIsDraftsModalOpen(false)}
      size="md"
      className="max-h-[85vh] flex flex-col"
    >
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
            <FolderArchive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              مسودات وضع التجربة (Draft Snapshots)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              حفظ واسترجاع سيناريوهات الجداول التجريبية
            </p>
          </div>
        </div>
      </div>

      {/* Save Current State Form */}
      <form onSubmit={handleSave} className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          حفظ الحالة التجريبية الحالية كمسودة:
        </label>
        <div className="flex gap-2">
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="اسم المسودة (مثلاً: مقترح السبت صباحاً)..."
            className="text-xs flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!draftName.trim()}
            className="text-xs px-3 bg-violet-600 hover:bg-violet-700 text-white shrink-0 flex items-center gap-1.5"
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>تم الحفظ</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>حفظ مسودة</span>
              </>
            )}
          </Button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          تحتوي المحاكاة الحالية على {simulatedChanges.length} تعديل معلق و {stagedAssignments.length} حصة.
        </p>
      </form>

      {/* Drafts List */}
      <div className="mt-4 flex-1 overflow-y-auto max-h-[40vh] space-y-2">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
          المسودات المحفوظة ({draftsList.length})
        </div>

        {loading ? (
          <div className="text-center py-6 text-xs text-slate-400">جاري تحميل المسودات...</div>
        ) : draftsList.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            لا توجد مسودات محفوظة حتى الآن.
          </div>
        ) : (
          draftsList.map((draft) => (
            <div
              key={draft.id}
              onClick={() => handleLoad(draft)}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {draft.name}
                  </span>
                  {draft.changesCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-200">
                      {draft.changesCount} تعديل
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                  <span>{new Date(draft.createdAt).toLocaleString('ar-DZ')}</span>
                  {draft.assignmentsCount > 0 && (
                    <span>• {draft.assignmentsCount} حصة</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ms-2">
                <button
                  type="button"
                  onClick={() => handleLoad(draft)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:hover:bg-violet-900/50 transition-colors flex items-center gap-1"
                  title="استرجاع وتفعيل هذه المسودة"
                >
                  <Download className="w-3 h-3" />
                  <span>تطبيق</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(draft.id, e)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="حذف المسودة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
        <Button
          variant="outline"
          onClick={() => setIsDraftsModalOpen(false)}
          className="text-xs"
        >
          إغلاق
        </Button>
      </div>
    </Dialog>
  );
}
