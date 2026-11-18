/**
 * Djadwal Core: Official Academic Specialties & Levels Registry
 * University of El Oued - Faculty of Economic, Commercial & Management Sciences
 * Official 35 Specialties across L1, L2, L3, M1, M2 tiers and 5 departments.
 */

export interface AcademicSpecialty {
  name: string;
  department: string;
  level: 'L1' | 'L2' | 'L3' | 'M1' | 'M2';
}

export const OFFICIAL_SPECIALTIES: AcademicSpecialty[] = [
  // 1. L1 - الجذع المشترك
  { name: 'سنة أولى ج.م دفعة A', department: 'الجذع المشترك', level: 'L1' },
  { name: 'سنة أولى ج.م دفعة B', department: 'الجذع المشترك', level: 'L1' },
  { name: 'سنة أولى ج.م دفعة C', department: 'الجذع المشترك', level: 'L1' },
  { name: 'سنة أولى ج.م دفعة D', department: 'الجذع المشترك', level: 'L1' },

  // 2. L2 - الجذوع المشتركة التخصصية
  { name: 'سنة ثانية ج.م علوم اقتصادية', department: 'علوم اقتصادية', level: 'L2' },
  { name: 'سنة ثانية ج.م علوم التسيير', department: 'علوم التسيير', level: 'L2' },
  { name: 'سنة ثانية ج.م علوم تجارية', department: 'علوم تجارية', level: 'L2' },
  { name: 'سنة ثانية ج.م علوم مالية ومحاسبية', department: 'علوم مالية ومحاسبية', level: 'L2' },

  // 3. L3 - سنة ثالثة ليسانس
  { name: 'سنة ثالثة إدارة أعمال', department: 'علوم التسيير', level: 'L3' },
  { name: 'سنة ثالثة إدارة مالية', department: 'علوم التسيير', level: 'L3' },
  { name: 'سنة ثالثة إدارة موارد بشرية', department: 'علوم التسيير', level: 'L3' },
  { name: 'سنة ثالثة إقتصاد كمي', department: 'علوم اقتصادية', level: 'L3' },
  { name: 'سنة ثالثة إقتصاد نقدي ومالي', department: 'علوم اقتصادية', level: 'L3' },
  { name: 'سنة ثالثة إقتصاد وتسيير المؤسسات', department: 'علوم اقتصادية', level: 'L3' },
  { name: 'سنة ثالثة تسويق', department: 'علوم تجارية', level: 'L3' },
  { name: 'سنة ثالثة مالية', department: 'علوم مالية ومحاسبية', level: 'L3' },
  { name: 'سنة ثالثة مالية وتجارة دولية', department: 'علوم تجارية', level: 'L3' },
  { name: 'سنة ثالثة محاسبة', department: 'علوم مالية ومحاسبية', level: 'L3' },

  // 4. M1 - ماستر 1
  { name: 'ماستر 1 إدارة أعمال', department: 'علوم التسيير', level: 'M1' },
  { name: 'ماستر 1 إدارة الموارد البشرية', department: 'علوم التسيير', level: 'M1' },
  { name: 'ماستر 1 إقتصاد نقدي ومالي', department: 'علوم اقتصادية', level: 'M1' },
  { name: 'ماستر 1 إقتصاد وتسيير المؤسسات', department: 'علوم اقتصادية', level: 'M1' },
  { name: 'ماستر 1 اقتصاد كمّي وإحصاء', department: 'علوم اقتصادية', level: 'M1' },
  { name: 'ماستر 1 تسويق فندقي وسياحي', department: 'علوم تجارية', level: 'M1' },
  { name: 'ماستر 1 مالية المؤسسة', department: 'علوم مالية ومحاسبية', level: 'M1' },
  { name: 'ماستر 1 مالية وتجارة دولية', department: 'علوم تجارية', level: 'M1' },
  { name: 'ماستر 1 محاسبة وتدقيق', department: 'علوم مالية ومحاسبية', level: 'M1' },

  // 5. M2 - ماستر 2
  { name: 'ماستر 2 إدارة أعمال', department: 'علوم التسيير', level: 'M2' },
  { name: 'ماستر 2 إقتصاد كمي', department: 'علوم اقتصادية', level: 'M2' },
  { name: 'ماستر 2 إقتصاد نقدي ومالي', department: 'علوم اقتصادية', level: 'M2' },
  { name: 'ماستر 2 إقتصاد وتسيير المؤسسات', department: 'علوم اقتصادية', level: 'M2' },
  { name: 'ماستر 2 تسويق فندقي وسياحي', department: 'علوم تجارية', level: 'M2' },
  { name: 'ماستر 2 مالية المؤسسة', department: 'علوم مالية ومحاسبية', level: 'M2' },
  { name: 'ماستر 2 مالية وتجارة دولية', department: 'علوم تجارية', level: 'M2' },
  { name: 'ماستر 2 محاسبة وتدقيق', department: 'علوم مالية ومحاسبية', level: 'M2' },
];

export const OFFICIAL_SPECIALTY_NAMES: string[] = OFFICIAL_SPECIALTIES.map((s) => s.name);

export const OFFICIAL_DEPARTMENTS: string[] = [
  'الجذع المشترك',
  'علوم اقتصادية',
  'علوم التسيير',
  'علوم تجارية',
  'علوم مالية ومحاسبية',
];

export const OFFICIAL_STUDY_LEVELS: Array<'L1' | 'L2' | 'L3' | 'M1' | 'M2'> = [
  'L1',
  'L2',
  'L3',
  'M1',
  'M2',
];

/**
 * Filter official specialties by study level
 */
export function getSpecialtiesByLevel(level: string): AcademicSpecialty[] {
  const norm = level.toUpperCase().trim();
  return OFFICIAL_SPECIALTIES.filter((s) => s.level === norm);
}

/**
 * Filter official specialties by department
 */
export function getSpecialtiesByDepartment(department: string): AcademicSpecialty[] {
  const norm = department.trim().toLowerCase();
  return OFFICIAL_SPECIALTIES.filter((s) => s.department.toLowerCase().includes(norm));
}

/**
 * Find exact or closest official specialty definition by name
 */
export function findOfficialSpecialty(name: string): AcademicSpecialty | undefined {
  if (!name) return undefined;
  const clean = name.trim().toLowerCase();
  return OFFICIAL_SPECIALTIES.find(
    (s) => s.name.toLowerCase() === clean || s.name.toLowerCase().includes(clean) || clean.includes(s.name.toLowerCase())
  );
}
