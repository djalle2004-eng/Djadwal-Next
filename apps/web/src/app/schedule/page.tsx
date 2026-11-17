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
  GripVertical,
  Move,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
  Plus,
  Trash2,
  Edit,
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
import UndoToast from '@/components/UndoToast';
import { TIME_SLOTS, DAYS, normalizeDay, matchesSlot } from '@/constants/timeSlots';
import { useSandbox } from '@/context/SandboxContext';
import SessionFormModal from '@/components/SessionFormModal';

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
  const [courses, setCourses] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [professors, setProfessors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Direct Add / Edit / Delete Session Modals State
  const [isSessionFormOpen, setIsSessionFormOpen] = useState(false);
  const [sessionFormMode, setSessionFormMode] = useState<'add' | 'edit'>('add');
  const [sessionFormSelectedSession, setSessionFormSelectedSession] = useState<Assignment | null>(null);
  const [formDefaultDayId, setFormDefaultDayId] = useState<number>(0);
  const [formDefaultSlot, setFormDefaultSlot] = useState<(typeof TIME_SLOTS)[0] | undefined>(undefined);
  const [deleteConfirmSession, setDeleteConfirmSession] = useState<Assignment | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

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

  // Drag & Drop State
  const [isDndEnabled, setIsDndEnabled] = useState(true);
  const [draggedSession, setDraggedSession] = useState<Assignment | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ dayId: number; slotId: number } | null>(null);
  const [activeConflict, setActiveConflict] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [undoToast, setUndoToast] = useState<{
    show: boolean;
    message: string;
    changeLogId?: number | null;
  }>({
    show: false,
    message: '',
    changeLogId: null,
  });
  const [isUndoing, setIsUndoing] = useState(false);
  const [conflictAlert, setConflictAlert] = useState<{
    isOpen: boolean;
    reason: string;
    session?: Assignment;
    conflictingSession?: Assignment;
  } | null>(null);

  // Sandbox / Simulation Context
  const {
    isSandboxMode,
    stagedAssignments,
    enterSandboxMode,
    exitSandboxMode,
    applySimulatedMove,
    addSimulatedAssignment,
    updateSimulatedAssignment,
    deleteSimulatedAssignment,
    syncLiveAssignments,
    changeCount,
  } = useSandbox();

  // Effective assignments: in simulation mode, display and check against staged assignments
  const effectiveAssignments = isSandboxMode ? stagedAssignments : assignments;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        api.get(`/assignments?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&limit=2000`),
        api.get('/groups?limit=500'),
        api.get('/professors?limit=500'),
        api.get('/rooms?limit=500'),
        api.get('/catalog/courses?limit=1000').catch(() => api.get('/courses?limit=1000').catch(() => [])),
        api.getPrintSettings().catch(() => null),
      ]);

      const [assignRes, groupsRes, profsRes, roomsRes, coursesRes, printRes] = results;

      if (assignRes.status === 'fulfilled' && Array.isArray(assignRes.value)) {
        setAssignments(assignRes.value);
        syncLiveAssignments(assignRes.value);
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
      if (coursesRes && coursesRes.status === 'fulfilled' && Array.isArray(coursesRes.value)) {
        setCourses(coursesRes.value);
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

  // Helper to format session in strict 2-line full-width print card
  const format2LineSession = (a: Assignment) => {
    const isLecture = isLectureSession(a);
    const g = groups.find((item) => item.id === a.group_id);
    const r = rooms.find((item) => item.id === a.room_id);
    const groupName = (a.group_name || g?.name || '').trim();
    const roomName = (a.room_name || r?.name || 'قاعة').trim();
    const courseName = (a.course_name || 'مقياس').trim();
    const professorName = (a.professor_name || 'أستاذ').trim();

    // Group badge or Lecture badge
    let groupOrLectureBadge = 'محاضرة';
    if (!isLecture) {
      const matchFawj = groupName.match(/(الفوج\s*\d+|فوج\s*\d+|ف\s*\.?\s*\d+|G\d+)/i);
      if (matchFawj) {
        const numMatch = matchFawj[0].match(/\d+/);
        groupOrLectureBadge = numMatch ? `الفوج ${parseInt(numMatch[0], 10)}` : matchFawj[0];
      } else if (groupName) {
        groupOrLectureBadge = groupName;
      } else {
        groupOrLectureBadge = 'فوج';
      }
    }

    return {
      isLecture,
      courseName,
      groupOrLectureBadge,
      professorName,
      roomName,
    };
  };

  // Sort sessions: Lecture first, then groups ascending by group number
  const sortCellSessions = (sessions: Assignment[]) => {
    return [...sessions].sort((a, b) => {
      const isLecA = isLectureSession(a);
      const isLecB = isLectureSession(b);
      // 1. Lecture first
      if (isLecA && !isLecB) return -1;
      if (!isLecA && isLecB) return 1;

      // 2. Ascending group numbers
      const numA = (a.group_name?.match(/\d+/) ? parseInt(a.group_name.match(/\d+/)![0], 10) : 999);
      const numB = (b.group_name?.match(/\d+/) ? parseInt(b.group_name.match(/\d+/)![0], 10) : 999);
      if (numA !== numB) return numA - numB;

      return (a.group_name || '').localeCompare(b.group_name || '', 'ar');
    });
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

  // Filtered assignments based on current selection (using effectiveAssignments for simulation support)
  const filteredAssignments = useMemo(() => {
    return effectiveAssignments.filter((a) => {
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
  }, [effectiveAssignments, filterType, selectedEntityId, selectedDayId, selectedSpecialization, selectedYearLevel, sessionTypeFilter, groups]);

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

  // Auto-dismiss undo toast after 6 seconds
  useEffect(() => {
    if (undoToast.show) {
      const timer = setTimeout(() => {
        setUndoToast((prev) => ({ ...prev, show: false }));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [undoToast.show]);

  /**
   * Instant Conflict Detection for Drag & Drop
   * Computes professor, room, group, and lecture vs. subgroup collisions in < 1ms.
   */
  interface ConflictResult {
    hasConflict: boolean;
    reason?: string;
    type?: 'professor' | 'room' | 'group' | 'lecture' | 'same_slot';
    conflictingSession?: Assignment;
  }

  const checkSlotConflict = (
    session: Assignment,
    targetDayId: number,
    targetSlot: (typeof TIME_SLOTS)[0],
    targetRoomId?: number
  ): ConflictResult => {
    const currentDay = normalizeDay(session.day_of_week);
    // 1. Same slot and same room: no conflict, it's just the current position
    if (
      currentDay === targetDayId &&
      matchesSlot(session.start_time, targetSlot.start, targetSlot.end, session.end_time) &&
      (!targetRoomId || targetRoomId === session.room_id)
    ) {
      return { hasConflict: false };
    }

    // Find all assignments in target day and slot (evaluating against effectiveAssignments for simulation support)
    const slotAssignments = effectiveAssignments.filter((a) => {
      if (a.id === session.id) return false;
      const aDay = normalizeDay(a.day_of_week);
      if (aDay !== targetDayId) return false;
      return matchesSlot(a.start_time, targetSlot.start, targetSlot.end, a.end_time);
    });

    const targetRoom = targetRoomId !== undefined ? targetRoomId : session.room_id;

    // Check 1: Professor conflict
    if (session.professor_id) {
      const profConflict = slotAssignments.find((a) => {
        if (!a.professor_id || a.professor_id !== session.professor_id) return false;
        // If same physical room and prof, it's a merged session
        if (targetRoom && a.room_id === targetRoom) return false;
        const profName = session.professor_name || '';
        if (profName.includes('غير معين') || profName === '—') return false;
        return true;
      });

      if (profConflict) {
        return {
          hasConflict: true,
          type: 'professor',
          reason: `تعارض أستاذ: ${session.professor_name || 'الأستاذ'} مبرمج لحصة أخرى (${profConflict.course_name || 'مقرر'} مع ${profConflict.group_name || 'فوج'}) في هذا التوقيت`,
          conflictingSession: profConflict,
        };
      }
    }

    // Check 2: Room conflict (ignore 'عن بعد' / remote rooms)
    if (targetRoom) {
      const roomObj = rooms.find((r) => r.id === targetRoom);
      const roomName = roomObj?.name || session.room_name || '';
      if (!roomName.includes('عن بعد')) {
        const roomConflict = slotAssignments.find((a) => {
          if (!a.room_id || a.room_id !== targetRoom) return false;
          const aRoomName = a.room_name || '';
          if (aRoomName.includes('عن بعد')) return false;
          return true;
        });

        if (roomConflict) {
          return {
            hasConflict: true,
            type: 'room',
            reason: `تعارض قاعة: القاعة (${roomName}) محجوزة بحصة أخرى (${roomConflict.course_name || 'مقرر'} - ${roomConflict.professor_name || 'أستاذ'})`,
            conflictingSession: roomConflict,
          };
        }
      }
    }

    // Check 3: Group conflict & Lecture vs Subgroup conflict
    if (session.group_id) {
      const sessionGroup = groups.find((g) => g.id === session.group_id);
      const isSourceLecture =
        isLectureSession(session) ||
        sessionGroup?.group_type === 'lecture_group' ||
        sessionGroup?.name?.toLowerCase().includes('lecture') ||
        sessionGroup?.name?.includes('محاضرة');

      for (const a of slotAssignments) {
        // Direct same group conflict
        if (a.group_id === session.group_id) {
          return {
            hasConflict: true,
            type: 'group',
            reason: `تعارض فوج: الفوج (${session.group_name || 'المحدد'}) مبرمج لحصة أخرى (${a.course_name || 'مقرر'}) في هذا التوقيت`,
            conflictingSession: a,
          };
        }

        // Check specialization-wide lecture conflict
        const aGroup = groups.find((g) => g.id === a.group_id);
        const sameSpec =
          sessionGroup &&
          aGroup &&
          sessionGroup.specialization &&
          sessionGroup.specialization === aGroup.specialization;

        if (sameSpec) {
          const isTargetLecture =
            isLectureSession(a) ||
            aGroup?.group_type === 'lecture_group' ||
            aGroup?.name?.toLowerCase().includes('lecture') ||
            aGroup?.name?.includes('محاضرة');

          if (isSourceLecture) {
            return {
              hasConflict: true,
              type: 'lecture',
              reason: `تعارض محاضرة: لا يمكن برمجة محاضرة عامة لتخصص (${sessionGroup.specialization}) في وقت توجد به حصة للفوج (${a.group_name})`,
              conflictingSession: a,
            };
          }

          if (isTargetLecture) {
            return {
              hasConflict: true,
              type: 'lecture',
              reason: `تعارض محاضرة: لا يمكن برمجة حصة للفوج (${session.group_name}) في وقت مخصص لمحاضرة عامة (${a.course_name}) لنفس التخصص`,
              conflictingSession: a,
            };
          }
        }
      }
    }

    return { hasConflict: false };
  };

  // Drag Event Handlers
  const handleDragStart = (e: React.DragEvent, session: Assignment) => {
    e.dataTransfer.setData('text/plain', String(session.id));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedSession(session);
    setDragOverCell(null);
    setActiveConflict(null);
  };

  const handleDragEnd = () => {
    setDraggedSession(null);
    setDragOverCell(null);
    setActiveConflict(null);
  };

  const handleDragOver = (e: React.DragEvent, dayId: number, slot: (typeof TIME_SLOTS)[0]) => {
    e.preventDefault();
    if (!draggedSession) return;

    const targetRoomId =
      filterType === 'room' && selectedEntityId !== 'all'
        ? Number(selectedEntityId)
        : draggedSession.room_id
        ? Number(draggedSession.room_id)
        : undefined;

    const conflict = checkSlotConflict(draggedSession, dayId, slot, targetRoomId);

    if (dragOverCell?.dayId !== dayId || dragOverCell?.slotId !== slot.id) {
      setDragOverCell({ dayId, slotId: slot.id });
      setActiveConflict(conflict.hasConflict ? conflict.reason || 'يوجد تعارض في هذه الخانة' : null);
    }

    if (conflict.hasConflict) {
      e.dataTransfer.dropEffect = 'none';
    } else {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragEnter = (e: React.DragEvent, dayId: number, slot: (typeof TIME_SLOTS)[0]) => {
    e.preventDefault();
    if (!draggedSession) return;

    const targetRoomId =
      filterType === 'room' && selectedEntityId !== 'all'
        ? Number(selectedEntityId)
        : draggedSession.room_id
        ? Number(draggedSession.room_id)
        : undefined;

    const conflict = checkSlotConflict(draggedSession, dayId, slot, targetRoomId);
    setDragOverCell({ dayId, slotId: slot.id });
    setActiveConflict(conflict.hasConflict ? conflict.reason || 'يوجد تعارض في هذه الخانة' : null);
  };

  const handleDragLeave = (e: React.DragEvent, dayId: number, slot: (typeof TIME_SLOTS)[0]) => {
    if (dragOverCell?.dayId === dayId && dragOverCell?.slotId === slot.id) {
      setDragOverCell(null);
      setActiveConflict(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetDayId: number, targetSlot: (typeof TIME_SLOTS)[0]) => {
    e.preventDefault();
    if (!draggedSession) return;

    const sessionToMove = draggedSession;
    handleDragEnd();

    const targetRoomId =
      filterType === 'room' && selectedEntityId !== 'all'
        ? Number(selectedEntityId)
        : sessionToMove.room_id
        ? Number(sessionToMove.room_id)
        : undefined;

    // 1. Instant Conflict Detection before dropping
    const conflict = checkSlotConflict(sessionToMove, targetDayId, targetSlot, targetRoomId);
    if (conflict.hasConflict) {
      setConflictAlert({
        isOpen: true,
        reason: conflict.reason || 'تعذر نقل الحصة لوجود تعارض زمني أو مكاني أو بيداغوجي.',
        session: sessionToMove,
        conflictingSession: conflict.conflictingSession,
      });
      return;
    }

    const currentDay = normalizeDay(sessionToMove.day_of_week);
    if (
      currentDay === targetDayId &&
      matchesSlot(sessionToMove.start_time, targetSlot.start, targetSlot.end, sessionToMove.end_time) &&
      (!targetRoomId || targetRoomId === sessionToMove.room_id)
    ) {
      // Same slot, no move needed
      return;
    }

    const targetRoomObj = targetRoomId ? rooms.find((r) => r.id === targetRoomId) : null;
    const targetDayName = DAYS.find((d) => d.id === targetDayId)?.name || 'اليوم المحدد';

    // 2. Simulation Mode (Pure local in-memory update with zero DB writes)
    if (isSandboxMode) {
      applySimulatedMove({
        assignmentId: sessionToMove.id,
        toDayId: targetDayId,
        toStartTime: targetSlot.start,
        toEndTime: targetSlot.end,
        toRoomId: targetRoomId,
        toRoomName: targetRoomObj ? targetRoomObj.name : sessionToMove.room_name,
      });

      setUndoToast({
        show: true,
        message: `⚡ [وضع التجربة] تم نقل حصة (${sessionToMove.course_name || 'المقرر'}) افتراضياً إلى يوم ${targetDayName} (${targetSlot.label})`,
        changeLogId: null,
      });
      return;
    }

    // 2. Optimistic Update (Instantaneous UI response)
    const previousAssignments = [...assignments];
    const updatedAssignment: Assignment = {
      ...sessionToMove,
      day_of_week: targetDayId,
      start_time: targetSlot.start,
      end_time: targetSlot.end,
      room_id: targetRoomId,
      room_name: targetRoomObj ? targetRoomObj.name : sessionToMove.room_name,
      version: (sessionToMove.version || 1) + 1,
    };

    setAssignments((prev) =>
      prev.map((a) => (a.id === sessionToMove.id ? updatedAssignment : a))
    );

    const successMsg = `تم نقل حصة (${sessionToMove.course_name || 'المقرر'}) بنجاح إلى يوم ${targetDayName} (${targetSlot.label})`;

    // 3. Safe Backend Persistence with OCC (Unit of Work)
    setIsMoving(true);
    try {
      const payload = {
        day_of_week: targetDayId,
        start_time: targetSlot.start,
        end_time: targetSlot.end,
        room_id: targetRoomId,
        version: sessionToMove.version !== undefined ? Number(sessionToMove.version) : undefined,
      };

      const res = await api.post(`/assignments/${sessionToMove.id}/move`, payload, {
        skipConflictAlert: true,
      });

      if (res && res.assignment) {
        setAssignments((prev) =>
          prev.map((a) => (a.id === sessionToMove.id ? { ...a, ...res.assignment } : a))
        );
      }

      setUndoToast({
        show: true,
        message: successMsg,
        changeLogId: res?.changeLogId || null,
      });
    } catch (err: any) {
      console.error('Failed to move assignment on server:', err);
      // Rollback optimistic update
      setAssignments(previousAssignments);

      if (err?.statusCode === 409) {
        setConflictAlert({
          isOpen: true,
          reason:
            'تعارض في التعديل المتزامن (409 Conflict): تم تعديل هذه الحصة بواسطة مستخدم آخر. تم إلغاء النقل وتحديث البيانات.',
        });
        await loadData();
      } else {
        setConflictAlert({
          isOpen: true,
          reason: err?.messageAr || err?.message || 'فشل حفظ نقل الحصة في قاعدة البيانات.',
        });
      }
    } finally {
      setIsMoving(false);
    }
  };

  const handleUndo = async (changeLogId: number) => {
    setIsUndoing(true);
    try {
      await api.post(`/changes/${changeLogId}/undo`);
      setUndoToast((prev) => ({ ...prev, show: false }));
      await loadData();
    } catch (err: any) {
      console.error('Failed to undo assignment move:', err);
      alert(err?.messageAr || err?.message || 'تعذر التراجع عن النقل');
    } finally {
      setIsUndoing(false);
    }
  };

  // Open Add Session Modal
  const handleOpenAddSession = (dayId: number, slot: (typeof TIME_SLOTS)[0]) => {
    setSessionFormMode('add');
    setSessionFormSelectedSession(null);
    setFormDefaultDayId(dayId);
    setFormDefaultSlot(slot);
    setIsSessionFormOpen(true);
  };

  // Open Edit Session Modal
  const handleOpenEditSession = (sessionToEdit: Assignment) => {
    setSessionFormMode('edit');
    setSessionFormSelectedSession(sessionToEdit);
    setFormDefaultDayId(normalizeDay(sessionToEdit.day_of_week));
    const slotObj = TIME_SLOTS.find((s) => s.start === sessionToEdit.start_time);
    setFormDefaultSlot(slotObj);
    setIsSessionFormOpen(true);
  };

  // Open Delete Confirmation Dialog
  const handleOpenDeleteSession = (sessionToDelete: Assignment) => {
    setDeleteConfirmSession(sessionToDelete);
  };

  // Save Session (Add or Edit) with OCC and Optimistic UI
  const handleSaveSession = async (sessionData: Assignment, mode: 'add' | 'edit') => {
    if (isSandboxMode) {
      if (mode === 'add') {
        addSimulatedAssignment(sessionData);
        setUndoToast({
          show: true,
          message: `⚡ [وضع التجربة] تمت إضافة حصة (${sessionData.course_name}) افتراضياً`,
          changeLogId: null,
        });
      } else {
        updateSimulatedAssignment(sessionData.id, sessionData);
        setUndoToast({
          show: true,
          message: `⚡ [وضع التجربة] تم تحديث بيانات حصة (${sessionData.course_name}) افتراضياً`,
          changeLogId: null,
        });
      }
      return;
    }

    const idempotencyKey = `sched-${mode}-${sessionData.id || Date.now()}-${Date.now()}`;

    if (mode === 'add') {
      const res = await api.post(
        '/assignments',
        {
          course_id: sessionData.course_id,
          professor_id: sessionData.professor_id,
          group_id: sessionData.group_id,
          room_id: sessionData.room_id,
          day_of_week: sessionData.day_of_week,
          start_time: sessionData.start_time,
          end_time: sessionData.end_time,
          session_type: sessionData.session_type,
          specialization: sessionData.specialization,
          academic_year: sessionData.academic_year || academicYear,
          semester: sessionData.semester || semester,
        },
        {
          idempotencyKey,
        }
      );

      const created = res?.assignment || res || sessionData;
      setAssignments((prev) => [...prev, created]);
      setUndoToast({
        show: true,
        message: `تمت إضافة حصة (${sessionData.course_name}) بنجاح إلى جدول التوقيت`,
        changeLogId: res?.changeLogId || null,
      });
    } else {
      const res = await api.put(
        `/assignments/${sessionData.id}`,
        {
          course_id: sessionData.course_id,
          professor_id: sessionData.professor_id,
          group_id: sessionData.group_id,
          room_id: sessionData.room_id,
          day_of_week: sessionData.day_of_week,
          start_time: sessionData.start_time,
          end_time: sessionData.end_time,
          session_type: sessionData.session_type,
          specialization: sessionData.specialization,
          academic_year: sessionData.academic_year || academicYear,
          semester: sessionData.semester || semester,
          version: sessionData.version,
        },
        {
          idempotencyKey,
        }
      );

      const updated = res?.assignment || res || sessionData;
      setAssignments((prev) =>
        prev.map((a) => (a.id === sessionData.id ? { ...a, ...updated } : a))
      );
      setUndoToast({
        show: true,
        message: `تم تحديث بيانات حصة (${sessionData.course_name}) بنجاح`,
        changeLogId: res?.changeLogId || null,
      });
    }
  };

  // Confirm Delete Session
  const handleConfirmDeleteSession = async () => {
    if (!deleteConfirmSession) return;
    setIsDeletingSession(true);

    try {
      if (isSandboxMode) {
        deleteSimulatedAssignment(deleteConfirmSession.id);
        setUndoToast({
          show: true,
          message: `⚡ [وضع التجربة] تم حذف حصة (${deleteConfirmSession.course_name}) افتراضياً`,
          changeLogId: null,
        });
        setDeleteConfirmSession(null);
        return;
      }

      const res = await api.delete(`/assignments/${deleteConfirmSession.id}`);
      setAssignments((prev) => prev.filter((a) => a.id !== deleteConfirmSession.id));
      setUndoToast({
        show: true,
        message: `تم حذف حصة (${deleteConfirmSession.course_name}) من الجدول بنجاح`,
        changeLogId: res?.changeLogId || null,
      });
      setDeleteConfirmSession(null);
    } catch (err: any) {
      console.error('Failed to delete assignment:', err);
      alert(err?.messageAr || err?.message || 'فشل حذف الحصة من الخادم');
    } finally {
      setIsDeletingSession(false);
    }
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

          {/* Simulation / Sandbox Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isSandboxMode) {
                if (changeCount > 0) {
                  if (
                    !window.confirm(
                      `لديك ${changeCount} تعديل معلق في وضع التجربة. هل تريد الخروج وإلغاء التعديلات؟`
                    )
                  ) {
                    return;
                  }
                }
                exitSandboxMode();
              } else {
                enterSandboxMode(assignments);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs ${
              isSandboxMode
                ? 'bg-amber-500 text-amber-950 border-amber-600 ring-2 ring-amber-400/50 hover:bg-amber-400'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
            title={
              isSandboxMode
                ? 'وضع التجربة نشط — انقر للخروج'
                : 'تفعيل وضع التجربة (محاكاة التعديلات محلياً دون مساس بقاعدة البيانات)'
            }
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>{isSandboxMode ? `وضع التجربة: نشط (${changeCount})` : 'وضع التجربة'}</span>
          </button>

          {/* DnD Toggle Button */}
          <button
            type="button"
            onClick={() => setIsDndEnabled(!isDndEnabled)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shadow-xs ${
              isDndEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 ring-1 ring-emerald-300/50'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
            title={isDndEnabled ? 'تعطيل السحب والإفلات' : 'تفعيل السحب والإفلات'}
          >
            <Move className={`w-3.5 h-3.5 ${isDndEnabled ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>{isDndEnabled ? 'السحب والإفلات: مفعّل' : 'السحب والإفلات: معطّل'}</span>
          </button>

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
        <div
          className={`bg-white rounded-2xl shadow-sm overflow-x-auto transition-all ${
            isSandboxMode
              ? 'border-2 border-amber-400/90 shadow-md shadow-amber-500/10'
              : 'border border-slate-200'
          }`}
        >
          {isSandboxMode && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-950 font-bold">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-amber-600" />
                <span>جدول المحاكاة الافتراضي (Sandbox Timetable) — السحب والإفلات يغير الحصص محلياً فقط دون المساس بالبيانات الحية</span>
              </div>
              <span className="text-[11px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
                {changeCount} تعديل معلق
              </span>
            </div>
          )}
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
                      const isOverThisCell = isDndEnabled && dragOverCell?.dayId === day.id && dragOverCell?.slotId === slot.id;
                      const cellConflict = isDndEnabled && draggedSession ? checkSlotConflict(draggedSession, day.id, slot) : null;
                      const hasConflict = isOverThisCell && cellConflict?.hasConflict;
                      const isValidDrop = isOverThisCell && !cellConflict?.hasConflict;

                      let cellBg = 'hover:bg-blue-50/20';
                      if (isValidDrop) {
                        cellBg = 'bg-emerald-50/90 border-2 border-emerald-500 ring-2 ring-emerald-400/50 shadow-inner';
                      } else if (hasConflict) {
                        cellBg = 'bg-rose-50/90 border-2 border-rose-500 ring-2 ring-rose-400/50 shadow-inner cursor-not-allowed';
                      } else if (isDndEnabled && draggedSession) {
                        cellBg = 'border-dashed border-slate-300 hover:bg-slate-50/80';
                      }

                      return (
                        <td
                          key={slot.id}
                          onDragOver={(e) => isDndEnabled && handleDragOver(e, day.id, slot)}
                          onDragEnter={(e) => isDndEnabled && handleDragEnter(e, day.id, slot)}
                          onDragLeave={(e) => isDndEnabled && handleDragLeave(e, day.id, slot)}
                          onDrop={(e) => isDndEnabled && handleDrop(e, day.id, slot)}
                          onClick={() => {
                            if (!draggedSession && cellSessions.length === 0) {
                              handleOpenAddSession(day.id, slot);
                            }
                          }}
                          className={`p-1.5 border-l border-slate-200 align-top min-h-[105px] h-[115px] w-[150px] relative transition-all group/cell ${
                            !draggedSession && cellSessions.length === 0
                              ? 'cursor-pointer hover:bg-slate-50/80'
                              : ''
                          } ${cellBg}`}
                        >
                          {/* Live drop status banner inside cell */}
                          {isOverThisCell && (
                            <div
                              className={`absolute inset-x-1 top-1 z-30 p-1.5 rounded-lg text-[10px] font-bold shadow-md flex items-center justify-center gap-1 animate-in fade-in zoom-in-95 pointer-events-none text-white ${
                                hasConflict ? 'bg-rose-600' : 'bg-emerald-600'
                              }`}
                            >
                              {hasConflict ? (
                                <>
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{cellConflict?.reason}</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5 shrink-0" />
                                  <span>أفلت هنا للنقل</span>
                                </>
                              )}
                            </div>
                          )}

                          {cellSessions.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 font-light select-none">
                              {isDndEnabled && draggedSession && !isOverThisCell ? (
                                <span className="text-[10px] text-slate-400 font-normal border border-dashed border-slate-300 px-2 py-1 rounded-md">
                                  خانة شاغرة
                                </span>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-slate-300 text-xs">—</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenAddSession(day.id, slot);
                                    }}
                                    className="opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs"
                                    title="إضافة حصة جديدة في هذا التوقيت"
                                  >
                                    <Plus className="w-3 h-3 text-blue-600" />
                                    <span>إضافة</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                              {cellSessions.map((session) => {
                                const isLecture = isLectureSession(session);
                                const isTD =
                                  !isLecture &&
                                  (session.session_type === 'td' ||
                                    (session.group_name && session.group_name.toLowerCase().includes('td')));
                                const isDraggingThis = draggedSession?.id === session.id;

                                return (
                                  <div
                                    key={session.id}
                                    draggable={isDndEnabled}
                                    onDragStart={(e) => isDndEnabled && handleDragStart(e, session)}
                                    onDragEnd={handleDragEnd}
                                    className={`w-full group relative transition-all rounded-xl select-none ${
                                      isDraggingThis
                                        ? 'opacity-30 scale-95 border-2 border-dashed border-blue-500 ring-2 ring-blue-400 shadow-none'
                                        : isDndEnabled
                                        ? 'cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5'
                                        : ''
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => !draggedSession && setActiveSession(session)}
                                      className={`w-full text-right p-2 rounded-xl border text-xs transition-all shadow-xs block ${
                                        isLecture
                                          ? 'bg-blue-50/95 border-blue-300 hover:border-blue-400 text-blue-950 ring-1 ring-blue-300/50'
                                          : isTD
                                          ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-300 text-emerald-950'
                                          : 'bg-amber-50/90 border-amber-200 hover:border-amber-300 text-amber-950'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <div className="flex items-center gap-1 truncate max-w-[75%]">
                                          {isDndEnabled && (
                                            <GripVertical className="w-3 h-3 text-slate-400 shrink-0 opacity-60 group-hover:opacity-100 group-hover:text-blue-600 transition-opacity" />
                                          )}
                                          <span className="font-bold truncate text-[11px]" title={session.course_name}>
                                            {session.course_name || 'مقرر بدون اسم'}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          {/* Quick Edit & Delete buttons on card hover */}
                                          <div className="hidden group-hover:flex items-center gap-0.5">
                                            <span
                                              role="button"
                                              tabIndex={0}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenEditSession(session);
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.stopPropagation();
                                                  handleOpenEditSession(session);
                                                }
                                              }}
                                              className="p-1 rounded bg-white text-blue-700 hover:bg-blue-100 shadow-2xs cursor-pointer"
                                              title="تعديل الحصة"
                                            >
                                              <Edit className="w-2.5 h-2.5" />
                                            </span>
                                            <span
                                              role="button"
                                              tabIndex={0}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenDeleteSession(session);
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.stopPropagation();
                                                  handleOpenDeleteSession(session);
                                                }
                                              }}
                                              className="p-1 rounded bg-white text-rose-700 hover:bg-rose-100 shadow-2xs cursor-pointer"
                                              title="حذف الحصة"
                                            >
                                              <Trash2 className="w-2.5 h-2.5" />
                                            </span>
                                          </div>

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
                                  </div>
                                );
                              })}

                              {/* Subtle button to add parallel session */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAddSession(day.id, slot);
                                }}
                                className="w-full py-1 text-[10px] font-semibold text-slate-400 hover:text-blue-700 hover:bg-blue-50/70 rounded-lg border border-dashed border-transparent hover:border-blue-200 transition-all flex items-center justify-center gap-1 opacity-0 group-hover/cell:opacity-100"
                                title="إضافة حصة أخرى موازية في هذا التوقيت"
                              >
                                <Plus className="w-2.5 h-2.5" />
                                <span>حصة إضافية</span>
                              </button>
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

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const sess = activeSession;
                    setActiveSession(null);
                    handleOpenEditSession(sess);
                  }}
                  className="gap-1.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>تعديل الحصة</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const sess = activeSession;
                    setActiveSession(null);
                    handleOpenDeleteSession(sess);
                  }}
                  className="gap-1.5 text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف الحصة</span>
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveSession(null)}>
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
                                <div className="flex flex-col gap-1 w-full">
                                  {sortCellSessions(cellSessions).map((s, idx) => {
                                    const details = format2LineSession(s);
                                    return (
                                      <div
                                        key={`${s.id}-${idx}`}
                                        className={`py-[2px] px-1.5 rounded-[3px] text-start border transition-all ${
                                          details.isLecture
                                            ? 'bg-[#e8f4fd] border-[#b8daff]'
                                            : 'bg-[#f8fafc] border-[#cbd5e1]'
                                        }`}
                                      >
                                        {/* Line 1: Course + (Group / Lecture) */}
                                        <div className="font-bold text-[7.5pt] sm:text-[8pt] text-slate-950 leading-tight break-words" dir="rtl">
                                          <span>{details.courseName}</span>{' '}
                                          <span className={details.isLecture ? 'font-extrabold text-blue-900' : 'font-extrabold text-slate-800'}>
                                            ({details.groupOrLectureBadge}&rlm;)
                                          </span>
                                        </div>

                                        {/* Line 2: Professor + (Room) */}
                                        <div className="font-normal text-[7pt] sm:text-[7.5pt] text-slate-700 leading-tight break-words pt-0.5" dir="rtl">
                                          <span>{details.professorName}</span>{' '}
                                          <span className="text-slate-600 font-medium">
                                            ({details.roomName}&rlm;)
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

      {/* 6. Active Dragging Floating Status Bar */}
      {isDndEnabled && draggedSession && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-2xl w-full mx-4 no-print">
          <div className={`p-2 rounded-xl shrink-0 ${isSandboxMode ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
            <GripVertical className="w-5 h-5 animate-pulse" />
          </div>
          <div className="text-xs truncate flex-1">
            <span className="font-bold text-white block truncate">
              {isSandboxMode && <span className="text-amber-400 me-1.5 font-extrabold">[وضع التجربة]</span>}
              جاري سحب: {draggedSession.course_name} ({draggedSession.session_type === 'cours' ? 'محاضرة' : 'TD'})
            </span>
            <span className="text-slate-300 text-[11px] truncate block">
              {draggedSession.professor_name || 'أستاذ غير محدد'} | {draggedSession.group_name || 'فوج غير محدد'} | القاعة: {draggedSession.room_name || '—'}
            </span>
          </div>
          {activeConflict ? (
            <div className="px-3 py-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 max-w-xs truncate">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">{activeConflict}</span>
            </div>
          ) : dragOverCell ? (
            <div className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>خانة متاحة (أفلت الحصة للنقل)</span>
            </div>
          ) : (
            <span className="text-slate-400 text-xs shrink-0">اسحب إلى أي خانة زمنية فارغة</span>
          )}
          <button
            type="button"
            onClick={handleDragEnd}
            className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700 shrink-0"
          >
            إلغاء
          </button>
        </div>
      )}

      {/* 7. Conflict Alert Dialog */}
      <Dialog open={!!conflictAlert} onClose={() => setConflictAlert(null)} size="sm">
        {conflictAlert && (
          <div className="p-6 bg-white rounded-2xl max-w-sm w-full space-y-4 text-right">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <DialogTitle className="text-center text-base font-bold text-slate-900">
              تعارض في برمجة الحصة
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-600 leading-relaxed">
              {conflictAlert.reason}
            </DialogDescription>
            <div className="pt-2 flex justify-center">
              <Button variant="primary" size="sm" onClick={() => setConflictAlert(null)}>
                حسناً، فهمت
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* 8. Direct Add / Edit Session Modal */}
      <SessionFormModal
        open={isSessionFormOpen}
        onClose={() => setIsSessionFormOpen(false)}
        mode={sessionFormMode}
        session={sessionFormSelectedSession}
        defaultDayId={formDefaultDayId}
        defaultSlot={formDefaultSlot}
        defaultRoomId={filterType === 'room' && selectedEntityId !== 'all' ? Number(selectedEntityId) : undefined}
        defaultGroupId={filterType === 'group' && selectedEntityId !== 'all' ? Number(selectedEntityId) : undefined}
        defaultSpecialization={selectedSpecialization !== 'all' ? selectedSpecialization : undefined}
        courses={courses}
        professors={professors}
        rooms={rooms}
        groups={groups}
        academicYear={academicYear}
        semester={semester}
        existingAssignments={effectiveAssignments}
        onSave={handleSaveSession}
        isSandboxMode={isSandboxMode}
      />

      {/* 9. Delete Confirmation Modal */}
      <Dialog open={!!deleteConfirmSession} onClose={() => !isDeletingSession && setDeleteConfirmSession(null)} size="sm">
        {deleteConfirmSession && (
          <div className="p-6 bg-white rounded-2xl max-w-sm w-full space-y-4 text-right">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>
            <DialogTitle className="text-center text-base font-bold text-slate-900">
              تأكيد حذف الحصة الدراسية
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من حذف حصة <span className="font-bold text-slate-900">({deleteConfirmSession.course_name})</span> المبرمجة للفوج <span className="font-bold text-slate-900">({deleteConfirmSession.group_name})</span> يوم {DAYS.find((d) => d.id === normalizeDay(deleteConfirmSession.day_of_week))?.name} ({deleteConfirmSession.start_time} - {deleteConfirmSession.end_time})؟
            </DialogDescription>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-tight">
              {isSandboxMode
                ? '⚡ أنت في وضع التجربة: سيتم حذف الحصة محلياً فقط دون المساس بقاعدة البيانات الحية.'
                : 'سيتم حذف الحصة مع إمكانية التراجع الفوري خلال 24 ساعة عبر سجل التغييرات.'}
            </div>
            <div className="pt-2 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmSession(null)}
                disabled={isDeletingSession}
                className="text-xs"
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmDeleteSession}
                disabled={isDeletingSession}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingSession ? 'جاري الحذف...' : 'تأكيد الحذف'}</span>
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* 8. Undo Toast Notification */}
      <UndoToast
        show={undoToast.show}
        message={undoToast.message}
        changeLogId={undoToast.changeLogId}
        onUndo={handleUndo}
        onClose={() => setUndoToast((prev) => ({ ...prev, show: false }))}
        isLoading={isUndoing}
      />
    </div>
  );
}
