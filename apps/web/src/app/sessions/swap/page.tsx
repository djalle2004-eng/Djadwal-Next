'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Calendar,
  Clock,
  User,
  BookOpen,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Layers,
  RotateCcw,
  Undo2,
  ArrowRight,
  ShieldCheck,
  DoorOpen,
  Users
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
  Dialog,
  DialogTitle,
  DialogDescription,
  Skeleton,
  EmptyState
} from '@djadwal/ui';

import { api, ApiError } from '@/lib/api';

// Days of the week matching Djadwal standard
const DAYS = [
  { id: 0, name: 'السبت' },
  { id: 1, name: 'الأحد' },
  { id: 2, name: 'الاثنين' },
  { id: 3, name: 'الثلاثاء' },
  { id: 4, name: 'الأربعاء' },
  { id: 5, name: 'الخميس' }
];

// Lecture Time Slots
const TIME_SLOTS = [
  { id: 0, label: '08:00 - 09:30', start: '08:00', end: '09:30' },
  { id: 1, label: '09:30 - 11:00', start: '09:30', end: '11:00' },
  { id: 2, label: '11:00 - 12:30', start: '11:00', end: '12:30' },
  { id: 3, label: '12:30 - 14:00', start: '12:30', end: '14:00' },
  { id: 4, label: '14:00 - 15:30', start: '14:00', end: '15:30' },
  { id: 5, label: '15:30 - 17:00', start: '15:30', end: '17:00' }
];

function isUnspecified(name?: string): boolean {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  return (
    n === 'غير محدد' ||
    n === 'غير معين' ||
    n === 'أستاذ غير محدد' ||
    n === 'unspecified' ||
    n === 'null' ||
    n === 'undefined'
  );
}

interface Assignment {
  id: number;
  group_id: number;
  course_id: number;
  professor_id: number;
  room_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  academic_year?: string;
  semester?: string;
  specialization?: string;
  group_name?: string;
  course_name?: string;
  professor_name?: string;
  room_name?: string;
  version?: number;
}

export default function SessionSwapPage() {
  const [sessions, setSessions] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [semester, setSemester] = useState<string>('السداسي الأول');

  // Selected Sessions for Swap
  const [sessionA, setSessionA] = useState<Assignment | null>(null);
  const [sessionB, setSessionB] = useState<Assignment | null>(null);

  // Execution states
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [swapResult, setSwapResult] = useState<{
    success: boolean;
    message: string;
    details?: string[];
    changeLogId?: number;
  } | null>(null);

  // Filters for sessions browser table
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<string>('all');
  const [filterProfessor, setFilterProfessor] = useState<string>('');
  const [filterCourse, setFilterCourse] = useState<string>('');

  // Pagination for sessions browser
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Load Sessions
  const loadSessions = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await api.get<Assignment[]>(
        `/assignments?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&limit=3500`
      );
      if (Array.isArray(data)) {
        setSessions(data);
      }
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [academicYear, semester]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Filtered Sessions List
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterDay !== 'all' && String(s.day_of_week) !== filterDay) {
        return false;
      }
      if (filterTime !== 'all') {
        const slot = TIME_SLOTS.find((t) => String(t.id) === filterTime);
        if (slot && (s.start_time !== slot.start || s.end_time !== slot.end)) {
          return false;
        }
      }
      if (filterProfessor.trim()) {
        const pMatch = (s.professor_name || '').toLowerCase().includes(filterProfessor.toLowerCase().trim());
        if (!pMatch) return false;
      }
      if (filterCourse.trim()) {
        const cMatch = (s.course_name || '').toLowerCase().includes(filterCourse.toLowerCase().trim());
        if (!cMatch) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const m1 = (s.course_name || '').toLowerCase().includes(q);
        const m2 = (s.professor_name || '').toLowerCase().includes(q);
        const m3 = (s.group_name || '').toLowerCase().includes(q);
        const m4 = (s.room_name || '').toLowerCase().includes(q);
        if (!m1 && !m2 && !m3 && !m4) return false;
      }
      return true;
    });
  }, [sessions, filterDay, filterTime, filterProfessor, filterCourse, searchQuery]);

  // Paginated List
  const totalPages = Math.ceil(filteredSessions.length / pageSize) || 1;
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, currentPage]);

  // 3-Way Conflict Engine for Swapping Session A and Session B
  const swapConflictEvaluation = useMemo<{ canSwap: boolean; conflicts: string[] }>(() => {
    if (!sessionA || !sessionB) {
      return { canSwap: false, conflicts: [] };
    }

    if (sessionA.id === sessionB.id) {
      return { canSwap: false, conflicts: ['لا يمكن تبديل الحصة مع نفسها! يرجى اختيار حصتين مختلفتين.'] };
    }

    // If both sessions already share the exact same slot & room
    if (
      sessionA.day_of_week === sessionB.day_of_week &&
      sessionA.start_time === sessionB.start_time &&
      sessionA.end_time === sessionB.end_time &&
      sessionA.room_id === sessionB.room_id
    ) {
      return { canSwap: false, conflicts: ['الحصتان متطابقتان في التوقيت والقاعة بالفعل.'] };
    }

    const conflicts: string[] = [];
    const otherSessions = sessions.filter((s) => s.id !== sessionA.id && s.id !== sessionB.id);

    // Slot of Session A
    const slotA = {
      day: sessionA.day_of_week,
      start: sessionA.start_time,
      end: sessionA.end_time,
      dayName: DAYS.find((d) => d.id === sessionA.day_of_week)?.name || 'غير معروف'
    };

    // Slot of Session B
    const slotB = {
      day: sessionB.day_of_week,
      start: sessionB.start_time,
      end: sessionB.end_time,
      dayName: DAYS.find((d) => d.id === sessionB.day_of_week)?.name || 'غير معروف'
    };

    // 1. Check Professor A moving into Slot B
    if (!isUnspecified(sessionA.professor_name)) {
      const profAConflict = otherSessions.find(
        (s) =>
          s.professor_id === sessionA.professor_id &&
          s.day_of_week === slotB.day &&
          s.start_time < slotB.end &&
          s.end_time > slotB.start
      );
      if (profAConflict) {
        conflicts.push(
          `الأستاذ (${sessionA.professor_name}) لديه حصة أخرى (${profAConflict.course_name} - ${profAConflict.group_name}) يوم ${slotB.dayName} في توقيت الحصة (ب) [${slotB.start}-${slotB.end}].`
        );
      }
    }

    // 2. Check Professor B moving into Slot A
    if (!isUnspecified(sessionB.professor_name)) {
      const profBConflict = otherSessions.find(
        (s) =>
          s.professor_id === sessionB.professor_id &&
          s.day_of_week === slotA.day &&
          s.start_time < slotA.end &&
          s.end_time > slotA.start
      );
      if (profBConflict) {
        conflicts.push(
          `الأستاذ (${sessionB.professor_name}) لديه حصة أخرى (${profBConflict.course_name} - ${profBConflict.group_name}) يوم ${slotA.dayName} في توقيت الحصة (أ) [${slotA.start}-${slotA.end}].`
        );
      }
    }

    // 3. Check Group A moving into Slot B
    if (sessionA.group_id) {
      const groupAConflict = otherSessions.find(
        (s) =>
          s.group_id === sessionA.group_id &&
          s.day_of_week === slotB.day &&
          s.start_time < slotB.end &&
          s.end_time > slotB.start
      );
      if (groupAConflict) {
        conflicts.push(
          `الفوج (${sessionA.group_name}) لديه حصة أخرى (${groupAConflict.course_name}) يوم ${slotB.dayName} في توقيت الحصة (ب) [${slotB.start}-${slotB.end}].`
        );
      }
    }

    // 4. Check Group B moving into Slot A
    if (sessionB.group_id) {
      const groupBConflict = otherSessions.find(
        (s) =>
          s.group_id === sessionB.group_id &&
          s.day_of_week === slotA.day &&
          s.start_time < slotA.end &&
          s.end_time > slotA.start
      );
      if (groupBConflict) {
        conflicts.push(
          `الفوج (${sessionB.group_name}) لديه حصة أخرى (${groupBConflict.course_name}) يوم ${slotA.dayName} في توقيت الحصة (أ) [${slotA.start}-${slotA.end}].`
        );
      }
    }

    // 5. Check Room B availability if times differ
    if (sessionA.room_id && (slotA.day !== slotB.day || slotA.start !== slotB.start)) {
      const roomAOccupiedInSlotB = otherSessions.find(
        (s) =>
          s.room_id === sessionB.room_id &&
          s.day_of_week === slotA.day &&
          s.start_time < slotA.end &&
          s.end_time > slotA.start
      );
      if (roomAOccupiedInSlotB) {
        conflicts.push(
          `القاعة (${sessionB.room_name}) مشغولة بحصة (${roomAOccupiedInSlotB.course_name}) يوم ${slotA.dayName} في توقيت الحصة (أ).`
        );
      }
    }

    return { canSwap: conflicts.length === 0, conflicts };
  }, [sessionA, sessionB, sessions]);

  // Execute Swap Request
  const handleExecuteSwap = async () => {
    if (!sessionA || !sessionB) return;
    setSwapResult(null);

    if (!swapConflictEvaluation.canSwap) {
      setSwapResult({
        success: false,
        message: 'لا يمكن تنفيذ التبديل لوجود تعارضات جدولية:',
        details: swapConflictEvaluation.conflicts
      });
      return;
    }

    try {
      setIsSwapping(true);
      const res: any = await api.post('/assignments/swap', {
        idA: sessionA.id,
        idB: sessionB.id
      });

      setSwapResult({
        success: true,
        message: `تم التبديل الذري بنجاح بين الحصتين #${sessionA.id} و #${sessionB.id}! تم تحديث التوقيت والقاعات تلقائيًا وحفظ سجل التراجع.`
      });

      // Reload dataset
      await loadSessions();

      // Clear selections
      setSessionA(null);
      setSessionB(null);
    } catch (err: any) {
      console.error('Swap execution error:', err);
      const msg =
        err?.statusCode === 409
          ? 'تعارض قفل تفاؤلي: تم تعديل إحدى الحصتين بواسطة مستخدم آخر في هذه اللحظة. يرجى إعادة المحاولة.'
          : err?.messageAr || err?.message || 'فشلت عملية التبديل';
      setSwapResult({
        success: false,
        message: msg
      });
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20" dir="rtl">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-md">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  نظام تبديل الحصص الأكاديمية (Session Swap)
                </h1>
                <Badge variant="success">Atomic UnitOfWork</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تبادل ذري آمن للتوقيت والقاعات بين حصتين دراسيتين مع كشف فوري ثلاثي المحاور لمنع التعارضات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Switch to Legacy */}
            <a
              href="/legacy/session-swap"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 transition-colors"
              title="الانتقال المباشر إلى الشاشة القديمة للمقارنة الفورية"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>الواجهة القديمة (Legacy)</span>
            </a>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadSessions}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </Button>
          </div>
        </div>

        {/* Sub Navigation Strip */}
        <div className="bg-slate-100/70 dark:bg-slate-800/40 border-t border-slate-200/60 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Link
                href="/sessions"
                className="px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                قائمة الحصص والتكليفات
              </Link>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="px-2.5 py-1 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold">
                تبديل حصتين (Session Swap)
              </span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <Link
                href="/sessions/move"
                className="px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                نقل حصة (Session Move)
              </Link>
            </div>

            <div className="text-slate-600 dark:text-slate-300 flex items-center gap-3">
              <span>السنة الدراسية: <strong className="text-slate-900 dark:text-white font-mono">{academicYear}</strong></span>
              <span>•</span>
              <span>السداسي: <strong className="text-blue-700 dark:text-blue-400">{semester}</strong></span>
              <span>•</span>
              <span>إجمالي الحصص المسجلة: <strong className="font-mono text-slate-900 dark:text-white">{sessions.length}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Swap Result Alert */}
        {swapResult && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              swapResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 text-rose-900 dark:text-rose-200'
            }`}
          >
            {swapResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-bold text-sm">{swapResult.message}</div>
              {swapResult.details && swapResult.details.length > 0 && (
                <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                  {swapResult.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* 2-Way Selection Stage Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A */}
          <Card className={`border-2 transition-all ${sessionA ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md' : 'border-dashed border-slate-300 dark:border-slate-700'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                    أ
                  </span>
                  <span>الحصة الأولى (Session A)</span>
                </CardTitle>
                {sessionA && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSessionA(null)}
                    className="text-xs text-rose-600 hover:bg-rose-50"
                  >
                    إلغاء الاختيار
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {sessionA ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-sm text-slate-900 dark:text-slate-100">
                    <span>{sessionA.course_name}</span>
                    <Badge variant="info">#{sessionA.id}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 pt-1">
                    <div>الأستاذ: <strong className="text-slate-900 dark:text-white">{sessionA.professor_name}</strong></div>
                    <div>الفوج: <strong className="text-slate-900 dark:text-white">{sessionA.group_name}</strong></div>
                    <div>القاعة: <strong className="text-emerald-700 dark:text-emerald-400">{sessionA.room_name}</strong></div>
                    <div>اليوم: <strong className="text-indigo-700 dark:text-indigo-400">{DAYS.find((d) => d.id === sessionA.day_of_week)?.name}</strong></div>
                    <div>التوقيت: <strong className="font-mono text-slate-900 dark:text-white">{sessionA.start_time} - {sessionA.end_time}</strong></div>
                    <div>التخصص: <strong className="text-slate-700 dark:text-slate-300">{sessionA.specialization || 'عام'}</strong></div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  اختر الحصة الأولى من جدول الحصص أدناه بالنقر على زر <span className="font-semibold text-indigo-600">"تعيين كحصة (أ)"</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card B */}
          <Card className={`border-2 transition-all ${sessionB ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 shadow-md' : 'border-dashed border-slate-300 dark:border-slate-700'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    ب
                  </span>
                  <span>الحصة الثانية (Session B)</span>
                </CardTitle>
                {sessionB && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSessionB(null)}
                    className="text-xs text-rose-600 hover:bg-rose-50"
                  >
                    إلغاء الاختيار
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {sessionB ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-sm text-slate-900 dark:text-slate-100">
                    <span>{sessionB.course_name}</span>
                    <Badge variant="primary">#{sessionB.id}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 pt-1">
                    <div>الأستاذ: <strong className="text-slate-900 dark:text-white">{sessionB.professor_name}</strong></div>
                    <div>الفوج: <strong className="text-slate-900 dark:text-white">{sessionB.group_name}</strong></div>
                    <div>القاعة: <strong className="text-emerald-700 dark:text-emerald-400">{sessionB.room_name}</strong></div>
                    <div>اليوم: <strong className="text-blue-700 dark:text-blue-400">{DAYS.find((d) => d.id === sessionB.day_of_week)?.name}</strong></div>
                    <div>التوقيت: <strong className="font-mono text-slate-900 dark:text-white">{sessionB.start_time} - {sessionB.end_time}</strong></div>
                    <div>التخصص: <strong className="text-slate-700 dark:text-slate-300">{sessionB.specialization || 'عام'}</strong></div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  اختر الحصة الثانية من جدول الحصص أدناه بالنقر على زر <span className="font-semibold text-blue-600">"تعيين كحصة (ب)"</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Conflict Evaluation Stage & Execute Button */}
        {sessionA && sessionB && (
          <Card className={`border shadow-md ${swapConflictEvaluation.canSwap ? 'bg-emerald-50/30 border-emerald-300' : 'bg-amber-50/40 border-amber-300'}`}>
            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm">
                  {swapConflictEvaluation.canSwap ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span className="text-emerald-900 dark:text-emerald-200">
                        فحص التعارض مكتمل بنجاح: الحصتان متوافقتان تمامًا للتبديل الذري!
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <span className="text-amber-900 dark:text-amber-200">
                        تحذير: تم اكتشاف تعارض في جدول الأستاذ أو الفوج أو القاعة!
                      </span>
                    </>
                  )}
                </div>
                {!swapConflictEvaluation.canSwap && (
                  <ul className="list-disc list-inside text-xs text-amber-800 dark:text-amber-300 space-y-0.5 ps-7">
                    {swapConflictEvaluation.conflicts.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
                {swapConflictEvaluation.canSwap && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 ps-7">
                    سيتم تبادل التوقيت والقاعة بين الحصة #{sessionA.id} والحصة #{sessionB.id} في معاملة قاعدة بيانات ذرية واحدة.
                  </p>
                )}
              </div>

              <Button
                variant="primary"
                size="lg"
                disabled={!swapConflictEvaluation.canSwap || isSwapping}
                onClick={handleExecuteSwap}
                className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shrink-0 font-bold"
              >
                <ArrowLeftRight className="h-4 w-4" />
                <span>{isSwapping ? 'جاري تنفيذ التبديل...' : 'تأكيد وتبديل الحصتين ذريًا'}</span>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Sessions Browser Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4 text-indigo-600" />
                  <span>جدول الحصص والتكليفات المبرمجة ({filteredSessions.length})</span>
                </CardTitle>
                <CardDescription>
                  ابحث عن الحصص المطلوبة واستخدم أزرار التعيين لاختيار الحصة (أ) والحصة (ب)
                </CardDescription>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-3 border-t mt-3">
              <div className="md:col-span-2">
                <Input
                  type="text"
                  placeholder="بحث سريع بالمقياس، الأستاذ، الفوج، أو القاعة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs"
                />
              </div>

              <div>
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="all">جميع الأيام</option>
                  {DAYS.map((d) => (
                    <option key={d.id} value={String(d.id)}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value)}
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="all">جميع الفترات الزمنية</option>
                  {TIME_SLOTS.map((t) => (
                    <option key={t.id} value={String(t.id)}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Input
                  type="text"
                  placeholder="فلترة بالأستاذ..."
                  value={filterProfessor}
                  onChange={(e) => setFilterProfessor(e.target.value)}
                  className="w-full text-xs"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredSessions.length === 0 ? (
              <EmptyState
                title="لا توجد حصص مطابقة"
                description="جرب تغيير معايير البحث أو تصفية الأيام والفترات"
              />
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2.5 px-3 text-start">المعرف</th>
                      <th className="py-2.5 px-3 text-start">اليوم والتوقيت</th>
                      <th className="py-2.5 px-3 text-start">المقياس</th>
                      <th className="py-2.5 px-3 text-start">الأستاذ</th>
                      <th className="py-2.5 px-3 text-start">الفوج والتخصص</th>
                      <th className="py-2.5 px-3 text-start">القاعة</th>
                      <th className="py-2.5 px-3 text-center w-52">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {paginatedSessions.map((session) => {
                      const isA = sessionA?.id === session.id;
                      const isB = sessionB?.id === session.id;
                      return (
                        <tr
                          key={session.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isA ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : isB ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                            #{session.id}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {DAYS.find((d) => d.id === session.day_of_week)?.name || 'غير محدد'}
                            </div>
                            <div className="font-mono text-[11px] text-blue-700 dark:text-blue-400">
                              {session.start_time} - {session.end_time}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {session.course_name}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-200">
                            {session.professor_name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            <div>{session.group_name}</div>
                            {session.specialization && (
                              <div className="text-[10px] text-slate-400">{session.specialization}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-700 dark:text-emerald-400">
                            {session.room_name}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Assign as Session A */}
                              <Button
                                variant={isA ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => setSessionA(session)}
                                className={`text-[11px] py-1 px-2.5 h-7 ${isA ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                              >
                                {isA ? 'الحصة (أ) مفعّلة' : 'تعيين كـ (أ)'}
                              </Button>

                              {/* Assign as Session B */}
                              <Button
                                variant={isB ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => setSessionB(session)}
                                className={`text-[11px] py-1 px-2.5 h-7 ${isB ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                              >
                                {isB ? 'الحصة (ب) مفعّلة' : 'تعيين كـ (ب)'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4 text-xs">
                <span className="text-slate-500">
                  صفحة {currentPage} من {totalPages} (إجمالي {filteredSessions.length} حصة)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    السابق
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    التالي
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

