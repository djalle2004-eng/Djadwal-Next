'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, User, Check, X, ChevronDown, Sparkles } from 'lucide-react';

export interface ProfessorOption {
  id: number;
  name: string;
  title?: string;
  department_id?: number;
  department_name?: string;
}

export interface ProfessorComboboxProps {
  professors: ProfessorOption[];
  value: number | '';
  onChange: (id: number | '') => void;
  placeholder?: string;
  allowAll?: boolean;
  allLabel?: string;
  label?: string;
  required?: boolean;
  extraSessionsCountMap?: Map<number, number>;
  disabled?: boolean;
  className?: string;
}

function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .toLowerCase()
    .trim();
}

export function ProfessorCombobox({
  professors,
  value,
  onChange,
  placeholder = 'ابحث باسم الأستاذ...',
  allowAll = false,
  allLabel = 'جميع الأساتذة',
  label,
  required = false,
  extraSessionsCountMap,
  disabled = false,
  className = '',
}: ProfessorComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find currently selected professor
  const selectedProfessor = useMemo(() => {
    if (!value) return null;
    return professors.find((p) => p.id === Number(value)) || null;
  }, [value, professors]);

  // Sync display search term when value changes from outside
  useEffect(() => {
    if (selectedProfessor) {
      setSearchTerm(selectedProfessor.name);
    } else if (!value) {
      setSearchTerm('');
    }
  }, [selectedProfessor, value]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // If nothing was selected or user cleared search without choosing, reset display
        if (selectedProfessor) {
          setSearchTerm(selectedProfessor.name);
        } else {
          setSearchTerm('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedProfessor]);

  // Filtered professors list based on search term
  const filteredProfessors = useMemo(() => {
    if (!searchTerm.trim()) {
      return professors;
    }
    // If the input exactly matches the selected professor's name and dropdown was just opened, show all
    if (selectedProfessor && searchTerm.trim() === selectedProfessor.name.trim()) {
      return professors;
    }

    const normQuery = normalizeArabic(searchTerm);
    return professors.filter((p) => {
      const normName = normalizeArabic(p.name);
      const normTitle = p.title ? normalizeArabic(p.title) : '';
      return normName.includes(normQuery) || normTitle.includes(normQuery);
    });
  }, [professors, searchTerm, selectedProfessor]);

  const handleSelect = (id: number | '') => {
    onChange(id);
    setIsOpen(false);
    if (!id) {
      setSearchTerm('');
    } else {
      const prof = professors.find((p) => p.id === id);
      if (prof) setSearchTerm(prof.name);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Input Box */}
      <div className="relative">
        <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
          <Search className="w-4 h-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedProfessor ? selectedProfessor.name : placeholder}
          className="w-full py-2 pr-9 pl-14 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 dark:focus:border-emerald-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-medium transition-colors"
        />

        {/* Clear & Dropdown Toggle Actions */}
        <div className="absolute left-2.5 top-2 flex items-center gap-1">
          {(value !== '' || searchTerm !== '') && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="إلغاء التحديد"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="تبديل القائمة"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 animate-in fade-in-50 zoom-in-95 duration-150">
          {allowAll && (
            <div
              onClick={() => handleSelect('')}
              className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                value === ''
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>{allLabel}</span>
              </div>
              {value === '' && <Check className="w-4 h-4 text-emerald-600" />}
            </div>
          )}

          {filteredProfessors.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400 dark:text-slate-500">
              لا يوجد أي أستاذ يطابق «{searchTerm}»
            </div>
          ) : (
            filteredProfessors.map((p) => {
              const isSelected = value === p.id;
              const sessionCount = extraSessionsCountMap?.get(p.id) || 0;

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelect(p.id)}
                  className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1 rounded-md shrink-0 ${isSelected ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-semibold truncate">{p.name}</div>
                      {p.title && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-normal">
                          {p.title}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pr-2">
                    {sessionCount > 0 && (
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold px-1.5 py-0.5 rounded-full">
                        {sessionCount} حصة
                      </span>
                    )}
                    {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
