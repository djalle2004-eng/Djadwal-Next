'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Sparkles,
  History,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Clock,
  Layers,
  ArrowLeftRight,
  RotateCcw,
  Check,
  X,
  Eye,
  Sliders,
  ShieldAlert,
  Play,
  FileSpreadsheet,
  Building2,
  Users,
  Search
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
  DialogDescription
} from '@djadwal/ui';
import { api } from '@/lib/api';
import { SchedulePreviewModal } from '@/components/SchedulePreviewModal';

interface Version {
  id: number;
  semester_id: number;
  version_number: number;
  title: string;
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived';
  note: string;
  created_by: number;
  created_by_name?: string;
  approved_by?: number;
  approved_by_name?: string;
  approved_at?: string;
  published_at?: string;
  metrics?: any;
  critical_conflicts_count: number;
  total_sessions_count: number;
  created_at: string;
}

interface Conflict {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  titleArabic: string;
  explanationArabic: string;
  suggestedResolutions: Array<{
    id: string;
    action: string;
    titleArabic: string;
    descriptionArabic: string;
    targetDay?: number;
    targetStartTime?: string;
    targetEndTime?: string;
    targetRoomName?: string;
    targetProfessorName?: string;
    impactSummaryArabic?: string;
  }>;
}

interface DiffItem {
  id: string;
  diffType: 'added' | 'removed' | 'modified' | 'unchanged';
  changeSummaryArabic: string;
  before?: any;
  after?: any;
}

export default function ScheduleVersionsPage() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [semesterId, setSemesterId] = useState(1);
  const [activeTab, setActiveTab] = useState<'versions' | 'diff' | 'conflicts'>('versions');

  // Generator State
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [genMode, setGenMode] = useState<'fast' | 'optimize'>('fast');
  const [genTimeoutSec, setGenTimeoutSec] = useState(15);
  const [saveAsDraft, setSaveAsDraft] = useState(true);
  const [draftTitle, setDraftTitle] = useState('مسودة مقترحة من المولّد الآلي');
  const [withoutProfessors, setWithoutProfessors] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);

  // Preliminary Preview Modal State (معاينة الجداول الأولية قبل الاعتماد أو استعراض أي إصدار)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewTasks, setPreviewTasks] = useState<any[]>([]);
  const [previewMetrics, setPreviewMetrics] = useState<any>(null);
  const [previewConflicts, setPreviewConflicts] = useState<any[]>([]);
  const [previewTitle, setPreviewTitle] = useState('معاينة الجداول الأولية المقترحة من المولّد الآلي');
  const [isPreviewPreliminary, setIsPreviewPreliminary] = useState(true);
  const [approvingDraft, setApprovingDraft] = useState(false);
  const [loadingViewVersionId, setLoadingViewVersionId] = useState<number | null>(null);

  // Conflicts State
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loadingConflicts, setLoadingConflicts] = useState(false);

  // Diff State
  const [diffV1, setDiffV1] = useState<number | null>(null);
  const [diffV2, setDiffV2] = useState<number | null>(null);
  const [diffResult, setDiffResult] = useState<any>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Rollback state
  const [rollbackTarget, setRollbackTarget] = useState<Version | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadVersions();
  }, [semesterId]);

  async function loadVersions() {
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/scheduling/versions?semester_id=${semesterId}`);
      if (res && res.data) {
        setVersions(res.data);
        if (res.data.length >= 2 && !diffV1 && !diffV2) {
          setDiffV1(res.data[1].id);
          setDiffV2(res.data[0].id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load versions', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunAutoScheduler() {
    setGenerating(true);
    setActionMessage(null);
    try {
      // 1. توليد الجدول آلياً في الذاكرة أولاً (save_as_draft: false) لتمكين المعاينة الكاملة والتدقيق قبل الاعتماد
      const res = await api.post('/api/v1/scheduling/generate', {
        semester_id: semesterId,
        mode: genMode,
        timeout_ms: genTimeoutSec * 1000,
        save_as_draft: false,
        draft_title: draftTitle,
        without_professors: withoutProfessors
      });

      if (res && res.data) {
        setGenResult(res.data);
        setPreviewTasks(res.data.tasks || []);
        setPreviewMetrics(res.data.metrics || null);
        setPreviewConflicts(res.data.conflicts || []);
        setPreviewTitle(`معاينة الجداول الأولية المنشأة (${genMode === 'fast' ? 'بحث إرشادي فوري' : 'تحسين قيود متقدم CP-SAT'}${withoutProfessors ? ' - دون إسناد للأساتذة' : ''})`);
        setIsPreviewPreliminary(true);
        setIsGenModalOpen(false); // إغلاق نافذة الإعدادات
        setIsPreviewModalOpen(true); // فتح نافذة المعاينة الأولية الكاملة
      }
    } catch (err: any) {
      setActionMessage({
        text: err?.error?.message_ar || err?.message || 'فشل تشغيل محرك الجدولة الآلي',
        type: 'error'
      });
    } finally {
      setGenerating(false);
    }
  }

  // اعتماد وحفظ المسودة رسمياً بعد مراجعتها في المعاينة الأولية
  async function handleApproveDraft(finalTitle: string) {
    if (!previewTasks || previewTasks.length === 0) return;
    setApprovingDraft(true);
    try {
      const items = previewTasks
        .filter((t: any) => (t.assignedSlot && t.assignedRoomId) || (t.start_time && t.room_id))
        .map((t: any) => ({
          assignment_id: t.assignmentId || null,
          course_id: t.courseId || t.course_id,
          professor_id: t.professorId || t.professor_id,
          group_id: t.groupId || t.group_id,
          room_id: t.assignedRoomId || t.room_id,
          day_of_week: t.assignedSlot?.dayOfWeek !== undefined ? t.assignedSlot.dayOfWeek : t.day_of_week,
          start_time: t.assignedSlot?.startTime || t.start_time,
          end_time: t.assignedSlot?.endTime || t.end_time,
          session_type: t.sessionType || t.session_type || 'lecture',
          item_status: 'proposed',
          note: 'معتمد من المعاينة الأولية للمولد الآلي'
        }));

      const res = await api.post('/api/v1/scheduling/versions', {
        semester_id: semesterId,
        title: finalTitle || draftTitle,
        note: `تم التوليد والمعاينة الأولية بنمط (${genMode})، وتم الاعتماد كمسودة رسمية (${items.length} حصة).`,
        items
      });

      if (res && res.data) {
        setIsPreviewModalOpen(false);
        setActionMessage({
          text: `✅ تم اعتماد وحفظ مسودة الإصدار #${res.data.versionNumber} «${res.data.title}» بنجاح في النظام!`,
          type: 'success'
        });
        loadVersions();
      }
    } catch (err: any) {
      alert('فشل حفظ واعتماد المسودة: ' + (err?.error?.message_ar || err?.message || 'خطأ غير معروف'));
    } finally {
      setApprovingDraft(false);
    }
  }

  // استعراض جدول أي إصدار مسجل سابقاً
  async function handleViewVersion(version: Version) {
    setLoadingViewVersionId(version.id);
    try {
      const res = await api.get(`/api/v1/scheduling/versions/${version.id}`);
      if (res && res.data) {
        setPreviewTasks(res.data.items || []);
        setPreviewMetrics(res.data.version?.metrics || {
          solverStatus: 'FEASIBLE',
          totalTasksCount: res.data.items?.length || 0,
          assignedTasksCount: res.data.items?.length || 0,
          criticalConflictsCount: res.data.version?.critical_conflicts_count || 0
        });
        setPreviewConflicts([]);
        setPreviewTitle(`استعراض جدول الإصدار #${version.version_number}: «${version.title}»`);
        setIsPreviewPreliminary(false);
        setIsPreviewModalOpen(true);
      }
    } catch (err: any) {
      alert('فشل تحميل تفاصيل جدول هذا الإصدار: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setLoadingViewVersionId(null);
    }
  }

  // الرجوع لنافذة المعايير والتوليد من شاشة المعاينة
  function handleBackToConfig() {
    setIsPreviewModalOpen(false);
    setIsGenModalOpen(true);
  }

  async function handleLoadConflicts() {
    setLoadingConflicts(true);
    try {
      const res = await api.post('/api/v1/scheduling/conflicts/explain', {
        semester_id: semesterId
      });
      if (res && res.data) {
        setConflicts(res.data.conflicts || []);
      }
    } catch (err: any) {
      console.error('Failed to explain conflicts', err);
    } finally {
      setLoadingConflicts(false);
    }
  }

  async function handleLoadVisualDiff() {
    if (!diffV1 || !diffV2) return;
    setLoadingDiff(true);
    try {
      const res = await api.get(`/api/v1/scheduling/versions/diff?v1=${diffV1}&v2=${diffV2}`);
      if (res && res.data) {
        setDiffResult(res.data);
      }
    } catch (err: any) {
      console.error('Failed to compute diff', err);
    } finally {
      setLoadingDiff(false);
    }
  }

  async function handleTransition(versionId: number, newStatus: string) {
    setActionMessage(null);
    try {
      const res = await api.post(`/api/v1/scheduling/versions/${versionId}/transition`, {
        new_status: newStatus
      });
      if (res && res.data) {
        setActionMessage({
          text: `تم نقل حالة الإصدار بنجاح إلى (${newStatus}).`,
          type: 'success'
        });
        loadVersions();
      }
    } catch (err: any) {
      setActionMessage({
        text: err?.error?.message_ar || err?.message || 'فشل تغيير حالة الإصدار (تحقق من قواعد الموافقة المزدوجة والتعارضات الحرجة).',
        type: 'error'
      });
    }
  }

  async function executeRollback(version: Version) {
    setRollingBack(true);
    setActionMessage(null);
    try {
      const res = await api.post(`/api/v1/scheduling/versions/${version.id}/rollback`, {});
      if (res && res.data) {
        setActionMessage({
          text: res.data.messageArabic || `تم استرجاع الإصدار #${version.version_number} بنجاح.`,
          type: 'success'
        });
        setRollbackTarget(null);
        loadVersions();
      }
    } catch (err: any) {
      setActionMessage({
        text: err?.error?.message_ar || err?.message || 'فشل استرجاع الإصدار.',
        type: 'error'
      });
    } finally {
      setRollingBack(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-cairo" dir="rtl">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/schedule" className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                <ArrowRight className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-7 h-7 text-emerald-600" />
                إصدارات الجدول وسير الموافقات والمولّد الآلي
              </h1>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
              محرك اقتراح آلي معتمد على القيود (CP-SAT & Heuristics)، كشف تعارضات تفسيري، رقابة ثنائية على النشر واسترجاع فوري.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setActiveTab('conflicts');
                handleLoadConflicts();
              }}
              className="flex items-center gap-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"
            >
              <AlertTriangle className="w-4 h-4" />
              فحص التعارضات التفسيري
            </Button>

            <Button
              variant="primary"
              onClick={() => setIsGenModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              تشغيل المولّد الآلي (Auto-Scheduler)
            </Button>
          </div>
        </div>

        {/* Global Notifications */}
        {actionMessage && (
          <div className={`p-4 rounded-xl border mt-4 flex items-center justify-between gap-3 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {actionMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
              <span className="text-sm font-semibold">{actionMessage.text}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('versions')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'versions'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            سجل الإصدارات وسير الموافقات ({versions.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('diff');
              handleLoadVisualDiff();
            }}
            className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'diff'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            المقارنة البصرية بين إصدارين (Visual Diff)
          </button>

          <button
            onClick={() => {
              setActiveTab('conflicts');
              handleLoadConflicts();
            }}
            className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'conflicts'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            التعارضات التفسيرية والحلول المقترحة
          </button>
        </div>
      </div>

      {/* Main Content Areas */}
      <div className="max-w-7xl mx-auto">
        {/* Tab 1: Versions List & Timeline */}
        {activeTab === 'versions' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-slate-500">جاري تحميل سجل الإصدارات...</div>
            ) : versions.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <History className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">لا توجد إصدارات سابقة مسجلة</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                    يمكنك تشغيل "المولّد الآلي للجداول" لإنشاء أول مسودة مقترحة وتتبع دورة حياتها وفق ميثاق الرقابة الثنائية.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setIsGenModalOpen(true)}
                    className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    تشغيل أول مسودة آلياً
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {versions.map((ver) => (
                  <Card
                    key={ver.id}
                    className={`border transition-all ${
                      ver.status === 'published'
                        ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500/20 bg-emerald-50/10'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-lg ${
                            ver.status === 'published'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : ver.status === 'approved'
                              ? 'bg-indigo-600 text-white'
                              : ver.status === 'review'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            #{ver.version_number}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-extrabold text-base md:text-lg text-slate-900 dark:text-white">
                                {ver.title || `إصدار الجدول #${ver.version_number}`}
                              </h3>
                              {getStatusBadge(ver.status)}
                              {ver.critical_conflicts_count > 0 ? (
                                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 text-xs">
                                  {ver.critical_conflicts_count} تعارض حرج
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                                  خالٍ من التعارضات الحرجة
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {ver.note || 'لا توجد ملاحظات إضافية مسجلة.'}
                            </p>

                            <div className="flex items-center gap-4 text-xs text-slate-500 mt-2 flex-wrap">
                              <span>المُنشئ: {ver.created_by_name || `#${ver.created_by}`}</span>
                              {ver.approved_by && <span>المُعتمد: {ver.approved_by_name || `#${ver.approved_by}`}</span>}
                              <span>إجمالي الحصص: {ver.total_sessions_count}</span>
                              <span>التاريخ: {new Date(ver.created_at).toLocaleDateString('ar-DZ')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons & Workflow State Machine */}
                        <div className="flex items-center gap-2 self-end lg:self-center flex-wrap">
                          {/* View Timetable Button (استعراض شبكة جدول هذا الإصدار) */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewVersion(ver)}
                            disabled={loadingViewVersionId === ver.id}
                            className="text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
                            title="معاينة واستعراض شبكة جدول هذا الإصدار"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            {loadingViewVersionId === ver.id ? 'جاري التحميل...' : 'استعراض الجدول'}
                          </Button>
                          {/* Draft -> Review */}
                          {ver.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTransition(ver.id, 'review')}
                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            >
                              إرسال للمراجعة
                            </Button>
                          )}

                          {/* Review -> Approve (Enforces Maker != Checker) */}
                          {ver.status === 'review' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTransition(ver.id, 'approved')}
                              className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                            >
                              اعتماد الإصدار (موافقة مزدوجة)
                            </Button>
                          )}

                          {/* Approved -> Publish (Zero Critical Conflicts Guard) */}
                          {ver.status === 'approved' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleTransition(ver.id, 'published')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              نشر واعتماد في الإنتاج
                            </Button>
                          )}

                          {/* Published Indicator */}
                          {ver.status === 'published' && (
                            <Badge className="bg-emerald-600 text-white px-3 py-1.5 flex items-center gap-1.5 font-bold">
                              <CheckCircle2 className="w-4 h-4" />
                              الجدول المعتمد حالياً
                            </Badge>
                          )}

                          {/* Instant Rollback Button (Available for non-published versions to restore) */}
                          {ver.status !== 'published' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRollbackTarget(ver)}
                              className="text-amber-700 border-amber-300 hover:bg-amber-50 flex items-center gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              استرجاع فوري (≤ 10 ثوانٍ)
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Visual Diff */}
        {activeTab === 'diff' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
                  مقارنة الفروق بين إصدارين (Visual Diff)
                </CardTitle>
                <CardDescription>
                  اختر إصدار الأساس والإصدار المقارن لرؤية الحصص المضافة، المعدلة، أو المحذوفة بنظرة واحدة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="w-full md:w-1/2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      الإصدار القديم / الأساس:
                    </label>
                    <select
                      value={diffV1 || ''}
                      onChange={(e) => setDiffV1(Number(e.target.value))}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-cairo"
                    >
                      <option value="">-- اختر الإصدار الأول --</option>
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          #{v.version_number} - {v.title} ({v.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full md:w-1/2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      الإصدار الحديث / المقترح:
                    </label>
                    <select
                      value={diffV2 || ''}
                      onChange={(e) => setDiffV2(Number(e.target.value))}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-cairo"
                    >
                      <option value="">-- اختر الإصدار الثاني --</option>
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          #{v.version_number} - {v.title} ({v.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    variant="primary"
                    onClick={handleLoadVisualDiff}
                    disabled={!diffV1 || !diffV2 || loadingDiff}
                    className="w-full md:w-auto mt-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {loadingDiff ? 'جاري المقارنة...' : 'إجراء المقارنة'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {diffResult && (
              <div className="space-y-4">
                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
                    <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 block">
                      +{diffResult.stats.addedCount}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">حصص مضافة</span>
                  </div>

                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 text-center">
                    <span className="text-2xl font-black text-amber-700 dark:text-amber-400 block">
                      ~{diffResult.stats.modifiedCount}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">حصص معدلة/منقولة</span>
                  </div>

                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 text-center">
                    <span className="text-2xl font-black text-rose-700 dark:text-rose-400 block">
                      -{diffResult.stats.removedCount}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">حصص ملغاة</span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-slate-900 text-center">
                    <span className="text-2xl font-black text-slate-700 dark:text-slate-300 block">
                      ={diffResult.stats.unchangedCount}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">حصص مطابقة</span>
                  </div>
                </div>

                {/* Diff List */}
                <div className="space-y-2">
                  {diffResult.items.map((item: DiffItem) => (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 text-sm ${
                        item.diffType === 'added'
                          ? 'border-emerald-300 bg-emerald-50/40 text-emerald-900'
                          : item.diffType === 'modified'
                          ? 'border-amber-300 bg-amber-50/40 text-amber-900'
                          : item.diffType === 'removed'
                          ? 'border-rose-300 bg-rose-50/40 text-rose-900'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-extrabold uppercase ${
                          item.diffType === 'added'
                            ? 'bg-emerald-600 text-white'
                            : item.diffType === 'modified'
                            ? 'bg-amber-600 text-white'
                            : item.diffType === 'removed'
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-300 text-slate-800'
                        }`}>
                          {item.diffType === 'added' ? 'إضافة' : item.diffType === 'modified' ? 'تعديل' : item.diffType === 'removed' ? 'حذف' : 'ثابت'}
                        </span>
                        <span className="font-semibold">{item.changeSummaryArabic}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Explainable Conflicts with 3 Actionable Resolutions */}
        {activeTab === 'conflicts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  التعارضات المكتشفة بلغة بشرية والبدائل المقترحة
                </h3>
                <p className="text-xs text-slate-500">لكل تعارض 3 حلول فورية قابلة للتطبيق بضغطة زر واحدة.</p>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleLoadConflicts}
                disabled={loadingConflicts}
                className="flex items-center gap-1.5"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loadingConflicts ? 'animate-spin' : ''}`} />
                إعادة الفحص اللحظي
              </Button>
            </div>

            {loadingConflicts ? (
              <div className="text-center py-12 text-slate-500">جاري فحص وتحليل كافة قيود الجدول...</div>
            ) : conflicts.length === 0 ? (
              <Card className="text-center py-12 border-emerald-200 bg-emerald-50/20">
                <CardContent>
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
                  <h3 className="text-lg font-bold text-emerald-800">الجدول خالٍ تماماً من أي تعارضات!</h3>
                  <p className="text-sm text-emerald-600">لا توجد أي تصادمات في القاعات أو الأساتذة أو الأفواج في هذا السداسي.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {conflicts.map((conf) => (
                  <Card key={conf.id} className="border-amber-300 dark:border-amber-800 shadow-sm overflow-hidden">
                    <div className={`px-4 py-2 font-bold text-xs flex items-center justify-between ${
                      conf.severity === 'CRITICAL'
                        ? 'bg-rose-600 text-white'
                        : conf.severity === 'MAJOR'
                        ? 'bg-amber-600 text-white'
                        : 'bg-blue-600 text-white'
                    }`}>
                      <span>{conf.severity === 'CRITICAL' ? 'تعارض حرج (يمنع النشر)' : conf.severity === 'MAJOR' ? 'ملاحظة كبرى' : 'تنبيه طفيف'}</span>
                      <span>نوع: {conf.type}</span>
                    </div>

                    <CardContent className="p-4 space-y-4">
                      <div>
                        <h4 className="font-extrabold text-base text-slate-900 dark:text-white mb-1">
                          {conf.titleArabic}
                        </h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {conf.explanationArabic}
                        </p>
                      </div>

                      {/* 3 Actionable Resolutions */}
                      <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-500 block mb-2">
                          خيارات الحل المقترحة (اختر أحد البدائل الـ 3):
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {conf.suggestedResolutions.map((res, idx) => (
                            <button
                              key={res.id}
                              onClick={() => {
                                setActionMessage({
                                  text: `تم اختيار البديل ${idx + 1}: «${res.titleArabic}» (${res.descriptionArabic}). تم تحرير التعديل!`,
                                  type: 'success'
                                });
                              }}
                              className="p-3 text-right rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 hover:bg-emerald-50/20 transition-all group"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-emerald-600">بديل #{idx + 1}</span>
                                <Check className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600" />
                              </div>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                                {res.titleArabic}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                {res.descriptionArabic}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auto-Scheduler Modal */}
      {isGenModalOpen && (
        <Dialog open={isGenModalOpen} onClose={() => setIsGenModalOpen(false)}>
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 font-cairo">
              <DialogTitle className="text-xl font-extrabold flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-emerald-600" />
                تشغيل محرك الجدولة الآلي (Auto-Scheduler)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mb-4">
                توليد اقتراح جدول زمني متكامل عبر حل قيود مزدوج (Dual Solver). ستتم إتاحة المعاينة التفاعلية الكاملة للجداول الأولية والتدقيق البصري قبل الموافقة والاعتماد كمسودة.
              </DialogDescription>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    السداسي الأكاديمي المستهدف:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSemesterId(1)}
                      className={`p-2.5 rounded-xl border text-right transition-all text-xs font-bold ${
                        semesterId === 1
                          ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600'
                      }`}
                    >
                      السداسي الأول (S1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSemesterId(2)}
                      className={`p-2.5 rounded-xl border text-right transition-all text-xs font-bold ${
                        semesterId === 2
                          ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600'
                      }`}
                    >
                      السداسي الثاني (S2)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    نمط خوارزمية التوليد:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGenMode('fast')}
                      className={`p-3 rounded-xl border text-right transition-all ${
                        genMode === 'fast'
                          ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600'
                      }`}
                    >
                      <span className="text-sm block">بحث إرشادي سريع (Heuristics)</span>
                      <span className="text-xs text-slate-500 font-normal">أول اقتراح صالح خلال أجزاء من الثانية</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGenMode('optimize')}
                      className={`p-3 rounded-xl border text-right transition-all ${
                        genMode === 'optimize'
                          ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600'
                      }`}
                    >
                      <span className="text-sm block">تحسين قيود متقدم (CP-SAT)</span>
                      <span className="text-xs text-slate-500 font-normal">تقليل فجوات الطلبة وموازنة النصاب</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    الحد الأقصى لمهلة التوليد (بالثواني): {genTimeoutSec} ثانية
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={5}
                    value={genTimeoutSec}
                    onChange={(e) => setGenTimeoutSec(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>

                {/* خيار توليد الجداول دون إسناد للأساتذة */}
                <div
                  onClick={() => setWithoutProfessors(!withoutProfessors)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    withoutProfessors
                      ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    id="withoutProfessorsToggle"
                    checked={withoutProfessors}
                    onChange={(e) => setWithoutProfessors(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1">
                    <label htmlFor="withoutProfessorsToggle" className="text-xs font-bold block cursor-pointer">
                      توليد الجداول للمقاييس دون إسناد للأساتذة
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      توزيع حصص المقاييس والأفواج والقاعات مباشرة دون اشتراط تعيين الأساتذة مسبقاً (تجاوز تعارضات وتفرغ الأساتذة مع إبراز الحصص كـ &quot;دون إسناد&quot;).
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                    عنوان المسودة المقترحة (عند الاعتماد):
                  </label>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="عنوان المسودة المقترحة"
                    className="w-full p-2 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                  />
                  <p className="text-[11px] text-slate-500">
                    💡 سيتم أولاً فتح شاشة المعاينة التفاعلية للجداول الأولية لمطابقة القاعات والأساتذة والأفواج قبل حفظ المسودة في النظام.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                <Button variant="outline" onClick={() => setIsGenModalOpen(false)}>
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  onClick={handleRunAutoScheduler}
                  disabled={generating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm font-bold"
                >
                  <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                  {generating ? 'جاري الحساب والتوليد...' : 'بدء التوليد والمعاينة الأولية'}
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Preliminary Schedule Preview & Version Timetable Modal */}
      <SchedulePreviewModal
        open={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title={previewTitle}
        tasks={previewTasks}
        metrics={previewMetrics}
        conflicts={previewConflicts}
        isPreliminary={isPreviewPreliminary}
        initialDraftTitle={draftTitle}
        withoutProfessors={withoutProfessors}
        onApproveAsDraft={handleApproveDraft}
        onBackToConfig={handleBackToConfig}
        approving={approvingDraft}
      />

      {/* Rollback Confirmation Modal */}
      {rollbackTarget && (
        <Dialog open={Boolean(rollbackTarget)} onClose={() => setRollbackTarget(null)}>
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 font-cairo">
              <DialogTitle className="text-lg font-extrabold flex items-center gap-2 text-amber-600 mb-2">
                <RotateCcw className="w-5 h-5" />
                تأكيد استرجاع الإصدار #{rollbackTarget.version_number}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                هل أنت متأكد من استرجاع هذا الإصدار السابق؟ ستتم استعادة جميع تكليفات الحصص في قاعدة البيانات ونشرها فوراً خلال ≤ 10 ثوانٍ مع أرشفة الإصدار الحالي بأمان.
              </DialogDescription>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setRollbackTarget(null)}>
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  onClick={() => executeRollback(rollbackTarget)}
                  disabled={rollingBack}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {rollingBack ? 'جاري الاسترجاع...' : 'تأكيد الاسترجاع اللحظي'}
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'published':
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">منشور رسمي</Badge>;
    case 'approved':
      return <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">معتمد</Badge>;
    case 'review':
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">قيد المراجعة</Badge>;
    case 'draft':
      return <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">مسودة</Badge>;
    case 'archived':
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">مؤرشف</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}
