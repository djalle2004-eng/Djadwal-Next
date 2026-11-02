'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Printer,
  FileDown,
  Calendar,
  Users,
  User,
  Clock,
  Building2,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { api } from '@/lib/api';

const DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
const TIME_SLOTS = [
  { start: '08:00', end: '09:30', label: '08:00 - 09:30' },
  { start: '09:35', end: '11:05', label: '09:35 - 11:05' },
  { start: '11:10', end: '12:40', label: '11:10 - 12:40' },
  { start: '13:00', end: '14:30', label: '13:00 - 14:30' },
  { start: '14:35', end: '16:05', label: '14:35 - 16:05' },
  { start: '16:10', end: '17:40', label: '16:10 - 17:40' },
];

export default function PrintPage() {
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState('السداسي الأول');
  const [printType, setPrintType] = useState<'group' | 'professor'>('group');
  const [selectedId, setSelectedId] = useState<string>('');
  
  const [groups, setGroups] = useState<any[]>([]);
  const [professors, setProfessors] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, profsRes, assignRes] = await Promise.all([
        api.get('/groups?limit=500'),
        api.get('/professors?limit=500'),
        api.get(`/assignments?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&limit=2000`),
      ]);

      if (Array.isArray(groupsRes)) {
        setGroups(groupsRes);
        if (groupsRes.length > 0 && !selectedId) {
          setSelectedId(String(groupsRes[0].id));
        }
      }
      if (Array.isArray(profsRes)) setProfessors(profsRes);
      if (Array.isArray(assignRes)) setAssignments(assignRes);
    } catch (err: any) {
      console.error('Failed to load print data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [academicYear, semester]);

  const selectedEntity = useMemo(() => {
    if (!selectedId) return null;
    const id = Number(selectedId);
    if (printType === 'group') {
      return groups.find((g) => g.id === id);
    } else {
      return professors.find((p) => p.id === id);
    }
  }, [selectedId, printType, groups, professors]);

  const timetableSessions = useMemo(() => {
    if (!selectedId) return [];
    const id = Number(selectedId);
    return assignments.filter((a) => {
      return printType === 'group' ? a.group_id === id : a.professor_id === id;
    });
  }, [assignments, selectedId, printType]);

  const getCellSession = (day: string, slotStart: string) => {
    return timetableSessions.find(
      (a) => a.day_of_week === day && (a.start_time || '').startsWith(slotStart.slice(0, 5))
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Non-printable Screen Controls */}
      <div className="print:hidden space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">مركز طباعة جداول التوقيت</h1>
              <p className="text-sm text-slate-500">
                طباعة خفيفة فائقة الجودة عبر محرك المتصفح المدمج (@media print) بدون مكتبات PDF ثقيلة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>إرسال إلى الطابعة (Print)</span>
            </button>
          </div>
        </div>

        {/* Configuration options */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">السنة الجامعية</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium"
            >
              <option value="2026-2027">2026-2027</option>
              <option value="2025-2026">2025-2026</option>
              <option value="2024-2025">2024-2025</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">السداسي</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium"
            >
              <option value="السداسي الأول">السداسي الأول</option>
              <option value="السداسي الثاني">السداسي الثاني</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">نوع الجدول</label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setPrintType('group');
                  if (groups.length > 0) setSelectedId(String(groups[0].id));
                }}
                className={`py-1.5 rounded-lg transition-all ${
                  printType === 'group' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                جدول فوج
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintType('professor');
                  if (professors.length > 0) setSelectedId(String(professors[0].id));
                }}
                className={`py-1.5 rounded-lg transition-all ${
                  printType === 'professor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                جدول أستاذ
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              {printType === 'group' ? 'الفوج المراد طباعته' : 'الأستاذ المراد طباعته'}
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium"
            >
              {printType === 'group'
                ? groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.year || 'عام'})
                    </option>
                  ))
                : professors.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
            </select>
          </div>
        </div>
      </div>

      {/* Printable Area (Styled with CSS for Print) */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none">
        {/* University Header */}
        <div className="text-center space-y-1 pb-4 border-b-2 border-slate-900 mb-6">
          <p className="text-xs font-medium text-slate-700">الجمهورية الجزائرية الديمقراطية الشعبية</p>
          <p className="text-xs font-medium text-slate-700">وزارة التعليم العالي والبحث العلمي</p>
          <h2 className="text-base font-bold text-slate-900 mt-1">جامعة الشهيد حمه لخضر - الوادي</h2>
          <h3 className="text-sm font-semibold text-slate-800">كلية العلوم الاقتصادية والتجارية وعلوم التسيير</h3>
          
          <div className="pt-3 flex items-center justify-between text-xs font-semibold text-slate-700 border-t border-slate-200 mt-3">
            <span>السنة الجامعية: {academicYear}</span>
            <span className="text-sm font-bold text-slate-900">
              {printType === 'group'
                ? `جدول توقيت الفوج: ${selectedEntity?.name || ''}`
                : `جدول توقيت الأستاذ: ${selectedEntity?.name || ''}`}
            </span>
            <span>{semester}</span>
          </div>
        </div>

        {/* Timetable Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-slate-900 text-right text-xs">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-900 text-slate-900">
                <th className="py-3 px-2 font-bold border-l-2 border-slate-900 w-24 text-center">
                  اليوم / التوقيت
                </th>
                {TIME_SLOTS.map((slot) => (
                  <th key={slot.start} className="py-3 px-2 font-bold border-l border-slate-900 text-center">
                    {slot.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400">
              {DAYS.map((day) => (
                <tr key={day} className="h-16 border-b border-slate-900">
                  <td className="py-2 px-3 font-bold text-slate-900 border-l-2 border-slate-900 bg-slate-50 text-center">
                    {day}
                  </td>
                  {TIME_SLOTS.map((slot) => {
                    const session = getCellSession(day, slot.start);
                    return (
                      <td
                        key={slot.start}
                        className="p-1.5 border-l border-slate-900 align-top w-[140px] text-center"
                      >
                        {session ? (
                          <div className="flex flex-col justify-between h-full p-1 border border-slate-300 rounded bg-slate-50/50">
                            <span className="font-bold text-slate-950 text-[11px] leading-tight">
                              {session.course_name}
                            </span>
                            <span className="text-[10px] text-slate-700 mt-0.5">
                              {printType === 'group' ? session.professor_name : session.group_name}
                            </span>
                            <span className="text-[9px] font-semibold text-slate-600 mt-1">
                              قاعة: {session.room_name || '—'} ({session.session_type || 'TD'})
                            </span>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-300">—</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer with sign-off */}
        <div className="mt-8 pt-4 flex items-center justify-between text-xs text-slate-600 print:mt-12">
          <div>
            <p className="font-semibold">تاريخ الاستخراج: {new Date().toLocaleDateString('ar-DZ')}</p>
            <p className="text-[10px] text-slate-400">نظام Djadwal - جامعة الشهيد حمه لخضر بالوادي</p>
          </div>
          <div className="text-center pl-8">
            <p className="font-bold text-slate-800 mb-8">إمضاء وتأشيرة رئيس القسم</p>
            <div className="w-32 border-b border-dashed border-slate-400"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

