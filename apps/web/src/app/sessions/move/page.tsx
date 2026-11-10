'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Move,
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
  DoorOpen,
  Users,
  ArrowRight,
  ShieldCheck,
  Check
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
  Skeleton,
  EmptyState
} from '@djadwal/ui';

import { api, ApiError } from '@/lib/api';

// Days of the week in Djadwal
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

interface Room {
  id: number;
  name: string;
  capacity?: number;
  building?: string;
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

interface EvaluatedRoom {
  room: Room;
  isAvailable: boolean;
  occupant?: string;
}

export default function SessionMovePage() {
  const [sessions, setSessions] = useState<Assignment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [semester, setSemester] = useState<string>('السداسي الأول');

  // Selected session to move
  const [selectedSession, setSelectedSession] = useState<Assignment | null>(null);

  // Target destination
  const [targetDay, setTargetDay] = useState<number>(-1);
  const [targetTimeSlotId, setTargetTimeSlotId] = useState<number>(-1);
  const [targetRoomId, setTargetRoomId] = useState<number>(-1);

  // Execution states
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [moveResult, setMoveResult] = useState<{
    success: boolean;
    message: string;
    details?: string[];
  } | null>(null);

  // Filters for sessions browser
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<string>('all');
  const [filterProfessor, setFilterProfessor] = useState<string>('');
  const [filterCourse, setFilterCourse] = useState<string>('');

  // Pagination for sessions browser
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;

  // Load Assignments and Rooms
  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [assignData, roomData] = await Promise.all([
        api.get<Assignment[]>(
          `/assignments?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&limit=3500`
        ),
        api.get<Room[]>('/catalog/rooms?limit=300')
      ]);

      if (Array.isArray(assignData)) setSessions(assignData);
      if (Array.isArray(roomData)) setRooms(roomData);
    } catch (err) {
      console.error('Failed to load move data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [academicYear, semester]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When a session is selected, initialize the target day/time/room
  useEffect(() => {
    if (selectedSession) {
      setTargetDay(selectedSession.day_of_week);
      const matchedSlot = TIME_SLOTS.find(
        (t) => t.start === selectedSession.start_time && t.end === selectedSession.end_time
      );
      setTargetTimeSlotId(matchedSlot ? matchedSlot.id : 0);
      setTargetRoomId(selectedSession.room_id);
      setMoveResult(null);
    }
  }, [selectedSession]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterDay !== 'all' && String(s.day_of_week) !== filterDay) return false;
      if (filterTime !== 'all') {
        const slot = TIME_SLOTS.find((t) => String(t.id) === filterTime);
        if (slot && (s.start_time !== slot.start || s.end_time !== slot.end)) return false;
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

  // Target Slot Data
  const targetSlotData = useMemo(() => {
    return TIME_SLOTS.find((t) => t.id === targetTimeSlotId) || null;
  }, [targetTimeSlotId]);

  // Evaluated Rooms for Target Slot (Recommended Available vs Occupied)
  const evaluatedRooms = useMemo<EvaluatedRoom[]>(() => {
    if (!selectedSession || targetDay === -1 || !targetSlotData) return [];

    const otherSessions = sessions.filter((s) => s.id !== selectedSession.id);

    return rooms
      .map((room) => {
        const occupyingSession = otherSessions.find(
          (s) =>
            s.room_id === room.id &&
            s.day_of_week === targetDay &&
            s.start_time < targetSlotData.end &&
            s.end_time > targetSlotData.start
        );

        return {
          room,
          isAvailable: !occupyingSession,
          occupant: occupyingSession
            ? `${occupyingSession.course_name} (${occupyingSession.group_name || 'فوج'}) - ${occupyingSession.professor_name || ''}`
            : undefined
        };
      })
      .sort((a, b) => {
        // Available rooms first, then by name
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        return a.room.name.localeCompare(b.room.name);
      });
  }, [rooms, sessions, selectedSession, targetDay, targetSlotData]);

  // 3-Way Conflict Engine for Target Destination
  const moveConflictEvaluation = useMemo<{ canMove: boolean; conflicts: string[] }>(() => {
    if (!selectedSession || targetDay === -1 || !targetSlotData || targetRoomId === -1) {
      return { canMove: false, conflicts: [] };
    }

    // Check if target is unchanged
    if (
      selectedSession.day_of_week === targetDay &&
      selectedSession.start_time === targetSlotData.start &&
      selectedSession.end_time === targetSlotData.end &&
      selectedSession.room_id === targetRoomId
    ) {
      return { canMove: false, conflicts: ['لم يتم تغيير أي شيء: الحصة موجودة بالفعل في هذا التوقيت والقاعة.'] };
    }

    const conflicts: string[] = [];
    const otherSessions = sessions.filter((s) => s.id !== selectedSession.id);
    const dayName = DAYS.find((d) => d.id === targetDay)?.name || 'غير معروف';

    // 1. Check Room Conflict
    const roomConflict = otherSessions.find(
      (s) =>
        s.room_id === targetRoomId &&
        s.day_of_week === targetDay &&
        s.start_time < targetSlotData.end &&
        s.end_time > targetSlotData.start
    );
    if (roomConflict) {
      const roomObj = rooms.find((r) => r.id === targetRoomId);
      conflicts.push(
        `القاعة (${roomObj?.name || targetRoomId}) مشغولة بحصة (${roomConflict.course_name} - ${roomConflict.group_name}) يوم ${dayName} في توقيت [${targetSlotData.label}].`
      );
    }

    // 2. Check Professor Conflict
    if (!isUnspecified(selectedSession.professor_name)) {
      const profConflict = otherSessions.find(
        (s) =>
          s.professor_id === selectedSession.professor_id &&
          s.day_of_week === targetDay &&
          s.start_time < targetSlotData.end &&
          s.end_time > targetSlotData.start
      );
      if (profConflict) {
        conflicts.push(
          `الأستاذ (${selectedSession.professor_name}) لديه حصة أخرى (${profConflict.course_name} - ${profConflict.group_name}) يوم ${dayName} في توقيت [${targetSlotData.label}].`
        );
      }
    }

    // 3. Check Group Conflict
    if (selectedSession.group_id) {
      const groupConflict = otherSessions.find(
        (s) =>
          s.group_id === selectedSession.group_id &&
          s.day_of_week === targetDay &&
          s.start_time < targetSlotData.end &&
          s.end_time > targetSlotData.start
      );
      if (groupConflict) {
        conflicts.push(
          `الفوج (${selectedSession.group_name}) لديه حصة أخرى (${groupConflict.course_name}) يوم ${dayName} في توقيت [${targetSlotData.label}].`
        );
      }
    }

    return { canMove: conflicts.length === 0, conflicts };
  }, [selectedSession, targetDay, targetSlotData, targetRoomId, sessions, rooms]);

  // Execute Move
  const handleExecuteMove = async () => {
    if (!selectedSession || !targetSlotData || targetDay === -1 || targetRoomId === -1) return;
    setMoveResult(null);

    if (!moveConflictEvaluation.canMove) {
      setMoveResult({
        success: false,
        message: 'لا يمكن نقل الحصة لوجود تعارضات جدولية:',
        details: moveConflictEvaluation.conflicts
      });
      return;
    }

    try {
      setIsMoving(true);
      await api.post(`/assignments/${selectedSession.id}/move`, {
        day_of_week: targetDay,
        start_time: targetSlotData.start,
        end_time: targetSlotData.end,
        room_id: targetRoomId,
        version: selectedSession.version
      });

      const dayName = DAYS.find((d) => d.id === targetDay)?.name;
      const roomName = rooms.find((r) => r.id === targetRoomId)?.name;

      setMoveResult({
        success: true,
        message: `تم نقل الحصة #${selectedSession.id} بنجاح إلى يوم ${dayName} (${targetSlotData.label}) في القاعة ${roomName}. تم تسجيل العملية في سجل التراجع.`
      });

      // Reload dataset
      await loadData();

      // Reset
      setSelectedSession(null);
      setTargetDay(-1);
      setTargetTimeSlotId(-1);
      setTargetRoomId(-1);
    } catch (err: any) {
      console.error('Move error:', err);
      const msg =
        err?.statusCode === 409
          ? 'تعارض قفل تفاؤلي: تم تعديل هذه الحصة بواسطة مستخدم آخر. يرجى إعادة تحميل الصفحة.'
          : err?.messageAr || err?.message || 'فشلت عملية النقل';
      setMoveResult({
        success: false,
        message: msg
      });
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20" dir="rtl">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 flex items-center justify-center text-white shadow-md">
              <Move className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  نظام نقل الحصص الأكاديمية (Session Move)
                </h1>
                <Badge variant="success">Atomic UnitOfWork</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                إعادة جدولة الحصص الدراسية إلى يوم أو فترة أو قاعة جديدة مع كشف التعارض واقتراح القاعات المتاحة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Switch to Legacy */}
            <a
              href="/legacy/session-move"
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
              onClick={loadData}
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
              <Link
                href="/sessions/swap"
                className="px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                تبديل حصتين (Session Swap)
              </Link>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="px-2.5 py-1 rounded-md bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-bold">
                نقل حصة (Session Move)
              </span>
            </div>

            <div className="text-slate-600 dark:text-slate-300 flex items-center gap-3">
              <span>السنة الدراسية: <strong className="text-slate-900 dark:text-white font-mono">{academicYear}</strong></span>
              <span>•</span>
              <span>السداسي: <strong className="text-blue-700 dark:text-blue-400">{semester}</strong></span>
              <span>•</span>
              <span>القاعات المسجلة: <strong className="font-mono text-slate-900 dark:text-white">{rooms.length}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Result Message */}
        {moveResult && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              moveResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 text-rose-900 dark:text-rose-200'
            }`}
          >
            {moveResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-bold text-sm">{moveResult.message}</div>
              {moveResult.details && moveResult.details.length > 0 && (
                <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                  {moveResult.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Selected Session & Move Workspace */}
        {selectedSession && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Current Session Details */}
            <Card className="border-teal-500 bg-teal-50/20 dark:bg-teal-950/20 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-teal-600" />
                    <span>الحصة المراد نقلها</span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSession(null)}
                    className="text-xs text-rose-600 hover:bg-rose-50"
                  >
                    تغيير الحصة
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center justify-between">
                    <span>{selectedSession.course_name}</span>
                    <Badge variant="info">#{selectedSession.id}</Badge>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 space-y-1">
                    <div>الأستاذ: <strong className="text-slate-900 dark:text-white">{selectedSession.professor_name}</strong></div>
                    <div>الفوج: <strong className="text-slate-900 dark:text-white">{selectedSession.group_name}</strong></div>
                    <div>القاعة الحالية: <strong className="text-teal-700 dark:text-teal-400">{selectedSession.room_name}</strong></div>
                    <div>اليوم الحالي: <strong className="text-indigo-700 dark:text-indigo-400">{DAYS.find((d) => d.id === selectedSession.day_of_week)?.name}</strong></div>
                    <div>التوقيت الحالي: <strong className="font-mono text-slate-900 dark:text-white">{selectedSession.start_time} - {selectedSession.end_time}</strong></div>
                  </div>
                </div>

                {/* Target Destination Summary Preview */}
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs space-y-1.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">الوجهة المستهدفة المحددة:</span>
                  <div className="text-slate-600 dark:text-slate-300">
                    <div>اليوم الجديد: <strong className="text-teal-700 dark:text-teal-400">{DAYS.find((d) => d.id === targetDay)?.name || 'غير محدد'}</strong></div>
                    <div>التوقيت الجديد: <strong className="font-mono text-teal-700 dark:text-teal-400">{targetSlotData?.label || 'غير محدد'}</strong></div>
                    <div>القاعة الجديدة: <strong className="text-emerald-700 dark:text-emerald-400">{rooms.find((r) => r.id === targetRoomId)?.name || 'غير محدد'}</strong></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right Column (2 cols): Target Destination Configuration */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Move className="h-4 w-4 text-teal-600" />
                    <span>تحديد التوقيت واليوم الجديدين</span>
                  </CardTitle>
                  <CardDescription>
                    اختر اليوم والفترة الزمنية، وسيقوم المحرك تلقائيًا بفحص القاعات المتاحة ومنع التعارضات
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Target Day */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        اليوم الجديد *
                      </label>
                      <select
                        value={targetDay}
                        onChange={(e) => setTargetDay(Number(e.target.value))}
                        className="w-full py-2.5 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                      >
                        {DAYS.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Target Time Slot */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        الفترة الزمنية الجديدة *
                      </label>
                      <select
                        value={targetTimeSlotId}
                        onChange={(e) => setTargetTimeSlotId(Number(e.target.value))}
                        className="w-full py-2.5 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                      >
                        {TIME_SLOTS.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Available Rooms Explorer */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        اختر القاعة الجديدة (القاعات الشاغرة موصى بها بالأخضر) *
                      </label>
                      <span className="text-[11px] text-slate-500">
                        {evaluatedRooms.filter((r) => r.isAvailable).length} قاعة متاحة في هذا التوقيت
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 border rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                      {evaluatedRooms.map(({ room, isAvailable, occupant }) => {
                        const isSelected = targetRoomId === room.id;
                        return (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => setTargetRoomId(room.id)}
                            className={`p-2 rounded-lg text-start border transition-all text-xs flex flex-col justify-between ${
                              isSelected
                                ? 'border-teal-600 bg-teal-50 dark:bg-teal-950 text-teal-900 dark:text-teal-200 ring-2 ring-teal-500/20'
                                : isAvailable
                                ? 'border-emerald-200 bg-white dark:bg-slate-900 hover:border-emerald-400 text-slate-800 dark:text-slate-200'
                                : 'border-rose-200 bg-rose-50/30 text-rose-800 dark:text-rose-300 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold">{room.name}</span>
                              {isAvailable ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              ) : (
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate mt-1">
                              {isAvailable ? `سعة: ${room.capacity || 40}` : occupant || 'مشغولة'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Conflict Check Banner */}
                  <div
                    className={`p-3.5 rounded-xl border text-xs ${
                      moveConflictEvaluation.canMove
                        ? 'bg-emerald-50/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                        : 'bg-amber-50/40 border-amber-300 text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold mb-1">
                      {moveConflictEvaluation.canMove ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>التوقيت والقاعة متطابقان بدون أي تعارض!</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span>تحذير تعارض في الوجهة المحددة:</span>
                        </>
                      )}
                    </div>
                    {!moveConflictEvaluation.canMove && (
                      <ul className="list-disc list-inside space-y-0.5 ps-5">
                        {moveConflictEvaluation.conflicts.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    )}
                    {moveConflictEvaluation.canMove && (
                      <p className="ps-6 text-emerald-700 dark:text-emerald-300">
                        تم التحقق من جدول الأستاذ والفوج والقاعة، ويمكنك تأكيد عملية النقل فورًا.
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSession(null)}
                    >
                      إلغاء
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      disabled={!moveConflictEvaluation.canMove || isMoving}
                      onClick={handleExecuteMove}
                      className="gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold"
                    >
                      <Move className="h-4 w-4" />
                      <span>{isMoving ? 'جاري تنفيذ النقل...' : 'تأكيد ونقل الحصة ذريًا'}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Sessions Browser Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4 text-teal-600" />
                  <span>اختر الحصة المراد نقلها من الجدول ({filteredSessions.length})</span>
                </CardTitle>
                <CardDescription>
                  انقر على زر "نقل هذه الحصة" للبدء في تحديد اليوم والقاعة الجديدة
                </CardDescription>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-3 border-t mt-3">
              <div className="md:col-span-2">
                <Input
                  type="text"
                  placeholder="بحث بالمقياس، الأستاذ، الفوج، أو القاعة..."
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
                      <th className="py-2.5 px-3 text-start">الفوج</th>
                      <th className="py-2.5 px-3 text-start">القاعة</th>
                      <th className="py-2.5 px-3 text-center w-36">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {paginatedSessions.map((session) => {
                      const isSelected = selectedSession?.id === session.id;
                      return (
                        <tr
                          key={session.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isSelected ? 'bg-teal-50 dark:bg-teal-950/30' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                            #{session.id}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {DAYS.find((d) => d.id === session.day_of_week)?.name || 'غير محدد'}
                            </div>
                            <div className="font-mono text-[11px] text-teal-700 dark:text-teal-400">
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
                            {session.group_name}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-700 dark:text-emerald-400">
                            {session.room_name}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Button
                              variant={isSelected ? 'primary' : 'outline'}
                              size="sm"
                              onClick={() => setSelectedSession(session)}
                              className={`text-[11px] py-1 px-3 h-7 gap-1 ${isSelected ? 'bg-teal-600 hover:bg-teal-700 text-white' : ''}`}
                            >
                              <Move className="h-3.5 w-3.5" />
                              <span>{isSelected ? 'محددة للنقل' : 'نقل الحصة'}</span>
                            </Button>
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

