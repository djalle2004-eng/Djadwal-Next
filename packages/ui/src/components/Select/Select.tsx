import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options = [], error, helperText, id, children, disabled, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    return (
      <div className="w-full space-y-1.5 text-start">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              'w-full py-2.5 ps-3.5 pe-10 text-sm bg-white dark:bg-slate-900 border rounded-xl appearance-none text-slate-900 dark:text-slate-100 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-1',
              error
                ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-emerald-500/20',
              disabled && 'opacity-60 bg-slate-50 dark:bg-slate-800 cursor-not-allowed',
              className
            )}
            {...props}
          >
            {children ||
              options.map((opt) => (
                <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
          </select>

          <div
            className="absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {error ? (
          <p id={errorId} className="text-xs text-rose-600 dark:text-rose-400 font-medium" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-slate-500 dark:text-slate-400">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';

