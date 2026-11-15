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
  Award,
  Upload,
  Trash2,
  Image as ImageIcon,
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
  deanery_name_ar: string;
  service_name_ar: string;
  reference_number_format: string;
  city_name_ar: string;
  university_logo_url?: string;
  faculty_logo_url?: string;
  enable_watermark: boolean;
  watermark_opacity: number;
  logo_size: number;
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
  deanery_name_ar: 'نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة',
  service_name_ar: 'مصلحة التدريس',
  reference_number_format: '2027-2026 / ك ع ا . ت. ع. ت / ن. ع. م. د / م ت',
  city_name_ar: 'الوادي',
  university_logo_url: '',
  faculty_logo_url: '',
  enable_watermark: true,
  watermark_opacity: 0.08,
  logo_size: 80,
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

  const handleLogoFileUpload = (field: 'university_logo_url' | 'faculty_logo_url', file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'حجم الصورة يجب أن لا يتجاوز 2 ميجابايت');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        handleChange(field, dataUrl);
        showToast('success', 'تم تحميل الشعار بنجاح');
      }
    };
    reader.readAsDataURL(file);
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
                توحيد الترويسة الجامعية، الشعارات، العلامة المائية، والموقعين المعتمدين لكافة الجداول والوثائق
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
                  التعديلات هنا تنعكس فوراً على المعاينة المباشرة وتُطبَّق على كافة وثائق وإعلانات الكلية
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="identity" value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-4 w-full mb-6">
                    <TabTrigger value="identity" className="gap-1.5 text-xs">
                      <Building className="h-3.5 w-3.5" />
                      <span>الترويسة الإدارية</span>
                    </TabTrigger>
                    <TabTrigger value="logos" className="gap-1.5 text-xs">
                      <Award className="h-3.5 w-3.5" />
                      <span>الشعارات والمائية</span>
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

                  {/* TAB 1: Administrative Identity */}
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
                          الوزارة الوصية *
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

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            نيابة العمادة المكلفة *
                          </label>
                          <Input
                            type="text"
                            value={settings.deanery_name_ar}
                            onChange={(e) => handleChange('deanery_name_ar', e.target.value)}
                            className="w-full text-xs font-medium"
                            placeholder="نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            مصلحة التدريس / القسم الإداري *
                          </label>
                          <Input
                            type="text"
                            value={settings.service_name_ar}
                            onChange={(e) => handleChange('service_name_ar', e.target.value)}
                            className="w-full text-xs font-medium"
                            placeholder="مصلحة التدريس"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            صيغة الرقم المرجعي الإداري
                          </label>
                          <Input
                            type="text"
                            value={settings.reference_number_format}
                            onChange={(e) => handleChange('reference_number_format', e.target.value)}
                            className="w-full text-xs font-mono"
                            placeholder="2027-2026 / ك ع ا . ت. ع. ت / ن. ع. م. د / م ت"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            المدينة الإدارية (تاريخ الوثائق)
                          </label>
                          <Input
                            type="text"
                            value={settings.city_name_ar}
                            onChange={(e) => handleChange('city_name_ar', e.target.value)}
                            className="w-full text-xs font-medium"
                            placeholder="الوادي"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          القسم البيداغوجي الافتراضي
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

                  {/* TAB 2: Logos & Watermark */}
                  <TabContent value="logos">
                    <div className="space-y-6">
                      {/* University Logo Card */}
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            شعار الجامعة (University Logo)
                          </label>
                          {settings.university_logo_url && (
                            <button
                              type="button"
                              onClick={() => handleChange('university_logo_url', '')}
                              className="text-[11px] text-rose-600 hover:underline"
                            >
                              إزالة الشعار
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-slate-800 shrink-0 overflow-hidden shadow-inner">
                            {settings.university_logo_url ? (
                              <img
                                src={settings.university_logo_url}
                                alt="شعار الجامعة"
                                className="h-full w-full object-contain p-1"
                              />
                            ) : (
                              <Building className="h-6 w-6 text-slate-300" />
                            )}
                          </div>

                          <div className="flex-1 space-y-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleLogoFileUpload('university_logo_url', file);
                              }}
                              className="block w-full text-xs text-slate-500 file:mr-0 file:ml-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950 dark:file:text-indigo-300"
                            />
                            <Input
                              type="text"
                              placeholder="أو ألصق رابط الشعار المباشر (URL أو Base64)..."
                              value={settings.university_logo_url || ''}
                              onChange={(e) => handleChange('university_logo_url', e.target.value)}
                              className="w-full text-[11px]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Faculty Logo Card */}
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            شعار الكلية (Faculty Logo)
                          </label>
                          {settings.faculty_logo_url && (
                            <button
                              type="button"
                              onClick={() => handleChange('faculty_logo_url', '')}
                              className="text-[11px] text-rose-600 hover:underline"
                            >
                              إزالة الشعار
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-slate-800 shrink-0 overflow-hidden shadow-inner">
                            {settings.faculty_logo_url ? (
                              <img
                                src={settings.faculty_logo_url}
                                alt="شعار الكلية"
                                className="h-full w-full object-contain p-1"
                              />
                            ) : (
                              <Award className="h-6 w-6 text-slate-300" />
                            )}
                          </div>

                          <div className="flex-1 space-y-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleLogoFileUpload('faculty_logo_url', file);
                              }}
                              className="block w-full text-xs text-slate-500 file:mr-0 file:ml-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950 dark:file:text-indigo-300"
                            />
                            <Input
                              type="text"
                              placeholder="أو ألصق رابط الشعار المباشر (URL أو Base64)..."
                              value={settings.faculty_logo_url || ''}
                              onChange={(e) => handleChange('faculty_logo_url', e.target.value)}
                              className="w-full text-[11px]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Watermark & Sizing Controls */}
                      <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-900 dark:text-slate-100">
                            <input
                              type="checkbox"
                              checked={settings.enable_watermark}
                              onChange={(e) => handleChange('enable_watermark', e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                            <span>تفعيل العلامة المائية (Watermark) لشعار الجامعة في خلفية الورقة</span>
                          </label>
                          <Badge variant={settings.enable_watermark ? 'success' : 'neutral'}>
                            {settings.enable_watermark ? 'مفعلة' : 'معطلة'}
                          </Badge>
                        </div>

                        {settings.enable_watermark && (
                          <div className="space-y-1.5 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                              <span>شفافية العلامة المائية:</span>
                              <span className="font-mono">{Math.round((settings.watermark_opacity || 0.08) * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0.03"
                              max="0.25"
                              step="0.01"
                              value={settings.watermark_opacity || 0.08}
                              onChange={(e) => handleChange('watermark_opacity', parseFloat(e.target.value))}
                              className="w-full accent-indigo-600 cursor-pointer"
                            />
                            <span className="text-[10px] text-slate-500 block">
                              القيمة الموصى بها هي 8% لضمان وضوح نصوص وجداول الطباعة
                            </span>
                          </div>
                        )}

                        <div className="space-y-1.5 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                          <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <span>حجم الشعار في الترويسة:</span>
                            <span className="font-mono">{settings.logo_size || 80}px</span>
                          </div>
                          <input
                            type="range"
                            min="60"
                            max="140"
                            step="5"
                            value={settings.logo_size || 80}
                            onChange={(e) => handleChange('logo_size', parseInt(e.target.value))}
                            className="w-full accent-indigo-600 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </TabContent>

                  {/* TAB 3: Signatories & Footers */}
                  <TabContent value="signatories">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            صفة نائب العميد (الموقع الرئيسي لوثيقة التكليف)
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
                            اسم نائب العميد
                          </label>
                          <Input
                            type="text"
                            value={settings.vice_dean_name}
                            onChange={(e) => handleChange('vice_dean_name', e.target.value)}
                            className="w-full text-xs font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            صفة رئيس القسم (الموقع الرئيسي لإعلانات الطلبة)
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
                            اسم رئيس القسم
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
                            صفة مسؤول التوقيت والبرمجة
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
                            اسم مسؤول التوقيت والبرمجة
                          </label>
                          <Input
                            type="text"
                            value={settings.schedule_officer_name}
                            onChange={(e) => handleChange('schedule_officer_name', e.target.value)}
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

                  {/* TAB 4: Layout & Paper */}
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
                            <option value="portrait">عمودي (Portrait - مناسب لوثائق التكليف والإعلانات)</option>
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
                  <div className="relative bg-white text-slate-900 p-5 rounded-xl border border-slate-300 shadow-sm text-center text-xs space-y-4 overflow-hidden">
                    {/* Watermark in Preview */}
                    {settings.enable_watermark && settings.university_logo_url && (
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
                        style={{ opacity: settings.watermark_opacity || 0.08 }}
                      >
                        <img
                          src={settings.university_logo_url}
                          alt="Watermark"
                          className="w-48 h-48 object-contain"
                        />
                      </div>
                    )}

                    {/* Official Triple Header with Logos */}
                    <div className="relative z-10 border-b pb-3">
                      <div className="flex items-start justify-between gap-2">
                        {/* Right: Faculty Logo & Admin */}
                        <div className="text-right text-[9px] w-1/3 leading-tight space-y-0.5">
                          {settings.faculty_logo_url ? (
                            <img
                              src={settings.faculty_logo_url}
                              alt="Faculty Logo"
                              className="h-9 object-contain mb-1"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded border border-dashed flex items-center justify-center text-[8px] text-slate-400 mb-1">
                              شعار الكلية
                            </div>
                          )}
                          <p className="font-bold text-slate-800">{settings.faculty_name_ar}</p>
                          <p className="text-slate-600">{settings.deanery_name_ar}</p>
                          <p className="text-slate-500">{settings.service_name_ar}</p>
                        </div>

                        {/* Center: State & Ministry */}
                        <div className="text-center w-1/3 leading-tight space-y-1">
                          <p className="font-bold text-[10px]">{settings.republic_name_ar}</p>
                          <p className="font-semibold text-[9px] text-slate-700">{settings.ministry_name_ar}</p>
                          <div className="pt-1">
                            <span className="inline-block px-2 py-0.5 font-bold rounded border border-slate-900 text-[10px] bg-slate-50">
                              نموذج الوثيقة الإدارية
                            </span>
                          </div>
                        </div>

                        {/* Left: University Logo & Reference Number */}
                        <div className="text-left text-[9px] w-1/3 leading-tight space-y-0.5 flex flex-col items-end">
                          {settings.university_logo_url ? (
                            <img
                              src={settings.university_logo_url}
                              alt="University Logo"
                              className="h-9 object-contain mb-1"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded border border-dashed flex items-center justify-center text-[8px] text-slate-400 mb-1">
                              شعار الجامعة
                            </div>
                          )}
                          <p className="font-bold text-slate-800">{settings.university_name_ar}</p>
                          <p className="text-slate-500 font-mono text-[8px] mt-0.5" dir="ltr">
                            الرقم: ... / {settings.reference_number_format?.split('/')?.[0] || '2026-2027'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Mock Content */}
                    <div className="relative z-10 space-y-2 text-[9px] border rounded-lg p-2.5 bg-slate-50/80 backdrop-blur-[1px]">
                      <div className="flex justify-between font-bold border-b pb-1 text-[10px]">
                        <span>الموسم الجامعي: 2026-2027</span>
                        <span>السداسي الأول</span>
                        <span>{settings.city_name_ar} في: {new Date().toLocaleDateString('fr-FR')}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 pt-1 text-center font-medium">
                        <div className="p-1 rounded bg-indigo-100/90 text-indigo-900 font-semibold">المحاضرات: 3.0 س</div>
                        <div className="p-1 rounded bg-emerald-100/90 text-emerald-900 font-semibold">الأعمال الموجهة: 4.5 س</div>
                        <div className="p-1 rounded bg-amber-100/90 text-amber-900 font-semibold">الأعمال التطبيقية: 0.0 س</div>
                        <div className="p-1 rounded bg-slate-200/90 font-bold">المجموع: 7.5 س</div>
                      </div>
                    </div>

                    {/* Footer Note */}
                    {settings.custom_footer_ar && (
                      <p className="relative z-10 text-[9px] text-slate-500 italic text-start pt-1">
                        {settings.custom_footer_ar}
                      </p>
                    )}

                    {/* Signatures */}
                    <div className="relative z-10 grid grid-cols-2 gap-4 pt-3 border-t text-[9px]">
                      <div className="text-right">
                        <p className="font-bold">{settings.department_head_title}</p>
                        <p className="text-slate-600 mt-0.5">{settings.department_head_name}</p>
                      </div>
                      <div className="text-left">
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
