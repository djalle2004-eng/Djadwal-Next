/**
 * Djadwal Core: Systematic Professor Excel Export & Import Engine (P15)
 * Generates formatted, RTL-compliant Excel spreadsheets for professors,
 * provides dry-run diffing/validation, and prepares atomic UnitOfWork mutations.
 */

import * as XLSX from 'xlsx';
import {
  OFFICIAL_ACADEMIC_RANKS,
  OfficialAcademicRank,
  normalizeAcademicRank,
  getRankDefinition,
} from '../constants/professor-ranks.js';

export interface ExcelProfessorInputRow {
  id?: number | string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  academic_rank?: string | null;
  rank_label_arabic?: string | null;
  is_temporary?: boolean | string | number | null;
  specialization?: string | null;
  department?: string | null;
  department_name?: string | null;
}

export interface FieldChange {
  field: string;
  fieldLabelAr: string;
  oldValue: any;
  newValue: any;
}

export interface AnalyzedProfessorRow {
  rawIndex: number;
  id?: number | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  academic_rank: OfficialAcademicRank;
  rank_label_arabic: string;
  is_temporary: boolean;
  specialization?: string | null;
  department?: string | null;
  action: 'create' | 'update' | 'unchanged' | 'error';
  errorMessageAr?: string;
  changes?: FieldChange[];
  existingProfessor?: any;
}

export interface DryRunSummary {
  total: number;
  toCreate: number;
  toUpdate: number;
  unchanged: number;
  errors: number;
  canProceed: boolean;
}

export interface DryRunResult {
  summary: DryRunSummary;
  rows: AnalyzedProfessorRow[];
  timestamp: string;
}

// Arabic to normalized key header dictionary
const HEADER_MAP: Record<string, string> = {
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

/**
 * Normalizes raw sheet row keys using standard Arabic and French/English aliases
 */
export function normalizeRawRow(rawRow: Record<string, any>): ExcelProfessorInputRow {
  const normalized: Record<string, any> = {};

  for (const [key, val] of Object.entries(rawRow)) {
    if (val === undefined || val === null) continue;
    const cleanKey = key.toString().trim().toLowerCase();
    const mappedField = HEADER_MAP[cleanKey] || HEADER_MAP[key.toString().trim()];

    if (mappedField) {
      normalized[mappedField] = typeof val === 'string' ? val.trim() : val;
    } else {
      // Fallback: check if the key directly matches
      normalized[cleanKey] = typeof val === 'string' ? val.trim() : val;
    }
  }

  return normalized as ExcelProfessorInputRow;
}

/**
 * Parses an is_temporary input value flexibly (handles strings like 'مؤقت', 'دائم', booleans, 0, 1)
 */
export function parseIsTemporary(raw: any, rankDefault: boolean): boolean {
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

/**
 * Validates an email string loosely
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Core Dry-Run Engine:
 * Compares incoming rows with existing database professors, detects conflicts,
 * computes diffs, and returns an actionable report.
 */
export function dryRunProfessorsImport(
  rawRows: Record<string, any>[],
  existingProfessors: any[] = []
): DryRunResult {
  const analyzedRows: AnalyzedProfessorRow[] = [];
  const existingById = new Map<number, any>();
  const existingByEmail = new Map<string, any>();
  const existingByName = new Map<string, any>();

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

  rawRows.forEach((raw, idx) => {
    const row = normalizeRawRow(raw);
    const rawIndex = idx + 2; // Row number in Excel sheet (1-based, 1 is header)

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
    let matchedProf: any = null;
    if (row.id && !isNaN(Number(row.id)) && existingById.has(Number(row.id))) {
      matchedProf = existingById.get(Number(row.id));
    } else if (emailStr && existingByEmail.has(emailStr.toLowerCase())) {
      matchedProf = existingByEmail.get(emailStr.toLowerCase());
    } else if (existingByName.has(nameStr.toLowerCase())) {
      matchedProf = existingByName.get(nameStr.toLowerCase());
    }

    // 6. Diff Evaluation
    if (!matchedProf) {
      // New Professor
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
      // Existing Professor: Calculate Changes
      const changes: FieldChange[] = [];

      // Name change
      if (matchedProf.name?.trim() !== nameStr) {
        changes.push({
          field: 'name',
          fieldLabelAr: 'الاسم الكامل',
          oldValue: matchedProf.name || '',
          newValue: nameStr,
        });
      }

      // Email change
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

      // Phone change
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

      // Rank change
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

      // Temporary change
      const oldIsTemp = Boolean(matchedProf.is_temporary || oldNormRank === 'temporary');
      if (oldIsTemp !== isTemp) {
        changes.push({
          field: 'is_temporary',
          fieldLabelAr: 'الصفة التعاقدية',
          oldValue: oldIsTemp ? 'مؤقت / متعاقد' : 'دائم',
          newValue: isTemp ? 'مؤقت / متعاقد' : 'دائم',
        });
      }

      // Specialization change
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
      total: rawRows.length,
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

/**
 * Builds the official stylized Professors Excel workbook for export.
 * Includes formatted headers, auto-width, RTL display, and official rank guide tab.
 */
export function buildProfessorsExportWorkbook(professors: any[] = []): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. Data Sheet
  const exportData = professors.map((p, idx) => {
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

  // Column Widths for readability in Excel
  wsData['!cols'] = [
    { wch: 10 }, // المعرف
    { wch: 30 }, // الاسم واللقب
    { wch: 32 }, // البريد
    { wch: 16 }, // الهاتف
    { wch: 22 }, // الرتبة الأكاديمية
    { wch: 20 }, // رمز الرتبة
    { wch: 18 }, // الصفة التعاقدية
    { wch: 28 }, // النصاب
    { wch: 24 }, // التخصص
    { wch: 22 }, // القسم
    { wch: 12 }, // الحالة
  ];

  // Set Sheet to Right-To-Left (RTL) mode
  wsData['!views'] = [{ rightToLeft: true }];

  XLSX.utils.book_append_sheet(wb, wsData, 'قائمة الأساتذة');

  // 2. Reference & Instructions Sheet (دليل الرتب المعتمدة)
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

/**
 * Builds a blank Excel template for importing professors,
 * with sample rows for permanent and temporary teachers.
 */
export function buildProfessorsTemplateWorkbook(): XLSX.WorkBook {
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
