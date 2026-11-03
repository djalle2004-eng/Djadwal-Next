import React from 'react';
import { cn } from '../../utils/cn';

export function Table({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className={cn('w-full caption-bottom text-sm text-start', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableFooter({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot className={cn('border-t bg-slate-50/50 dark:bg-slate-800/50 font-medium', className)} {...props}>
      {children}
    </tfoot>
  );
}

export function TableRow({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/50 data-[state=selected]:bg-slate-100',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-11 px-4 text-start align-middle font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('p-4 align-middle text-start text-slate-700 dark:text-slate-200', className)} {...props}>
      {children}
    </td>
  );
}

