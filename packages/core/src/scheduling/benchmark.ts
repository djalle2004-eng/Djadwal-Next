/**
 * Djadwal Core: Large-Scale Scheduling Benchmark (P13)
 * Stress-tests the dual solver on an institutional load of:
 * 300 student groups, 120 professors, 60 rooms.
 * Validates generation with 0 critical conflicts in <= 3 minutes,
 * and confirms 100% deterministic stability between consecutive runs.
 */

import {
  SchedulingTask,
  SchedulingConstraints,
  ProfessorProfile,
  RoomProfile,
  GroupProfile,
  CourseProfile
} from './types.js';
import { solveSchedule, SolverResult } from './solver.js';
import { createDefaultInstitutionalConfig } from './constraints.js';

export interface BenchmarkConfig {
  groupCount?: number;     // Default 300
  professorCount?: number; // Default 120
  roomCount?: number;      // Default 60
  sessionsPerGroup?: number; // Default 3
  seed?: number;
  timeoutMs?: number;      // Default 180,000 ms (3 minutes)
}

export interface BenchmarkReport {
  passed: boolean;
  durationMs: number;
  criticalConflicts: number;
  totalSessions: number;
  deterministicMatch: boolean;
  summaryArabic: string;
}

/**
 * Synthesizes a realistic institutional dataset for benchmarking
 */
export function generateBenchmarkDataset(config: BenchmarkConfig = {}): {
  tasks: SchedulingTask[];
  constraints: SchedulingConstraints;
} {
  const groupCount = config.groupCount || 300;
  const professorCount = config.professorCount || 120;
  const roomCount = config.roomCount || 60;
  const sessionsPerGroup = config.sessionsPerGroup || 3;

  const professors = new Map<string, ProfessorProfile>();
  const rooms = new Map<string, RoomProfile>();
  const groups = new Map<string, GroupProfile>();
  const courses = new Map<string, CourseProfile>();

  // 1. Generate Rooms
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

  // 2. Generate Professors
  for (let i = 1; i <= professorCount; i++) {
    professors.set(`prof_${i}`, {
      id: `prof_${i}`,
      name: `د. أستاذ #${i}`,
      maxWeeklyHours: 18,
      maxDailySessions: 3,
      unavailabilities: []
    });
  }

  // 3. Generate Groups & Courses
  for (let i = 1; i <= groupCount; i++) {
    groups.set(`group_${i}`, {
      id: `group_${i}`,
      name: `فوج #${i}`,
      studentCount: 35
    });
  }

  // 10 Standard subjects
  for (let i = 1; i <= 10; i++) {
    courses.set(`course_${i}`, {
      id: `course_${i}`,
      name: `مادة #${i}`
    });
  }

  // 4. Generate Scheduling Tasks (demands)
  const tasks: SchedulingTask[] = [];
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

  const constraints: SchedulingConstraints = {
    professors,
    rooms,
    groups,
    courses,
    institutional: createDefaultInstitutionalConfig()
  };

  return { tasks, constraints };
}

/**
 * Runs the scale benchmark and asserts performance & determinism
 */
export function runScaleBenchmark(config: BenchmarkConfig = {}): BenchmarkReport {
  const seed = config.seed || 999;
  const timeoutMs = config.timeoutMs || 180000; // 3 minutes max

  const { tasks, constraints } = generateBenchmarkDataset(config);

  // Run 1
  const t0 = Date.now();
  const run1: SolverResult = solveSchedule(tasks, constraints, {
    mode: 'optimize',
    timeoutMs,
    seed
  });
  const duration1 = Date.now() - t0;

  // Run 2 (Testing Determinism & Stability with same seed)
  const run2: SolverResult = solveSchedule(tasks, constraints, {
    mode: 'optimize',
    timeoutMs,
    seed
  });

  const criticalConflicts = run1.conflicts.filter(c => c.severity === 'CRITICAL').length;
  const durationPassed = duration1 <= timeoutMs;
  const conflictsPassed = criticalConflicts === 0;

  // Check 100% equality between run1 and run2 assignments
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
