'use client';

import React, { useState, useMemo } from 'react';
import {
  Check,
  ChevronsUpDown,
  Search,
  X,
  Layers,
  Sparkles,
  Filter,
  CheckCheck,
  Plus
} from 'lucide-react';
import {
  OFFICIAL_SPECIALTIES,
  OFFICIAL_STUDY_LEVELS,
  type AcademicSpecialty
} from '@djadwal/core/constants/academic-specialties';

interface MultiSelectSpecialtiesProps {
  selected: string[];
  onChange: (specialties: string[]) => void;
  currentStudyLevel?: string;
  disabled?: boolean;
}

export default function MultiSelectSpecialties({
  selected = [],
  onChange,
  currentStudyLevel,
  disabled = false,
}: MultiSelectSpecialtiesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>(
    currentStudyLevel ? currentStudyLevel.toUpperCase().trim() : 'ALL'
  );

  // Normalize selected list
  const safeSelected = useMemo(() => {
    return Array.isArray(selected) ? selected.filter(Boolean) : [];
  }, [selected]);

  // Filter specialties based on search and level filter
  const filteredSpecialties = useMemo(() => {
    let list = OFFICIAL_SPECIALTIES;

    if (selectedLevelFilter && selectedLevelFilter !== 'ALL') {
      list = list.filter((s) => s.level === selectedLevelFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.department.toLowerCase().includes(q) ||
          s.level.toLowerCase().includes(q)
      );
    }

    return list;
  }, [selectedLevelFilter, searchQuery]);

  // Group filtered items by Department
  const groupedSpecialties = useMemo(() => {
    const map = new Map<string, AcademicSpecialty[]>();
    for (const item of filteredSpecialties) {
      const dept = item.department;
      if (!map.has(dept)) {
        map.set(dept, []);
      }
      map.get(dept)!.push(item);
    }
    return map;
  }, [filteredSpecialties]);

  const toggleSpecialty = (name: string) => {
    if (safeSelected.includes(name)) {
      onChange(safeSelected.filter((s) => s !== name));
    } else {
      onChange([...safeSelected, name]);
    }
  };

  const removeSpecialty = (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(safeSelected.filter((s) => s !== name));
  };

  const selectAllFiltered = () => {
    const toAdd = filteredSpecialties.map((s) => s.name);
    const set = new Set([...safeSelected, ...toAdd]);
    onChange(Array.from(set));
  };

  const deselectAllFiltered = () => {
    const toRemove = new Set(filteredSpecialties.map((s) => s.name));
    onChange(safeSelected.filter((s) => !toRemove.has(s)));
  };

  const handleAddCustom = () => {
    const custom = searchQuery.trim();
    if (!custom) return;
    if (!safeSelected.includes(custom)) {
      onChange([...safeSelected, custom]);
    }
    setSearchQuery('');
  };

  const levelColorMap: Record<string, string> = {
    L1: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    L2: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    L3: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    M1: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    M2: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  return (
    <div className="space-y-2 text-right">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-200">
          التخصصات والشعب المستهدفة بالمقياس <span className="text-rose-400">*</span>
        </label>
        <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
          تم تحديد: {safeSelected.length}
        </span>
      </div>

      {/* Selected Chips container */}
      {safeSelected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900/90 border border-slate-700/80 rounded-xl max-h-36 overflow-y-auto">
          {safeSelected.map((name) => {
            const specObj = OFFICIAL_SPECIALTIES.find((s) => s.name === name);
            const level = specObj?.level || 'عام';
            const badgeClass = levelColorMap[level] || 'bg-slate-700 text-slate-300 border-slate-600';
            return (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-100 border border-slate-700 shadow-sm transition-colors hover:border-slate-600"
              >
                <span className={`text-[10px] px-1 py-0.2 rounded border font-mono ${badgeClass}`}>
                  {level}
                </span>
                <span>{name}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => removeSpecialty(name, e)}
                    className="p-0.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700/80 transition-colors"
                    title="إزالة التخصص"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown Toggle Button */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-3 py-2.5 text-xs rounded-xl border transition-all text-right ${
            isOpen
              ? 'bg-slate-800/90 border-indigo-500 ring-2 ring-indigo-500/20 text-slate-100'
              : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-center gap-2 truncate">
            <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="truncate">
              {safeSelected.length === 0
                ? 'اضغط لاختيار تخصص واحد أو عدة تخصصات من القائمة المعتمدة (35 تخصصاً)...'
                : `تم تحديد (${safeSelected.length}) تخصصات - اضغط لتعديل الاختيار`}
            </span>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-slate-400 shrink-0 ms-2" />
        </button>

        {/* Dropdown Popover */}
        {isOpen && (
          <div className="absolute z-50 mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header: Level Filter Tabs & Search */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/60 space-y-2.5">
              {/* Level Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs scrollbar-none">
                <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0 me-1">
                  <Filter className="w-3 h-3" /> المستوى:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedLevelFilter('ALL')}
                  className={`px-2 py-0.5 rounded-md font-medium text-xs transition-colors shrink-0 ${
                    selectedLevelFilter === 'ALL'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  الكل
                </button>
                {OFFICIAL_STUDY_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedLevelFilter(lvl)}
                    className={`px-2 py-0.5 rounded-md font-mono text-xs transition-colors shrink-0 ${
                      selectedLevelFilter === lvl
                        ? 'bg-indigo-600 text-white font-bold ring-1 ring-indigo-400'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، القسم الأكاديمي، أو الطور (مثال: تسويق، L3، اقتصاد)..."
                  className="w-full pl-3 pr-9 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Actions (Select All / Clear) */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                <span>المعروض: {filteredSpecialties.length} تخصص</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" /> تحديد الظاهر
                  </button>
                  <span className="text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={deselectAllFiltered}
                    className="text-slate-400 hover:text-rose-400 font-medium hover:underline"
                  >
                    إلغاء تحديد الظاهر
                  </button>
                </div>
              </div>
            </div>

            {/* List of Specialties grouped by Department */}
            <div className="max-h-64 overflow-y-auto p-2 space-y-3 divide-y divide-slate-800/80">
              {groupedSpecialties.size === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-slate-400">لا توجد تخصصات رسمية تطابق البحث الحالي.</p>
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={handleAddCustom}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg hover:bg-indigo-600/50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة &quot;{searchQuery.trim()}&quot; كتخصص مخصص
                    </button>
                  )}
                </div>
              ) : (
                Array.from(groupedSpecialties.entries()).map(([deptName, items]) => (
                  <div key={deptName} className="pt-2 first:pt-0 space-y-1">
                    <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>{deptName}</span>
                      <span className="font-mono text-[10px] text-slate-500">({items.length})</span>
                    </div>

                    <div className="space-y-0.5">
                      {items.map((spec) => {
                        const isChecked = safeSelected.includes(spec.name);
                        const lvlClass = levelColorMap[spec.level] || 'bg-slate-700 text-slate-300 border-slate-600';
                        return (
                          <label
                            key={spec.name}
                            onClick={() => toggleSpecialty(spec.name)}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-indigo-950/40 border border-indigo-500/30 text-slate-100 font-medium'
                                : 'hover:bg-slate-800/70 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                  isChecked
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'border-slate-600 bg-slate-800 text-transparent'
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                              <span className="leading-tight">{spec.name}</span>
                            </div>

                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono border ${lvlClass}`}>
                              {spec.level}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer with Close Button */}
            <div className="p-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                إجمالي التخصصات المحددة: <strong className="text-slate-200">{safeSelected.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                تم وتأكيد الاختيار
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
