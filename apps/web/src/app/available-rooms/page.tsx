'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar,
  Clock,
  DoorOpen,
  Search,
  Plus,
  Trash2,
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
  Layers,
  ChevronDown,
  Info,
  Check,
  X,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Tabs,
  TabsList,
  TabTrigger,
  TabContent,
  Dialog,
  DialogTitle,
  DialogDescription,
  Skeleton,
  EmptyState
} from '@djadwal/ui';

import { api } from '@/lib/api';

// Official Faculty 6 Time Slots
export const OFFICIAL_TIME_SLOTS = [
  '08:00 - 09:30',
  '09:30 - 11:00',
  '11:00 - 12:30',
  '12:30 - 14:00',
  '14:00 - 15:30',
  '15:30 - 17:00'
];

// Djadwal System Days: 0=السبت, 1=الأحد, ..., 6=الجمعة
export const SYSTEM_DAYS = [
  { id: 0, name: 'السبت' },
  { id: 1, name: 'الأحد' },
  { id: 2, name: 'الاثنين' },
  { id: 3, name: 'الثلاثاء' },
  { id: 4, name: 'الأربعاء' },
  { id: 5, name: 'الخميس' },
  { id: 6, name: 'الجمعة' }
];

export function dateToSystemDay(dateStr: string): number {
  if (!dateStr) return 1;
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3) return 1;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const jsDay = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  if (jsDay === 6) return 0; // Saturday
  if (jsDay === 0) return 1; // Sunday
  return jsDay + 1; // Mon-Fri (1-5) -> 2-6
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

export function isTimeOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
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

interface EvaluatedRoom {
  room: Room;
  isAvailable: boolean;
  occupant: {
    type: 'regular' | 'extra';
    course: string;
    professor: string;
    group: string;
    time: string;
    sessionType?: string;
    reason?: string;
  } | null;
  slots?: {
    [slot: string]: {
      status: 'available' | 'occupied_regular' | 'occupied_extra';
      course_name?: string;
      professor_name?: string;
      group_name?: string;
      time?: string;
      session_type?: string;
    };
  };
}

export default function AvailableRoomsPage() {
  const [activeTab, setActiveTab] = useState<string>('search');

  // Core Data Lists
  const [rooms, setRooms] = useState<Room[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [regularAssignments, setRegularAssignments] = useState<Assignment[]>([]);
  const [extraSessions, setExtraSessions] = useState<ExtraSession[]>([]);

  // Page Level State
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [semester, setSemester] = useState<string>('السداسي الأول');

  // Search Filters
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(OFFICIAL_TIME_SLOTS[0]);
  const [minCapacity, setMinCapacity] = useState<number>(0);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all');

  // Backend Live Evaluated Room Data
  const [backendEvaluatedRooms, setBackendEvaluatedRooms] = useState<EvaluatedRoom[] | null>(null);

  // Booking Modal State (Opens as dialog from anywhere)
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingDate, setBookingDate] = useState<string>(todayStr);
  const [bookingTimeSlot, setBookingTimeSlot] = useState<string>(OFFICIAL_TIME_SLOTS[0]);
  const [useCustomTime, setUseCustomTime] = useState<boolean>(false);
  const [customStartTime, setCustomStartTime] = useState<string>('08:00');
  const [customEndTime, setCustomEndTime] = useState<string>('09:30');
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
  const [serverConflicts, setServerConflicts] = useState<string[]>([]);

  // Sessions Log Filters
  const [logSearch, setLogSearch] = useState<string>('');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Deletion Modal
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [sessionToDelete, setSessionToDelete] = useState<ExtraSession | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Print Announcement Modal
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [printModalType, setPrintModalType] = useState<'daily' | 'announcement' | 'list'>('daily');
  const [announcementSession, setAnnouncementSession] = useState<ExtraSession | null>(null);

  // Feedback Notification Banner
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // 1. Initial Load of Master Data
  const loadMasterData = useCallback(async () => {
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
      console.error('Error loading master data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [academicYear, semester]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // 2. Load Real-time Room Availability from Backend Engine
  const loadLiveRoomAvailability = useCallback(async () => {
    if (!selectedDate || !selectedTimeSlot) return;
    try {
      const data = await api.getAvailableRooms({
        date: selectedDate,
        time_slot: selectedTimeSlot,
        academic_year: academicYear,
        semester: semester,
        building: selectedBuilding !== 'all' ? selectedBuilding : undefined,
        room_type: selectedRoomType !== 'all' ? selectedRoomType : undefined,
        min_capacity: minCapacity > 0 ? minCapacity : undefined
      });

      if (data && Array.isArray(data.rooms)) {
        const mapped: EvaluatedRoom[] = data.rooms.map((item: any) => ({
          room: item.room,
          isAvailable: item.is_available,
          occupant: item.occupant ? {
            type: item.occupant.type,
            course: item.occupant.course_name,
            professor: item.occupant.professor_name,
            group: item.occupant.group_name,
            time: `${item.occupant.start_time} - ${item.occupant.end_time}`,
            sessionType: item.occupant.session_type,
            reason: item.occupant.reason
          } : null,
          slots: item.slots
        }));
        setBackendEvaluatedRooms(mapped);
      }
    } catch (err) {
      console.warn('Backend availability fetch fallback to local computation:', err);
      setBackendEvaluatedRooms(null); // Will trigger fallback client computation
    }
  }, [selectedDate, selectedTimeSlot, academicYear, semester, selectedBuilding, selectedRoomType, minCapacity]);

  useEffect(() => {
    loadLiveRoomAvailability();
  }, [loadLiveRoomAvailability]);

  // Unique Buildings & Room Types
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

  // 3. Evaluated Rooms (Uses backend result or computes locally)
  const evaluatedRooms = useMemo((): EvaluatedRoom[] => {
    if (backendEvaluatedRooms && backendEvaluatedRooms.length > 0) {
      return backendEvaluatedRooms;
    }

    const [startTime, endTime] = selectedTimeSlot.split(' - ').map(s => s.trim());
    const sysDay = dateToSystemDay(selectedDate);

    // Filter assignments
    const busyRegular = regularAssignments.filter(a => {
      if (a.day_of_week !== sysDay) return false;
      return isTimeOverlap(startTime, endTime, a.start_time, a.end_time);
    });

    // Filter extra sessions
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
              course: regOccupancy.course_name || 'مقياس رسمي',
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
              sessionType: extraOccupancy.session_type,
              reason: extraOccupancy.reason
            }
          : null;

        // Build slots map
        const slotsState: any = {};
        for (const slot of OFFICIAL_TIME_SLOTS) {
          const [sS, sE] = slot.split(' - ').map(s => s.trim());
          const slotReg = regularAssignments.find(a => a.room_id === room.id && a.day_of_week === sysDay && isTimeOverlap(sS, sE, a.start_time, a.end_time));
          const slotExtra = extraSessions.find(s => s.room_id === room.id && s.session_date === selectedDate && s.is_archived !== 1 && isTimeOverlap(sS, sE, s.start_time, s.end_time));

          if (slotReg) {
            slotsState[slot] = {
              status: 'occupied_regular',
              course_name: slotReg.course_name,
              professor_name: slotReg.professor_name,
              group_name: slotReg.group_name,
              time: `${slotReg.start_time} - ${slotReg.end_time}`
            };
          } else if (slotExtra) {
            slotsState[slot] = {
              status: 'occupied_extra',
              session_type: slotExtra.session_type,
              course_name: slotExtra.course_name,
              professor_name: slotExtra.professor_name,
              group_name: slotExtra.group_name,
              time: `${slotExtra.start_time} - ${slotExtra.end_time}`
            };
          } else {
            slotsState[slot] = { status: 'available' };
          }
        }

        return {
          room,
          isAvailable,
          occupant,
          slots: slotsState
        };
      });
  }, [backendEvaluatedRooms, rooms, regularAssignments, extraSessions, selectedDate, selectedTimeSlot, minCapacity, selectedBuilding, selectedRoomType]);

  const availableRoomsCount = useMemo(() => evaluatedRooms.filter(r => r.isAvailable).length, [evaluatedRooms]);
  const occupiedRoomsCount = useMemo(() => evaluatedRooms.filter(r => !r.isAvailable).length, [evaluatedRooms]);
  const vacancyPercentage = useMemo(() => {
    if (evaluatedRooms.length === 0) return 0;
    return Math.round((availableRoomsCount / evaluatedRooms.length) * 100);
  }, [availableRoomsCount, evaluatedRooms]);

  // 4. Triple Conflict Detection (Local Instant + Server Validation)
  const currentLocalConflicts = useMemo(() => {
    if (!bookingDate) return [];
    let startT = '';
    let endT = '';

    if (useCustomTime) {
      startT = customStartTime;
      endT = customEndTime;
    } else {
      const parts = bookingTimeSlot.split(' - ').map(s => s.trim());
      startT = parts[0];
      endT = parts[1];
    }

    if (!startT || !endT) return [];

    const sysDay = dateToSystemDay(bookingDate);
    const conflicts: string[] = [];

    // Check against regular weekly assignments
    regularAssignments.forEach(a => {
      if (a.day_of_week === sysDay && isTimeOverlap(startT, endT, a.start_time, a.end_time)) {
        if (bookingRoomId && a.room_id === Number(bookingRoomId)) {
          conflicts.push(`تعارض في القاعة: القاعة مشغولة رسمياً بحصة "${a.course_name || 'مقياس'}" للأستاذ ${a.professor_name || ''} (${a.start_time} - ${a.end_time})`);
        }
        if (bookingProfessorId && a.professor_id === Number(bookingProfessorId)) {
          conflicts.push(`تعارض في الأستاذ: الأستاذ مرتبط رسمياً بحصة "${a.course_name || 'مقياس'}" مع فوج ${a.group_name || ''} (${a.start_time} - ${a.end_time})`);
        }
        if (bookingGroupId && a.group_id === Number(bookingGroupId)) {
          conflicts.push(`تعارض في الفوج: الفوج مرتبط رسمياً بحصة "${a.course_name || 'مقياس'}" في القاعة ${a.room_name || ''} (${a.start_time} - ${a.end_time})`);
        }
      }
    });

    // Check against extra sessions on the same date
    extraSessions.forEach(s => {
      if (s.session_date === bookingDate && s.is_archived !== 1 && isTimeOverlap(startT, endT, s.start_time, s.end_time)) {
        if (bookingRoomId && s.room_id === Number(bookingRoomId)) {
          conflicts.push(`تعارض في القاعة: القاعة محجوزة مسبقاً لحصة إضافية/تعويضية "${s.course_name || ''}" (${s.start_time} - ${s.end_time})`);
        }
        if (bookingProfessorId && s.professor_id === Number(bookingProfessorId)) {
          conflicts.push(`تعارض في الأستاذ: الأستاذ مبرمج لحصة إضافية/تعويضية أخرى (${s.start_time} - ${s.end_time})`);
        }
        if (bookingGroupId && s.group_id === Number(bookingGroupId)) {
          conflicts.push(`تعارض في الفوج: الفوج مبرمج لحصة إضافية/تعويضية أخرى (${s.start_time} - ${s.end_time})`);
        }
      }
    });

    return conflicts;
  }, [bookingDate, useCustomTime, customStartTime, customEndTime, bookingTimeSlot, bookingRoomId, bookingProfessorId, bookingGroupId, regularAssignments, extraSessions]);

  // Debounced server conflict check
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      if (!isBookingModalOpen || !bookingDate || !bookingRoomId || !bookingProfessorId) {
        setServerConflicts([]);
        return;
      }

      let startT = '';
      let endT = '';
      if (useCustomTime) {
        startT = customStartTime;
        endT = customEndTime;
      } else {
        const parts = bookingTimeSlot.split(' - ').map(s => s.trim());
        startT = parts[0];
        endT = parts[1];
      }

      try {
        const res = await api.checkExtraSessionConflicts({
          session_date: bookingDate,
          start_time: startT,
          end_time: endT,
          room_id: Number(bookingRoomId),
          professor_id: Number(bookingProfessorId),
          group_id: bookingGroupId ? Number(bookingGroupId) : undefined,
          academic_year: academicYear,
          semester: semester
        });

        if (active && res && Array.isArray(res.conflicts) && res.conflicts.length > 0) {
          setServerConflicts(res.conflicts.map((c: any) => c.message));
        } else if (active) {
          setServerConflicts([]);
        }
      } catch (err) {
        // Ignored; local check acts as solid safeguard
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isBookingModalOpen, bookingDate, bookingRoomId, bookingProfessorId, bookingGroupId, useCustomTime, customStartTime, customEndTime, bookingTimeSlot, academicYear, semester]);

  const allConflicts = useMemo(() => {
    const set = new Set([...currentLocalConflicts, ...serverConflicts]);
    return Array.from(set);
  }, [currentLocalConflicts, serverConflicts]);

  // 5. Open Booking Modal
  const handleOpenBookingModal = (roomId?: number, dateStr?: string, slotStr?: string) => {
    if (roomId) setBookingRoomId(roomId.toString());
    if (dateStr) setBookingDate(dateStr);
    if (slotStr && OFFICIAL_TIME_SLOTS.includes(slotStr)) {
      setBookingTimeSlot(slotStr);
      setUseCustomTime(false);
    }
    setBookingErrorMsg('');
    setBookingSuccessMsg('');
    setIsBookingModalOpen(true);
  };

  // 6. Submit Booking Form (Atomic Creation with Idempotency)
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingErrorMsg('');
    setBookingSuccessMsg('');

    if (!bookingRoomId || !bookingProfessorId || !bookingCourseId || !bookingDate) {
      setBookingErrorMsg('يرجى ملء جميع الحقول الإلزامية: القاعة، الأستاذ، المقياس، والتاريخ');
      return;
    }

    let startTime = '';
    let endTime = '';

    if (useCustomTime) {
      if (!customStartTime || !customEndTime) {
        setBookingErrorMsg('يرجى تحديد وقت البداية ووقت النهاية للحصة');
        return;
      }
      startTime = customStartTime;
      endTime = customEndTime;
    } else {
      const parts = bookingTimeSlot.split(' - ').map(s => s.trim());
      startTime = parts[0];
      endTime = parts[1];
    }

    if (allConflicts.length > 0) {
      setBookingErrorMsg('لا يمكن حفظ الحصة لوجود تعارض في التوقيت أو القاعة أو الأستاذ أو الفوج.');
      return;
    }

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

      const res = await api.createExtraSession(payload);

      // Append locally for instantaneous reactivity
      const roomObj = rooms.find(r => r.id === Number(bookingRoomId));
      const profObj = professors.find(p => p.id === Number(bookingProfessorId));
      const courseObj = courses.find(c => c.id === Number(bookingCourseId));
      const groupObj = groups.find(g => g.id === Number(bookingGroupId));

      const newSession: ExtraSession = {
        id: res.id || Date.now(),
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
        semester: semester,
        room_name: roomObj?.name,
        professor_name: profObj?.name,
        course_name: courseObj?.name,
        group_name: groupObj?.name
      };

      setExtraSessions(prev => [newSession, ...prev]);

      // Show notification & close modal
      showNotification('success', `تم حجز القاعة "${roomObj?.name || bookingRoomId}" وبرمجة الحصة بنجاح!`);
      setIsBookingModalOpen(false);

      // Clear non-retained fields
      setBookingReason('');
      setBookingExamNote('');

      // Refresh live availability and master data
      loadLiveRoomAvailability();
      loadMasterData();
    } catch (err: any) {
      console.error('Booking failed:', err);
      setBookingErrorMsg(err?.messageAr || err?.message || 'فشلت عملية برمجة الحصة');
    } finally {
      setBookingSubmitting(false);
    }
  };

  // 7. Delete / Cancel Session
  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteExtraSession(sessionToDelete.id);
      setExtraSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
      showNotification('success', 'تم إلغاء الحصة بنجاح وتحرير القاعة في النظام');
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
      loadLiveRoomAvailability();
      loadMasterData();
    } catch (err: any) {
      alert(err?.message || 'فشل حذف الحصة');
    } finally {
      setIsDeleting(false);
    }
  };

  // 8. Archive Past Sessions
  const handleArchivePast = async () => {
    try {
      setRefreshing(true);
      const res: any = await api.archivePastExtraSessions();
      showNotification('success', res?.message || 'تمت أرشفة الحصص السابقة بنجاح');
      await loadMasterData();
      await loadLiveRoomAvailability();
    } catch (err: any) {
      alert('حدث خطأ أثناء أرشفة الحصص المنتهية');
    } finally {
      setRefreshing(false);
    }
  };

  // Filtered Sessions Log
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

  const currentSystemDayObj = SYSTEM_DAYS.find(d => d.id === dateToSystemDay(selectedDate));

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-16 font-sans" dir="rtl">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-semibold ${
              notification.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
                : 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors ms-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header & Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <DoorOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  محرك كشف الشغور وبرمجة الحصص التعويضية
                </h1>
                <Badge variant="success">Real-Time Engine</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                فحص شغور القاعات لحظيًا، كشف التعارضات الثلاثي، ومصفوفة الحصص التعويضية والإضافية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Action: New Session Modal */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenBookingModal()}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>برمجة حصة جديدة</span>
            </Button>

            {/* Link to Legacy UI */}
            <a
              href="/legacy/available-rooms"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 transition-colors"
              title="الانتقال إلى الواجهة السابقة للمقارنة والتحقق"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>الواجهة القديمة (Legacy)</span>
            </a>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadMasterData();
                loadLiveRoomAvailability();
              }}
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
            <div className="flex items-center gap-3">
              <span>السنة الدراسية: <strong className="text-slate-900 dark:text-white font-mono">{academicYear}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>السداسي: <strong className="text-slate-900 dark:text-white">{semester}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>اليوم المحدد: <strong className="text-emerald-700 dark:text-emerald-400">{currentSystemDayObj?.name} ({selectedDate})</strong></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>الفترة الحالية: <strong className="font-mono text-slate-900 dark:text-slate-100">{selectedTimeSlot}</strong></span>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"></span>
                <span>المتاحة: <strong>{availableRoomsCount}</strong></span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200 dark:ring-rose-900"></span>
                <span>المشغولة: <strong>{occupiedRoomsCount}</strong></span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-500"></span>
                <span>نسبة الشغور: <strong>{vacancyPercentage}%</strong></span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
                <span>الحصص المحجوزة: <strong>{extraSessions.length}</strong></span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Tabs defaultValue="search" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 grid grid-cols-3 w-full max-w-xl">
            <TabTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              <span>فحص شغور القاعات</span>
            </TabTrigger>
            <TabTrigger value="matrix" className="gap-2">
              <Layers className="h-4 w-4" />
              <span>مصفوفة الشغور اليومية</span>
            </TabTrigger>
            <TabTrigger value="log" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span>سجل الحصص المحجوزة</span>
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Filter className="h-4 w-4 text-emerald-600" />
                      <span>معايير البحث اللحظي عن القاعات الشاغرة</span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
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
                        <span>طباعة تقرير شغور القاعات</span>
                      </Button>
                    </div>
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
                        className="w-full text-xs font-mono"
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        يوافق: <strong className="text-emerald-700 dark:text-emerald-400">{currentSystemDayObj?.name}</strong>
                      </span>
                    </div>

                    {/* Time Slot Picker (6 Official slots) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        الفترة الزمنية الرسمية
                      </label>
                      <select
                        value={selectedTimeSlot}
                        onChange={(e) => setSelectedTimeSlot(e.target.value)}
                        className="w-full py-2 px-3 text-xs font-mono font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                      >
                        {OFFICIAL_TIME_SLOTS.map(slot => (
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
                        placeholder="مثال: 40 مقعد"
                        className="w-full text-xs"
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
                        className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
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
                        className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
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
                    نتائج الفحص للفترة ({selectedTimeSlot}) في يوم {currentSystemDayObj?.name}:
                  </span>
                  <Badge variant="success">{availableRoomsCount} قاعة متاحة</Badge>
                  <Badge variant="danger">{occupiedRoomsCount} مشغولة</Badge>
                </div>
              </div>

              {/* Grid of Available & Occupied Rooms */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Skeleton key={i} className="h-44 rounded-2xl" />
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
                      className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                        isAvailable
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 shadow-sm hover:shadow-md'
                          : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/80'
                      }`}
                    >
                      <div>
                        {/* Room Header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2.5 rounded-xl ${
                                isAvailable
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300'
                              }`}
                            >
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

                        {/* Occupant Details if Busy (Red) */}
                        {!isAvailable && occupant && (
                          <div className="p-3 rounded-xl bg-rose-100/70 dark:bg-rose-900/40 text-xs text-rose-900 dark:text-rose-200 space-y-1.5 border border-rose-200 dark:border-rose-800/50">
                            <div className="flex items-center justify-between font-bold">
                              <span className="truncate">{occupant.course}</span>
                              <span className="font-mono text-[11px] shrink-0">{occupant.time}</span>
                            </div>
                            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 text-[11px]">
                              <span>الأستاذ: <strong>{occupant.professor}</strong></span>
                              <span>•</span>
                              <span>الفوج: <strong>{occupant.group}</strong></span>
                            </div>
                            {occupant.type === 'extra' && (
                              <div className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1 pt-1 border-t border-rose-200/50">
                                <AlertTriangle className="h-3 w-3" />
                                <span>(حصة إضافية / تعويضية مسجلة)</span>
                                {occupant.reason && <span>- {occupant.reason}</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Immediate Booking Button for Available Room (Green) */}
                      {isAvailable && (
                        <div className="mt-4 pt-3 border-t border-emerald-200/80 dark:border-emerald-800/50 flex items-center justify-between">
                          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>جاهزة للحجز الفوري</span>
                          </span>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleOpenBookingModal(room.id, selectedDate, selectedTimeSlot)}
                            className="text-xs gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>حجز حصة تعويضية / إضافية</span>
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
          {/* TAB 2: ROOM AVAILABILITY MATRIX                                   */}
          {/* ================================================================= */}
          <TabContent value="matrix">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      <span>مصفوفة شغور القاعات عبر الفترات الست اليومية</span>
                    </CardTitle>
                    <CardDescription>
                      انقر مباشرة على أي خانة خضراء شاغرة لفتح نموذج الحجز المسبق التعبئة بالقاعة والوقت
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-40 text-xs font-mono"
                    />

                    <div className="flex items-center gap-3 text-xs bg-slate-100 dark:bg-slate-800 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                        <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                        <span>شاغرة</span>
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400">
                        <span className="h-3 w-3 rounded-full bg-rose-500"></span>
                        <span>رسمية</span>
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                        <span className="h-3 w-3 rounded-full bg-amber-500"></span>
                        <span>تعويضية</span>
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPrintModalType('daily');
                        setPrintModalOpen(true);
                      }}
                      className="gap-1.5 text-xs"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>طباعة المصفوفة</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                  <table className="w-full text-center text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-3.5 px-4 text-start font-bold border-e border-slate-200 dark:border-slate-700 w-48">
                          القاعة / السعة
                        </th>
                        {OFFICIAL_TIME_SLOTS.map(slot => (
                          <th key={slot} className="py-3.5 px-2 font-bold font-mono border-e border-slate-200 dark:border-slate-700 last:border-e-0">
                            {slot}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.map(room => {
                        const sysDay = dateToSystemDay(selectedDate);
                        return (
                          <tr key={room.id} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                            <td className="py-2.5 px-4 text-start border-e border-slate-200 dark:border-slate-800 font-medium">
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{room.name}</div>
                              <div className="text-[11px] text-slate-500">
                                {room.capacity} مقعد • {room.building || 'الرئيسي'}
                              </div>
                            </td>

                            {OFFICIAL_TIME_SLOTS.map(slot => {
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

                              // Regular Occupancy (Red)
                              if (reg) {
                                return (
                                  <td
                                    key={slot}
                                    className="py-2 px-1.5 border-e border-slate-200 dark:border-slate-800 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
                                    title={`${reg.course_name} | ${reg.professor_name} | ${reg.group_name}`}
                                  >
                                    <div className="font-bold text-[11px] truncate max-w-[130px] mx-auto">
                                      {reg.course_name}
                                    </div>
                                    <div className="text-[9px] text-rose-700 dark:text-rose-300 truncate max-w-[130px] mx-auto">
                                      {reg.professor_name}
                                    </div>
                                  </td>
                                );
                              }

                              // Extra / Make-up Occupancy (Amber)
                              if (extra) {
                                return (
                                  <td
                                    key={slot}
                                    className="py-2 px-1.5 border-e border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                                    title={`حصة تعويضية: ${extra.course_name} | ${extra.professor_name}`}
                                  >
                                    <div className="font-bold text-[11px] truncate max-w-[130px] mx-auto">
                                      {extra.course_name}
                                    </div>
                                    <div className="text-[9px] text-amber-800 dark:text-amber-300 font-semibold">
                                      {extra.session_type === 'exam' ? 'امتحان' : 'تعويضية'}
                                    </div>
                                  </td>
                                );
                              }

                              // Available Cell (Green & Clickable to Book)
                              return (
                                <td
                                  key={slot}
                                  onClick={() => handleOpenBookingModal(room.id, selectedDate, slot)}
                                  className="py-2 px-1.5 border-e border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 cursor-pointer transition-colors group"
                                  title="انقر مباشرة لحجز هذه القاعة في هذا التوقيت"
                                >
                                  <div className="flex items-center justify-center gap-1 font-semibold text-[11px] group-hover:scale-105 transition-transform">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>شاغرة</span>
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
          {/* TAB 3: SESSIONS LOG & REGISTRY                                    */}
          {/* ================================================================= */}
          <TabContent value="log">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-600" />
                      <span>سجل الحصص الإضافية والتعويضات المبرمجة ({filteredSessions.length})</span>
                    </CardTitle>
                    <CardDescription>
                      متابعة الحصص، إلغاؤها، طباعة إعلانات الطلبة المعلقة، وأرشفة الحصص السابقة
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
                    <option value="makeup">حصص تعويضية (Rattrapage)</option>
                    <option value="extra">حصص إضافية (Séance supplémentaire)</option>
                    <option value="revision">حصص مراجعة (Révision)</option>
                    <option value="exam">امتحانات تعويضية (Examen)</option>
                    <option value="semester_exam">امتحانات السداسي (Examen de semestre)</option>
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
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                    <table className="w-full text-start text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                          <th className="py-3.5 px-3 text-start">التاريخ واليوم</th>
                          <th className="py-3.5 px-3 text-start">التوقيت</th>
                          <th className="py-3.5 px-3 text-start">المقياس</th>
                          <th className="py-3.5 px-3 text-start">الأستاذ</th>
                          <th className="py-3.5 px-3 text-start">القاعة</th>
                          <th className="py-3.5 px-3 text-start">الفوج / الدفعة</th>
                          <th className="py-3.5 px-3 text-start">نوع الحصة</th>
                          <th className="py-3.5 px-3 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredSessions.map(session => (
                          <tr key={session.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                                {session.session_date}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {SYSTEM_DAYS.find(d => d.id === dateToSystemDay(session.session_date))?.name}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono font-semibold">
                              {session.start_time} - {session.end_time}
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">
                              {session.course_name || 'مقياس'}
                            </td>
                            <td className="py-3 px-3 font-medium">
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
                                  session.session_type === 'exam' || session.session_type === 'semester_exam'
                                    ? 'danger'
                                    : session.session_type === 'makeup'
                                    ? 'warning'
                                    : 'info'
                                }
                              >
                                {session.session_type === 'exam'
                                  ? 'امتحان'
                                  : session.session_type === 'semester_exam'
                                  ? 'امتحان سداسي'
                                  : session.session_type === 'makeup'
                                  ? 'تعويضية'
                                  : session.session_type === 'revision'
                                  ? 'مراجعة'
                                  : 'إضافية'}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Print Student Announcement */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setAnnouncementSession(session);
                                    setPrintModalType('announcement');
                                    setPrintModalOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-emerald-600"
                                  title="طباعة إعلان رسمي للطلبة"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>

                                {/* Delete / Cancel */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSessionToDelete(session);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-rose-600"
                                  title="إلغاء وحذف الحصة"
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

      {/* ===================================================================== */}
      {/* BOOKING MODAL (Dialog Available Everywhere)                           */}
      {/* ===================================================================== */}
      <Dialog open={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)}>
        <div className="p-6 text-start max-w-2xl" dir="rtl">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              <span>برمجة حصة تعويضية / إضافية وحجز القاعة</span>
            </DialogTitle>
            <button
              onClick={() => setIsBookingModalOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleCreateSession} className="space-y-4">
            {/* Error & Success alerts */}
            {bookingErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{bookingErrorMsg}</span>
              </div>
            )}

            {/* Triple Conflict Warning Alert */}
            {allConflicts.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>تم اكتشاف تعارض في الجدولة (يمنع الحجز حتى المعالجة):</span>
                </div>
                <ul className="list-disc list-inside text-xs space-y-1 font-medium">
                  {allConflicts.map((c, i) => (
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
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="makeup">حصة تعويضية (Rattrapage)</option>
                  <option value="extra">حصة إضافية (Séance supplémentaire)</option>
                  <option value="revision">حصة مراجعة (Révision)</option>
                  <option value="exam">امتحان تعويضي / فروض محروسة (Examen)</option>
                  <option value="semester_exam">امتحان السداسي (Examen de semestre)</option>
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
                  className="w-full text-xs font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  اليوم: <strong className="text-emerald-700 dark:text-emerald-400">{SYSTEM_DAYS.find(d => d.id === dateToSystemDay(bookingDate))?.name}</strong>
                </span>
              </div>

              {/* Time Slot (6 Official Slots or Custom) */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    التوقيت *
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseCustomTime(!useCustomTime)}
                    className="text-[11px] text-indigo-600 hover:underline font-medium"
                  >
                    {useCustomTime ? 'العودة للفترات الرسمية' : 'تحديد توقيت مخصص'}
                  </button>
                </div>

                {!useCustomTime ? (
                  <select
                    value={bookingTimeSlot}
                    onChange={(e) => setBookingTimeSlot(e.target.value)}
                    className="w-full py-2 px-3 text-xs font-mono font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    {OFFICIAL_TIME_SLOTS.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-1">وقت البداية</span>
                      <Input
                        type="time"
                        value={customStartTime}
                        onChange={(e) => setCustomStartTime(e.target.value)}
                        className="w-full text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-1">وقت النهاية</span>
                      <Input
                        type="time"
                        value={customEndTime}
                        onChange={(e) => setCustomEndTime(e.target.value)}
                        className="w-full text-xs font-mono"
                        required
                      />
                    </div>
                  </div>
                )}
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
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="">-- اختر القاعة --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} (السعة: {r.capacity}) - {r.building || 'الرئيسي'}
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
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
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
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
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
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="">-- جميع الأفواج أو الدفعة كاملة --</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} {g.specialization ? `(${g.specialization})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason / Motif */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  سبب التعويض أو ملاحظات الإعلان
                </label>
                <Input
                  type="text"
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  placeholder="مثال: تعويض حصة الأحد الماضي المتغيب فيها الأستاذ لسبب مبرر"
                  className="w-full text-xs"
                />
              </div>

              {/* Exam Note if Exam */}
              {(bookingType === 'exam' || bookingType === 'semester_exam') && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    ملاحظات الامتحان (الحراسة والتعليمات)
                  </label>
                  <Input
                    type="text"
                    value={bookingExamNote}
                    onChange={(e) => setBookingExamNote(e.target.value)}
                    placeholder="تعليمات إضافية للطلبة والمراقبين"
                    className="w-full text-xs"
                  />
                </div>
              )}
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBookingModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={bookingSubmitting || allConflicts.length > 0}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
              >
                <Plus className="h-4 w-4" />
                <span>{bookingSubmitting ? 'جاري الحفظ الذري...' : 'تأكيد وحجز الحصة'}</span>
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* ===================================================================== */}
      {/* DELETE CONFIRMATION MODAL                                             */}
      {/* ===================================================================== */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <div className="p-6 text-start" dir="rtl">
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <span>تأكيد إلغاء الحصة وحذفها</span>
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            هل أنت متأكد من إلغاء الحصة المبرمجة لمقياس "{sessionToDelete?.course_name}" للأستاذ {sessionToDelete?.professor_name} بتاريخ {sessionToDelete?.session_date}؟
            سيتم تحرير القاعة في النظام فورًا.
          </DialogDescription>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              تراجع
            </Button>
            <Button
              variant="danger"
              disabled={isDeleting}
              onClick={handleDeleteSession}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs"
            >
              {isDeleting ? 'جاري الإلغاء...' : 'نعم، احذف الحصة'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ===================================================================== */}
      {/* PRINT PREVIEW & OFFICIAL ANNOUNCEMENT MODAL                           */}
      {/* ===================================================================== */}
      <Dialog open={printModalOpen} onClose={() => setPrintModalOpen(false)}>
        <div className="p-6 text-start max-w-3xl" dir="rtl">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Printer className="h-5 w-5 text-emerald-600" />
              <span>
                {printModalType === 'announcement'
                  ? 'إعلان رسمي للطلبة (A4 جاهز للنشر)'
                  : printModalType === 'daily'
                  ? 'تقرير حالة وشغور القاعات اليومي'
                  : 'جدول الحصص التعويضية والإضافية'}
              </span>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
              >
                <Printer className="h-4 w-4" />
                <span>طباعة المستند</span>
              </Button>
              <button
                onClick={() => setPrintModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Printable Layout Container */}
          <div className="bg-white p-6 border rounded-2xl print:p-0 print:border-none text-slate-900 shadow-sm">
            {/* Algerian Official University Header */}
            <div className="text-center border-b pb-4 mb-4">
              <h2 className="font-bold text-sm">الجمهورية الجزائرية الديمقراطية الشعبية</h2>
              <h3 className="font-bold text-xs mt-0.5">وزارة التعليم العالي والبحث العلمي</h3>
              <h4 className="font-semibold text-xs mt-0.5">جامعة الشهيد حمه لخضر - الوادي | كلية العلوم الاقتصادية والتجارية وعلوم التسيير</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">قسم التدريس والبرمجة البيداغوجية</p>
              <div className="text-[11px] text-slate-500 mt-2 font-mono">
                السنة الجامعية: {academicYear} | {semester}
              </div>
            </div>

            {/* View 1: Student Announcement (A4 Notice) */}
            {printModalType === 'announcement' && announcementSession && (
              <div className="space-y-6 py-4">
                <div className="text-center">
                  <div className="inline-block px-6 py-2 rounded-xl border-2 border-slate-900 font-bold text-lg bg-slate-50">
                    إعـــــــــلان للطلبة
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-slate-800">
                    بخصوص برمجة{' '}
                    {announcementSession.session_type === 'makeup'
                      ? 'حصة تعويضية'
                      : announcementSession.session_type === 'exam'
                      ? 'امتحان استدراكي'
                      : 'حصة إضافية'}
                  </h3>
                </div>

                <div className="border border-slate-300 rounded-2xl p-5 space-y-4 text-sm leading-relaxed">
                  <p>
                    يُنهى إلى علم كافة طلبة <strong>{announcementSession.group_name || 'الدفعة المعنية'}</strong> أنه قد تم برمجة الحصة البيداغوجية وفق المعطيات التالية:
                  </p>

                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl text-xs border border-slate-200">
                    <div><strong>المقياس / المادة:</strong> {announcementSession.course_name}</div>
                    <div><strong>الأستاذ المحاضر:</strong> {announcementSession.professor_name}</div>
                    <div>
                      <strong>اليوم والتاريخ:</strong>{' '}
                      {SYSTEM_DAYS.find(d => d.id === dateToSystemDay(announcementSession.session_date))?.name}{' '}
                      ({announcementSession.session_date})
                    </div>
                    <div><strong>الفترة الزمنية:</strong> {announcementSession.start_time} - {announcementSession.end_time}</div>
                    <div><strong>القاعة المخصصة:</strong> {announcementSession.room_name}</div>
                    <div>
                      <strong>طبيعة الحصة:</strong>{' '}
                      {announcementSession.session_type === 'makeup'
                        ? 'حصة تعويضية'
                        : announcementSession.session_type === 'exam'
                        ? 'امتحان تعويضي'
                        : 'حصة إضافية'}
                    </div>
                  </div>

                  {announcementSession.reason && (
                    <div className="text-xs text-slate-700 bg-amber-50/60 p-3 rounded-lg border border-amber-200">
                      <strong>ملاحظة هامة:</strong> {announcementSession.reason}
                    </div>
                  )}

                  {announcementSession.exam_note && (
                    <div className="text-xs text-slate-700 bg-rose-50/60 p-3 rounded-lg border border-rose-200">
                      <strong>تعليمات الامتحان:</strong> {announcementSession.exam_note}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-8 text-xs font-semibold px-4">
                  <div className="text-center">
                    <p>مصلحة البرمجة والتدريس</p>
                    <p className="mt-8 text-slate-400">الختم والتأشيرة</p>
                  </div>
                  <div className="text-center">
                    <p>إدارة الكلية / رئيس القسم</p>
                    <p className="mt-8 text-slate-400">التوقيع</p>
                  </div>
                </div>
              </div>
            )}

            {/* View 2: Daily Matrix Report View */}
            {printModalType === 'daily' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span>تقرير حالة القاعات ليوم: {currentSystemDayObj?.name} ({selectedDate})</span>
                  <span>الفترة المحددة: {selectedTimeSlot}</span>
                </div>

                <table className="w-full text-xs border border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="p-2 border text-start">القاعة</th>
                      <th className="p-2 border text-center">السعة</th>
                      <th className="p-2 border text-center">الحالة</th>
                      <th className="p-2 border text-start">الشاغل / الملاحظات</th>
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
                          {occupant ? `${occupant.course} (${occupant.professor}) - فوج ${occupant.group}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* View 3: Sessions List View */}
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
                        <td className="p-1.5 border font-mono">{s.session_date}</td>
                        <td className="p-1.5 border text-center font-mono">{s.start_time}-{s.end_time}</td>
                        <td className="p-1.5 border font-semibold">{s.course_name}</td>
                        <td className="p-1.5 border">{s.professor_name}</td>
                        <td className="p-1.5 border text-center font-bold">{s.room_name}</td>
                        <td className="p-1.5 border">{s.group_name || 'عام'}</td>
                        <td className="p-1.5 border text-center font-semibold">
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