/**
 * Djadwal Core: Scheduling Metrics (CommonJS runtime)
 */

function computeSchedulingMetrics(params = {}) {
  const { tasks = [], conflicts = [], durationMs = 0 } = params;

  const critical = conflicts.filter(c => c.severity === 'CRITICAL').length;
  const major = conflicts.filter(c => c.severity === 'MAJOR').length;
  const minor = conflicts.filter(c => c.severity === 'MINOR').length;

  const totalGridSlots = params.totalAvailableGridSlots || 30;
  const totalRooms = params.totalAvailableRooms || 20;

  const totalCapacityHours = totalGridSlots * totalRooms * 1.5;
  const usedHours = tasks.reduce((sum, t) => sum + (t.durationMinutes / 60), 0);
  const roomUtilization = totalCapacityHours > 0
    ? Math.min(100, Math.round((usedHours / totalCapacityHours) * 100))
    : 0;

  const profHours = {};
  for (const t of tasks) {
    if (!t.professorId || String(t.professorId) === '0' || String(t.professorId) === 'null' || String(t.professorId) === 'undefined') continue;
    const pid = String(t.professorId);
    profHours[pid] = (profHours[pid] || 0) + (t.durationMinutes / 60);
  }

  const hoursList = Object.values(profHours);
  const meanHours = hoursList.length > 0 ? hoursList.reduce((a, b) => a + b, 0) / hoursList.length : 0;
  const variance = hoursList.length > 0
    ? hoursList.reduce((sum, h) => sum + Math.pow(h - meanHours, 2), 0) / hoursList.length
    : 0;
  const stdDev = Math.sqrt(variance);

  const balanceScore = Math.max(0, Math.min(100, Math.round(100 - stdDev * 8)));

  let humanAcceptanceRate = 100;
  if (params.totalDecidedItemsCount && params.totalDecidedItemsCount > 0) {
    const accepted = params.acceptedItemsCount !== undefined ? params.acceptedItemsCount : params.totalDecidedItemsCount;
    humanAcceptanceRate = Math.round((accepted / params.totalDecidedItemsCount) * 100);
  }

  return {
    generationDurationMs: durationMs,
    totalSessions: tasks.length,
    criticalConflictsCount: critical,
    majorConflictsCount: major,
    minorConflictsCount: minor,
    roomUtilizationRate: roomUtilization,
    professorWorkloadBalanceScore: balanceScore,
    humanAcceptanceRate
  };
}

module.exports = {
  computeSchedulingMetrics
};
