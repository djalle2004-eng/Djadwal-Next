'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  DoorOpen,
  Search,
  Plus,
  Trash2,
  Edit,
  Printer,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Filter,
  Users,
  BookOpen,
  User,
  Building,
  RefreshCw,
  Archive,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronDown,
  Info
} from 'lucide-react';

import {
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Tabs,
  TabsList,
  TabTrigger,
  TabContent,
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Skeleton,
  EmptyState
} from '@djadwal/ui';

import { api } from '@/lib/api';

// Time Slots matching faculty standard
const TIME_SLOTS = [
  '08:00 - 09:30',
  '09:30 - 11:00',
  '11:00 - 12:30',
  '12:30 - 14:00',
  '14:00 - 15:30',
  '15:30 - 17:00'
];

// Djadwal Days Mapping (0 = Saturday, 1 = Sunday, ..., 6 = Friday)
const DAYS = [
  { id: 0, name: 'السبت' },
  { id: 1, name: 'الأحد' },
  { id: 2, name: 'الاثنين' },
  { id: 3, name: 'الثلاثاء' },
  { id: 4, name: 'الأربعاء' },
  { id: 5, name: 'الخميس' },
  { id: 6, name: 'الجمعة' }
];

function dateToSystemDay(dateStr: string): number {
  if (!dateStr) return 1;
  const d = new Date(dateStr);
  const jsDay = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  if (jsDay === 0) return 1; // Sunday in Djadwal is 1
  if (jsDay === 6) return 0; // Saturday in Djadwal is 0
  return jsDay + 1; // Mon-Fri (1-5) -> 2-6
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

function isTimeOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const startA = timeToMinutes(s1);
  const endA = timeToMinutes(e1);
  const startB = timeToMinutes(s2);
  const endB = timeToMinutes(e2);
  return startA < endB && endA > startB;
}

interface Room {
  id: number;
  name: string;
  capacity: number;
  building?: string;
  room_type?: string;
}

interface Professor {
  id: number;
  name: string;
  title?: string;
  department_id?: number;
}

interface Course {
  id: number;
  name: string;
  code?: string;
}

interface Group {
  id: number;
  name: string;
  level?: string;
  specialization?: string;
}

interface Assignment {
  id: number;
  room_id: number;
  professor_id: number;
  course_id: number;
  group_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  academic_year: string;
  semester: string;
  room_name?: string;
  professor_name?: string;
  course_name?: string;
  group_name?: string;
}

interface ExtraSession {
  id: number;
  group_id?: number | null;
  course_id: number;
  professor_id: number;
  room_id: number;
  session_date: string;
  start_time: string;
  end_time: string;
  session_type: string;
  description?: string;
  academic_year?: string;
  semester?: string;
  reason?: string;
  is_archived?: number;
  exam_note?: string;
  version?: number;
  room_name?: string;
  professor_name?: string;
  course_name?: string;
  group_name?: string;
}

export default function AvailableRoomsPage() {
  const [activeTab, setActiveTab] = useState<string>('search');

  // Core Data
  const [rooms, setRooms] = useState<Room[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [regularAssignments, setRegularAssignments] = useState<Assignment[]>([]);
  const [extraSessions, setExtraSessions] = useState<ExtraSession[]>([]);

  // Loading & State
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [semester, setSemester] = useState<string>('السداسي الأول');

  // Search Filters (Tab 1)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(TIME_SLOTS[0]);
  const [minCapacity, setMinCapacity] = useState<number>(0);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all');

  // Booking Form State (Tab 2)
  const [bookingDate, setBookingDate] = useState<string>(todayStr);
  const [bookingTimeSlot, setBookingTimeSlot] = useState<string>(TIME_SLOTS[0]);
  const [bookingRoomId, setBookingRoomId] = useState<string>('');
  const [bookingProfessorId, setBookingProfessorId] = useState<string>('');
  const [bookingCourseId, setBookingCourseId] = useState<string>('');
  const [bookingGroupId, setBookingGroupId] = useState<string>('');
  const [bookingType, setBookingType] = useState<string>('makeup');
  const [bookingReason, setBookingReason] = useState<string>('');
  const [bookingExamNote, setBookingExamNote] = useState<string>('');
  const [bookingSubmitting, setBookingSubmitting] = useState<boolean>(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string>('');
  const [bookingErrorMsg, setBookingErrorMsg] = useState<string>('');

  // Sessions Log Filters (Tab 4)
  const [logSearch, setLogSearch] = useState<string>('');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [sessionToDelete, setSessionToDelete] = useState<ExtraSession | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [printModalType, setPrintModalType] = useState<'daily' | 'announcement' | 'list'>('daily');
  const [announcementSession, setAnnouncementSession] = useState<ExtraSession | null>(null);

  // Load all initial data
  const loadAllData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [rData, pData, cData, gData, aData, esData] = await Promise.all([
        api.get<Room[]>('/catalog/rooms?limit=300').catch(() => []),
        api.get<Professor[]>('/professors?limit=300').catch(() => []),
        api.get<Course[]>('/catalog/courses?limit=300').catch(() => []),
        api.get<Group[]>('/catalog/groups?limit=300').catch(() => []),
        api.get<Assignment[]>(`/assignments?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&limit=3000`).catch(() => []),
        api.get<ExtraSession[]>(`/extra-sessions?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&limit=1000`).catch(() => [])
      ]);

      setRooms(Array.isArray(rData) ? rData : []);
      setProfessors(Array.isArray(pData) ? pData : []);
      setCourses(Array.isArray(cData) ? cData : []);
      setGroups(Array.isArray(gData) ? gData : []);
      setRegularAssignments(Array.isArray(aData) ? aData : []);
      setExtraSessions(Array.isArray(esData) ? esData : []);
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [academicYear, semester]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Unique Buildings & Room Types for filter dropdowns
  const buildingsList = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach(r => {
      if (r.building) set.add(r.building);
    });
    return Array.from(set);
  }, [rooms]);

  const roomTypesList = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach(r => {
      if (r.room_type) set.add(r.room_type);
    });
    return Array.from(set);
  }, [rooms]);

  // Instant Availability Engine (Tab 1 Calculation)
  const evaluatedRooms = useMemo(() => {
    const [startTime, endTime] = selectedTimeSlot.split(' - ').map(s => s.trim());
    const sysDay = dateToSystemDay(selectedDate);

    // 1. Regular assignments on sysDay in time slot
    const busyRegular = regularAssignments.filter(a => {
      if (a.day_of_week !== sysDay) return false;
      return isTimeOverlap(startTime, endTime, a.start_time, a.end_time);
    });

    // 2. Extra sessions on selectedDate in time slot
    const busyExtra = extraSessions.filter(s => {
      if (s.session_date !== selectedDate) return false;
      if (s.is_archived === 1) return false;
      return isTimeOverlap(startTime, endTime, s.start_time, s.end_time);
    });

    return rooms
      .filter(r => {
        if (minCapacity > 0 && (r.capacity || 0) < minCapacity) return false;
        if (selectedBuilding !== 'all' && r.building !== selectedBuilding) return false;
        if (selectedRoomType !== 'all' && r.room_type !== selectedRoomType) return false;
        return true;
      })
      .map(room => {
        const regOccupancy = busyRegular.find(a => a.room_id === room.id);
        const extraOccupancy = busyExtra.find(s => s.room_id === room.id);

        const isAvailable = !regOccupancy && !extraOccupancy;
        const occupant = regOccupancy
          ? {
              type: 'regular' as const,
              course: regOccupancy.course_name || 'مقياس غير محدد',
              professor: regOccupancy.professor_name || 'أستاذ غير محدد',
              group: regOccupancy.group_name || 'فوج غير محدد',
              time: `${regOccupancy.start_time} - ${regOccupancy.end_time}`
            }
          : extraOccupancy
          ? {
              type: 'extra' as const,
              course: extraOccupancy.course_name || 'مقياس إضافي',
              professor: extraOccupancy.professor_name || 'أستاذ',
              group: extraOccupancy.group_name || 'فوج',
              time: `${extraOccupancy.start_time} - ${extraOccupancy.end_time}`,
              sessionType: extraOccupancy.session_type
            }
          : null;

        return {
          room,
          isAvailable,
          occupant
        };
      });
  }, [rooms, regularAssignments, extraSessions, selectedDate, selectedTimeSlot, minCapacity, selectedBuilding, selectedRoomType]);

  const availableRoomsCount = useMemo(() => evaluatedRooms.filter(r => r.isAvailable).length, [evaluatedRooms]);
  const occupiedRoomsCount = useMemo(() => evaluatedRooms.filter(r => !r.isAvailable).length, [evaluatedRooms]);
  const vacancyPercentage = useMemo(() => {
    if (evaluatedRooms.length === 0) return 0;
    return Math.round((availableRoomsCount / evaluatedRooms.length) * 100);
  }, [availableRoomsCount, evaluatedRooms]);

  // Real-time Conflict Engine for Booking Form (Tab 2)
  const currentBookingConflicts = useMemo(() => {
    if (!bookingDate || !bookingTimeSlot) return [];
    const [startT, endT] = bookingTimeSlot.split(' - ').map(s => s.trim());
    const sysDay = dateToSystemDay(bookingDate);
    const conflicts: string[] = [];

    // Check regular assignments
    regularAssignments.forEach(a => {
      if (a.day_of_week === sysDay && isTimeOverlap(startT, endT, a.start_time, a.end_time)) {
        if (bookingRoomId && a.room_id === Number(bookingRoomId)) {
          conflicts.push(`القاعة مشغولة بحصة رسمية: "${a.course_name || 'مقياس'}" للأستاذ ${a.professor_name || ''} (${a.start_time} - ${a.end_time})`);
        }
        if (bookingProfessorId && a.professor_id === Number(bookingProfessorId)) {
          conflicts.push(`الأستاذ مرتبط بحصة رسمية: "${a.course_name || 'مقياس'}" مع فوج ${a.group_name || ''} (${a.start_time} - ${a.end_time})`);
        }
        if (bookingGroupId && a.group_id === Number(bookingGroupId)) {
          conflicts.push(`الفوج مرتبط بحصة رسمية: "${a.course_name || 'مقياس'}" في القاعة ${a.room_name || ''} (${a.start_time} - ${a.end_time})`);
        }
      }
    });

    // Check extra sessions
    extraSessions.forEach(s => {
      if (s.session_date === bookingDate && s.is_archived !== 1 && isTimeOverlap(startT, endT, s.start_time, s.end_time)) {
        if (bookingRoomId && s.room_id === Number(bookingRoomId)) {
          conflicts.push(`القاعة محجوزة مسبقًا لحصة تعويضية/إضافية: "${s.course_name || ''}" (${s.start_time} - ${s.end_time})`);
        }
        if (bookingProfessorId && s.professor_id === Number(bookingProfessorId)) {
          conflicts.push(`الأستاذ مبرمج لحصة إضافية/تعويضية أخرى (${s.start_time} - ${s.end_time})`);
        }
        if (bookingGroupId && s.group_id === Number(bookingGroupId)) {
          conflicts.push(`الفوج مبرمج لحصة إضافية/تعويضية أخرى (${s.start_time} - ${s.end_time})`);
        }
      }
    });

    return conflicts;
  }, [bookingDate, bookingTimeSlot, bookingRoomId, bookingProfessorId, bookingGroupId, regularAssignments, extraSessions]);

  // Handle Quick Booking from Available Room Card or Matrix Cell
  const handleQuickBook = (roomId: number, dateStr: string, slotStr: string) => {
    setBookingRoomId(roomId.toString());
    setBookingDate(dateStr);
    setBookingTimeSlot(slotStr);
    setActiveTab('booking');
  };

  // Submit Booking Form
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingErrorMsg('');
    setBookingSuccessMsg('');

    if (!bookingRoomId || !bookingProfessorId || !bookingCourseId || !bookingDate || !bookingTimeSlot) {
      setBookingErrorMsg('يرجى ملء جميع الحقول الإلزامية: القاعة، الأستاذ، المقياس، التاريخ، والتوقيت');
      return;
    }

    if (currentBookingConflicts.length > 0) {
      setBookingErrorMsg('لا يمكن حفظ الحصة لوجود تعارض في التوقيت أو القاعة أو الأستاذ.');
      return;
    }

    const [startTime, endTime] = bookingTimeSlot.split(' - ').map(s => s.trim());

    try {
      setBookingSubmitting(true);
      const payload = {
        room_id: Number(bookingRoomId),
        professor_id: Number(bookingProfessorId),
        course_id: Number(bookingCourseId),
        group_id: bookingGroupId ? Number(bookingGroupId) : null,
        session_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        session_type: bookingType,
        reason: bookingReason,
        exam_note: bookingExamNote,
        academic_year: academicYear,
        semester: semester
      };

      const res = await api.post('/extra-sessions', payload);
      setBookingSuccessMsg('تمت برمجة الحصة بنجاح وحجز القاعة في النظام!');
      // Clear form optional fields
      setBookingReason('');
      setBookingExamNote('');
      // Reload sessions
      await loadAllData();
    } catch (err: any) {
      console.error('Booking failed:', err);
      setBookingErrorMsg(err?.messageAr || err?.message || 'فشلت عملية برمجة الحصة');
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Delete Session
  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      setIsDeleting(true);
      await api.delete(`/extra-sessions/${sessionToDelete.id}`);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
      await loadAllData();
    } catch (err: any) {
      alert(err?.message || 'فشل حذف الحصة');
    } finally {
      setIsDeleting(false);
    }
  };

  // Archive Past Sessions
  const handleArchivePast = async () => {
    try {
      setRefreshing(true);
      const res: any = await api.post('/extra-sessions/archive', {});
      alert(res?.message || 'تمت أرشفة الحصص السابقة بنجاح');
      await loadAllData();
    } catch (err: any) {
      alert('حدث خطأ أثناء أرشفة الحصص المنتهية');
    } finally {
      setRefreshing(false);
    }
  };

  // Filtered Sessions Log (Tab 4)
  const filteredSessions = useMemo(() => {
    return extraSessions.filter(s => {
      if (!showArchived && s.is_archived === 1) return false;
      if (logTypeFilter !== 'all' && s.session_type !== logTypeFilter) return false;
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase();
        const profMatch = s.professor_name?.toLowerCase().includes(q);
        const courseMatch = s.course_name?.toLowerCase().includes(q);
        const roomMatch = s.room_name?.toLowerCase().includes(q);
        const groupMatch = s.group_name?.toLowerCase().includes(q);
        if (!profMatch && !courseMatch && !roomMatch && !groupMatch) return false;
      }
      return true;
    });
  }, [extraSessions, showArchived, logTypeFilter, logSearch]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-16" dir="rtl">
      {/* Top Header & Fast Switcher */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  نظام القاعات المتاحة والتعويضات
                </h1>
                <Badge variant="success">100% Feature Parity</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                فحص شغور القاعات اللحظي، برمجة الحصص الإضافية والتعويضية، ومصفوفة القاعات التفاعلية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Link to Legacy UI */}
            <a
              href="/legacy/available-rooms"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 transition-colors"
              title="الانتقال المباشر إلى الشاشة القديمة للمقارنة التامة"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>الواجهة القديمة (Legacy)</span>
            </a>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllData}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </Button>
          </div>
        </div>

        {/* Global Statistics Strip */}
        <div className="bg-slate-100/70 dark:bg-slate-800/40 border-t border-slate-200/60 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-4">
              <span>السنة الدراسية: <strong className="text-slate-900 dark:text-white font-mono">{academicYear}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>السداسي: <strong className="text-slate-900 dark:text-white">{semester}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>اليوم المحدد: <strong className="text-emerald-700 dark:text-emerald-400">{DAYS.find(d => d.id === dateToSystemDay(selectedDate))?.name || 'غير معروف'} ({selectedDate})</strong></span>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>المتاحة: <strong>{availableRoomsCount}</strong></span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                <span>المشغولة: <strong>{occupiedRoomsCount}</strong></span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-teal-500"></span>
                <span>نسبة الشغور: <strong>{vacancyPercentage}%</strong></span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                <span>الحصص المبرمجة: <strong>{extraSessions.length}</strong></span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Tabs defaultValue="search" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 grid grid-cols-4 w-full max-w-2xl">
            <TabTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              <span>فحص شغور القاعات</span>
            </TabTrigger>
            <TabTrigger value="booking" className="gap-2">
              <Plus className="h-4 w-4" />
              <span>برمجة حصة جديدة</span>
            </TabTrigger>
            <TabTrigger value="matrix" className="gap-2">
              <Layers className="h-4 w-4" />
              <span>مصفوفة الشغور</span>
            </TabTrigger>
            <TabTrigger value="log" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span>سجل التعويضات</span>
            </TabTrigger>
          </TabsList>

          {/* ================================================================= */}
          {/* TAB 1: INSTANT ROOM AVAILABILITY SEARCH                            */}
          {/* ================================================================= */}
          <TabContent value="search">
            <div className="space-y-6">
              {/* Filter Panel */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Filter className="h-4 w-4 text-emerald-600" />
                      <span>معايير البحث اللحظي عن القاعات</span>
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPrintModalType('daily');
                        setPrintModalOpen(true);
                      }}
                      className="gap-1.5 text-xs text-slate-700 dark:text-slate-200"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>تصدير/طباعة تقرير شغور القاعات</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* Date Picker */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        التاريخ المحدد
                      </label>
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full"
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        يوافق: {DAYS.find(d => d.id === dateToSystemDay(selectedDate))?.name}
                      </span>
                    </div>

                    {/* Time Slot Picker */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        الفترة الزمنية
                      </label>
                      <select
                        value={selectedTimeSlot}
                        onChange={(e) => setSelectedTimeSlot(e.target.value)}
                        className="w-full py-2 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                      >
                        {TIME_SLOTS.map(slot => (
                          <option key={slot} value={slot}>{slot}</option>
                        ))}
                      </select>
                    </div>

                    {/* Minimum Capacity */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        الحد الأدنى للسعة
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="5"
                        value={minCapacity || ''}
                        onChange={(e) => setMinCapacity(Number(e.target.value))}
                        placeholder="مثال: 40"
                        className="w-full"
                      />
                    </div>

                    {/* Building Filter */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        المبنى / الجناح
                      </label>
                      <select
                        value={selectedBuilding}
                        onChange={(e) => setSelectedBuilding(e.target.value)}
                        className="w-full py-2 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                      >
                        <option value="all">جميع المباني</option>
                        {buildingsList.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    {/* Room Type */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        نوع القاعة
                      </label>
                      <select
                        value={selectedRoomType}
                        onChange={(e) => setSelectedRoomType(e.target.value)}
                        className="w-full py-2 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                      >
                        <option value="all">جميع الأنواع</option>
                        {roomTypesList.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status Header Chips */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    نتائج الفحص للفترة ({selectedTimeSlot}) في يوم {DAYS.find(d => d.id === dateToSystemDay(selectedDate))?.name}:
                  </span>
                  <Badge variant="success">{availableRoomsCount} قاعة متاحة</Badge>
                  <Badge variant="danger">{occupiedRoomsCount} مشغولة</Badge>
                </div>
              </div>

              {/* Grid of Available & Occupied Rooms */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Skeleton key={i} className="h-36 rounded-xl" />
                  ))}
                </div>
              ) : evaluatedRooms.length === 0 ? (
                <EmptyState
                  title="لا توجد قاعات مطابقة"
                  description="جرب تغيير معايير البحث أو الحد الأدنى للسعة"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {evaluatedRooms.map(({ room, isAvailable, occupant }) => (
                    <div
                      key={room.id}
                      className={`p-4 rounded-xl border transition-all duration-200 ${
                        isAvailable
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 hover:shadow-md'
                          : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${isAvailable ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300'}`}>
                            <DoorOpen className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                              {room.name}
                            </h3>
                            <span className="text-xs text-slate-500">
                              السعة: {room.capacity} مقعد | {room.building || 'المجمع الرئيسي'}
                            </span>
                          </div>
                        </div>

                        <Badge variant={isAvailable ? 'success' : 'danger'}>
                          {isAvailable ? 'متاحة الآن' : 'مشغولة'}
                        </Badge>
                      </div>

                      {/* Occupant Details if Busy */}
                      {!isAvailable && occupant && (
                        <div className="mt-3 p-2.5 rounded-lg bg-rose-100/60 dark:bg-rose-900/30 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                          <div className="flex items-center justify-between font-semibold">
                            <span>{occupant.course}</span>
                            <span className="font-mono text-[11px]">{occupant.time}</span>
                          </div>
                          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
                            <span>الأستاذ: {occupant.professor}</span>
                            <span>|</span>
                            <span>الفوج: {occupant.group}</span>
                          </div>
                          {occupant.type === 'extra' && (
                            <div className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                              (حصة إضافية / تعويضية مسجلة)
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quick Booking Button for Available Room */}
                      {isAvailable && (
                        <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between">
                          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                            جاهزة للبرمجة
                          </span>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleQuickBook(room.id, selectedDate, selectedTimeSlot)}
                            className="text-xs gap-1 py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>حجز هذه القاعة</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabContent>

          {/* ================================================================= */}
          {/* TAB 2: MAKE-UP & EXTRA SESSIONS BOOKING                           */}
          {/* ================================================================= */}
          <TabContent value="booking">
            <div className="max-w-3xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-emerald-600" />
                    <span>برمجة حصة إضافية أو تعويضية جديدة</span>
                  </CardTitle>
                  <CardDescription>
                    قم بتعبئة بيانات الحصة وسيقوم المحرك الذكي بالتحقق الفوري من عدم تعارض القاعة والأستاذ والفوج
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateSession} className="space-y-4">
                    {/* Success & Error alerts */}
                    {bookingSuccessMsg && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>{bookingSuccessMsg}</span>
                      </div>
                    )}
                    {bookingErrorMsg && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                        <span>{bookingErrorMsg}</span>
                      </div>
                    )}

                    {/* Conflict Warnings */}
                    {currentBookingConflicts.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-xs text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>تحذير: تم اكتشاف تعارض في التوقيت!</span>
                        </div>
                        <ul className="list-disc list-inside text-xs space-y-1">
                          {currentBookingConflicts.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Session Type */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          نوع الحصة *
                        </label>
                        <select
                          value={bookingType}
                          onChange={(e) => setBookingType(e.target.value)}
                          className="w-full py-2.5 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                        >
                          <option value="makeup">حصة تعويضية (Rattrapage)</option>
                          <option value="extra">حصة إضافية (Séance supplémentaire)</option>
                          <option value="exam">امتحان / اختبار استدراكي (Examen)</option>
                        </select>
                      </div>

                      {/* Date */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          تاريخ الحصة *
                        </label>
                        <Input
                          type="date"
                          value={bookingDate}
                          onChange={(e) => setBookingDate(e.target.value)}
                          required
                          className="w-full"
                        />
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          يوافق: {DAYS.find(d => d.id === dateToSystemDay(bookingDate))?.name}
                        </span>
                      </div>

                      {/* Time Slot */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          الفترة الزمنية *
                        </label>
                        <select
                          value={bookingTimeSlot}
                          onChange={(e) => setBookingTimeSlot(e.target.value)}
                          className="w-full py-2.5 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                        >
                          {TIME_SLOTS.map(slot => (
                            <option key={slot} value={slot}>{slot}</option>
                          ))}
                        </select>
                      </div>

                      {/* Room Select */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          القاعة المطلوبة *
                        </label>
                        <select
                          value={bookingRoomId}
                          onChange={(e) => setBookingRoomId(e.target.value)}
                          required
                          className="w-full py-2.5 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                        >
                          <option value="">-- اختر القاعة --</option>
                          {rooms.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name} (السعة: {r.capacity}) - {r.building || 'المجمع الرئيسي'}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Professor Select */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          الأستاذ المعني *
                        </label>
                        <select
                          value={bookingProfessorId}
                          onChange={(e) => setBookingProfessorId(e.target.value)}
                          required
                          className="w-full py-2.5 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                        >
                          <option value="">-- اختر الأستاذ --</option>
                          {professors.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.title ? `(${p.title})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Course Select */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          المقياس / المادة *
                        </label>
                        <select
                          value={bookingCourseId}
                          onChange={(e) => setBookingCourseId(e.target.value)}
                          required
                          className="w-full py-2.5 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                        >
                          <option value="">-- اختر المقياس --</option>
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.code ? `[${c.code}]` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Group Select */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          الفوج المعني (اختياري)
                        </label>
                        <select
                          value={bookingGroupId}
                          onChange={(e) => setBookingGroupId(e.target.value)}
                          className="w-full py-2.5 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                        >
                          <option value="">-- جميع الأفواج أو الدفعة كاملة --</option>
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>
                              {g.name} {g.specialization ? `(${g.specialization})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Reason / Note */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          سبب البرمجة أو ملاحظات
                        </label>
                        <Input
                          type="text"
                          value={bookingReason}
                          onChange={(e) => setBookingReason(e.target.value)}
                          placeholder="مثال: تعويض حصة الأحد الماضي"
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Optional Exam Note */}
                    {bookingType === 'exam' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          ملاحظات خاصة بالامتحان (الحراسة، التعليمات)
                        </label>
                        <Input
                          type="text"
                          value={bookingExamNote}
                          onChange={(e) => setBookingExamNote(e.target.value)}
                          placeholder="تعليمات إضافية للمراقبين والطلبة"
                          className="w-full"
                        />
                      </div>
                    )}

                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setBookingRoomId('');
                          setBookingProfessorId('');
                          setBookingCourseId('');
                          setBookingGroupId('');
                          setBookingReason('');
                          setBookingErrorMsg('');
                          setBookingSuccessMsg('');
                        }}
                      >
                        إعادة تعيين
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={bookingSubmitting || currentBookingConflicts.length > 0}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Plus className="h-4 w-4" />
                        <span>{bookingSubmitting ? 'جاري الحفظ...' : 'تأكيد وحجز الحصة'}</span>
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabContent>

          {/* ================================================================= */}
          {/* TAB 3: ROOM AVAILABILITY MATRIX                                   */}
          {/* ================================================================= */}
          <TabContent value="matrix">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      <span>مصفوفة شغور القاعات لجميع الفترات اليومية</span>
                    </CardTitle>
                    <CardDescription>
                      عرض شامل لجميع القاعات عبر فترات اليوم: انقر على أي خانة شاغرة لحجز الحصة فيها مباشرة
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-3">
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-44 text-xs"
                    />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 rounded bg-emerald-500"></span>
                        <span>شاغرة</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 rounded bg-rose-500"></span>
                        <span>حصة رسمية</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 rounded bg-amber-500"></span>
                        <span>تعويضية</span>
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-center text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-3 px-3 text-start font-bold border-e border-slate-200 dark:border-slate-700 w-44">
                          القاعة / السعة
                        </th>
                        {TIME_SLOTS.map(slot => (
                          <th key={slot} className="py-3 px-2 font-bold border-e border-slate-200 dark:border-slate-700 last:border-e-0">
                            {slot}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.map(room => {
                        const sysDay = dateToSystemDay(selectedDate);
                        return (
                          <tr key={room.id} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-start border-e border-slate-200 dark:border-slate-800 font-medium">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{room.name}</div>
                              <div className="text-[10px] text-slate-500">
                                {room.capacity} مقعد | {room.building || 'الرئيسي'}
                              </div>
                            </td>

                            {TIME_SLOTS.map(slot => {
                              const [sStart, sEnd] = slot.split(' - ').map(s => s.trim());
                              const reg = regularAssignments.find(a =>
                                a.room_id === room.id &&
                                a.day_of_week === sysDay &&
                                isTimeOverlap(sStart, sEnd, a.start_time, a.end_time)
                              );
                              const extra = extraSessions.find(s =>
                                s.room_id === room.id &&
                                s.session_date === selectedDate &&
                                s.is_archived !== 1 &&
                                isTimeOverlap(sStart, sEnd, s.start_time, s.end_time)
                              );

                              if (reg) {
                                return (
                                  <td
                                    key={slot}
                                    className="py-2 px-1 border-e border-slate-200 dark:border-slate-800 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200"
                                    title={`${reg.course_name} | ${reg.professor_name} | ${reg.group_name}`}
                                  >
                                    <div className="font-bold text-[11px] truncate max-w-[130px] mx-auto">
                                      {reg.course_name}
                                    </div>
                                    <div className="text-[9px] text-rose-600 dark:text-rose-300 truncate max-w-[130px] mx-auto">
                                      {reg.professor_name}
                                    </div>
                                  </td>
                                );
                              }

                              if (extra) {
                                return (
                                  <td
                                    key={slot}
                                    className="py-2 px-1 border-e border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
                                    title={`حصة تعويضية: ${extra.course_name} | ${extra.professor_name}`}
                                  >
                                    <div className="font-bold text-[11px] truncate max-w-[130px] mx-auto">
                                      {extra.course_name}
                                    </div>
                                    <div className="text-[9px] text-amber-700 dark:text-amber-300">
                                      {extra.session_type === 'exam' ? 'امتحان' : 'تعويضية'}
                                    </div>
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={slot}
                                  onClick={() => handleQuickBook(room.id, selectedDate, slot)}
                                  className="py-2 px-1 border-e border-slate-200 dark:border-slate-800 bg-emerald-50/40 dark:bg-emerald-950/10 hover:bg-emerald-100/70 text-emerald-700 dark:text-emerald-400 cursor-pointer transition-colors"
                                  title="انقر لبرمجة حصة في هذه القاعة"
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-semibold">متاحة</span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabContent>

          {/* ================================================================= */}
          {/* TAB 4: SESSIONS LOG & MANAGEMENT                                  */}
          {/* ================================================================= */}
          <TabContent value="log">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-600" />
                      <span>جدول الحصص الإضافية والتعويضات المبرمجة ({filteredSessions.length})</span>
                    </CardTitle>
                    <CardDescription>
                      متابعة وإدارة الحصص وطباعة إعلانات الطلبة وأرشفة الحصص السابقة
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleArchivePast}
                      className="gap-1.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      <span>أرشفة المنتهية</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPrintModalType('list');
                        setPrintModalOpen(true);
                      }}
                      className="gap-1.5 text-xs"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>طباعة القائمة</span>
                    </Button>
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
                  <Input
                    type="text"
                    placeholder="بحث بالأستاذ، المقياس، القاعة، أو الفوج..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="w-full text-xs"
                  />

                  <select
                    value={logTypeFilter}
                    onChange={(e) => setLogTypeFilter(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    <option value="all">جميع أنواع الحصص</option>
                    <option value="makeup">حصص تعويضية</option>
                    <option value="extra">حصص إضافية</option>
                    <option value="exam">امتحانات</option>
                  </select>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="showArchivedCheck"
                      checked={showArchived}
                      onChange={(e) => setShowArchived(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="showArchivedCheck" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      إظهار الحصص المؤرشفة والسابقة
                    </label>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredSessions.length === 0 ? (
                  <EmptyState
                    title="لا توجد حصص مسجلة"
                    description="لم يتم تسجيل أي حصة إضافية أو تعويضية تطابق المعايير المختارة"
                  />
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-start text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                          <th className="py-3 px-3 text-start">التاريخ واليوم</th>
                          <th className="py-3 px-3 text-start">التوقيت</th>
                          <th className="py-3 px-3 text-start">المقياس</th>
                          <th className="py-3 px-3 text-start">الأستاذ</th>
                          <th className="py-3 px-3 text-start">القاعة</th>
                          <th className="py-3 px-3 text-start">الفوج</th>
                          <th className="py-3 px-3 text-start">النوع</th>
                          <th className="py-3 px-3 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredSessions.map(session => (
                          <tr key={session.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                                {session.session_date}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {DAYS.find(d => d.id === dateToSystemDay(session.session_date))?.name}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono font-semibold">
                              {session.start_time} - {session.end_time}
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">
                              {session.course_name || 'مقياس'}
                            </td>
                            <td className="py-3 px-3">
                              {session.professor_name || 'أستاذ'}
                            </td>
                            <td className="py-3 px-3 font-semibold text-emerald-700 dark:text-emerald-400">
                              {session.room_name || 'قاعة'}
                            </td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                              {session.group_name || 'الدفعة كاملة'}
                            </td>
                            <td className="py-3 px-3">
                              <Badge
                                variant={
                                  session.session_type === 'exam'
                                    ? 'danger'
                                    : session.session_type === 'makeup'
                                    ? 'warning'
                                    : 'info'
                                }
                              >
                                {session.session_type === 'exam'
                                  ? 'امتحان'
                                  : session.session_type === 'makeup'
                                  ? 'تعويضية'
                                  : 'إضافية'}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Print Announcement */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setAnnouncementSession(session);
                                    setPrintModalType('announcement');
                                    setPrintModalOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-emerald-600"
                                  title="طباعة إعلان الحصة للطلبة"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>

                                {/* Delete */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSessionToDelete(session);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-rose-600"
                                  title="حذف الحصة"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <div className="p-6 text-start" dir="rtl">
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <span>تأكيد حذف الحصة</span>
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            هل أنت متأكد من حذف الحصة المبرمجة لمقياس "{sessionToDelete?.course_name}" للأستاذ {sessionToDelete?.professor_name} بتاريخ {sessionToDelete?.session_date}؟
            سيتم تحرير القاعة فورًا.
          </DialogDescription>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              disabled={isDeleting}
              onClick={handleDeleteSession}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? 'جاري الحذف...' : 'نعم، احذف الحصة'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Print Preview & Action Modal */}
      <Dialog open={printModalOpen} onClose={() => setPrintModalOpen(false)} size="xl">
        <div className="p-6 text-start max-w-3xl" dir="rtl">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Printer className="h-5 w-5 text-emerald-600" />
              <span>
                {printModalType === 'announcement'
                  ? 'إعلان للطلبة عن حصة تعويضية / إضافية'
                  : printModalType === 'daily'
                  ? 'تقرير شغور القاعات اليومي'
                  : 'قائمة الحصص الإضافية والتعويضية'}
              </span>
            </DialogTitle>
            <Button
              variant="primary"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة المستند</span>
            </Button>
          </div>

          {/* Printable Layout Container */}
          <div className="bg-white p-6 border rounded-xl print:p-0 print:border-none text-slate-900">
            {/* Algerian Official Header */}
            <div className="text-center border-b pb-4 mb-4">
              <h2 className="font-bold text-sm">الجمهورية الجزائرية الديمقراطية الشعبية</h2>
              <h3 className="font-bold text-xs mt-0.5">وزارة التعليم العالي والبحث العلمي</h3>
              <h4 className="font-semibold text-xs mt-0.5">جامعة الشهيد حمه لخضر - الوادي | كلية العلوم الاقتصادية</h4>
              <div className="text-[11px] text-slate-500 mt-2 font-mono">
                السنة الجامعية: {academicYear} | {semester}
              </div>
            </div>

            {/* Announcement View */}
            {printModalType === 'announcement' && announcementSession && (
              <div className="space-y-6 py-4">
                <div className="text-center">
                  <div className="inline-block px-4 py-1.5 rounded-full border border-slate-900 font-bold text-base">
                    إعـــــــــلان للطلبة
                  </div>
                  <h3 className="mt-2 text-sm font-semibold">
                    بخصوص برمجة {announcementSession.session_type === 'makeup' ? 'حصة تعويضية' : 'حصة إضافية'}
                  </h3>
                </div>

                <div className="border rounded-xl p-4 space-y-3 text-sm leading-relaxed">
                  <p>
                    يُنهى إلى علم طلبة <strong>{announcementSession.group_name || 'الدفعة المعنية'}</strong> أنه قد تم برمجة حصة:
                  </p>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg text-xs">
                    <div><strong>المقياس:</strong> {announcementSession.course_name}</div>
                    <div><strong>الأستاذ:</strong> {announcementSession.professor_name}</div>
                    <div><strong>التاريخ:</strong> {announcementSession.session_date} ({DAYS.find(d => d.id === dateToSystemDay(announcementSession.session_date))?.name})</div>
                    <div><strong>التوقيت:</strong> {announcementSession.start_time} - {announcementSession.end_time}</div>
                    <div><strong>القاعة:</strong> {announcementSession.room_name}</div>
                    <div><strong>النوع:</strong> {announcementSession.session_type === 'makeup' ? 'تعويضية' : 'إضافية'}</div>
                  </div>
                  {announcementSession.reason && (
                    <p className="text-xs text-slate-600">
                      <strong>ملاحظة:</strong> {announcementSession.reason}
                    </p>
                  )}
                </div>

                <div className="flex justify-between pt-6 text-xs font-semibold">
                  <div>مصلحة التدريس والبرمجة</div>
                  <div>إدارة الكلية</div>
                </div>
              </div>
            )}

            {/* Daily Matrix Report View */}
            {printModalType === 'daily' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span>تقرير حالة القاعات ليوم: {DAYS.find(d => d.id === dateToSystemDay(selectedDate))?.name} ({selectedDate})</span>
                  <span>الفترة: {selectedTimeSlot}</span>
                </div>

                <table className="w-full text-xs border border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="p-2 border text-start">القاعة</th>
                      <th className="p-2 border text-center">السعة</th>
                      <th className="p-2 border text-center">الحالة</th>
                      <th className="p-2 border text-start">الملاحظات / الشاغل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluatedRooms.map(({ room, isAvailable, occupant }) => (
                      <tr key={room.id} className="border-b">
                        <td className="p-2 border font-bold">{room.name}</td>
                        <td className="p-2 border text-center font-mono">{room.capacity}</td>
                        <td className="p-2 border text-center font-semibold">
                          {isAvailable ? 'متاحة' : 'مشغولة'}
                        </td>
                        <td className="p-2 border text-slate-600">
                          {occupant ? `${occupant.course} (${occupant.professor})` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sessions List View */}
            {printModalType === 'list' && (
              <div className="space-y-4">
                <div className="text-center font-bold text-sm">
                  قائمة الحصص الإضافية والتعويضية المعتمدة
                </div>
                <table className="w-full text-xs border border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="p-2 border text-start">التاريخ</th>
                      <th className="p-2 border text-center">التوقيت</th>
                      <th className="p-2 border text-start">المقياس</th>
                      <th className="p-2 border text-start">الأستاذ</th>
                      <th className="p-2 border text-center">القاعة</th>
                      <th className="p-2 border text-start">الفوج</th>
                      <th className="p-2 border text-center">النوع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map(s => (
                      <tr key={s.id} className="border-b">
                        <td className="p-1.5 border">{s.session_date}</td>
                        <td className="p-1.5 border text-center font-mono">{s.start_time}-{s.end_time}</td>
                        <td className="p-1.5 border font-semibold">{s.course_name}</td>
                        <td className="p-1.5 border">{s.professor_name}</td>
                        <td className="p-1.5 border text-center font-bold">{s.room_name}</td>
                        <td className="p-1.5 border">{s.group_name || 'عام'}</td>
                        <td className="p-1.5 border text-center">
                          {s.session_type === 'exam' ? 'امتحان' : s.session_type === 'makeup' ? 'تعويضية' : 'إضافية'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
