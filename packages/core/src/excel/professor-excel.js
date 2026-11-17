/**
 * Djadwal Core: Systematic Professor Excel Export & Import Engine (P15) - JS runtime mirror
 */

const XLSX = require('xlsx');
const {
  OFFICIAL_ACADEMIC_RANKS,
  normalizeAcademicRank,
  getRankDefinition,
} = require('../constants/professor-ranks.js');

const HEADER_MAP = {
  // ID
  'المعرف': 'id',
  'معرف الأستاذ': 'id',
  'الرقم': 'id',
  'id': 'id',
  'id_professor': 'id',

  // Name
  'الاسم': 'name',
  'الاسم واللقب': 'name',
  'اللقب والاسم': 'name',
  'الاسم الكامل': 'name',
  'اسم الأستاذ': 'name',
  'name': 'name',
  'full_name': 'name',
  'nom': 'name',
  'nom_et_prenom': 'name',

  // Email
  'البريد': 'email',
  'البريد الإلكتروني': 'email',
  'البريد المهني': 'email',
  'email': 'email',
  'e-mail': 'email',
  'mail': 'email',

  // Phone
  'الهاتف': 'phone',
  'رقم الهاتف': 'phone',
  'phone': 'phone',
  'telephone': 'phone',
  'mobile': 'phone',

  // Rank
  'الرتبة': 'academic_rank',
  'الرتبة الأكاديمية': 'academic_rank',
  'الرتبة العلمية': 'academic_rank',
  'الصفة الأكاديمية': 'academic_rank',
  'رمز الرتبة': 'academic_rank',
  'academic_rank': 'academic_rank',
  'rank': 'academic_rank',
  'grade': 'academic_rank',
  'title': 'academic_rank',

  // Temporary / Contract status
  'الصفة': 'is_temporary',
  'الصفة التعاقدية': 'is_temporary',
  'الحالة التعاقدية': 'is_temporary',
  'نوع التعاقد': 'is_temporary',
  'مؤقت': 'is_temporary',
  'is_temporary': 'is_temporary',
  'temporary': 'is_temporary',
  'statut': 'is_temporary',

  // Specialization
  'التخصص': 'specialization',
  'تخصص الأستاذ': 'specialization',
  'specialization': 'specialization',
  'specialite': 'specialization',

  // Department
  'القسم': 'department',
  'اسم القسم': 'department',
  'الكلية': 'department',
  'department': 'department',
  'departement': 'department',
};

function normalizeRawRow(rawRow) {
  const normalized = {};

  for (const [key, val] of Object.entries(rawRow || {})) {
    if (val === undefined || val === null) continue;
    const cleanKey = key.toString().trim().toLowerCase();
    const mappedField = HEADER_MAP[cleanKey] || HEADER_MAP[key.toString().trim()];

    if (mappedField) {
      normalized[mappedField] = typeof val === 'string' ? val.trim() : val;
    } else {
      normalized[cleanKey] = typeof val === 'string' ? val.trim() : val;
    }
  }

  return normalized;
}

function parseIsTemporary(raw, rankDefault) {
  if (raw === undefined || raw === null || raw === '') {
    return rankDefault;
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  const s = raw.toString().trim().toLowerCase();
  if (s === '1' || s === 'true' || s.includes('مؤقت') || s.includes('تعاقد') || s.includes('vacataire')) {
    return true;
  }
  if (s === '0' || s === 'false' || s.includes('دائم') || s.includes('titulaire') || s.includes('permanent')) {
    return false;
  }
  return rankDefault;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function dryRunProfessorsImport(rawRows, existingProfessors = []) {
  const analyzedRows = [];
  const existingById = new Map();
  const existingByEmail = new Map();
  const existingByName = new Map();

  for (const p of existingProfessors) {
    if (p.id) existingById.set(Number(p.id), p);
    if (p.email && typeof p.email === 'string') {
      existingByEmail.set(p.email.trim().toLowerCase(), p);
    }
    if (p.name && typeof p.name === 'string') {
      existingByName.set(p.name.trim().toLowerCase(), p);
    }
  }

  let toCreateCount = 0;
  let toUpdateCount = 0;
  let unchangedCount = 0;
  let errorsCount = 0;

  (rawRows || []).forEach((raw, idx) => {
    const row = normalizeRawRow(raw);
    const rawIndex = idx + 2;

    // 1. Mandatory Name Validation
    const nameStr = (row.name || '').toString().trim();
    if (!nameStr) {
      errorsCount++;
      analyzedRows.push({
        rawIndex,
        id: row.id ? Number(row.id) : null,
        name: '',
        academic_rank: 'assistant_professor',
        rank_label_arabic: 'أستاذ مساعد',
        is_temporary: false,
        action: 'error',
        errorMessageAr: 'اسم الأستاذ حقل إجباري مفقود في هذا الصف.',
      });
      return;
    }

    // 2. Email Format Validation
    const emailStr = (row.email || '').toString().trim();
    if (emailStr && !isValidEmail(emailStr)) {
      errorsCount++;
      analyzedRows.push({
        rawIndex,
        id: row.id ? Number(row.id) : null,
        name: nameStr,
        email: emailStr,
        academic_rank: 'assistant_professor',
        rank_label_arabic: 'أستاذ مساعد',
        is_temporary: false,
        action: 'error',
        errorMessageAr: `صيغة البريد الإلكتروني "${emailStr}" غير صالحة.`,
      });
      return;
    }

    // 3. Normalize Rank & Temporary Status
    const normRank = normalizeAcademicRank(row.academic_rank);
    const rankDef = getRankDefinition(normRank);
    const isTemp = parseIsTemporary(row.is_temporary, rankDef.isTemporary || normRank === 'temporary');

    // 4. Department string resolution
    const deptStr = (row.department || row.department_name)
      ? String(row.department || row.department_name).trim()
      : null;

    // 5. Lookup Existing Match
    let matchedProf = null;
    if (row.id && !isNaN(Number(row.id)) && existingById.has(Number(row.id))) {
      matchedProf = existingById.get(Number(row.id));
    } else if (emailStr && existingByEmail.has(emailStr.toLowerCase())) {
      matchedProf = existingByEmail.get(emailStr.toLowerCase());
    } else if (existingByName.has(nameStr.toLowerCase())) {
      matchedProf = existingByName.get(nameStr.toLowerCase());
    }

    // 6. Diff Evaluation
    if (!matchedProf) {
      toCreateCount++;
      analyzedRows.push({
        rawIndex,
        id: null,
        name: nameStr,
        email: emailStr || null,
        phone: row.phone ? row.phone.toString().trim() : null,
        academic_rank: normRank,
        rank_label_arabic: rankDef.labelArabic,
        is_temporary: isTemp,
        specialization: row.specialization ? row.specialization.toString().trim() : null,
        department: deptStr,
        action: 'create',
      });
    } else {
      const changes = [];

      if (matchedProf.name?.trim() !== nameStr) {
        changes.push({
          field: 'name',
          fieldLabelAr: 'الاسم الكامل',
          oldValue: matchedProf.name || '',
          newValue: nameStr,
        });
      }

      const oldEmail = (matchedProf.email || '').trim().toLowerCase();
      const newEmail = (emailStr || '').trim().toLowerCase();
      if (emailStr && oldEmail !== newEmail) {
        changes.push({
          field: 'email',
          fieldLabelAr: 'البريد المهني',
          oldValue: matchedProf.email || '',
          newValue: emailStr,
        });
      }

      const oldPhone = (matchedProf.phone || '').toString().trim();
      const newPhone = (row.phone || '').toString().trim();
      if (newPhone && oldPhone !== newPhone) {
        changes.push({
          field: 'phone',
          fieldLabelAr: 'رقم الهاتف',
          oldValue: oldPhone,
          newValue: newPhone,
        });
      }

      const oldNormRank = normalizeAcademicRank(matchedProf.academic_rank || matchedProf.academic_title || matchedProf.title);
      if (oldNormRank !== normRank) {
        const oldDef = getRankDefinition(oldNormRank);
        changes.push({
          field: 'academic_rank',
          fieldLabelAr: 'الرتبة الأكاديمية',
          oldValue: oldDef.labelArabic,
          newValue: rankDef.labelArabic,
        });
      }

      const oldIsTemp = Boolean(matchedProf.is_temporary || oldNormRank === 'temporary');
      if (oldIsTemp !== isTemp) {
        changes.push({
          field: 'is_temporary',
          fieldLabelAr: 'الصفة التعاقدية',
          oldValue: oldIsTemp ? 'مؤقت / متعاقد' : 'دائم',
          newValue: isTemp ? 'مؤقت / متعاقد' : 'دائم',
        });
      }

      const oldSpec = (matchedProf.specialization || '').toString().trim();
      const newSpec = (row.specialization || '').toString().trim();
      if (newSpec && oldSpec !== newSpec) {
        changes.push({
          field: 'specialization',
          fieldLabelAr: 'التخصص',
          oldValue: oldSpec,
          newValue: newSpec,
        });
      }

      if (changes.length > 0) {
        toUpdateCount++;
        analyzedRows.push({
          rawIndex,
          id: matchedProf.id,
          name: nameStr,
          email: emailStr || matchedProf.email || null,
          phone: row.phone ? row.phone.toString().trim() : matchedProf.phone,
          academic_rank: normRank,
          rank_label_arabic: rankDef.labelArabic,
          is_temporary: isTemp,
          specialization: row.specialization ? row.specialization.toString().trim() : matchedProf.specialization,
          department: deptStr || matchedProf.department || matchedProf.department_name || null,
          action: 'update',
          changes,
          existingProfessor: matchedProf,
        });
      } else {
        unchangedCount++;
        analyzedRows.push({
          rawIndex,
          id: matchedProf.id,
          name: matchedProf.name,
          email: matchedProf.email,
          phone: matchedProf.phone,
          academic_rank: oldNormRank,
          rank_label_arabic: rankDef.labelArabic,
          is_temporary: isTemp,
          specialization: matchedProf.specialization,
          department: matchedProf.department || matchedProf.department_name,
          action: 'unchanged',
          existingProfessor: matchedProf,
        });
      }
    }
  });

  return {
    summary: {
      total: (rawRows || []).length,
      toCreate: toCreateCount,
      toUpdate: toUpdateCount,
      unchanged: unchangedCount,
      errors: errorsCount,
      canProceed: errorsCount === 0 || (toCreateCount + toUpdateCount > 0),
    },
    rows: analyzedRows,
    timestamp: new Date().toISOString(),
  };
}

function buildProfessorsExportWorkbook(professors = []) {
  const wb = XLSX.utils.book_new();

  const exportData = (professors || []).map((p, idx) => {
    const normRank = normalizeAcademicRank(p.academic_rank || p.academic_title || p.title);
    const def = getRankDefinition(normRank);
    const isTemp = p.is_temporary !== undefined ? Boolean(p.is_temporary) : def.isTemporary;

    return {
      'المعرف': p.id ?? (idx + 1),
      'الاسم واللقب': p.name || '',
      'البريد المهني': p.email || '',
      'رقم الهاتف': p.phone || '',
      'الرتبة الأكاديمية': def.labelArabic,
      'رمز الرتبة (داخلي)': normRank,
      'الصفة التعاقدية': isTemp ? 'مؤقت / متعاقد' : 'دائم',
      'النصاب القانوني (ساعات أسبوعياً)': def.statutoryQuotaHours,
      'التخصص': p.specialization || '',
      'القسم': p.department_name || p.department || '',
      'الحالة': p.deleted_at ? 'مؤرشف' : 'نشط',
    };
  });

  const wsData = XLSX.utils.json_to_sheet(exportData);
  wsData['!cols'] = [
    { wch: 10 },
    { wch: 30 },
    { wch: 32 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    { wch: 18 },
    { wch: 28 },
    { wch: 24 },
    { wch: 22 },
    { wch: 12 },
  ];
  wsData['!views'] = [{ rightToLeft: true }];
  XLSX.utils.book_append_sheet(wb, wsData, 'قائمة الأساتذة');

  const guideData = OFFICIAL_ACADEMIC_RANKS.map((r) => ({
    'الرتبة بالعربية': r.labelArabic,
    'الرتبة بالفرنسية': r.labelFrench,
    'رمز الرتبة المعياري': r.key,
    'النصاب التدريسي الأسبوعي': `${r.statutoryQuotaHours} ساعة`,
    'الصفة': r.isTemporary ? 'مؤقت / متعاقد' : 'دائم',
    'الوصف التنظيمي': r.descriptionArabic,
  }));

  const wsGuide = XLSX.utils.json_to_sheet(guideData);
  wsGuide['!cols'] = [
    { wch: 24 },
    { wch: 35 },
    { wch: 24 },
    { wch: 26 },
    { wch: 18 },
    { wch: 55 },
  ];
  wsGuide['!views'] = [{ rightToLeft: true }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'دليل الرتب والتعليمات');

  return wb;
}

function buildProfessorsTemplateWorkbook() {
  const sampleProfessors = [
    {
      id: '',
      name: 'د. أحمد بن علي',
      email: 'ahmed.benali@univ-alger.dz',
      phone: '0555123456',
      academic_rank: 'lecturer_a',
      is_temporary: false,
      specialization: 'ذكاء اصطناعي ونظم موزعة',
      department_name: 'قسم الإعلام الآلي',
    },
    {
      id: '',
      name: 'أ. مريم بلقاسم',
      email: 'm.belkacem@univ-alger.dz',
      phone: '0666789012',
      academic_rank: 'temporary',
      is_temporary: true,
      specialization: 'قواعد بيانات ونظم معلومات',
      department_name: 'قسم الإعلام الآلي',
    },
  ];

  return buildProfessorsExportWorkbook(sampleProfessors);
}

module.exports = {
  normalizeRawRow,
  parseIsTemporary,
  dryRunProfessorsImport,
  buildProfessorsExportWorkbook,
  buildProfessorsTemplateWorkbook,
};
