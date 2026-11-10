'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Filter,
  Users,
  DoorClosed,
  GraduationCap,
  RefreshCw,
  Search,
  BookOpen,
  Printer,
  Sparkles,
  CalendarDays,
  Layers,
  Building2,
  Copy,
  Check,
  Eye,
  AlertCircle,
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

export default function SchedulePage() {
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState('السداسي الأول');

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [professors, setProfessors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<'group' | 'professor' | 'room' | 'all'>('group');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('all');
  const [selectedYearLevel, setSelectedYearLevel] = useState<string>('all');
  const [selectedDayId, setSelectedDayId] = useState<string>('all');

  // Details Modal
  const [activeSession, setActiveSession] = useState<Assignment | null>(null);

  // Print Modal
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        api.get(`/assignments?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&limit=2000`),
        api.get('/groups?limit=500'),
        api.get('/professors?limit=500'),
        api.get('/rooms?limit=500'),
      ]);

      const [assignRes, groupsRes, profsRes, roomsRes] = results;

      if (assignRes.status === 'fulfilled' && Array.isArray(assignRes.value)) {
        setAssignments(assignRes.value);
      }
      if (groupsRes.status === 'fulfilled' && Array.isArray(groupsRes.value)) {
        setGroups(groupsRes.value);
      }
      if (profsRes.status === 'fulfilled' && Array.isArray(profsRes.value)) {
        setProfessors(profsRes.value);
      }
      if (roomsRes.status === 'fulfilled' && Array.isArray(roomsRes.value)) {
        setRooms(roomsRes.value);
      }

      // Check if critical calls failed
      if (assignRes.status === 'rejected' || groupsRes.status === 'rejected') {
        const firstErr: any = assignRes.status === 'rejected' ? assignRes.reason : (groupsRes as any).reason;
        setError(firstErr?.messageAr || firstErr?.message || 'تعذر جلب بيانات الجدول الزمني من الخادم.');
      }
    } catch (err: any) {
      console.error('Failed to load schedule data:', err);
      setError(err?.messageAr || err?.message || 'تعذر الاتصال بالخادم.');
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

  // Filtered groups according to specialization & level
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchesSpec = selectedSpecialization === 'all' || g.specialization === selectedSpecialization;
      const matchesLevel = selectedYearLevel === 'all' || g.year === selectedYearLevel;
      return matchesSpec && matchesLevel;
    });
  }, [groups, selectedSpecialization, selectedYearLevel]);

  // Filtered assignments based on current selection
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // Day filter
      if (selectedDayId !== 'all') {
        const dayNum = normalizeDay(a.day_of_week);
        if (dayNum !== Number(selectedDayId)) return false;
      }

      // Entity filter
      if (filterType === 'all') return true;

      if (selectedEntityId === 'all') {
        if (filterType === 'group' && selectedSpecialization !== 'all') {
          const group = groups.find((g) => g.id === a.group_id);
          return group && group.specialization === selectedSpecialization;
        }
        return true;
      }

      const entityId = Number(selectedEntityId);
      if (filterType === 'group') return a.group_id === entityId;
      if (filterType === 'professor') return a.professor_id === entityId;
      if (filterType === 'room') return a.room_id === entityId;
      return true;
    });
  }, [assignments, filterType, selectedEntityId, selectedDayId, selectedSpecialization, groups]);

  // Find assignments for a specific day and time slot
  const getCellAssignments = (dayId: number, slot: typeof TIME_SLOTS[0]) => {
    return filteredAssignments.filter((a) => {
      const dayNum = normalizeDay(a.day_of_week);
      if (dayNum !== dayId) return false;
      return matchesSlot(a.start_time, slot.start, slot.end);
    });
  };

  // Selected Entity Name for Header / Print
  const currentEntityName = useMemo(() => {
    if (filterType === 'all' || selectedEntityId === 'all') {
      if (filterType === 'group' && selectedSpecialization !== 'all') {
        return `تخصص: ${selectedSpecialization}`;
      }
      return 'العرض الشامل لكافة الأقسام';
    }
    const id = Number(selectedEntityId);
    if (filterType === 'group') {
      const g = groups.find((item) => item.id === id);
      return g ? `الفوج: ${g.name} (${g.specialization || ''})` : 'فوج غير محدد';
    }
    if (filterType === 'professor') {
      const p = professors.find((item) => item.id === id);
      return p ? `الأستاذ: ${p.name}` : 'أستاذ غير محدد';
    }
    if (filterType === 'room') {
      const r = rooms.find((item) => item.id === id);
      return r ? `القاعة: ${r.name}` : 'قاعة غير محددة';
    }
    return '';
  }, [filterType, selectedEntityId, selectedSpecialization, groups, professors, rooms]);

  const handlePrint = () => {
    setIsPrintDialogOpen(true);
  };

  const executePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const summary = `جدول التوقيت (${currentEntityName} - ${academicYear} / ${semester}):\n` +
      filteredAssignments.map((a) => `- ${DAYS.find((d) => d.id === normalizeDay(a.day_of_week))?.name || 'يوم'}: ${a.start_time}-${a.end_time} | ${a.course_name} (${a.professor_name || ''}) - ${a.room_name || ''} [${a.group_name || ''}]`).join('\n');
    navigator.clipboard.writeText(summary);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">جدول التوقيت الأسبوعي (Weekly Timetable)</h1>
            <p className="text-sm text-slate-500">
              استعراض وتوزيع الحصص، القاعات والأساتذة ({academicYear} - {semester})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick link to Groups Schedules */}
          <Link
            href="/groups/schedules"
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-semibold transition-colors border border-indigo-200 shadow-sm"
          >
            <CalendarDays className="w-4 h-4 text-indigo-600" />
            <span>جداول الأفواج المتعددة والمقارنة</span>
          </Link>

          {/* Fast Switcher to Legacy Schedule */}
          <a
            href="/legacy/schedule"
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            title="فتح جدول التوقيت الكامل في الواجهة الكلاسيكية المعتمدة"
          >
            <Sparkles className="w-4 h-4" />
            <span>الواجهة المعتمدة (Legacy)</span>
          </a>

          {/* Print Button */}
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

      {/* Backend connection error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start justify-between gap-4 text-red-900 no-print">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">تعذر الاتصال بالخادم لجلب بيانات الجدول</h4>
              <p className="text-xs text-red-700 mt-1">{error}</p>
              <p className="text-xs text-red-600 mt-1">
                تأكد من تشغيل خادم Node.js على المنفذ 3001 عبر تشغيل: <code className="bg-red-100 px-1 py-0.5 rounded font-mono font-bold">npm run dev</code> في المجلد الرئيسي.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="border-red-300 text-red-700 hover:bg-red-100 shrink-0"
          >
            إعادة المحاولة
          </Button>
        </div>
      )}

      {/* 2. Control Bar: Advanced Filters & Entity Switcher */}
      <Card className="no-print border-slate-200 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Year Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">السنة الجامعية</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="السداسي الأول">السداسي الأول</option>
                <option value="السداسي الثاني">السداسي الثاني</option>
              </select>
            </div>

            {/* View By Entity Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">نوع العرض</label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('group');
                    setSelectedEntityId('all');
                  }}
                  className={`py-1.5 rounded-lg transition-all ${
                    filterType === 'group' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  أفواج
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('professor');
                    setSelectedEntityId('all');
                  }}
                  className={`py-1.5 rounded-lg transition-all ${
                    filterType === 'professor' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  أساتذة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('room');
                    setSelectedEntityId('all');
                  }}
                  className={`py-1.5 rounded-lg transition-all ${
                    filterType === 'room' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  قاعات
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('all');
                    setSelectedEntityId('all');
                  }}
                  className={`py-1.5 rounded-lg transition-all ${
                    filterType === 'all' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  شامل
                </button>
              </div>
            </div>

            {/* Entity Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                {filterType === 'group'
                  ? 'اختر الفوج'
                  : filterType === 'professor'
                  ? 'اختر الأستاذ'
                  : filterType === 'room'
                  ? 'اختر القاعة'
                  : 'العرض الشامل'}
              </label>
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                disabled={filterType === 'all'}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="all">
                  {filterType === 'group'
                    ? 'جميع الأفواج'
                    : filterType === 'professor'
                    ? 'جميع الأساتذة'
                    : filterType === 'room'
                    ? 'جميع القاعات'
                    : 'كافة الحصص المسجلة'}
                </option>
                {filterType === 'group' &&
                  filteredGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} {g.specialization ? `(${g.specialization})` : ''}
                    </option>
                  ))}
                {filterType === 'professor' &&
                  professors.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                {filterType === 'room' &&
                  rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type || 'قاعة'})
                    </option>
                  ))}
              </select>
            </div>

            {/* Day Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">تصفية اليوم</label>
              <select
                value={selectedDayId}
                onChange={(e) => setSelectedDayId(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">كافة أيام الأسبوع (السبت - الخميس)</option>
                {DAYS.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    يوم {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Secondary Filter Row (for Specialization & Level when group view is active) */}
          {filterType === 'group' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">تصفية حسب التخصص</label>
                <select
                  value={selectedSpecialization}
                  onChange={(e) => setSelectedSpecialization(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
                >
                  <option value="all">كافة التخصصات ({specializations.length})</option>
                  {specializations.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">المستوى الدراسي</label>
                <select
                  value={selectedYearLevel}
                  onChange={(e) => setSelectedYearLevel(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
                >
                  <option value="all">كافة المستويات ({yearLevels.length})</option>
                  {yearLevels.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Context Info & Quick Legend */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600 gap-3">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-800">{currentEntityName}</span>
              <Badge variant="neutral" className="text-[11px]">
                {filteredAssignments.length} حصة مسجلة
              </Badge>
            </div>

            {/* Colors Legend */}
            <div className="flex items-center gap-4 text-[11px]">
              <span className="text-slate-400 font-medium">دليل الألوان:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span>محاضرة (Cours)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>أعمال موجهة (TD)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>أعمال تطبيقية (TP)</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySummary}
                className="gap-1 text-xs py-1 px-2.5 h-auto text-slate-700 mr-2"
              >
                {copiedNotification ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ الملخص</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Timetable Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500 font-medium">جاري إعداد جدول التوقيت وجلب الحصص...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full border-collapse min-w-[900px] text-right">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 text-xs">
                <th className="py-4 px-4 font-bold border-l border-slate-200 w-28 text-center bg-slate-200/60">
                  اليوم / التوقيت
                </th>
                {TIME_SLOTS.map((slot) => (
                  <th key={slot.id} className="py-4 px-3 font-bold border-l border-slate-200 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-slate-800">{slot.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {DAYS.map((day) => {
                // Skip day if day filter is active and doesn't match
                if (selectedDayId !== 'all' && Number(selectedDayId) !== day.id) {
                  return null;
                }

                return (
                  <tr key={day.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 font-bold text-slate-900 border-l border-slate-200 bg-slate-50/80 text-center align-middle">
                      {day.name}
                    </td>
                    {TIME_SLOTS.map((slot) => {
                      const cellSessions = getCellAssignments(day.id, slot);
                      return (
                        <td
                          key={slot.id}
                          className="p-1.5 border-l border-slate-200 align-top min-h-[100px] h-[105px] w-[150px] relative hover:bg-blue-50/20 transition-colors"
                        >
                          {cellSessions.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-300 font-light select-none">
                              —
                            </div>
                          ) : (
                            <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                              {cellSessions.map((session) => {
                                const isLecture =
                                  session.session_type === 'cours' ||
                                  (session.group_name && session.group_name.includes('محاضرة'));
                                const isTD =
                                  session.session_type === 'td' ||
                                  (session.group_name && session.group_name.includes('TD'));

                                return (
                                  <button
                                    key={session.id}
                                    type="button"
                                    onClick={() => setActiveSession(session)}
                                    className={`w-full text-right p-2 rounded-xl border text-xs transition-all shadow-sm block ${
                                      isLecture
                                        ? 'bg-blue-50/90 border-blue-200 hover:border-blue-300 text-blue-900'
                                        : isTD
                                        ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-300 text-emerald-900'
                                        : 'bg-amber-50/90 border-amber-200 hover:border-amber-300 text-amber-900'
                                    }`}
                                  >
                                    <div className="font-bold truncate" title={session.course_name}>
                                      {session.course_name || 'مقرر بدون اسم'}
                                    </div>
                                    <div className="text-[11px] text-slate-600 truncate mt-0.5">
                                      {session.professor_name || 'غير محدد'}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-200/50">
                                      <span className="font-semibold text-slate-700 truncate max-w-[85px]">
                                        {session.group_name || 'الفوج'}
                                      </span>
                                      <span className="bg-white/90 px-1.5 py-0.2 rounded font-mono font-bold text-slate-800">
                                        {session.room_name || '—'}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Session Details Modal */}
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
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                <span className="text-xs text-blue-600 font-semibold block">المقرر الدراسي</span>
                <span className="text-base font-bold text-blue-950">{activeSession.course_name || '—'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block mb-1">الأستاذ المحاضر</span>
                  <span className="font-semibold text-slate-800">{activeSession.professor_name || '—'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block mb-1">الفوج / الدفعة</span>
                  <span className="font-semibold text-slate-800">{activeSession.group_name || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block mb-1">القاعة</span>
                  <span className="font-semibold text-slate-800">{activeSession.room_name || '—'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block mb-1">نوع الحصة</span>
                  <span className="font-semibold text-slate-800">
                    {activeSession.session_type === 'cours' ? 'محاضرة' : 'أعمال موجهة'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">التوقيت</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {DAYS.find((d) => d.id === normalizeDay(activeSession.day_of_week))?.name || 'يوم'} ({activeSession.start_time} - {activeSession.end_time})
                  </span>
                </div>
                <Clock className="w-5 h-5 text-slate-400" />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setActiveSession(null)}>
                إغلاق
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* 5. Official College A4 Landscape Print Engine Dialog */}
      <Dialog open={isPrintDialogOpen} onClose={() => setIsPrintDialogOpen(false)} size="full">
        <div className="p-6 space-y-6 max-w-5xl w-full bg-white rounded-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b pb-4">
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              <span>معاينة الطباعة الرسمية للكلية (A4 أفقي - Landscape)</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              معاينة جدول التوقيت بتنسيق الطباعة الجامعية الرسمية
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

          {/* Printable Sheet */}
          <div className="p-6 border border-slate-300 rounded-xl bg-white text-slate-900 print-content">
            {/* Algerian Official Header */}
            <div className="text-center border-b pb-3 mb-4">
              <h2 className="font-bold text-sm tracking-wide">الجمهورية الجزائرية الديمقراطية الشعبية</h2>
              <h3 className="font-bold text-xs mt-0.5">وزارة التعليم العالي والبحث العلمي</h3>
              <h4 className="font-semibold text-xs mt-0.5">جامعة الشهيد حمه لخضر - الوادي</h4>
              <h5 className="text-xs text-slate-700 mt-0.5 font-medium">كلية العلوم الاقتصادية والتجارية وعلوم التسيير</h5>
              <div className="text-[11px] text-slate-600 mt-1 font-mono">
                السنة الجامعية: {academicYear} | {semester}
              </div>
            </div>

            {/* Title & Scope */}
            <div className="text-center my-3">
              <h3 className="text-base font-extrabold text-blue-950 inline-block border-b-2 border-blue-900 pb-0.5">
                جدول التوقيت الأسبوعي العام
              </h3>
              <div className="mt-1.5 text-xs text-slate-800 font-bold">
                {currentEntityName}
              </div>
            </div>

            {/* Printable Table */}
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
                  {DAYS.map((day) => {
                    if (selectedDayId !== 'all' && Number(selectedDayId) !== day.id) return null;

                    return (
                      <tr key={day.id} className="border border-slate-700">
                        <td className="py-3 px-3 font-bold border border-slate-700 bg-slate-100 text-slate-900">
                          {day.name}
                        </td>
                        {TIME_SLOTS.map((slot) => {
                          const cellSessions = getCellAssignments(day.id, slot);
                          return (
                            <td key={slot.id} className="p-1.5 border border-slate-700 h-[68px] align-middle">
                              {cellSessions.length === 0 ? (
                                <span className="text-slate-400 font-light">—</span>
                              ) : (
                                cellSessions.map((s) => {
                                  const isLecture =
                                    s.session_type === 'cours' ||
                                    (s.group_name && s.group_name.includes('محاضرة'));
                                  return (
                                    <div key={s.id} className="text-[11px] leading-tight mb-1 last:mb-0">
                                      <div className="font-extrabold text-slate-900">{s.course_name}</div>
                                      <div className="text-[10px] text-slate-700 font-medium mt-0.5">{s.professor_name}</div>
                                      <div className="text-[9px] font-mono font-bold text-blue-900 mt-0.5">
                                        {s.group_name} | {isLecture ? 'محاضرة' : 'TD'} | {s.room_name || 'قاعة'}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
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
        </div>
      </Dialog>
    </div>
  );
}
