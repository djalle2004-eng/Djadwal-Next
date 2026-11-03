import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../Table';
import { Input } from '../Input';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { cn } from '../../utils/cn';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

export interface DataGridProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

export function DataGrid<T extends Record<string, any>>({
  columns,
  data,
  pageSize = 10,
  searchable = true,
  searchPlaceholder = 'بحث في الجدول...',
  className,
}: DataGridProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // 1. Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const query = searchTerm.toLowerCase();
    return data.filter((item) =>
      columns.some((col) => {
        const val = item[col.key as keyof T];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(query);
      })
    );
  }, [data, searchTerm, columns]);

  // 2. Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      return sortDirection === 'asc'
        ? String(valA).localeCompare(String(valB), 'ar')
        : String(valB).localeCompare(String(valA), 'ar');
    });
  }, [filteredData, sortKey, sortDirection]);

  // 3. Paginate
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return (
    <div className={cn('space-y-4 text-start', className)}>
      {searchable && (
        <div className="flex items-center justify-between gap-4">
          <div className="max-w-xs w-full">
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              startIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            إجمالي السجلات: <strong className="text-slate-800 dark:text-slate-200">{filteredData.length}</strong>
          </div>
        </div>
      )}

      {paginatedData.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات مطابقة"
          description="لم يتم العثور على أي نتائج تطابق معايير البحث الحالية."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => {
                const keyStr = String(col.key);
                const isSorted = sortKey === keyStr;
                return (
                  <TableHead
                    key={keyStr}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.sortable !== false ? (
                      <button
                        type="button"
                        onClick={() => handleSort(keyStr)}
                        className="inline-flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded px-1 -mx-1"
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, idx) => (
              <TableRow key={row.id || idx}>
                {columns.map((col) => (
                  <TableCell key={String(col.key)}>
                    {col.render ? col.render(row) : String(row[col.key as keyof T] ?? '—')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            الصفحة {currentPage} من {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              startIcon={<ChevronRight className="w-4 h-4 rtl:rotate-180" />}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              endIcon={<ChevronLeft className="w-4 h-4 rtl:rotate-180" />}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

