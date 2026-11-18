/**
 * Djadwal Core: Systematic Course & Curriculum Excel Engine (P16) - CommonJS version
 */

const XLSX = require('xlsx');

// Arabic & Multilingual Header Dictionary
const HEADER_MAP = {
  // ID
  'المعرف': 'id',
  'معرف المقياس': 'id',
  'الرقم': 'id',
  'id': 'id',
  'course_id': 'id',

  // Name
  'المقياس': 'name',
  'اسم المقياس': 'name',
  'المادة': 'name',
  'اسم المادة': 'name',
  'الوحدة': 'name',
  'وحدة التعليم': 'name',
  'name': 'name',
  'course_name': 'name',
  'module': 'name',
  'matiere': 'name',

  // Code
  'رمز المقياس': 'code',
  'الرمز': 'code',
  'الكود': 'code',
  'code': 'code',
  'course_code': 'code',

  // Semester
  'السداسي': 'semester',
  'الفصل': 'semester',
  'الفصل الدراسي': 'semester',
  'semester': 'semester',
  'semestre': 'semester',
  'sem': 'semester',

  // Specialization
  'التخصص': 'specialization',
  'الشعبة': 'specialization',
  'المسار': 'specialization',
  'specialization': 'specialization',
  'specialite': 'specialization',
  'filiere': 'specialization',

  // Department
  'القسم': 'department',
  'اسم القسم': 'department',
  'الكلية': 'department',
  'department': 'department',
  'departement': 'department',

  // Study Level
  'المستوى': 'study_level',
  'السنة': 'study_level',
  'السنة الدراسية': 'study_level',
  'الطور': 'study_level',
  'level': 'study_level',
  'study_level': 'study_level',
  'niveau': 'study_level',

  // Coefficient
  'المعامل': 'coefficient',
  'معامل المقياس': 'coefficient',
  'coefficient': 'coefficient',
  'coef': 'coefficient',

  // Credits
  'الرصيد': 'credits',
  'أرصدة المقياس': 'credits',
  'الأرصدة': 'credits',
  'الارصدة': 'credits',
  'credits': 'credits',
  'credit': 'credits',

  // Lecture
  'محاضرة': 'has_lecture',
  'المحاضرة': 'has_lecture',
  'has_lecture': 'has_lecture',
  'lecture': 'has_lecture',
  'cours': 'has_lecture',

  // TD
  'أعمال موجهة': 'has_td',
  'اعمال موجهة': 'has_td',
  'td': 'has_td',
  'has_td': 'has_td',
  'travaux_diriges': 'has_td',

  // TP
  'أعمال تطبيقية': 'has_tp',
  'اعمال تطبيقية': 'has_tp',
  'tp': 'has_tp',
  'has_tp': 'has_tp',
  'travaux_pratiques': 'has_tp',

  // Weekly Hours
  'الحجم الساعي': 'weekly_hours',
  'الحجم الساعي الأسبوعي': 'weekly_hours',
  'الساعات الأسبوعية': 'weekly_hours',
  'weekly_hours': 'weekly_hours',
  'hours': 'weekly_hours',

  // Lecture Hours
  'ساعات المحاضرة': 'lecture_hours',
  'ساعات المحاضرات': 'lecture_hours',
  'حجم المحاضرة': 'lecture_hours',
  'lecture_hours': 'lecture_hours',

  // TD Hours
  'ساعات الأعمال الموجهة': 'td_hours',
  'ساعات اعمال موجهة': 'td_hours',
  'ساعات td': 'td_hours',
  'td_hours': 'td_hours',

  // TP Hours
  'ساعات الأعمال التطبيقية': 'tp_hours',
  'ساعات اعمال تطبيقية': 'tp_hours',
  'ساعات tp': 'tp_hours',
  'tp_hours': 'tp_hours',
};

function normalizeRawCourseRow(rawRow) {
  const normalized = {};
  for (const [key, value] of Object.entries(rawRow || {})) {
    if (value === undefined || value === null) continue;
    const cleanKey = key.toString().trim().toLowerCase().replace(/\s+/g, ' ');
    const mappedKey = HEADER_MAP[cleanKey] || HEADER_MAP[key.toString().trim()];

    if (mappedKey) {
      normalized[mappedKey] = value;
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

function normalizeSemester(val) {
  if (!val) return 'S1';
  const str = String(val).trim().toUpperCase();
  if (str === '2' || str === 'S2' || str.includes('ثاني') || str.includes('SEMESTRE 2')) {
    return 'S2';
  }
  return 'S1';
}

function normalizeStudyLevel(val) {
  if (!val) return 'L1';
  const str = String(val).trim().toUpperCase();
  if (str.includes('M2') || str.includes('ماستر 2') || str.includes('MASTER 2')) return 'M2';
  if (str.includes('M1') || str.includes('ماستر 1') || str.includes('MASTER 1')) return 'M1';
  if (str.includes('L3') || str.includes('ثالثة') || str.includes('3')) return 'L3';
  if (str.includes('L2') || str.includes('ثانية') || str.includes('2')) return 'L2';
  if (str.includes('L1') || str.includes('أولى') || str.includes('1')) return 'L1';
  return str.slice(0, 10);
}

function parseBooleanFlag(val, defaultVal) {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val > 0;

  const str = String(val).trim().toLowerCase();
  if (['نعم', 'oui', 'yes', 'true', '1', 'vrai', 'صح', 'يوجد', 'ن'].includes(str)) {
    return true;
  }
  if (['لا', 'non', 'no', 'false', '0', 'faux', 'خطأ', 'لا يوجد', 'ل'].includes(str)) {
    return false;
  }

  return defaultVal;
}

function parseCoursesExcelBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function dryRunCoursesImport(
  rawRows = [],
  existingCourses = [],
  departments = [],
  specializations = []
) {
  const analyzedRows = [];
  let toCreateCount = 0;
  let toUpdateCount = 0;
  let unchangedCount = 0;
  let errorsCount = 0;

  const existingById = new Map();
  const existingByCode = new Map();
  const existingByName = new Map();

  existingCourses.forEach((c) => {
    if (c.id !== undefined && c.id !== null) {
      existingById.set(Number(c.id), c);
    }
    if (c.code) {
      existingByCode.set(c.code.trim().toLowerCase(), c);
    }
    if (c.name) {
      existingByName.set(c.name.trim().toLowerCase(), c);
    }
  });

  const deptByName = new Map();
  departments.forEach((d) => {
    if (d.name) deptByName.set(d.name.trim().toLowerCase(), d.id);
  });

  const specByName = new Map();
  specializations.forEach((s) => {
    if (s.name) specByName.set(s.name.trim().toLowerCase(), s.id);
  });

  rawRows.forEach((raw, idx) => {
    const rawIndex = idx + 2;
    const row = normalizeRawCourseRow(raw);

    const nameStr = (row.name || '').toString().trim();
    if (!nameStr) {
      errorsCount++;
      analyzedRows.push({
        rawIndex,
        id: row.id ? Number(row.id) : null,
        name: '',
        semester: 'S1',
        credits: 3,
        coefficient: 2,
        study_level: 'L1',
        has_lecture: true,
        has_td: true,
        has_tp: false,
        weekly_hours: 3.0,
        lecture_hours: 1.5,
        td_hours: 1.5,
        tp_hours: 0.0,
        action: 'error',
        errorMessageAr: 'اسم المقياس حقل إجباري مفقود في هذا الصف.',
      });
      return;
    }

    const codeStr = (row.code || '').toString().trim() || null;
    const semester = normalizeSemester(row.semester);
    const studyLevel = normalizeStudyLevel(row.study_level);
    const credits = Math.max(1, Math.min(30, Number(row.credits) || 3));
    const coefficient = Math.max(1, Math.min(10, Number(row.coefficient) || 2));
    const hasLecture = parseBooleanFlag(row.has_lecture, true);
    const hasTD = parseBooleanFlag(row.has_td, true);
    const hasTP = parseBooleanFlag(row.has_tp, false);

    const parseHours = (v) => {
      const n = Number(v);
      return !isNaN(n) && n >= 0 ? n : null;
    };
    const rowLectureHours = parseHours(row.lecture_hours);
    const rowTdHours = parseHours(row.td_hours);
    const rowTpHours = parseHours(row.tp_hours);

    const lectureHours = rowLectureHours !== null ? rowLectureHours : (hasLecture ? 1.5 : 0.0);
    const tdHours = rowTdHours !== null ? rowTdHours : (hasTD ? 1.5 : 0.0);
    const tpHours = rowTpHours !== null ? rowTpHours : (hasTP ? 1.5 : 0.0);

    let weeklyHours = Number(row.weekly_hours) > 0
      ? Number(row.weekly_hours)
      : Number((lectureHours + tdHours + tpHours).toFixed(2));
    if (weeklyHours <= 0) {
      weeklyHours = 3.0;
    }

    const deptStr = (row.department || '').toString().trim() || null;
    const specStr = (row.specialization || '').toString().trim() || null;

    const resolvedDeptId = deptStr && deptByName.has(deptStr.toLowerCase())
      ? deptByName.get(deptStr.toLowerCase())
      : (row.department_id ? Number(row.department_id) : null);

    const resolvedSpecId = specStr && specByName.has(specStr.toLowerCase())
      ? specByName.get(specStr.toLowerCase())
      : (row.specialization_id ? Number(row.specialization_id) : null);

    let matchedCourse = null;
    if (row.id && !isNaN(Number(row.id)) && existingById.has(Number(row.id))) {
      matchedCourse = existingById.get(Number(row.id));
    } else if (codeStr && existingByCode.has(codeStr.toLowerCase())) {
      matchedCourse = existingByCode.get(codeStr.toLowerCase());
    } else if (existingByName.has(nameStr.toLowerCase())) {
      matchedCourse = existingByName.get(nameStr.toLowerCase());
    }

    if (!matchedCourse) {
      toCreateCount++;
      analyzedRows.push({
        rawIndex,
        id: null,
        name: nameStr,
        code: codeStr,
        semester,
        specialization: specStr,
        specialization_id: resolvedSpecId,
        department: deptStr,
        department_id: resolvedDeptId,
        credits,
        coefficient,
        study_level: studyLevel,
        has_lecture: hasLecture,
        has_td: hasTD,
        has_tp: hasTP,
        weekly_hours: weeklyHours,
        lecture_hours: lectureHours,
        td_hours: tdHours,
        tp_hours: tpHours,
        action: 'create',
      });
    } else {
      const changes = [];

      if (matchedCourse.name?.trim() !== nameStr) {
        changes.push({
          field: 'name',
          fieldLabelAr: 'اسم المقياس',
          oldValue: matchedCourse.name || '',
          newValue: nameStr,
        });
      }

      const oldCode = (matchedCourse.code || '').trim();
      if (codeStr && oldCode !== codeStr) {
        changes.push({
          field: 'code',
          fieldLabelAr: 'رمز المقياس',
          oldValue: oldCode,
          newValue: codeStr,
        });
      }

      let existingMeta = {};
      try {
        if (typeof matchedCourse.metadata === 'string') {
          existingMeta = JSON.parse(matchedCourse.metadata || '{}');
        } else if (typeof matchedCourse.metadata === 'object' && matchedCourse.metadata) {
          existingMeta = matchedCourse.metadata;
        }
      } catch {
        existingMeta = {};
      }

      const oldSemester = matchedCourse.semester || existingMeta.semester || 'S1';
      if (oldSemester !== semester) {
        changes.push({
          field: 'semester',
          fieldLabelAr: 'السداسي',
          oldValue: oldSemester,
          newValue: semester,
        });
      }

      const oldCredits = Number(matchedCourse.credits ?? existingMeta.credits ?? 3);
      if (oldCredits !== credits) {
        changes.push({
          field: 'credits',
          fieldLabelAr: 'الرصيد',
          oldValue: oldCredits,
          newValue: credits,
        });
      }

      const oldCoef = Number(matchedCourse.coefficient ?? existingMeta.coefficient ?? 2);
      if (oldCoef !== coefficient) {
        changes.push({
          field: 'coefficient',
          fieldLabelAr: 'المعامل',
          oldValue: oldCoef,
          newValue: coefficient,
        });
      }

      const oldLevel = matchedCourse.study_level || existingMeta.study_level || 'L1';
      if (oldLevel !== studyLevel) {
        changes.push({
          field: 'study_level',
          fieldLabelAr: 'المستوى',
          oldValue: oldLevel,
          newValue: studyLevel,
        });
      }

      const existingSessionTypes = Array.isArray(existingMeta.session_types)
        ? existingMeta.session_types
        : ['lecture', 'td'];

      const oldHasLecture = matchedCourse.has_lecture !== undefined
        ? Boolean(matchedCourse.has_lecture)
        : existingSessionTypes.includes('lecture');
      if (oldHasLecture !== hasLecture) {
        changes.push({
          field: 'has_lecture',
          fieldLabelAr: 'محاضرة',
          oldValue: oldHasLecture ? 'نعم' : 'لا',
          newValue: hasLecture ? 'نعم' : 'لا',
        });
      }

      const oldHasTD = matchedCourse.has_td !== undefined
        ? Boolean(matchedCourse.has_td)
        : existingSessionTypes.includes('td');
      if (oldHasTD !== hasTD) {
        changes.push({
          field: 'has_td',
          fieldLabelAr: 'أعمال موجهة (TD)',
          oldValue: oldHasTD ? 'نعم' : 'لا',
          newValue: hasTD ? 'نعم' : 'لا',
        });
      }

      const oldHasTP = matchedCourse.has_tp !== undefined
        ? Boolean(matchedCourse.has_tp)
        : existingSessionTypes.includes('tp');
      if (oldHasTP !== hasTP) {
        changes.push({
          field: 'has_tp',
          fieldLabelAr: 'أعمال تطبيقية (TP)',
          oldValue: oldHasTP ? 'نعم' : 'لا',
          newValue: hasTP ? 'نعم' : 'لا',
        });
      }

      const oldWeeklyHours = Number(matchedCourse.weekly_hours ?? existingMeta.weekly_hours ?? 3.0);
      const oldLectureHours = Number(matchedCourse.lecture_hours ?? existingMeta.lecture_hours ?? (oldHasLecture ? 1.5 : 0.0));
      const oldTdHours = Number(matchedCourse.td_hours ?? existingMeta.td_hours ?? (oldHasTD ? 1.5 : 0.0));
      const oldTpHours = Number(matchedCourse.tp_hours ?? existingMeta.tp_hours ?? (oldHasTP ? 1.5 : 0.0));

      if (Math.abs(oldLectureHours - lectureHours) > 0.01) {
        changes.push({
          field: 'lecture_hours',
          fieldLabelAr: 'ساعات المحاضرة',
          oldValue: `${oldLectureHours}س`,
          newValue: `${lectureHours}س`,
        });
      }

      if (Math.abs(oldTdHours - tdHours) > 0.01) {
        changes.push({
          field: 'td_hours',
          fieldLabelAr: 'ساعات الأعمال الموجهة (TD)',
          oldValue: `${oldTdHours}س`,
          newValue: `${tdHours}س`,
        });
      }

      if (Math.abs(oldTpHours - tpHours) > 0.01) {
        changes.push({
          field: 'tp_hours',
          fieldLabelAr: 'ساعات الأعمال التطبيقية (TP)',
          oldValue: `${oldTpHours}س`,
          newValue: `${tpHours}س`,
        });
      }

      if (Math.abs(oldWeeklyHours - weeklyHours) > 0.01) {
        changes.push({
          field: 'weekly_hours',
          fieldLabelAr: 'الحجم الساعي الأسبوعي',
          oldValue: `${oldWeeklyHours}س`,
          newValue: `${weeklyHours}س`,
        });
      }

      if (changes.length > 0) {
        toUpdateCount++;
        analyzedRows.push({
          rawIndex,
          id: matchedCourse.id,
          name: nameStr,
          code: codeStr,
          semester,
          specialization: specStr,
          specialization_id: resolvedSpecId,
          department: deptStr,
          department_id: resolvedDeptId,
          credits,
          coefficient,
          study_level: studyLevel,
          has_lecture: hasLecture,
          has_td: hasTD,
          has_tp: hasTP,
          weekly_hours: weeklyHours,
          lecture_hours: lectureHours,
          td_hours: tdHours,
          tp_hours: tpHours,
          action: 'update',
          changes,
          existingCourse: matchedCourse,
        });
      } else {
        unchangedCount++;
        analyzedRows.push({
          rawIndex,
          id: matchedCourse.id,
          name: nameStr,
          code: codeStr,
          semester,
          specialization: specStr,
          specialization_id: resolvedSpecId,
          department: deptStr,
          department_id: resolvedDeptId,
          credits,
          coefficient,
          study_level: studyLevel,
          has_lecture: hasLecture,
          has_td: hasTD,
          has_tp: hasTP,
          weekly_hours: weeklyHours,
          lecture_hours: lectureHours,
          td_hours: tdHours,
          tp_hours: tpHours,
          action: 'unchanged',
          existingCourse: matchedCourse,
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
      canProceed: errorsCount === 0,
    },
    rows: analyzedRows,
    timestamp: new Date().toISOString(),
  };
}

function buildCoursesExportWorkbook(courses = []) {
  const wb = XLSX.utils.book_new();

  const exportData = courses.map((c, idx) => {
    let meta = {};
    try {
      if (typeof c.metadata === 'string') meta = JSON.parse(c.metadata || '{}');
      else if (typeof c.metadata === 'object' && c.metadata) meta = c.metadata;
    } catch {
      meta = {};
    }

    const sessionTypes = Array.isArray(meta.session_types)
      ? meta.session_types
      : ['lecture', 'td'];

    const hasLecture = c.has_lecture !== undefined ? Boolean(c.has_lecture) : sessionTypes.includes('lecture');
    const hasTD = c.has_td !== undefined ? Boolean(c.has_td) : sessionTypes.includes('td');
    const hasTP = c.has_tp !== undefined ? Boolean(c.has_tp) : sessionTypes.includes('tp');

    const lectureHours = Number(c.lecture_hours ?? meta.lecture_hours ?? (hasLecture ? 1.5 : 0.0));
    const tdHours = Number(c.td_hours ?? meta.td_hours ?? (hasTD ? 1.5 : 0.0));
    const tpHours = Number(c.tp_hours ?? meta.tp_hours ?? (hasTP ? 1.5 : 0.0));
    const weeklyHours = Number(c.weekly_hours ?? meta.weekly_hours ?? (lectureHours + tdHours + tpHours));

    return {
      'المعرف': c.id ?? (idx + 1),
      'اسم المقياس': c.name || '',
      'رمز المقياس': c.code || '',
      'السداسي': c.semester || meta.semester || 'S1',
      'المستوى': c.study_level || meta.study_level || 'L1',
      'التخصص': c.specialization_name || c.specialization || meta.specialization || 'جذع مشترك',
      'القسم': c.department_name || c.department || '',
      'المعامل': c.coefficient ?? meta.coefficient ?? 2,
      'الرصيد': c.credits ?? meta.credits ?? 3,
      'محاضرة': hasLecture ? 'نعم' : 'لا',
      'أعمال موجهة TD': hasTD ? 'نعم' : 'لا',
      'أعمال تطبيقية TP': hasTP ? 'نعم' : 'لا',
      'ساعات المحاضرة': lectureHours,
      'ساعات TD': tdHours,
      'ساعات TP': tpHours,
      'الحجم الساعي الأسبوعي': weeklyHours,
      'الحالة': c.deleted_at ? 'مؤرشف' : 'نشط',
    };
  });

  const wsData = XLSX.utils.json_to_sheet(exportData);
  wsData['!cols'] = [
    { wch: 10 },
    { wch: 32 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 26 },
    { wch: 22 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
    { wch: 12 },
  ];
  wsData['!views'] = [{ rightToLeft: true }];
  XLSX.utils.book_append_sheet(wb, wsData, 'دليل المقاييس');

  const guideData = [
    {
      'العنصر البيداغوجي': 'السداسي (Semester)',
      'القيم المقبولة': 'S1, S2 (أو السداسي الأول / السداسي الثاني)',
      'الأهمية في النظام': 'تحديد السداسي يضمن تغذية محرك الجداول الآلي بمقاييس الفصل النشط فقط وتفادي أي تداخل.',
    },
    {
      'العنصر البيداغوجي': 'المعامل والرصيد (Credits & Coef)',
      'القيم المقبولة': 'أرقام صحيحة موجبة (المعامل: 1-10، الرصيد: 1-30)',
      'الأهمية في النظام': 'وفق معايير نظام LMD الجزائري لموازنة الحجم الساعي والعبء البيداغوجي.',
    },
    {
      'العنصر البيداغوجي': 'نوع الحصص (Lecture, TD, TP)',
      'القيم المقبولة': 'نعم / لا (أو 1 / 0)',
      'الأهمية في النظام': 'تحديد ما إذا كان المقياس يتطلب محاضرات، أعمالاً موجهة، أو أعمالاً تطبيقية في مخابر متخصصة.',
    },
    {
      'العنصر البيداغوجي': 'ساعات المحاضرة و TD و TP',
      'القيم المقبولة': 'أرقام عشرية (مثلاً: 1.5 أو 1.0 أو 2.0 أو 3.0)',
      'الأهمية في النظام': 'تعتمد مباشرة في مصفوفة الجداول الآلية لتحديد مدة الحصة ومطابقة القاعات والأساتذة بدون أخطاء.',
    },
    {
      'العنصر البيداغوجي': 'التخصص والقسم',
      'القيم المقبولة': 'اسم التخصص أو اتركه "جذع مشترك"',
      'الأهمية في النظام': 'ربط المقياس بالأفواج الطلابية وقاعات الأقسام المعنية.',
    },
  ];

  const wsGuide = XLSX.utils.json_to_sheet(guideData);
  wsGuide['!cols'] = [
    { wch: 28 },
    { wch: 35 },
    { wch: 65 },
  ];
  wsGuide['!views'] = [{ rightToLeft: true }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'دليل المعايير البيداغوجية');

  return wb;
}

function buildCoursesTemplateWorkbook() {
  const sampleCourses = [
    {
      id: '',
      name: 'خوارزميات وهياكل البيانات 1',
      code: 'INFO101',
      semester: 'S1',
      study_level: 'L1',
      specialization_name: 'إعلام آلي',
      department_name: 'قسم الإعلام الآلي',
      coefficient: 3,
      credits: 6,
      has_lecture: true,
      has_td: true,
      has_tp: true,
      lecture_hours: 1.5,
      td_hours: 1.5,
      tp_hours: 1.5,
      weekly_hours: 4.5,
    },
    {
      id: '',
      name: 'أنظمة التشغيل 1',
      code: 'INFO201',
      semester: 'S1',
      study_level: 'L2',
      specialization_name: 'أنظمة معلوماتية',
      department_name: 'قسم الإعلام الآلي',
      coefficient: 2,
      credits: 4,
      has_lecture: true,
      has_td: true,
      has_tp: false,
      lecture_hours: 1.5,
      td_hours: 1.5,
      tp_hours: 0.0,
      weekly_hours: 3.0,
    },
    {
      id: '',
      name: 'قواعد البيانات المتقدمة',
      code: 'INFO302',
      semester: 'S2',
      study_level: 'L3',
      specialization_name: 'هندسة البرمجيات',
      department_name: 'قسم الإعلام الآلي',
      coefficient: 3,
      credits: 5,
      has_lecture: true,
      has_td: true,
      has_tp: true,
      lecture_hours: 1.5,
      td_hours: 1.5,
      tp_hours: 1.5,
      weekly_hours: 4.5,
    },
  ];

  return buildCoursesExportWorkbook(sampleCourses);
}

module.exports = {
  HEADER_MAP,
  normalizeRawCourseRow,
  normalizeSemester,
  normalizeStudyLevel,
  parseBooleanFlag,
  parseCoursesExcelBuffer,
  dryRunCoursesImport,
  buildCoursesExportWorkbook,
  buildCoursesTemplateWorkbook,
};
