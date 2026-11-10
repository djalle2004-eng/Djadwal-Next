'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Calendar,
  Clock,
  Users,
  DoorClosed,
  BookOpen,
  Printer,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Download,
  Copy,
  Check,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Dialog,
  DialogTitle,
  DialogDescription,
} from '@djadwal/ui';
import { api } from '@/lib/api';

// Days of the week (Saturday to Thursday)
const DAYS = [
  { id: 0, name: 'السبت' },
  { id: 1, name: 'الأحد' },
  { id: 2, name: 'الاثنين' },
  { id: 3, name: 'الثلاثاء' },
  { id: 4, name: 'الأربعاء' },
  { id: 5, name: 'الخميس' },
];

// 6 standard educational slots
const TIME_SLOTS = [
  { id: 0, start: '08:00', end: '09:30', label: '08:00 - 09:30' },
  { id: 1, start: '09:35', end: '11:05', label: '09:35 - 11:05' },
  { id: 2, start: '11:10', end: '12:40', label: '11:10 - 12:40' },
  { id: 3, start: '13:00', end: '14:30', label: '13:00 - 14:30' },
  { id: 4, start: '14:35', end: '16:05', label: '14:35 - 16:05' },
  { id: 5, start: '16:10', end: '17:40', label: '16:10 - 17:40' },
];

interface Assignment {
  id: number;
  course_id?: number;
  course_name?: string;
  professor_id?: number;
  professor_name?: string;
  room_id?: number;
  room_name?: string;
  group_id?: number;
  group_name?: string;
  day_of_week: number | string;
  start_time: string;
  end_time: string;
  session_type?: string;
  academic_year?: string;
  semester?: string;
  specialization?: string;
  version?: number;
}

interface Group {
  id: number;
  name: string;
  year?: string;
  specialization?: string;
  department_id?: number;
  department_name?: string;
  group_type?: string;
}

// Convert day representation to integer 0..6
function normalizeDay(day: number | string): number {
  if (typeof day === 'number') return day;
  if (!day) return -1;
  const map: Record<string, number> = {
    'السبت': 0, 'الأحد': 1, 'الاثنين': 2, 'الإثنين': 2, 'الثلاثاء': 3, 'الأربعاء': 4, 'الخميس': 5, 'الجمعة': 6
  };
  if (day in map) return map[day];
  const parsed = parseInt(day, 10);
  return isNaN(parsed) ? -1 : parsed;
}

// Check if session start time matches slot
function matchesSlot(sessionStart: string, slotStart: string, slotEnd: string): boolean {
  if (!sessionStart) return false;
  const toMin = (t: string) => {
    const parts = t.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
  };
  const sStart = toMin(sessionStart);
  const slStart = toMin(slotStart);
  const slEnd = toMin(slotEnd);
  return Math.abs(sStart - slStart) <= 15 || (sStart >= slStart && sStart < slEnd);
}

export default function GroupSchedulesPage() {
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState('السداسي الأول');

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [professors, setProfessors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('all');
  const [selectedYearLevel, setSelectedYearLevel] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'single' | 'matrix'>('single');

  // Interactive Session Detail Modal
  const [activeSession, setActiveSession] = useState<Assignment | null>(null);

  // Print Mode State
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [printScope, setPrintScope] = useState<'current_group' | 'all_specialization'>('current_group');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [assignData, groupsData, profsData, roomsData] = await Promise.all([
        api.get(`/assignments?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&limit=2000`),
        api.get('/groups?limit=500'),
        api.get('/professors?limit=500'),
        api.get('/rooms?limit=500'),
      ]);

      if (Array.isArray(assignData)) setAssignments(assignData);
      if (Array.isArray(groupsData)) setGroups(groupsData);
      if (Array.isArray(profsData)) setProfessors(profsData);
      if (Array.isArray(roomsData)) setRooms(roomsData);
    } catch (err: any) {
      console.error('Failed to load group schedules data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [academicYear, semester]);

  // Derived Specializations List
  const specializations = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => {
      if (g.specialization && g.specialization.trim()) {
        set.add(g.specialization.trim());
      }
    });
    return Array.from(set).sort();
  }, [groups]);

  // Derived Year Levels (L1, L2, L3, M1, M2...)
  const yearLevels = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => {
      if (g.year && g.year.trim()) {
        set.add(g.year.trim());
      }
    });
    return Array.from(set).sort();
  }, [groups]);

  // Groups matching current specialization & level filter
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchesSpec = selectedSpecialization === 'all' || g.specialization === selectedSpecialization;
      const matchesLevel = selectedYearLevel === 'all' || g.year === selectedYearLevel;
      return matchesSpec && matchesLevel;
    });
  }, [groups, selectedSpecialization, selectedYearLevel]);

  // Auto-select first group when filter changes
  useEffect(() => {
    if (filteredGroups.length > 0) {
      const currentExists = filteredGroups.some((g) => String(g.id) === selectedGroupId);
      if (!currentExists && selectedGroupId !== 'all') {
        setSelectedGroupId(String(filteredGroups[0].id));
      }
    }
  }, [filteredGroups, selectedGroupId]);

  // Current active group object
  const currentGroup = useMemo(() => {
    return groups.find((g) => String(g.id) === selectedGroupId);
  }, [groups, selectedGroupId]);

  // Assignments for a specific group
  const getGroupAssignments = (groupId: number) => {
    return assignments.filter((a) => a.group_id === groupId);
  };

  // Find assignments for a specific group, day, and slot
  const getCellAssignments = (groupId: number, dayId: number, slot: typeof TIME_SLOTS[0]) => {
    return assignments.filter((a) => {
      if (a.group_id !== groupId) return false;
      const dayNum = normalizeDay(a.day_of_week);
      if (dayNum !== dayId) return false;
      return matchesSlot(a.start_time, slot.start, slot.end);
    });
  };

  // Groups to render in Print or Matrix View
  const targetGroupsForPrint = useMemo(() => {
    if (printScope === 'current_group' && currentGroup) {
      return [currentGroup];
    }
    return filteredGroups;
  }, [printScope, currentGroup, filteredGroups]);

  // Trigger Native Browser Print
  const handlePrint = () => {
    setIsPrintDialogOpen(true);
  };

  const executePrint = () => {
    window.print();
  };

  // Copy schedule info to clipboard
  const handleCopySummary = () => {
    if (!currentGroup) return;
    const groupAssigns = getGroupAssignments(currentGroup.id);
    const summary = `الجدول الزمني لفوج ${currentGroup.name} (${currentGroup.specialization || ''} - ${academicYear} / ${semester}):\n` +
      groupAssigns.map((a) => `- ${DAYS.find((d) => d.id === normalizeDay(a.day_of_week))?.name || 'يوم'}: ${a.start_time}-${a.end_time} | ${a.course_name} (${a.professor_name || 'أستاذ غير محدد'}) - ${a.room_name || 'قاعة غير محددة'}`).join('\n');
    navigator.clipboard.writeText(summary);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">جداول التوقيت للأفواج والدفعات</h1>
            <p className="text-sm text-slate-500">
              إدارة واستعراض وطباعة الجداول الزمنية لكافة أفواج الكلية ({academicYear} - {semester})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Fast Switcher to Legacy */}
          <a
            href="/legacy/group-schedules"
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            title="فتح شاشة جداول الأفواج في الواجهة الكلاسيكية القديمة"
          >
            <Sparkles className="w-4 h-4" />
            <span>الواجهة المعتمدة (Legacy)</span>
          </a>

          {/* Quick Print Button */}
          <Button
            variant="primary"
            size="md"
            onClick={handlePrint}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الجدول (A4 أفقي)</span>
          </Button>

          {/* Refresh */}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Filters & View Mode Selector */}
      <Card className="no-print border-slate-200 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Year Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">السنة الجامعية</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="2026-2027">2026-2027 (الحالية)</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2024-2025">2024-2025</option>
              </select>
            </div>

            {/* Semester Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">السداسي / الفصل</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="السداسي الأول">السداسي الأول</option>
                <option value="السداسي الثاني">السداسي الثاني</option>
              </select>
            </div>

            {/* Specialization Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">التخصص الأكاديمي</label>
              <select
                value={selectedSpecialization}
                onChange={(e) => setSelectedSpecialization(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">كافة التخصصات ({specializations.length})</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Level Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">المستوى الدراسي</label>
              <select
                value={selectedYearLevel}
                onChange={(e) => setSelectedYearLevel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">كافة المستويات ({yearLevels.length})</option>
                {yearLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* Group Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">الفوج الدراسي</label>
              <select
                value={selectedGroupId}
                onChange={(e) => {
                  setSelectedGroupId(e.target.value);
                  if (e.target.value !== 'all') {
                    setViewMode('single');
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">مقارنة كافة الأفواج (مصفوفة)</option>
                {filteredGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.specialization ? `(${g.specialization})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">طريقة العرض:</span>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setViewMode('single')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    viewMode === 'single'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  جدول فوج فردي
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('matrix')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    viewMode === 'matrix'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  مصفوفة أفواج التخصص جنبًا إلى جنب ({filteredGroups.length} أفواج)
                </button>
              </div>
            </div>

            {/* Quick Summary Badges */}
            <div className="flex items-center gap-2">
              <Badge variant="neutral" className="gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>إجمالي الأفواج: {filteredGroups.length}</span>
              </Badge>
              {currentGroup && viewMode === 'single' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySummary}
                  className="gap-1.5 text-xs text-slate-600"
                >
                  {copiedNotification ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ ملخص الجدول</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Main Timetable Views */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500 font-medium">جاري استرجاع جداول الأفواج وحصص التوزيع...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200 text-center">
          <Users className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-800">لا توجد أفواج مطابقة للفلتر المحدد</h3>
          <p className="text-sm text-slate-500 mt-1">يرجى تعديل خيارات التخصص أو المستوى الدراسي للاستعراض.</p>
        </div>
      ) : viewMode === 'single' && currentGroup ? (
        /* SINGLE GROUP SCHEDULE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Group Header Card */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="warning" className="text-xs bg-amber-400 text-slate-900 font-bold">
                  {currentGroup.year || 'ليسانس'}
                </Badge>
                <h2 className="text-xl font-bold">{currentGroup.name}</h2>
              </div>
              <p className="text-xs text-blue-200 mt-1">
                التخصص: <span className="font-semibold text-white">{currentGroup.specialization || 'جذع مشترك'}</span> | 
                القسم: <span className="font-semibold text-white">{currentGroup.department_name || 'العلوم الاقتصادية'}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPrintScope('current_group');
                  setIsPrintDialogOpen(true);
                }}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5 text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>معاينة الطباعة للفوج</span>
              </Button>
            </div>
          </div>

          {/* Timetable Grid */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[850px] text-right">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 text-xs font-bold">
                  <th className="py-3.5 px-4 border-l border-slate-200 w-28 text-center bg-slate-200/60">
                    اليوم / التوقيت
                  </th>
                  {TIME_SLOTS.map((slot) => (
                    <th key={slot.id} className="py-3.5 px-3 border-l border-slate-200 text-center font-bold">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-slate-800">{slot.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {DAYS.map((day) => (
                  <tr key={day.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 border-l border-slate-200 bg-slate-50 text-center align-middle">
                      {day.name}
                    </td>
                    {TIME_SLOTS.map((slot) => {
                      const cellSessions = getCellAssignments(currentGroup.id, day.id, slot);
                      return (
                        <td
                          key={slot.id}
                          className="p-1.5 border-l border-slate-200 align-top h-[95px] w-[150px] relative hover:bg-blue-50/20 transition-colors"
                        >
                          {cellSessions.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-300 font-light select-none">
                              —
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {cellSessions.map((session) => {
                                const isLecture =
                                  session.session_type === 'cours' ||
                                  (session.group_name && session.group_name.includes('محاضرة'));
                                const isTD =
                                  session.session_type === 'td' ||
                                  (session.group_name && session.group_name.includes('TD'));

                                return (
                                  <div
                                    key={session.id}
                                    onClick={() => setActiveSession(session)}
                                    className={`p-2 rounded-xl border text-xs cursor-pointer transition-all shadow-sm ${
                                      isLecture
                                        ? 'bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-900'
                                        : isTD
                                        ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 text-emerald-900'
                                        : 'bg-purple-50 border-purple-200 hover:border-purple-300 text-purple-900'
                                    }`}
                                  >
                                    <div className="font-bold truncate" title={session.course_name}>
                                      {session.course_name || 'مقياس'}
                                    </div>
                                    <div className="text-[11px] text-slate-600 truncate mt-0.5">
                                      {session.professor_name || 'غير محدد'}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-200/50">
                                      <span className="font-semibold text-slate-700">
                                        {isLecture ? 'محاضرة' : 'أعمال موجهة'}
                                      </span>
                                      <span className="bg-white/90 px-1.5 py-0.2 rounded font-mono font-bold text-slate-800">
                                        {session.room_name || '—'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MULTI-GROUP COMPARISON MATRIX VIEW */
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                مصفوفة مقارنة كافة أفواج التخصص ({filteredGroups.length} أفواج)
              </h3>
              <p className="text-xs text-slate-500">
                استعراض جداول التوقيت جنباً إلى جنب للتحقق من توافق المحاضرات المشتركة وتوزيع حصص الأعمال الموجهة.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPrintScope('all_specialization');
                setIsPrintDialogOpen(true);
              }}
              className="gap-1.5 text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة كافة الأفواج دفعة واحدة (Bulk Print)</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredGroups.map((grp) => {
              const grpAssigns = getGroupAssignments(grp.id);
              return (
                <div key={grp.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{grp.name}</span>
                      <span className="text-xs text-slate-500 font-medium">({grp.specialization || 'عام'})</span>
                      <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                        {grpAssigns.length} حصص
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedGroupId(String(grp.id));
                        setViewMode('single');
                      }}
                      className="text-xs py-1 px-2.5 h-auto text-blue-700 hover:text-blue-800"
                    >
                      <Eye className="w-3.5 h-3.5 ml-1" />
                      عرض منفرد
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[700px] text-right text-xs">
                      <thead>
                        <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-600 text-[11px]">
                          <th className="py-2 px-3 border-l border-slate-200 w-24 text-center font-bold">اليوم</th>
                          {TIME_SLOTS.map((s) => (
                            <th key={s.id} className="py-2 px-2 border-l border-slate-200 text-center font-semibold">
                              {s.start} - {s.end}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {DAYS.map((day) => (
                          <tr key={day.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-semibold text-slate-800 border-l border-slate-200 text-center bg-slate-50/60">
                              {day.name}
                            </td>
                            {TIME_SLOTS.map((slot) => {
                              const cellSessions = getCellAssignments(grp.id, day.id, slot);
                              return (
                                <td
                                  key={slot.id}
                                  className="p-1 border-l border-slate-200 align-top h-[70px] w-[140px]"
                                >
                                  {cellSessions.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-slate-300 font-light">
                                      —
                                    </div>
                                  ) : (
                                    cellSessions.map((s) => {
                                      const isLecture =
                                        s.session_type === 'cours' ||
                                        (s.group_name && s.group_name.includes('محاضرة'));
                                      return (
                                        <div
                                          key={s.id}
                                          onClick={() => setActiveSession(s)}
                                          className={`p-1.5 rounded-lg border text-[11px] cursor-pointer ${
                                            isLecture
                                              ? 'bg-blue-50 border-blue-200 text-blue-900'
                                              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                          }`}
                                        >
                                          <div className="font-bold truncate">{s.course_name}</div>
                                          <div className="text-[10px] text-slate-600 truncate">{s.professor_name}</div>
                                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">{s.room_name}</div>
                                        </div>
                                      );
                                    })
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Session Details Dialog */}
      <Dialog open={!!activeSession} onClose={() => setActiveSession(null)} size="md">
        {activeSession && (
          <div className="p-6 space-y-4 max-w-md w-full bg-white rounded-2xl">
            <DialogTitle className="text-lg font-bold text-slate-900 border-b pb-3 flex items-center justify-between">
              <span>تفاصيل الحصة الدراسية</span>
              <Badge variant={activeSession.session_type === 'cours' ? 'info' : 'success'}>
                {activeSession.session_type === 'cours' ? 'محاضرة (Cours)' : 'أعمال موجهة (TD)'}
              </Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">
              معاينة تفاصيل الحصة والمقرر والأستاذ والقاعة
            </DialogDescription>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl">
                <BookOpen className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="text-xs text-slate-500">المقياس / المقرر</div>
                  <div className="font-bold text-slate-800">{activeSession.course_name || 'غير محدد'}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl">
                <Users className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="text-xs text-slate-500">الأستاذ المحاضر</div>
                  <div className="font-bold text-slate-800">{activeSession.professor_name || 'غير محدد'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-xs text-slate-500">الفوج</div>
                  <div className="font-bold text-slate-800">{activeSession.group_name || '—'}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-xs text-slate-500">القاعة / المدرج</div>
                  <div className="font-bold text-slate-800">{activeSession.room_name || '—'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-xs text-slate-500">اليوم</div>
                  <div className="font-bold text-slate-800">
                    {DAYS.find((d) => d.id === normalizeDay(activeSession.day_of_week))?.name || 'غير محدد'}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-xs text-slate-500">التوقيت</div>
                  <div className="font-bold text-slate-800 font-mono">
                    {activeSession.start_time} - {activeSession.end_time}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setActiveSession(null)}>
                إغلاق
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* 5. Official College A4 Landscape Print Engine Modal */}
      <Dialog open={isPrintDialogOpen} onClose={() => setIsPrintDialogOpen(false)} size="full">
        <div className="p-6 space-y-6 max-w-5xl w-full bg-white rounded-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b pb-4">
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              <span>معاينة الطباعة الرسمية للكلية (A4 أفقي - Landscape)</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              معاينة جداول الأفواج بتنسيق الطباعة الجامعية الرسمية
            </DialogDescription>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={executePrint}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer className="w-4 h-4" />
                <span>إرسال إلى الطابعة الآن</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsPrintDialogOpen(false)}>
                إغلاق
              </Button>
            </div>
          </div>

          {/* Scope Controls */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-xl text-xs font-semibold text-slate-700 border">
            <span>نطاق الطباعة:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="printScope"
                checked={printScope === 'current_group'}
                onChange={() => setPrintScope('current_group')}
                className="text-blue-600"
              />
              <span>الفوج المحدد حالياً فقط ({currentGroup?.name || 'فوج واحد'})</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="printScope"
                checked={printScope === 'all_specialization'}
                onChange={() => setPrintScope('all_specialization')}
                className="text-blue-600"
              />
              <span>طباعة كافة أفواج التخصص دفعة واحدة ({filteredGroups.length} صفحة A4 منفصلة)</span>
            </label>
          </div>

          {/* PRINTABLE SHEETS CONTAINER */}
          <div className="space-y-12 print-content bg-white p-2">
            {targetGroupsForPrint.map((grp, index) => (
              <div
                key={grp.id}
                className={`p-6 border border-slate-300 rounded-xl bg-white text-slate-900 ${
                  index > 0 ? 'print:break-before-page' : ''
                }`}
                style={{ breakAfter: index < targetGroupsForPrint.length - 1 ? 'page' : 'auto' }}
              >
                {/* Official Algerian Republic & University Header */}
                <div className="text-center border-b pb-3 mb-4">
                  <h2 className="font-bold text-sm tracking-wide">الجمهورية الجزائرية الديمقراطية الشعبية</h2>
                  <h3 className="font-bold text-xs mt-0.5">وزارة التعليم العالي والبحث العلمي</h3>
                  <h4 className="font-semibold text-xs mt-0.5">جامعة الشهيد حمه لخضر - الوادي</h4>
                  <h5 className="text-xs text-slate-700 mt-0.5 font-medium">كلية العلوم الاقتصادية والتجارية وعلوم التسيير</h5>
                  <div className="text-[11px] text-slate-600 mt-1 font-mono">
                    السنة الجامعية: {academicYear} | {semester}
                  </div>
                </div>

                {/* Document Title & Group Meta */}
                <div className="text-center my-3">
                  <h3 className="text-base font-extrabold text-blue-950 inline-block border-b-2 border-blue-900 pb-0.5">
                    الجدول الزمني لتوزيع المحاضرات والأعمال الموجهة
                  </h3>
                  <div className="mt-2 text-xs flex justify-center items-center gap-6 text-slate-800">
                    <div>الفوج: <strong className="text-sm font-bold text-blue-900">{grp.name}</strong></div>
                    <div>المستوى: <strong>{grp.year || 'ليسانس'}</strong></div>
                    <div>التخصص: <strong>{grp.specialization || 'جذع مشترك'}</strong></div>
                  </div>
                </div>

                {/* Printable Table Grid */}
                <div className="mt-4">
                  <table className="w-full border-collapse text-center text-xs" style={{ border: '2px solid #333' }}>
                    <thead>
                      <tr className="bg-slate-200">
                        <th className="py-2.5 px-3 border border-slate-700 w-24 font-bold text-slate-900">
                          اليوم / التوقيت
                        </th>
                        {TIME_SLOTS.map((s) => (
                          <th key={s.id} className="py-2 px-2 border border-slate-700 font-bold text-slate-900 text-xs">
                            {s.start} - {s.end}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((day) => (
                        <tr key={day.id} className="border border-slate-700">
                          <td className="py-3 px-3 font-bold border border-slate-700 bg-slate-100 text-slate-900">
                            {day.name}
                          </td>
                          {TIME_SLOTS.map((slot) => {
                            const cellSessions = getCellAssignments(grp.id, day.id, slot);
                            return (
                              <td
                                key={slot.id}
                                className="p-1.5 border border-slate-700 h-[68px] align-middle"
                              >
                                {cellSessions.length === 0 ? (
                                  <span className="text-slate-400 font-light">—</span>
                                ) : (
                                  cellSessions.map((s) => {
                                    const isLecture =
                                      s.session_type === 'cours' ||
                                      (s.group_name && s.group_name.includes('محاضرة'));
                                    return (
                                      <div key={s.id} className="text-[11px] leading-tight">
                                        <div className="font-extrabold text-slate-900">{s.course_name}</div>
                                        <div className="text-[10px] text-slate-700 font-medium mt-0.5">{s.professor_name}</div>
                                        <div className="text-[9px] font-mono font-bold text-blue-900 mt-0.5">
                                          {isLecture ? 'محاضرة' : 'TD'} | {s.room_name || 'قاعة'}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Official Signatures Block */}
                <div className="grid grid-cols-2 gap-8 pt-8 mt-4 text-center text-xs font-bold text-slate-800">
                  <div>
                    <span>تأشيرة رئيس القسم</span>
                    <div className="h-16 mt-2 border-b border-dashed border-slate-400"></div>
                  </div>
                  <div>
                    <span>مصادقة عميد الكلية</span>
                    <div className="h-16 mt-2 border-b border-dashed border-slate-400"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
