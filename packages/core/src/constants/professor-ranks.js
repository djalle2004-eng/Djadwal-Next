/**
 * Djadwal Core: Official Professor Academic Ranks & Quotas (CommonJS runtime)
 */

const OFFICIAL_ACADEMIC_RANKS = [
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

const RANK_MAP = new Map();
OFFICIAL_ACADEMIC_RANKS.forEach(r => RANK_MAP.set(r.key, r));

function normalizeAcademicRank(rawRank) {
  if (!rawRank) return 'assistant_professor';
  const clean = String(rawRank).toLowerCase().trim();

  if (RANK_MAP.has(clean)) {
    return clean;
  }

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

  if (
    clean.includes('محاضر ب') ||
    clean.includes('محاضر - ب') ||
    clean.includes('mcb') ||
    clean.includes('conférences b')
  ) {
    return 'lecturer_b';
  }

  if (
    clean.includes('محاضر أ') ||
    clean.includes('محاضر - أ') ||
    clean.includes('mca') ||
    clean.includes('conférences a')
  ) {
    return 'lecturer_a';
  }

  if (
    clean.includes('مشارك') ||
    clean.includes('associé') ||
    clean.includes('assoc')
  ) {
    return 'associate_professor';
  }

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

  if (
    clean.includes('مساعد') ||
    clean.includes('assistant') ||
    clean.includes('maa') ||
    clean.includes('mab')
  ) {
    return 'assistant_professor';
  }

  if (clean === 'أستاذ' || clean === 'استاذ') {
    return 'professor';
  }

  return 'assistant_professor';
}

function getRankDefinition(rawRank) {
  const normalizedKey = normalizeAcademicRank(rawRank);
  return RANK_MAP.get(normalizedKey) || OFFICIAL_ACADEMIC_RANKS[1];
}

function isValidOfficialRank(key) {
  return RANK_MAP.has(key);
}

module.exports = {
  OFFICIAL_ACADEMIC_RANKS,
  normalizeAcademicRank,
  getRankDefinition,
  isValidOfficialRank
};
