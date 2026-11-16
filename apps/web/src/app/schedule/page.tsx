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
import { TIME_SLOTS, DAYS, normalizeDay, matchesSlot } from '@/constants/timeSlots';

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

export default function SchedulePage() {
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState('السداسي الأول');

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [professors, setProfessors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<'specialization' | 'group' | 'professor' | 'room' | 'all'>('specialization');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('all');
  const [selectedYearLevel, setSelectedYearLevel] = useState<string>('all');
  const [selectedDayId, setSelectedDayId] = useState<string>('all');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<'all' | 'cours' | 'td' | 'tp'>('all');

  // Details Modal
  const [activeSession, setActiveSession] = useState<Assignment | null>(null);

  // Print Modal
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState<any>(null);
  const [hideEmptyDaysInPrint, setHideEmptyDaysInPrint] = useState(true);
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
        api.getPrintSettings().catch(() => null),
      ]);

      const [assignRes, groupsRes, profsRes, roomsRes, printRes] = results;

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
      if (printRes && printRes.status === 'fulfilled' && printRes.value) {
        setPrintSettings(printRes.value);
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

  // Auto-select first specialization if currently 'all'
  useEffect(() => {
    if (specializations.length > 0 && selectedSpecialization === 'all') {
      setSelectedSpecialization(specializations[0]);
    }
  }, [specializations, selectedSpecialization]);

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

  // Helper to accurately identify if an assignment is a lecture (محاضرة)
  const isLectureSession = (a: Assignment) => {
    const g = groups.find((item) => item.id === a.group_id);
    const r = rooms.find((item) => item.id === a.room_id);
    const groupName = (a.group_name || g?.name || '').trim();
    const roomLower = (a.room_name || r?.name || '').toLowerCase();
    const sessionTypeRaw = (a.session_type || '').toLowerCase();

    // 1. Explicit subgroup (فوج 1, فوج 2, G1...) in normal classrooms is TD/TP, NOT a lecture!
    const isExplicitSubgroup = /(فوج|ف\s*\.?\s*\d+|group|grp|g\d+)/i.test(groupName) &&
      !groupName.includes('كافة الأفواج') &&
      !groupName.includes('جميع الأفواج');

    if (isExplicitSubgroup) {
      return false;
    }

    // 2. Labs/TP
    if (roomLower.includes('مخبر') || roomLower.includes('معمل') || sessionTypeRaw === 'tp' || groupName.toLowerCase().includes('tp')) {
      return false;
    }

    // 3. Amphitheaters are always lectures
    if (roomLower.includes('مدرج') || roomLower.includes('amphi') || roomLower.includes('محاضرات')) {
      return true;
    }

    // 4. Cohorts / general batch
    if (groupName.includes('محاضرة') || groupName.includes('الدفعة') || groupName.includes('ج.م') || (g && (g.group_type === 'lecture_group' || g.group_type === 'section'))) {
      return true;
    }

    if (sessionTypeRaw === 'cours' || sessionTypeRaw === 'lecture') {
      return !roomLower.includes('قاعة');
    }

    return false;
  };

  // Helper to resolve detailed session metadata for display & print
  const resolveSessionDetails = (a: Assignment) => {
    const g = groups.find((item) => item.id === a.group_id);
    const r = rooms.find((item) => item.id === a.room_id);
    const groupName = (a.group_name || g?.name || '').trim();
    const roomName = (a.room_name || r?.name || 'قاعة').trim();
    const roomLower = roomName.toLowerCase();
    const sessionTypeRaw = (a.session_type || '').toLowerCase();

    const isAmphi = roomLower.includes('مدرج') || roomLower.includes('amphi') || roomLower.includes('محاضرات');
    const isLab = roomLower.includes('مخبر') || roomLower.includes('معمل') || roomLower.includes('lab') || sessionTypeRaw === 'tp' || groupName.toLowerCase().includes('tp');
    const isSubgroup = /(فوج|ف\s*\.?\s*\d+|group|grp|g\d+)/i.test(groupName) &&
      !groupName.includes('كافة الأفواج') &&
      !groupName.includes('جميع الأفواج');

    let isLecture = false;
    let typeLabel = 'أعمال موجهة (أ.م)';

    if (isLab) {
      typeLabel = 'أعمال تطبيقية (أ.ت)';
      isLecture = false;
    } else if (isSubgroup) {
      typeLabel = 'أعمال موجهة (أ.م)';
      isLecture = false;
    } else if (isAmphi || groupName.includes('محاضرة') || groupName.includes('الدفعة') || groupName.includes('ج.م') || (g && (g.group_type === 'lecture_group' || g.group_type === 'section'))) {
      typeLabel = 'محاضرة';
      isLecture = true;
    } else if (sessionTypeRaw === 'td') {
      typeLabel = 'أعمال موجهة (أ.م)';
      isLecture = false;
    } else if (sessionTypeRaw === 'cours' || sessionTypeRaw === 'lecture') {
      typeLabel = isAmphi ? 'محاضرة' : 'أعمال موجهة (أ.م)';
      isLecture = isAmphi;
    }

    // Extract prominent group badge (e.g. "فوج 1", "فوج 2", "ف 01")
    let displayGroupBadge = '';
    const matchFawj = groupName.match(/(فوج\s*\d+|ف\s*\.?\s*\d+|G\d+)/i);
    if (matchFawj) {
      displayGroupBadge = matchFawj[0];
    } else if (isLecture) {
      displayGroupBadge = 'محاضرة';
    } else if (groupName) {
      displayGroupBadge = groupName.length > 15 ? groupName.substring(0, 15) : groupName;
    } else {
      displayGroupBadge = typeLabel;
    }

    return {
      isLecture,
      typeLabel,
      displayGroupBadge,
      roomName,
      professorName: a.professor_name || 'أستاذ',
      courseName: a.course_name || 'مقياس',
    };
  };

  // Helper to check if an assignment belongs to a specialization
  const matchesSpecialization = (a: Assignment, specName: string) => {
    if (!specName || specName === 'all') return true;
    if (a.specialization === specName) return true;
    const g = groups.find((item) => item.id === a.group_id);
    if (g && g.specialization === specName) return true;
    // For lectures with general cohort or empty specialization
    if (isLectureSession(a)) {
      if (g && (!g.specialization || g.specialization === '')) {
        const specGroups = groups.filter((item) => item.specialization === specName);
        if (specGroups.some((sg) => (sg.department_id && sg.department_id === g.department_id) || (sg.year && sg.year === g.year))) {
          return true;
        }
      }
    }
    return false;
  };

  // Filtered assignments based on current selection
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // Day filter
      if (selectedDayId !== 'all') {
        const dayNum = normalizeDay(a.day_of_week);
        if (dayNum !== Number(selectedDayId)) return false;
      }

      // 1. View Mode: Specialization (المحاضرات وكافة أفواج التخصص)
      if (filterType === 'specialization') {
        if (!matchesSpecialization(a, selectedSpecialization)) return false;

        // Level filter
        if (selectedYearLevel !== 'all') {
          const g = groups.find((item) => item.id === a.group_id);
          if (g && g.year && g.year !== selectedYearLevel) return false;
        }

        // Scope within specialization
        if (selectedEntityId !== 'all') {
          // If a specific group is chosen within specialization:
          // Keep all lectures of this specialization + this group's TD/TP!
          if (isLectureSession(a)) return true;
          return a.group_id === Number(selectedEntityId);
        }

        return true;
      }

      // 2. View Mode: Group (الفوج متضمناً محاضرات التخصص)
      if (filterType === 'group') {
        if (selectedEntityId === 'all') {
          if (selectedSpecialization !== 'all') {
            return matchesSpecialization(a, selectedSpecialization);
          }
          return true;
        }
        const targetGroupId = Number(selectedEntityId);
        const targetGroup = groups.find((g) => g.id === targetGroupId);

        // Group's own sessions (TD, TP, etc.)
        if (a.group_id === targetGroupId) return true;

        // Automatically include the lectures of this group's specialization
        if (targetGroup && isLectureSession(a)) {
          return matchesSpecialization(a, targetGroup.specialization || '');
        }

        return false;
      }

      // 3. View Mode: Professor
      if (filterType === 'professor') {
        if (selectedEntityId === 'all') return true;
        return a.professor_id === Number(selectedEntityId);
      }

      // 4. View Mode: Room
      if (filterType === 'room') {
        if (selectedEntityId === 'all') return true;
        return a.room_id === Number(selectedEntityId);
      }

      // 5. Comprehensive (All)
      if (selectedSpecialization !== 'all') {
        if (!matchesSpecialization(a, selectedSpecialization)) return false;
      }

      // Session Type Filter (محاضرة / TD / TP)
      if (sessionTypeFilter !== 'all') {
        const isLecture = isLectureSession(a);
        const isTD = !isLecture && (a.session_type === 'td' || (a.group_name && a.group_name.toLowerCase().includes('td')));
        const isTP = !isLecture && !isTD && (a.session_type === 'tp' || (a.group_name && a.group_name.toLowerCase().includes('tp')));
        if (sessionTypeFilter === 'cours' && !isLecture) return false;
        if (sessionTypeFilter === 'td' && !isTD) return false;
        if (sessionTypeFilter === 'tp' && !isTP) return false;
      }

      return true;
    });
  }, [assignments, filterType, selectedEntityId, selectedDayId, selectedSpecialization, selectedYearLevel, sessionTypeFilter, groups]);

  // Find assignments for a specific day and time slot
  const getCellAssignments = (dayId: number, slot: typeof TIME_SLOTS[0]) => {
    return filteredAssignments.filter((a) => {
      const dayNum = normalizeDay(a.day_of_week);
      if (dayNum !== dayId) return false;
      return matchesSlot(a.start_time, slot.start, slot.end, a.end_time);
    });
  };

  // Helper to check if a day has 0 assignments across all time slots
  const isDayEmpty = (dayId: number) => {
    return TIME_SLOTS.every((slot) => getCellAssignments(dayId, slot).length === 0);
  };

  // Selected Entity Name for Header / Print
  const currentEntityName = useMemo(() => {
    if (filterType === 'specialization') {
      const specLabel = selectedSpecialization === 'all' ? 'كافة التخصصات' : `تخصص ${selectedSpecialization}`;
      if (selectedEntityId !== 'all') {
        const g = groups.find((item) => item.id === Number(selectedEntityId));
        return `جدول ${specLabel} — ${g ? g.name : 'فوج محدد'} (محاضرات + الفوج)`;
      }
      return `جدول استعمال الزمن لـ: ${specLabel} (المحاضرات وكافة الأفواج)`;
    }
    if (filterType === 'all' || selectedEntityId === 'all') {
      if (filterType === 'group' && selectedSpecialization !== 'all') {
        return `تخصص: ${selectedSpecialization} (المحاضرات وجميع الأفواج)`;
      }
      return 'العرض الشامل لكافة الأقسام';
    }
    const id = Number(selectedEntityId);
    if (filterType === 'group') {
      const g = groups.find((item) => item.id === id);
      return g ? `الفوج: ${g.name} (${g.specialization || ''}) متضمناً المحاضرات` : 'فوج غير محدد';
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
    <div>
      {/* 1. Main Interactive Screen (Completely hidden in @media print) */}
      <div id="main-schedule-screen" className="space-y-6 no-print">
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
              <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('specialization');
                    setSelectedEntityId('all');
                  }}
                  className={`py-1.5 rounded-lg transition-all ${
                    filterType === 'specialization' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-600'
                  }`}
                  title="عرض جدول التخصص الموحد (المحاضرات وكافة الأفواج)"
                >
                  تخصص
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('group');
                    setSelectedEntityId('all');
                  }}
                  className={`py-1.5 rounded-lg transition-all ${
                    filterType === 'group' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-600'
                  }`}
                  title="عرض جدول الفوج مع محاضرات التخصص"
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
                    filterType === 'professor' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-600'
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
                    filterType === 'room' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-600'
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
                    filterType === 'all' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-600'
                  }`}
                >
                  شامل
                </button>
              </div>
            </div>

            {/* Entity Dropdown 1 (Specialization or Main Entity) */}
            <div>
              {filterType === 'specialization' ? (
                <>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    اختر التخصص (المحاضرات والأفواج)
                  </label>
                  <select
                    value={selectedSpecialization}
                    onChange={(e) => {
                      setSelectedSpecialization(e.target.value);
                      setSelectedEntityId('all');
                    }}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">كافة التخصصات (شامل)</option>
                    {specializations.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {filterType === 'group'
                      ? 'اختر الفوج (يتضمن المحاضرات)'
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
                </>
              )}
            </div>

            {/* Entity Dropdown 2 (Group Scope or Day Filter) */}
            <div>
              {filterType === 'specialization' ? (
                <>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    نطاق الأفواج داخل التخصص
                  </label>
                  <select
                    value={selectedEntityId}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">المحاضرات وكافة الأفواج (جدول موحد)</option>
                    {filteredGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} (محاضرات التخصص + الفوج)
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>

          {/* Secondary Filter Row (for Specialization & Level & Session Type & Day) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">المستوى الدراسي</label>
              <select
                value={selectedYearLevel}
                onChange={(e) => setSelectedYearLevel(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
              >
                <option value="all">كافة المستويات ({yearLevels.length})</option>
                {yearLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {filterType === 'group' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">تصفية حسب التخصص</label>
                <select
                  value={selectedSpecialization}
                  onChange={(e) => setSelectedSpecialization(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
                >
                  <option value="all">كافة التخصصات ({specializations.length})</option>
                  {specializations.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">نوع الحصة</label>
              <select
                value={sessionTypeFilter}
                onChange={(e) => setSessionTypeFilter(e.target.value as any)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
              >
                <option value="all">كافة أنواع الحصص (محاضرات + TD + TP)</option>
                <option value="cours">المحاضرات فقط (Cours)</option>
                <option value="td">الأعمال الموجهة فقط (TD)</option>
                <option value="tp">الأعمال التطبيقية فقط (TP)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">تصفية اليوم</label>
              <select
                value={selectedDayId}
                onChange={(e) => setSelectedDayId(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium"
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
                  <th key={slot.id} className="py-3 px-3 font-bold border-l border-slate-200 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-slate-800 font-bold text-xs">{slot.label}</span>
                      <span className="text-[10px] text-blue-800 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/50">
                        {slot.periodName}
                      </span>
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
                            <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                              {cellSessions.map((session) => {
                                const isLecture = isLectureSession(session);
                                const isTD =
                                  !isLecture &&
                                  (session.session_type === 'td' ||
                                    (session.group_name && session.group_name.toLowerCase().includes('td')));

                                return (
                                  <button
                                    key={session.id}
                                    type="button"
                                    onClick={() => setActiveSession(session)}
                                    className={`w-full text-right p-2 rounded-xl border text-xs transition-all shadow-sm block ${
                                      isLecture
                                        ? 'bg-blue-50/95 border-blue-300 hover:border-blue-400 text-blue-950 ring-1 ring-blue-300/50'
                                        : isTD
                                        ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-300 text-emerald-950'
                                        : 'bg-amber-50/90 border-amber-200 hover:border-amber-300 text-amber-950'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                      <span className="font-bold truncate text-[11px]" title={session.course_name}>
                                        {session.course_name || 'مقرر بدون اسم'}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                                          isLecture
                                            ? 'bg-blue-200 text-blue-900'
                                            : isTD
                                            ? 'bg-emerald-200 text-emerald-900'
                                            : 'bg-amber-200 text-amber-900'
                                        }`}
                                      >
                                        {isLecture ? 'محاضرة' : isTD ? 'TD' : 'TP'}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-700 truncate mt-0.5">
                                      {session.professor_name || 'غير محدد'}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-600 mt-1 pt-1 border-t border-slate-200/50">
                                      <span className="font-semibold text-slate-800 truncate max-w-[90px]">
                                        {session.group_name || 'الفوج'}
                                      </span>
                                      <span className="bg-white px-1.5 py-0.2 rounded font-mono font-bold text-slate-800 border border-slate-200">
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
      </div>

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
        <div className="p-4 sm:p-6 space-y-3 max-w-[96vw] w-full bg-white rounded-2xl max-h-[90vh] overflow-y-auto print:p-0 print:m-0 print:border-none print:shadow-none print:rounded-none print:max-h-none print:overflow-visible print:max-w-none print:w-full">
          {/* Dialog Action Header - Sticky Top Bar in Screen, Completely Hidden in Print */}
          <div className="no-print sticky top-0 z-20 bg-white/95 backdrop-blur-md flex flex-wrap items-center justify-between border-b pb-3 pt-1 px-3 shadow-xs rounded-t-xl gap-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              <span>معاينة الطباعة الرسمية للكلية (A4 أفقي - Landscape)</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              معاينة جدول التوقيت بتنسيق الطباعة الجامعية الرسمية
            </DialogDescription>
            <div className="flex items-center gap-3">
              {/* Option to hide empty days in print */}
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={hideEmptyDaysInPrint}
                  onChange={(e) => setHideEmptyDaysInPrint(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>إخفاء الأيام الفارغة في الطباعة</span>
              </label>

              <Button
                variant="primary"
                size="sm"
                onClick={executePrint}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
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
          <div className="printable-schedule-sheet relative p-4 sm:p-5 border border-slate-300 print:border-none rounded-xl print:rounded-none bg-white text-slate-900 print-content overflow-hidden">
            {/* Watermark */}
            {printSettings?.enable_watermark && (printSettings.faculty_logo || printSettings.university_logo) && (
              <div
                className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none"
                style={{ opacity: Number(printSettings.watermark_opacity ?? 8) / 100 }}
              >
                <img
                  src={printSettings.faculty_logo || printSettings.university_logo}
                  alt=""
                  className="w-72 h-72 object-contain grayscale"
                />
              </div>
            )}

            {/* Algerian Official Triple Header */}
            <div className="relative z-10 flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-2">
              {/* University Logo (Right in RTL) */}
              <div className="w-16 h-16 flex items-center justify-center shrink-0">
                {printSettings?.university_logo ? (
                  <img
                    src={printSettings.university_logo}
                    alt=""
                    className="max-h-16 max-w-16 object-contain"
                  />
                ) : (
                  <img
                    src="/images/university-logo.svg"
                    alt=""
                    className="max-h-16 max-w-16 object-contain opacity-85"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
              </div>

              {/* Official Text (Center) - Dignified and compact */}
              <div className="text-center flex-1 px-3">
                <h2 className="font-bold text-[11px] tracking-wider text-slate-900">الجمهورية الجزائرية الديمقراطية الشعبية</h2>
                <h3 className="font-bold text-[10.5px] mt-0.5 text-slate-800">وزارة التعليم العالي والبحث العلمي</h3>
                <h4 className="font-black text-xs sm:text-sm mt-0.5 text-blue-950">
                  {printSettings?.institution_name || 'جامعة الشهيد حمه لخضر - الوادي'}
                </h4>
                <h5 className="text-[11px] text-slate-800 mt-0.5 font-bold">
                  {printSettings?.faculty_name || 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير'}
                </h5>
                <div className="text-[10px] text-slate-700 mt-0.5 font-semibold">
                  السنة الجامعية: {academicYear} | {semester}
                </div>
              </div>

              {/* Faculty Logo (Left in RTL) */}
              <div className="w-16 h-16 flex items-center justify-center shrink-0">
                {printSettings?.faculty_logo ? (
                  <img
                    src={printSettings.faculty_logo}
                    alt=""
                    className="max-h-16 max-w-16 object-contain"
                  />
                ) : (
                  // Clean empty spacing without text or dashed box
                  <div className="w-16 h-16" />
                )}
              </div>
            </div>

            {/* Scope Title (Single Clean Framed Title, NO DUPLICATION, NO BIDI PARENTHESIS BUGS) */}
            <div className="relative z-10 text-center my-2">
              <div className="inline-block bg-slate-50 border-2 border-slate-900 px-6 py-1 rounded-lg shadow-xs">
                {filterType === 'specialization' ? (
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center justify-center gap-2 flex-wrap" dir="rtl">
                    <span>جدول استعمال الزمن لـ:</span>
                    <bdi className="text-blue-950 font-black">
                      {selectedSpecialization === 'all' ? 'كافة التخصصات' : `تخصص ${selectedSpecialization}`}
                    </bdi>
                    <span className="text-slate-700 font-bold">
                      {selectedEntityId !== 'all'
                        ? `(${groups.find((item) => item.id === Number(selectedEntityId))?.name || 'فوج محدد'} + المحاضرات)`
                        : '(المحاضرات وكافة الأفواج)'}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900" dir="rtl">
                    {currentEntityName}
                  </div>
                )}
              </div>
            </div>

            {/* Fixed-Width Printable Table (10% + 6 x 15% = 100%) */}
            <div className="relative z-10 mt-2 overflow-x-hidden">
              <table className="w-full table-fixed border-collapse text-center" style={{ border: '2px solid #000' }}>
                <colgroup>
                  <col className="w-[10%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-200 text-slate-900 border-b-2 border-slate-900">
                    <th className="py-1 px-1 border border-slate-700 font-extrabold text-[10px]">
                      اليوم / التوقيت
                    </th>
                    {TIME_SLOTS.map((s) => (
                      <th key={s.id} className="py-1 px-0.5 border border-slate-700 font-extrabold text-[9px] leading-tight">
                        <div>{s.label}</div>
                        <div className="text-[8px] font-normal text-slate-700">{s.periodName}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day) => {
                    if (selectedDayId !== 'all' && Number(selectedDayId) !== day.id) return null;
                    if (hideEmptyDaysInPrint && isDayEmpty(day.id)) return null;

                    return (
                      <tr key={day.id} className="border border-slate-700">
                        <td className="py-1 px-1 font-extrabold border border-slate-700 bg-slate-100 text-slate-900 text-[9.5px]">
                          {day.name}
                        </td>
                        {TIME_SLOTS.map((slot) => {
                          const cellSessions = getCellAssignments(day.id, slot);

                          return (
                            <td
                              key={slot.id}
                              className="p-1 border border-slate-700 align-top min-h-12 overflow-hidden"
                            >
                              {cellSessions.length === 0 ? (
                                <span className="text-[9px] text-slate-300 font-mono">-</span>
                              ) : (
                                <div
                                  className={
                                    cellSessions.length > 1
                                      ? 'grid grid-cols-2 gap-1 w-full'
                                      : 'w-full'
                                  }
                                >
                                  {cellSessions.map((s, idx) => {
                                    const details = resolveSessionDetails(s);
                                    return (
                                      <div
                                        key={`${s.id}-${idx}`}
                                        className={`p-1 rounded text-start leading-tight border transition-all ${
                                          details.isLecture
                                            ? 'bg-amber-50/90 border-amber-300'
                                            : 'bg-blue-50/90 border-blue-300'
                                        }`}
                                      >
                                        {/* Top row: Group Badge + Room */}
                                        <div className="flex items-center justify-between text-[8px] font-bold pb-0.5">
                                          <span
                                            className={`px-1 py-0.2 rounded text-[7.5px] font-black shrink-0 ${
                                              details.isLecture
                                                ? 'bg-amber-600 text-white'
                                                : 'bg-blue-700 text-white'
                                            }`}
                                          >
                                            {details.displayGroupBadge}
                                          </span>
                                          <span className="text-slate-700 font-bold text-[7.5px] truncate mr-1">
                                            {details.roomName}
                                          </span>
                                        </div>

                                        {/* Course Name */}
                                        <div
                                          className="font-extrabold text-[8.5px] truncate text-slate-950 my-0.5"
                                          title={details.courseName}
                                        >
                                          {details.courseName}
                                        </div>

                                        {/* Professor + Type Label */}
                                        <div className="flex items-center justify-between text-[7.5px] text-slate-700 font-medium pt-0.5 border-t border-slate-200/60">
                                          <span className="truncate max-w-[65%]">{details.professorName}</span>
                                          <span className="text-[7px] text-slate-500 font-semibold shrink-0">
                                            {details.typeLabel}
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Official Signatures Block - Compact */}
            <div className="relative z-10 grid grid-cols-2 gap-8 pt-3 mt-1 text-center text-xs font-bold text-slate-900">
              <div>
                <span>{printSettings?.department_head_title || 'تأشيرة رئيس القسم'}</span>
                <div className="h-10 mt-1 border-b border-dashed border-slate-400"></div>
              </div>
              <div>
                <span>{printSettings?.vice_dean_title || 'مصادقة عميد الكلية'}</span>
                <div className="h-10 mt-1 border-b border-dashed border-slate-400"></div>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
