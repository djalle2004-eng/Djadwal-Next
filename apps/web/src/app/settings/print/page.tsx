'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Printer,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Sliders,
  FileText,
  Building,
  UserCheck,
  Layout,
  RefreshCw,
  X
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
  TabContent
} from '@djadwal/ui';

import { api } from '@/lib/api';

export interface PrintSettingsData {
  republic_name_ar: string;
  ministry_name_ar: string;
  university_name_ar: string;
  faculty_name_ar: string;
  department_name_ar: string;
  university_logo_url?: string;
  faculty_logo_url?: string;
  schedule_officer_title: string;
  schedule_officer_name: string;
  department_head_title: string;
  department_head_name: string;
  vice_dean_title: string;
  vice_dean_name: string;
  custom_footer_ar: string;
  exam_disclaimer_ar: string;
  page_size: string;
  orientation: 'landscape' | 'portrait';
  font_size: number;
  header_font_size: number;
  title_font_size: number;
  show_colors: boolean;
  show_print_date: boolean;
  show_page_numbers: boolean;
  table_border_width: number;
}

const DEFAULT_SETTINGS: PrintSettingsData = {
  republic_name_ar: 'الجمهورية الجزائرية الديمقراطية الشعبية',
  ministry_name_ar: 'وزارة التعليم العالي والبحث العلمي',
  university_name_ar: 'جامعة الشهيد حمه لخضر - الوادي',
  faculty_name_ar: 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير',
  department_name_ar: 'قسم التدريس والبرمجة البيداغوجية',
  university_logo_url: '',
  faculty_logo_url: '',
  schedule_officer_title: 'مسؤول التوقيت والبرمجة',
  schedule_officer_name: 'أ. د. بلقاسم',
  department_head_title: 'رئيس القسم',
  department_head_name: 'د. لخضر',
  vice_dean_title: 'نائب العميد المكلف بالدراسات والمسائل المرتبطة بالطلبة',
  vice_dean_name: 'أ. د. محمد',
  custom_footer_ar: 'ملاحظة: يرجى من جميع الأساتذة والطلبة الالتزام بالقاعات والأوقات المحددة رسمياً في هذا الجدول.',
  exam_disclaimer_ar: 'ملاحظة: الغياب عن الفرض المحروس يترتب عليه علامة صفر ولا يعاد إلا بمبرر قانوني معتمد.',
  page_size: 'A4',
  orientation: 'landscape',
  font_size: 10,
  header_font_size: 13,
  title_font_size: 16,
  show_colors: true,
  show_print_date: true,
  show_page_numbers: false,
  table_border_width: 1
};

export default function PrintSettingsPage() {
  const [settings, setSettings] = useState<PrintSettingsData>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('identity');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Settings from LocalStorage + Server
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Check localStorage first
        const local = localStorage.getItem('djadwal_print_settings');
        let initial = DEFAULT_SETTINGS;
        if (local) {
          try {
            initial = { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
          } catch (_) {}
        }

        // Fetch from API
        try {
          const server = await api.getPrintSettings();
          if (server) {
            initial = { ...initial, ...server };
          }
        } catch (_) {}

        setSettings(initial);
      } catch (err) {
        console.error('Error loading print settings:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = (key: keyof PrintSettingsData, val: any) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      // Save locally
      localStorage.setItem('djadwal_print_settings', JSON.stringify(settings));

      // Save to server
      await api.updatePrintSettings(settings);

      showToast('success', 'تم حفظ وتعميم إعدادات الطباعة الرسمية بنجاح في كامل النظام');
    } catch (err: any) {
      showToast('error', err?.messageAr || err?.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('هل أنت متأكد من استعادة إعدادات الطباعة الافتراضية؟')) {
      setSettings(DEFAULT_SETTINGS);
      localStorage.setItem('djadwal_print_settings', JSON.stringify(DEFAULT_SETTINGS));
      showToast('success', 'تمت استعادة الإعدادات الافتراضية');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-16 font-sans" dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
                : 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors ms-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  مركز إعدادات الطباعة والهوية الرسمية
                </h1>
                <Badge variant="primary">Standardized A4 Engine</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                توحيد الترويسة الجامعية، الموقعين المعتمدين، وتنسيق الطباعة لكافة الجداول والتقارير
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>استعادة الافتراضي</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ وتعميم الإعدادات'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid: Form on Left, Live Preview on Right */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Panel (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-indigo-600" />
                  <span>تخصيص معايير الطباعة</span>
                </CardTitle>
                <CardDescription>
                  التعديلات هنا تنعكس فوراً على المعاينة المباشرة وتُطبَّق على كافة وثائق الكلية
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="identity" value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-3 w-full mb-6">
                    <TabTrigger value="identity" className="gap-1.5 text-xs">
                      <Building className="h-3.5 w-3.5" />
                      <span>الترويسة والهوية</span>
                    </TabTrigger>
                    <TabTrigger value="signatories" className="gap-1.5 text-xs">
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>الموقعون والتذييل</span>
                    </TabTrigger>
                    <TabTrigger value="layout" className="gap-1.5 text-xs">
                      <Layout className="h-3.5 w-3.5" />
                      <span>التنسيق والورقة</span>
                    </TabTrigger>
                  </TabsList>

                  {/* TAB 1: University Identity */}
                  <TabContent value="identity">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          الدولة / الترويسة العليا *
                        </label>
                        <Input
                          type="text"
                          value={settings.republic_name_ar}
                          onChange={(e) => handleChange('republic_name_ar', e.target.value)}
                          className="w-full text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          الوزارة *
                        </label>
                        <Input
                          type="text"
                          value={settings.ministry_name_ar}
                          onChange={(e) => handleChange('ministry_name_ar', e.target.value)}
                          className="w-full text-xs font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            اسم الجامعة *
                          </label>
                          <Input
                            type="text"
                            value={settings.university_name_ar}
                            onChange={(e) => handleChange('university_name_ar', e.target.value)}
                            className="w-full text-xs font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            اسم الكلية *
                          </label>
                          <Input
                            type="text"
                            value={settings.faculty_name_ar}
                            onChange={(e) => handleChange('faculty_name_ar', e.target.value)}
                            className="w-full text-xs font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          القسم البيداغوجي / المصلحة
                        </label>
                        <Input
                          type="text"
                          value={settings.department_name_ar}
                          onChange={(e) => handleChange('department_name_ar', e.target.value)}
                          className="w-full text-xs font-medium"
                        />
                      </div>
                    </div>
                  </TabContent>

                  {/* TAB 2: Signatories & Footers */}
                  <TabContent value="signatories">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            صفة الموقع الأول (اليمين)
                          </label>
                          <Input
                            type="text"
                            value={settings.schedule_officer_title}
                            onChange={(e) => handleChange('schedule_officer_title', e.target.value)}
                            className="w-full text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            اسم الموقع الأول
                          </label>
                          <Input
                            type="text"
                            value={settings.schedule_officer_name}
                            onChange={(e) => handleChange('schedule_officer_name', e.target.value)}
                            className="w-full text-xs font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            صفة الموقع الثاني (الوسط)
                          </label>
                          <Input
                            type="text"
                            value={settings.department_head_title}
                            onChange={(e) => handleChange('department_head_title', e.target.value)}
                            className="w-full text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            اسم الموقع الثاني
                          </label>
                          <Input
                            type="text"
                            value={settings.department_head_name}
                            onChange={(e) => handleChange('department_head_name', e.target.value)}
                            className="w-full text-xs font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            صفة الموقع الثالث (اليسار)
                          </label>
                          <Input
                            type="text"
                            value={settings.vice_dean_title}
                            onChange={(e) => handleChange('vice_dean_title', e.target.value)}
                            className="w-full text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            اسم الموقع الثالث
                          </label>
                          <Input
                            type="text"
                            value={settings.vice_dean_name}
                            onChange={(e) => handleChange('vice_dean_name', e.target.value)}
                            className="w-full text-xs font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          الملاحظة التذييلية العامة للجداول
                        </label>
                        <Input
                          type="text"
                          value={settings.custom_footer_ar}
                          onChange={(e) => handleChange('custom_footer_ar', e.target.value)}
                          className="w-full text-xs"
                        />
                      </div>
                    </div>
                  </TabContent>

                  {/* TAB 3: Layout & Paper */}
                  <TabContent value="layout">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            الاتجاه الافتراضي للورقة
                          </label>
                          <select
                            value={settings.orientation}
                            onChange={(e) => handleChange('orientation', e.target.value as any)}
                            className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                          >
                            <option value="landscape">أفقي (Landscape - مناسب للجداول الأسبوعية)</option>
                            <option value="portrait">عمودي (Portrait - مناسب للإعلانات والقرارات)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            حجم خط الجداول ({settings.font_size}pt)
                          </label>
                          <input
                            type="range"
                            min="8"
                            max="14"
                            step="1"
                            value={settings.font_size}
                            onChange={(e) => handleChange('font_size', Number(e.target.value))}
                            className="w-full accent-indigo-600 cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.show_colors}
                            onChange={(e) => handleChange('show_colors', e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            إظهار ألوان التمييز البيداغوجي (محاضرة، TD، TP) في مخرجات الطباعة
                          </span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.show_print_date}
                            onChange={(e) => handleChange('show_print_date', e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            طباعة تاريخ واستخراج الوثيقة تلقائياً في التذييل
                          </span>
                        </label>
                      </div>
                    </div>
                  </TabContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Live Preview Panel (5 Cols) */}
          <div className="lg:col-span-5">
            <div className="sticky top-20">
              <Card className="border-indigo-200 dark:border-indigo-800 shadow-md">
                <CardHeader className="pb-3 border-b bg-indigo-50/40 dark:bg-indigo-950/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4 text-indigo-600" />
                      <span>معاينة حية للمستند الرسمي (A4)</span>
                    </CardTitle>
                    <Badge variant="primary" className="text-[10px]">
                      {settings.orientation === 'landscape' ? 'أفقي A4' : 'عمودي A4'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 bg-slate-100/70 dark:bg-slate-900/60 overflow-hidden">
                  {/* Paper Simulation */}
                  <div className="bg-white text-slate-900 p-5 rounded-xl border border-slate-300 shadow-sm text-center text-xs space-y-4">
                    {/* Header */}
                    <div className="border-b pb-3 space-y-1">
                      <p className="font-bold text-[11px] leading-tight">{settings.republic_name_ar}</p>
                      <p className="font-bold text-[10px] text-slate-700 leading-tight">{settings.ministry_name_ar}</p>
                      <p className="font-semibold text-[10px] text-indigo-900 leading-tight">
                        {settings.university_name_ar} | {settings.faculty_name_ar}
                      </p>
                      {settings.department_name_ar && (
                        <p className="text-[9px] text-slate-600">{settings.department_name_ar}</p>
                      )}
                      <div className="pt-2">
                        <span className="inline-block px-3 py-1 font-bold rounded-lg border border-slate-900 text-[11px] bg-slate-50">
                          جدول التوقيت الأسبوعي العام (نموذج معتمد)
                        </span>
                      </div>
                    </div>

                    {/* Mock Table */}
                    <div className="space-y-1 text-[9px] border rounded-lg p-2 bg-slate-50">
                      <div className="flex justify-between font-bold border-b pb-1">
                        <span>السنة: 2026-2027</span>
                        <span>السداسي الأول</span>
                        <span>التخصص: ليسانس اقتصاد</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 pt-1 text-center">
                        <div className="p-1 rounded bg-indigo-100 font-semibold">محاضرة: اقتصاد كلي</div>
                        <div className="p-1 rounded bg-emerald-100 font-semibold">TD: إحصاء 1</div>
                        <div className="p-1 rounded bg-amber-100 font-semibold">TP: إعلام آلي</div>
                        <div className="p-1 rounded bg-slate-100 text-slate-500">فترة شاغرة</div>
                      </div>
                    </div>

                    {/* Footer Note */}
                    {settings.custom_footer_ar && (
                      <p className="text-[9px] text-slate-500 italic text-start pt-1">
                        {settings.custom_footer_ar}
                      </p>
                    )}

                    {/* Signatures */}
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t text-[9px] text-center">
                      <div>
                        <p className="font-bold">{settings.schedule_officer_title}</p>
                        <p className="text-slate-600 mt-0.5">{settings.schedule_officer_name}</p>
                      </div>
                      <div>
                        <p className="font-bold">{settings.department_head_title}</p>
                        <p className="text-slate-600 mt-0.5">{settings.department_head_name}</p>
                      </div>
                      <div>
                        <p className="font-bold">{settings.vice_dean_title}</p>
                        <p className="text-slate-600 mt-0.5">{settings.vice_dean_name}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
