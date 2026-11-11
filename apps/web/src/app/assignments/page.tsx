'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  Search,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Download,
  Upload,
  Archive,
  CheckCircle2,
  GraduationCap,
  Award,
  Layers,
  ArrowRightLeft,
  Calendar,
  SlidersHorizontal,
  Clock,
  BookOpen,
  User,
  DoorOpen,
  Users,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Dialog,
  DialogTitle,
  DialogDescription,
} from '@djadwal/ui';
import { api, ApiError } from '@/lib/api';
import DeleteImpactModal from '@/components/DeleteImpactModal';
import UndoToast from '@/components/UndoToast';

export interface Assignment {
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
  created_at?: string;
  updated_at?: string;
}

export interface CatalogReference {
  id: number;
  name: string;
  code?: string;
  specialization?: string;
  year?: string;
  capacity?: number;
}

export const OFFICIAL_TIME_SLOTS = [
  { start: '08:00', end: '09:30', label: 'الحصة 1 (08:00 - 09:30)' },
  { start: '09:30', end: '11:00', label: 'الحصة 2 (09:30 - 11:00)' },
  { start: '11:00', end: '12:30', label: 'الحصة 3 (11:00 - 12:30)' },
  { start: '12:30', end: '14:00', label: 'الحصة 4 (12:30 - 14:00)' },
  { start: '14:00', end: '15:30', label: 'الحصة 5 (14:00 - 15:30)' },
  { start: '15:30', end: '17:00', label: 'الحصة 6 (15:30 - 17:00)' },
];

export const DAYS_OF_WEEK = [
  { id: 0, name: 'السبت' },
  { id: 1, name: 'الأحد' },
  { id: 2, name: 'الاثنين' },
  { id: 3, name: 'الثلاثاء' },
  { id: 4, name: 'الأربعاء' },
  { id: 5, name: 'الخميس' },
];

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Reference data
  const [professors, setProfessors] = useState<CatalogReference[]>([]);
  const [courses, setCourses] = useState<CatalogReference[]>([]);
  const [rooms, setRooms] = useState<CatalogReference[]>([]);
  const [groups, setGroups] = useState<CatalogReference[]>([]);

  // Primary Filters
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedProf, setSelectedProf] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Delete Impact Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Undo Toast State
  const [undoToast, setUndoToast] = useState<{
    show: boolean;
    message: string;
    changeLogId?: number | null;
  }>({ show: false, message: '' });
  const [isUndoing, setIsUndoing] = useState(false);

  // Add / Edit Assignment Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [formData, setFormData] = useState({
    course_id: '',
    professor_id: '',
    room_id: '',
    group_id: '',
    day_of_week: 0,
    start_time: '08:00',
    end_time: '09:30',
    session_type: 'lecture',
    specialization: '',
    isMerged: false,
    mergedGroupIds: [] as number[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  // Bulk Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'success'>('upload');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExecutingImport, setIsExecutingImport] = useState(false);
  const [autoCreateMissing, setAutoCreateMissing] = useState(true);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pedagogical Coverage Audit Modal State
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Load Reference Data
  const loadReferences = async () => {
    try {
      const [pData, cData, rData, gData] = await Promise.all([
        api.get('/professors?limit=1000').catch(() => []),
        api.get('/catalog/courses?limit=1000').catch(() => []),
        api.get('/catalog/rooms?limit=1000').catch(() => []),
        api.get('/catalog/groups?limit=1000').catch(() => []),
      ]);
      if (Array.isArray(pData)) setProfessors(pData);
      if (Array.isArray(cData)) setCourses(cData);
      if (Array.isArray(rData)) setRooms(rData);
      if (Array.isArray(gData)) setGroups(gData);
    } catch (err) {
      console.error('Error loading catalog references:', err);
    }
  };

  // Load Assignments
  const loadAssignments = async () => {
    setLoading(true);
    try {
      const semQuery = semester !== 'all' ? `&semester=${encodeURIComponent(semester)}` : '';
      const data = await api.get(`/assignments?academicYear=${encodeURIComponent(academicYear)}${semQuery}&limit=5000`);
      if (Array.isArray(data)) {
        setAssignments(data);
      }
    } catch (err: any) {
      console.error('Failed to load assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferences();
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [academicYear, semester]);

  // Real-time Conflict Checking for Form
  useEffect(() => {
    if (!showFormModal) return;
    if (!formData.professor_id && !formData.room_id && !formData.group_id) {
      setConflictWarnings([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingConflicts(true);
      try {
        const res = await api.checkAssignmentConflicts({
          day_of_week: Number(formData.day_of_week),
          start_time: formData.start_time,
          end_time: formData.end_time,
          professor_id: formData.professor_id ? Number(formData.professor_id) : undefined,
          room_id: formData.room_id ? Number(formData.room_id) : undefined,
          group_id: formData.group_id ? Number(formData.group_id) : undefined,
          academic_year: academicYear,
          semester: semester !== 'all' ? semester : '',
          exclude_id: editingAssignment ? editingAssignment.id : undefined,
        });

        if (res?.has_conflicts && Array.isArray(res.conflicts)) {
          setConflictWarnings(res.conflicts.map((c: any) => c.message));
        } else {
          setConflictWarnings([]);
        }
      } catch (err) {
        console.error('Conflict check failed:', err);
      } finally {
        setIsCheckingConflicts(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [
    showFormModal,
    formData.professor_id,
    formData.room_id,
    formData.group_id,
    formData.day_of_week,
    formData.start_time,
    formData.end_time,
    academicYear,
    semester,
    editingAssignment,
  ]);

  // Open Delete Impact Modal
  const handleOpenDelete = async (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setDeleteModalOpen(true);
    try {
      const impactRes = await api.getDeleteImpact('assignments', assignment.id);
      setDeleteImpact(impactRes);
    } catch {
      setDeleteImpact(null);
    }
  };

  // Confirm Soft Delete
  const handleConfirmDelete = async () => {
    if (!selectedAssignment) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/assignments/${selectedAssignment.id}`);
      setDeleteModalOpen(false);
      setAssignments((prev) => prev.filter((a) => a.id !== selectedAssignment.id));

      setUndoToast({
        show: true,
        message: `تم حذف الحصة (#${selectedAssignment.id}) بنجاح.`,
        changeLogId: res?.changeLogId || null,
      });
    } catch (err: any) {
      alert(err.message || 'فشل حذف الحصة');
    } finally {
      setIsDeleting(false);
      setSelectedAssignment(null);
    }
  };

  // Undo Delete
  const handleUndo = async (id: number) => {
    setIsUndoing(true);
    try {
      await api.undoChange(id);
      setUndoToast({ show: false, message: '' });
      await loadAssignments();
      alert('✅ تم التراجع عن الحذف بنجاح واستعادة الحصة إلى جدول التوقيت!');
    } catch (err: any) {
      alert('فشل التراجع: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsUndoing(false);
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingAssignment(null);
    setFormData({
      course_id: courses[0]?.id ? String(courses[0].id) : '',
      professor_id: professors[0]?.id ? String(professors[0].id) : '',
      room_id: rooms[0]?.id ? String(rooms[0].id) : '',
      group_id: groups[0]?.id ? String(groups[0].id) : '',
      day_of_week: 0,
      start_time: '08:00',
      end_time: '09:30',
      session_type: 'lecture',
      specialization: '',
      isMerged: false,
      mergedGroupIds: [],
    });
    setConflictError(null);
    setConflictWarnings([]);
    setShowFormModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      course_id: assignment.course_id ? String(assignment.course_id) : '',
      professor_id: assignment.professor_id ? String(assignment.professor_id) : '',
      room_id: assignment.room_id ? String(assignment.room_id) : '',
      group_id: assignment.group_id ? String(assignment.group_id) : '',
      day_of_week: Number(assignment.day_of_week ?? 0),
      start_time: assignment.start_time || '08:00',
      end_time: assignment.end_time || '09:30',
      session_type: assignment.session_type || 'lecture',
      specialization: assignment.specialization || '',
      isMerged: false,
      mergedGroupIds: [],
    });
    setConflictError(null);
    setConflictWarnings([]);
    setShowFormModal(true);
  };

  // Save Assignment (Add / Edit with OCC version and Idempotency-Key)
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.course_id || !formData.professor_id || !formData.group_id || !formData.room_id) {
      alert('يرجى تحديد الأستاذ، المقياس، الفوج، والقاعة.');
      return;
    }

    setIsSubmitting(true);
    setConflictError(null);

    const idempotencyKey = `assign-${editingAssignment ? 'edit-' + editingAssignment.id : 'create'}-${Date.now()}`;

    try {
      if (editingAssignment) {
        // Optimistic Locking Update
        await api.put(
          `/assignments/${editingAssignment.id}`,
          {
            course_id: Number(formData.course_id),
            professor_id: Number(formData.professor_id),
            room_id: Number(formData.room_id),
            group_id: Number(formData.group_id),
            day_of_week: Number(formData.day_of_week),
            start_time: formData.start_time,
            end_time: formData.end_time,
            session_type: formData.session_type,
            specialization: formData.specialization || undefined,
            academic_year: academicYear,
            semester: semester !== 'all' ? semester : '1',
            version: editingAssignment.version,
          },
          {
            headers: {
              'Idempotency-Key': idempotencyKey,
            },
          }
        );
      } else {
        // Create - with support for merged groups if enabled
        const targetGroups = formData.isMerged && formData.mergedGroupIds.length > 0
          ? [Number(formData.group_id), ...formData.mergedGroupIds.filter((id) => id !== Number(formData.group_id))]
          : [Number(formData.group_id)];

        for (const gId of targetGroups) {
          await api.post(
            '/assignments',
            {
              course_id: Number(formData.course_id),
              professor_id: Number(formData.professor_id),
              room_id: Number(formData.room_id),
              group_id: gId,
              day_of_week: Number(formData.day_of_week),
              start_time: formData.start_time,
              end_time: formData.end_time,
              session_type: formData.session_type,
              specialization: formData.specialization || undefined,
              academic_year: academicYear,
              semester: semester !== 'all' ? semester : '1',
            },
            {
              headers: {
                'Idempotency-Key': `${idempotencyKey}-grp-${gId}`,
              },
            }
          );
        }
      }

      setShowFormModal(false);
      await loadAssignments();
    } catch (err: any) {
      if (err.statusCode === 409 || err.status === 409 || err.code === 'CONFLICT' || err.name === 'OptimisticLockError') {
        setConflictError(
          '⚠️ تنبيه تعارض التعديل المتزامن (409 Conflict): تم تحديث هذه الحصة مسبقاً من قِبل مستخدم آخر. يرجى إغلاق النافذة وتحديث الصفحة لتفادي الكتابة فوق التعديلات الأحدث.'
        );
      } else {
        alert(err.message || 'حدث خطأ أثناء حفظ التكليف');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // CSV Parsing & Import Wizard Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      // Robust CSV/TSV Parser
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) {
        alert('الملف فارغ أو لا يحتوي على صفوف بيانات.');
        return;
      }

      // Detect separator (comma, semicolon, tab)
      const firstLine = lines[0];
      let sep = ',';
      if (firstLine.includes(';') && firstLine.split(';').length >= 3) sep = ';';
      else if (firstLine.includes('\t') && firstLine.split('\t').length >= 3) sep = '\t';

      const splitLine = (l: string) => {
        const parts: string[] = [];
        let curr = '';
        let inQuotes = false;
        for (let i = 0; i < l.length; i++) {
          const char = l[i];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === sep && !inQuotes) {
            parts.push(curr.trim());
            curr = '';
          } else {
            curr += char;
          }
        }
        parts.push(curr.trim());
        return parts.map((p) => p.replace(/^"|"$/g, '').trim());
      };

      const rawHeaders = splitLine(lines[0]).map((h) => h.toLowerCase().trim());

      const getIdx = (keys: string[]) => rawHeaders.findIndex((h) => keys.some((k) => h.includes(k)));

      const profIdx = getIdx(['أستاذ', 'استاذ', 'prof', 'enseignant']);
      const courseIdx = getIdx(['مقياس', 'مادة', 'course', 'module']);
      const groupIdx = getIdx(['فوج', 'مجموعة', 'group', 'groupe']);
      const roomIdx = getIdx(['قاعة', 'مدرج', 'room', 'salle']);
      const dayIdx = getIdx(['يوم', 'day', 'jour']);
      const startIdx = getIdx(['بداية', 'من', 'start', 'debut']);
      const endIdx = getIdx(['نهاية', 'إلى', 'end', 'fin']);
      const typeIdx = getIdx(['نوع', 'type']);

      const parsed: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = splitLine(lines[i]);
        if (cols.length < 3) continue;

        // Parse Day
        let dayVal = 0;
        const rawDay = (dayIdx !== -1 ? cols[dayIdx] : '').toLowerCase();
        if (rawDay.includes('أحد') || rawDay.includes('dim')) dayVal = 1;
        else if (rawDay.includes('اثنين') || rawDay.includes('lun')) dayVal = 2;
        else if (rawDay.includes('ثلاث') || rawDay.includes('mar')) dayVal = 3;
        else if (rawDay.includes('أربع') || rawDay.includes('mer')) dayVal = 4;
        else if (rawDay.includes('خميس') || rawDay.includes('jeu')) dayVal = 5;
        else if (rawDay.includes('جمع') || rawDay.includes('ven')) dayVal = 6;
        else dayVal = parseInt(rawDay, 10) || 0;

        // Parse Times
        let startTime = startIdx !== -1 ? cols[startIdx] : '08:00';
        let endTime = endIdx !== -1 ? cols[endIdx] : '09:30';
        if (startTime.length === 4 && startTime.includes(':')) startTime = '0' + startTime;
        if (endTime.length === 4 && endTime.includes(':')) endTime = '0' + endTime;

        // Parse Session Type
        let sessionType = 'lecture';
        const rawType = (typeIdx !== -1 ? cols[typeIdx] : '').toLowerCase();
        if (rawType.includes('td') || rawType.includes('موجه')) sessionType = 'td';
        else if (rawType.includes('tp') || rawType.includes('تطبيق')) sessionType = 'tp';

        parsed.push({
          professor_name: profIdx !== -1 ? cols[profIdx] : '',
          course_name: courseIdx !== -1 ? cols[courseIdx] : '',
          group_name: groupIdx !== -1 ? cols[groupIdx] : '',
          room_name: roomIdx !== -1 ? cols[roomIdx] : '',
          day_of_week: dayVal,
          start_time: startTime,
          end_time: endTime,
          session_type: sessionType,
        });
      }

      setParsedItems(parsed);
      setImportStep('preview');
      triggerDryRunPreview(parsed);
    };

    reader.readAsText(file, 'utf-8');
  };

  // Trigger Dry-Run Preview
  const triggerDryRunPreview = async (itemsToPreview: any[]) => {
    setIsPreviewing(true);
    try {
      const res = await api.previewBulkImport({
        academic_year: academicYear,
        semester: semester !== 'all' ? semester : '1',
        items: itemsToPreview,
      });
      setPreviewResult(res);
    } catch (err: any) {
      alert('فشل التحقق المسبق من الملف: ' + (err.message || 'خطأ في معالجة البيانات'));
    } finally {
      setIsPreviewing(false);
    }
  };

  // Execute Atomic Import via UnitOfWork
  const handleExecuteAtomicImport = async () => {
    if (!parsedItems || parsedItems.length === 0) return;
    setIsExecutingImport(true);
    try {
      const res = await api.bulkImportAssignments({
        academic_year: academicYear,
        semester: semester !== 'all' ? semester : '1',
        auto_create_missing: autoCreateMissing,
        items: parsedItems,
      });

      setImportSuccessMsg(
        `✅ تم الاستيراد الذري بنجاح!\n` +
          `تم إدراج ${res.count} حصة دراسية دفعة واحدة دون أي تعارضات.\n` +
          (res.createdEntities
            ? `(أنشئت تلقائياً: ${res.createdEntities.professors} أساتذة، ${res.createdEntities.courses} مقاييس، ${res.createdEntities.rooms} قاعات، ${res.createdEntities.groups} أفواج).`
            : '')
      );
      setImportStep('success');
      await loadAssignments();
      await loadReferences();
    } catch (err: any) {
      alert('❌ فشل الاستيراد الذري وتراجع النظام بالكامل (Atomic Rollback):\n' + (err.message || 'خطأ غير متوقع'));
    } finally {
      setIsExecutingImport(false);
    }
  };

  // Download Sample Import Template
  const handleDownloadSampleTemplate = () => {
    const headers = ['الأستاذ', 'المقياس', 'الفوج', 'القاعة', 'اليوم', 'البداية', 'النهاية', 'نوع الحصة'];
    const sampleRows = [
      ['د. أحمد بن علي', 'خوارزميات وهياكل البيانات', 'فوج 1 (G1)', 'قاعة 12', 'الأحد', '08:00', '09:30', 'محاضرة'],
      ['د. فاطمة الزهراء', 'قواعد البيانات المتقدمة', 'فوج 2 (G2)', 'مخبر 3', 'الاثنين', '09:30', '11:00', 'TP'],
      ['أ. كمال محمود', 'أنظمة التشغيل', 'فوج 1 (G1)', 'مدرج أ', 'الثلاثاء', '11:00', '12:30', 'TD'],
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `djadwal-assignments-sample-template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Filtered Assignments to CSV
  const handleExportCSV = () => {
    const headers = ['#', 'المقياس', 'الأستاذ', 'الفوج / الدفعة', 'القاعة', 'اليوم', 'التوقيت', 'النوع', 'السداسي', 'السنة الجامعية'];
    const rows = filteredAssignments.map((a) => {
      const dayObj = DAYS_OF_WEEK.find((d) => d.id === Number(a.day_of_week));
      return [
        a.id,
        `"${a.course_name || ''}"`,
        `"${a.professor_name || ''}"`,
        `"${a.group_name || ''}"`,
        `"${a.room_name || ''}"`,
        `"${dayObj ? dayObj.name : a.day_of_week}"`,
        `"${a.start_time} - ${a.end_time}"`,
        `"${a.session_type === 'lecture' ? 'محاضرة' : a.session_type?.toUpperCase()}"`,
        `"${a.semester || ''}"`,
        `"${a.academic_year || ''}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `assignments-${academicYear}-${semester}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Open Coverage Audit Modal
  const handleOpenCoverageAudit = async () => {
    setShowAuditModal(true);
    setIsLoadingAudit(true);
    try {
      const data = await api.getCoverageAudit(academicYear, semester !== 'all' ? semester : '');
      setAuditData(data);
    } catch (err: any) {
      console.error('Failed to load coverage audit:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Filtered and Paginated Assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchesSearch =
        (a.course_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.professor_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.group_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.room_name || '').toLowerCase().includes(search.toLowerCase());

      const matchesDay = selectedDay === 'all' || String(a.day_of_week) === selectedDay;
      const matchesType = selectedType === 'all' || a.session_type === selectedType;
      const matchesProf = selectedProf === 'all' || String(a.professor_id) === selectedProf;
      const matchesRoom = selectedRoom === 'all' || String(a.room_id) === selectedRoom;
      const matchesGroup = selectedGroup === 'all' || String(a.group_id) === selectedGroup;

      return matchesSearch && matchesDay && matchesType && matchesProf && matchesRoom && matchesGroup;
    });
  }, [assignments, search, selectedDay, selectedType, selectedProf, selectedRoom, selectedGroup]);

  const totalPages = Math.ceil(filteredAssignments.length / pageSize) || 1;
  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssignments.slice(start, start + pageSize);
  }, [filteredAssignments, currentPage, pageSize]);

  // Key KPI stats
  const lectureCount = useMemo(() => assignments.filter((a) => a.session_type === 'lecture').length, [assignments]);
  const tdTpCount = useMemo(() => assignments.filter((a) => a.session_type === 'td' || a.session_type === 'tp').length, [assignments]);
  const missingRoomCount = useMemo(() => assignments.filter((a) => !a.room_id || a.room_id === 0 || !a.room_name).length, [assignments]);

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                إدارة الحصص والتكليفات (Assignments)
                <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200">
                  V1 Production — 100% Parity
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                توزيع التكليفات الأسبوعية، الاستيراد الذري الدفعي، كشف التعارضات اللحظي ومدقق الاكتمال البيداغوجي
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Legacy Switcher */}
          <Link
            href="/legacy/course-assignments"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-xl transition-colors border border-border"
            title="الانتقال إلى الواجهة الكلاسيكية القديمة"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>الواجهة الكلاسيكية (Legacy)</span>
          </Link>

          <Button
            onClick={handleOpenCoverageAudit}
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl border-amber-300 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>مدقق الاكتمال البيداغوجي</span>
          </Button>

          <Button
            onClick={() => {
              setImportStep('upload');
              setImportFile(null);
              setParsedItems([]);
              setShowImportModal(true);
            }}
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl border-border hover:bg-muted"
          >
            <Upload className="h-4 w-4" />
            <span>استيراد ذري (Import)</span>
          </Button>

          <Button
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl border-border hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            <span>تصدير CSV</span>
          </Button>

          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة تكليف جديد</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">إجمالي الحصص والتكليفات</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {assignments.length.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">حصة</span>
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">للعام الجامعي {academicYear}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <CalendarClock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">حصص المحاضرات (Cours)</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{lectureCount}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">محاضرات مدرجات ودفعات</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <BookOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">أعمال موجهة وتطبيقية (TD / TP)</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{tdTpCount}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">حصص تطبيقية تخصصية</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">حصص بدون قاعة مخصصة</p>
              <h3 className={`text-2xl font-bold mt-1 ${missingRoomCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
                {missingRoomCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {missingRoomCount > 0 ? 'تتطلب تعيين قاعة تدريس' : 'كافة الحصص مخصصة بقاعات'}
              </p>
            </div>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${missingRoomCount > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
              <DoorOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Filter & Search Toolbar */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="بحث بالمقياس، الأستاذ، الفوج، أو القاعة..."
              className="w-full pl-4 pr-10 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Academic Year Selector */}
            <select
              value={academicYear}
              onChange={(e) => {
                setAcademicYear(e.target.value);
                setCurrentPage(1);
              }}
              className="py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="2026-2027">السنة الجامعية 2026-2027 (النشطة)</option>
              <option value="2025-2026">السنة الجامعية 2025-2026</option>
            </select>

            {/* Semester Selector */}
            <select
              value={semester}
              onChange={(e) => {
                setSemester(e.target.value);
                setCurrentPage(1);
              }}
              className="py-2 px-3 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">كل السداسيات</option>
              <option value="السداسي الأول">السداسي الأول (S1)</option>
              <option value="السداسي الثاني">السداسي الثاني (S2)</option>
            </select>
          </div>
        </div>

        {/* Secondary Detailed Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-2 border-t border-border/60">
          <select
            value={selectedDay}
            onChange={(e) => {
              setSelectedDay(e.target.value);
              setCurrentPage(1);
            }}
            className="py-1.5 px-2.5 border border-input rounded-lg text-xs bg-background text-foreground focus:outline-none"
          >
            <option value="all">كل الأيام</option>
            {DAYS_OF_WEEK.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
            className="py-1.5 px-2.5 border border-input rounded-lg text-xs bg-background text-foreground focus:outline-none"
          >
            <option value="all">كل أنواع الحصص</option>
            <option value="lecture">محاضرات (Cours)</option>
            <option value="td">أعمال موجهة (TD)</option>
            <option value="tp">أعمال تطبيقية (TP)</option>
          </select>

          <select
            value={selectedProf}
            onChange={(e) => {
              setSelectedProf(e.target.value);
              setCurrentPage(1);
            }}
            className="py-1.5 px-2.5 border border-input rounded-lg text-xs bg-background text-foreground focus:outline-none truncate"
          >
            <option value="all">كل الأساتذة</option>
            {professors.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={selectedGroup}
            onChange={(e) => {
              setSelectedGroup(e.target.value);
              setCurrentPage(1);
            }}
            className="py-1.5 px-2.5 border border-input rounded-lg text-xs bg-background text-foreground focus:outline-none truncate"
          >
            <option value="all">كل الأفواج</option>
            {groups.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.name} ({g.specialization || g.year || 'عام'})
              </option>
            ))}
          </select>

          <select
            value={selectedRoom}
            onChange={(e) => {
              setSelectedRoom(e.target.value);
              setCurrentPage(1);
            }}
            className="py-1.5 px-2.5 border border-input rounded-lg text-xs bg-background text-foreground focus:outline-none truncate"
          >
            <option value="all">كل القاعات</option>
            {rooms.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Master Assignments Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
          <div>
            إجمالي النتائج المطابقة: <strong className="text-purple-600 dark:text-purple-400 font-bold">{filteredAssignments.length}</strong> حصة
          </div>
          <div>
            الصفحة {currentPage} من {totalPages}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50 text-muted-foreground text-xs border-b border-border">
              <tr>
                <th className="py-3.5 px-4 font-semibold">#</th>
                <th className="py-3.5 px-4 font-semibold">المقياس / المادة</th>
                <th className="py-3.5 px-4 font-semibold">الأستاذ</th>
                <th className="py-3.5 px-4 font-semibold">الفوج / الدفعة</th>
                <th className="py-3.5 px-4 font-semibold">النوع</th>
                <th className="py-3.5 px-4 font-semibold">اليوم والتوقيت</th>
                <th className="py-3.5 px-4 font-semibold">القاعة</th>
                <th className="py-3.5 px-4 font-semibold">الإصدار (OCC)</th>
                <th className="py-3.5 px-4 font-semibold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-purple-500" />
                    جارٍ جلب التكليفات من قاعدة البيانات الآمنة...
                  </td>
                </tr>
              ) : paginatedAssignments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground">
                    <CalendarClock className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                    لا توجد حصص مطابقة لمعايير البحث والتصفية.
                  </td>
                </tr>
              ) : (
                paginatedAssignments.map((assignment) => {
                  const dayObj = DAYS_OF_WEEK.find((d) => d.id === Number(assignment.day_of_week));
                  const isLecture = assignment.session_type === 'lecture';
                  const isTP = assignment.session_type === 'tp';

                  return (
                    <tr key={assignment.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{assignment.id}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">{assignment.course_name || 'غير محدد'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-foreground font-medium">{assignment.professor_name || '—'}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-muted text-foreground font-medium">
                          {assignment.group_name || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isLecture
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                              : isTP
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300'
                              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          {isLecture ? 'محاضرة' : isTP ? 'TP' : 'TD'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <span className="font-semibold text-purple-700 dark:text-purple-300">
                            {dayObj ? dayObj.name : assignment.day_of_week}
                          </span>
                          <span className="text-muted-foreground">
                            ({assignment.start_time} - {assignment.end_time})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {assignment.room_name ? (
                          <span className="inline-flex items-center gap-1 text-xs text-foreground font-medium">
                            <DoorOpen className="h-3.5 w-3.5 text-muted-foreground" />
                            {assignment.room_name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            بدون قاعة
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                        v{assignment.version || 1}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(assignment)}
                            className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 dark:text-purple-400 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                            title="تعديل بيانات التكليف"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>تعديل</span>
                          </button>

                          <button
                            onClick={() => handleOpenDelete(assignment)}
                            className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                            title="حذف مع تقييم الأثر المتبادل"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="gap-1 rounded-xl"
            >
              <ChevronRight className="h-4 w-4" />
              <span>الصفحة السابقة</span>
            </Button>

            <span className="font-semibold text-foreground">
              صفحة {currentPage} من {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="gap-1 rounded-xl"
            >
              <span>الصفحة التالية</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Delete Impact Modal */}
      <DeleteImpactModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="تأكيد حذف الحصة والتكليف مع تقييم الأثر"
        entityName={`حصة #${selectedAssignment?.id} (${selectedAssignment?.course_name || ''})`}
        impact={deleteImpact}
        isLoading={isDeleting}
      />

      {/* Undo Toast */}
      <UndoToast
        show={undoToast.show}
        message={undoToast.message}
        changeLogId={undoToast.changeLogId}
        onUndo={handleUndo}
        onClose={() => setUndoToast({ show: false, message: '' })}
        isLoading={isUndoing}
      />

      {/* Add / Edit Assignment Modal */}
      <Dialog open={showFormModal} onClose={() => setShowFormModal(false)} size="md">
        <div className="p-6 space-y-4 max-w-lg w-full bg-card rounded-2xl text-right max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
              <CalendarClock className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold text-foreground">
                {editingAssignment ? 'تعديل بيانات الحصة والتكليف' : 'إضافة تكليف دراسي جديد'}
              </DialogTitle>
            </div>
            {editingAssignment && (
              <Badge variant="outline" className="text-xs font-mono">
                v{editingAssignment.version || 1}
              </Badge>
            )}
          </div>

          <DialogDescription className="text-xs text-muted-foreground">
            حدد الأستاذ، المقياس، الفوج، القاعة وتوقيت الحصة الرسمي مع الفحص اللحظي للتعارضات.
          </DialogDescription>

          {/* Conflict Warnings Banner */}
          {conflictWarnings.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                <span>تم اكتشاف تعارض في الجدولة:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {conflictWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {conflictError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{conflictError}</p>
            </div>
          )}

          <form onSubmit={handleSaveAssignment} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                المقياس / المادة <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.course_id}
                onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">اختر المقياس...</option>
                {courses.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                الأستاذ المكلف <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.professor_id}
                onChange={(e) => setFormData({ ...formData, professor_id: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">اختر الأستاذ...</option>
                {professors.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  الفوج الأساسي <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.group_id}
                  onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">اختر الفوج...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={String(g.id)}>
                      {g.name} ({g.specialization || g.year || 'عام'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  القاعة / المدرج <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.room_id}
                  onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">اختر القاعة...</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name} ({r.capacity || 0} مقعد)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Merged Sessions Toggle (For Lectures) */}
            {!editingAssignment && (
              <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={formData.isMerged}
                    onChange={(e) => setFormData({ ...formData, isMerged: e.target.checked })}
                    className="rounded border-input text-purple-600 focus:ring-purple-500"
                  />
                  <span>حصة مدمجة (محاضرة مشتركة لعدة أفواج)</span>
                </label>

                {formData.isMerged && (
                  <div className="pt-2">
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      اختر الأفواج الإضافية المدمجة مع الفوج الأساسي:
                    </label>
                    <div className="max-h-28 overflow-y-auto space-y-1 p-2 bg-background rounded-lg border border-input text-xs">
                      {groups
                        .filter((g) => String(g.id) !== formData.group_id)
                        .map((g) => (
                          <label key={g.id} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.mergedGroupIds.includes(g.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, mergedGroupIds: [...formData.mergedGroupIds, g.id] });
                                } else {
                                  setFormData({
                                    ...formData,
                                    mergedGroupIds: formData.mergedGroupIds.filter((id) => id !== g.id),
                                  });
                                }
                              }}
                              className="rounded border-input text-purple-600"
                            />
                            <span>{g.name} ({g.specialization || g.year || 'عام'})</span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  اليوم
                </label>
                <select
                  value={formData.day_of_week}
                  onChange={(e) => setFormData({ ...formData, day_of_week: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  نوع الحصة
                </label>
                <select
                  value={formData.session_type}
                  onChange={(e) => setFormData({ ...formData, session_type: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="lecture">محاضرة (Cours)</option>
                  <option value="td">أعمال موجهة (TD)</option>
                  <option value="tp">أعمال تطبيقية (TP)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                الفترة الزمنية الرسمية
              </label>
              <select
                value={`${formData.start_time}-${formData.end_time}`}
                onChange={(e) => {
                  const [s, end] = e.target.value.split('-');
                  setFormData({ ...formData, start_time: s, end_time: end });
                }}
                className="w-full px-3 py-2 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {OFFICIAL_TIME_SLOTS.map((slot) => (
                  <option key={`${slot.start}-${slot.end}`} value={`${slot.start}-${slot.end}`}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFormModal(false)}
                className="rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>جارٍ الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>{editingAssignment ? 'تحديث التكليف' : 'حفظ التكليف'}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Bulk Import Wizard Modal */}
      <Dialog open={showImportModal} onClose={() => setShowImportModal(false)} size="lg">
        <div className="p-6 space-y-4 max-w-2xl w-full bg-card rounded-2xl text-right max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
              <FileSpreadsheet className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold text-foreground">
                معالج الاستيراد الذري الشامل (Bulk Import Engine)
              </DialogTitle>
            </div>
            <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
              UnitOfWork Atomic Commit
            </Badge>
          </div>

          <DialogDescription className="text-xs text-muted-foreground">
            استورد قوائم التكليفات والحصص من ملفات CSV/Excel مع مرحلة المعاينة والتحقق المسبق (Dry-Run) والتنفيذ الذري الخالي من الأخطاء.
          </DialogDescription>

          {importStep === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center bg-muted/10 hover:bg-muted/20 transition-colors">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-purple-500 mb-3" />
                <h4 className="font-bold text-foreground text-sm">حدد ملف التكليفات (CSV أو جدول بيانات)</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  يدعم التنسيقات المفصولة بفواصل أو فواصل منقوطة، مع التعرف التلقائي على أسماء الأعمدة العربية والفرنسية.
                </p>

                <div className="mt-4 flex items-center justify-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Upload className="h-4 w-4" />
                    <span>اختيار الملف والبدء</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadSampleTemplate}
                    className="gap-1.5 rounded-xl border-border"
                  >
                    <Download className="h-4 w-4" />
                    <span>تحميل نموذج CSV جاهز</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {importStep === 'preview' && (
            <div className="space-y-4">
              {isPreviewing ? (
                <div className="py-12 text-center text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-purple-500" />
                  جارٍ الفحص الذري ومعاينة البيانات وكشف التعارضات مسبقاً (Dry-Run)...
                </div>
              ) : previewResult ? (
                <div className="space-y-4">
                  {/* Preview Metrics */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-3 bg-muted/30 rounded-xl text-center border border-border">
                      <div className="text-[11px] text-muted-foreground">إجمالي الصفوف</div>
                      <div className="text-lg font-bold text-foreground">{previewResult.total}</div>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-center border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      <div className="text-[11px]">صفوف صالحة</div>
                      <div className="text-lg font-bold">{previewResult.validCount}</div>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-xl text-center border border-amber-500/20 text-amber-700 dark:text-amber-300">
                      <div className="text-[11px]">تعارضات توقيت</div>
                      <div className="text-lg font-bold">{previewResult.conflictCount}</div>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-xl text-center border border-blue-500/20 text-blue-700 dark:text-blue-300">
                      <div className="text-[11px]">كيانات مفقودة</div>
                      <div className="text-lg font-bold">
                        {previewResult.missingEntities?.professors?.length +
                          previewResult.missingEntities?.courses?.length +
                          previewResult.missingEntities?.rooms?.length +
                          previewResult.missingEntities?.groups?.length}
                      </div>
                    </div>
                  </div>

                  {/* Auto-create missing entities toggle */}
                  <div className="p-3 rounded-xl border border-border bg-muted/20">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                      <input
                        type="checkbox"
                        checked={autoCreateMissing}
                        onChange={(e) => setAutoCreateMissing(e.target.checked)}
                        className="rounded border-input text-purple-600 focus:ring-purple-500"
                      />
                      <span>إنشاء المقاييس والأساتذة والقاعات والأفواج المفقودة تلقائياً في قاعدة البيانات</span>
                    </label>
                  </div>

                  {/* Preview Rows Table */}
                  <div className="border border-border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-muted/50 text-muted-foreground border-b border-border sticky top-0">
                        <tr>
                          <th className="py-2 px-2.5">#</th>
                          <th className="py-2 px-2.5">المقياس</th>
                          <th className="py-2 px-2.5">الأستاذ</th>
                          <th className="py-2 px-2.5">الفوج</th>
                          <th className="py-2 px-2.5">القاعة</th>
                          <th className="py-2 px-2.5">اليوم / التوقيت</th>
                          <th className="py-2 px-2.5">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {previewResult.rows?.slice(0, 100).map((r: any) => (
                          <tr key={r.rowIndex} className="hover:bg-muted/20">
                            <td className="py-2 px-2.5 font-mono text-muted-foreground">{r.rowIndex}</td>
                            <td className="py-2 px-2.5 font-medium">{r.course_name || '—'}</td>
                            <td className="py-2 px-2.5">{r.professor_name || '—'}</td>
                            <td className="py-2 px-2.5">{r.group_name || '—'}</td>
                            <td className="py-2 px-2.5">{r.room_name || '—'}</td>
                            <td className="py-2 px-2.5 font-mono">
                              {r.start_time}-{r.end_time}
                            </td>
                            <td className="py-2 px-2.5">
                              {r.status === 'valid' ? (
                                <Badge variant="neutral" className="text-[10px] bg-emerald-50 text-emerald-700">
                                  سليم
                                </Badge>
                              ) : r.status === 'warning' ? (
                                <Badge variant="warning" className="text-[10px]">
                                  جديد
                                </Badge>
                              ) : (
                                <Badge variant="danger" className="text-[10px]" title={r.errors?.join('\n')}>
                                  تعارض
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setImportStep('upload')}
                      className="rounded-xl"
                    >
                      إلغاء والعودة
                    </Button>

                    <Button
                      type="button"
                      disabled={isExecutingImport || previewResult.conflictCount > 0}
                      onClick={handleExecuteAtomicImport}
                      className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
                    >
                      {isExecutingImport ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>جارٍ التنفيذ الذري (UnitOfWork)...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>تأكيد الاستيراد الذري الشامل</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {importStep === 'success' && (
            <div className="py-8 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="text-base font-bold text-foreground">اكتمل الاستيراد الذري بنجاح تام</h4>
              <p className="text-xs text-muted-foreground whitespace-pre-line max-w-md mx-auto">
                {importSuccessMsg}
              </p>
              <Button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
              >
                إغلاق والعودة إلى الجدول
              </Button>
            </div>
          )}
        </div>
      </Dialog>

      {/* Pedagogical Coverage Audit Modal */}
      <Dialog open={showAuditModal} onClose={() => setShowAuditModal(false)} size="lg">
        <div className="p-6 space-y-4 max-w-2xl w-full bg-card rounded-2xl text-right max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold text-foreground">
                مدقق الاكتمال البيداغوجي (Pedagogical Coverage Audit)
              </DialogTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {academicYear}
            </Badge>
          </div>

          <DialogDescription className="text-xs text-muted-foreground">
            فحص شامل لرصد المقاييس غير المكلّف لها أستاذ، الحصص التي تنقصها قاعات تدريس، ونواقص البرامج البيداغوجية للأفواج.
          </DialogDescription>

          {isLoadingAudit ? (
            <div className="py-12 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-500" />
              جارٍ تدقيق الاكتمال البيداغوجي...
            </div>
          ) : auditData ? (
            <div className="space-y-4">
              {/* Metric Highlights */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                  <div className="text-[11px] text-rose-700 dark:text-rose-300">مقاييس بدون أستاذ</div>
                  <div className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                    {auditData.unassignedCourses?.length || 0}
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                  <div className="text-[11px] text-amber-700 dark:text-amber-300">حصص بدون قاعة</div>
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                    {auditData.missingRoomSessions?.length || 0}
                  </div>
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
                  <div className="text-[11px] text-blue-700 dark:text-blue-300">أفواج مفحوصة</div>
                  <div className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                    {auditData.groupCoverage?.length || 0}
                  </div>
                </div>
              </div>

              {/* Unassigned Courses Table */}
              <div className="border border-border rounded-xl p-3 bg-muted/10 space-y-2">
                <h4 className="font-bold text-xs text-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-rose-500" />
                  <span>المقاييس غير المكلّف لها أستاذ ({auditData.unassignedCourses?.length || 0}):</span>
                </h4>
                {auditData.unassignedCourses?.length === 0 ? (
                  <p className="text-xs text-emerald-600 font-semibold">✅ كافة المقاييس مكلف لها أساتذة بنجاح.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {auditData.unassignedCourses?.map((c: any) => (
                      <div key={c.id} className="p-2 bg-background rounded-lg border border-border text-xs flex items-center justify-between">
                        <span className="font-medium text-foreground">{c.name} ({c.code || 'بدون رمز'})</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowAuditModal(false);
                            handleOpenAdd();
                            setFormData((prev) => ({ ...prev, course_id: String(c.id) }));
                          }}
                          className="h-7 text-xs rounded-lg text-purple-600 border-purple-200"
                        >
                          تكليف أستاذ
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Missing Room Sessions Table */}
              <div className="border border-border rounded-xl p-3 bg-muted/10 space-y-2">
                <h4 className="font-bold text-xs text-foreground flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-amber-500" />
                  <span>الحصص التي تنقصها قاعة تدريس ({auditData.missingRoomSessions?.length || 0}):</span>
                </h4>
                {auditData.missingRoomSessions?.length === 0 ? (
                  <p className="text-xs text-emerald-600 font-semibold">✅ جميع الحصص مخصصة بقاعات تدريس معتمدة.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {auditData.missingRoomSessions?.map((s: any) => (
                      <div key={s.id} className="p-2 bg-background rounded-lg border border-border text-xs flex items-center justify-between">
                        <div>
                          <span className="font-medium text-foreground">{s.course_name}</span>
                          <span className="text-muted-foreground mr-2">({s.professor_name || 'أستاذ غير محدد'}) مع {s.group_name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground">{s.start_time}-{s.end_time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAuditModal(false)}
                  className="rounded-xl"
                >
                  إغلاق
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
