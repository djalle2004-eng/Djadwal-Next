import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  normalizeRawCourseRow,
  normalizeSemester,
  normalizeStudyLevel,
  parseBooleanFlag,
  dryRunCoursesImport,
  buildCoursesExportWorkbook,
  buildCoursesTemplateWorkbook,
} from '../src/excel/course-curriculum-excel.js';

describe('P16: Course Curriculum & Module Guide Excel Engine Suite', () => {
  // Test 1: Header Mapping & Row Normalization
  it('correctly normalizes Arabic and multilingual header keys to standard course fields', () => {
    const rawArabicRow = {
      'المعرف': 105,
      'اسم المقياس': 'خوارزميات متقدمة',
      'رمز المقياس': 'ALGO201',
      'السداسي': 'السداسي الثاني',
      'المستوى': 'سنة ثانية ليسانس',
      'التخصص': 'إعلام آلي عام',
      'القسم': 'قسم الإعلام الآلي',
      'المعامل': 3,
      'الرصيد': 5,
      'محاضرة': 'نعم',
      'أعمال موجهة': 'نعم',
      'أعمال تطبيقية': 'لا',
      'الحجم الساعي الأسبوعي': 4.5,
    };

    const normalized = normalizeRawCourseRow(rawArabicRow);
    expect(normalized.id).toBe(105);
    expect(normalized.name).toBe('خوارزميات متقدمة');
    expect(normalized.code).toBe('ALGO201');
    expect(normalized.semester).toBe('السداسي الثاني');
    expect(normalized.study_level).toBe('سنة ثانية ليسانس');
    expect(normalized.specialization).toBe('إعلام آلي عام');
    expect(normalized.department).toBe('قسم الإعلام الآلي');
    expect(normalized.coefficient).toBe(3);
    expect(normalized.credits).toBe(5);
    expect(normalized.has_lecture).toBe('نعم');
    expect(normalized.has_td).toBe('نعم');
    expect(normalized.has_tp).toBe('لا');
    expect(normalized.weekly_hours).toBe(4.5);
  });

  // Test 2: Semester Normalization
  it('normalizes various semester representations to canonical S1 or S2', () => {
    expect(normalizeSemester('S1')).toBe('S1');
    expect(normalizeSemester('1')).toBe('S1');
    expect(normalizeSemester('السداسي الأول')).toBe('S1');
    expect(normalizeSemester('الفصل 1')).toBe('S1');
    expect(normalizeSemester(null)).toBe('S1');

    expect(normalizeSemester('S2')).toBe('S2');
    expect(normalizeSemester('2')).toBe('S2');
    expect(normalizeSemester('السداسي الثاني')).toBe('S2');
    expect(normalizeSemester('Semestre 2')).toBe('S2');
  });

  // Test 3: Study Level Normalization
  it('normalizes study level strings to standard LMD tiers (L1, L2, L3, M1, M2)', () => {
    expect(normalizeStudyLevel('L1')).toBe('L1');
    expect(normalizeStudyLevel('سنة أولى ليسانس')).toBe('L1');
    expect(normalizeStudyLevel('1')).toBe('L1');

    expect(normalizeStudyLevel('L2')).toBe('L2');
    expect(normalizeStudyLevel('سنة ثانية')).toBe('L2');

    expect(normalizeStudyLevel('L3')).toBe('L3');
    expect(normalizeStudyLevel('ثالثة')).toBe('L3');

    expect(normalizeStudyLevel('M1')).toBe('M1');
    expect(normalizeStudyLevel('ماستر 1')).toBe('M1');

    expect(normalizeStudyLevel('M2')).toBe('M2');
    expect(normalizeStudyLevel('Master 2')).toBe('M2');
  });

  // Test 4: Boolean Flag Parsing (Lecture, TD, TP)
  it('accurately parses boolean flags from Arabic and multilingual inputs', () => {
    expect(parseBooleanFlag('نعم', false)).toBe(true);
    expect(parseBooleanFlag('oui', false)).toBe(true);
    expect(parseBooleanFlag('yes', false)).toBe(true);
    expect(parseBooleanFlag('1', false)).toBe(true);
    expect(parseBooleanFlag(true, false)).toBe(true);

    expect(parseBooleanFlag('لا', true)).toBe(false);
    expect(parseBooleanFlag('non', true)).toBe(false);
    expect(parseBooleanFlag('0', true)).toBe(false);
    expect(parseBooleanFlag(false, true)).toBe(false);

    expect(parseBooleanFlag('', true)).toBe(true);
    expect(parseBooleanFlag(undefined, false)).toBe(false);
  });

  // Test 5: Dry-Run Diff Analysis (Create, Update, Unchanged, Errors)
  it('correctly evaluates course diffs, field changes, and validation errors', () => {
    const existingCourses = [
      {
        id: 1,
        name: 'تحليل رياضي 1',
        code: 'MATH101',
        semester: 'S1',
        study_level: 'L1',
        credits: 4,
        coefficient: 2,
        has_lecture: true,
        has_td: true,
        has_tp: false,
        metadata: JSON.stringify({
          semester: 'S1',
          credits: 4,
          coefficient: 2,
          study_level: 'L1',
          session_types: ['lecture', 'td'],
        }),
      },
      {
        id: 2,
        name: 'هندسة البرمجيات',
        code: 'GL101',
        semester: 'S2',
        study_level: 'L3',
        credits: 5,
        coefficient: 3,
        has_lecture: true,
        has_td: true,
        has_tp: true,
        metadata: JSON.stringify({
          semester: 'S2',
          credits: 5,
          coefficient: 3,
          study_level: 'L3',
          session_types: ['lecture', 'td', 'tp'],
        }),
      },
    ];

    const inputRows = [
      // 1. Unchanged course
      {
        'المعرف': 1,
        'اسم المقياس': 'تحليل رياضي 1',
        'رمز المقياس': 'MATH101',
        'السداسي': 'S1',
        'المستوى': 'L1',
        'المعامل': 2,
        'الرصيد': 4,
        'محاضرة': 'نعم',
        'أعمال موجهة': 'نعم',
        'أعمال تطبيقية': 'لا',
      },
      // 2. Updated course (credits changed from 5 to 6, TP changed to 'لا')
      {
        'المعرف': 2,
        'اسم المقياس': 'هندسة البرمجيات',
        'رمز المقياس': 'GL101',
        'السداسي': 'S2',
        'المستوى': 'L3',
        'المعامل': 3,
        'الرصيد': 6,
        'محاضرة': 'نعم',
        'أعمال موجهة': 'نعم',
        'أعمال تطبيقية': 'لا',
      },
      // 3. New course to create
      {
        'اسم المقياس': 'ذكاء اصطناعي',
        'رمز المقياس': 'AI301',
        'السداسي': 'S2',
        'المستوى': 'L3',
        'التخصص': 'أنظمة ذكية',
        'المعامل': 3,
        'الرصيد': 5,
      },
      // 4. Invalid course missing name (Error)
      {
        'رمز المقياس': 'UNKNOWN',
        'السداسي': 'S1',
      },
    ];

    const departments = [{ id: 1, name: 'قسم الإعلام الآلي' }];
    const specializations = [{ id: 10, name: 'أنظمة ذكية', department_id: 1 }];

    const result = dryRunCoursesImport(inputRows, existingCourses, departments, specializations);

    expect(result.summary.total).toBe(4);
    expect(result.summary.unchanged).toBe(1);
    expect(result.summary.toUpdate).toBe(1);
    expect(result.summary.toCreate).toBe(1);
    expect(result.summary.errors).toBe(1);
    expect(result.summary.canProceed).toBe(false);

    // Verify row 2 update changes
    const updatedRow = result.rows.find((r) => r.id === 2);
    expect(updatedRow).toBeDefined();
    expect(updatedRow?.action).toBe('update');
    expect(updatedRow?.changes?.length).toBeGreaterThan(0);
    expect(updatedRow?.changes?.some((c) => c.field === 'credits')).toBe(true);
    expect(updatedRow?.changes?.some((c) => c.field === 'has_tp')).toBe(true);

    // Verify row 3 create
    const createdRow = result.rows.find((r) => r.name === 'ذكاء اصطناعي');
    expect(createdRow).toBeDefined();
    expect(createdRow?.action).toBe('create');
    expect(createdRow?.specialization_id).toBe(10);
    expect(createdRow?.semester).toBe('S2');

    // Verify error row
    const errorRow = result.rows.find((r) => r.action === 'error');
    expect(errorRow).toBeDefined();
    expect(errorRow?.errorMessageAr).toContain('اسم المقياس');
  });

  // Test 6: Excel Workbook Generation
  it('generates valid RTL export and template workbooks with expected sheets', () => {
    const templateWb = buildCoursesTemplateWorkbook();
    expect(templateWb.SheetNames).toContain('دليل المقاييس');
    expect(templateWb.SheetNames).toContain('دليل المعايير البيداغوجية');

    const sheet = templateWb.Sheets['دليل المقاييس'];
    expect(sheet['!views']?.[0]?.rightToLeft).toBe(true);

    const rows = XLSX.utils.sheet_to_json(sheet);
    expect(rows.length).toBeGreaterThan(0);

    const firstRow: any = rows[0];
    expect(firstRow['اسم المقياس']).toBeDefined();
    expect(firstRow['السداسي']).toBeDefined();
    expect(firstRow['المعامل']).toBeDefined();
    expect(firstRow['الرصيد']).toBeDefined();
    expect(firstRow['ساعات المحاضرة']).toBeDefined();
    expect(firstRow['ساعات TD']).toBeDefined();
    expect(firstRow['ساعات TP']).toBeDefined();
  });

  // Test 7: Lecture, TD, and TP Hours Parsing & Diff
  it('correctly parses session hours breakdown (lecture_hours, td_hours, tp_hours) and detects diffs', () => {
    const rawRows = [
      {
        'اسم المقياس': 'برمجة الويب المتقدمة',
        'رمز المقياس': 'WEB301',
        'محاضرة': 'نعم',
        'أعمال موجهة': 'نعم',
        'أعمال تطبيقية': 'نعم',
        'ساعات المحاضرة': 2.0,
        'ساعات td': 1.5,
        'ساعات tp': 3.0,
      },
    ];

    const result = dryRunCoursesImport(rawRows, [], [], []);
    expect(result.summary.toCreate).toBe(1);
    const row = result.rows[0];
    expect(row.lecture_hours).toBe(2.0);
    expect(row.td_hours).toBe(1.5);
    expect(row.tp_hours).toBe(3.0);
    expect(row.weekly_hours).toBe(6.5);
  });
});
