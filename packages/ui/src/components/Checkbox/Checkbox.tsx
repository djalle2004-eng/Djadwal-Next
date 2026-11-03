import React, { forwardRef, useId } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, disabled, checked, defaultChecked, onChange, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          'inline-flex items-start cursor-pointer select-none group',
          disabled && 'cursor-not-allowed opacity-60',
          className
        )}
      >
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            disabled={disabled}
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={onChange}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              'w-5 h-5 rounded-md border transition-all duration-150 flex items-center justify-center',
              'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900',
              'peer-checked:bg-emerald-600 peer-checked:border-emerald-600 peer-checked:text-white',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2',
              'group-hover:border-slate-400 dark:group-hover:border-slate-500'
            )}
            aria-hidden="true"
          >
            <Check className="w-3.5 h-3.5 opacity-0 peer-checked:opacity-100 transition-opacity" />
          </div>
        </div>

        {(label || description) && (
          <div className="ms-2.5 text-start">
            {label && (
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                {label}
              </span>
            )}
            {description && (
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
