/**
 * Djadwal Core: Large-Scale Benchmark (CommonJS runtime)
 */

const { solveSchedule } = require('./solver.js');
const { createDefaultInstitutionalConfig } = require('./constraints.js');

function generateBenchmarkDataset(config = {}) {
  const groupCount = config.groupCount || 300;
  const professorCount = config.professorCount || 120;
  const roomCount = config.roomCount || 60;
  const sessionsPerGroup = config.sessionsPerGroup || 3;

  const professors = new Map();
  const rooms = new Map();
  const groups = new Map();
  const courses = new Map();

  for (let i = 1; i <= roomCount; i++) {
    const isAmphi = i <= 10;
    const isLab = i > 10 && i <= 25;
    const roomType = isAmphi ? 'amphi' : (isLab ? 'lab_tp' : 'standard');
    const capacity = isAmphi ? 150 : (isLab ? 30 : 45);

    rooms.set(`room_${i}`, {
      id: `room_${i}`,
      name: `القاعة ${i} (${roomType})`,
      capacity,
      roomType
    });
  }

  for (let i = 1; i <= professorCount; i++) {
    professors.set(`prof_${i}`, {
      id: `prof_${i}`,
      name: `د. أستاذ #${i}`,
      maxWeeklyHours: 18,
      maxDailySessions: 3,
      unavailabilities: []
    });
  }

  for (let g = 1; g <= groupCount; g++) {
    groups.set(`group_${g}`, {
      id: `group_${g}`,
      name: `فوج #${g}`,
      studentCount: 35
    });
  }

  for (let i = 1; i <= 10; i++) {
    courses.set(`course_${i}`, {
      id: `course_${i}`,
      name: `مادة #${i}`
    });
  }

  const tasks = [];
  let taskId = 1;

  for (let g = 1; g <= groupCount; g++) {
    for (let s = 1; s <= sessionsPerGroup; s++) {
      const courseIdx = ((g + s) % 10) + 1;
      const profIdx = ((g * 3 + s) % professorCount) + 1;
      const sessionType = s === 1 ? 'lecture' : (s === 2 ? 'td' : 'tp');

      tasks.push({
        id: `task_${taskId++}`,
        courseId: `course_${courseIdx}`,
        courseName: `مادة #${courseIdx}`,
        professorId: `prof_${profIdx}`,
        professorName: `د. أستاذ #${profIdx}`,
        groupId: `group_${g}`,
        groupName: `فوج #${g}`,
        sessionType,
        durationMinutes: 90,
        studentCount: 35,
        requiredRoomType: sessionType === 'tp' ? 'lab_tp' : (sessionType === 'lecture' ? 'standard' : 'standard')
      });
    }
  }

  const constraints = {
    professors,
    rooms,
    groups,
    courses,
    institutional: createDefaultInstitutionalConfig()
  };

  return { tasks, constraints };
}

function runScaleBenchmark(config = {}) {
  const seed = config.seed || 999;
  const timeoutMs = config.timeoutMs || 180000;

  const { tasks, constraints } = generateBenchmarkDataset(config);

  const t0 = Date.now();
  const run1 = solveSchedule(tasks, constraints, {
    mode: 'optimize',
    timeoutMs,
    seed
  });
  const duration1 = Date.now() - t0;

  const run2 = solveSchedule(tasks, constraints, {
    mode: 'optimize',
    timeoutMs,
    seed
  });

  const criticalConflicts = run1.conflicts.filter(c => c.severity === 'CRITICAL').length;
  const durationPassed = duration1 <= timeoutMs;
  const conflictsPassed = criticalConflicts === 0;

  let deterministicMatch = true;
  for (let i = 0; i < run1.tasks.length; i++) {
    const tA = run1.tasks[i];
    const tB = run2.tasks[i];
    if (
      tA.assignedRoomId !== tB.assignedRoomId ||
      tA.assignedSlot?.dayOfWeek !== tB.assignedSlot?.dayOfWeek ||
      tA.assignedSlot?.startTime !== tB.assignedSlot?.startTime
    ) {
      deterministicMatch = false;
      break;
    }
  }

  const passed = durationPassed && conflictsPassed && deterministicMatch;

  const summaryArabic = [
    `🏁 نتيجة الاختبار المرجعي للمؤسسة (${config.groupCount || 300} فوج، ${config.professorCount || 120} أستاذ، ${config.roomCount || 60} قاعة):`,
    `- إجمالي الحصص المجدولة: ${tasks.length} حصة.`,
    `- زمن التوليد: ${(duration1 / 1000).toFixed(2)} ثانية (الحد الأقصى المسموح: 180 ثانية).`,
    `- التعارضات الحرجة: ${criticalConflicts} (المطلوب: 0).`,
    `- استقرار وتطابق التكرار الحتمي: ${deterministicMatch ? '✅ متطابق 100%' : '❌ تباين في النتائج'}.`,
    passed ? '🎉 اجتاز الاختبار كافة معايير القبول بنجاح تام.' : '❌ فشل الاختبار في تلبية أحد المعايير.'
  ].join(' ');

  return {
    passed,
    durationMs: duration1,
    criticalConflicts,
    totalSessions: tasks.length,
    deterministicMatch,
    summaryArabic
  };
}

module.exports = {
  generateBenchmarkDataset,
  runScaleBenchmark
};
