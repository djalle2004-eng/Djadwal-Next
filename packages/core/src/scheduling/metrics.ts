/**
 * Djadwal Core: Scheduling Metrics & Telemetry (P13)
 * Tracks generation performance, remaining conflicts, room utilization,
 * professor workload balance, and human proposal acceptance rate.
 */

import {
  SchedulingMetrics,
  ExplainableConflict,
  SchedulingTask
} from './types.js';

export function computeSchedulingMetrics(params: {
  tasks: SchedulingTask[];
  conflicts: ExplainableConflict[];
  durationMs: number;
  totalAvailableGridSlots?: number;
  totalAvailableRooms?: number;
  acceptedItemsCount?: number;
  totalDecidedItemsCount?: number;
}): SchedulingMetrics {
  const { tasks, conflicts, durationMs } = params;

  const critical = conflicts.filter(c => c.severity === 'CRITICAL').length;
  const major = conflicts.filter(c => c.severity === 'MAJOR').length;
  const minor = conflicts.filter(c => c.severity === 'MINOR').length;

  const totalGridSlots = params.totalAvailableGridSlots || 30; // 5 days * 6 slots
  const totalRooms = params.totalAvailableRooms || 20;

  const totalCapacityHours = totalGridSlots * totalRooms * 1.5;
  const usedHours = tasks.reduce((sum, t) => sum + (t.durationMinutes / 60), 0);
  const roomUtilization = totalCapacityHours > 0
    ? Math.min(100, Math.round((usedHours / totalCapacityHours) * 100))
    : 0;

  // Workload balance standard deviation
  const profHours: Record<string, number> = {};
  for (const t of tasks) {
    const pid = String(t.professorId);
    profHours[pid] = (profHours[pid] || 0) + (t.durationMinutes / 60);
  }

  const hoursList = Object.values(profHours);
  const meanHours = hoursList.length > 0 ? hoursList.reduce((a, b) => a + b, 0) / hoursList.length : 0;
  const variance = hoursList.length > 0
    ? hoursList.reduce((sum, h) => sum + Math.pow(h - meanHours, 2), 0) / hoursList.length
    : 0;
  const stdDev = Math.sqrt(variance);

  // Score from 0 to 100, where 100 is perfectly uniform load
  const balanceScore = Math.max(0, Math.min(100, Math.round(100 - stdDev * 8)));

  // Human acceptance rate
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
