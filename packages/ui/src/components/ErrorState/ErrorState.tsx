import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../Button';
import { cn } from '../../utils/cn';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'حدث خطأ غير متوقع',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-start',
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>

      <h3 className="text-base font-bold text-rose-900 dark:text-rose-100 mb-1">
        {title}
      </h3>

      <p className="text-sm text-rose-700 dark:text-rose-300 max-w-md mb-6 text-center">
        {message}
      </p>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          startIcon={<RefreshCw className="w-4 h-4" />}
          className="border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50"
        >
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}

