import React, { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      startIcon,
      endIcon,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full space-y-1.5 text-start">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {startIcon && (
            <div
              className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center w-5 h-5"
              aria-hidden="true"
            >
              {startIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              'w-full py-2.5 px-3.5 text-sm bg-white dark:bg-slate-900 border rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-1',
              startIcon && 'ps-10',
              endIcon && 'pe-10',
              error
                ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-emerald-500/20',
              disabled && 'opacity-60 bg-slate-50 dark:bg-slate-800 cursor-not-allowed',
              className
            )}
            {...props}
          />

          {endIcon && (
            <div
              className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center w-5 h-5"
              aria-hidden="true"
            >
              {endIcon}
            </div>
          )}
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

Input.displayName = 'Input';

