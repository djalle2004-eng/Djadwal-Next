'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  ClipboardList,
  Search,
  Printer,
  Download,
  RotateCcw,
  RefreshCw,
  Award,
  BookOpen,
  Calendar,
  Clock,
  DoorOpen,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Filter,
  BarChart2,
  Briefcase,
  Layers,
  ChevronDown,
  ArrowUpDown,
  Mail,
  GraduationCap
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
  Skeleton,
  EmptyState
} from '@djadwal/ui';

import { api } from '@/lib/api';

// Pedagogical Conversion Constants (Standard Algerian Higher Education: Decree 08-130)
const LECTURE_COEFFICIENT = 2.25; // 1.5h actual lecture slot = 2.25h TD-equivalent (HETD)
const TD_TP_COEFFICIENT = 1.50;  // 1.5h actual TD/TP slot = 1.50h TD-equivalent (HETD)

// Standard Statutory Teaching Quotas (النصاب القانوني الأسبوعي بالساعات المكافئة)
const RANK_QUOTAS: Record<string, { label: string; quota: number }> = {
  'PR': { label: 'أستاذ تعليم عالي (Professeur)', quota: 9.0 },
  'MCA': { label: 'أستاذ محاضر أ (Maître de Conférences A)', quota: 9.0 },
  'MCB': { label: 'أستاذ محاضر ب (Maître de Conférences B)', quota: 9.0 },
  'MAA': { label: 'أستاذ مساعد أ (Maître Assistant A)', quota: 9.0 },
  'MAB': { label: 'أستاذ مساعد ب (Maître Assistant B)', quota: 12.0 },
  'VAC': { label: 'أستاذ مؤقت / مشارك (Vacataire)', quota: 0.0 },
  'DOC': { label: 'دكتور باحث (Docteur)', quota: 9.0 },
  'DEFAULT': { label: 'أستاذ دائم', quota: 9.0 }
};

// Days of the week in Djadwal (0 = Saturday, 1 = Sunday, ..., 6 = Friday)
const DAYS = [
  { id: 0, name: 'السبت' },
  { id: 1, name: 'الأحد' },
  { id: 2, name: 'الاثنين' },
  { id: 3, name: 'الثلاثاء' },
  { id: 4, name: 'الأربعاء' },
  { id: 5, name: 'الخميس' }
];

// Helper to determine rank quota from professor title / academic_title
function getProfessorQuota(title?: string, academicTitle?: string): { rankKey: string; rankLabel: string; quota: number } {
  const combined = `${title || ''} ${academicTitle || ''}`.trim().toLowerCase();

  if (combined.includes('professeur') || combined.includes('تعليم عالي') || combined.includes('أ.د') || combined.includes('prof')) {
    return { rankKey: 'PR', rankLabel: RANK_QUOTAS['PR'].label, quota: RANK_QUOTAS['PR'].quota };
  }
  if (combined.includes('محاضر أ') || combined.includes('mca') || combined.includes('associate professor')) {
    return { rankKey: 'MCA', rankLabel: RANK_QUOTAS['MCA'].label, quota: RANK_QUOTAS['MCA'].quota };
  }
  if (combined.includes('محاضر ب') || combined.includes('mcb') || combined.includes('assistant professor')) {
    return { rankKey: 'MCB', rankLabel: RANK_QUOTAS['MCB'].label, quota: RANK_QUOTAS['MCB'].quota };
  }
  if (combined.includes('مساعد أ') || combined.includes('maa') || combined.includes('lecturer')) {
    return { rankKey: 'MAA', rankLabel: RANK_QUOTAS['MAA'].label, quota: RANK_QUOTAS['MAA'].quota };
  }
  if (combined.includes('مساعد ب') || combined.includes('mab') || combined.includes('assistant lecturer')) {
    return { rankKey: 'MAB', rankLabel: RANK_QUOTAS['MAB'].label, quota: RANK_QUOTAS['MAB'].quota };
  }
  if (combined.includes('مؤقت') || combined.includes('مشارك') || combined.includes('vacataire') || combined.includes('contractuel')) {
    return { rankKey: 'VAC', rankLabel: RANK_QUOTAS['VAC'].label, quota: RANK_QUOTAS['VAC'].quota };
  }
  if (combined.includes('دكتور') || combined.includes('dr')) {
    return { rankKey: 'DOC', rankLabel: RANK_QUOTAS['DOC'].label, quota: RANK_QUOTAS['DOC'].quota };
  }

  return { rankKey: 'DEFAULT', rankLabel: RANK_QUOTAS['DEFAULT'].label, quota: RANK_QUOTAS['DEFAULT'].quota };
}

// Translate academic level code (L1 -> جذع مشترك, etc.)
function getAcademicLevel(year?: string): string {
  if (!year) return '-';
  const y = year.toUpperCase().trim();
  if (y === 'L1') return 'سنة أولى (جذع مشترك)';
  if (y === 'L2') return 'سنة ثانية ليسانس';
  if (y === 'L3') return 'سنة ثالثة ليسانس';
  if (y === 'M1') return 'سنة أولى ماستر';
  if (y === 'M2') return 'سنة ثانية ماستر';
  return year;
}

interface Professor {
  id: number;
  name: string;
  title?: string;
  academic_title?: string;
  email?: string;
  phone?: string;
  department_id?: number;
  department_name?: string;
}

interface Course {
  id: number;
  name: string;
  code?: string;
  specialization?: string;
  group_year?: string;
}

interface Group {
  id: number;
  name: string;
  year?: string;
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
  specialization?: string;
  group_name?: string;
  course_name?: string;
  professor_name?: string;
  room_name?: string;
  group_year?: string;
  year?: string;
  session_type?: string;
}

interface CourseWorkloadBreakdown {
  courseId: number;
  courseName: string;
  specialization: string;
  level: string;
  lectureCount: number;
  tdCount: number;
  totalCount: number;
  lectureHours: number;
  tdHours: number;
  totalHours: number;
}

interface ProfessorWorkloadSummary {
  professor: Professor;
  rankKey: string;
  rankLabel: string;
  statutoryQuota: number;
  lectureCount: number;
  tdCount: number;
  totalSessions: number;
  totalLectureHours: number;
  totalTDHours: number;
  totalWeeklyHours: number;
  overtimeHours: number;
  underloadHours: number;
  status: 'overtime' | 'complete' | 'underload' | 'unassigned';
  coursesBreakdown: CourseWorkloadBreakdown[];
  dayMap: Record<string, { count: number; hours: number }>;
  assignments: Assignment[];
}

export default function ProfessorWorkloadPage() {
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Core Data
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [semester, setSemester] = useState<string>('السداسي الأول');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [selectedRankFilter, setSelectedRankFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');

  // Drilldown Selected Professor
  const [selectedProfId, setSelectedProfId] = useState<number | null>(null);

  // Print Modals State
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [printType, setPrintType] = useState<'individual' | 'department_recap' | 'individual_schedule' | 'official_assignment' | 'bulk_official_assignment'>('individual');
  const [printTargetProfessor, setPrintTargetProfessor] = useState<ProfessorWorkloadSummary | null>(null);
  const [printSettings, setPrintSettings] = useState<any>(null);

  // Fetch all core datasets
  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [profData, courseData, groupData, deptData, assignData, psData] = await Promise.all([
        api.get<Professor[]>('/professors?limit=500').catch(() => []),
        api.get<Course[]>('/catalog/courses?limit=500').catch(() => []),
        api.get<Group[]>('/catalog/groups?limit=500').catch(() => []),
        api.get<any[]>('/catalog/departments').catch(() => []),
        api.get<Assignment[]>(`/assignments?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&limit=3500`).catch(() => []),
        api.getPrintSettings().catch(() => null)
      ]);

      setProfessors(Array.isArray(profData) ? profData : []);
      setCourses(Array.isArray(courseData) ? courseData : []);
      setGroups(Array.isArray(groupData) ? groupData : []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
      setAssignments(Array.isArray(assignData) ? assignData : []);
      setPrintSettings(psData);
    } catch (err) {
      console.error('Error loading workload data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [academicYear, semester]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Master Workload Calculation Engine (Full Parity with Faculty Specifications)
  const calculatedWorkloads = useMemo<ProfessorWorkloadSummary[]>(() => {
    if (!professors.length) return [];

    const summaries: ProfessorWorkloadSummary[] = professors.map((professor) => {
      const profAssignments = assignments.filter((a) => a.professor_id === professor.id);
      const { rankKey, rankLabel, quota } = getProfessorQuota(professor.title, professor.academic_title);

      const courseMap = new Map<string, CourseWorkloadBreakdown>();
      const dayMap: Record<string, { count: number; hours: number }> = {};

      let totalLectures = 0;
      let totalTDs = 0;

      profAssignments.forEach((assignment) => {
        const course = courses.find((c) => c.id === assignment.course_id);
        const group = groups.find((g) => g.id === assignment.group_id);

        const groupName = (assignment.group_name || group?.name || '').trim();
        const isLecture = groupName === 'محاضرة' ||
          groupName.includes('محاضرة') ||
          assignment.session_type === 'lecture';

        const specialization = assignment.specialization || group?.specialization || course?.specialization || 'جذع مشترك';
        const level = getAcademicLevel(group?.year || assignment.group_year || assignment.year || course?.group_year);

        const key = `${assignment.course_id}_${specialization}_${level}`;

        if (!courseMap.has(key)) {
          courseMap.set(key, {
            courseId: assignment.course_id,
            courseName: assignment.course_name || course?.name || 'مقياس غير محدد',
            specialization,
            level,
            lectureCount: 0,
            tdCount: 0,
            totalCount: 0,
            lectureHours: 0,
            tdHours: 0,
            totalHours: 0
          });
        }

        const entry = courseMap.get(key)!;
        entry.totalCount += 1;

        if (isLecture) {
          entry.lectureCount += 1;
          entry.lectureHours += LECTURE_COEFFICIENT;
          totalLectures += 1;
        } else {
          entry.tdCount += 1;
          entry.tdHours += TD_TP_COEFFICIENT;
          totalTDs += 1;
        }

        entry.totalHours = entry.lectureHours + entry.tdHours;

        // Days breakdown
        const dayObj = DAYS.find((d) => d.id === assignment.day_of_week);
        const dayName = dayObj ? dayObj.name : 'يوم غير محدد';
        if (!dayMap[dayName]) {
          dayMap[dayName] = { count: 0, hours: 0 };
        }
        dayMap[dayName].count += 1;
        dayMap[dayName].hours += isLecture ? LECTURE_COEFFICIENT : TD_TP_COEFFICIENT;
      });

      const totalLectureHours = totalLectures * LECTURE_COEFFICIENT;
      const totalTDHours = totalTDs * TD_TP_COEFFICIENT;
      const totalWeeklyHours = totalLectureHours + totalTDHours;

      let status: 'overtime' | 'complete' | 'underload' | 'unassigned' = 'complete';
      let overtimeHours = 0;
      let underloadHours = 0;

      if (totalWeeklyHours === 0) {
        status = 'unassigned';
        underloadHours = quota;
      } else if (totalWeeklyHours > quota) {
        status = 'overtime';
        overtimeHours = totalWeeklyHours - quota;
      } else if (totalWeeklyHours < quota) {
        status = 'underload';
        underloadHours = quota - totalWeeklyHours;
      } else {
        status = 'complete';
      }

      return {
        professor,
        rankKey,
        rankLabel,
        statutoryQuota: quota,
        lectureCount: totalLectures,
        tdCount: totalTDs,
        totalSessions: totalLectures + totalTDs,
        totalLectureHours,
        totalTDHours,
        totalWeeklyHours,
        overtimeHours,
        underloadHours,
        status,
        coursesBreakdown: Array.from(courseMap.values()),
        dayMap,
        assignments: profAssignments
      };
    });

    // Sort descending by total hours
    summaries.sort((a, b) => b.totalWeeklyHours - a.totalWeeklyHours);
    return summaries;
  }, [professors, assignments, courses, groups]);

  // Global Faculty Statistics & KPIs
  const kpis = useMemo(() => {
    const totalProfessors = calculatedWorkloads.length;
    const totalWeeklyHours = calculatedWorkloads.reduce((acc, curr) => acc + curr.totalWeeklyHours, 0);
    const totalOvertimeHours = calculatedWorkloads.reduce((acc, curr) => acc + curr.overtimeHours, 0);

    const overtimeCount = calculatedWorkloads.filter((w) => w.status === 'overtime').length;
    const completeCount = calculatedWorkloads.filter((w) => w.status === 'complete').length;
    const underloadCount = calculatedWorkloads.filter((w) => w.status === 'underload').length;
    const unassignedCount = calculatedWorkloads.filter((w) => w.status === 'unassigned').length;

    return {
      totalProfessors,
      totalWeeklyHours,
      totalOvertimeHours,
      overtimeCount,
      completeCount,
      underloadCount,
      unassignedCount
    };
  }, [calculatedWorkloads]);

  // Filtered Overview Workloads
  const filteredWorkloads = useMemo(() => {
    return calculatedWorkloads.filter((w) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = w.professor.name.toLowerCase().includes(q);
        const courseMatch = w.coursesBreakdown.some((c) => c.courseName.toLowerCase().includes(q));
        if (!nameMatch && !courseMatch) return false;
      }

      // 2. Department Filter
      if (selectedDeptFilter !== 'all' && String(w.professor.department_id) !== selectedDeptFilter) {
        return false;
      }

      // 3. Rank Filter
      if (selectedRankFilter !== 'all' && w.rankKey !== selectedRankFilter) {
        return false;
      }

      // 4. Status Filter
      if (selectedStatusFilter !== 'all' && w.status !== selectedStatusFilter) {
        return false;
      }

      // 5. Course Filter
      if (selectedCourseFilter !== 'all') {
        const hasCourse = w.coursesBreakdown.some((c) => String(c.courseId) === selectedCourseFilter);
        if (!hasCourse) return false;
      }

      return true;
    });
  }, [calculatedWorkloads, searchQuery, selectedDeptFilter, selectedRankFilter, selectedStatusFilter, selectedCourseFilter]);

  // Currently Selected Professor for Drilldown
  const activeDrilldownWorkload = useMemo(() => {
    if (!selectedProfId) return calculatedWorkloads[0] || null;
    return calculatedWorkloads.find((w) => w.professor.id === selectedProfId) || calculatedWorkloads[0] || null;
  }, [calculatedWorkloads, selectedProfId]);

  // Export Table to Clean Arabic CSV
  const handleExportCSV = () => {
    const headers = [
      'الرقم',
      'الأستاذ',
      'الرتبة الأكاديمية',
      'القسم',
      'عدد المحاضرات',
      'عدد TD/TP',
      'إجمالي الحصص',
      'ساعات المحاضرات',
      'ساعات الأعمال الموجهة',
      'الحجم الساعي الأسبوعي (HETD)',
      'النصاب القانوني',
      'الساعات الإضافية',
      'نقص النصاب',
      'الحالة'
    ];

    const rows = filteredWorkloads.map((w, index) => [
      index + 1,
      `"${w.professor.name}"`,
      `"${w.rankLabel}"`,
      `"${w.professor.department_name || 'الكلية'}"`,
      w.lectureCount,
      w.tdCount,
      w.totalSessions,
      w.totalLectureHours.toFixed(2),
      w.totalTDHours.toFixed(2),
      w.totalWeeklyHours.toFixed(2),
      w.statutoryQuota.toFixed(2),
      w.overtimeHours.toFixed(2),
      w.underloadHours.toFixed(2),
      w.status === 'overtime' ? 'ساعات إضافية' : w.status === 'complete' ? 'مكتمل' : w.status === 'underload' ? 'نقص نصاب' : 'بدون تكليف'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `كشف_أعباء_الأساتذة_${academicYear}_${semester}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderOfficialAssignmentDocument = (w: ProfessorWorkloadSummary) => {
    const todayFormatted = new Date().toLocaleDateString('ar-DZ') || new Date().toISOString().split('T')[0];
    const city = printSettings?.city_name_ar || 'الوادي';
    const refFormat = printSettings?.reference_number_format || 'الـرقم:................../ ك. ع. إ. ت. ع. ت/ ن. ع. م. د/ م. ت/ {year}';
    const refString = refFormat.replace('{year}', academicYear);
    const watermarkOpacity = printSettings?.watermark_opacity ?? 0.08;
    const showWatermark = printSettings?.enable_watermark && printSettings?.university_logo_url;

    return (
      <div
        key={w.professor.id}
        className="relative p-6 text-slate-900 bg-white font-sans text-xs leading-relaxed page-break print:p-0 print:m-0 break-after-page print:break-after-page"
        dir="rtl"
      >
        {/* University Watermark Background */}
        {showWatermark && (
          <div
            className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0"
            style={{ opacity: watermarkOpacity }}
          >
            <img
              src={printSettings.university_logo_url}
              alt="Watermark"
              className="w-[420px] h-[420px] object-contain select-none"
            />
          </div>
        )}

        <div className="relative z-10 space-y-4">
          {/* Official Triple Administrative Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
            {/* Right: Faculty info & Faculty Logo */}
            <div className="flex items-center gap-2.5 max-w-[38%]">
              {printSettings?.faculty_logo_url && (
                <img
                  src={printSettings.faculty_logo_url}
                  alt="Faculty Logo"
                  className="h-14 w-14 object-contain shrink-0"
                />
              )}
              <div className="text-right text-[10px] leading-tight space-y-0.5">
                <p className="font-bold text-slate-900">{printSettings?.faculty_name_ar || 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير'}</p>
                <p className="text-slate-700">{printSettings?.deanery_name_ar || 'نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة'}</p>
                <p className="text-slate-600 font-medium">{printSettings?.service_name_ar || 'مصلحة التدريس'}</p>
                <p className="font-mono text-[9px] text-slate-700 pt-0.5">{refString}</p>
              </div>
            </div>

            {/* Center: Republic & Ministry */}
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
                  className="h-14 w-14 object-contain"
                />
              ) : (
                <div className="h-14 w-14 border border-dashed rounded-lg flex items-center justify-center text-[9px] text-slate-400">شعار الجامعة</div>
              )}
            </div>
          </div>

          {/* Framed Document Title */}
          <div className="text-center pt-1">
            <div className="inline-block border-2 border-slate-950 px-8 py-2 rounded-lg bg-slate-50 font-extrabold text-sm text-slate-900 shadow-sm">
              تكليف بمقاييس {semester} للموسم الجامعي : {academicYear}
            </div>
          </div>

          {/* Preface & Professor Details */}
          <div className="space-y-1.5 border border-slate-300 bg-slate-50/80 p-3 rounded-xl text-xs">
            <p className="text-slate-800 leading-relaxed">
              نحيط علم سيادتكم أنه قد تم تكليفكم بالمقاييس التالية ابتداءً من انطلاق السداسي:
            </p>
            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-200 text-slate-900">
              <div>
                <span className="font-bold">الاسم واللقب: </span>
                <span className="font-semibold text-blue-950">{w.professor.name}</span>
              </div>
              <div>
                <span className="font-bold">الصفة / الرتبة الأكاديمية: </span>
                <span className="font-medium">{w.rankLabel}</span>
              </div>
            </div>
          </div>

          {/* Table 1: ملخص الحجم الساعي الأسبوعي */}
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-slate-900">1. ملخص الحجم الساعي الأسبوعي:</h4>
            <table className="w-full text-xs border border-slate-800 border-collapse text-center">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-800 font-bold">
                  <th className="p-1.5 border border-slate-800">المحاضرات</th>
                  <th className="p-1.5 border border-slate-800">الأعمال الموجهة</th>
                  <th className="p-1.5 border border-slate-800">الأعمال التطبيقية</th>
                  <th className="p-1.5 border border-slate-800 bg-slate-200 font-extrabold">المجموع الكلي</th>
                </tr>
              </thead>
              <tbody>
                <tr className="font-bold font-mono">
                  <td className="p-1.5 border border-slate-800">{w.totalLectureHours.toFixed(1)} سا</td>
                  <td className="p-1.5 border border-slate-800">{w.totalTDHours.toFixed(1)} سا</td>
                  <td className="p-1.5 border border-slate-800">0.0 سا</td>
                  <td className="p-1.5 border border-slate-800 bg-slate-100 font-extrabold text-blue-900">{w.totalWeeklyHours.toFixed(1)} سا</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Table 2: تفاصيل المقاييس المكلف بها */}
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-slate-900">2. تفاصيل المقاييس المكلف بها:</h4>
            <table className="w-full text-xs border border-slate-800 border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-800 font-bold text-center">
                  <th className="p-1.5 border border-slate-800 text-start">المقرر / المقياس</th>
                  <th className="p-1.5 border border-slate-800">عدد الساعات</th>
                  <th className="p-1.5 border border-slate-800">عدد الحصص</th>
                  <th className="p-1.5 border border-slate-800">الإجمالي</th>
                  <th className="p-1.5 border border-slate-800 text-start">التخصص</th>
                  <th className="p-1.5 border border-slate-800">المستوى</th>
                </tr>
              </thead>
              <tbody>
                {w.coursesBreakdown.map((course, idx) => (
                  <tr key={idx} className="border-b border-slate-800 text-center">
                    <td className="p-1.5 border border-slate-800 text-start font-bold">{course.courseName}</td>
                    <td className="p-1.5 border border-slate-800 font-mono">{(course.lectureHours + course.tdHours).toFixed(1)}</td>
                    <td className="p-1.5 border border-slate-800 font-mono">{course.totalCount}</td>
                    <td className="p-1.5 border border-slate-800 font-mono font-bold">{course.totalHours.toFixed(1)}</td>
                    <td className="p-1.5 border border-slate-800 text-start">{course.specialization || '-'}</td>
                    <td className="p-1.5 border border-slate-800">{course.level || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table 3: التوزيع اليومي للحصص */}
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-slate-900">3. التوزيع اليومي للحصص:</h4>
            <table className="w-full text-xs border border-slate-800 border-collapse text-center">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-800 font-bold">
                  <th className="p-1.5 border border-slate-800 text-start">اليوم</th>
                  <th className="p-1.5 border border-slate-800">عدد الحصص</th>
                  <th className="p-1.5 border border-slate-800">عدد الساعات</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(w.dayMap).map(([dayName, data]) => (
                  <tr key={dayName} className="border-b border-slate-800">
                    <td className="p-1.5 border border-slate-800 text-start font-bold">{dayName}</td>
                    <td className="p-1.5 border border-slate-800 font-mono">{data.count}</td>
                    <td className="p-1.5 border border-slate-800 font-mono font-semibold">{data.hours.toFixed(1)} سا</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Closing & Signatures */}
          <div className="pt-3 space-y-3">
            <p className="text-center font-bold text-xs text-slate-900">
              وفي الأخير تقبلوا منا أسمى عبارات التقدير والاحترام
            </p>

            <div className="flex justify-between items-end pt-2 px-4">
              <div className="text-start font-bold text-xs">
                <p>{city} في: {todayFormatted}</p>
              </div>
              <div className="text-center space-y-0.5">
                <p className="font-bold text-xs text-slate-950">
                  {printSettings?.vice_dean_title || 'نائب العميد المكلف بالدراسات والمسائل المرتبطة بالطلبة'}
                </p>
                {printSettings?.vice_dean_name && (
                  <p className="text-xs text-slate-800 font-semibold">{printSettings.vice_dean_name}</p>
                )}
                <div className="h-14 w-44 mt-1 border-t-2 border-slate-900 pt-1 text-[10px] text-slate-400">
                  التوقيع والختم الرسمي
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20" dir="rtl">
      {/* Top Header & Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  نظام أعباء الأساتذة والنصاب التدريسي
                </h1>
                <Badge variant="success">100% Feature Parity</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                حساب النصاب القانوني والساعات الإضافية، بطاقات التكليف الفردية، والتقارير الإجمالية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Link to Legacy UI */}
            <a
              href="/legacy/professor-workload"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 transition-colors"
              title="الانتقال إلى الواجهة الكلاسيكية السابقة للمقارنة التامة"
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
              <span>تحديث البيانات</span>
            </Button>
          </div>
        </div>

        {/* Global Academic Banner */}
        <div className="bg-slate-100/70 dark:bg-slate-800/40 border-t border-slate-200/60 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-4">
              <span>السنة الجامعية: <strong className="text-slate-900 dark:text-white font-mono">{academicYear}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>السداسي: <strong className="text-blue-700 dark:text-blue-400">{semester}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>معامل المحاضرة: <strong className="text-slate-900 dark:text-white font-mono">2.25</strong> (HETD)</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>معامل الـ TD/TP: <strong className="text-slate-900 dark:text-white font-mono">1.50</strong> (HETD)</span>
            </div>

            <div className="flex items-center gap-3">
              <span>إجمالي ساعات الكلية: <strong className="font-mono text-slate-900 dark:text-white">{kpis.totalWeeklyHours.toFixed(1)}</strong> ساعة/أسبوع</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>الساعات الإضافية الإجمالية: <strong className="font-mono text-emerald-600 dark:text-emerald-400">+{kpis.totalOvertimeHours.toFixed(1)}</strong> ساعة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="p-3 text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">إجمالي الأساتذة</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{kpis.totalProfessors}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">مسجلين في النظام</div>
          </Card>

          <Card className="p-3 text-center bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60 shadow-sm">
            <div className="text-xs text-blue-700 dark:text-blue-300 mb-1">الحجم الساعي الأسبوعي</div>
            <div className="text-2xl font-black text-blue-700 dark:text-blue-300 font-mono">{kpis.totalWeeklyHours.toFixed(1)}</div>
            <div className="text-[10px] text-blue-600/80 mt-0.5">ساعة تدريس / أسبوع</div>
          </Card>

          <Card className="p-3 text-center bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 shadow-sm">
            <div className="text-xs text-emerald-700 dark:text-emerald-300 mb-1">ساعات إضافية (فائض)</div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">{kpis.overtimeCount}</div>
            <div className="text-[10px] text-emerald-600/80 mt-0.5">+{kpis.totalOvertimeHours.toFixed(1)} ساعة إضافية</div>
          </Card>

          <Card className="p-3 text-center bg-teal-50/40 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800/60 shadow-sm">
            <div className="text-xs text-teal-700 dark:text-teal-300 mb-1">مكتملو النصاب</div>
            <div className="text-2xl font-black text-teal-700 dark:text-teal-300 font-mono">{kpis.completeCount}</div>
            <div className="text-[10px] text-teal-600/80 mt-0.5">مستوفون 100%</div>
          </Card>

          <Card className="p-3 text-center bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 shadow-sm">
            <div className="text-xs text-amber-700 dark:text-amber-300 mb-1">نقص في النصاب</div>
            <div className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">{kpis.underloadCount}</div>
            <div className="text-[10px] text-amber-600/80 mt-0.5">أقل من الساعات القانونية</div>
          </Card>

          <Card className="p-3 text-center bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60 shadow-sm">
            <div className="text-xs text-rose-700 dark:text-rose-300 mb-1">بدون تكليف</div>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-300 font-mono">{kpis.unassignedCount}</div>
            <div className="text-[10px] text-rose-600/80 mt-0.5">صفر حصص هذا السداسي</div>
          </Card>
        </div>

        {/* Tab Navigation */}
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 max-w-md w-full">
            <TabTrigger value="overview" className="gap-2">
              <Users className="h-4 w-4" />
              <span>الكشف الإجمالي للأعباء</span>
            </TabTrigger>
            <TabTrigger value="drilldown" className="gap-2">
              <Award className="h-4 w-4" />
              <span>تفاصيل العبء الفردي</span>
            </TabTrigger>
          </TabsList>

          {/* ================================================================= */}
          {/* TAB 1: OVERVIEW TABLE & ACTIONS                                   */}
          {/* ================================================================= */}
          <TabContent value="overview">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Filter className="h-4 w-4 text-blue-600" />
                      <span>جدول أعباء ونصاب الأساتذة ({filteredWorkloads.length})</span>
                    </CardTitle>
                    <CardDescription>
                      استعراض شامل للنصاب القانوني، ساعات المحاضرات والأعمال الموجهة، وحالة الساعات الإضافية
                    </CardDescription>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setPrintType('bulk_official_assignment');
                        setPrintModalOpen(true);
                      }}
                      className="gap-1.5 text-xs bg-indigo-700 hover:bg-indigo-800 text-white shadow-sm font-semibold"
                    >
                      <Award className="h-3.5 w-3.5" />
                      <span>طباعة وثائق التكليف لكافة الأساتذة (دفعة واحدة)</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPrintType('department_recap');
                        setPrintModalOpen(true);
                      }}
                      className="gap-1.5 text-xs text-slate-700 dark:text-slate-200"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>طباعة الكشف الإجمالي للقسم</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCSV}
                      className="gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>تصدير Excel / CSV</span>
                    </Button>
                  </div>
                </div>

                {/* Filters Grid */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-3">
                  {/* Search Query */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      بحث سريع بالأستاذ أو المقياس
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="اكتب اسم الأستاذ أو المقياس..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-xs ps-8"
                      />
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  {/* Rank Filter */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      الرتبة الأكاديمية
                    </label>
                    <select
                      value={selectedRankFilter}
                      onChange={(e) => setSelectedRankFilter(e.target.value)}
                      className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                    >
                      <option value="all">جميع الرتب</option>
                      <option value="PR">أستاذ تعليم عالي (9h)</option>
                      <option value="MCA">أستاذ محاضر أ (9h)</option>
                      <option value="MCB">أستاذ محاضر ب (9h)</option>
                      <option value="MAA">أستاذ مساعد أ (9h)</option>
                      <option value="MAB">أستاذ مساعد ب (12h)</option>
                      <option value="VAC">أستاذ مؤقت / مشارك (0h)</option>
                    </select>
                  </div>

                  {/* Workload Status Filter */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      حالة النصاب
                    </label>
                    <select
                      value={selectedStatusFilter}
                      onChange={(e) => setSelectedStatusFilter(e.target.value)}
                      className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                    >
                      <option value="all">جميع الحالات</option>
                      <option value="overtime">ساعات إضافية (فائض)</option>
                      <option value="complete">مكتمل النصاب بالضبط</option>
                      <option value="underload">نقص في النصاب</option>
                      <option value="unassigned">بدون تكليف (صفر)</option>
                    </select>
                  </div>

                  {/* Department Filter */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      القسم
                    </label>
                    <select
                      value={selectedDeptFilter}
                      onChange={(e) => setSelectedDeptFilter(e.target.value)}
                      className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                    >
                      <option value="all">جميع الأقسام</option>
                      {departments.map((d) => (
                        <option key={d.id} value={String(d.id)}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : filteredWorkloads.length === 0 ? (
                  <EmptyState
                    title="لا يوجد أساتذة مطابقون للفلترة"
                    description="جرب تغيير معايير البحث أو اختيار حالة أخرى"
                  />
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-start text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                          <th className="py-3 px-3 text-start">الأستاذ والرتبة</th>
                          <th className="py-3 px-2 text-center">محاضرات (Cours)</th>
                          <th className="py-3 px-2 text-center">أعمال موجهة (TD)</th>
                          <th className="py-3 px-2 text-center">إجمالي الحصص</th>
                          <th className="py-3 px-3 text-center">الحجم الساعي الأسبوعي</th>
                          <th className="py-3 px-2 text-center">النصاب القانوني</th>
                          <th className="py-3 px-3 text-center">الفارق (إضافي / نقص)</th>
                          <th className="py-3 px-3 text-center">حالة العبء</th>
                          <th className="py-3 px-3 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredWorkloads.map((w) => (
                          <tr key={w.professor.id} className="hover:bg-slate-50/70 transition-colors">
                            {/* Professor & Rank */}
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                {w.professor.name}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span className="text-blue-600 dark:text-blue-400 font-medium">{w.rankLabel}</span>
                                {w.professor.email && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-[10px] text-slate-400">{w.professor.email}</span>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Lecture Count */}
                            <td className="py-2.5 px-2 text-center font-mono">
                              <span className="font-bold text-indigo-700 dark:text-indigo-400">{w.lectureCount}</span>
                              <span className="text-[10px] text-slate-400 block">({w.totalLectureHours.toFixed(1)}h)</span>
                            </td>

                            {/* TD Count */}
                            <td className="py-2.5 px-2 text-center font-mono">
                              <span className="font-bold text-teal-700 dark:text-teal-400">{w.tdCount}</span>
                              <span className="text-[10px] text-slate-400 block">({w.totalTDHours.toFixed(1)}h)</span>
                            </td>

                            {/* Total Sessions */}
                            <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {w.totalSessions}
                            </td>

                            {/* Weekly Total Hours */}
                            <td className="py-2.5 px-3 text-center font-mono">
                              <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                                {w.totalWeeklyHours.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-400 block">ساعة/أسبوع</span>
                            </td>

                            {/* Statutory Quota */}
                            <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-600 dark:text-slate-400">
                              {w.statutoryQuota.toFixed(1)}h
                            </td>

                            {/* Difference */}
                            <td className="py-2.5 px-3 text-center font-mono">
                              {w.status === 'overtime' ? (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  +{w.overtimeHours.toFixed(2)} ساعة
                                </span>
                              ) : w.status === 'underload' ? (
                                <span className="font-bold text-amber-600 dark:text-amber-400">
                                  -{w.underloadHours.toFixed(2)} ساعة
                                </span>
                              ) : w.status === 'unassigned' ? (
                                <span className="text-rose-500 font-semibold">غير مبرمج</span>
                              ) : (
                                <span className="text-slate-400">مستوفى تماماً</span>
                              )}
                            </td>

                            {/* Status Badge */}
                            <td className="py-2.5 px-3 text-center">
                              {w.status === 'overtime' ? (
                                <Badge variant="success">ساعات إضافية</Badge>
                              ) : w.status === 'complete' ? (
                                <Badge variant="info">مكتمل النصاب</Badge>
                              ) : w.status === 'underload' ? (
                                <Badge variant="warning">نقص في النصاب</Badge>
                              ) : (
                                <Badge variant="danger">بدون تكليف</Badge>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Drilldown Button */}
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedProfId(w.professor.id);
                                    setActiveTab('drilldown');
                                  }}
                                  className="h-7 text-xs py-0 px-2 bg-blue-600 hover:bg-blue-700 text-white"
                                  title="عرض كشف المقررات وجدول التوقيت الفردي"
                                >
                                  التفاصيل
                                </Button>

                                {/* Official Assignment Document */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setPrintTargetProfessor(w);
                                    setPrintType('official_assignment');
                                    setPrintModalOpen(true);
                                  }}
                                  className="h-7 w-7 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                  title="طباعة وثيقة التكليف الرسمية بمقاييس السداسي"
                                >
                                  <Award className="h-3.5 w-3.5" />
                                </Button>

                                {/* Print Card */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setPrintTargetProfessor(w);
                                    setPrintType('individual');
                                    setPrintModalOpen(true);
                                  }}
                                  className="h-7 w-7 p-0 text-slate-600 hover:text-blue-600"
                                  title="طباعة بطاقة العبء الفردية"
                                >
                                  <Printer className="h-3.5 w-3.5" />
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

          {/* ================================================================= */}
          {/* TAB 2: INDIVIDUAL PROFESSOR DRILLDOWN                             */}
          {/* ================================================================= */}
          <TabContent value="drilldown">
            {activeDrilldownWorkload ? (
              <div className="space-y-6">
                {/* Professor Switcher Bar */}
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                          {activeDrilldownWorkload.professor.name.slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                              {activeDrilldownWorkload.professor.name}
                            </h2>
                            <Badge variant={activeDrilldownWorkload.status === 'overtime' ? 'success' : activeDrilldownWorkload.status === 'complete' ? 'info' : 'warning'}>
                              {activeDrilldownWorkload.rankLabel}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                            <span>النصاب المطلوب: <strong>{activeDrilldownWorkload.statutoryQuota}h</strong></span>
                            <span>•</span>
                            <span>الحجم المنجز: <strong>{activeDrilldownWorkload.totalWeeklyHours.toFixed(2)}h</strong></span>
                            <span>•</span>
                            <span>الفارق: <strong className={activeDrilldownWorkload.status === 'overtime' ? 'text-emerald-600' : 'text-amber-600'}>
                              {activeDrilldownWorkload.status === 'overtime' ? `+${activeDrilldownWorkload.overtimeHours.toFixed(2)}h` : activeDrilldownWorkload.status === 'underload' ? `-${activeDrilldownWorkload.underloadHours.toFixed(2)}h` : '0h'}
                            </strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Selector for another professor */}
                        <select
                          value={selectedProfId || activeDrilldownWorkload.professor.id}
                          onChange={(e) => setSelectedProfId(Number(e.target.value))}
                          className="py-1.5 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                        >
                          {calculatedWorkloads.map((w) => (
                            <option key={w.professor.id} value={w.professor.id}>
                              {w.professor.name} ({w.totalWeeklyHours.toFixed(1)}h)
                            </option>
                          ))}
                        </select>

                        {/* Print Official Assignment Document */}
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setPrintTargetProfessor(activeDrilldownWorkload);
                            setPrintType('official_assignment');
                            setPrintModalOpen(true);
                          }}
                          className="gap-1.5 text-xs bg-indigo-700 hover:bg-indigo-800 text-white font-semibold shadow-sm"
                        >
                          <Award className="h-3.5 w-3.5" />
                          <span>وثيقة التكليف بمقاييس السداسي (رسمية)</span>
                        </Button>

                        {/* Print Individual Card */}
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setPrintTargetProfessor(activeDrilldownWorkload);
                            setPrintType('individual');
                            setPrintModalOpen(true);
                          }}
                          className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>طباعة بطاقة العبء الفردية</span>
                        </Button>

                        {/* Print Individual Timetable */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPrintTargetProfessor(activeDrilldownWorkload);
                            setPrintType('individual_schedule');
                            setPrintModalOpen(true);
                          }}
                          className="gap-1.5 text-xs"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          <span>طباعة جدول الحصص</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Courses Breakdown Table */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                      <span>المقررات والمقاييس المكلف بها الأستاذ ({activeDrilldownWorkload.coursesBreakdown.length})</span>
                    </CardTitle>
                    <CardDescription>
                      تفصيل عدد المحاضرات والأعمال الموجهة والحجم الساعي الأسبوعي لكل مقياس
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {activeDrilldownWorkload.coursesBreakdown.length === 0 ? (
                      <EmptyState
                        title="لا توجد مقاييس مسجلة"
                        description="لم يتم إسناد أي مقاييس لهذا الأستاذ في السداسي المختار"
                      />
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                        <table className="w-full text-start text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                              <th className="py-2.5 px-3 text-start">المقياس / المادة</th>
                              <th className="py-2.5 px-3 text-start">التخصص</th>
                              <th className="py-2.5 px-3 text-start">المستوى الدراسي</th>
                              <th className="py-2.5 px-2 text-center">محاضرات (Cours)</th>
                              <th className="py-2.5 px-2 text-center">أعمال موجهة (TD)</th>
                              <th className="py-2.5 px-2 text-center">مجموع الحصص</th>
                              <th className="py-2.5 px-3 text-center">الحجم الساعي المعادل (HETD)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {activeDrilldownWorkload.coursesBreakdown.map((c, i) => (
                              <tr key={i} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 text-sm">
                                  {c.courseName}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                  {c.specialization}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                  {c.level}
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-700 dark:text-indigo-400">
                                  {c.lectureCount}
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-teal-700 dark:text-teal-400">
                                  {c.tdCount}
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-semibold">
                                  {c.totalCount}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 dark:text-white">
                                  {c.totalHours.toFixed(2)}h
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50 dark:bg-slate-900 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                              <td colSpan={3} className="py-3 px-3 text-start">المجموع الإجمالي الأسبوعي للأستاذ:</td>
                              <td className="py-3 px-2 text-center font-mono text-indigo-700 dark:text-indigo-400">
                                {activeDrilldownWorkload.lectureCount}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-teal-700 dark:text-teal-400">
                                {activeDrilldownWorkload.tdCount}
                              </td>
                              <td className="py-3 px-2 text-center font-mono">
                                {activeDrilldownWorkload.totalSessions}
                              </td>
                              <td className="py-3 px-3 text-center font-mono text-blue-600 dark:text-blue-400 text-sm">
                                {activeDrilldownWorkload.totalWeeklyHours.toFixed(2)}h
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Individual Weekly Schedule Table */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span>جدول الحصص والتوزيع الزمني الأسبوعي</span>
                    </CardTitle>
                    <CardDescription>
                      مواعيد وقاعات الحصص المسندة للأستاذ خلال الأسبوع
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {activeDrilldownWorkload.assignments.length === 0 ? (
                      <EmptyState
                        title="لا توجد حصص مجدولة"
                        description="لم يتم برمجة حصص أسبوعية لهذا الأستاذ بعد"
                      />
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                        <table className="w-full text-start text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                              <th className="py-2.5 px-3 text-start">اليوم</th>
                              <th className="py-2.5 px-3 text-start">التوقيت</th>
                              <th className="py-2.5 px-3 text-start">المقياس</th>
                              <th className="py-2.5 px-3 text-start">نوع الحصة</th>
                              <th className="py-2.5 px-3 text-start">الفوج / الدفعة</th>
                              <th className="py-2.5 px-3 text-start">القاعة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {activeDrilldownWorkload.assignments.map((a, i) => (
                              <tr key={i} className="hover:bg-slate-50/70">
                                <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                                  {DAYS.find((d) => d.id === a.day_of_week)?.name || 'غير معروف'}
                                </td>
                                <td className="py-2 px-3 font-mono font-semibold text-blue-700 dark:text-blue-400">
                                  {a.start_time} - {a.end_time}
                                </td>
                                <td className="py-2 px-3 font-medium">
                                  {a.course_name || 'مقياس'}
                                </td>
                                <td className="py-2 px-3">
                                  <Badge variant={a.group_name === 'محاضرة' ? 'info' : 'neutral'}>
                                    {a.group_name === 'محاضرة' ? 'محاضرة (Cours)' : 'أعمال موجهة (TD)'}
                                  </Badge>
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                                  {a.group_name || 'الدفعة'}
                                </td>
                                <td className="py-2 px-3 font-semibold text-emerald-700 dark:text-emerald-400">
                                  {a.room_name || 'قاعة غير محددة'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <EmptyState
                title="الرجاء اختيار أستاذ"
                description="اختر أستاذًا من القائمة لاستعراض كشف الأعباء والتفاصيل الفردية"
              />
            )}
          </TabContent>
        </Tabs>
      </div>

      {/* Official Algerian University Print Modal */}
      <Dialog open={printModalOpen} onClose={() => setPrintModalOpen(false)} size="xl">
        <div className="p-6 text-start max-w-4xl" dir="rtl">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Printer className="h-5 w-5 text-blue-600" />
              <span>
                {printType === 'official_assignment'
                  ? 'وثيقة التكليف الرسمية بمقاييس السداسي'
                  : printType === 'bulk_official_assignment'
                  ? `طباعة وثائق التكليف الرسمية لكافة الأساتذة (${filteredWorkloads.filter(w => w.totalWeeklyHours > 0).length} أستاذ)`
                  : printType === 'individual'
                  ? 'بطاقة العبء البيداغوجي الفردية (Fiche de Service)'
                  : printType === 'individual_schedule'
                  ? 'جدول التوقيت الأسبوعي للأستاذ'
                  : 'الكشف الإجمالي لأعباء ونصاب أساتذة القسم (État Récapitulatif)'}
              </span>
            </DialogTitle>
            <Button
              variant="primary"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة المستند</span>
            </Button>
          </div>

          {/* Printable Sheet */}
          <div className="bg-white p-6 border rounded-xl print:p-0 print:border-none text-slate-900">
            {/* Algerian Official Header */}
            {printType !== 'official_assignment' && printType !== 'bulk_official_assignment' && (
              <div className="text-center border-b pb-4 mb-4">
                <h2 className="font-bold text-sm">الجمهورية الجزائرية الديمقراطية الشعبية</h2>
                <h3 className="font-bold text-xs mt-0.5">وزارة التعليم العالي والبحث العلمي</h3>
                <h4 className="font-semibold text-xs mt-0.5">جامعة الشهيد حمه لخضر - الوادي</h4>
                <h5 className="text-xs text-slate-600 mt-0.5">كلية العلوم الاقتصادية والتجارية وعلوم التسيير</h5>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  السنة الجامعية: {academicYear} | {semester}
                </div>
              </div>
            )}

            {/* View 0A: Individual Official Assignment Document */}
            {printType === 'official_assignment' && printTargetProfessor && (
              renderOfficialAssignmentDocument(printTargetProfessor)
            )}

            {/* View 0B: Bulk Official Assignment Documents for All Professors */}
            {printType === 'bulk_official_assignment' && (
              <div className="space-y-12">
                {filteredWorkloads
                  .filter((w) => w.totalWeeklyHours > 0)
                  .map((w) => renderOfficialAssignmentDocument(w))}
              </div>
            )}

            {/* View 1: Individual Fiche de Service */}
            {printType === 'individual' && printTargetProfessor && (
              <div className="space-y-4 py-2">
                <div className="text-center font-bold text-base text-blue-900 border-b-2 border-blue-900 pb-1 w-fit mx-auto">
                  بطاقة العبء البيداغوجي الفردية للأستاذ (Fiche de Service)
                </div>

                {/* Prof Info Header */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg text-xs border">
                  <div><strong>اسم ولقب الأستاذ:</strong> {printTargetProfessor.professor.name}</div>
                  <div><strong>الرتبة الأكاديمية:</strong> {printTargetProfessor.rankLabel}</div>
                  <div><strong>النصاب القانوني المطلوب:</strong> {printTargetProfessor.statutoryQuota.toFixed(1)} ساعة/أسبوع</div>
                  <div><strong>الحجم الساعي الأسبوعي المنجز:</strong> {printTargetProfessor.totalWeeklyHours.toFixed(2)} ساعة</div>
                  <div><strong>الساعات الإضافية:</strong> +{printTargetProfessor.overtimeHours.toFixed(2)} ساعة</div>
                  <div><strong>نقص النصاب:</strong> -{printTargetProfessor.underloadHours.toFixed(2)} ساعة</div>
                </div>

                {/* Courses Table */}
                <div className="space-y-1">
                  <h4 className="font-bold text-xs">كشف المقاييس والأفواج المكلف بها:</h4>
                  <table className="w-full text-xs border border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b">
                        <th className="p-2 border text-start">المقياس</th>
                        <th className="p-2 border text-start">التخصص والمستوى</th>
                        <th className="p-2 border text-center">محاضرات</th>
                        <th className="p-2 border text-center">أعمال موجهة</th>
                        <th className="p-2 border text-center">الحجم الساعي (HETD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printTargetProfessor.coursesBreakdown.map((c, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2 border font-bold">{c.courseName}</td>
                          <td className="p-2 border">{c.specialization} ({c.level})</td>
                          <td className="p-2 border text-center font-mono">{c.lectureCount}</td>
                          <td className="p-2 border text-center font-mono">{c.tdCount}</td>
                          <td className="p-2 border text-center font-mono font-bold">{c.totalHours.toFixed(2)}h</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold border-t">
                        <td colSpan={2} className="p-2 border">المجموع الكلي:</td>
                        <td className="p-2 border text-center font-mono">{printTargetProfessor.lectureCount}</td>
                        <td className="p-2 border text-center font-mono">{printTargetProfessor.tdCount}</td>
                        <td className="p-2 border text-center font-mono text-blue-900">{printTargetProfessor.totalWeeklyHours.toFixed(2)}h</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Official Signatures Block */}
                <div className="grid grid-cols-3 gap-4 pt-10 text-center text-xs font-semibold">
                  <div>
                    <span>توقيع الأستاذ المعني</span>
                    <div className="h-16 mt-2 border-b border-dashed border-slate-300"></div>
                  </div>
                  <div>
                    <span>توقيع وتأشيرة رئيس القسم</span>
                    <div className="h-16 mt-2 border-b border-dashed border-slate-300"></div>
                  </div>
                  <div>
                    <span>مصادقة عميد الكلية</span>
                    <div className="h-16 mt-2 border-b border-dashed border-slate-300"></div>
                  </div>
                </div>
              </div>
            )}

            {/* View 2: Department Recap Table */}
            {printType === 'department_recap' && (
              <div className="space-y-4 py-2">
                <div className="text-center font-bold text-sm text-slate-900 border-b pb-1">
                  الكشف الإجمالي لأعباء ونصاب الأساتذة والساعات الإضافية (État Récapitulatif)
                </div>

                <table className="w-full text-[11px] border border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="p-1.5 border text-start">الرقم</th>
                      <th className="p-1.5 border text-start">الأستاذ</th>
                      <th className="p-1.5 border text-start">الرتبة</th>
                      <th className="p-1.5 border text-center">محاضرات</th>
                      <th className="p-1.5 border text-center">أعمال موجهة</th>
                      <th className="p-1.5 border text-center">الحجم المنجز</th>
                      <th className="p-1.5 border text-center">النصاب</th>
                      <th className="p-1.5 border text-center">ساعات إضافية</th>
                      <th className="p-1.5 border text-center">نقص</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkloads.map((w, i) => (
                      <tr key={w.professor.id} className="border-b">
                        <td className="p-1.5 border text-center font-mono">{i + 1}</td>
                        <td className="p-1.5 border font-semibold">{w.professor.name}</td>
                        <td className="p-1.5 border">{w.rankLabel}</td>
                        <td className="p-1.5 border text-center font-mono">{w.lectureCount}</td>
                        <td className="p-1.5 border text-center font-mono">{w.tdCount}</td>
                        <td className="p-1.5 border text-center font-mono font-bold">{w.totalWeeklyHours.toFixed(1)}</td>
                        <td className="p-1.5 border text-center font-mono">{w.statutoryQuota.toFixed(1)}</td>
                        <td className="p-1.5 border text-center font-mono font-bold text-emerald-700">
                          {w.overtimeHours > 0 ? `+${w.overtimeHours.toFixed(1)}` : '-'}
                        </td>
                        <td className="p-1.5 border text-center font-mono text-amber-700">
                          {w.underloadHours > 0 && w.status !== 'unassigned' ? `-${w.underloadHours.toFixed(1)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Signatures */}
                <div className="flex justify-between pt-8 text-xs font-semibold px-4">
                  <div>مصلحة المستخدمين والمحاسبة</div>
                  <div>عميد الكلية</div>
                </div>
              </div>
            )}

            {/* View 3: Individual Schedule Table */}
            {printType === 'individual_schedule' && printTargetProfessor && (
              <div className="space-y-4 py-2">
                <div className="text-center font-bold text-base text-blue-900 border-b pb-1">
                  جدول التوقيت الأسبوعي للأستاذ: {printTargetProfessor.professor.name}
                </div>

                <table className="w-full text-xs border border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="p-2 border text-start">اليوم</th>
                      <th className="p-2 border text-center">التوقيت</th>
                      <th className="p-2 border text-start">المقياس</th>
                      <th className="p-2 border text-center">نوع الحصة</th>
                      <th className="p-2 border text-start">الفوج / الدفعة</th>
                      <th className="p-2 border text-center">القاعة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printTargetProfessor.assignments.map((a, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2 border font-bold">{DAYS.find((d) => d.id === a.day_of_week)?.name}</td>
                        <td className="p-2 border text-center font-mono">{a.start_time} - {a.end_time}</td>
                        <td className="p-2 border font-medium">{a.course_name}</td>
                        <td className="p-2 border text-center">{a.group_name === 'محاضرة' ? 'محاضرة' : 'أعمال موجهة'}</td>
                        <td className="p-2 border">{a.group_name}</td>
                        <td className="p-2 border text-center font-bold">{a.room_name}</td>
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
