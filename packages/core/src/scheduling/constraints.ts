/**
 * Djadwal Core: Scheduling Constraints & Timetable Grid Model (P13)
 */

import {
  TimeSlot,
  InstitutionalConfig,
  SchedulingConstraints,
  ProfessorProfile,
  RoomProfile,
  GroupProfile,
  CourseProfile
} from './types.js';

/**
 * Standard university slot intervals (Algerian higher education standard: 1h30 sessions with 10m buffer)
 */
export const DEFAULT_STANDARD_SLOTS = [
  { startTime: '08:00', endTime: '09:30' },
  { startTime: '09:40', endTime: '11:10' },
  { startTime: '11:20', endTime: '12:50' },
  { startTime: '13:00', endTime: '14:30' },
  { startTime: '14:40', endTime: '16:10' },
  { startTime: '16:20', endTime: '17:50' }
];

/**
 * Default institutional blocked slots (Friday prayer, Friday afternoon, lunch periods)
 */
export const DEFAULT_BLOCKED_SLOTS = [
  {
    dayOfWeek: 5, // Friday
    startTime: '11:30',
    endTime: '14:30',
    reasonArabic: 'فترة صلاة الجمعة والغداء الأسبوعي'
  }
];

export const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4]; // Sunday (0) to Thursday (4)

export function createDefaultInstitutionalConfig(): InstitutionalConfig {
  return {
    blockedSlots: [...DEFAULT_BLOCKED_SLOTS],
    workingDays: [...DEFAULT_WORKING_DAYS],
    standardSlots: [...DEFAULT_STANDARD_SLOTS]
  };
}

/**
 * Generates all discrete available time slots for the institution
 */
export function generateTimetableGrid(config: InstitutionalConfig = createDefaultInstitutionalConfig()): TimeSlot[] {
  const slots: TimeSlot[] = [];
  let index = 0;

  for (const day of config.workingDays) {
    for (const slot of config.standardSlots) {
      // Check if blocked
      const isBlocked = config.blockedSlots.some(
        b => b.dayOfWeek === day && isTimeOverlapping(slot.startTime, slot.endTime, b.startTime, b.endTime)
      );

      if (!isBlocked) {
        slots.push({
          dayOfWeek: day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotIndex: index++
        });
      }
    }
  }

  return slots;
}

/**
 * Checks whether two time intervals overlap (inclusive start, exclusive end)
 */
export function isTimeOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

/**
 * Translates Day of Week number to Arabic name
 */
export function getDayNameArabic(dayOfWeek: number | string): string {
  const d = Number(dayOfWeek);
  switch (d) {
    case 0: return 'الأحد';
    case 1: return 'الإثنين';
    case 2: return 'الثلاثاء';
    case 3: return 'الأربعاء';
    case 4: return 'الخميس';
    case 5: return 'الجمعة';
    case 6: return 'السبت';
    default: return `يوم ${dayOfWeek}`;
  }
}

/**
 * Validates whether a room type matches the requested session type
 */
export function isRoomTypeCompatible(roomType: string, sessionType: string): boolean {
  const normRoom = (roomType || '').toLowerCase();
  const normSession = (sessionType || '').toLowerCase();

  if (normSession === 'tp' || normSession === 'lab') {
    return normRoom.includes('tp') || normRoom.includes('lab') || normRoom.includes('مخبر');
  }

  if (normSession === 'lecture' || normSession === 'cours') {
    // Lectures prefer amphi or large halls, but can use standard if capacity allows
    return normRoom.includes('amphi') || normRoom.includes('مدرج') || normRoom.includes('lecture') || normRoom === 'standard';
  }

  // TD can fit in td_room or standard
  return !normRoom.includes('lab') && !normRoom.includes('مخبر');
}

/**
 * Build SchedulingConstraints dictionary from entity collections
 */
export function buildConstraints(params: {
  professors?: ProfessorProfile[];
  rooms?: RoomProfile[];
  groups?: GroupProfile[];
  courses?: CourseProfile[];
  institutional?: InstitutionalConfig;
}): SchedulingConstraints {
  const professors = new Map<string, ProfessorProfile>();
  const rooms = new Map<string, RoomProfile>();
  const groups = new Map<string, GroupProfile>();
  const courses = new Map<string, CourseProfile>();

  (params.professors || []).forEach(p => professors.set(String(p.id), p));
  (params.rooms || []).forEach(r => rooms.set(String(r.id), r));
  (params.groups || []).forEach(g => groups.set(String(g.id), g));
  (params.courses || []).forEach(c => courses.set(String(c.id), c));

  return {
    professors,
    rooms,
    groups,
    courses,
    institutional: params.institutional || createDefaultInstitutionalConfig()
  };
}
