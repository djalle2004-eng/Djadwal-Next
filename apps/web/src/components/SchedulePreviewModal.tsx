'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Users,
  DoorClosed,
  Building2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Download,
  Layers,
  Eye,
  X,
  FileSpreadsheet,
  GraduationCap,
  Check,
  RotateCcw,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Printer,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import {
  Button,
  Badge,
  Dialog,
  DialogTitle,
  DialogDescription
} from '@djadwal/ui';
import * as XLSX from 'xlsx';

export interface PreliminaryTask {
  id?: number | string;
  assignmentId?: number | string;
  courseId?: number | string;
  courseName?: string;
  course_name?: string;
  professorId?: number | string;
  professorName?: string;
  professor_name?: string;
  groupId?: number | string;
  groupName?: string;
  group_name?: string;
  sessionType?: string;
  session_type?: string;
  durationMinutes?: number;
  studentCount?: number;
  assignedSlot?: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  };
  assignedRoomId?: number | string;
  assignedRoomName?: string;
  day_of_week?: number | string;
  start_time?: string;
  end_time?: string;
  room_name?: string;
  item_status?: string;
  note?: string;
}

export interface SchedulePreviewModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  tasks: PreliminaryTask[];
  metrics?: {
    generationDurationMs?: number;
    solverStatus?: string;
    totalTasksCount?: number;
    assignedTasksCount?: number;
    criticalConflictsCount?: number;
    score?: number;
  };
  conflicts?: any[];
  explanationsArabic?: string[];
  isPreliminary?: boolean;
  onApproveAsDraft?: (draftTitle: string) => Promise<void>;
  onBackToConfig?: () => void;
  initialDraftTitle?: string;
  approving?: boolean;
}

// 6 Official University Days
const STANDARD_DAYS = [
  { id: 0, name: 'الأحد', shortName: 'أحد' },
  { id: 1, name: 'الإثنين', shortName: 'إثنين' },
  { id: 2, name: 'الثلاثاء', shortName: 'ثلاثاء' },
  { id: 3, name: 'الأربعاء', shortName: 'أربعاء' },
  { id: 4, name: 'الخميس', shortName: 'خميس' },
  { id: 6, name: 'السبت', shortName: 'سبت' },
];

// 6 Official Time Periods (08:00 - 17:00)
const STANDARD_PERIODS = [
  { id: 1, label: '08:00 - 09:30', start: '08:00', end: '09:30', name: 'الحصة 1' },
  { id: 2, label: '09:30 - 11:00', start: '09:30', end: '11:00', name: 'الحصة 2' },
  { id: 3, label: '11:00 - 12:30', start: '11:00', end: '12:30', name: 'الحصة 3' },
  { id: 4, label: '12:30 - 14:00', start: '12:30', end: '14:00', name: 'الحصة 4' },
  { id: 5, label: '14:00 - 15:30', start: '14:00', end: '15:30', name: 'الحصة 5' },
  { id: 6, label: '15:30 - 17:00', start: '15:30', end: '17:00', name: 'الحصة 6' },
];

function getArabicDayName(day: number | string): string {
  if (typeof day === 'string') {
    const trimmed = day.trim();
    if (['الأحد', 'الاحد'].includes(trimmed)) return 'الأحد';
    if (['الإثنين', 'الاثنين'].includes(trimmed)) return 'الإثنين';
    if (['الثلاثاء'].includes(trimmed)) return 'الثلاثاء';
    if (['الأربعاء', 'الاربعاء'].includes(trimmed)) return 'الأربعاء';
    if (['الخميس'].includes(trimmed)) return 'الخميس';
    if (['الجمعة'].includes(trimmed)) return 'الجمعة';
    if (['السبت'].includes(trimmed)) return 'السبت';
  }
  const d = Number(day);
  switch (d) {
    case 0: return 'الأحد';
    case 1: return 'الإثنين';
    case 2: return 'الثلاثاء';
    case 3: return 'الأربعاء';
    case 4: return 'الخميس';
    case 5: return 'الجمعة';
    case 6: return 'السبت';
    default: return `يوم ${day}`;
  }
}

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function doesSessionMatchSlot(sessionStart: string, slotStart: string, slotEnd: string): boolean {
  if (!sessionStart) return false;
  const sStart = timeToMinutes(sessionStart);
  const slStart = timeToMinutes(slotStart);
  const slEnd = timeToMinutes(slotEnd);

  // Direct match or 15m tolerance for shifted starts (e.g. 09:40 vs 09:30)
  if (Math.abs(sStart - slStart) <= 15) return true;
  if (sessionStart.slice(0, 5) === slotStart.slice(0, 5)) return true;
  return sStart >= slStart && sStart < slEnd;
}

export function SchedulePreviewModal({
  open,
  onClose,
  title = 'معاينة الجداول الأولية المقترحة',
  tasks = [],
  metrics,
  conflicts = [],
  explanationsArabic = [],
  isPreliminary = true,
  onApproveAsDraft,
  onBackToConfig,
  initialDraftTitle = 'مسودة مقترحة من المولّد الآلي',
  approving = false
}: SchedulePreviewModalProps) {
  const [viewTab, setViewTab] = useState<'grid' | 'table' | 'conflicts'>('grid');
  const [gridPerspective, setGridPerspective] = useState<'group' | 'professor' | 'room'>('group');
  const [selectedTarget, setSelectedTarget] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dayFilter, setDayFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [draftTitleInput, setDraftTitleInput] = useState(initialDraftTitle);
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);

  // Normalize all tasks
  const normalizedTasks = useMemo(() => {
    return (tasks || []).map((t, idx) => {
      const day = t.assignedSlot?.dayOfWeek !== undefined
        ? Number(t.assignedSlot.dayOfWeek)
        : (t.day_of_week !== undefined ? Number(t.day_of_week) : -1);

      const start = t.assignedSlot?.startTime || t.start_time || '';
      const end = t.assignedSlot?.endTime || t.end_time || '';

      return {
        id: t.id || t.assignmentId || idx + 1,
        courseName: t.courseName || t.course_name || `مقياس #${t.courseId || ''}`,
        professorName: t.professorName || t.professor_name || `أستاذ #${t.professorId || ''}`,
        groupName: t.groupName || t.group_name || `فوج #${t.groupId || ''}`,
        roomName: t.assignedRoomName || t.room_name || `قاعة #${t.assignedRoomId || ''}`,
        sessionType: t.sessionType || t.session_type || 'lecture',
        dayOfWeek: day,
        dayName: getArabicDayName(day),
        startTime: start,
        endTime: end,
        durationMinutes: t.durationMinutes || 90,
      };
    });
  }, [tasks]);

  // Distinct lists for selectors
  const distinctGroups = useMemo(() => {
    const set = new Set<string>();
    normalizedTasks.forEach(t => { if (t.groupName) set.add(t.groupName); });
    return Array.from(set).sort();
  }, [normalizedTasks]);

  const distinctProfessors = useMemo(() => {
    const set = new Set<string>();
    normalizedTasks.forEach(t => { if (t.professorName) set.add(t.professorName); });
    return Array.from(set).sort();
  }, [normalizedTasks]);

  const distinctRooms = useMemo(() => {
    const set = new Set<string>();
    normalizedTasks.forEach(t => { if (t.roomName) set.add(t.roomName); });
    return Array.from(set).sort();
  }, [normalizedTasks]);

  // Set default target if currently 'all' or empty
  React.useEffect(() => {
    if (gridPerspective === 'group' && distinctGroups.length > 0 && (!selectedTarget || selectedTarget === 'all')) {
      setSelectedTarget(distinctGroups[0]);
    } else if (gridPerspective === 'professor' && distinctProfessors.length > 0 && (!selectedTarget || selectedTarget === 'all')) {
      setSelectedTarget(distinctProfessors[0]);
    } else if (gridPerspective === 'room' && distinctRooms.length > 0 && (!selectedTarget || selectedTarget === 'all')) {
      setSelectedTarget(distinctRooms[0]);
    }
  }, [gridPerspective, distinctGroups, distinctProfessors, distinctRooms]);

  // Days to show (include Saturday if any task is on Saturday)
  const displayDays = useMemo(() => {
    const hasSaturday = normalizedTasks.some(t => t.dayOfWeek === 6 || t.dayName === 'السبت');
    if (hasSaturday) {
      return [...STANDARD_DAYS.slice(0, 5), STANDARD_DAYS[5]];
    }
    return STANDARD_DAYS.slice(0, 5);
  }, [normalizedTasks]);

  // Tasks filtered for the Grid View
  const gridTasks = useMemo(() => {
    if (!selectedTarget || selectedTarget === 'all') return normalizedTasks;
    if (gridPerspective === 'group') {
      return normalizedTasks.filter(t => t.groupName === selectedTarget);
    }
    if (gridPerspective === 'professor') {
      return normalizedTasks.filter(t => t.professorName === selectedTarget);
    }
    if (gridPerspective === 'room') {
      return normalizedTasks.filter(t => t.roomName === selectedTarget);
    }
    return normalizedTasks;
  }, [normalizedTasks, gridPerspective, selectedTarget]);

  // Tasks filtered for the Full Table View
  const tableTasks = useMemo(() => {
    return normalizedTasks.filter(t => {
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matches =
          t.courseName.toLowerCase().includes(query) ||
          t.professorName.toLowerCase().includes(query) ||
          t.groupName.toLowerCase().includes(query) ||
          t.roomName.toLowerCase().includes(query);
        if (!matches) return false;
      }
      if (dayFilter !== 'all') {
        if (t.dayName !== dayFilter) return false;
      }
      if (typeFilter !== 'all') {
        if (typeFilter === 'lecture' && !t.sessionType.toLowerCase().includes('lecture') && !t.sessionType.includes('محاضرة')) return false;
        if (typeFilter === 'td' && !t.sessionType.toLowerCase().includes('td')) return false;
        if (typeFilter === 'tp' && !t.sessionType.toLowerCase().includes('tp')) return false;
      }
      return true;
    });
  }, [normalizedTasks, searchQuery, dayFilter, typeFilter]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const exportRows = normalizedTasks.map((t, idx) => ({
      '#': idx + 1,
      'اليوم': t.dayName,
      'وقت البداية': t.startTime,
      'وقت النهاية': t.endTime,
      'المقياس': t.courseName,
      'نوع الحصة': t.sessionType === 'lecture' ? 'محاضرة' : t.sessionType.toUpperCase(),
      'الفوج': t.groupName,
      'الأستاذ': t.professorName,
      'القاعة': t.roomName,
      'حالة الحصة': 'مقترحة أولياً من المولّد الآلي',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!dir'] = 'rtl';
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'معاينة_الجدول_الأولي');
    const filename = `preliminary-schedule-preview-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Next / Previous target navigation
  const handleCycleTarget = (direction: 'next' | 'prev') => {
    const list = gridPerspective === 'group' ? distinctGroups : (gridPerspective === 'professor' ? distinctProfessors : distinctRooms);
    if (list.length === 0) return;
    const currentIndex = list.indexOf(selectedTarget);
    if (currentIndex === -1) {
      setSelectedTarget(list[0]);
      return;
    }
    if (direction === 'next') {
      const nextIdx = (currentIndex + 1) % list.length;
      setSelectedTarget(list[nextIdx]);
    } else {
      const prevIdx = (currentIndex - 1 + list.length) % list.length;
      setSelectedTarget(list[prevIdx]);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} size="full">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-6 overflow-hidden font-cairo" dir="rtl">
        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-7xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Top Header Bar */}
          <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-white">
                    {title}
                  </DialogTitle>
                  {isPreliminary && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      معاينة أولية مسبقة (قبل الاعتماد والحفظ)
                    </span>
                  )}
                </div>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  استعرض وتفحص الحصص الموزعة آلياً في شبكة التوقيت وتأكد من خلوها من التعارضات قبل اعتماد مسودة الإصدار.
                </DialogDescription>
              </div>
            </div>

            {/* Quick Action Badges / Exit */}
            <div className="flex items-center gap-2 self-end md:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 text-xs text-emerald-700 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <Download className="w-3.5 h-3.5" />
                تصدير Excel (.xlsx)
              </Button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="إغلاق المعاينة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* KPI & Metrics Bar */}
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 overflow-x-auto text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              {metrics?.solverStatus && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">حالة الحل:</span>
                  <Badge className={
                    metrics.solverStatus === 'OPTIMAL'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                  }>
                    {metrics.solverStatus === 'OPTIMAL' ? 'حل مثالي (OPTIMAL)' : 'مستوفٍ للقيود (FEASIBLE)'}
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">الحصص المجدولة:</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {normalizedTasks.length} حصة
                </span>
                {metrics?.totalTasksCount && (
                  <span className="text-slate-400">
                    ({Math.round((normalizedTasks.length / metrics.totalTasksCount) * 100)}% تغطية)
                  </span>
                )}
              </div>

              {metrics?.generationDurationMs !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">زمن الحساب:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {(metrics.generationDurationMs / 1000).toFixed(2)} ثانية
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">التعارضات الحرجة:</span>
                {conflicts.length > 0 ? (
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 text-xs">
                    {conflicts.length} تعارض مكتشف
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    خالٍ من أي تعارض
                  </Badge>
                )}
              </div>

              <div className="hidden lg:flex items-center gap-3 text-slate-500 border-r border-slate-200 dark:border-slate-800 pr-3">
                <span>الأفواج: <b className="text-slate-700 dark:text-slate-300">{distinctGroups.length}</b></span>
                <span>الأساتذة: <b className="text-slate-700 dark:text-slate-300">{distinctProfessors.length}</b></span>
                <span>القاعات: <b className="text-slate-700 dark:text-slate-300">{distinctRooms.length}</b></span>
              </div>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewTab('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewTab === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                شبكة التوقيت الأسبوعية
              </button>

              <button
                onClick={() => setViewTab('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewTab === 'table'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                جدول الحصص الشامل ({normalizedTasks.length})
              </button>

              {conflicts.length > 0 && (
                <button
                  onClick={() => setViewTab('conflicts')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    viewTab === 'conflicts'
                      ? 'bg-white dark:bg-slate-900 text-rose-600 shadow-sm'
                      : 'text-rose-600 hover:text-rose-800'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  التعارضات ({conflicts.length})
                </button>
              )}
            </div>
          </div>

          {/* Interactive Navigation Toolbar for Grid View */}
          {viewTab === 'grid' && (
            <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">منظور العرض:</span>
                <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                  <button
                    onClick={() => {
                      setGridPerspective('group');
                      if (distinctGroups.length > 0) setSelectedTarget(distinctGroups[0]);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                      gridPerspective === 'group'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    حسب الفوج
                  </button>
                  <button
                    onClick={() => {
                      setGridPerspective('professor');
                      if (distinctProfessors.length > 0) setSelectedTarget(distinctProfessors[0]);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                      gridPerspective === 'professor'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    حسب الأستاذ
                  </button>
                  <button
                    onClick={() => {
                      setGridPerspective('room');
                      if (distinctRooms.length > 0) setSelectedTarget(distinctRooms[0]);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                      gridPerspective === 'room'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <DoorClosed className="w-3.5 h-3.5" />
                    حسب القاعة
                  </button>
                </div>
              </div>

              {/* Target Selector with Next / Prev */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">
                  {gridPerspective === 'group' ? 'الفوج الدراسي:' : gridPerspective === 'professor' ? 'الأستاذ:' : 'القاعة:'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCycleTarget('prev')}
                    className="p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-100"
                    title="السابق"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <select
                    value={selectedTarget}
                    onChange={(e) => setSelectedTarget(e.target.value)}
                    className="p-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200 text-xs min-w-[200px]"
                  >
                    {gridPerspective === 'group' && distinctGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                    {gridPerspective === 'professor' && distinctProfessors.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    {gridPerspective === 'room' && distinctRooms.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleCycleTarget('next')}
                    className="p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-100"
                    title="التالي"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-[11px] text-slate-500 mr-2">
                  (يحتوي على {gridTasks.length} حصة أسبوعية)
                </span>
              </div>
            </div>
          )}

          {/* Main Body Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/40 dark:bg-slate-950/20">

            {/* TAB 1: WEEKLY TIMETABLE GRID */}
            {viewTab === 'grid' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-center select-none min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-300">
                        <th className="py-3 px-3 w-28 border-l border-slate-200 dark:border-slate-700">
                          اليوم / الحصة
                        </th>
                        {STANDARD_PERIODS.map(period => (
                          <th key={period.id} className="py-3 px-2 border-l last:border-l-0 border-slate-200 dark:border-slate-700">
                            <div className="font-extrabold">{period.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono font-normal mt-0.5">{period.label}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                      {displayDays.map(day => (
                        <tr key={day.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-4 px-3 font-extrabold text-slate-900 dark:text-white bg-slate-50/80 dark:bg-slate-800/50 border-l border-slate-200 dark:border-slate-700 text-center">
                            {day.name}
                          </td>
                          {STANDARD_PERIODS.map(period => {
                            const matchingTasks = gridTasks.filter(t => {
                              const matchesDay = t.dayName === day.name;
                              const matchesSlot = doesSessionMatchSlot(t.startTime, period.start, period.end);
                              return matchesDay && matchesSlot;
                            });

                            return (
                              <td key={period.id} className="p-1.5 border-l last:border-l-0 border-slate-200 dark:border-slate-800 align-top min-w-[130px] h-24">
                                {matchingTasks.length === 0 ? (
                                  <div className="h-full rounded-lg border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-700 text-[10px]">
                                    —
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {matchingTasks.map(t => {
                                      const isLecture = t.sessionType.toLowerCase().includes('lecture') || t.sessionType.includes('محاضرة');
                                      const isTD = t.sessionType.toLowerCase().includes('td');
                                      const isTP = t.sessionType.toLowerCase().includes('tp');

                                      const colorStyles = isLecture
                                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200'
                                        : isTD
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                                        : 'bg-purple-500/10 border-purple-500/30 text-purple-900 dark:text-purple-200';

                                      return (
                                        <div
                                          key={t.id}
                                          className={`p-2 rounded-lg border text-right transition-all shadow-xs ${colorStyles}`}
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/60 dark:bg-black/30 border border-current/20">
                                              {isLecture ? 'محاضرة' : isTD ? 'TD' : isTP ? 'TP' : t.sessionType}
                                            </span>
                                            <span className="font-mono text-[10px] opacity-75 font-semibold">
                                              {t.startTime}
                                            </span>
                                          </div>

                                          <div className="font-bold text-xs leading-tight mb-1 line-clamp-2">
                                            {t.courseName}
                                          </div>

                                          <div className="text-[10px] space-y-0.5 opacity-85">
                                            {gridPerspective !== 'room' && (
                                              <div className="flex items-center gap-1 font-semibold">
                                                <DoorClosed className="w-3 h-3 shrink-0" />
                                                <span className="truncate">{t.roomName}</span>
                                              </div>
                                            )}
                                            {gridPerspective !== 'professor' && (
                                              <div className="flex items-center gap-1">
                                                <GraduationCap className="w-3 h-3 shrink-0" />
                                                <span className="truncate">{t.professorName}</span>
                                              </div>
                                            )}
                                            {gridPerspective !== 'group' && (
                                              <div className="flex items-center gap-1">
                                                <Users className="w-3 h-3 shrink-0" />
                                                <span className="truncate">{t.groupName}</span>
                                              </div>
                                            )}
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
            )}

            {/* TAB 2: FULL PROPOSED SESSIONS TABLE */}
            {viewTab === 'table' && (
              <div className="space-y-3">
                {/* Search & Filters */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="بحث بالمقياس، الأستاذ، الفوج، أو القاعة..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent border-none focus:outline-hidden text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={dayFilter}
                      onChange={(e) => setDayFilter(e.target.value)}
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    >
                      <option value="all">كل الأيام</option>
                      {displayDays.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>

                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    >
                      <option value="all">كل الأنواع</option>
                      <option value="lecture">محاضرة</option>
                      <option value="td">أعمال موجهة (TD)</option>
                      <option value="tp">أعمال تطبيقية (TP)</option>
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-extrabold">
                        <tr>
                          <th className="py-3 px-3 w-12 text-center">#</th>
                          <th className="py-3 px-4">اليوم والتوقيت</th>
                          <th className="py-3 px-4">المقياس التدريسي</th>
                          <th className="py-3 px-4">نوع الحصة</th>
                          <th className="py-3 px-4">الفوج الدراسي</th>
                          <th className="py-3 px-4">الأستاذ</th>
                          <th className="py-3 px-4">القاعة</th>
                          <th className="py-3 px-4 text-center">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {tableTasks.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-400">
                              لا توجد حصص تطابق معايير البحث والفلترة.
                            </td>
                          </tr>
                        ) : (
                          tableTasks.map((t, idx) => (
                            <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                <div>{t.dayName}</div>
                                <div className="text-[11px] font-mono text-slate-500">{t.startTime} - {t.endTime}</div>
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                {t.courseName}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  t.sessionType === 'lecture'
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200'
                                    : t.sessionType.toLowerCase().includes('td')
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                                    : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200'
                                }`}>
                                  {t.sessionType === 'lecture' ? 'محاضرة' : t.sessionType.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{t.groupName}</td>
                              <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{t.professorName}</td>
                              <td className="py-3 px-4 font-bold text-emerald-700 dark:text-emerald-400">{t.roomName}</td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200/60">
                                  <Sparkles className="w-3 h-3 text-amber-500" />
                                  مقترح أولياً
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CONFLICTS & EXPLANATIONS */}
            {viewTab === 'conflicts' && (
              <div className="space-y-4">
                {conflicts.map((conf: any, idx: number) => (
                  <div key={conf.id || idx} className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-rose-700 dark:text-rose-400 text-sm flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        {conf.titleArabic || conf.type || `تعارض #${idx + 1}`}
                      </span>
                      <Badge variant="outline" className="border-rose-300 text-rose-700">
                        {conf.severity || 'حرج'}
                      </Badge>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">
                      {conf.explanationArabic || 'تعارض في الموارد أو الساعات الزمنية.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Action / Approval Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              {isPreliminary && onBackToConfig && (
                <Button
                  variant="outline"
                  onClick={onBackToConfig}
                  className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  تعديل المعايير وإعادة التوليد
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onClose}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                إغلاق
              </Button>
            </div>

            {/* Approval Controls */}
            {isPreliminary && onApproveAsDraft && (
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {showConfirmApprove ? (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded-xl border border-emerald-300">
                    <input
                      type="text"
                      value={draftTitleInput}
                      onChange={(e) => setDraftTitleInput(e.target.value)}
                      placeholder="عنوان المسودة المقترحة"
                      className="p-1 px-2 text-xs rounded border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 min-w-[200px]"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onApproveAsDraft(draftTitleInput)}
                      disabled={approving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 text-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {approving ? 'جاري الاعتماد...' : 'تأكيد وحفظ المسودة'}
                    </Button>
                    <button
                      onClick={() => setShowConfirmApprove(false)}
                      className="text-slate-400 hover:text-slate-700 text-xs px-1"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => setShowConfirmApprove(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm font-bold text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    الموافقة واعتماد الجدول كمسودة رسمية
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
