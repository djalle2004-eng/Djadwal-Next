/**
 * Djadwal Core: Professor Workload Calculator (CommonJS runtime)
 */

const {
  getRankDefinition,
  normalizeAcademicRank
} = require('./constants/professor-ranks.js');

function timeToDecimal(timeStr) {
  const [hours, minutes] = (timeStr || '00:00').split(':').map(Number);
  return (hours || 0) + (minutes || 0) / 60;
}

function getSessionDuration(start, end) {
  const duration = timeToDecimal(end) - timeToDecimal(start);
  return duration > 0 ? duration : 0;
}

function getStatutoryQuota(rank) {
  const def = getRankDefinition(rank);
  return def.statutoryQuotaHours;
}

function calculateProfessorWorkload(assignments, academicRank, options = {}) {
  const effectiveRankStr =
    options?.historicalRankSnapshot ||
    assignments[0]?.professor_rank_snapshot ||
    academicRank;

  const rankDef = getRankDefinition(effectiveRankStr);
  const isTemporary = options?.isTemporary !== undefined ? options.isTemporary : rankDef.isTemporary;

  let lectureHours = 0;
  let tutorialHours = 0;
  let extraHours = 0;

  for (const a of (assignments || [])) {
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

  let status = 'normal';
  let diff = 0;

  if (isTemporary) {
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

module.exports = {
  timeToDecimal,
  getSessionDuration,
  getStatutoryQuota,
  calculateProfessorWorkload
};
