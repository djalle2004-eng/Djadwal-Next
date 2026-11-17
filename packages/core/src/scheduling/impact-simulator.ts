/**
 * Djadwal Core: Impact Analysis Simulator (P13)
 * Evaluates the organizational blast radius before applying schedule changes.
 * Computes exact affected counts and percentages for professors, rooms, and groups.
 */

import {
  SchedulingTask,
  ImpactSimulationResult,
  ExplainableConflict,
  SchedulingConstraints
} from './types.js';
import { detectExplainableConflicts } from './explainable-conflict-detector.js';

export function simulateScheduleImpact(params: {
  baselineTasks: SchedulingTask[];
  proposedTasks: SchedulingTask[];
  constraints?: SchedulingConstraints;
  totalProfessorsCount?: number;
  totalRoomsCount?: number;
  totalGroupsCount?: number;
}): ImpactSimulationResult {
  const { baselineTasks, proposedTasks, constraints } = params;

  // Build baseline mapping by business key: courseId:groupId:sessionType
  const baselineMap = new Map<string, SchedulingTask>();
  baselineTasks.forEach(t => {
    baselineMap.set(`${t.courseId}:${t.groupId}:${t.sessionType || 'lecture'}`, t);
  });

  const impactedProfessors = new Set<string>();
  const impactedRooms = new Set<string>();
  const impactedGroups = new Set<string>();

  let sessionsMovedCount = 0;
  let sessionsAddedCount = 0;
  let sessionsRemovedCount = 0;

  const matchedKeys = new Set<string>();

  for (const proposed of proposedTasks) {
    const key = `${proposed.courseId}:${proposed.groupId}:${proposed.sessionType || 'lecture'}`;
    matchedKeys.add(key);

    const baseline = baselineMap.get(key);

    if (!baseline) {
      // Added
      sessionsAddedCount++;
      if (proposed.professorName || proposed.professorId) impactedProfessors.add(String(proposed.professorName || proposed.professorId));
      if (proposed.assignedRoomName || proposed.assignedRoomId) impactedRooms.add(String(proposed.assignedRoomName || proposed.assignedRoomId));
      if (proposed.groupName || proposed.groupId) impactedGroups.add(String(proposed.groupName || proposed.groupId));
    } else {
      // Compare slot, room, professor
      const slotChanged =
        baseline.assignedSlot?.dayOfWeek !== proposed.assignedSlot?.dayOfWeek ||
        baseline.assignedSlot?.startTime !== proposed.assignedSlot?.startTime ||
        baseline.assignedSlot?.endTime !== proposed.assignedSlot?.endTime;

      const roomChanged = String(baseline.assignedRoomId) !== String(proposed.assignedRoomId);
      const profChanged = String(baseline.professorId) !== String(proposed.professorId);

      if (slotChanged || roomChanged || profChanged) {
        sessionsMovedCount++;
        if (proposed.professorName || proposed.professorId) impactedProfessors.add(String(proposed.professorName || proposed.professorId));
        if (proposed.assignedRoomName || proposed.assignedRoomId) impactedRooms.add(String(proposed.assignedRoomName || proposed.assignedRoomId));
        if (proposed.groupName || proposed.groupId) impactedGroups.add(String(proposed.groupName || proposed.groupId));

        if (baseline.professorName || baseline.professorId) impactedProfessors.add(String(baseline.professorName || baseline.professorId));
        if (baseline.assignedRoomName || baseline.assignedRoomId) impactedRooms.add(String(baseline.assignedRoomName || baseline.assignedRoomId));
        if (baseline.groupName || baseline.groupId) impactedGroups.add(String(baseline.groupName || baseline.groupId));
      }
    }
  }

  // Count removed
  for (const [key, baseline] of baselineMap.entries()) {
    if (!matchedKeys.has(key)) {
      sessionsRemovedCount++;
      if (baseline.professorName || baseline.professorId) impactedProfessors.add(String(baseline.professorName || baseline.professorId));
      if (baseline.assignedRoomName || baseline.assignedRoomId) impactedRooms.add(String(baseline.assignedRoomName || baseline.assignedRoomId));
      if (baseline.groupName || baseline.groupId) impactedGroups.add(String(baseline.groupName || baseline.groupId));
    }
  }

  // Calculate percentages
  const totalProfs = params.totalProfessorsCount || Math.max(1, impactedProfessors.size, constraints?.professors?.size || 1);
  const totalRooms = params.totalRoomsCount || Math.max(1, impactedRooms.size, constraints?.rooms?.size || 1);
  const totalGroups = params.totalGroupsCount || Math.max(1, impactedGroups.size, constraints?.groups?.size || 1);

  const profPct = Math.round((impactedProfessors.size / totalProfs) * 100);
  const roomPct = Math.round((impactedRooms.size / totalRooms) * 100);
  const groupPct = Math.round((impactedGroups.size / totalGroups) * 100);

  // Conflicts comparison
  const baselineConflicts = detectExplainableConflicts(baselineTasks, constraints);
  const proposedConflicts = detectExplainableConflicts(proposedTasks, constraints);
  const netConflictReduction = baselineConflicts.length - proposedConflicts.length;

  const profNames = Array.from(impactedProfessors);
  const roomNames = Array.from(impactedRooms);
  const groupNames = Array.from(impactedGroups);

  const summaryArabic = [
    `📊 محاكاة أثر التغيير: التعديل المقترح يؤثر على ${impactedProfessors.size} أستاذ (${profPct}%)،`,
    `و ${impactedRooms.size} قاعة (${roomPct}%)، و ${impactedGroups.size} فوج (${groupPct}%).`,
    `عدد الحصص المنقولة: ${sessionsMovedCount}، المضافة: ${sessionsAddedCount}، المحذوفة: ${sessionsRemovedCount}.`,
    netConflictReduction > 0
      ? `✅ يخفض التعديل صافي التعارضات بمقدار ${netConflictReduction} تعارض.`
      : (netConflictReduction === 0 ? `التعارضات مستقرة دون تغيير.` : `⚠️ يزيد التعديل التعارضات بمقدار ${Math.abs(netConflictReduction)}.`)
  ].join(' ');

  return {
    professorsImpactedCount: impactedProfessors.size,
    professorsImpactedPct: Math.min(100, profPct),
    professorsImpactedNames: profNames,
    roomsImpactedCount: impactedRooms.size,
    roomsImpactedPct: Math.min(100, roomPct),
    roomsImpactedNames: roomNames,
    groupsImpactedCount: impactedGroups.size,
    groupsImpactedPct: Math.min(100, groupPct),
    groupsImpactedNames: groupNames,
    sessionsMovedCount,
    sessionsAddedCount,
    sessionsRemovedCount,
    netConflictReduction,
    summaryArabic
  };
}
