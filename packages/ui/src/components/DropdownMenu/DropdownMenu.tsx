import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

export function DropdownMenu({
  trigger,
  children,
  align = 'end',
  className,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative inline-block text-start">
      <div onClick={() => setIsOpen(!isOpen)} role="button" tabIndex={0} onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsOpen(!isOpen);
        }
      }}>
        {trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className={cn(
            'absolute mt-2 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-start',
            align === 'end' ? 'end-0' : 'start-0',
            className
          )}
        >
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, {
                onClick: (e: any) => {
                  child.props.onClick?.(e);
                  setIsOpen(false);
                },
              } as any);
            }
            return child;
          })}
        </div>
      )}
    </div>
  );
}

export interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  danger?: boolean;
}

export function DropdownMenuItem({
  className,
  icon,
  danger,
  children,
  ...props
}: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-start transition-colors select-none',
        danger
          ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
        className
      )}
      {...props}
    >
      {icon && <span className="w-4 h-4 shrink-0" aria-hidden="true">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" role="separator" />;
}
