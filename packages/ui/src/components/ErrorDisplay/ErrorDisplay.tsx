import React, { useState } from 'react';
import { AlertOctagon, RefreshCw, Copy, Check, HelpCircle, Hash } from 'lucide-react';
import { Button } from '../Button';
import { cn } from '../../utils/cn';

export interface ErrorDisplayProps {
  /** What happened in Arabic */
  title?: string;
  errorMessage: string;
  /** Suggested next step for the user */
  suggestedAction?: string;
  /** Trace ID from backend X-Request-Id / trace_id */
  traceId?: string;
  /** Error code (e.g. 409_CONFLICT, NETWORK_ERROR, AUTH_EXPIRED) */
  errorCode?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorDisplay({
  title = 'تعذر إكمال العملية المطلوبة',
  errorMessage,
  suggestedAction = 'يرجى التحقق من اتصال الشبكة وتحديث الصفحة، أو التواصل مع مسؤول النظام إذا تكرر الخطأ.',
  traceId,
  errorCode,
  onRetry,
  className,
}: ErrorDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyTraceId = () => {
    if (!traceId) return;
    navigator.clipboard.writeText(traceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="alert"
      className={cn(
        'w-full max-w-2xl mx-auto rounded-2xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 shadow-md p-6 text-start',
        className
      )}
    >
      {/* Header: Status Icon & Title */}
      <div className="flex items-start gap-4 pb-4 border-b border-rose-100 dark:border-rose-950">
        <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 shrink-0">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            {errorCode && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold">
                {errorCode}
              </span>
            )}
          </div>
          <p className="text-sm text-rose-700 dark:text-rose-300 mt-1 font-medium">
            {errorMessage}
          </p>
        </div>
      </div>

      {/* Suggested Action */}
      <div className="py-4 space-y-2">
        <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-slate-800 dark:text-slate-200 mb-0.5">
              الخطوة المقترحة:
            </strong>
            <span>{suggestedAction}</span>
          </div>
        </div>
      </div>

      {/* Footer: Trace ID & Actions */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
        {/* Trace ID */}
        {traceId ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-[11px] truncate max-w-[200px]" title={traceId}>
              {traceId}
            </span>
            <button
              type="button"
              onClick={handleCopyTraceId}
              className="inline-flex items-center gap-1 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="نسخ رمز التتبع"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span className="text-[11px]">{copied ? 'تم النسخ' : 'نسخ'}</span>
            </button>
          </div>
        ) : <div />}

        {/* Action Button */}
        {onRetry && (
          <Button
            variant="primary"
            size="sm"
            onClick={onRetry}
            startIcon={<RefreshCw className="w-4 h-4" />}
          >
            إعادة المحاولة
          </Button>
        )}
      </div>
    </div>
  );
}

