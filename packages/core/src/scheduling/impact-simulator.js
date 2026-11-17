/**
 * Djadwal Core: Impact Simulator (CommonJS runtime)
 */

const { detectExplainableConflicts } = require('./explainable-conflict-detector.js');

function simulateScheduleImpact(params = {}) {
  const { baselineTasks = [], proposedTasks = [], constraints } = params;

  const baselineMap = new Map();
  baselineTasks.forEach(t => {
    baselineMap.set(`${t.courseId}:${t.groupId}:${t.sessionType || 'lecture'}`, t);
  });

  const impactedProfessors = new Set();
  const impactedRooms = new Set();
  const impactedGroups = new Set();

  let sessionsMovedCount = 0;
  let sessionsAddedCount = 0;
  let sessionsRemovedCount = 0;

  const matchedKeys = new Set();

  for (const proposed of proposedTasks) {
    const key = `${proposed.courseId}:${proposed.groupId}:${proposed.sessionType || 'lecture'}`;
    matchedKeys.add(key);

    const baseline = baselineMap.get(key);

    if (!baseline) {
      sessionsAddedCount++;
      if (proposed.professorName || proposed.professorId) impactedProfessors.add(String(proposed.professorName || proposed.professorId));
      if (proposed.assignedRoomName || proposed.assignedRoomId) impactedRooms.add(String(proposed.assignedRoomName || proposed.assignedRoomId));
      if (proposed.groupName || proposed.groupId) impactedGroups.add(String(proposed.groupName || proposed.groupId));
    } else {
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

  for (const [key, baseline] of baselineMap.entries()) {
    if (!matchedKeys.has(key)) {
      sessionsRemovedCount++;
      if (baseline.professorName || baseline.professorId) impactedProfessors.add(String(baseline.professorName || baseline.professorId));
      if (baseline.assignedRoomName || baseline.assignedRoomId) impactedRooms.add(String(baseline.assignedRoomName || baseline.assignedRoomId));
      if (baseline.groupName || baseline.groupId) impactedGroups.add(String(baseline.groupName || baseline.groupId));
    }
  }

  const totalProfs = params.totalProfessorsCount || Math.max(1, impactedProfessors.size, constraints?.professors?.size || 1);
  const totalRooms = params.totalRoomsCount || Math.max(1, impactedRooms.size, constraints?.rooms?.size || 1);
  const totalGroups = params.totalGroupsCount || Math.max(1, impactedGroups.size, constraints?.groups?.size || 1);

  const profPct = Math.round((impactedProfessors.size / totalProfs) * 100);
  const roomPct = Math.round((impactedRooms.size / totalRooms) * 100);
  const groupPct = Math.round((impactedGroups.size / totalGroups) * 100);

  const baselineConflicts = detectExplainableConflicts(baselineTasks, constraints);
  const proposedConflicts = detectExplainableConflicts(proposedTasks, constraints);
  const netConflictReduction = baselineConflicts.length - proposedConflicts.length;

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
    professorsImpactedNames: Array.from(impactedProfessors),
    roomsImpactedCount: impactedRooms.size,
    roomsImpactedPct: Math.min(100, roomPct),
    roomsImpactedNames: Array.from(impactedRooms),
    groupsImpactedCount: impactedGroups.size,
    groupsImpactedPct: Math.min(100, groupPct),
    groupsImpactedNames: Array.from(impactedGroups),
    sessionsMovedCount,
    sessionsAddedCount,
    sessionsRemovedCount,
    netConflictReduction,
    summaryArabic
  };
}

module.exports = {
  simulateScheduleImpact
};
