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
  PlusCircle,
  Edit3,
  HelpCircle,
  AlertCircle,
  Layers,
  BookOpen,
} from 'lucide-react';
import {
  Button,
  Badge,
  Dialog,
  DialogTitle,
  DialogDescription,
} from '@djadwal/ui';
import {
  buildCoursesTemplateWorkbook,
  DryRunCourseResult,
  AnalyzedCourseRow,
} from '@djadwal/core/excel/course-curriculum-excel';
import { api, ApiError } from '@/lib/api';

interface ImportCoursesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (summaryMessage: string) => void;
}

export default function ImportCoursesModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportCoursesModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dryRunData, setDryRunData] = useState<DryRunCourseResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'create' | 'update' | 'unchanged' | 'error'>('all');
  const [skipErrors, setSkipErrors] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleDownloadTemplate = () => {
    try {
      const wb = buildCoursesTemplateWorkbook();
      XLSX.writeFile(wb, 'courses-curriculum-template.xlsx');
    } catch {
      window.open('/api/v1/courses/template', '_blank');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setErrorMessage('صيغة الملف غير مدعومة. يرجى اختيار ملف بتنسيق Excel (.xlsx, .xls) أو CSV.');
      return;
    }

    setFile(selectedFile);
    setErrorMessage(null);
    setParsing(true);

    try {
      const dataBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('الملف المرفوع فارغ ولا يحتوي على أي ورقة عمل.');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (rawRows.length === 0) {
        throw new Error('لم يتم العثور على أي صفوف أو بيانات صالحة داخل الملف.');
      }

      const dryRunRes = await api.post('/catalog/courses/import/preview', { rows: rawRows });
      setDryRunData(dryRunRes);
    } catch (err: any) {
      console.error('Failed to parse or dry-run courses Excel file:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء معالجة وقراءة ملف Excel.');
      setDryRunData(null);
    } finally {
      setParsing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!dryRunData || !dryRunData.rows || dryRunData.rows.length === 0) return;

    const hasErrors = dryRunData.summary.errors > 0;
    if (hasErrors && !skipErrors) {
      setErrorMessage('يحتوي الملف على أخطاء يجب تصحيحها أو تفعيل خيار "تخطي الصفوف التي بها أخطاء".');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const commitRes = await api.post('/catalog/courses/import', {
        rows: dryRunData.rows,
        skipErrors,
      });

      const message =
        commitRes.message_ar ||
        `تم استيراد دليل المقاييس بنجاح: تم إنشاء ${commitRes.stats?.createdCount ?? 0} مقياس جديد، وتحديث ${commitRes.stats?.updatedCount ?? 0} مقياس.`;

      onSuccess(message);
      handleModalClose();
    } catch (err: any) {
      console.error('Failed to commit courses import:', err);
      setErrorMessage(err.message || 'فشل اعتماد استيراد المقاييس.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRows = (dryRunData?.rows || []).filter((row) => {
    if (activeFilter === 'all') return true;
    return row.action === activeFilter;
  });

  return (
    <Dialog open={isOpen} onClose={handleModalClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-right">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-indigo-50/50 via-white to-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  استيراد دليل المقاييس عبر Excel (P16)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  تحميل شامل لمقاييس السداسيات والتخصصات مع فحص تعارضات المعاملات والأرصدة قبل الحفظ
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleModalClose}
              className="rounded-lg h-9 w-9 p-0 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Modal Content Scroll Area */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Template Download & Upload Area */}
            {!dryRunData && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-amber-50/60 border border-amber-200/60 rounded-xl">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div className="text-sm text-amber-900 leading-relaxed">
                      هل تود ملء نموذج معتمد متوافق مع نظام LMD الجزائري؟ حمل النموذج الفارغ واملأه ثم ارفعه هنا.
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                    className="border-amber-300 text-amber-900 hover:bg-amber-100/80 gap-2 shrink-0 bg-white"
                  >
                    <Download className="w-4 h-4" />
                    تحميل النموذج المعتمد
                  </Button>
                </div>

                {/* Drag and drop dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                    parsing
                      ? 'border-indigo-400 bg-indigo-50/40'
                      : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={parsing}
                  />

                  {parsing ? (
                    <div className="flex flex-col items-center gap-3 text-indigo-600">
                      <RefreshCw className="w-10 h-10 animate-spin" />
                      <p className="font-semibold text-slate-700">جارٍ قراءة الملف ومطابقة دليل المقاييس...</p>
                      <p className="text-xs text-slate-500">جاري مقارنة المقاييس والأرصدة والمعاملات والسداسيات</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <UploadCloud className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-slate-800 text-base">
                          اضغط لاختيار ملف Excel أو اسحبه وأفلته هنا
                        </p>
                        <p className="text-xs text-slate-400 mt-1">يدعم ملفات (.xlsx, .xls, .csv)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 animate-in fade-in duration-150">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Dry Run Analysis Dashboard */}
            {dryRunData && (
              <div className="space-y-5">
                {/* File info and change file button */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{file?.name || 'ملف Excel'}</p>
                      <p className="text-xs text-slate-500">
                        تم فحص {dryRunData.summary.total} مقياس | تاريخ المعاينة: {new Date().toLocaleTimeString('ar-DZ')}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="text-slate-600 hover:text-slate-900 text-xs gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    اختيار ملف آخر
                  </Button>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`p-3 rounded-xl border text-right transition-all ${
                      activeFilter === 'all'
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs text-slate-500">إجمالي المقاييس</div>
                    <div className="text-xl font-bold text-slate-800 mt-1">{dryRunData.summary.total}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter('create')}
                    className={`p-3 rounded-xl border text-right transition-all ${
                      activeFilter === 'create'
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-600/20'
                        : 'border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/50'
                    }`}
                  >
                    <div className="text-xs text-emerald-700 font-medium">مقاييس جديدة</div>
                    <div className="text-xl font-bold text-emerald-700 mt-1">+{dryRunData.summary.toCreate}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter('update')}
                    className={`p-3 rounded-xl border text-right transition-all ${
                      activeFilter === 'update'
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20'
                        : 'border-blue-200 bg-blue-50/20 hover:bg-blue-50/50'
                    }`}
                  >
                    <div className="text-xs text-blue-700 font-medium">مقاييس للتحديث</div>
                    <div className="text-xl font-bold text-blue-700 mt-1">{dryRunData.summary.toUpdate}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter('unchanged')}
                    className={`p-3 rounded-xl border text-right transition-all ${
                      activeFilter === 'unchanged'
                        ? 'border-slate-500 bg-slate-100 ring-2 ring-slate-400/20'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs text-slate-500 font-medium">مطابق دون تغيير</div>
                    <div className="text-xl font-bold text-slate-600 mt-1">{dryRunData.summary.unchanged}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter('error')}
                    className={`p-3 rounded-xl border text-right transition-all col-span-2 sm:col-span-1 ${
                      activeFilter === 'error'
                        ? 'border-rose-600 bg-rose-50/70 ring-2 ring-rose-600/20'
                        : 'border-rose-200 bg-rose-50/20 hover:bg-rose-50/50'
                    }`}
                  >
                    <div className="text-xs text-rose-700 font-medium">صفوف بأخطاء</div>
                    <div className="text-xl font-bold text-rose-700 mt-1">{dryRunData.summary.errors}</div>
                  </button>
                </div>

                {/* Table of Analyzed Rows */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="max-h-[360px] overflow-y-auto">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-xs font-semibold text-slate-600">
                        <tr>
                          <th className="p-3 w-16 text-center">الصف</th>
                          <th className="p-3">اسم المقياس</th>
                          <th className="p-3">السداسي</th>
                          <th className="p-3">المعامل / الرصيد</th>
                          <th className="p-3">نوع الحصص</th>
                          <th className="p-3">الإجراء المقترح</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRows.map((row: AnalyzedCourseRow) => (
                          <tr
                            key={row.rawIndex}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              row.action === 'error'
                                ? 'bg-rose-50/30'
                                : row.action === 'create'
                                ? 'bg-emerald-50/20'
                                : row.action === 'update'
                                ? 'bg-blue-50/20'
                                : ''
                            }`}
                          >
                            <td className="p-3 text-center text-xs font-mono text-slate-400">
                              #{row.rawIndex}
                            </td>

                            <td className="p-3">
                              <div className="font-semibold text-slate-900">{row.name || '—'}</div>
                              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                {row.code && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{row.code}</span>}
                                {row.specialization && <span>• {row.specialization}</span>}
                                {row.study_level && <span>• {row.study_level}</span>}
                              </div>
                              {row.errorMessageAr && (
                                <div className="text-xs font-medium text-rose-600 mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  {row.errorMessageAr}
                                </div>
                              )}
                            </td>

                            <td className="p-3">
                              <Badge
                                variant={row.semester === 'S1' ? 'info' : 'primary'}
                                className={`text-xs px-2 py-0.5 font-bold ${
                                  row.semester === 'S1'
                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : 'bg-purple-100 text-purple-800 border-purple-200'
                                }`}
                              >
                                {row.semester === 'S1' ? 'السداسي 1 (S1)' : 'السداسي 2 (S2)'}
                              </Badge>
                            </td>

                            <td className="p-3">
                              <div className="text-xs text-slate-700 font-medium">
                                المعامل: <span className="font-bold">{row.coefficient}</span> | الرصيد: <span className="font-bold">{row.credits}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {row.weekly_hours} س/أسبوع
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                {row.has_lecture && (
                                  <span className="text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">محاضرة</span>
                                )}
                                {row.has_td && (
                                  <span className="text-[11px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">TD</span>
                                )}
                                {row.has_tp && (
                                  <span className="text-[11px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">TP</span>
                                )}
                              </div>
                            </td>

                            <td className="p-3">
                              {row.action === 'create' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  إضافة جديد
                                </span>
                              )}

                              {row.action === 'update' && (
                                <div>
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-lg">
                                    <Edit3 className="w-3.5 h-3.5" />
                                    تحديث ({row.changes?.length || 0} حقول)
                                  </span>
                                  {row.changes && row.changes.length > 0 && (
                                    <div className="mt-1 text-[11px] text-slate-500 space-y-0.5">
                                      {row.changes.map((c, i) => (
                                        <div key={i}>
                                          {c.fieldLabelAr}: <span className="text-rose-600 line-through">{String(c.oldValue)}</span> →{' '}
                                          <span className="text-emerald-700 font-bold">{String(c.newValue)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {row.action === 'unchanged' && (
                                <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  <Check className="w-3 h-3" />
                                  مطابق
                                </span>
                              )}

                              {row.action === 'error' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  خطأ
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Options and settings */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 font-medium">
                    <input
                      type="checkbox"
                      checked={skipErrors}
                      onChange={(e) => setSkipErrors(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>تخطي الصفوف التي بها أخطاء واستيراد بقية المقاييس السليمة</span>
                  </label>

                  <div className="text-xs text-slate-500">
                    العملية محمية بـ UnitOfWork ومعاملة ذرية آمنة (Atomic Transaction).
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleModalClose}
              disabled={submitting}
              className="text-slate-600"
            >
              إلغاء
            </Button>

            {dryRunData && (
              <Button
                onClick={handleCommitImport}
                disabled={submitting || (dryRunData.summary.errors > 0 && !skipErrors)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-bold px-6 shadow-md shadow-indigo-600/20"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جارٍ تنفيذ الاعتماد الذري...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    تأكيد اعتماد استيراد المقاييس ({dryRunData.summary.toCreate + dryRunData.summary.toUpdate})
                  </>
                )}
              </Button>
            )}
          </div>

        </div>
      </div>
    </Dialog>
  );
}
