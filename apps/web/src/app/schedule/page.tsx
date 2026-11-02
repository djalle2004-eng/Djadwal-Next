'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Filter,
  Users,
  DoorClosed,
  GraduationCap,
  RefreshCw,
  Search,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Printer,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
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

interface Assignment {
  id: number;
  course_name?: string;
  professor_name?: string;
  room_name?: string;
  group_name?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  session_type?: string;
  academic_year?: string;
  semester?: string;
  group_id?: number;
  professor_id?: number;
  room_id?: number;
}

export default function SchedulePage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [professors, setProfessors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<'group' | 'professor' | 'room'>('group');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState('السداسي الأول');

  // Details Modal
  const [activeSession, setActiveSession] = useState<Assignment | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assignRes, groupsRes, profsRes, roomsRes] = await Promise.all([
        api.get(`/assignments?academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}&limit=1500`),
        api.get('/groups?limit=500'),
        api.get('/professors?limit=500'),
        api.get('/rooms?limit=500'),
      ]);

      if (Array.isArray(assignRes)) setAssignments(assignRes);
      if (Array.isArray(groupsRes)) setGroups(groupsRes);
      if (Array.isArray(profsRes)) setProfessors(profsRes);
      if (Array.isArray(roomsRes)) setRooms(roomsRes);
    } catch (err: any) {
      console.error('Failed to load schedule data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [academicYear, semester]);

  // Filtered assignments based on current selection
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (selectedDay !== 'all' && a.day_of_week !== selectedDay) return false;
      if (selectedEntityId === 'all') return true;

      const entityId = Number(selectedEntityId);
      if (filterType === 'group') return a.group_id === entityId;
      if (filterType === 'professor') return a.professor_id === entityId;
      if (filterType === 'room') return a.room_id === entityId;
      return true;
    });
  }, [assignments, filterType, selectedEntityId, selectedDay]);

  // Find assignments for a specific day and time slot
  const getCellAssignments = (day: string, slotStart: string) => {
    return filteredAssignments.filter((a) => {
      const matchesDay = a.day_of_week === day;
      const matchesTime = (a.start_time || '').startsWith(slotStart.slice(0, 5));
      return matchesDay && matchesTime;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">جدول التوقيت الأسبوعي</h1>
            <p className="text-sm text-slate-500">
              استعراض الحصص الدراسية وتوزيع القاعات والأساتذة ({academicYear} - {semester})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/print"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الجدول</span>
          </Link>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Control Bar: Filters & Entity Selection */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Year Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">السنة الجامعية</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="2026-2027">2026-2027 (الحالية)</option>
              <option value="2025-2026">2025-2026</option>
              <option value="2024-2025">2024-2025</option>
            </select>
          </div>

          {/* Semester Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">السداسي / الفصل</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="السداسي الأول">السداسي الأول</option>
              <option value="السداسي الثاني">السداسي الثاني</option>
            </select>
          </div>

          {/* View By Entity Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">نوع العرض</label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setFilterType('group');
                  setSelectedEntityId('all');
                }}
                className={`py-1.5 rounded-lg transition-all ${
                  filterType === 'group' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                أفواج
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterType('professor');
                  setSelectedEntityId('all');
                }}
                className={`py-1.5 rounded-lg transition-all ${
                  filterType === 'professor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                أساتذة
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterType('room');
                  setSelectedEntityId('all');
                }}
                className={`py-1.5 rounded-lg transition-all ${
                  filterType === 'room' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                قاعات
              </button>
            </div>
          </div>

          {/* Entity Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              {filterType === 'group' ? 'اختر الفوج' : filterType === 'professor' ? 'اختر الأستاذ' : 'اختر القاعة'}
            </label>
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">
                {filterType === 'group' ? 'جميع الأفواج (عرض شامل)' : filterType === 'professor' ? 'جميع الأساتذة' : 'جميع القاعات'}
              </option>
              {filterType === 'group' &&
                groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.year || 'عام'})
                  </option>
                ))}
              {filterType === 'professor' &&
                professors.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              {filterType === 'room' &&
                rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.type || 'قاعة'})
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Timetable Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500 font-medium">جاري إعداد جدول التوقيت وجلب الحصص...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full border-collapse min-w-[900px] text-right">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs">
                <th className="py-4 px-4 font-bold border-l border-slate-200 w-28 text-center bg-slate-100/70">
                  اليوم / التوقيت
                </th>
                {TIME_SLOTS.map((slot) => (
                  <th key={slot.start} className="py-4 px-3 font-semibold border-l border-slate-200 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{slot.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {DAYS.map((day) => (
                <tr key={day} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 font-bold text-slate-900 border-l border-slate-200 bg-slate-50/70 text-center align-middle">
                    {day}
                  </td>
                  {TIME_SLOTS.map((slot) => {
                    const cellSessions = getCellAssignments(day, slot.start);
                    return (
                      <td
                        key={slot.start}
                        className="p-2 border-l border-slate-200 align-top min-h-[100px] h-[105px] w-[150px] relative hover:bg-indigo-50/20 transition-colors"
                      >
                        {cellSessions.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-slate-300">
                            —
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                            {cellSessions.map((session) => (
                              <button
                                key={session.id}
                                onClick={() => setActiveSession(session)}
                                className={`w-full text-right p-2 rounded-xl border text-xs transition-all shadow-sm block ${
                                  session.session_type === 'cours'
                                    ? 'bg-blue-50/90 border-blue-200 hover:border-blue-300 text-blue-900'
                                    : session.session_type === 'tp'
                                    ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-300 text-emerald-900'
                                    : 'bg-purple-50/90 border-purple-200 hover:border-purple-300 text-purple-900'
                                }`}
                              >
                                <div className="font-bold truncate" title={session.course_name}>
                                  {session.course_name || 'مقرر بدون اسم'}
                                </div>
                                <div className="text-[11px] text-slate-600 truncate mt-0.5">
                                  {session.professor_name || 'غير محدد'}
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-200/50">
                                  <span className="font-medium text-slate-700 truncate">{session.group_name || 'الفوج'}</span>
                                  <span className="bg-white/80 px-1.5 py-0.2 rounded font-semibold text-slate-700">
                                    {session.room_name || '—'}
                                  </span>
                                </div>
                              </button>
                            ))}
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
      )}

      {/* Session Details Modal */}
      {activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">تفاصيل الحصة الدراسية</h3>
              </div>
              <button
                onClick={() => setActiveSession(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                <span className="text-xs text-indigo-600 font-semibold block">المقرر الدراسي</span>
                <span className="text-base font-bold text-indigo-950">{activeSession.course_name || '—'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block mb-1">الأستاذ المحاضر</span>
                  <span className="font-semibold text-slate-800">{activeSession.professor_name || '—'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block mb-1">الفوج / الدفعة</span>
                  <span className="font-semibold text-slate-800">{activeSession.group_name || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block mb-1">القاعة</span>
                  <span className="font-semibold text-slate-800">{activeSession.room_name || '—'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block mb-1">نوع الحصة</span>
                  <span className="font-semibold text-slate-800">{activeSession.session_type || 'TD'}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">التوقيت</span>
                  <span className="font-semibold text-slate-800">
                    {activeSession.day_of_week} ({activeSession.start_time} - {activeSession.end_time})
                  </span>
                </div>
                <Clock className="w-5 h-5 text-slate-400" />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setActiveSession(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

