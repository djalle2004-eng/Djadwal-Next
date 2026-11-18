import { describe, it, expect } from 'vitest';
import {
  OFFICIAL_SPECIALTIES,
  OFFICIAL_SPECIALTY_NAMES,
  OFFICIAL_DEPARTMENTS,
  OFFICIAL_STUDY_LEVELS,
  getSpecialtiesByLevel,
  getSpecialtiesByDepartment,
  findOfficialSpecialty,
} from '../src/constants/academic-specialties.js';

describe('Academic Specialties Registry Tests', () => {
  it('contains exactly 35 official specialties', () => {
    expect(OFFICIAL_SPECIALTIES.length).toBe(35);
    expect(OFFICIAL_SPECIALTY_NAMES.length).toBe(35);
  });

  it('correctly filters specialties by level L1..M2', () => {
    const l1 = getSpecialtiesByLevel('L1');
    expect(l1.length).toBe(4);
    expect(l1.every((s) => s.level === 'L1')).toBe(true);
    expect(l1.some((s) => s.name === 'سنة أولى ج.م دفعة A')).toBe(true);

    const l2 = getSpecialtiesByLevel('L2');
    expect(l2.length).toBe(4);

    const l3 = getSpecialtiesByLevel('L3');
    expect(l3.length).toBe(10);

    const m1 = getSpecialtiesByLevel('M1');
    expect(m1.length).toBe(9);

    const m2 = getSpecialtiesByLevel('M2');
    expect(m2.length).toBe(8);

    expect(l1.length + l2.length + l3.length + m1.length + m2.length).toBe(35);
  });

  it('filters specialties by department accurately', () => {
    const eco = getSpecialtiesByDepartment('علوم اقتصادية');
    expect(eco.length).toBeGreaterThan(0);
    expect(eco.some((s) => s.name.includes('إقتصاد كمي'))).toBe(true);

    const commonCore = getSpecialtiesByDepartment('الجذع المشترك');
    expect(commonCore.length).toBe(4);
  });

  it('finds official specialty by fuzzy or exact name', () => {
    const match = findOfficialSpecialty('سنة ثالثة إدارة أعمال');
    expect(match).toBeDefined();
    expect(match?.department).toBe('علوم التسيير');
    expect(match?.level).toBe('L3');
  });
});
