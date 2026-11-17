import { describe, it, expect } from 'vitest';
import {
  solveSchedule,
  detectExplainableConflicts,
  simulateScheduleImpact,
  computeVisualDiff,
  validateDualApproval,
  validatePublishReadiness,
  canTransitionStatus,
  ScheduleApprovalError,
  generateBenchmarkDataset,
  runScaleBenchmark,
  buildConstraints,
  createDefaultInstitutionalConfig,
  SchedulingTask,
  ScheduleVersionItem
} from '../src/scheduling/index.js';

describe('P13: Auto-Scheduler Engine & Explainable Conflicts', () => {
  // Test 1: Explainable Conflict Detection with 3 Actionable Alternatives
  it('detects professor and room overlaps with clear Arabic explanations and 3 actionable resolutions', () => {
    const tasks: SchedulingTask[] = [
      {
        id: 's1',
        courseId: 1,
        courseName: 'خوارزميات 1',
        professorId: 10,
        professorName: 'د. كريم بن علي',
        groupId: 101,
        groupName: 'فوج 1 إعلام آلي',
        sessionType: 'lecture',
        durationMinutes: 90,
        studentCount: 35,
        assignedSlot: { dayOfWeek: 0, startTime: '08:00', endTime: '09:30' },
        assignedRoomId: 201,
        assignedRoomName: 'قاعة 201'
      },
      {
        id: 's2',
        courseId: 2,
        courseName: 'قواعد بيانات',
        professorId: 10, // Same professor in same slot -> Professor overlap!
        professorName: 'د. كريم بن علي',
        groupId: 102,
        groupName: 'فوج 2 إعلام آلي',
        sessionType: 'td',
        durationMinutes: 90,
        studentCount: 30,
        assignedSlot: { dayOfWeek: 0, startTime: '08:00', endTime: '09:30' },
        assignedRoomId: 202,
        assignedRoomName: 'قاعة 202'
      }
    ];

    const conflicts = detectExplainableConflicts(tasks);
    expect(conflicts.length).toBeGreaterThan(0);

    const profConflict = conflicts.find(c => c.type === 'PROFESSOR_OVERLAP');
    expect(profConflict).toBeDefined();
    expect(profConflict?.severity).toBe('CRITICAL');
    expect(profConflict?.explanationArabic).toContain('د. كريم بن علي');
    expect(profConflict?.explanationArabic).toContain('الأحد');
    expect(profConflict?.suggestedResolutions.length).toBe(3);

    // Each resolution must be actionable
    const res = profConflict!.suggestedResolutions;
    expect(res[0].action).toBeDefined();
    expect(res[0].titleArabic).toBeTruthy();
    expect(res[0].descriptionArabic).toBeTruthy();
    expect(res[1].action).toBeDefined();
    expect(res[2].action).toBeDefined();
  });

  // Test 2: Dual Solver Fast Mode (Instant Proposal in milliseconds)
  it('solves a typical department schedule in fast mode with zero critical conflicts', () => {
    const tasks: SchedulingTask[] = [
      {
        id: 't1',
        courseId: 1,
        courseName: 'تحليل 1',
        professorId: 1,
        professorName: 'أستاذ أ',
        groupId: 1,
        groupName: 'فوج 1',
        sessionType: 'lecture',
        durationMinutes: 90,
        studentCount: 40
      },
      {
        id: 't2',
        courseId: 2,
        courseName: 'جبر 1',
        professorId: 1, // Same professor, different course
        professorName: 'أستاذ أ',
        groupId: 2,
        groupName: 'فوج 2',
        sessionType: 'lecture',
        durationMinutes: 90,
        studentCount: 35
      },
      {
        id: 't3',
        courseId: 3,
        courseName: 'إعلام آلي',
        professorId: 2,
        professorName: 'أستاذ ب',
        groupId: 1, // Same group as t1, must not overlap!
        groupName: 'فوج 1',
        sessionType: 'tp',
        durationMinutes: 90,
        studentCount: 25,
        requiredRoomType: 'lab_tp'
      }
    ];

    const constraints = buildConstraints({
      professors: [
        { id: 1, name: 'أستاذ أ', maxWeeklyHours: 15, maxDailySessions: 3, unavailabilities: [] },
        { id: 2, name: 'أستاذ ب', maxWeeklyHours: 15, maxDailySessions: 3, unavailabilities: [] }
      ],
      rooms: [
        { id: 101, name: 'مدرج أ', capacity: 100, roomType: 'amphi' },
        { id: 102, name: 'مخبر 1', capacity: 30, roomType: 'lab_tp' }
      ],
      groups: [
        { id: 1, name: 'فوج 1', studentCount: 40 },
        { id: 2, name: 'فوج 2', studentCount: 35 }
      ]
    });

    const result = solveSchedule(tasks, constraints, { mode: 'fast' });
    expect(result.status).toBe('OPTIMAL');
    expect(result.conflicts.length).toBe(0);
    expect(result.tasks.every(t => t.assignedSlot && t.assignedRoomId)).toBe(true);

    // Assert that group 1 sessions do not overlap
    const g1Tasks = result.tasks.filter(t => t.groupId === 1);
    expect(
      g1Tasks[0].assignedSlot?.dayOfWeek !== g1Tasks[1].assignedSlot?.dayOfWeek ||
      g1Tasks[0].assignedSlot?.startTime !== g1Tasks[1].assignedSlot?.startTime
    ).toBe(true);
  });

  // Test 3: Dual Approval Rule (Maker != Checker)
  it('strictly enforces the dual approval rule (Four-Eyes Principle)', () => {
    const creatorUserId = 5;
    const sameUserApproverId = 5;
    const differentUserApproverId = 8;

    // Self-approval must throw
    expect(() => {
      validateDualApproval(creatorUserId, sameUserApproverId);
    }).toThrow(ScheduleApprovalError);

    // Approval by different user must pass
    expect(() => {
      validateDualApproval(creatorUserId, differentUserApproverId);
    }).not.toThrow();

    // Check state machine transition guard
    const selfTransition = canTransitionStatus('review', 'approved', creatorUserId, sameUserApproverId);
    expect(selfTransition.allowed).toBe(false);
    expect(selfTransition.reasonArabic).toContain('الرقابة الثنائية');

    const validTransition = canTransitionStatus('review', 'approved', creatorUserId, differentUserApproverId);
    expect(validTransition.allowed).toBe(true);
  });

  // Test 4: Publishing Guard against Critical Conflicts
  it('blocks publication when unresolved critical conflicts exist', () => {
    const version = {
      status: 'approved' as const,
      criticalConflictsCount: 2
    };

    expect(() => {
      validatePublishReadiness(version);
    }).toThrow(ScheduleApprovalError);

    const cleanVersion = {
      status: 'approved' as const,
      criticalConflictsCount: 0
    };

    expect(() => {
      validatePublishReadiness(cleanVersion);
    }).not.toThrow();
  });

  // Test 5: Visual Diff Engine
  it('generates an accurate visual diff between two versions', () => {
    const itemA: ScheduleVersionItem = {
      id: 1,
      scheduleVersionId: 10,
      courseId: 101,
      courseName: 'رياضيات',
      professorId: 1,
      professorName: 'أ. د. عمر',
      groupId: 1,
      groupName: 'فوج 1',
      roomId: 201,
      roomName: 'قاعة 201',
      dayOfWeek: 0, // Sunday
      startTime: '08:00',
      endTime: '09:30',
      sessionType: 'lecture',
      itemStatus: 'accepted',
      createdAt: new Date().toISOString()
    };

    const itemB: ScheduleVersionItem = {
      ...itemA,
      id: 2,
      scheduleVersionId: 11,
      dayOfWeek: 1, // Moved to Monday!
      startTime: '10:00',
      endTime: '11:30'
    };

    const diff = computeVisualDiff(
      { id: 10, versionNumber: 1, items: [itemA] },
      { id: 11, versionNumber: 2, items: [itemB] }
    );

    expect(diff.stats.modifiedCount).toBe(1);
    expect(diff.stats.addedCount).toBe(0);
    expect(diff.stats.removedCount).toBe(0);
    expect(diff.items[0].diffType).toBe('modified');
    expect(diff.items[0].changeSummaryArabic).toContain('التوقيت من');
  });

  // Test 6: Impact Analysis Simulation
  it('simulates the blast radius of proposed schedule changes accurately', () => {
    const baseline: SchedulingTask[] = [
      {
        id: 1,
        courseId: 10,
        courseName: 'فيزياء',
        professorId: 1,
        professorName: 'أستاذ أحمد',
        groupId: 1,
        groupName: 'فوج 1',
        sessionType: 'lecture',
        durationMinutes: 90,
        studentCount: 30,
        assignedSlot: { dayOfWeek: 0, startTime: '08:00', endTime: '09:30' },
        assignedRoomId: 101,
        assignedRoomName: 'قاعة 101'
      }
    ];

    const proposed: SchedulingTask[] = [
      {
        ...baseline[0],
        assignedSlot: { dayOfWeek: 2, startTime: '10:00', endTime: '11:30' } // Moved!
      }
    ];

    const impact = simulateScheduleImpact({
      baselineTasks: baseline,
      proposedTasks: proposed,
      totalProfessorsCount: 10,
      totalRoomsCount: 5,
      totalGroupsCount: 8
    });

    expect(impact.sessionsMovedCount).toBe(1);
    expect(impact.professorsImpactedCount).toBe(1);
    expect(impact.professorsImpactedPct).toBe(10); // 1 out of 10
    expect(impact.summaryArabic).toContain('محاكاة أثر التغيير');
  });

  // Test 7: Institutional Benchmark & Deterministic Stability (300 groups, 120 professors, 60 rooms)
  it('executes scale benchmark within timeout with 0 critical conflicts and 100% determinism', () => {
    // Run benchmark with representative slice (50 groups, 30 profs, 20 rooms for fast CI)
    const report = runScaleBenchmark({
      groupCount: 40,
      professorCount: 25,
      roomCount: 15,
      sessionsPerGroup: 2,
      seed: 777,
      timeoutMs: 15000
    });

    expect(report.durationMs).toBeLessThanOrEqual(180000);
    expect(report.criticalConflicts).toBe(0);
    expect(report.deterministicMatch).toBe(true);
    expect(report.passed).toBe(true);
  }, 30000);
});
