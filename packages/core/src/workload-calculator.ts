/**
 * Djadwal Core: Professor Workload Calculator (P14 Enhanced)
 * Computes weekly/semester teaching loads and verifies against academic rank statutory quotas.
 * Separates permanent from temporary professors (vacataires) and honors historical seasonal rank snapshots.
 */

import {
  OfficialAcademicRank,
  getRankDefinition,
  normalizeAcademicRank
} from './constants/professor-ranks.js';

export interface ProfessorAssignment {
  professor_id?: number | string;
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  session_type?: 'cours' | 'td' | 'tp' | string;
  is_extra?: boolean;
  academic_year?: string;
  professor_rank_snapshot?: string;
}

export interface WorkloadSummary {
  totalHours: number;
  lectureHours: number; // Cours
  tutorialHours: number; // TD / TP
  extraHours: number;
  statutoryQuota: number;
  status: 'underload' | 'normal' | 'overload';
  differenceHours: number;
  academicRank: OfficialAcademicRank;
  rankLabelArabic: string;
  isTemporary: boolean;
}

/**
 * Parses "HH:MM" to decimal hours (e.g. "09:30" => 9.5).
 */
export function timeToDecimal(timeStr: string): number {
  const [hours, minutes] = (timeStr || '00:00').split(':').map(Number);
  return (hours || 0) + (minutes || 0) / 60;
}

/**
 * Returns duration of session in hours (e.g. "08:00" to "09:30" => 1.5).
 */
export function getSessionDuration(start: string, end: string): number {
  const duration = timeToDecimal(end) - timeToDecimal(start);
  return duration > 0 ? duration : 0;
}

/**
 * Returns official statutory weekly hours based on academic rank.
 * Uses official definitions from professor-ranks constants.
 */
export function getStatutoryQuota(rank?: string): number {
  const def = getRankDefinition(rank);
  return def.statutoryQuotaHours;
}

/**
 * Computes the total workload for a given professor from assignments.
 * Supports historical rank snapshot resolution and permanent vs temporary segregation.
 */
export function calculateProfessorWorkload(
  assignments: ProfessorAssignment[],
  academicRank?: string,
  options?: {
    academicYear?: string;
    historicalRankSnapshot?: string;
    isTemporary?: boolean;
  }
): WorkloadSummary {
  // Determine effective rank: historical snapshot for the season takes precedence over current rank
  const effectiveRankStr =
    options?.historicalRankSnapshot ||
    assignments[0]?.professor_rank_snapshot ||
    academicRank;

  const rankDef = getRankDefinition(effectiveRankStr);
  const isTemporary = options?.isTemporary !== undefined ? options.isTemporary : rankDef.isTemporary;

  let lectureHours = 0;
  let tutorialHours = 0;
  let extraHours = 0;

  for (const a of assignments) {
    const duration = getSessionDuration(a.start_time, a.end_time);
    if (a.is_extra) {
      extraHours += duration;
    } else if (a.session_type?.toLowerCase() === 'cours') {
      lectureHours += duration;
    } else {
      tutorialHours += duration;
    }
  }

  const totalHours = lectureHours + tutorialHours + extraHours;
  const statutoryQuota = isTemporary ? 0 : rankDef.statutoryQuotaHours;

  let status: 'underload' | 'normal' | 'overload' = 'normal';
  let diff = 0;

  if (isTemporary) {
    // Temporary professors have no statutory minimum; all assigned hours are contracted teaching hours
    status = 'normal';
    diff = 0;
  } else {
    diff = Number((totalHours - statutoryQuota).toFixed(2));
    if (totalHours < statutoryQuota) {
      status = 'underload';
    } else if (totalHours > statutoryQuota) {
      status = 'overload';
    }
  }

  return {
    totalHours: Number(totalHours.toFixed(2)),
    lectureHours: Number(lectureHours.toFixed(2)),
    tutorialHours: Number(tutorialHours.toFixed(2)),
    extraHours: Number(extraHours.toFixed(2)),
    statutoryQuota,
    status,
    differenceHours: diff,
    academicRank: rankDef.key,
    rankLabelArabic: rankDef.labelArabic,
    isTemporary
  };
}
