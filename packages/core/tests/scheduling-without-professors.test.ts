import { describe, it, expect } from 'vitest';
import {
  solveSchedule,
  detectExplainableConflicts,
  buildConstraints,
  SchedulingTask,
  generateScheduleSchema
} from '../src/index.js';

describe('P18: Auto-Scheduling for Courses Without Assigned Professors (توليد دون إسناد للأساتذة)', () => {
  // Test 1: API validation schema accepts without_professors flag
  it('validates generateScheduleSchema with without_professors boolean flag', () => {
    const parsed = generateScheduleSchema.parse({
      semester_id: 1,
      mode: 'fast',
      without_professors: true
    });
    expect(parsed.without_professors).toBe(true);

    const defaultParsed = generateScheduleSchema.parse({
      semester_id: 1
    });
    expect(defaultParsed.without_professors).toBe(false);
  });

  // Test 2: Conflict detector never flags false professor overlap when professorId is null/undefined
  it('does NOT trigger professor overlap conflict when multiple tasks have null or undefined professorId', () => {
    const tasks: SchedulingTask[] = [
      {
        id: 'task-1',
        courseId: 101,
        courseName: 'خوارزميات 1',
        professorId: null as any,
        professorName: 'دون إسناد (قيد التعيين)',
        groupId: 1,
        groupName: 'فوج 1',
        sessionType: 'lecture',
        durationMinutes: 90,
        studentCount: 30,
        assignedSlot: { dayOfWeek: 0, startTime: '08:00', endTime: '09:30' },
        assignedRoomId: 201,
        assignedRoomName: 'قاعة 201'
      },
      {
        id: 'task-2',
        courseId: 102,
        courseName: 'فيزياء 1',
        professorId: null as any,
        professorName: 'دون إسناد (قيد التعيين)',
        groupId: 2,
        groupName: 'فوج 2',
        sessionType: 'lecture',
        durationMinutes: 90,
        studentCount: 30,
        assignedSlot: { dayOfWeek: 0, startTime: '08:00', endTime: '09:30' }, // Same slot, different room & group
        assignedRoomId: 202,
        assignedRoomName: 'قاعة 202'
      }
    ];

    const conflicts = detectExplainableConflicts(tasks);
    const profOverlap = conflicts.find(c => c.type === 'PROFESSOR_OVERLAP');
    expect(profOverlap).toBeUndefined();
    expect(conflicts.length).toBe(0);
  });

  // Test 3: Group and Room conflicts are still strictly detected even with null professor
  it('still detects room collision when two unassigned sessions share the same room at the same time', () => {
    const tasks: SchedulingTask[] = [
      {
        id: 't-a',
        courseId: 101,
        courseName: 'إحصاء 1',
        professorId: null as any,
        professorName: 'دون إسناد (قيد التعيين)',
        groupId: 1,
        groupName: 'فوج 1',
        sessionType: 'td',
        durationMinutes: 90,
        studentCount: 30,
        assignedSlot: { dayOfWeek: 1, startTime: '10:00', endTime: '11:30' },
        assignedRoomId: 15,
        assignedRoomName: 'قاعة 15'
      },
      {
        id: 't-b',
        courseId: 102,
        courseName: 'اقتصاد جزئي',
        professorId: null as any,
        professorName: 'دون إسناد (قيد التعيين)',
        groupId: 2,
        groupName: 'فوج 2',
        sessionType: 'td',
        durationMinutes: 90,
        studentCount: 30,
        assignedSlot: { dayOfWeek: 1, startTime: '10:00', endTime: '11:30' }, // Overlap in same room!
        assignedRoomId: 15,
        assignedRoomName: 'قاعة 15'
      }
    ];

    const conflicts = detectExplainableConflicts(tasks);
    const roomOverlap = conflicts.find(c => c.type === 'ROOM_OVERLAP');
    expect(roomOverlap).toBeDefined();
    expect(roomOverlap?.severity).toBe('CRITICAL');
  });

  // Test 4: Solver successfully schedules multiple unassigned courses across groups and rooms
  it('solves timetable with unassigned professors allocating valid rooms and slots without false blockage', () => {
    const tasks: SchedulingTask[] = [
      {
        id: 's1',
        courseId: 10,
        courseName: 'محاسبة عامة 1',
        professorId: null as any,
        professorName: 'دون إسناد (قيد التعيين)',
        groupId: 1,
        groupName: 'فوج 1 مالية',
        sessionType: 'lecture',
        durationMinutes: 90,
        studentCount: 40
      },
      {
        id: 's2',
        courseId: 11,
        courseName: 'قانون تجاري',
        professorId: null as any,
        professorName: 'دون إسناد (قيد التعيين)',
        groupId: 1,
        groupName: 'فوج 1 مالية',
        sessionType: 'td',
        durationMinutes: 90,
        studentCount: 40
      },
      {
        id: 's3',
        courseId: 10,
        courseName: 'محاسبة عامة 1',
        professorId: null as any,
        professorName: 'دون إسناد (قيد التعيين)',
        groupId: 2,
        groupName: 'فوج 2 تسويق',
        sessionType: 'lecture',
        durationMinutes: 90,
        studentCount: 40
      },
      {
        id: 's4',
        courseId: 12,
        courseName: 'إعلام آلي مكتبي',
        professorId: null as any,
        professorName: 'دون إسناد (قيد التعيين)',
        groupId: 2,
        groupName: 'فوج 2 تسويق',
        sessionType: 'tp',
        durationMinutes: 90,
        studentCount: 25
      }
    ];

    const constraints = buildConstraints({
      rooms: [
        { id: 1, name: 'مدرج A', capacity: 100, roomType: 'amphi' },
        { id: 2, name: 'قاعة 01', capacity: 45, roomType: 'standard' },
        { id: 3, name: 'قاعة 02', capacity: 45, roomType: 'standard' },
        { id: 4, name: 'مخبر إعلام آلي 1', capacity: 30, roomType: 'lab_tp' }
      ],
      groups: [
        { id: 1, name: 'فوج 1 مالية', studentCount: 40 },
        { id: 2, name: 'فوج 2 تسويق', studentCount: 40 }
      ],
      courses: [
        { id: 10, name: 'محاسبة عامة 1' },
        { id: 11, name: 'قانون تجاري' },
        { id: 12, name: 'إعلام آلي مكتبي' }
      ]
    });

    const result = solveSchedule(tasks, constraints, { mode: 'fast' });
    expect(['OPTIMAL', 'FEASIBLE']).toContain(result.status);
    expect(result.tasks.every(t => t.assignedSlot !== undefined)).toBe(true);
    expect(result.tasks.every(t => t.assignedRoomId !== undefined)).toBe(true);

    // Verify zero critical conflicts in generated schedule
    const conflicts = detectExplainableConflicts(result.tasks, constraints);
    const criticalConflicts = conflicts.filter(c => c.severity === 'CRITICAL');
    expect(criticalConflicts.length).toBe(0);

    // Verify TP session got lab_tp room
    const tpTask = result.tasks.find(t => t.sessionType === 'tp');
    expect(tpTask?.assignedRoomId).toBe(4);
  });
});
