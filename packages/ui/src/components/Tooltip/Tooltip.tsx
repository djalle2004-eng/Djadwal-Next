import React, { useState } from 'react';
import { cn } from '../../utils/cn';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'start' | 'end';
  className?: string;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const positionStyles = {
    top: 'bottom-full start-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full start-1/2 -translate-x-1/2 mt-2',
    start: 'top-1/2 end-full -translate-y-1/2 me-2',
    end: 'top-1/2 start-full -translate-y-1/2 ms-2',
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-50 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-slate-800 rounded-lg shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in duration-150',
            positionStyles[position],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

