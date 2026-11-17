'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  Button,
  Input,
  Badge,
} from '@djadwal/ui';
import {
  Calendar,
  Clock,
  BookOpen,
  User,
  Users,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Save,
  Plus,
  Edit,
  X,
  ShieldAlert,
} from 'lucide-react';
import { TIME_SLOTS, DAYS, normalizeDay, matchesSlot } from '@/constants/timeSlots';
import { api } from '@/lib/api';

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
  [key: string]: any;
}

interface SessionFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  session?: Assignment | null;
  defaultDayId?: number;
  defaultSlot?: (typeof TIME_SLOTS)[0];
  defaultRoomId?: number;
  defaultGroupId?: number;
  defaultSpecialization?: string;
  courses: any[];
  professors: any[];
  rooms: any[];
  groups: any[];
  academicYear: string;
  semester: string;
  existingAssignments: Assignment[];
  onSave: (saved: Assignment, mode: 'add' | 'edit') => Promise<void> | void;
  isSandboxMode?: boolean;
}

export default function SessionFormModal({
  open,
  onClose,
  mode,
  session,
  defaultDayId = 0,
  defaultSlot,
  defaultRoomId,
  defaultGroupId,
  defaultSpecialization,
  courses,
  professors,
  rooms,
  groups,
  academicYear,
  semester,
  existingAssignments,
  onSave,
  isSandboxMode = false,
}: SessionFormModalProps) {
  const [courseId, setCourseId] = useState<number | ''>('');
  const [professorId, setProfessorId] = useState<number | ''>('');
  const [groupId, setGroupId] = useState<number | ''>('');
  const [roomId, setRoomId] = useState<number | ''>('');
  const [dayOfWeek, setDayOfWeek] = useState<number>(defaultDayId);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [sessionType, setSessionType] = useState<'cours' | 'td' | 'tp'>('cours');
  const [specialization, setSpecialization] = useState<string>('');
  const [ignoreConflicts, setIgnoreConflicts] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize form state when opened or when session/defaults change
  useEffect(() => {
    if (!open) return;

    setFormError(null);
    setIgnoreConflicts(false);

    if (mode === 'edit' && session) {
      setCourseId(session.course_id || '');
      setProfessorId(session.professor_id || '');
      setGroupId(session.group_id || '');
      setRoomId(session.room_id || '');
      setDayOfWeek(normalizeDay(session.day_of_week));

      const slotIdx = TIME_SLOTS.findIndex((s) => s.start === session.start_time);
      setSelectedSlotIndex(slotIdx >= 0 ? slotIdx : 0);

      const sType = session.session_type?.toLowerCase();
      if (sType === 'tp') setSessionType('tp');
      else if (sType === 'td') setSessionType('td');
      else setSessionType('cours');

      setSpecialization(session.specialization || '');
    } else {
      // Add mode defaults
      setCourseId('');
      setProfessorId('');
      setGroupId(defaultGroupId || '');
      setRoomId(defaultRoomId || '');
      setDayOfWeek(defaultDayId);

      if (defaultSlot) {
        const slotIdx = TIME_SLOTS.findIndex((s) => s.id === defaultSlot.id);
        setSelectedSlotIndex(slotIdx >= 0 ? slotIdx : 0);
      } else {
        setSelectedSlotIndex(0);
      }

      setSessionType('cours');
      setSpecialization(defaultSpecialization && defaultSpecialization !== 'all' ? defaultSpecialization : '');
    }
  }, [open, mode, session, defaultDayId, defaultSlot, defaultRoomId, defaultGroupId, defaultSpecialization]);

  // When group changes, auto-set specialization if group has one
  const handleGroupChange = (newGroupId: number | '') => {
    setGroupId(newGroupId);
    if (newGroupId) {
      const g = groups.find((item) => item.id === Number(newGroupId));
      if (g && g.specialization) {
        setSpecialization(g.specialization);
      }
    }
  };

  const currentSlot = TIME_SLOTS[selectedSlotIndex] || TIME_SLOTS[0];

  // Real-Time Pre-Drop / Pre-Save Conflict Detector
  const conflictDetails = useMemo(() => {
    if (!open) return { hasConflict: false };

    const targetDay = Number(dayOfWeek);
    const targetSlot = currentSlot;
    const currentAssignmentId = mode === 'edit' && session ? session.id : null;

    // Filter assignments active in this slot (excluding the session being edited)
    const slotAssignments = existingAssignments.filter((a) => {
      if (currentAssignmentId && a.id === currentAssignmentId) return false;
      const aDay = normalizeDay(a.day_of_week);
      if (aDay !== targetDay) return false;
      return matchesSlot(a.start_time, targetSlot.start, targetSlot.end, a.end_time);
    });

    // 1. Professor conflict
    if (professorId) {
      const profNum = Number(professorId);
      const profConflict = slotAssignments.find((a) => {
        if (!a.professor_id || a.professor_id !== profNum) return false;
        if (roomId && a.room_id === Number(roomId)) return false; // Merged session in same room
        const profName = a.professor_name || '';
        if (profName.includes('غير معين') || profName === '—') return false;
        return true;
      });

      if (profConflict) {
        const profObj = professors.find((p) => p.id === profNum);
        return {
          hasConflict: true,
          type: 'professor',
          reason: `تعارض أستاذ: الأستاذ (${profObj ? profObj.name : 'المحدد'}) مبرمج لحصة أخرى (${profConflict.course_name || 'مقرر'} مع ${profConflict.group_name || 'فوج'}) في هذا التوقيت`,
          conflictingSession: profConflict,
        };
      }
    }

    // 2. Room conflict
    if (roomId) {
      const rNum = Number(roomId);
      const roomObj = rooms.find((r) => r.id === rNum);
      const rName = roomObj?.name || '';
      if (!rName.includes('عن بعد')) {
        const roomConflict = slotAssignments.find((a) => {
          if (!a.room_id || a.room_id !== rNum) return false;
          const aRoomName = a.room_name || '';
          if (aRoomName.includes('عن بعد')) return false;
          return true;
        });

        if (roomConflict) {
          return {
            hasConflict: true,
            type: 'room',
            reason: `تعارض قاعة: القاعة (${rName}) محجوزة بحصة أخرى (${roomConflict.course_name || 'مقرر'} - ${roomConflict.professor_name || 'أستاذ'})`,
            conflictingSession: roomConflict,
          };
        }
      }
    }

    // 3. Group conflict & Lecture vs Subgroup
    if (groupId) {
      const gNum = Number(groupId);
      const sessionGroup = groups.find((g) => g.id === gNum);
      const isSourceLecture = sessionType === 'cours';

      for (const a of slotAssignments) {
        if (a.group_id === gNum) {
          return {
            hasConflict: true,
            type: 'group',
            reason: `تعارض فوج: الفوج (${sessionGroup?.name || 'المحدد'}) لديه حصة أخرى (${a.course_name || 'مقرر'}) في هذا التوقيت`,
            conflictingSession: a,
          };
        }

        const aGroup = groups.find((g) => g.id === a.group_id);
        const sameSpec =
          sessionGroup &&
          aGroup &&
          sessionGroup.specialization &&
          sessionGroup.specialization === aGroup.specialization;

        if (sameSpec) {
          const isTargetLecture = a.session_type === 'cours';
          if (isSourceLecture) {
            return {
              hasConflict: true,
              type: 'lecture',
              reason: `تعارض محاضرة: لا يمكن برمجة محاضرة عامة لتخصص (${sessionGroup.specialization}) في نفس وقت حصة الفوج (${a.group_name})`,
              conflictingSession: a,
            };
          }
          if (isTargetLecture) {
            return {
              hasConflict: true,
              type: 'lecture',
              reason: `تعارض محاضرة: الفوج (${sessionGroup.name}) لديه محاضرة عامة مبرمجة (${a.course_name}) لنفس التخصص في هذا الوقت`,
              conflictingSession: a,
            };
          }
        }
      }
    }

    return { hasConflict: false };
  }, [open, mode, session, dayOfWeek, currentSlot, professorId, roomId, groupId, sessionType, existingAssignments, professors, rooms, groups]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !professorId || !groupId || !roomId) {
      setFormError('يرجى ملء جميع الحقول المطلوبة: المقرر، الأستاذ، الفوج، والقاعة.');
      return;
    }

    if (conflictDetails.hasConflict && !ignoreConflicts) {
      setFormError(conflictDetails.reason || 'يوجد تعارض في التوقيت أو القاعة أو الأستاذ أو الفوج.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const courseObj = courses.find((c) => c.id === Number(courseId));
    const profObj = professors.find((p) => p.id === Number(professorId));
    const groupObj = groups.find((g) => g.id === Number(groupId));
    const roomObj = rooms.find((r) => r.id === Number(roomId));

    const payload: Assignment = {
      id: mode === 'edit' && session ? session.id : 0,
      course_id: Number(courseId),
      course_name: courseObj ? (courseObj.title || courseObj.name || courseObj.code) : '',
      professor_id: Number(professorId),
      professor_name: profObj ? profObj.name : '',
      group_id: Number(groupId),
      group_name: groupObj ? groupObj.name : '',
      room_id: Number(roomId),
      room_name: roomObj ? roomObj.name : '',
      day_of_week: Number(dayOfWeek),
      start_time: currentSlot.start,
      end_time: currentSlot.end,
      session_type: sessionType,
      specialization: specialization || groupObj?.specialization || '',
      academic_year: academicYear,
      semester: semester,
      version: mode === 'edit' && session?.version ? session.version : 1,
    };

    try {
      await onSave(payload, mode);
      onClose();
    } catch (err: any) {
      console.error('Failed to save assignment:', err);
      setFormError(err?.messageAr || err?.message || 'حدث خطأ أثناء حفظ الحصة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={() => !isSubmitting && onClose()} size="lg">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              mode === 'add'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
            }`}
          >
            {mode === 'add' ? <Plus className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {mode === 'add' ? 'إضافة حصة / تكليف أكاديمي جديد' : 'تعديل بيانات الحصة الأكاديمية'}
              </h3>
              {isSandboxMode && (
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300">
                  وضع التجربة (افتراضي)
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {academicYear} — {semester}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Live Conflict Status Banner */}
        {conflictDetails.hasConflict ? (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs space-y-2 animate-in fade-in duration-150">
            <div className="flex items-start gap-2 font-semibold">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{conflictDetails.reason}</span>
            </div>
            <label className="flex items-center gap-2 text-[11px] font-bold text-amber-950 dark:text-amber-100 cursor-pointer pt-1 border-t border-amber-200 dark:border-amber-800">
              <input
                type="checkbox"
                checked={ignoreConflicts}
                onChange={(e) => setIgnoreConflicts(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
              />
              <span>تجاوز هذا التعارض وبرمجة الحصة استثنائياً (Force Assignment)</span>
            </label>
          </div>
        ) : (
          courseId && professorId && roomId && groupId ? (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>لا توجد أي تعارضات — التوقيت والأستاذ والقاعة متاحون تماماً.</span>
            </div>
          ) : null
        )}

        {/* Timing Controls (Day & Slot) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>يوم الحصة:</span>
            </label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200"
            >
              {DAYS.map((d) => (
                <option key={d.id} value={d.id}>
                  يوم {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>الفترة الزمنية (التوقيت):</span>
            </label>
            <select
              value={selectedSlotIndex}
              onChange={(e) => setSelectedSlotIndex(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200"
            >
              {TIME_SLOTS.map((slot, idx) => (
                <option key={slot.id} value={idx}>
                  {slot.label} ({slot.periodName})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Session Type (Cours / TD / TP) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            نوع الحصة البيداغوجية:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSessionType('cours')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                sessionType === 'cours'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              محاضرة (Cours)
            </button>
            <button
              type="button"
              onClick={() => setSessionType('td')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                sessionType === 'td'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              أعمال موجهة (TD)
            </button>
            <button
              type="button"
              onClick={() => setSessionType('tp')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                sessionType === 'tp'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              أعمال تطبيقية (TP)
            </button>
          </div>
        </div>

        {/* Course & Professor Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>المقرر الدراسي (المقياس): *</span>
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20"
              required
            >
              <option value="">-- اختر المقياس / المقرر --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.title} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>الأستاذ المحاضر: *</span>
            </label>
            <select
              value={professorId}
              onChange={(e) => setProfessorId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/20"
              required
            >
              <option value="">-- اختر الأستاذ --</option>
              {professors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.department ? `(${p.department})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Group & Room Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>الفوج / الدفعة الطلابية: *</span>
            </label>
            <select
              value={groupId}
              onChange={(e) => handleGroupChange(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20"
              required
            >
              <option value="">-- اختر الفوج أو الدفعة --</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.specialization ? `(${g.specialization})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              <span>القاعة التدريسية: *</span>
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500/20"
              required
            >
              <option value="">-- اختر القاعة --</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.building ? `— ${r.building}` : ''} {r.capacity ? `(${r.capacity} مقعد)` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Specialization Field (Optional / Auto-filled) */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            التخصص البيداغوجي (اختياري):
          </label>
          <Input
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="مثال: لغة وأدب عربي، إعلام آلي..."
            className="text-xs"
          />
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            إلغاء
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || (conflictDetails.hasConflict && !ignoreConflicts)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {isSubmitting
                ? 'جاري الحفظ...'
                : mode === 'add'
                ? 'إضافة الحصة للجدول'
                : 'تحديث بيانات الحصة'}
            </span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
