import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="مسار التنقل" className={cn('flex items-center text-xs text-slate-500 dark:text-slate-400', className)}>
      <ol className="inline-flex items-center gap-1.5 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1 || item.current;

          return (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              {index > 0 && (
                <ChevronLeft className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 rtl:rotate-0 ltr:rotate-180" aria-hidden="true" />
              )}
              {isLast ? (
                <span
                  className="font-bold text-slate-900 dark:text-slate-100"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <a
                  href={item.href}
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

