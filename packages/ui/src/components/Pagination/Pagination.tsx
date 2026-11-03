import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '../Button';
import { cn } from '../../utils/cn';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Generate page numbers with ellipsis
  const getPages = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <nav
      role="navigation"
      aria-label="تصفح الصفحات"
      className={cn('flex items-center justify-center gap-1.5', className)}
    >
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="الصفحة السابقة"
        className="px-2"
      >
        <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
      </Button>

      {getPages().map((p, idx) =>
        p === '...' ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 select-none">
            …
          </span>
        ) : (
          <Button
            key={`page-${p}`}
            variant={p === currentPage ? 'primary' : 'outline'}
            size="sm"
            onClick={() => onPageChange(Number(p))}
            aria-current={p === currentPage ? 'page' : undefined}
            className="w-8 h-8 p-0"
          >
            {p}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="الصفحة التالية"
        className="px-2"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
      </Button>
    </nav>
  );
}

