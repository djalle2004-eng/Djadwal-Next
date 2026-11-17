'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  Check,
  UserPlus,
  Edit3,
  HelpCircle,
  AlertCircle,
  FileText
} from 'lucide-react';
import {
  Button,
  Badge,
  Dialog,
  DialogTitle,
  DialogDescription,
} from '@djadwal/ui';
import {
  OfficialAcademicRank,
  normalizeAcademicRank,
  getRankDefinition,
} from '@djadwal/core/constants/professor-ranks';
import {
  buildProfessorsTemplateWorkbook,
  DryRunResult,
  AnalyzedProfessorRow
} from '@djadwal/core/excel/professor-excel';
import { api, ApiError } from '@/lib/api';

interface ImportProfessorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (summaryMessage: string) => void;
}

export default function ImportProfessorsModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportProfessorsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dryRunData, setDryRunData] = useState<DryRunResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'create' | 'update' | 'unchanged' | 'error'>('all');
  const [skipErrors, setSkipErrors] = useState(true);
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset state when closing or opening
  const handleReset = () => {
    setFile(null);
    setParsing(false);
    setSubmitting(false);
    setDryRunData(null);
    setActiveFilter('all');
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleModalClose = () => {
    handleReset();
    onClose();
  };

  // Download Blank Template
  const handleDownloadTemplate = () => {
    const wb = buildProfessorsTemplateWorkbook();
    XLSX.writeFile(wb, 'نموذج-استيراد-الأساتذة-Djadwal.xlsx');
  };

  // Handle File Selection and Parsing
  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setParsing(true);
    setErrorMessage(null);
    setDryRunData(null);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('الملف لا يحتوي على أي صفحات بيانات صالحة.');
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet);

      if (!rawRows || rawRows.length === 0) {
        throw new Error('ورقة العمل المحددة فارغة تماماً.');
      }

      // Call Preview Dry-Run API
      const res = await api.previewProfessorsImport(rawRows);
      if (res && res.summary) {
        setDryRunData(res);
      } else {
        throw new Error('فشل استلام نتيجة المعاينة من الخادم.');
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء قراءة أو تحليل ملف Excel.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Commit Import
  const handleCommitImport = async () => {
    if (!dryRunData || dryRunData.rows.length === 0) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      // Sanitize payload: only send actionable rows and strip UI/diff metadata to prevent large request payloads
      const actionableRows = dryRunData.rows
        .filter((r) => r.action === 'create' || r.action === 'update')
        .map((r) => ({
          id: r.id ? Number(r.id) : undefined,
          name: r.name,
          email: r.email || undefined,
          phone: r.phone || undefined,
          academic_rank: r.academic_rank,
          is_temporary: r.is_temporary,
          specialization: r.specialization || undefined,
          department: r.department || undefined,
          action: r.action,
        }));

      if (actionableRows.length === 0) {
        throw new Error('لا توجد أي تغييرات أو أساتذة جدد للاستيراد (كافة السجلات متطابقة أو تحتوي على أخطاء).');
      }

      const idempotencyKey = `prof-import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const res = await api.commitProfessorsImport(
        {
          rows: actionableRows,
          skipErrors,
          academicYear,
        },
        idempotencyKey
      );

      const msg = res.message_ar || `تم بنجاح استيراد ${res.createdCount || 0} أستاذ جديد وتحديث ${res.updatedCount || 0}.`;
      handleModalClose();
      onSuccess(msg);
    } catch (err: any) {
      console.error('Import commit error:', err);
      setErrorMessage(err.message || 'فشل اعتماد استيراد بيانات الأساتذة.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Rows for display
  const filteredRows = React.useMemo(() => {
    if (!dryRunData) return [];
    if (activeFilter === 'all') return dryRunData.rows;
    return dryRunData.rows.filter((r) => r.action === activeFilter);
  }, [dryRunData, activeFilter]);

  if (!isOpen) return null;

  const summary = dryRunData?.summary;
  const executableCount = (summary?.toCreate || 0) + (summary?.toUpdate || 0);
  const hasErrors = (summary?.errors || 0) > 0;
  const canSubmit = executableCount > 0 && (!hasErrors || skipErrors);

  return (
    <Dialog open={isOpen} onClose={handleModalClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-800 border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">
                  استيراد وتحديث قائمة الأساتذة عبر ملف Excel
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  ارفع ملف .xlsx أو .xls لمعاينة التغييرات والتحقق من صحة الرتب قبل اعتماد الحفظ الذري
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={handleModalClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Top Bar: Template Download & Guidelines */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">ملاحظة تنظيمية: </span>
                  يدعم النظام التعرّف التلقائي على الرتب الأكاديمية الست المعتمدة، كما يطابق الأساتذة الحاليين بالمعرّف أو البريد الإلكتروني.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Download className="w-4 h-4" />
                تحميل نموذج Excel فارغ
              </Button>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">تنبيه أثناء المعالجة:</div>
                  <div className="text-xs mt-0.5">{errorMessage}</div>
                </div>
              </div>
            )}

            {/* Step 1: File Dropzone (If no file or user wants to re-upload) */}
            {!dryRunData && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  parsing
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/10'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100/80 text-emerald-700 flex items-center justify-center shadow-inner">
                    {parsing ? (
                      <RefreshCw className="w-7 h-7 animate-spin" />
                    ) : (
                      <UploadCloud className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-800">
                      {parsing ? 'جارٍ قراءة الملف وتحليل السجلات...' : 'اسحب وأفلت ملف الأساتذة هنا، أو انقر للاختيار'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      يدعم ملفات Microsoft Excel (.xlsx, .xls) المنبثقة من جداول الكلية
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Dry-Run Preview Dashboard */}
            {dryRunData && summary && (
              <div className="space-y-5">
                {/* File info bar */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/80 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2 font-medium text-slate-700">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>الملف: {file?.name}</span>
                    <span className="text-slate-400">({(file?.size ? file.size / 1024 : 0).toFixed(1)} ك.ب)</span>
                  </div>
                  <button
                    onClick={() => {
                      setDryRunData(null);
                      setFile(null);
                    }}
                    className="text-xs text-emerald-700 hover:underline font-medium"
                  >
                    تغيير الملف
                  </button>
                </div>

                {/* KPI Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      activeFilter === 'all'
                        ? 'border-slate-800 bg-slate-900 text-white shadow-md'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xl font-bold">{summary.total}</div>
                    <div className="text-xs font-medium mt-0.5">إجمالي السجلات</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter('create')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      activeFilter === 'create'
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-md'
                        : 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-800'
                    }`}
                  >
                    <div className="text-xl font-bold flex items-center justify-center gap-1">
                      <UserPlus className="w-4 h-4" />
                      {summary.toCreate}
                    </div>
                    <div className="text-xs font-medium mt-0.5">أساتذة جدد</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter('update')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      activeFilter === 'update'
                        ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                        : 'border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-blue-800'
                    }`}
                  >
                    <div className="text-xl font-bold flex items-center justify-center gap-1">
                      <Edit3 className="w-4 h-4" />
                      {summary.toUpdate}
                    </div>
                    <div className="text-xs font-medium mt-0.5">تحديث بيانات</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter('unchanged')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      activeFilter === 'unchanged'
                        ? 'border-slate-600 bg-slate-700 text-white shadow-md'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <div className="text-xl font-bold">{summary.unchanged}</div>
                    <div className="text-xs font-medium mt-0.5">بلا تغيير</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter('error')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      activeFilter === 'error'
                        ? 'border-rose-600 bg-rose-600 text-white shadow-md'
                        : summary.errors > 0
                        ? 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800'
                        : 'border-slate-200 bg-slate-50 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="text-xl font-bold flex items-center justify-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      {summary.errors}
                    </div>
                    <div className="text-xs font-medium mt-0.5">أخطاء التنسيق</div>
                  </button>
                </div>

                {/* Season selection & Options */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                      الموسم الجامعي للتثبيت:
                    </label>
                    <select
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="2026-2027">2026-2027 (الموسم الحالي)</option>
                      <option value="2025-2026">2025-2026</option>
                      <option value="2024-2025">2024-2025</option>
                    </select>
                  </div>

                  {summary.errors > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-rose-800 bg-rose-100/60 px-3 py-1.5 rounded-lg border border-rose-200">
                      <input
                        type="checkbox"
                        checked={skipErrors}
                        onChange={(e) => setSkipErrors(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <span>تجاوز الصفوف التي بها أخطاء واستيراد السجلات الصالحة فقط ({executableCount} أستاذ)</span>
                    </label>
                  )}
                </div>

                {/* Preview Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200 z-10">
                        <tr>
                          <th className="p-3 w-12 text-center">#</th>
                          <th className="p-3 w-24">الإجراء</th>
                          <th className="p-3">الاسم واللقب</th>
                          <th className="p-3">البريد المهني</th>
                          <th className="p-3">الرتبة الأكاديمية</th>
                          <th className="p-3">الصفة</th>
                          <th className="p-3">التفاصيل والتغييرات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400">
                              لا توجد سجلات تطابق الفلتر المختار ({activeFilter}).
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((row) => {
                            const rankDef = getRankDefinition(row.academic_rank);
                            return (
                              <tr
                                key={row.rawIndex}
                                className={`transition-colors ${
                                  row.action === 'error'
                                    ? 'bg-rose-50/60 hover:bg-rose-50'
                                    : row.action === 'create'
                                    ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                                    : row.action === 'update'
                                    ? 'bg-blue-50/30 hover:bg-blue-50/60'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="p-3 text-center text-slate-400 font-mono">
                                  {row.rawIndex}
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  {row.action === 'create' && (
                                    <Badge variant="success" className="gap-1 text-[11px] py-0.5">
                                      <UserPlus className="w-3 h-3" />
                                      إضافة
                                    </Badge>
                                  )}
                                  {row.action === 'update' && (
                                    <Badge variant="info" className="gap-1 text-[11px] py-0.5">
                                      <Edit3 className="w-3 h-3" />
                                      تعديل
                                    </Badge>
                                  )}
                                  {row.action === 'unchanged' && (
                                    <Badge variant="outline" className="text-slate-500 text-[11px] py-0.5">
                                      متطابق
                                    </Badge>
                                  )}
                                  {row.action === 'error' && (
                                    <Badge variant="danger" className="gap-1 text-[11px] py-0.5">
                                      <AlertTriangle className="w-3 h-3" />
                                      خطأ
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-3 font-semibold text-slate-900">
                                  {row.name || <span className="text-rose-500 italic">مفقود</span>}
                                </td>
                                <td className="p-3 text-slate-600 font-mono text-[11px]">
                                  {row.email || '—'}
                                </td>
                                <td className="p-3">
                                  <span className="font-medium text-slate-800">
                                    {row.rank_label_arabic}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {row.is_temporary ? (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                      مؤقت
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                      دائم
                                    </span>
                                  )}
                                </td>
                                <td className="p-3">
                                  {row.action === 'error' && (
                                    <span className="text-rose-600 font-medium">
                                      {row.errorMessageAr}
                                    </span>
                                  )}
                                  {row.action === 'create' && (
                                    <span className="text-emerald-700 font-medium">
                                      أستاذ جديد سيُضاف إلى قاعدة البيانات
                                    </span>
                                  )}
                                  {row.action === 'update' && row.changes && (
                                    <div className="space-y-1">
                                      {row.changes.map((c, i) => (
                                        <div key={i} className="text-[11px] text-blue-900">
                                          <span className="font-semibold">{c.fieldLabelAr}: </span>
                                          <span className="line-through text-slate-400">{c.oldValue || 'فارغ'}</span>
                                          {' ➔ '}
                                          <span className="font-bold text-blue-700">{c.newValue}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {row.action === 'unchanged' && (
                                    <span className="text-slate-400">لا توجد أي تغييرات على البيانات</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleModalClose}
              disabled={submitting}
            >
              إلغاء
            </Button>

            {dryRunData && (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleCommitImport}
                  disabled={!canSubmit || submitting}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white min-w-[160px]"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جارٍ التثبيت الذري...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      تأكيد واستيراد ({executableCount}) أستاذ
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
