import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  normalizeRawRow,
  parseIsTemporary,
  dryRunProfessorsImport,
  buildProfessorsExportWorkbook,
  buildProfessorsTemplateWorkbook,
} from '../src/excel/professor-excel.js';
import { normalizeAcademicRank, getRankDefinition } from '../src/constants/professor-ranks.js';

describe('P15: Systematic Professor Excel Export, Import & Dry-Run Suite', () => {
  // Test 1: Header Mapping & Row Normalization
  it('correctly normalizes Arabic and alternative header keys to canonical fields', () => {
    const rawArabicRow = {
      'المعرف': 42,
      'الاسم واللقب': 'د. خالد بن يوسف',
      'البريد المهني': 'khaled.benyoussef@univ-alger.dz',
      'رقم الهاتف': '0550123456',
      'الرتبة الأكاديمية': 'أستاذ محاضر - أ',
      'الصفة التعاقدية': 'دائم',
      'التخصص': 'أنظمة ذكية ورياضيات تطبيقية',
      'القسم': 'قسم الرياضيات',
    };

    const normalized = normalizeRawRow(rawArabicRow);
    expect(normalized.id).toBe(42);
    expect(normalized.name).toBe('د. خالد بن يوسف');
    expect(normalized.email).toBe('khaled.benyoussef@univ-alger.dz');
    expect(normalized.phone).toBe('0550123456');
    expect(normalized.academic_rank).toBe('أستاذ محاضر - أ');
    expect(normalized.is_temporary).toBe('دائم');
    expect(normalized.specialization).toBe('أنظمة ذكية ورياضيات تطبيقية');
    expect(normalized.department).toBe('قسم الرياضيات');
  });

  // Test 2: Flexible Temporary / Permanent Parser
  it('accurately parses contract and temporary status from Arabic and multilingual inputs', () => {
    // Vacataire / Temporary
    expect(parseIsTemporary('مؤقت', false)).toBe(true);
    expect(parseIsTemporary('أستاذ مؤقت / متعاقد', false)).toBe(true);
    expect(parseIsTemporary('vacataire', false)).toBe(true);
    expect(parseIsTemporary(true, false)).toBe(true);
    expect(parseIsTemporary('1', false)).toBe(true);

    // Permanent
    expect(parseIsTemporary('دائم', true)).toBe(false);
    expect(parseIsTemporary('permanent', true)).toBe(false);
    expect(parseIsTemporary(false, true)).toBe(false);
    expect(parseIsTemporary('0', true)).toBe(false);

    // Fallback to rank default
    expect(parseIsTemporary(undefined, true)).toBe(true);
    expect(parseIsTemporary(null, false)).toBe(false);
    expect(parseIsTemporary('', true)).toBe(true);
  });

  // Test 3: Dry-Run Engine with Creation, Updates, Unchanged and Error Detection
  it('evaluates dry-run operations accurately with fine-grained field diffs and validation', () => {
    const existingProfessors = [
      {
        id: 1,
        name: 'د. يوسف منصوري',
        email: 'y.mansouri@univ-alger.dz',
        phone: '0555112233',
        academic_rank: 'assistant_professor',
        title: 'أستاذ مساعد',
        is_temporary: false,
        specialization: 'إلكترونيك',
      },
      {
        id: 2,
        name: 'أ. ليلى قدور',
        email: 'l.kaddour@univ-alger.dz',
        phone: '0666334455',
        academic_rank: 'temporary',
        title: 'أستاذ(ة) مؤقت(ة)',
        is_temporary: true,
        specialization: 'لغات أجنبية',
      },
    ];

    const incomingRows = [
      // 1. Existing Professor updated (Rank promotion + phone update)
      {
        'المعرف': 1,
        'الاسم واللقب': 'د. يوسف منصوري',
        'البريد المهني': 'y.mansouri@univ-alger.dz',
        'رقم الهاتف': '0555998877', // Changed
        'الرتبة الأكاديمية': 'أستاذ محاضر - ب', // Promoted
        'الصفة التعاقدية': 'دائم',
        'التخصص': 'إلكترونيك',
      },
      // 2. Existing Professor unchanged
      {
        'المعرف': 2,
        'الاسم واللقب': 'أ. ليلى قدور',
        'البريد المهني': 'l.kaddour@univ-alger.dz',
        'رقم الهاتف': '0666334455',
        'الرتبة الأكاديمية': 'أستاذ(ة) مؤقت(ة)',
        'الصفة التعاقدية': 'مؤقت',
        'التخصص': 'لغات أجنبية',
      },
      // 3. New Professor (Create)
      {
        'الاسم واللقب': 'د. كريم ساحلي',
        'البريد المهني': 'k.sahli@univ-alger.dz',
        'الرتبة الأكاديمية': 'أستاذ محاضر - أ',
        'الصفة التعاقدية': 'دائم',
        'التخصص': 'أمن المعلومات',
      },
      // 4. Invalid Row (Missing Name)
      {
        'الاسم واللقب': '',
        'البريد المهني': 'invalid@univ-alger.dz',
      },
      // 5. Invalid Row (Bad Email)
      {
        'الاسم واللقب': 'أستاذ غير صالح',
        'البريد المهني': 'not-an-email-address',
      },
    ];

    const result = dryRunProfessorsImport(incomingRows, existingProfessors);

    expect(result.summary.total).toBe(5);
    expect(result.summary.toUpdate).toBe(1);
    expect(result.summary.unchanged).toBe(1);
    expect(result.summary.toCreate).toBe(1);
    expect(result.summary.errors).toBe(2);

    // Verify Row 1: Update
    const row1 = result.rows[0];
    expect(row1.action).toBe('update');
    expect(row1.id).toBe(1);
    expect(row1.changes).toHaveLength(2); // Phone & Rank changes
    const rankChange = row1.changes?.find((c) => c.field === 'academic_rank');
    expect(rankChange?.oldValue).toBe('أستاذ مساعد');
    expect(rankChange?.newValue).toBe('أستاذ محاضر - ب');

    // Verify Row 2: Unchanged
    const row2 = result.rows[1];
    expect(row2.action).toBe('unchanged');
    expect(row2.id).toBe(2);

    // Verify Row 3: Create
    const row3 = result.rows[2];
    expect(row3.action).toBe('create');
    expect(row3.name).toBe('د. كريم ساحلي');
    expect(row3.academic_rank).toBe('lecturer_a');
    expect(row3.is_temporary).toBe(false);

    // Verify Rows 4 & 5: Errors
    expect(result.rows[3].action).toBe('error');
    expect(result.rows[3].errorMessageAr).toContain('اسم الأستاذ حقل إجباري');

    expect(result.rows[4].action).toBe('error');
    expect(result.rows[4].errorMessageAr).toContain('صيغة البريد الإلكتروني');
  });

  // Test 4: Export Workbook Generation & Sheet Structure
  it('generates a valid, multi-sheet, RTL-enabled workbook for export and templates', () => {
    const professors = [
      {
        id: 101,
        name: 'أ.د فاطمة الزهراء',
        email: 'fz@univ-alger.dz',
        phone: '0550001122',
        academic_rank: 'professor',
        is_temporary: false,
        specialization: 'ذكاء اصطناعي',
        department_name: 'قسم الإعلام الآلي',
      },
    ];

    const wb = buildProfessorsExportWorkbook(professors);
    expect(wb.SheetNames).toContain('قائمة الأساتذة');
    expect(wb.SheetNames).toContain('دليل الرتب والتعليمات');

    const dataSheet = wb.Sheets['قائمة الأساتذة'];
    expect(dataSheet['!views']?.[0]?.rightToLeft).toBe(true);

    const json = XLSX.utils.sheet_to_json(dataSheet) as any[];
    expect(json).toHaveLength(1);
    expect(json[0]['الاسم واللقب']).toBe('أ.د فاطمة الزهراء');
    expect(json[0]['الرتبة الأكاديمية']).toBe('أستاذ');
    expect(json[0]['رمز الرتبة (داخلي)']).toBe('professor');
    expect(json[0]['الصفة التعاقدية']).toBe('دائم');
    expect(json[0]['النصاب القانوني (ساعات أسبوعياً)']).toBe(6);

    // Blank Template Verification
    const templateWb = buildProfessorsTemplateWorkbook();
    expect(templateWb.SheetNames).toContain('قائمة الأساتذة');
    const templateData = XLSX.utils.sheet_to_json(templateWb.Sheets['قائمة الأساتذة']);
    expect(templateData.length).toBeGreaterThanOrEqual(2);
  });

  // Test 5: Full Binary Round-Trip (Export to Buffer -> Read -> Dry-Run)
  it('completes a lossless binary round-trip from export buffer to parsed dry-run', () => {
    const initialProfessors = [
      {
        id: 55,
        name: 'د. سامي بوزيد',
        email: 's.bouzid@univ-alger.dz',
        phone: '0540112233',
        academic_rank: 'lecturer_b',
        is_temporary: false,
        specialization: 'شبكات الحاسوب',
        department_name: 'قسم الإعلام الآلي',
      },
    ];

    // Generate workbook and serialize to binary buffer
    const wb = buildProfessorsExportWorkbook(initialProfessors);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Read back workbook from buffer
    const readWb = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = readWb.SheetNames[0];
    const parsedRows = XLSX.utils.sheet_to_json(readWb.Sheets[firstSheetName]);

    // Feed parsed rows into dry-run against the same DB
    const dryRun = dryRunProfessorsImport(parsedRows as Record<string, any>[], initialProfessors);

    expect(dryRun.summary.total).toBe(1);
    expect(dryRun.summary.unchanged).toBe(1);
    expect(dryRun.summary.errors).toBe(0);
    expect(dryRun.rows[0].name).toBe('د. سامي بوزيد');
    expect(dryRun.rows[0].academic_rank).toBe('lecturer_b');
  });
});
