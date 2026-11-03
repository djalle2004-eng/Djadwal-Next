import React, { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
  id?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      defaultChecked = false,
      onChange,
      disabled = false,
      label,
      description,
      className,
      id,
    },
    ref
  ) => {
    const generatedId = useId();
    const switchId = id || generatedId;
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked);

    const isControlled = checked !== undefined;
    const isChecked = isControlled ? checked : internalChecked;

    const handleToggle = () => {
      if (disabled) return;
      if (!isControlled) {
        setInternalChecked(!isChecked);
      }
      onChange?.(!isChecked);
    };

    return (
      <div className={cn('inline-flex items-center cursor-pointer select-none', disabled && 'cursor-not-allowed opacity-60', className)}>
        <button
          ref={ref}
          id={switchId}
          type="button"
          role="switch"
          aria-checked={isChecked}
          disabled={disabled}
          onClick={handleToggle}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              handleToggle();
            }
          }}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
            isChecked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
              isChecked
                ? 'ltr:translate-x-5 rtl:-translate-x-5'
                : 'translate-x-0'
            )}
          />
        </button>

        {(label || description) && (
          <label htmlFor={switchId} className="ms-3 text-start cursor-pointer">
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
          </label>
        )}
      </div>
    );
  }
);

Switch.displayName = 'Switch';

