/**
 * ثوابت المواقيت والأيام الرسمية المعتمدة لنظام الجداول (Djadwal)
 * كلية العلوم الدقيقة والعلوم التطبيقية - جامعة الشهيد حمه لخضر - الوادي
 * 
 * الحصص الرسمية الإلزامية: 6 حصص يومياً (مدة كل حصة 1h30m بتسلسل مستمر من 08:00 إلى 17:00)
 */

export interface TimeSlot {
  id: number;
  start: string;
  end: string;
  label: string;
  periodName: string;
}

export interface DayOfWeek {
  id: number;
  name: string;
  shortName: string;
}

// 6 الحصص الرسمية المعتمدة
export const TIME_SLOTS: TimeSlot[] = [
  { id: 0, start: '08:00', end: '09:30', label: '08:00 - 09:30', periodName: 'الحصة الأولى' },
  { id: 1, start: '09:30', end: '11:00', label: '09:30 - 11:00', periodName: 'الحصة الثانية' },
  { id: 2, start: '11:00', end: '12:30', label: '11:00 - 12:30', periodName: 'الحصة الثالثة' },
  { id: 3, start: '12:30', end: '14:00', label: '12:30 - 14:00', periodName: 'الحصة الرابعة' },
  { id: 4, start: '14:00', end: '15:30', label: '14:00 - 15:30', periodName: 'الحصة الخامسة' },
  { id: 5, start: '15:30', end: '17:00', label: '15:30 - 17:00', periodName: 'الحصة السادسة' },
];

// أيام الأسبوع المعتمدة (السبت إلى الخميس)
export const DAYS: DayOfWeek[] = [
  { id: 0, name: 'السبت', shortName: 'سبت' },
  { id: 1, name: 'الأحد', shortName: 'أحد' },
  { id: 2, name: 'الاثنين', shortName: 'اثنين' },
  { id: 3, name: 'الثلاثاء', shortName: 'ثلاثاء' },
  { id: 4, name: 'الأربعاء', shortName: 'أربعاء' },
  { id: 5, name: 'الخميس', shortName: 'خميس' },
];

/**
 * تحويل التوقيت النصي (HH:MM أو HH:MM:SS) إلى دقائق منذ بداية اليوم
 */
export function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * تحويل تمثيل اليوم (سواء رقم 0..6 أو نص عربي) إلى رقم قياسي 0..6
 */
export function normalizeDay(day: number | string): number {
  if (typeof day === 'number') return day;
  if (!day) return -1;
  const map: Record<string, number> = {
    'السبت': 0,
    'الأحد': 1,
    'الاثنين': 2,
    'الإثنين': 2,
    'الثلاثاء': 3,
    'الأربعاء': 4,
    'الخميس': 5,
    'الجمعة': 6,
  };
  const trimmed = String(day).trim();
  if (trimmed in map) return map[trimmed];
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? -1 : parsed;
}

/**
 * فحص مطابقة وقت الحصة مع الفترة الزمنية الرسمية
 * يدعم التوقيت المعتمد (08:00، 09:30، 11:00...) وكذلك معالجة أي إزاحات دقيقة قديمة (مثل 09:35)
 */
export function matchesSlot(
  sessionStart: string,
  slotStart: string,
  slotEnd: string,
  sessionEnd?: string
): boolean {
  if (!sessionStart) return false;

  const sStart = timeToMinutes(sessionStart);
  const slStart = timeToMinutes(slotStart);
  const slEnd = timeToMinutes(slotEnd);

  // 1. تطابق مباشر أو شبه مباشر مع بداية الحصة (هامش ±15 دقيقة)
  if (Math.abs(sStart - slStart) <= 15) {
    return true;
  }

  // 2. تطابق بادئة السلسلة (مثلاً "08:00:00" مع "08:00")
  if (sessionStart.slice(0, 5) === slotStart.slice(0, 5)) {
    return true;
  }

  // 3. وقوع وقت البدء ضمن نافذة الحصة
  if (sStart >= slStart && sStart < slEnd) {
    return true;
  }

  // 4. تقاطع زمني كافٍ (30 دقيقة على الأقل) في حال توفر وقت النهاية
  if (sessionEnd) {
    const sEnd = timeToMinutes(sessionEnd);
    const overlapStart = Math.max(sStart, slStart);
    const overlapEnd = Math.min(sEnd, slEnd);
    if (overlapEnd - overlapStart >= 30) {
      return true;
    }
  }

  return false;
}

