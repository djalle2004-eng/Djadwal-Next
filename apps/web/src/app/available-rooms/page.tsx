'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  ArrowRight,
  Pencil,
  Award,
  CalendarDays,
  ClipboardList,
  Sparkles,
  Download,
  AlertCircle
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

// =============================================================================
// TYPES & SYSTEM CONSTANTS
// =============================================================================

export interface Room {
  id: number;
  name: string;
  capacity: number;
  building?: string;
  room_type?: string;
}

export interface Professor {
  id: number;
  name: string;
  title?: string;
  department_id?: number;
  department_name?: string;
}

export interface Course {
  id: number;
  name: string;
  code?: string;
}

export interface Group {
  id: number;
  name: string;
  specialization?: string;
  department_id?: number;
  department_name?: string;
  group_type?: 'department' | 'specialization' | 'group' | 'lecture_group';
  parent_group_id?: number | null;
  year?: string;
}

export interface Department {
  id: number;
  name: string;
  code?: string;
}

export interface Specialization {
  id: number;
  name: string;
  department_id?: number;
}

export interface Assignment {
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
  session_type?: string;
  group_name?: string;
  course_name?: string;
  professor_name?: string;
  room_name?: string;
  specialization?: string;
}

export interface ExtraSession {
  id: number;
  room_id: number;
  professor_id: number;
  course_id: number;
  group_id?: number | null;
  session_date: string;
  start_time: string;
  end_time: string;
  session_type: 'makeup' | 'extra' | 'revision' | 'exam' | 'semester_exam';
  description?: string;
  reason?: string;
  exam_note?: string;
  academic_year?: string;
  semester?: string;
  is_archived?: number;
  version?: number;
  created_at?: string;
  room_name?: string;
  room_capacity?: number;
  room_building?: string;
  professor_name?: string;
  course_name?: string;
  group_name?: string;
}

export interface GroupedExtraSession extends ExtraSession {
  key: string;
  group_names: string[];
  group_ids: number[];
  ids: number[];
}

export const OFFICIAL_TIME_SLOTS = [
  '08:00 - 09:30',
  '09:30 - 11:00',
  '11:00 - 12:30',
  '12:30 - 14:00',
  '14:00 - 15:30',
  '15:30 - 17:00'
];

export const SYSTEM_DAYS = [
  { id: 0, name: 'السبت' },
  { id: 1, name: 'الأحد' },
  { id: 2, name: 'الاثنين' },
  { id: 3, name: 'الثلاثاء' },
  { id: 4, name: 'الأربعاء' },
  { id: 5, name: 'الخميس' },
  { id: 6, name: 'الجمعة' }
];

export const SESSION_TYPES = [
  { value: 'makeup', label: 'حصة تعويضية (Rattrapage)', color: 'warning' },
  { value: 'extra', label: 'حصة إضافية (Séance supplémentaire)', color: 'info' },
  { value: 'exam', label: 'إمتحان الأعمال الموجهة (Examen TD)', color: 'danger' },
  { value: 'semester_exam', label: 'إمتحان السداسي (Examen de semestre)', color: 'purple' },
  { value: 'revision', label: 'حصة مراجعة (Révision)', color: 'neutral' }
];

export function dateToSystemDay(dateStr: string): number {
  if (!dateStr) return 1;
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const jsDay = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  if (jsDay === 0) return 1; // Sunday = 1 in Djadwal
  if (jsDay === 6) return 0; // Saturday = 0 in Djadwal
  return jsDay + 1; // Mon-Fri (1-5) -> 2-6
}

export function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.trim().split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

export function isTimeOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(e1) > timeToMinutes(s2);
}

export interface EvaluatedRoom {
  room: Room;
  isAvailable: boolean;
  occupant?: {
    type: 'regular' | 'extra';
    course: string;
    professor: string;
    group: string;
    time: string;
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AvailableRoomsContent({ initialTab = 'search' }: { initialTab?: string }) {
  const searchParams = useSearchParams();
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const [activeTab, setActiveTab] = useState<string>(tabParam || initialTab);

  useEffect(() => {
    if (tabParam && ['search', 'matrix', 'schedule', 'log'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Core Data Lists
  const [rooms, setRooms] = useState<Room[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
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
  const [backendEvaluatedRooms, setBackendEvaluatedRooms] = useState<EvaluatedRoom[] | null>(null);

  // Department Head & Print Identity
  const [departmentHead, setDepartmentHead] = useState<string>('د. لخضر');
  const [departmentHeadDialogOpen, setDepartmentHeadDialogOpen] = useState<boolean>(false);
  const [tempDeptHead, setTempDeptHead] = useState<string>('د. لخضر');

  // Interactive Scheduling Form State (Tab 'schedule' & Modal)
  const [editMode, setEditMode] = useState<boolean>(false);
  const [currentSession, setCurrentSession] = useState<ExtraSession | null>(null);
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [scheduleNature, setScheduleNature] = useState<'single' | 'recurring'>('single');
  const [recurringEndDate, setRecurringEndDate] = useState<string>('');
  const [formTimeSlot, setFormTimeSlot] = useState<string>(OFFICIAL_TIME_SLOTS[0]);
  const [useCustomTime, setUseCustomTime] = useState<boolean>(false);
  const [customStartTime, setCustomStartTime] = useState<string>('08:00');
  const [customEndTime, setCustomEndTime] = useState<string>('09:30');
  const [formSessionType, setFormSessionType] = useState<'makeup' | 'extra' | 'revision' | 'exam' | 'semester_exam'>('makeup');
  
  // Cascading Selection State
  const [selectedDepartment, setSelectedDepartment] = useState<number | ''>('');
  const [selectedSpecialization, setSelectedSpecialization] = useState<number | ''>('');
  const [selectedGroup, setSelectedGroup] = useState<number | ''>('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [isMultiGroup, setIsMultiGroup] = useState<boolean>(false);

  // Professor & Course Selection with Live Auto-Search
  const [selectedProfessor, setSelectedProfessor] = useState<number | ''>('');
  const [professorSearchTerm, setProfessorSearchTerm] = useState<string>('');
  const [isProfDropdownOpen, setIsProfDropdownOpen] = useState<boolean>(false);

  const [selectedCourse, setSelectedCourse] = useState<number | ''>('');
  const [courseSearchTerm, setCourseSearchTerm] = useState<string>('');
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState<boolean>(false);

  // Room Selection (Single or Multi-room)
  const [selectedRoom, setSelectedRoom] = useState<number | ''>('');
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);

  // Notes & Override
  const [description, setDescription] = useState<string>('');
  const [examNote, setExamNote] = useState<string>('');
  const [ignoreConflicts, setIgnoreConflicts] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Booking Modal
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);

  // Log Tab Filters & Actions
  const [logSearch, setLogSearch] = useState<string>('');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  // Deletion Modal
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [sessionToDelete, setSessionToDelete] = useState<ExtraSession | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Print Dialogs
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState<boolean>(false);
  const [announcementDepartment, setAnnouncementDepartment] = useState<number | ''>('');
  const [announcementSpecialization, setAnnouncementSpecialization] = useState<number | ''>('');
  const [announcementGroup, setAnnouncementGroup] = useState<number | ''>('');
  const [announcementProfessor, setAnnouncementProfessor] = useState<number | ''>('');
  const [announcementSessionType, setAnnouncementSessionType] = useState<string>('all');
  const [announcementStartDate, setAnnouncementStartDate] = useState<string>('');
  const [announcementEndDate, setAnnouncementEndDate] = useState<string>('');

  const [dateRangePrintOpen, setDateRangePrintOpen] = useState<boolean>(false);
  const [dateRangeType, setDateRangeType] = useState<string>('all');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');

  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [printModalType, setPrintModalType] = useState<'daily' | 'announcement' | 'list' | 'certificate' | 'matrix'>('daily');
  const [announcementFilteredList, setAnnouncementFilteredList] = useState<ExtraSession[]>([]);
  const [certificateSession, setCertificateSession] = useState<ExtraSession | null>(null);

  // Notification Banner
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Load Department Head from Local Storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHead = localStorage.getItem('djadwal_department_head');
      if (savedHead) {
        setDepartmentHead(savedHead);
        setTempDeptHead(savedHead);
      }
    }
  }, []);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href);
      u.searchParams.set('tab', val);
      window.history.replaceState({}, '', u.toString());
    }
  };

  const [printSettings, setPrintSettings] = useState<any>(null);

  // 1. Initial Load of Master Data
  const loadMasterData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [rData, pData, cData, gData, dData, aData, esData, psData] = await Promise.all([
        api.get<Room[]>('/catalog/rooms?limit=300').catch(() => []),
        api.get<Professor[]>('/professors?limit=300').catch(() => []),
        api.get<Course[]>('/catalog/courses?limit=300').catch(() => []),
        api.get<Group[]>('/catalog/groups?limit=300').catch(() => []),
        api.get<Department[]>('/catalog/departments?limit=100').catch(() => []),
        api.get<Assignment[]>(`/assignments?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&limit=3000`).catch(() => []),
        api.listExtraSessions({ limit: 5000 }).catch(() => []),
        api.getPrintSettings().catch(() => null)
      ]);

      setRooms(Array.isArray(rData) ? rData : []);
      setProfessors(Array.isArray(pData) ? pData : []);
      setCourses(Array.isArray(cData) ? cData : []);
      setGroups(Array.isArray(gData) ? gData : []);
      setDepartments(Array.isArray(dData) ? dData : []);
      setRegularAssignments(Array.isArray(aData) ? aData : []);
      setExtraSessions(Array.isArray(esData) ? esData : []);
      setPrintSettings(psData);
    } catch (err) {
      console.error('Error loading master data:', err);
      showNotification('error', 'خطأ في تحميل البيانات الأساسية');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [academicYear, semester]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Derived Specializations from Groups
  const specializations = useMemo(() => {
    const specsMap = new Map<number, { id: number; name: string; department_id?: number }>();
    groups.forEach(g => {
      if (g.group_type === 'specialization') {
        specsMap.set(g.id, { id: g.id, name: g.name, department_id: g.department_id });
      } else if (g.specialization) {
        // Find existing or synthesize
        const existing = Array.from(specsMap.values()).find(s => s.name === g.specialization);
        if (!existing) {
          specsMap.set(g.parent_group_id || g.id, {
            id: g.parent_group_id || g.id,
            name: g.specialization,
            department_id: g.department_id
          });
        }
      }
    });
    return Array.from(specsMap.values());
  }, [groups]);

  // Specializations filtered by selected Department
  const filteredSpecializations = useMemo(() => {
    if (!selectedDepartment) return specializations;
    return specializations.filter(s => s.department_id === Number(selectedDepartment));
  }, [specializations, selectedDepartment]);

  // Groups filtered by selected Specialization
  const filteredGroups = useMemo(() => {
    if (!selectedSpecialization) {
      if (!selectedDepartment) return groups.filter(g => g.group_type === 'group' || !g.group_type);
      return groups.filter(g => g.department_id === Number(selectedDepartment) && (g.group_type === 'group' || !g.group_type));
    }
    const spec = specializations.find(s => s.id === Number(selectedSpecialization));
    if (!spec) return [];
    return groups.filter(g =>
      (g.parent_group_id === spec.id || g.specialization === spec.name) &&
      (g.group_type === 'group' || !g.group_type || g.group_type === 'lecture_group')
    );
  }, [groups, selectedSpecialization, selectedDepartment, specializations]);

  // Professor Dynamic Course & Group Associations
  const professorCourses = useMemo(() => {
    if (!selectedProfessor) return courses;
    const profAssigns = regularAssignments.filter(a => a.professor_id === Number(selectedProfessor));
    const courseIds = new Set(profAssigns.map(a => a.course_id));
    if (courseIds.size === 0) return courses;
    // Show professor's assigned courses first or exclusively
    return courses.filter(c => courseIds.has(c.id));
  }, [selectedProfessor, regularAssignments, courses]);

  const professorGroups = useMemo(() => {
    if (!selectedProfessor) return groups;
    const profAssigns = regularAssignments.filter(a => a.professor_id === Number(selectedProfessor));
    const groupIds = new Set(profAssigns.map(a => a.group_id));
    if (groupIds.size === 0) return groups;
    return groups.filter(g => groupIds.has(g.id));
  }, [selectedProfessor, regularAssignments, groups]);

  // Professors with scheduled extra sessions (for Student Announcement filter)
  const professorsWithExtraSessions = useMemo(() => {
    const profIds = new Set(extraSessions.map(s => s.professor_id));
    return professors.filter(p => profIds.has(p.id));
  }, [extraSessions, professors]);

  // Filtered professors for auto-search
  const filteredProfessorsSearch = useMemo(() => {
    if (!professorSearchTerm) return professors;
    const term = professorSearchTerm.toLowerCase().trim();
    return professors.filter(p => p.name.toLowerCase().includes(term));
  }, [professors, professorSearchTerm]);

  // Filtered courses for auto-search
  const filteredCoursesSearch = useMemo(() => {
    const baseList = selectedProfessor ? professorCourses : courses;
    if (!courseSearchTerm) return baseList;
    const term = courseSearchTerm.toLowerCase().trim();
    return baseList.filter(c => c.name.toLowerCase().includes(term) || (c.code && c.code.toLowerCase().includes(term)));
  }, [courses, professorCourses, selectedProfessor, courseSearchTerm]);

  // Selected Day Calculation
  const formSystemDay = useMemo(() => dateToSystemDay(formDate), [formDate]);

  // Effective Start/End Time for the Form
  const effectiveTimes = useMemo(() => {
    if (useCustomTime) {
      return { start: customStartTime, end: customEndTime };
    }
    const parts = formTimeSlot.split('-').map(s => s.trim());
    return { start: parts[0] || '08:00', end: parts[1] || '09:30' };
  }, [useCustomTime, customStartTime, customEndTime, formTimeSlot]);

  // Effective Groups for the Form
  const effectiveGroupIds = useMemo(() => {
    if (isMultiGroup || formSessionType === 'semester_exam') {
      return selectedGroupIds;
    }
    return selectedGroup ? [Number(selectedGroup)] : [];
  }, [isMultiGroup, formSessionType, selectedGroupIds, selectedGroup]);

  // Effective Rooms for the Form
  const effectiveRoomIds = useMemo(() => {
    if (selectedRoomIds.length > 0) return selectedRoomIds;
    return selectedRoom ? [Number(selectedRoom)] : [];
  }, [selectedRoomIds, selectedRoom]);

  // ===========================================================================
  // REAL-TIME CONFLICT GUARD ENGINE
  // ===========================================================================
  const conflicts = useMemo(() => {
    const warnings: string[] = [];
    const { start: sStart, end: sEnd } = effectiveTimes;
    if (!formDate || !sStart || !sEnd) return warnings;

    const startMin = timeToMinutes(sStart);
    const endMin = timeToMinutes(sEnd);
    if (startMin >= endMin) {
      warnings.push('توقيت النهاية يجب أن يكون لاحقاً لتوقيت البداية');
      return warnings;
    }

    const currentId = currentSession?.id;

    // 1. Conflict checks against regular assignments
    const dayRegularAssigns = regularAssignments.filter(a => {
      if (a.day_of_week !== formSystemDay) return false;
      return isTimeOverlap(sStart, sEnd, a.start_time, a.end_time);
    });

    for (const rid of effectiveRoomIds) {
      const roomObj = rooms.find(r => r.id === rid);
      const roomName = roomObj?.name || `قاعة ${rid}`;

      // Check room occupation by regular assignment
      const roomConflict = dayRegularAssigns.find(a => a.room_id === rid);
      if (roomConflict) {
        // Exception: Same professor teaching multiple groups in same room
        if (selectedProfessor && roomConflict.professor_id === Number(selectedProfessor)) {
          // Allowed
        } else {
          warnings.push(`القاعة "${roomName}" مشغولة بالجدول الأسبوعي بحصة (${roomConflict.course_name || 'مقياس'} - ${roomConflict.group_name || 'فوج'}) من ${roomConflict.start_time} إلى ${roomConflict.end_time}`);
        }
      }

      // Check room occupation by another extra session on exact date
      const extraRoomConflict = extraSessions.find(s => {
        if (currentId && s.id === currentId) return false;
        if (s.is_archived === 1) return false;
        if (s.room_id !== rid || s.session_date !== formDate) return false;
        if (selectedProfessor && s.professor_id === Number(selectedProfessor)) return false;
        return isTimeOverlap(sStart, sEnd, s.start_time, s.end_time);
      });
      if (extraRoomConflict) {
        warnings.push(`القاعة "${roomName}" محجوزة مسبقاً بحصة إضافية (${extraRoomConflict.course_name} للأستاذ ${extraRoomConflict.professor_name}) من ${extraRoomConflict.start_time} إلى ${extraRoomConflict.end_time}`);
      }
    }

    // 2. Professor conflicts
    if (selectedProfessor) {
      const profObj = professors.find(p => p.id === Number(selectedProfessor));
      const profName = profObj?.name || `أستاذ ${selectedProfessor}`;

      const profRegularConflict = dayRegularAssigns.find(a => {
        if (a.professor_id !== Number(selectedProfessor)) return false;
        // Same room exception
        if (effectiveRoomIds.includes(a.room_id)) return false;
        return true;
      });
      if (profRegularConflict) {
        warnings.push(`الأستاذ "${profName}" لديه حصة أسبوعية مع (${profRegularConflict.group_name || 'فوج'}) في قاعة أخرى (${profRegularConflict.room_name || ''})`);
      }

      const profExtraConflict = extraSessions.find(s => {
        if (currentId && s.id === currentId) return false;
        if (s.is_archived === 1) return false;
        if (s.session_date !== formDate || s.professor_id !== Number(selectedProfessor)) return false;
        if (effectiveRoomIds.includes(s.room_id)) return false;
        return isTimeOverlap(sStart, sEnd, s.start_time, s.end_time);
      });
      if (profExtraConflict) {
        warnings.push(`الأستاذ "${profName}" لديه حصة إضافية أخرى مبرمجة في نفس التوقيت في قاعة (${profExtraConflict.room_name || ''})`);
      }
    }

    // 3. Group conflicts & Strict Lecture Conflict Guard
    for (const gid of effectiveGroupIds) {
      const groupObj = groups.find(g => g.id === gid);
      const groupName = groupObj?.name || `فوج ${gid}`;

      // Direct group conflict in regular assignments
      const groupRegConflict = dayRegularAssigns.find(a => a.group_id === gid);
      if (groupRegConflict) {
        warnings.push(`الفوج "${groupName}" لديه حصة أسبوعية مبرمجة (${groupRegConflict.course_name} مع ${groupRegConflict.professor_name})`);
      }

      // Direct group conflict in extra sessions
      const groupExtraConflict = extraSessions.find(s => {
        if (currentId && s.id === currentId) return false;
        if (s.is_archived === 1) return false;
        if (s.session_date !== formDate || s.group_id !== gid) return false;
        return isTimeOverlap(sStart, sEnd, s.start_time, s.end_time);
      });
      if (groupExtraConflict) {
        warnings.push(`الفوج "${groupName}" لديه حصة إضافية أخرى مبرمجة في هذا التوقيت (${groupExtraConflict.course_name})`);
      }

      // Strict Lecture Conflict Logic
      if (groupObj && groupObj.specialization) {
        const isCurrentLecture = groupObj.name.toLowerCase().includes('lecture') || groupObj.name.includes('محاضرة');
        const specAssigns = dayRegularAssigns.filter(a => a.specialization === groupObj.specialization || groups.find(g => g.id === a.group_id)?.specialization === groupObj.specialization);

        for (const sa of specAssigns) {
          const targetGroup = groups.find(g => g.id === sa.group_id);
          const isTargetLecture = targetGroup?.name.toLowerCase().includes('lecture') || targetGroup?.name.includes('محاضرة');
          if (isCurrentLecture && sa.group_id !== gid) {
            warnings.push(`تعارض محاضرة: لا يمكن برمجة محاضرة (${groupObj.name}) في وجود حصة أخرى لنفس التخصص (${targetGroup?.name || ''})`);
            break;
          } else if (isTargetLecture && sa.group_id !== gid) {
            warnings.push(`تعارض فوج: توجد محاضرة مبرمجة (${targetGroup?.name || ''}) تمنع برمجة حصة للفوج (${groupObj.name})`);
            break;
          }
        }
      }
    }

    return warnings;
  }, [effectiveTimes, formDate, formSystemDay, currentSession, effectiveRoomIds, effectiveGroupIds, regularAssignments, extraSessions, rooms, selectedProfessor, professors, groups]);

  // Real-Time Room Vacancy Status Helper
  const isSelectedRoomVacant = useMemo(() => {
    if (!selectedRoom || !formDate || !effectiveTimes.start || !effectiveTimes.end) return null;
    const { start: sStart, end: sEnd } = effectiveTimes;
    const rid = Number(selectedRoom);
    
    // Check assignments
    const hasReg = regularAssignments.some(a => {
      if (a.room_id !== rid || a.day_of_week !== formSystemDay) return false;
      if (selectedProfessor && a.professor_id === Number(selectedProfessor)) return false;
      return isTimeOverlap(sStart, sEnd, a.start_time, a.end_time);
    });
    if (hasReg) return false;

    // Check extra sessions
    const hasExtra = extraSessions.some(s => {
      if (currentSession && s.id === currentSession.id) return false;
      if (s.is_archived === 1) return false;
      if (s.room_id !== rid || s.session_date !== formDate) return false;
      if (selectedProfessor && s.professor_id === Number(selectedProfessor)) return false;
      return isTimeOverlap(sStart, sEnd, s.start_time, s.end_time);
    });
    return !hasExtra;
  }, [selectedRoom, formDate, effectiveTimes, formSystemDay, selectedProfessor, regularAssignments, extraSessions, currentSession]);

  // ===========================================================================
  // SEARCH TAB: ROOM EVALUATION ENGINE
  // ===========================================================================
  const currentSearchSystemDay = useMemo(() => dateToSystemDay(selectedDate), [selectedDate]);

  const evaluatedRooms = useMemo<EvaluatedRoom[]>(() => {
    if (backendEvaluatedRooms && backendEvaluatedRooms.length > 0) {
      return backendEvaluatedRooms;
    }
    const [sS, sE] = selectedTimeSlot.split('-').map(s => s.trim());

    return rooms
      .filter(room => {
        if (minCapacity > 0 && room.capacity < minCapacity) return false;
        if (selectedBuilding !== 'all' && room.building && room.building !== selectedBuilding) return false;
        if (selectedRoomType !== 'all' && room.room_type && room.room_type !== selectedRoomType) return false;
        return true;
      })
      .map(room => {
        const slotAssign = regularAssignments.find(a =>
          a.room_id === room.id &&
          a.day_of_week === currentSearchSystemDay &&
          isTimeOverlap(sS, sE, a.start_time, a.end_time)
        );

        const slotExtra = extraSessions.find(s =>
          s.room_id === room.id &&
          s.session_date === selectedDate &&
          s.is_archived !== 1 &&
          isTimeOverlap(sS, sE, s.start_time, s.end_time)
        );

        if (slotAssign) {
          return {
            room,
            isAvailable: false,
            occupant: {
              type: 'regular',
              course: slotAssign.course_name || 'مقياس',
              professor: slotAssign.professor_name || 'أستاذ',
              group: slotAssign.group_name || 'فوج',
              time: `${slotAssign.start_time} - ${slotAssign.end_time}`
            }
          };
        }

        if (slotExtra) {
          return {
            room,
            isAvailable: false,
            occupant: {
              type: 'extra',
              course: slotExtra.course_name || 'مقياس',
              professor: slotExtra.professor_name || 'أستاذ',
              group: slotExtra.group_name || 'حصة إضافية',
              time: `${slotExtra.start_time} - ${slotExtra.end_time}`
            }
          };
        }

        return { room, isAvailable: true };
      });
  }, [backendEvaluatedRooms, rooms, regularAssignments, extraSessions, selectedDate, selectedTimeSlot, minCapacity, selectedBuilding, selectedRoomType, currentSearchSystemDay]);

  const vacantRoomsList = useMemo(() => evaluatedRooms.filter(r => r.isAvailable), [evaluatedRooms]);
  const occupiedRoomsList = useMemo(() => evaluatedRooms.filter(r => !r.isAvailable), [evaluatedRooms]);

  // ===========================================================================
  // GROUPED SESSIONS FOR LOG TAB
  // ===========================================================================
  const isSessionArchived = (s: ExtraSession) => {
    return Number(s.is_archived) === 1;
  };

  const upcomingCount = useMemo(() => extraSessions.filter(s => !isSessionArchived(s)).length, [extraSessions]);
  const archivedCount = useMemo(() => extraSessions.filter(s => isSessionArchived(s)).length, [extraSessions]);

  const getFormattedSessionDate = useCallback((sessionDate: string) => {
    if (!sessionDate) return '';
    const dayName = SYSTEM_DAYS.find(d => d.id === dateToSystemDay(sessionDate))?.name || '';
    const parts = sessionDate.split('-');
    if (parts.length === 3) {
      return `${dayName} ${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return `${dayName} ${sessionDate}`;
  }, []);

  const groupedExtraSessions = useMemo<GroupedExtraSession[]>(() => {
    const list = extraSessions.filter(s => {
      const archived = isSessionArchived(s);
      // Archive filter
      if (!showArchived && archived) return false;
      if (showArchived && !archived) return false;
      // Type filter
      if (logTypeFilter !== 'all' && s.session_type !== logTypeFilter) return false;
      // Search filter
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase().trim();
        const prof = (s.professor_name || '').toLowerCase();
        const course = (s.course_name || '').toLowerCase();
        const room = (s.room_name || '').toLowerCase();
        const grp = (s.group_name || '').toLowerCase();
        const date = (s.session_date || '').toLowerCase();
        return prof.includes(q) || course.includes(q) || room.includes(q) || grp.includes(q) || date.includes(q);
      }
      return true;
    });

    // Group by (date, start_time, end_time, room_id, course_id, professor_id, session_type)
    const accMap = new Map<string, GroupedExtraSession>();
    for (const session of list) {
      const key = `${session.session_date}_${session.start_time}_${session.end_time}_${session.room_id}_${session.course_id}_${session.professor_id}_${session.session_type}`;
      const existing = accMap.get(key);
      if (existing) {
        if (session.group_name && !existing.group_names.includes(session.group_name)) {
          existing.group_names.push(session.group_name);
        }
        if (session.group_id && !existing.group_ids.includes(session.group_id)) {
          existing.group_ids.push(session.group_id);
        }
        existing.ids.push(session.id);
      } else {
        accMap.set(key, {
          ...session,
          key,
          group_names: session.group_name ? [session.group_name] : ['الدفعة كاملة'],
          group_ids: session.group_id ? [session.group_id] : [],
          ids: [session.id]
        });
      }
    }
    const result = Array.from(accMap.values());
    result.sort((a, b) => {
      const cmpDate = (a.session_date || '').localeCompare(b.session_date || '');
      if (cmpDate !== 0) return showArchived ? -cmpDate : cmpDate;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
    return result;
  }, [extraSessions, showArchived, logTypeFilter, logSearch]);

  // ===========================================================================
  // FORM HANDLERS & ACTIONS
  // ===========================================================================

  const resetSchedulingForm = () => {
    setEditMode(false);
    setCurrentSession(null);
    setFormDate(todayStr);
    setScheduleNature('single');
    setRecurringEndDate('');
    setFormTimeSlot(OFFICIAL_TIME_SLOTS[0]);
    setUseCustomTime(false);
    setCustomStartTime('08:00');
    setCustomEndTime('09:30');
    setFormSessionType('makeup');
    setSelectedDepartment('');
    setSelectedSpecialization('');
    setSelectedGroup('');
    setSelectedGroupIds([]);
    setIsMultiGroup(false);
    setSelectedProfessor('');
    setProfessorSearchTerm('');
    setSelectedCourse('');
    setCourseSearchTerm('');
    setSelectedRoom('');
    setSelectedRoomIds([]);
    setDescription('');
    setExamNote('');
    setIgnoreConflicts(false);
  };

  const openCreateModalWithSlot = (room?: Room, slot?: string, date?: string) => {
    resetSchedulingForm();
    if (room) setSelectedRoom(room.id);
    if (slot) setFormTimeSlot(slot);
    if (date) setFormDate(date);
    setIsBookingModalOpen(true);
  };

  const openEditModal = (session: GroupedExtraSession) => {
    setEditMode(true);
    setCurrentSession(session);
    setFormDate(session.session_date);
    setScheduleNature('single');
    
    // Check if time slot is in official list
    const slotStr = `${session.start_time} - ${session.end_time}`;
    if (OFFICIAL_TIME_SLOTS.includes(slotStr)) {
      setUseCustomTime(false);
      setFormTimeSlot(slotStr);
    } else {
      setUseCustomTime(true);
      setCustomStartTime(session.start_time);
      setCustomEndTime(session.end_time);
    }

    setFormSessionType(session.session_type);
    setSelectedProfessor(session.professor_id);
    setProfessorSearchTerm(session.professor_name || '');
    setSelectedCourse(session.course_id);
    setCourseSearchTerm(session.course_name || '');
    setSelectedRoom(session.room_id);
    setSelectedRoomIds([]);

    if (session.group_ids.length > 1) {
      setIsMultiGroup(true);
      setSelectedGroupIds(session.group_ids);
      setSelectedGroup(session.group_ids[0]);
    } else {
      setIsMultiGroup(false);
      setSelectedGroup(session.group_id || '');
      setSelectedGroupIds(session.group_id ? [session.group_id] : []);
    }

    setDescription(session.description || session.reason || '');
    setExamNote(session.exam_note || '');
    setIgnoreConflicts(false);
    setIsBookingModalOpen(true);
  };

  // Submit Handler for Both Modal & Tab 'schedule'
  const handleSubmitSession = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!selectedCourse) {
      showNotification('error', 'يرجى اختيار المقياس أو المقرر أولاً');
      return;
    }
    if (!selectedProfessor) {
      showNotification('error', 'يرجى اختيار الأستاذ المعني بالحصة');
      return;
    }
    if (effectiveRoomIds.length === 0) {
      showNotification('error', 'يرجى اختيار القاعة المخصصة');
      return;
    }
    if (!formDate) {
      showNotification('error', 'يرجى تحديد تاريخ الحصة');
      return;
    }
    if (conflicts.length > 0 && !ignoreConflicts) {
      showNotification('error', 'يوجد تعارض في التوقيت أو القاعة أو الأستاذ. عالج التعارض أو فعّل خيار تجاهل التعارضات');
      return;
    }

    setIsSubmitting(true);
    const { start: sStart, end: sEnd } = effectiveTimes;

    try {
      if (editMode && currentSession) {
        // Update existing session
        const payload = {
          professor_id: Number(selectedProfessor),
          course_id: Number(selectedCourse),
          room_id: Number(selectedRoom || effectiveRoomIds[0]),
          group_id: selectedGroup ? Number(selectedGroup) : null,
          group_ids: effectiveGroupIds,
          session_date: formDate,
          start_time: sStart,
          end_time: sEnd,
          session_type: formSessionType,
          description: description,
          reason: description,
          exam_note: examNote,
          academic_year: academicYear,
          semester: semester,
          version: currentSession.version || 1,
          ignore_conflicts: ignoreConflicts
        };

        await api.updateExtraSession(currentSession.id, payload);
        showNotification('success', 'تم تعديل الحصة بنجاح وحفظ التغييرات');
        setIsBookingModalOpen(false);
        resetSchedulingForm();
        loadMasterData();
      } else {
        // Create single or recurring sessions
        const datesToSchedule: string[] = [];

        if (scheduleNature === 'recurring' && recurringEndDate && recurringEndDate > formDate) {
          let curr = new Date(formDate);
          const endD = new Date(recurringEndDate);
          while (curr <= endD) {
            datesToSchedule.push(curr.toISOString().split('T')[0]);
            curr.setDate(curr.getDate() + 7); // weekly recurring
          }
        } else {
          datesToSchedule.push(formDate);
        }

        for (const sDate of datesToSchedule) {
          const payload = {
            professor_id: Number(selectedProfessor),
            course_id: Number(selectedCourse),
            room_id: Number(selectedRoom || effectiveRoomIds[0]),
            room_ids: effectiveRoomIds,
            group_id: selectedGroup ? Number(selectedGroup) : null,
            group_ids: effectiveGroupIds,
            session_date: sDate,
            start_time: sStart,
            end_time: sEnd,
            session_type: formSessionType,
            description: description,
            reason: description,
            exam_note: examNote,
            academic_year: academicYear,
            semester: semester,
            ignore_conflicts: ignoreConflicts
          };
          await api.createExtraSession(payload);
        }

        showNotification('success', `تمت برمجة ${datesToSchedule.length > 1 ? `${datesToSchedule.length} حصص دورية` : 'الحصة'} بنجاح وحجز القاعة`);
        setIsBookingModalOpen(false);
        resetSchedulingForm();
        loadMasterData();
      }
    } catch (err: any) {
      console.error('Session submit error:', err);
      const msg = err.messageAr || err.message || 'فشل في حفظ الحصة. تحقق من التعارضات أو حاول مجدداً';
      showNotification('error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete / Soft-cancel Handler
  const handleDeleteSessionConfirm = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteExtraSession(sessionToDelete.id);
      showNotification('success', 'تم إلغاء الحصة وتحرير القاعة في النظام بنجاح');
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
      loadMasterData();
    } catch (err: any) {
      console.error('Session delete error:', err);
      showNotification('error', err.message || 'فشل في إلغاء الحصة');
    } finally {
      setIsDeleting(false);
    }
  };

  // Manual Archive Handler
  const handleManualArchive = async () => {
    setIsArchiving(true);
    try {
      const res: any = await api.archivePastExtraSessions();
      showNotification('success', res.message || `تمت أرشفة ${res.archived || 0} حصة منتهية بنجاح`);
      loadMasterData();
    } catch (err: any) {
      console.error('Archive error:', err);
      showNotification('error', 'فشل في تنفيذ الأرشفة التلقائية');
    } finally {
      setIsArchiving(false);
    }
  };

  // Save Department Head
  const handleSaveDepartmentHead = () => {
    setDepartmentHead(tempDeptHead);
    if (typeof window !== 'undefined') {
      localStorage.setItem('djadwal_department_head', tempDeptHead);
    }
    setDepartmentHeadDialogOpen(false);
    showNotification('success', 'تم حفظ اسم ومسمى رئيس القسم بنجاح');
  };

  // Student Announcement Print Trigger
  const handlePrintStudentAnnouncement = () => {
    let filtered = extraSessions.filter(s => s.is_archived !== 1);

    if (announcementSessionType !== 'all') {
      filtered = filtered.filter(s => s.session_type === announcementSessionType);
    }
    if (announcementDepartment) {
      filtered = filtered.filter(s => {
        const grp = groups.find(g => g.id === s.group_id);
        return grp && grp.department_id === Number(announcementDepartment);
      });
    }
    if (announcementSpecialization) {
      const spec = specializations.find(sp => sp.id === Number(announcementSpecialization));
      if (spec) {
        filtered = filtered.filter(s => {
          const grp = groups.find(g => g.id === s.group_id);
          return grp && (grp.specialization === spec.name || grp.parent_group_id === spec.id);
        });
      }
    }
    if (announcementGroup) {
      filtered = filtered.filter(s => s.group_id === Number(announcementGroup));
    }
    if (announcementProfessor) {
      filtered = filtered.filter(s => s.professor_id === Number(announcementProfessor));
    }
    if (announcementStartDate) {
      filtered = filtered.filter(s => s.session_date >= announcementStartDate);
    }
    if (announcementEndDate) {
      filtered = filtered.filter(s => s.session_date <= announcementEndDate);
    }

    if (filtered.length === 0) {
      showNotification('warning', 'لا توجد حصص تطابق معايير الفلترة المحددة في الإعلان');
      return;
    }

    setAnnouncementFilteredList(filtered);
    setPrintModalType('announcement');
    setAnnouncementDialogOpen(false);
    setPrintModalOpen(true);
  };

  // Individual Session Certificate Print Trigger
  const handlePrintCertificate = (session: ExtraSession) => {
    setCertificateSession(session);
    setPrintModalType('certificate');
    setPrintModalOpen(true);
  };

  // Sessions List by Type Print Trigger
  const handlePrintSessionsList = (type: string = 'all') => {
    setDateRangeType(type);
    setDateRangePrintOpen(true);
  };

  // Date Range Print Trigger
  const handlePrintDateRangeList = () => {
    let filtered = extraSessions;
    if (dateRangeType !== 'all') {
      filtered = filtered.filter(s => s.session_type === dateRangeType);
    }
    if (dateRangeStart) {
      filtered = filtered.filter(s => s.session_date >= dateRangeStart);
    }
    if (dateRangeEnd) {
      filtered = filtered.filter(s => s.session_date <= dateRangeEnd);
    }

    setAnnouncementFilteredList(filtered);
    setPrintModalType('list');
    setDateRangePrintOpen(false);
    setPrintModalOpen(true);
  };

  // Full Room Availability Matrix HTML Export
  const handleExportFullMatrix = () => {
    setPrintModalType('matrix');
    setPrintModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16 font-sans text-slate-900 dark:text-slate-100" dir="rtl">
      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <DoorOpen className="h-6 w-6" />
                </span>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                    كشف الشغور وبرمجة الحصص الإضافية والتعويضية
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    النظام الشامل لإدارة الشغور اللحظي، برمجة الاستدراكات، الفروض المحروسة، وطباعة الإعلانات والشهادات الرسمية
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2.5">
              {/* Year & Semester Pill */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <span>{academicYear}</span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span>{semester}</span>
              </div>

              {/* Department Head Edit Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDepartmentHeadDialogOpen(true)}
                className="gap-1.5 text-xs font-medium"
                title="تعديل اسم ومسمى رئيس القسم لتوقيع الشهادات"
              >
                <User className="h-3.5 w-3.5 text-slate-500" />
                <span>رئيس القسم: <strong>{departmentHead}</strong></span>
              </Button>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={loadMasterData}
                disabled={refreshing}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>تحديث</span>
              </Button>

              {/* New Session Quick Button */}
              <Button
                variant="primary"
                size="sm"
                onClick={() => openCreateModalWithSlot()}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>برمجة حصة جديدة</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div
            className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-medium shadow-sm border ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : notification.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                : 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : notification.type === 'warning' ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-600" />
              )}
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="p-1 rounded hover:bg-black/5">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Tabs Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Tabs defaultValue="search" value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6 grid grid-cols-2 sm:grid-cols-4 w-full max-w-3xl">
            <TabTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              <span>فحص شغور القاعات</span>
            </TabTrigger>
            <TabTrigger value="matrix" className="gap-2">
              <Layers className="h-4 w-4" />
              <span>مصفوفة الشغور اليومية</span>
            </TabTrigger>
            <TabTrigger value="schedule" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              <span>برمجة الحصص الإضافية</span>
            </TabTrigger>
            <TabTrigger value="log" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              <span>جدول التعويضات والحصص ({upcomingCount})</span>
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
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Filter className="h-4 w-4 text-emerald-600" />
                        <span>معايير البحث عن القاعات المتاحة لحظياً</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        اختر التاريخ والفترة الزمنية لفحص توفر كافة القاعات الـ {rooms.length} في وقت واحد
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
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
                        <span>طباعة تقرير الشغور</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                    {/* Date Picker */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        تاريخ الحصة المطلوبة
                      </label>
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full text-xs font-mono"
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        اليوم: <strong className="text-emerald-600">{SYSTEM_DAYS.find(d => d.id === currentSearchSystemDay)?.name}</strong>
                      </span>
                    </div>

                    {/* Time Slot Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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

                    {/* Capacity Filter */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        الحد الأدنى للسعة
                      </label>
                      <select
                        value={minCapacity}
                        onChange={(e) => setMinCapacity(Number(e.target.value))}
                        className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                      >
                        <option value={0}>جميع السعات</option>
                        <option value={30}>30 مقعداً فأكثر (أفواج TD/TP)</option>
                        <option value={50}>50 مقعداً فأكثر</option>
                        <option value={100}>100 مقعد فأكثر (مدرجات صغيرة)</option>
                        <option value={200}>200 مقعد فأكثر (مدرجات كبرى أ، ب)</option>
                      </select>
                    </div>

                    {/* Building Filter */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        المبنى / الجناح
                      </label>
                      <select
                        value={selectedBuilding}
                        onChange={(e) => setSelectedBuilding(e.target.value)}
                        className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                      >
                        <option value="all">جميع المباني</option>
                        <option value="المجمع الرئيسي">المجمع الرئيسي</option>
                        <option value="جناح المدرجات">جناح المدرجات</option>
                        <option value="مبنى الامتحانات">مبنى الامتحانات</option>
                      </select>
                    </div>

                    {/* Room Type */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        نوع القاعة
                      </label>
                      <select
                        value={selectedRoomType}
                        onChange={(e) => setSelectedRoomType(e.target.value)}
                        className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                      >
                        <option value="all">جميع الأنواع</option>
                        <option value="amphi">مدرج (Amphithéâtre)</option>
                        <option value="td">قاعة TD</option>
                        <option value="tp">مخبر / قاعة TP</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">القاعات الشاغرة الآن</p>
                      <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">
                        {vacantRoomsList.length}
                        <span className="text-xs font-normal text-emerald-700 mr-1.5">من أصل {evaluatedRooms.length}</span>
                      </p>
                    </div>
                    <span className="p-3 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-2xl">
                      <CheckCircle2 className="h-6 w-6" />
                    </span>
                  </CardContent>
                </Card>

                <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-rose-800 dark:text-rose-300">القاعات المشغولة</p>
                      <p className="text-2xl font-bold text-rose-900 dark:text-rose-200 mt-1">
                        {occupiedRoomsList.length}
                        <span className="text-xs font-normal text-rose-700 mr-1.5">حصة مبرمجة</span>
                      </p>
                    </div>
                    <span className="p-3 bg-rose-500/20 text-rose-700 dark:text-rose-300 rounded-2xl">
                      <DoorOpen className="h-6 w-6" />
                    </span>
                  </CardContent>
                </Card>

                <Card className="border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300">نسبة الشغور الحالية</p>
                      <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-200 mt-1">
                        {evaluatedRooms.length > 0
                          ? Math.round((vacantRoomsList.length / evaluatedRooms.length) * 100)
                          : 0}%
                      </p>
                    </div>
                    <span className="p-3 bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-2xl">
                      <Clock className="h-6 w-6" />
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* Vacant Rooms Grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>القاعات الشاغرة الجاهزة للحجز الفوري ({vacantRoomsList.length})</span>
                  </h3>
                  <span className="text-xs text-slate-500">انقر على أي قاعة لبرمجة حصة فورية</span>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                      <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : vacantRoomsList.length === 0 ? (
                  <EmptyState
                    title="لا توجد قاعات شاغرة في هذه الفترة"
                    description="كافة القاعات محجوزة بحصص رسمية أو إضافية في هذا التوقيت. يرجى اختيار فترة زمنية أخرى."
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                    {vacantRoomsList.map(({ room }) => (
                      <div
                        key={room.id}
                        onClick={() => openCreateModalWithSlot(room, selectedTimeSlot, selectedDate)}
                        className="group p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500" />
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                              {room.name}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {room.building || 'المبنى الرئيسي'}
                            </p>
                          </div>
                          <Badge variant="success">شاغرة</Badge>
                        </div>

                        <div className="mt-3.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                          <span className="flex items-center gap-1 font-mono">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            {room.capacity} مقعد
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline flex items-center gap-1">
                            <span>حجز سريع</span>
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Occupied Rooms Accordion/Section */}
              {occupiedRoomsList.length > 0 && (
                <div className="pt-2">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <span>القاعات المشغولة في هذا التوقيت ({occupiedRoomsList.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {occupiedRoomsList.map(({ room, occupant }) => (
                      <div
                        key={room.id}
                        className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 opacity-90 text-xs"
                      >
                        <div className="flex items-center justify-between font-bold mb-1.5">
                          <span className="text-slate-800 dark:text-slate-200">{room.name}</span>
                          <Badge variant={occupant?.type === 'extra' ? 'warning' : 'danger'}>
                            {occupant?.type === 'extra' ? 'حصة إضافية' : 'جدول أسبوعي'}
                          </Badge>
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{occupant?.course}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                          الأستاذ: {occupant?.professor} | {occupant?.group}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabContent>

          {/* ================================================================= */}
          {/* TAB 2: DAILY ROOM OCCUPANCY MATRIX                                */}
          {/* ================================================================= */}
          <TabContent value="matrix">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      <span>مصفوفة الشغور اليومية الشاملة لجميع القاعات</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      عرض متكامل لحالة الـ {rooms.length} قاعة عبر الفترات الست ليوم {SYSTEM_DAYS.find(d => d.id === currentSearchSystemDay)?.name} ({selectedDate})
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportFullMatrix}
                      className="gap-1.5 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>تقرير المصفوفة الكاملة</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-3 px-3.5 text-start font-bold sticky right-0 bg-slate-100 dark:bg-slate-800 z-10 w-44">
                          القاعة / المدرج
                        </th>
                        {OFFICIAL_TIME_SLOTS.map(slot => (
                          <th key={slot} className="py-3 px-2 text-center font-bold font-mono">
                            {slot}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                      {rooms.map(room => (
                        <tr key={room.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-slate-100 sticky right-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
                            <div>{room.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">سعة: {room.capacity}</div>
                          </td>
                          {OFFICIAL_TIME_SLOTS.map(slot => {
                            const [sS, sE] = slot.split('-').map(s => s.trim());
                            const assign = regularAssignments.find(a =>
                              a.room_id === room.id &&
                              a.day_of_week === currentSearchSystemDay &&
                              isTimeOverlap(sS, sE, a.start_time, a.end_time)
                            );
                            const extra = extraSessions.find(s =>
                              s.room_id === room.id &&
                              s.session_date === selectedDate &&
                              s.is_archived !== 1 &&
                              isTimeOverlap(sS, sE, s.start_time, s.end_time)
                            );

                            if (assign) {
                              return (
                                <td key={slot} className="p-1.5 text-center">
                                  <div className="p-2 rounded-xl bg-rose-100/70 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-900 text-[11px] text-rose-900 dark:text-rose-200 text-start">
                                    <div className="font-bold truncate">{assign.course_name}</div>
                                    <div className="truncate text-[10px] text-rose-700 dark:text-rose-400">{assign.professor_name}</div>
                                    <div className="truncate text-[10px] text-slate-500">{assign.group_name}</div>
                                  </div>
                                </td>
                              );
                            }

                            if (extra) {
                              return (
                                <td key={slot} className="p-1.5 text-center">
                                  <div className="p-2 rounded-xl bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-900 text-[11px] text-amber-900 dark:text-amber-200 text-start">
                                    <div className="font-bold truncate">{extra.course_name}</div>
                                    <div className="truncate text-[10px] text-amber-700 dark:text-amber-400">{extra.professor_name}</div>
                                    <Badge variant="warning" className="text-[9px] mt-1">تعويضية</Badge>
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td key={slot} className="p-1.5 text-center">
                                <button
                                  onClick={() => openCreateModalWithSlot(room, slot, selectedDate)}
                                  className="w-full py-3 px-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-1 group"
                                  title="انقر لحجز هذه القاعة فوراً"
                                >
                                  <Plus className="h-3.5 w-3.5 group-hover:scale-125 transition-transform" />
                                  <span>متاحة</span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabContent>

          {/* ================================================================= */}
          {/* TAB 3: FULL SCHEDULING BUILDER (Interactive Form)                 */}
          {/* ================================================================= */}
          <TabContent value="schedule">
            <div className="max-w-4xl mx-auto space-y-6">
              <Card>
                <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-emerald-600" />
                        <span>نموذج برمجة الحصص الإضافية والتعويضية المتكامل</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        تصفية متسلسلة للأقسام والتخصصات، كشف التعارضات اللحظي الذكي، ودعم تعدد الأفواج والقاعات
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetSchedulingForm}
                      className="gap-1.5 text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>إعادة تعيين النموذج</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmitSession} className="space-y-5">
                    {/* Real-time Conflict Alert Box */}
                    {conflicts.length > 0 ? (
                      <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-xs text-rose-800 dark:text-rose-300">
                          <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                          <span>تم اكتشاف تعارض في الجدولة يمنع الحجز:</span>
                        </div>
                        <ul className="list-disc list-inside text-xs space-y-1 font-medium mr-2">
                          {conflicts.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      selectedProfessor && selectedCourse && (selectedRoom || effectiveRoomIds.length > 0) && (
                        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-center gap-2 text-xs font-semibold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>التوقيت والقاعة والأستاذ متاحون بالكامل دون أي تعارض، يمكنك الحفظ الآن.</span>
                        </div>
                      )
                    )}

                    {/* Section 1: Professor & Course Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Professor Selector with Live Auto-Search */}
                      <div className="relative">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          الأستاذ المعني * (بحث مباشر بالاسم)
                        </label>
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder="ابحث عن أستاذ..."
                            value={professorSearchTerm}
                            onChange={(e) => {
                              setProfessorSearchTerm(e.target.value);
                              setIsProfDropdownOpen(true);
                            }}
                            onFocus={() => setIsProfDropdownOpen(true)}
                            className="w-full text-xs"
                          />
                          <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>

                        {/* Search Dropdown Popup */}
                        {isProfDropdownOpen && (
                          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                            {filteredProfessorsSearch.length === 0 ? (
                              <div className="p-3 text-xs text-slate-500 text-center">لا يوجد أستاذ بهذا الاسم</div>
                            ) : (
                              filteredProfessorsSearch.map(prof => (
                                <div
                                  key={prof.id}
                                  onClick={() => {
                                    setSelectedProfessor(prof.id);
                                    setProfessorSearchTerm(prof.name);
                                    setIsProfDropdownOpen(false);
                                  }}
                                  className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs flex items-center justify-between"
                                >
                                  <span className="font-semibold">{prof.name}</span>
                                  {prof.title && <span className="text-[10px] text-slate-500">{prof.title}</span>}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                        {selectedProfessor && (
                          <span className="text-[11px] text-emerald-600 mt-1 block">
                            تم اختيار: <strong>{professors.find(p => p.id === Number(selectedProfessor))?.name}</strong>
                          </span>
                        )}
                      </div>

                      {/* Course Selector */}
                      <div className="relative">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          المقياس / المادة *
                        </label>
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder={selectedProfessor ? "ابحث في مقررات الأستاذ..." : "ابحث عن مقياس..."}
                            value={courseSearchTerm}
                            onChange={(e) => {
                              setCourseSearchTerm(e.target.value);
                              setIsCourseDropdownOpen(true);
                            }}
                            onFocus={() => setIsCourseDropdownOpen(true)}
                            className="w-full text-xs"
                          />
                          <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>

                        {isCourseDropdownOpen && (
                          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                            {filteredCoursesSearch.length === 0 ? (
                              <div className="p-3 text-xs text-slate-500 text-center">لا يوجد مقياس بهذا الاسم</div>
                            ) : (
                              filteredCoursesSearch.map(c => (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    setSelectedCourse(c.id);
                                    setCourseSearchTerm(c.name);
                                    setIsCourseDropdownOpen(false);
                                  }}
                                  className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs flex items-center justify-between"
                                >
                                  <span className="font-semibold">{c.name}</span>
                                  {c.code && <span className="text-[10px] text-slate-500 font-mono">[{c.code}]</span>}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                        {selectedCourse && (
                          <span className="text-[11px] text-emerald-600 mt-1 block">
                            تم اختيار: <strong>{courses.find(c => c.id === Number(selectedCourse))?.name}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Cascading Filters (Department -> Specialization -> Group) */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        <span>التصفية الأكاديمية المتسلسلة (القسم ← التخصص ← الفوج)</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="multiGroupCheckSchedule"
                            checked={isMultiGroup}
                            onChange={(e) => setIsMultiGroup(e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          <label htmlFor="multiGroupCheckSchedule" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                            تحديد أفواج متعددة (محاضرة مشتركة / امتحان)
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Department */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            القسم الأكاديمي
                          </label>
                          <select
                            value={selectedDepartment}
                            onChange={(e) => {
                              setSelectedDepartment(e.target.value ? Number(e.target.value) : '');
                              setSelectedSpecialization('');
                              setSelectedGroup('');
                            }}
                            className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                          >
                            <option value="">جميع الأقسام</option>
                            {departments.map(dept => (
                              <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Specialization */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            التخصص الدراسي
                          </label>
                          <select
                            value={selectedSpecialization}
                            onChange={(e) => {
                              setSelectedSpecialization(e.target.value ? Number(e.target.value) : '');
                              setSelectedGroup('');
                            }}
                            className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                          >
                            <option value="">جميع التخصصات</option>
                            {filteredSpecializations.map(spec => (
                              <option key={spec.id} value={spec.id}>{spec.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Groups */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            {isMultiGroup ? 'الأفواج المستهدفة (تحديد متعدد)' : 'الفوج المستهدف'}
                          </label>
                          {!isMultiGroup ? (
                            <select
                              value={selectedGroup}
                              onChange={(e) => setSelectedGroup(e.target.value ? Number(e.target.value) : '')}
                              className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                            >
                              <option value="">-- الدفعة كاملة أو اختر فوجاً --</option>
                              {filteredGroups.map(grp => (
                                <option key={grp.id} value={grp.id}>
                                  {grp.name} {grp.specialization ? `(${grp.specialization})` : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="max-h-28 overflow-y-auto border border-slate-300 dark:border-slate-700 rounded-xl p-2 bg-white dark:bg-slate-900 space-y-1">
                              {filteredGroups.map(grp => {
                                const checked = selectedGroupIds.includes(grp.id);
                                return (
                                  <label key={grp.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        if (checked) {
                                          setSelectedGroupIds(selectedGroupIds.filter(id => id !== grp.id));
                                        } else {
                                          setSelectedGroupIds([...selectedGroupIds, grp.id]);
                                        }
                                      }}
                                      className="rounded text-emerald-600"
                                    />
                                    <span>{grp.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Session Nature, Type, Day & Timing */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Nature */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          طبيعة البرمجة *
                        </label>
                        <select
                          value={scheduleNature}
                          onChange={(e) => setScheduleNature(e.target.value as any)}
                          className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                        >
                          <option value="single">حصة لمرة واحدة بتاريخ محدد</option>
                          <option value="recurring">حصة دورية متكررة أسبوعياً خلال فترة</option>
                        </select>
                      </div>

                      {/* Session Type */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          نوع الحصة *
                        </label>
                        <select
                          value={formSessionType}
                          onChange={(e) => setFormSessionType(e.target.value as any)}
                          className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                        >
                          {SESSION_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Date */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          {scheduleNature === 'recurring' ? 'تاريخ أول حصة *' : 'تاريخ الحصة *'}
                        </label>
                        <Input
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          required
                          className="w-full text-xs font-mono"
                        />
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          اليوم: <strong className="text-emerald-600">{SYSTEM_DAYS.find(d => d.id === formSystemDay)?.name}</strong>
                        </span>
                      </div>
                    </div>

                    {scheduleNature === 'recurring' && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                        <span>تاريخ انتهاء التكرار الأسبوعي:</span>
                        <Input
                          type="date"
                          value={recurringEndDate}
                          onChange={(e) => setRecurringEndDate(e.target.value)}
                          className="w-48 text-xs font-mono bg-white dark:bg-slate-900"
                        />
                      </div>
                    )}

                    {/* Section 4: Time Slot & Room Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Time Slot */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            التوقيت المعتمد *
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
                            value={formTimeSlot}
                            onChange={(e) => setFormTimeSlot(e.target.value)}
                            className="w-full py-2 px-3 text-xs font-mono font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                          >
                            {OFFICIAL_TIME_SLOTS.map(slot => (
                              <option key={slot} value={slot}>{slot}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="time"
                              value={customStartTime}
                              onChange={(e) => setCustomStartTime(e.target.value)}
                              className="w-full text-xs font-mono"
                            />
                            <Input
                              type="time"
                              value={customEndTime}
                              onChange={(e) => setCustomEndTime(e.target.value)}
                              className="w-full text-xs font-mono"
                            />
                          </div>
                        )}
                      </div>

                      {/* Room Selector */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            القاعة المخصصة *
                          </label>
                          {isSelectedRoomVacant !== null && (
                            <span className={`text-[10px] font-bold ${isSelectedRoomVacant ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isSelectedRoomVacant ? '✅ القاعة شاغرة' : '❌ القاعة مشغولة'}
                            </span>
                          )}
                        </div>
                        <select
                          value={selectedRoom}
                          onChange={(e) => setSelectedRoom(e.target.value ? Number(e.target.value) : '')}
                          required
                          className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                        >
                          <option value="">-- اختر القاعة --</option>
                          {rooms.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name} (السعة: {r.capacity}) - {r.building || 'الرئيسي'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Section 5: Reason & Exam Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          سبب الحصة / ملاحظات إدارية
                        </label>
                        <Input
                          type="text"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="مثال: تعويض غياب مبرر، استدراك حصة، مراجعة نهائية"
                          className="w-full text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          تعليمات الامتحان والحراسة (في حال الامتحانات)
                        </label>
                        <Input
                          type="text"
                          value={examNote}
                          onChange={(e) => setExamNote(e.target.value)}
                          placeholder="تعليمات إضافية للطلبة والمراقبين"
                          className="w-full text-xs"
                        />
                      </div>
                    </div>

                    {/* Ignore Conflicts Override */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="ignoreConflictsSchedule"
                          checked={ignoreConflicts}
                          onChange={(e) => setIgnoreConflicts(e.target.checked)}
                          className="rounded text-amber-600"
                        />
                        <label htmlFor="ignoreConflictsSchedule" className="text-xs text-amber-800 dark:text-amber-400 font-semibold cursor-pointer">
                          تجاهل التعارضات (فرض الإضافة) - استخدم هذا الخيار بحذر بعد التنسيق
                        </label>
                      </div>

                      <Button
                        type="submit"
                        variant="primary"
                        disabled={isSubmitting || (conflicts.length > 0 && !ignoreConflicts)}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-6 py-2.5"
                      >
                        <Plus className="h-4 w-4" />
                        <span>{isSubmitting ? 'جاري الحفظ الذري...' : 'تأكيد وبرمجة الحصة'}</span>
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabContent>

          {/* ================================================================= */}
          {/* TAB 4: SESSIONS MANAGEMENT LOG & PRINT SUITE                      */}
          {/* ================================================================= */}
          <TabContent value="log">
            <Card>
              <CardHeader className="pb-4 space-y-4 border-b border-slate-100 dark:border-slate-800">
                {/* 1. Top Controls Bar (Matching Screenshot) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  {/* نوع الحصة (Select dropdown on right in RTL) */}
                  <div className="md:col-span-6">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      نوع الحصة
                    </label>
                    <select
                      value={logTypeFilter}
                      onChange={(e) => setLogTypeFilter(e.target.value)}
                      className="w-full py-2.5 px-3 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="all">جميع أنواع الحصص</option>
                      <option value="extra">حصة إضافية</option>
                      <option value="makeup">حصة تعويض</option>
                      <option value="exam">إمتحان الأعمال الموجهة</option>
                      <option value="semester_exam">إمتحان السداسي</option>
                      <option value="revision">مراجعة</option>
                    </select>
                  </div>

                  {/* عرض الأرشيف (Purple button in center) */}
                  <div className="md:col-span-4">
                    <label className="block text-xs font-semibold text-transparent mb-1 select-none">
                      الأرشيف
                    </label>
                    <Button
                      variant="outline"
                      onClick={() => setShowArchived(!showArchived)}
                      className={`w-full py-2.5 px-4 text-xs font-bold border-2 transition-all rounded-xl ${
                        showArchived
                          ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                          : 'text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-950/40'
                      }`}
                    >
                      {showArchived ? `إخفاء الأرشيف (${archivedCount})` : `عرض الأرشيف (${archivedCount})`}
                    </Button>
                  </div>

                  {/* أرشفة (Amber button on left in RTL) */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-transparent mb-1 select-none">
                      أرشفة
                    </label>
                    <Button
                      variant="outline"
                      onClick={handleManualArchive}
                      disabled={isArchiving}
                      className="w-full py-2.5 px-3 text-xs font-bold text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 rounded-xl"
                      title="أرشف جميع الحصص القديمة يدوياً"
                    >
                      <Archive className="h-4 w-4 ml-1.5" />
                      <span>{isArchiving ? 'جاري الأرشفة...' : '🔄 أرشفة'}</span>
                    </Button>
                  </div>
                </div>

                {/* 2. Blue Info Banner (Matching Screenshot) */}
                <div className="bg-sky-500 text-white p-3.5 rounded-xl shadow-sm text-xs font-semibold flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span>📊 {showArchived ? 'الحصص المؤرشفة' : 'الحصص القادمة'}: {showArchived ? archivedCount : upcomingCount} حصة</span>
                    {!showArchived && (
                      <>
                        <span>|</span>
                        <span>📦 الحصص المؤرشفة: {archivedCount} حصة</span>
                      </>
                    )}
                  </div>
                  {!showArchived && (
                    <div className="text-sky-100 text-[11px] flex items-center gap-1 font-normal">
                      <span>💡 يتم أرشفة الحصص المنتهية تلقائياً كل يوم</span>
                    </div>
                  )}
                </div>

                {/* 3. Five Action Buttons (Matching Screenshot) */}
                <div className="flex items-center flex-wrap gap-2.5 pt-1">
                  {/* طباعة جميع الحصص */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handlePrintSessionsList('all')}
                    className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm"
                  >
                    <Printer className="h-4 w-4" />
                    <span>طباعة جميع الحصص</span>
                  </Button>

                  {/* طباعة الحصص الإضافية */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handlePrintSessionsList('extra')}
                    className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm"
                  >
                    <Printer className="h-4 w-4" />
                    <span>طباعة الحصص الإضافية</span>
                  </Button>

                  {/* طباعة حصص التعويض */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handlePrintSessionsList('makeup')}
                    className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm"
                  >
                    <Printer className="h-4 w-4" />
                    <span>طباعة حصص التعويض</span>
                  </Button>

                  {/* تعديل اسم رئيس القسم */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDepartmentHeadDialogOpen(true)}
                    className="gap-1.5 border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-400 text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm"
                  >
                    <Pencil className="h-4 w-4" />
                    <span>تعديل اسم رئيس القسم</span>
                  </Button>

                  {/* إعلان للطلبة */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setAnnouncementDialogOpen(true)}
                    className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm"
                  >
                    <FileText className="h-4 w-4" />
                    <span>إعلان للطلبة 📝</span>
                  </Button>
                </div>

                {/* 4. Quick Search Bar */}
                <div className="pt-2">
                  <div className="relative">
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="بحث سريع (أستاذ، مقياس، قاعة، فوج، تاريخ)..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="w-full text-xs pr-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {groupedExtraSessions.length === 0 ? (
                  <EmptyState
                    title="لا توجد حصص مبرمجة"
                    description="لم يتم العثور على أي حصة تطابق معايير البحث الحالية."
                  />
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                    <table className="w-full text-start text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                          <th className="py-3.5 px-4 text-start font-bold">نوع الحصة</th>
                          <th className="py-3.5 px-4 text-start font-bold">اليوم والتاريخ</th>
                          <th className="py-3.5 px-4 text-start font-bold">التوقيت</th>
                          <th className="py-3.5 px-4 text-start font-bold">الأستاذ</th>
                          <th className="py-3.5 px-4 text-start font-bold">المقرر</th>
                          <th className="py-3.5 px-4 text-start font-bold">المجموعة</th>
                          <th className="py-3.5 px-4 text-start font-bold">القاعة</th>
                          <th className="py-3.5 px-4 text-center font-bold">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {groupedExtraSessions.map(session => (
                          <tr key={session.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                              {session.session_type === 'exam'
                                ? 'إمتحان الأعمال الموجهة'
                                : session.session_type === 'semester_exam'
                                ? 'إمتحان السداسي'
                                : session.session_type === 'makeup'
                                ? 'حصة تعويض'
                                : session.session_type === 'revision'
                                ? 'مراجعة'
                                : 'حصة إضافية'}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                              {getFormattedSessionDate(session.session_date)}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {session.start_time} - {session.end_time}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                              {session.professor_name || 'أستاذ'}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                              {session.course_name || 'مقياس'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                              {session.group_names.join(' + ')}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                              {session.room_name || 'قاعة'}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {/* Print Individual Certificate */}
                                <button
                                  type="button"
                                  onClick={() => handlePrintCertificate(session)}
                                  className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg transition-colors"
                                  title="طباعة شهادة الحصة الفردية للأستاذ"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>

                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSessionToDelete(session);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                                  title="إلغاء وحذف الحصة"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>

                                {/* Edit */}
                                <button
                                  type="button"
                                  onClick={() => openEditModal(session)}
                                  className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg transition-colors"
                                  title="تعديل الحصة"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
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
      {/* MODAL 1: BOOKING & EDIT DIALOG (Available everywhere)                  */}
      {/* ===================================================================== */}
      <Dialog open={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)}>
        <div className="p-6 text-start max-w-2xl" dir="rtl">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              <span>{editMode ? 'تعديل بيانات الحصة المبرمجة' : 'برمجة حصة تعويضية / إضافية وحجز القاعة'}</span>
            </DialogTitle>
            <button
              onClick={() => setIsBookingModalOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmitSession} className="space-y-4">
            {conflicts.length > 0 ? (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-rose-800">
                  <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>تنبيه التعارض:</span>
                </div>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  {conflicts.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Professor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  الأستاذ المعني *
                </label>
                <select
                  value={selectedProfessor}
                  onChange={(e) => setSelectedProfessor(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="">-- اختر الأستاذ --</option>
                  {professors.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.title ? `(${p.title})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Course */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  المقياس / المادة *
                </label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="">-- اختر المقياس --</option>
                  {(selectedProfessor ? professorCourses : courses).map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.code ? `[${c.code}]` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Group */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  الفوج المعني
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value ? Number(e.target.value) : '')}
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="">-- الدفعة كاملة أو اختر فوجاً --</option>
                  {(selectedProfessor ? professorGroups : groups).map(g => (
                    <option key={g.id} value={g.id}>{g.name} {g.specialization ? `(${g.specialization})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Room */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  القاعة المطلوبة *
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="">-- اختر القاعة --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name} (السعة: {r.capacity})</option>
                  ))}
                </select>
              </div>

              {/* Session Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  نوع الحصة *
                </label>
                <select
                  value={formSessionType}
                  onChange={(e) => setFormSessionType(e.target.value as any)}
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  {SESSION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  تاريخ الحصة *
                </label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full text-xs font-mono"
                />
              </div>

              {/* Time Slot */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  التوقيت *
                </label>
                <select
                  value={formTimeSlot}
                  onChange={(e) => setFormTimeSlot(e.target.value)}
                  className="w-full py-2 px-3 text-xs font-mono font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  {OFFICIAL_TIME_SLOTS.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>

              {/* Reason */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  سبب التعويض أو الملاحظات
                </label>
                <Input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ملاحظات الحصة أو سبب التعويض"
                  className="w-full text-xs"
                />
              </div>
            </div>

            {/* Ignore Conflicts */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="modalIgnoreConflicts"
                checked={ignoreConflicts}
                onChange={(e) => setIgnoreConflicts(e.target.checked)}
                className="rounded text-amber-600"
              />
              <label htmlFor="modalIgnoreConflicts" className="text-xs text-amber-800 font-semibold cursor-pointer">
                تجاهل التعارضات (فرض الحفظ)
              </label>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsBookingModalOpen(false)}>
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || (conflicts.length > 0 && !ignoreConflicts)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
              >
                <Check className="h-4 w-4" />
                <span>{isSubmitting ? 'جاري الحفظ...' : editMode ? 'حفظ التعديلات' : 'تأكيد وحجز الحصة'}</span>
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL 2: STUDENT ANNOUNCEMENT CONFIGURATION DIALOG                     */}
      {/* ===================================================================== */}
      <Dialog open={announcementDialogOpen} onClose={() => setAnnouncementDialogOpen(false)}>
        <div className="p-6 text-start max-w-2xl" dir="rtl">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              <span>إعداد إعلان رسمي للطلبة 📝</span>
            </DialogTitle>
            <button
              onClick={() => setAnnouncementDialogOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-200">
              📌 اختر القسم، التخصص، أو الأستاذ لتصفية الحصص التي ستظهر في الإعلان المعلق للطلبة.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Session Type */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">نوع الحصة في الإعلان</label>
                <select
                  value={announcementSessionType}
                  onChange={(e) => setAnnouncementSessionType(e.target.value)}
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="all">جميع الحصص (تعويضية وإضافية وفروض محروسة)</option>
                  <option value="makeup">حصص تعويضية فقط</option>
                  <option value="extra">حصص إضافية فقط</option>
                  <option value="exam">فروض محروسة وامتحانات فقط</option>
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold mb-1">القسم</label>
                <select
                  value={announcementDepartment}
                  onChange={(e) => {
                    setAnnouncementDepartment(e.target.value ? Number(e.target.value) : '');
                    setAnnouncementSpecialization('');
                    setAnnouncementGroup('');
                  }}
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="">جميع الأقسام</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Specialization */}
              <div>
                <label className="block text-xs font-semibold mb-1">التخصص</label>
                <select
                  value={announcementSpecialization}
                  onChange={(e) => {
                    setAnnouncementSpecialization(e.target.value ? Number(e.target.value) : '');
                    setAnnouncementGroup('');
                  }}
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="">جميع التخصصات</option>
                  {filteredSpecializations.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Group */}
              <div>
                <label className="block text-xs font-semibold mb-1">الفوج</label>
                <select
                  value={announcementGroup}
                  onChange={(e) => setAnnouncementGroup(e.target.value ? Number(e.target.value) : '')}
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="">جميع الأفواج</option>
                  {filteredGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Professor */}
              <div>
                <label className="block text-xs font-semibold mb-1">الأستاذ</label>
                <select
                  value={announcementProfessor}
                  onChange={(e) => setAnnouncementProfessor(e.target.value ? Number(e.target.value) : '')}
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="">جميع الأساتذة</option>
                  {professorsWithExtraSessions.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold mb-1">من تاريخ</label>
                <Input
                  type="date"
                  value={announcementStartDate}
                  onChange={(e) => setAnnouncementStartDate(e.target.value)}
                  className="w-full text-xs font-mono"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs font-semibold mb-1">إلى تاريخ</label>
                <Input
                  type="date"
                  value={announcementEndDate}
                  onChange={(e) => setAnnouncementEndDate(e.target.value)}
                  className="w-full text-xs font-mono"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setAnnouncementDialogOpen(false)}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={handlePrintStudentAnnouncement}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
              >
                <Printer className="h-4 w-4" />
                <span>معاينة وطباعة الإعلان</span>
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL 3: DATE RANGE SESSIONS LIST PRINT DIALOG                         */}
      {/* ===================================================================== */}
      <Dialog open={dateRangePrintOpen} onClose={() => setDateRangePrintOpen(false)}>
        <div className="p-6 text-start max-w-lg" dir="rtl">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Printer className="h-5 w-5 text-emerald-600" />
              <span>تحديد نطاق التواريخ لطباعة كشف الحصص</span>
            </DialogTitle>
            <button onClick={() => setDateRangePrintOpen(false)} className="p-1 text-slate-400">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">نوع الحصص</label>
              <select
                value={dateRangeType}
                onChange={(e) => setDateRangeType(e.target.value)}
                className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                <option value="all">جميع الحصص</option>
                <option value="extra">الحصص الإضافية فقط</option>
                <option value="makeup">حصص التعويض فقط</option>
                <option value="exam">الفروض المحروسة فقط</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">تاريخ البداية</label>
                <Input
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  className="w-full text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">تاريخ النهاية</label>
                <Input
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  className="w-full text-xs font-mono"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t">
              <Button variant="outline" onClick={() => setDateRangePrintOpen(false)}>إلغاء</Button>
              <Button variant="primary" onClick={handlePrintDateRangeList} className="gap-2 bg-emerald-600 text-white font-semibold text-xs">
                <Printer className="h-4 w-4" />
                <span>طباعة الكشف</span>
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL 4: DEPARTMENT HEAD NAME DIALOG                                   */}
      {/* ===================================================================== */}
      <Dialog open={departmentHeadDialogOpen} onClose={() => setDepartmentHeadDialogOpen(false)}>
        <div className="p-6 text-start max-w-md" dir="rtl">
          <DialogTitle className="text-base font-bold flex items-center gap-2 mb-3">
            <User className="h-5 w-5 text-emerald-600" />
            <span>تعديل اسم ومسمى رئيس القسم للتوقيع الرسمي</span>
          </DialogTitle>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              يظهر هذا الاسم في تذييل كافة الإعلانات والشهادات الرسمية المطبوعة من النظام.
            </p>
            <Input
              type="text"
              value={tempDeptHead}
              onChange={(e) => setTempDeptHead(e.target.value)}
              placeholder="مثال: د. لخضر / أ. د. محمد"
              className="w-full text-xs"
            />
            <div className="pt-3 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setDepartmentHeadDialogOpen(false)}>إلغاء</Button>
              <Button variant="primary" onClick={handleSaveDepartmentHead} className="bg-emerald-600 text-white text-xs font-semibold">
                حفظ
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL 5: DELETE CONFIRMATION DIALOG                                    */}
      {/* ===================================================================== */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <div className="p-6 text-start" dir="rtl">
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <span>تأكيد إلغاء الحصة وحذفها</span>
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            هل أنت متأكد من إلغاء الحصة المبرمجة لمقياس "{sessionToDelete?.course_name}" للأستاذ {sessionToDelete?.professor_name} بتاريخ {sessionToDelete?.session_date} في القاعة {sessionToDelete?.room_name}؟
            سيتم تحرير القاعة في النظام فوراً وتسجيل العملية في سجل التدقيق.
          </DialogDescription>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>تراجع</Button>
            <Button
              variant="danger"
              disabled={isDeleting}
              onClick={handleDeleteSessionConfirm}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs"
            >
              {isDeleting ? 'جاري الإلغاء...' : 'نعم، احذف الحصة'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ===================================================================== */}
      {/* MODAL 6: PRINT PREVIEW SUITE (Official Algerian A4 Layout)             */}
      {/* ===================================================================== */}
      <Dialog open={printModalOpen} onClose={() => setPrintModalOpen(false)}>
        <div className="p-6 text-start max-w-4xl" dir="rtl">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Printer className="h-5 w-5 text-emerald-600" />
              <span>
                {printModalType === 'announcement'
                  ? 'إعلان رسمي للطلبة (A4 جاهز للنشر)'
                  : printModalType === 'certificate'
                  ? 'شهادة إنجاز حصة رسمية'
                  : printModalType === 'matrix'
                  ? 'مصفوفة الشغور الأسبوعية الشاملة'
                  : 'كشف الحصص الإضافية والتعويضية'}
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
                <span>طباعة الوثيقة</span>
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
          <div className="bg-white p-8 border rounded-2xl print:p-0 print:border-none text-slate-900 shadow-sm font-sans" id="printable-section">
            {/* Algerian Official University Header */}
            <div className="text-center border-b pb-4 mb-5">
              <h2 className="font-bold text-sm">الجمهورية الجزائرية الديمقراطية الشعبية</h2>
              <h3 className="font-bold text-xs mt-0.5">وزارة التعليم العالي والبحث العلمي</h3>
              <h4 className="font-semibold text-xs mt-0.5">جامعة الشهيد حمه لخضر - الوادي | كلية العلوم الاقتصادية والتجارية وعلوم التسيير</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">قسم التدريس والبرمجة البيداغوجية</p>
              <div className="text-[11px] text-slate-500 mt-2 font-mono">
                السنة الجامعية: {academicYear} | {semester}
              </div>
            </div>

            {/* View 1: Student Announcement Notice (100% Algerian Faculty Official Layout) */}
            {printModalType === 'announcement' && (
              <div className="relative space-y-6 py-2" dir="rtl">
                {/* Background Watermark */}
                {printSettings?.enable_watermark && printSettings?.university_logo_url && (
                  <div
                    className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0"
                    style={{ opacity: printSettings?.watermark_opacity ?? 0.08 }}
                  >
                    <img
                      src={printSettings.university_logo_url}
                      alt="Watermark"
                      className="w-[420px] h-[420px] object-contain select-none"
                    />
                  </div>
                )}

                <div className="relative z-10 space-y-5">
                  {/* Triple Official Header with Logos */}
                  <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                    {/* Right: Faculty Logo & Info */}
                    <div className="flex items-center gap-3 max-w-[36%]">
                      {printSettings?.faculty_logo_url && (
                        <img
                          src={printSettings.faculty_logo_url}
                          alt="Faculty Logo"
                          className="h-16 w-16 object-contain shrink-0"
                        />
                      )}
                      <div className="text-right text-[11px] leading-tight space-y-0.5">
                        <p className="font-bold text-slate-900">{printSettings?.faculty_name_ar || 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير'}</p>
                        <p className="text-slate-700">{printSettings?.deanery_name_ar || 'نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة'}</p>
                        <p className="text-slate-600 font-medium">قسم: {announcementDepartment ? departments.find(d => d.id === Number(announcementDepartment))?.name : (printSettings?.service_name_ar || 'مصلحة التدريس')}</p>
                      </div>
                    </div>

                    {/* Center: Republic & University */}
                    <div className="text-center space-y-0.5">
                      <p className="font-bold text-xs text-slate-900">{printSettings?.republic_name_ar || 'الجمهورية الجزائرية الديمقراطية الشعبية'}</p>
                      <p className="font-bold text-[11px] text-slate-800">{printSettings?.ministry_name_ar || 'وزارة التعليم العالي والبحث العلمي'}</p>
                      <p className="font-extrabold text-xs text-slate-950 pt-0.5">{printSettings?.university_name_ar || 'جامعة الشهيد حمه لخضر - الوادي'}</p>
                    </div>

                    {/* Left: University Logo */}
                    <div className="flex items-center justify-end max-w-[25%]">
                      {printSettings?.university_logo_url ? (
                        <img
                          src={printSettings.university_logo_url}
                          alt="University Logo"
                          className="h-16 w-16 object-contain"
                        />
                      ) : (
                        <div className="h-16 w-16 border border-dashed rounded-lg flex items-center justify-center text-[9px] text-slate-400">شعار الجامعة</div>
                      )}
                    </div>
                  </div>

                  {/* Centered Announcement Badge */}
                  <div className="text-center pt-1">
                    <div className="inline-block px-10 py-2.5 rounded-xl border-2 border-slate-950 font-black text-lg bg-slate-50 shadow-sm text-slate-950">
                      إعـــــــــلان للطلبة 📝
                    </div>
                    <div className="mt-2 text-xs font-bold text-slate-800">
                      قسم: {announcementDepartment ? departments.find(d => d.id === Number(announcementDepartment))?.name : 'العلوم الاقتصادية والتجارية وعلوم التسيير'}
                    </div>
                  </div>

                  {/* Preface Paragraph */}
                  <div className="text-xs leading-relaxed text-slate-900 font-medium bg-slate-50/60 p-3 rounded-xl border border-slate-200">
                    ليكن في علم طلبة قسم <strong>{announcementDepartment ? departments.find(d => d.id === Number(announcementDepartment))?.name : 'الكلية'}</strong>
                    {announcementSpecialization ? ` تخصص <strong>${specializations.find(sp => sp.id === Number(announcementSpecialization))?.name || ''}</strong>` : ''} أنه تقرر برمجة{' '}
                    <strong className="text-rose-700">
                      {announcementSessionType === 'extra'
                        ? 'حصة إضافية'
                        : announcementSessionType === 'makeup'
                        ? 'حصة تعويضية'
                        : announcementSessionType === 'exam'
                        ? 'إمتحان الأعمال الموجهة'
                        : 'حصص تعويضية وإضافية'}
                    </strong> وذلك حسب الجدول الموالي:
                  </div>

                  {/* 7-Column Table with 2-line Day & Date */}
                  <table className="w-full text-xs border-2 border-slate-900 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b-2 border-slate-900 font-bold text-slate-950">
                        <th className="p-2 border border-slate-900 text-center">اليوم والتاريخ</th>
                        <th className="p-2 border border-slate-900 text-center">التوقيت</th>
                        <th className="p-2 border border-slate-900 text-start">المقرر</th>
                        <th className="p-2 border border-slate-900 text-start">الأستاذ</th>
                        <th className="p-2 border border-slate-900 text-start">المجموعة</th>
                        <th className="p-2 border border-slate-900 text-center">القاعة</th>
                        <th className="p-2 border border-slate-900 text-center">نوع الحصة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Group identical sessions and merge group names
                        const accMap = new Map<string, any>();
                        for (const s of announcementFilteredList) {
                          const key = `${s.session_date}_${s.start_time}_${s.end_time}_${s.room_id}_${s.course_id}_${s.professor_id}_${s.session_type}`;
                          const existing = accMap.get(key);
                          if (existing) {
                            if (s.group_name && !existing.group_names.includes(s.group_name)) {
                              existing.group_names.push(s.group_name);
                            }
                          } else {
                            accMap.set(key, {
                              ...s,
                              key,
                              group_names: s.group_name ? [s.group_name] : ['الدفعة كاملة']
                            });
                          }
                        }
                        const grouped = Array.from(accMap.values());

                        return grouped.map((s: any) => {
                          const dateParts = (s.session_date || '').split('-');
                          const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : s.session_date;
                          const dayName = SYSTEM_DAYS.find(d => d.id === dateToSystemDay(s.session_date))?.name || '';

                          return (
                            <tr key={s.key} className="border-b border-slate-800 text-center">
                              <td className="p-2 border border-slate-800 font-semibold leading-tight">
                                <div>{dayName}</div>
                                <div className="text-[11px] font-mono text-slate-600 font-bold">{formattedDate}</div>
                              </td>
                              <td className="p-2 border border-slate-800 text-center font-mono font-bold">{s.start_time} - {s.end_time}</td>
                              <td className="p-2 border border-slate-800 font-bold text-start text-slate-950">{s.course_name}</td>
                              <td className="p-2 border border-slate-800 text-start">{s.professor_name}</td>
                              <td className="p-2 border border-slate-800 text-start font-medium">{s.group_names.join(' + ')}</td>
                              <td className="p-2 border border-slate-800 text-center font-black text-emerald-800">{s.room_name}</td>
                              <td className="p-2 border border-slate-800 text-center font-bold">
                                {s.session_type === 'exam'
                                  ? 'إمتحان الأعمال الموجهة'
                                  : s.session_type === 'makeup'
                                  ? 'حصة تعويض'
                                  : 'حصة إضافية'}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>

                  {/* Mandatory Attendance Alert Box */}
                  <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-950 text-xs">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span>ملاحظة هامة:</span>
                    </p>
                    <p className="leading-relaxed">
                      يعتبر الحضور للحصة المشار إليها <strong>إجباريًا</strong> (بالنسبة للأعمال الموجهة)، ويتحمل الطالب مسؤولية أي غياب يترتب عنه.
                    </p>
                  </div>

                  {/* Secondary Exam Warning Box if exams exist */}
                  {announcementFilteredList.some(s => s.session_type === 'exam') && (
                    <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-950 text-xs">
                      <p className="font-bold flex items-center gap-1.5 mb-1">
                        <AlertCircle className="h-4 w-4 text-rose-600" />
                        <span>ملاحظة هامة ثانية (الفروض المحروسة):</span>
                      </p>
                      <p className="leading-relaxed">
                        أي <strong>غياب غير مبرر</strong> للإمتحان المشار إليه يعرض الطالب إلى <strong>علامة صفر</strong> في نقطة إمتحان الأعمال الموجهة.
                      </p>
                    </div>
                  )}

                  {/* Official Signatures & Date */}
                  <div className="flex justify-between items-end pt-8 text-xs font-semibold px-6">
                    <div className="text-start">
                      <p className="font-bold">التاريخ:</p>
                      <p className="font-mono mt-1 text-slate-800">{new Date().toLocaleDateString('ar-DZ') || new Date().toISOString().split('T')[0]}</p>
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-bold text-xs text-slate-950">
                        {printSettings?.department_head_title || 'إمضاء رئيس القسم'}
                      </p>
                      <p className="text-xs text-slate-800 font-semibold">
                        {printSettings?.department_head_name || departmentHead || 'رئيس القسم'}
                      </p>
                      <div className="h-16 w-44 mt-2 border-t-2 border-slate-900 pt-1 text-[10px] text-slate-400">
                        التوقيع والختم الرسمي
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* View 2: Individual Session Certificate */}
            {printModalType === 'certificate' && certificateSession && (
              <div className="space-y-6 py-4">
                <div className="text-center">
                  <div className="inline-block px-8 py-2 rounded-xl border-2 border-slate-900 font-bold text-lg bg-slate-50">
                    شهادة إنجاز {certificateSession.session_type === 'makeup' ? 'حصة تعويضية' : 'حصة إضافية'}
                  </div>
                  <p className="mt-2 text-xs text-slate-600">رقم الوثيقة: EXTRA-{certificateSession.id}/{new Date().getFullYear()}</p>
                </div>

                <div className="p-6 border border-slate-300 rounded-2xl text-xs space-y-4 leading-relaxed bg-slate-50/40">
                  <p>
                    يشهد رئيس قسم التدريس والبرمجة البيداغوجية بأن السيد(ة) الأستاذ(ة): <strong>{certificateSession.professor_name}</strong>
                  </p>
                  <p>
                    قد قام(ت) بإنجاز وبرمجة حصة بيداغوجية وفق التفاصيل الرسمية التالية:
                  </p>
                  <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-xl border border-slate-200">
                    <div><strong>المقياس / المادة:</strong> {certificateSession.course_name}</div>
                    <div><strong>الفوج المستهدف:</strong> {certificateSession.group_name || 'الدفعة كاملة'}</div>
                    <div><strong>تاريخ الحصة:</strong> {certificateSession.session_date} ({SYSTEM_DAYS.find(d => d.id === dateToSystemDay(certificateSession.session_date))?.name})</div>
                    <div><strong>التوقيت المنجز:</strong> {certificateSession.start_time} - {certificateSession.end_time}</div>
                    <div><strong>القاعة المخصصة:</strong> {certificateSession.room_name}</div>
                    <div><strong>طبيعة الحصة:</strong> {certificateSession.session_type === 'makeup' ? 'تعويضية' : 'إضافية'}</div>
                  </div>
                  {certificateSession.description && (
                    <div><strong>ملاحظات الحصة:</strong> {certificateSession.description}</div>
                  )}
                  <p className="text-[11px] text-slate-500 pt-2">
                    سُلمت هذه الشهادة للمعني بناءً على طلبه لاستعمالها في ما يسمح به القانون والتوثيق البيداغوجي.
                  </p>
                </div>

                <div className="flex justify-between items-center pt-8 text-xs font-semibold px-6">
                  <div className="text-center">
                    <p>حرر بالوادي في: {new Date().toLocaleDateString('ar-DZ')}</p>
                    <p className="mt-8 text-slate-400">التأشيرة الإدارية</p>
                  </div>
                  <div className="text-center">
                    <p>رئيس القسم</p>
                    <p className="font-bold">{departmentHead}</p>
                    <p className="mt-6 text-slate-400">التوقيع والختم الرسمي</p>
                  </div>
                </div>
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
                    {announcementFilteredList.map(s => (
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

            {/* View 4: Full Matrix HTML Preview */}
            {printModalType === 'matrix' && (
              <div className="space-y-4">
                <div className="text-center font-bold text-sm">
                  مصفوفة توفر وشغور القاعات الأسبوعية الشاملة
                </div>
                <table className="w-full text-xs border border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="p-2 border text-start">القاعة</th>
                      <th className="p-2 border text-center">السعة</th>
                      {OFFICIAL_TIME_SLOTS.map(t => (
                        <th key={t} className="p-1 border text-center font-mono text-[10px]">{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map(room => (
                      <tr key={room.id} className="border-b">
                        <td className="p-1.5 border font-bold">{room.name}</td>
                        <td className="p-1.5 border text-center font-mono">{room.capacity}</td>
                        {OFFICIAL_TIME_SLOTS.map(slot => {
                          const [sS, sE] = slot.split('-').map(s => s.trim());
                          const isOccupied = regularAssignments.some(a =>
                            a.room_id === room.id &&
                            a.day_of_week === currentSearchSystemDay &&
                            isTimeOverlap(sS, sE, a.start_time, a.end_time)
                          );
                          return (
                            <td
                              key={slot}
                              className={`p-1.5 border text-center font-semibold text-[10px] ${
                                isOccupied ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isOccupied ? 'مشغولة' : 'شاغرة'}
                            </td>
                          );
                        })}
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

export default function AvailableRoomsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3 text-slate-500 font-semibold text-sm">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <span>جاري تحميل كشف الشغور والحصص...</span>
          </div>
        </div>
      }
    >
      <AvailableRoomsContent initialTab="search" />
    </Suspense>
  );
}
