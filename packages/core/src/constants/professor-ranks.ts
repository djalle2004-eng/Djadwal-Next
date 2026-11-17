/**
 * Djadwal Core: Official Professor Academic Ranks & Quotas (P14)
 * Strict standardized enumeration for Algerian Higher Education System.
 */

export type OfficialAcademicRank =
  | 'temporary'
  | 'assistant_professor'
  | 'lecturer_b'
  | 'lecturer_a'
  | 'professor'
  | 'associate_professor';

export interface RankDefinition {
  key: OfficialAcademicRank;
  labelArabic: string;
  labelFrench: string;
  isTemporary: boolean;
  statutoryQuotaHours: number;
  descriptionArabic: string;
}

export const OFFICIAL_ACADEMIC_RANKS: RankDefinition[] = [
  {
    key: 'temporary',
    labelArabic: 'أستاذ(ة) مؤقت(ة)',
    labelFrench: 'Enseignant Vacataire / Temporaire',
    isTemporary: true,
    statutoryQuotaHours: 0,
    descriptionArabic: 'أستاذ متعاقد بالساعة دون إلزام بنصاب تدريسي أسبوعي أدنى'
  },
  {
    key: 'assistant_professor',
    labelArabic: 'أستاذ مساعد',
    labelFrench: 'Maître Assistant',
    isTemporary: false,
    statutoryQuotaHours: 12.0,
    descriptionArabic: 'أستاذ مساعد (رتبة انطلاق دائمة - نصاب قانوني 12 ساعة)'
  },
  {
    key: 'lecturer_b',
    labelArabic: 'أستاذ محاضر - ب',
    labelFrench: 'Maître de Conférences B (MCB)',
    isTemporary: false,
    statutoryQuotaHours: 9.0,
    descriptionArabic: 'أستاذ محاضر صنف ب (نصاب قانوني 9 ساعات أسبوعياً)'
  },
  {
    key: 'lecturer_a',
    labelArabic: 'أستاذ محاضر - أ',
    labelFrench: 'Maître de Conférences A (MCA)',
    isTemporary: false,
    statutoryQuotaHours: 9.0,
    descriptionArabic: 'أستاذ محاضر صنف أ - مؤهل جامعياً (نصاب قانوني 9 ساعات)'
  },
  {
    key: 'professor',
    labelArabic: 'أستاذ',
    labelFrench: 'Professeur d\'Enseignement Supérieur (PR)',
    isTemporary: false,
    statutoryQuotaHours: 6.0,
    descriptionArabic: 'أستاذ دائم مبرز / تعليم عالي (نصاب قانوني 6 إلى 9 ساعات)'
  },
  {
    key: 'associate_professor',
    labelArabic: 'أستاذ مشارك',
    labelFrench: 'Professeur Associé',
    isTemporary: false,
    statutoryQuotaHours: 9.0,
    descriptionArabic: 'أستاذ باحث مشارك في التأطير البيداغوجي والتدريس'
  }
];

const RANK_MAP = new Map<string, RankDefinition>();
OFFICIAL_ACADEMIC_RANKS.forEach(r => RANK_MAP.set(r.key, r));

/**
 * Normalizes any free-text or legacy string to one of the 6 official keys.
 */
export function normalizeAcademicRank(rawRank?: string | null): OfficialAcademicRank {
  if (!rawRank) return 'assistant_professor';
  const clean = rawRank.toLowerCase().trim();

  // 1. Direct key match
  if (RANK_MAP.has(clean)) {
    return clean as OfficialAcademicRank;
  }

  // 2. Temporary / Vacataire check (Must be first to isolate temporary teachers)
  if (
    clean.includes('مؤقت') ||
    clean.includes('vacataire') ||
    clean.includes('temporaire') ||
    clean.includes('تعاقد') ||
    clean.includes('contract') ||
    clean === 'vac'
  ) {
    return 'temporary';
  }

  // 3. Lecturer B (MCB)
  if (
    clean.includes('محاضر ب') ||
    clean.includes('محاضر - ب') ||
    clean.includes('mcb') ||
    clean.includes('conférences b')
  ) {
    return 'lecturer_b';
  }

  // 4. Lecturer A (MCA)
  if (
    clean.includes('محاضر أ') ||
    clean.includes('محاضر - أ') ||
    clean.includes('mca') ||
    clean.includes('conférences a')
  ) {
    return 'lecturer_a';
  }

  // 5. Associate Professor
  if (
    clean.includes('مشارك') ||
    clean.includes('associé') ||
    clean.includes('assoc')
  ) {
    return 'associate_professor';
  }

  // 6. Professor / Full Professor
  if (
    clean.includes('أستاذ تعليم عالي') ||
    clean.includes('تعليم عالي') ||
    clean.includes('professeur') ||
    clean.includes('prof') ||
    clean.includes('أ.د') ||
    clean.includes('ا.د') ||
    clean === 'pr'
  ) {
    return 'professor';
  }

  // 7. Assistant Professor (MAA / MAB / مساعد)
  if (
    clean.includes('مساعد') ||
    clean.includes('assistant') ||
    clean.includes('maa') ||
    clean.includes('mab')
  ) {
    return 'assistant_professor';
  }

  // 8. Plain "أستاذ" without modifier defaults to 'professor' or 'assistant_professor'
  if (clean === 'أستاذ' || clean === 'استاذ') {
    return 'professor';
  }

  return 'assistant_professor';
}

/**
 * Retrieves the official definition for a rank key or raw string
 */
export function getRankDefinition(rawRank?: string | null): RankDefinition {
  const normalizedKey = normalizeAcademicRank(rawRank);
  return RANK_MAP.get(normalizedKey) || OFFICIAL_ACADEMIC_RANKS[1]; // Fallback to assistant_professor
}

/**
 * Validates if a string is strictly one of the 6 official rank keys
 */
export function isValidOfficialRank(key: string): key is OfficialAcademicRank {
  return RANK_MAP.has(key);
}
