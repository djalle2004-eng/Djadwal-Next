/**
 * Djadwal Core: Scheduling Constraints (CommonJS runtime)
 */

const DEFAULT_STANDARD_SLOTS = [
  { startTime: '08:00', endTime: '09:30' },
  { startTime: '09:40', endTime: '11:10' },
  { startTime: '11:20', endTime: '12:50' },
  { startTime: '13:00', endTime: '14:30' },
  { startTime: '14:40', endTime: '16:10' },
  { startTime: '16:20', endTime: '17:50' }
];

const DEFAULT_BLOCKED_SLOTS = [
  {
    dayOfWeek: 5,
    startTime: '11:30',
    endTime: '14:30',
    reasonArabic: 'فترة صلاة الجمعة والغداء الأسبوعي'
  }
];

const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4];

function createDefaultInstitutionalConfig() {
  return {
    blockedSlots: [...DEFAULT_BLOCKED_SLOTS],
    workingDays: [...DEFAULT_WORKING_DAYS],
    standardSlots: [...DEFAULT_STANDARD_SLOTS]
  };
}

function generateTimetableGrid(config = createDefaultInstitutionalConfig()) {
  const slots = [];
  let index = 0;

  for (const day of config.workingDays) {
    for (const slot of config.standardSlots) {
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

function isTimeOverlapping(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function getDayNameArabic(dayOfWeek) {
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

function isRoomTypeCompatible(roomType, sessionType) {
  const normRoom = (roomType || '').toLowerCase();
  const normSession = (sessionType || '').toLowerCase();

  if (normSession === 'tp' || normSession === 'lab') {
    return normRoom.includes('tp') || normRoom.includes('lab') || normRoom.includes('مخبر');
  }

  if (normSession === 'lecture' || normSession === 'cours') {
    return normRoom.includes('amphi') || normRoom.includes('مدرج') || normRoom.includes('lecture') || normRoom === 'standard';
  }

  return !normRoom.includes('lab') && !normRoom.includes('مخبر');
}

function buildConstraints(params = {}) {
  const professors = new Map();
  const rooms = new Map();
  const groups = new Map();
  const courses = new Map();

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

module.exports = {
  DEFAULT_STANDARD_SLOTS,
  DEFAULT_BLOCKED_SLOTS,
  DEFAULT_WORKING_DAYS,
  createDefaultInstitutionalConfig,
  generateTimetableGrid,
  isTimeOverlapping,
  getDayNameArabic,
  isRoomTypeCompatible,
  buildConstraints
};
