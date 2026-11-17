import { describe, it, expect } from 'vitest';
import {
  OFFICIAL_ACADEMIC_RANKS,
  OfficialAcademicRank,
  normalizeAcademicRank,
  getRankDefinition,
} from '../src/constants/professor-ranks.js';
import { calculateProfessorWorkload } from '../src/workload-calculator.js';

describe('P14: Systematic Professor Academic Ranks & Historical Archive Isolation', () => {
  // Test 1: Standardized 6 Academic Ranks Dictionary
  it('defines the official standardized 6 academic ranks with statutory quotas', () => {
    expect(OFFICIAL_ACADEMIC_RANKS).toHaveLength(6);

    const keys = OFFICIAL_ACADEMIC_RANKS.map((r) => r.key);
    expect(keys).toEqual([
      'temporary',
      'assistant_professor',
      'lecturer_b',
      'lecturer_a',
      'professor',
      'associate_professor',
    ]);

    const tempRank = getRankDefinition('temporary');
    expect(tempRank.isTemporary).toBe(true);
    expect(tempRank.statutoryQuotaHours).toBe(0);

    const profRank = getRankDefinition('professor');
    expect(profRank.isTemporary).toBe(false);
    expect(profRank.statutoryQuotaHours).toBe(6.0);

    const lecturerA = getRankDefinition('lecturer_a');
    expect(lecturerA.statutoryQuotaHours).toBe(9.0);

    const lecturerB = getRankDefinition('lecturer_b');
    expect(lecturerB.statutoryQuotaHours).toBe(9.0);

    const assistantProf = getRankDefinition('assistant_professor');
    expect(assistantProf.statutoryQuotaHours).toBe(12.0);

    const associateProf = getRankDefinition('associate_professor');
    expect(associateProf.statutoryQuotaHours).toBe(9.0);
  });

  // Test 2: Multi-lingual and Legacy String Normalizer
  it('accurately normalizes Arabic and French free-text titles to official rank keys', () => {
    // Vacataire / Temporary
    expect(normalizeAcademicRank('أستاذ مؤقت')).toBe('temporary');
    expect(normalizeAcademicRank('Vacataire')).toBe('temporary');
    expect(normalizeAcademicRank('enseignant contractuel')).toBe('temporary');
    expect(normalizeAcademicRank('vac')).toBe('temporary');

    // Professor (PR)
    expect(normalizeAcademicRank('أستاذ تعليم عالي (Professeur)')).toBe('professor');
    expect(normalizeAcademicRank('أ.د محمد')).toBe('professor');
    expect(normalizeAcademicRank('Professeur Titulaire')).toBe('professor');

    // Lecturer A (MCA)
    expect(normalizeAcademicRank('أستاذ محاضر أ (MCA)')).toBe('lecturer_a');
    expect(normalizeAcademicRank('Maître de Conférences A')).toBe('lecturer_a');
    expect(normalizeAcademicRank('mca')).toBe('lecturer_a');

    // Lecturer B (MCB)
    expect(normalizeAcademicRank('أستاذ محاضر ب (MCB)')).toBe('lecturer_b');
    expect(normalizeAcademicRank('Maître de Conférences B')).toBe('lecturer_b');
    expect(normalizeAcademicRank('mcb')).toBe('lecturer_b');

    // Assistant Professor (MA)
    expect(normalizeAcademicRank('أستاذ مساعد أ')).toBe('assistant_professor');
    expect(normalizeAcademicRank('Maître Assistant')).toBe('assistant_professor');
    expect(normalizeAcademicRank('MAB')).toBe('assistant_professor');

    // Safe fallback for null/empty
    expect(normalizeAcademicRank(null)).toBe('assistant_professor');
    expect(normalizeAcademicRank('')).toBe('assistant_professor');
  });

  // Test 3: Temporary Professor Workload Segregation (0h Statutory Quota & No Underload Warning)
  it('segregates temporary professors from permanent staff without false underload warnings', () => {
    // 2 sessions of 1.5h = 3.0h total
    const assignments = [
      {
        id: 1,
        course_id: 101,
        session_type: 'cours',
        start_time: '08:00',
        end_time: '09:30',
      },
      {
        id: 2,
        course_id: 101,
        session_type: 'cours',
        start_time: '09:30',
        end_time: '11:00',
      },
    ];

    const workload = calculateProfessorWorkload(assignments, 'temporary', { isTemporary: true });
    expect(workload.isTemporary).toBe(true);
    expect(workload.statutoryQuota).toBe(0);
    expect(workload.totalHours).toBe(3.0);
    expect(workload.lectureHours).toBe(3.0);
    // Temporary teachers have no statutory requirement, so status is normal and difference is 0
    expect(workload.status).toBe('normal');
    expect(workload.differenceHours).toBe(0);
  });

  // Test 4: Permanent Professor Workload Computation (MCA with 9h Quota)
  it('computes standard statutory workload and overtime for permanent staff', () => {
    // 4 lectures of 1.5h = 6.0h + 3 TDs of 1.5h = 4.5h -> Total = 10.5h
    // Quota for lecturer_a is 9.0h -> Overload = +1.5h
    const assignments = [
      { id: 1, session_type: 'cours', start_time: '08:00', end_time: '09:30' },
      { id: 2, session_type: 'cours', start_time: '09:30', end_time: '11:00' },
      { id: 3, session_type: 'cours', start_time: '11:00', end_time: '12:30' },
      { id: 4, session_type: 'cours', start_time: '14:00', end_time: '15:30' },
      { id: 5, session_type: 'td', start_time: '08:00', end_time: '09:30' },
      { id: 6, session_type: 'td', start_time: '09:30', end_time: '11:00' },
      { id: 7, session_type: 'td', start_time: '11:00', end_time: '12:30' },
    ];

    const workload = calculateProfessorWorkload(assignments, 'lecturer_a');
    expect(workload.isTemporary).toBe(false);
    expect(workload.statutoryQuota).toBe(9.0);
    expect(workload.totalHours).toBe(10.5);
    expect(workload.lectureHours).toBe(6.0);
    expect(workload.tutorialHours).toBe(4.5);
    expect(workload.status).toBe('overload');
    expect(workload.differenceHours).toBe(1.5);
  });

  // Test 5: Historical Rank Snapshot & Archive Isolation
  it('preserves historical rank snapshot when calculating archived seasons', () => {
    // 4 sessions of 1.5h = 6.0h total
    const archivedAssignments = [
      { id: 10, session_type: 'td', start_time: '08:00', end_time: '09:30' },
      { id: 11, session_type: 'td', start_time: '09:30', end_time: '11:00' },
      { id: 12, session_type: 'td', start_time: '11:00', end_time: '12:30' },
      { id: 13, session_type: 'td', start_time: '14:00', end_time: '15:30' },
    ]; // 6.0h total

    // Current season: Professor rank (6.0h quota) -> 6.0h achieves normal status with 0 difference
    const currentWorkload = calculateProfessorWorkload(archivedAssignments, 'professor');
    expect(currentWorkload.statutoryQuota).toBe(6.0);
    expect(currentWorkload.status).toBe('normal');
    expect(currentWorkload.differenceHours).toBe(0);

    // Archived season (2023-2024): Professor was assistant_professor (12.0h quota)
    // Archive isolation ensures the historical snapshot rank is evaluated:
    const archivedWorkload = calculateProfessorWorkload(archivedAssignments, 'professor', {
      academicYear: '2023-2024',
      historicalRankSnapshot: 'assistant_professor',
    });
    expect(archivedWorkload.statutoryQuota).toBe(12.0);
    expect(archivedWorkload.status).toBe('underload');
    expect(archivedWorkload.differenceHours).toBe(-6.0);
  });
});
