const { coursesRepository } = require('../../../packages/core/src/repositories/index.js');
const { executeQuery } = require('../../database.js');
const { unitOfWork } = require('../../../packages/core/src/unitOfWork.js');
const XLSX = require('xlsx');
const {
  normalizeRawCourseRow,
  normalizeSemester,
  normalizeStudyLevel,
  parseBooleanFlag,
  dryRunCoursesImport,
  buildCoursesExportWorkbook,
  buildCoursesTemplateWorkbook,
} = require('../../../packages/core/src/excel/course-curriculum-excel.js');

/**
 * Enriches course row with synthesized metadata and defaults for 100% backward/forward compatibility.
 */
function enrichCourseRow(row) {
  if (!row) return row;
  let meta = {};
  try {
    if (typeof row.metadata === 'string') meta = JSON.parse(row.metadata || '{}');
    else if (typeof row.metadata === 'object' && row.metadata) meta = row.metadata;
  } catch {
    meta = {};
  }

  const sessionTypes = Array.isArray(meta.session_types)
    ? meta.session_types
    : [
        row.has_lecture !== false ? 'lecture' : null,
        row.has_td !== false ? 'td' : null,
        row.has_tp ? 'tp' : null,
      ].filter(Boolean);

  const hasLecture = row.has_lecture !== undefined ? Boolean(row.has_lecture) : sessionTypes.includes('lecture');
  const hasTD = row.has_td !== undefined ? Boolean(row.has_td) : sessionTypes.includes('td');
  const hasTP = row.has_tp !== undefined ? Boolean(row.has_tp) : sessionTypes.includes('tp');

  const specializationId = row.specialization_id ?? meta.specialization_id ?? null;
  const specializationIds = Array.isArray(meta.specialization_ids) && meta.specialization_ids.length > 0
    ? meta.specialization_ids
    : (specializationId ? [specializationId] : []);

  let specialties = [];
  if (Array.isArray(meta.specialties) && meta.specialties.length > 0) {
    specialties = meta.specialties.map(s => String(s).trim()).filter(Boolean);
  } else if (typeof meta.specialties === 'string' && meta.specialties.trim()) {
    specialties = meta.specialties.split(/[،,]/).map(s => s.trim()).filter(Boolean);
  } else if (meta.specialization && typeof meta.specialization === 'string') {
    specialties = meta.specialization.split(/[،,]/).map(s => s.trim()).filter(Boolean);
  } else if (row.specialization_name) {
    specialties = [row.specialization_name];
  }

  const specializationStr = specialties.length > 0
    ? specialties.join('، ')
    : (meta.specialization || row.specialization_name || '');

  const explicitLecture = meta.lecture_hours !== undefined ? Number(meta.lecture_hours) : (row.lecture_hours !== undefined ? Number(row.lecture_hours) : null);
  const explicitTD = meta.td_hours !== undefined ? Number(meta.td_hours) : (row.td_hours !== undefined ? Number(row.td_hours) : null);
  const explicitTP = meta.tp_hours !== undefined ? Number(meta.tp_hours) : (row.tp_hours !== undefined ? Number(row.tp_hours) : null);

  const lectureHours = explicitLecture !== null ? explicitLecture : (hasLecture ? 1.5 : 0);
  const tdHours = explicitTD !== null ? explicitTD : (hasTD ? 1.5 : 0);
  const tpHours = explicitTP !== null ? explicitTP : (hasTP ? 1.5 : 0);
  const calculatedTotal = lectureHours + tdHours + tpHours;
  const weeklyHours = Number(row.weekly_hours ?? meta.weekly_hours ?? (calculatedTotal > 0 ? calculatedTotal : 3.0));

  return {
    ...row,
    semester: row.semester || meta.semester || 'S1',
    credits: Number(row.credits ?? meta.credits ?? 3),
    coefficient: Number(row.coefficient ?? meta.coefficient ?? 2),
    study_level: row.study_level || meta.study_level || 'L1',
    specialization_id: specializationId,
    specialization_ids: specializationIds,
    specialization: specializationStr,
    specialization_name: specializationStr || row.specialization_name,
    specialties,
    has_lecture: hasLecture,
    has_td: hasTD,
    has_tp: hasTP,
    lecture_hours: lectureHours,
    td_hours: tdHours,
    tp_hours: tpHours,
    weekly_hours: weeklyHours,
    session_types: sessionTypes.length > 0 ? sessionTypes : ['lecture', 'td'],
  };
}

async function listCourses(req, res) {
  try {
    const withArchived = req.query.withArchived === 'true';
    const { semester, specialization_id, specialization, specialty, department_id, study_level, search } = req.query;

    let rows = [];
    try {
      rows = await executeQuery(`
        SELECT c.*,
               d.name as department_name,
               s.name as specialization_name
        FROM courses c
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN specializations s ON c.specialization_id = s.id
        WHERE ($1 = true OR c.deleted_at IS NULL)
        ORDER BY c.name ASC
      `, [withArchived]);
    } catch {
      // Fallback if joined columns not yet available
      try {
        rows = await executeQuery(`
          SELECT c.*, d.name as department_name
          FROM courses c
          LEFT JOIN departments d ON c.department_id = d.id
          WHERE ($1 = true OR c.deleted_at IS NULL)
          ORDER BY c.name ASC
        `, [withArchived]);
      } catch {
        rows = await coursesRepository.list({ withArchived, orderBy: 'name ASC' });
      }
    }

    let enriched = (rows || []).map(enrichCourseRow);

    // Apply pedagogical query filters
    if (semester) {
      enriched = enriched.filter((c) => c.semester === semester);
    }
    if (specialization_id) {
      const specNum = Number(specialization_id);
      enriched = enriched.filter(
        (c) => c.specialization_id === specNum || (Array.isArray(c.specialization_ids) && c.specialization_ids.includes(specNum))
      );
    }
    if (specialization || specialty) {
      const targetSpec = String(specialization || specialty).trim().toLowerCase();
      enriched = enriched.filter(
        (c) =>
          (Array.isArray(c.specialties) && c.specialties.some(s => s.toLowerCase().includes(targetSpec) || targetSpec.includes(s.toLowerCase()))) ||
          (c.specialization && c.specialization.toLowerCase().includes(targetSpec)) ||
          (c.specialization_name && c.specialization_name.toLowerCase().includes(targetSpec))
      );
    }
    if (department_id) {
      const deptNum = Number(department_id);
      enriched = enriched.filter((c) => c.department_id === deptNum);
    }
    if (study_level) {
      enriched = enriched.filter((c) => c.study_level === study_level);
    }
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      enriched = enriched.filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(term)) ||
          (c.code && c.code.toLowerCase().includes(term)) ||
          (c.specialization && c.specialization.toLowerCase().includes(term))
      );
    }

    res.json(enriched);
  } catch (err) {
    console.error('[ListCourses] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getCourse(req, res) {
  try {
    const { id } = req.params;
    const withArchived = req.query.withArchived === 'true';
    let row = null;
    try {
      const rows = await executeQuery(`
        SELECT c.*,
               d.name as department_name,
               s.name as specialization_name
        FROM courses c
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN specializations s ON c.specialization_id = s.id
        WHERE c.id = $1 AND ($2 = true OR c.deleted_at IS NULL)
      `, [id, withArchived]);
      row = rows && rows[0];
    } catch {
      row = await coursesRepository.get(id, { withArchived });
    }

    if (!row) {
      return res.status(404).json({ error: 'المقياس غير موجود' });
    }
    res.json(enrichCourseRow(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createCourse(req, res) {
  try {
    const {
      name,
      code,
      department_id,
      specialization_id,
      specialization_ids,
      specialization,
      specialties,
      semester = 'S1',
      credits = 3,
      coefficient = 2,
      has_lecture = true,
      has_td = true,
      has_tp = false,
      study_level = 'L1',
      weekly_hours,
      lecture_hours,
      td_hours,
      tp_hours,
      metadata
    } = req.body;

    let existingMeta = {};
    if (typeof metadata === 'object' && metadata !== null) existingMeta = metadata;
    else if (typeof metadata === 'string') {
      try { existingMeta = JSON.parse(metadata); } catch { existingMeta = {}; }
    }

    const session_types = [];
    if (has_lecture) session_types.push('lecture');
    if (has_td) session_types.push('td');
    if (has_tp) session_types.push('tp');

    const explicitLecture = lecture_hours !== undefined ? Number(lecture_hours) : (existingMeta.lecture_hours !== undefined ? Number(existingMeta.lecture_hours) : null);
    const explicitTD = td_hours !== undefined ? Number(td_hours) : (existingMeta.td_hours !== undefined ? Number(existingMeta.td_hours) : null);
    const explicitTP = tp_hours !== undefined ? Number(tp_hours) : (existingMeta.tp_hours !== undefined ? Number(existingMeta.tp_hours) : null);

    const effectiveLectureHours = explicitLecture !== null ? explicitLecture : (has_lecture ? 1.5 : 0);
    const effectiveTDHours = explicitTD !== null ? explicitTD : (has_td ? 1.5 : 0);
    const effectiveTPHours = explicitTP !== null ? explicitTP : (has_tp ? 1.5 : 0);

    const calculatedTotal = effectiveLectureHours + effectiveTDHours + effectiveTPHours;
    const effectiveWeekly = weekly_hours !== undefined ? Number(weekly_hours) : (calculatedTotal > 0 ? calculatedTotal : 3.0);

    let parsedSpecialties = [];
    if (Array.isArray(specialties)) {
      parsedSpecialties = specialties.map(s => String(s).trim()).filter(Boolean);
    } else if (typeof specialties === 'string' && specialties.trim()) {
      parsedSpecialties = specialties.split(/[،,]/).map(s => s.trim()).filter(Boolean);
    } else if (typeof specialization === 'string' && specialization.trim()) {
      parsedSpecialties = specialization.split(/[،,]/).map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(existingMeta.specialties)) {
      parsedSpecialties = existingMeta.specialties.map(s => String(s).trim()).filter(Boolean);
    }

    const specializationText = parsedSpecialties.length > 0
      ? parsedSpecialties.join('، ')
      : (specialization || existingMeta.specialization || '');

    const metaPayload = {
      ...existingMeta,
      semester,
      credits: Number(credits) || 3,
      coefficient: Number(coefficient) || 2,
      study_level,
      session_types,
      specialization: specializationText,
      specialties: parsedSpecialties,
      specialization_id: specialization_id ? Number(specialization_id) : null,
      specialization_ids: Array.isArray(specialization_ids)
        ? specialization_ids.map(Number)
        : (specialization_id ? [Number(specialization_id)] : []),
      lecture_hours: effectiveLectureHours,
      td_hours: effectiveTDHours,
      tp_hours: effectiveTPHours,
      weekly_hours: effectiveWeekly
    };

    const fullPayload = {
      name: name.trim(),
      code: code ? code.trim() : null,
      department_id: department_id ? Number(department_id) : null,
      specialization_id: specialization_id ? Number(specialization_id) : null,
      semester,
      credits: Number(credits) || 3,
      coefficient: Number(coefficient) || 2,
      has_lecture: Boolean(has_lecture),
      has_td: Boolean(has_td),
      has_tp: Boolean(has_tp),
      study_level,
      weekly_hours: effectiveWeekly,
      metadata: JSON.stringify(metaPayload)
    };

    let created = null;
    try {
      created = await coursesRepository.create(fullPayload, { userId: req.user?.id });
    } catch {
      // Fallback for pre-migration schema
      created = await coursesRepository.create({
        name: name.trim(),
        code: code ? code.trim() : null,
        department_id: department_id ? Number(department_id) : null,
        metadata: JSON.stringify(metaPayload)
      }, { userId: req.user?.id });
    }

    // Link in course_specializations junction table if present
    const specList = metaPayload.specialization_ids;
    if (created && Array.isArray(specList) && specList.length > 0) {
      try {
        for (const sId of specList) {
          await executeQuery(`
            INSERT INTO course_specializations (course_id, specialization_id, semester)
            VALUES ($1, $2, $3)
            ON CONFLICT (course_id, specialization_id, semester) DO NOTHING
          `, [created.id, sId, semester]);
        }
      } catch {
        // Safe ignore if table doesn't exist yet
      }
    }

    res.status(201).json(enrichCourseRow(created));
  } catch (err) {
    console.error('[CreateCourse] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function updateCourse(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      department_id,
      specialization_id,
      specialization_ids,
      specialization,
      specialties,
      semester,
      credits,
      coefficient,
      has_lecture,
      has_td,
      has_tp,
      study_level,
      weekly_hours,
      lecture_hours,
      td_hours,
      tp_hours,
      metadata,
      version
    } = req.body;

    const current = await coursesRepository.get(id, { withArchived: true });
    if (!current) {
      return res.status(404).json({ error: 'المقياس غير موجود' });
    }

    let existingMeta = {};
    if (typeof metadata === 'object' && metadata !== null) existingMeta = metadata;
    else if (typeof metadata === 'string') {
      try { existingMeta = JSON.parse(metadata); } catch { existingMeta = {}; }
    } else if (typeof current.metadata === 'string') {
      try { existingMeta = JSON.parse(current.metadata || '{}'); } catch { existingMeta = {}; }
    }

    const effectiveSemester = semester !== undefined ? semester : (current.semester || existingMeta.semester || 'S1');
    const effectiveCredits = credits !== undefined ? Number(credits) : Number(current.credits ?? existingMeta.credits ?? 3);
    const effectiveCoef = coefficient !== undefined ? Number(coefficient) : Number(current.coefficient ?? existingMeta.coefficient ?? 2);
    const effectiveLevel = study_level !== undefined ? study_level : (current.study_level || existingMeta.study_level || 'L1');

    const session_types = [];
    const isLecture = has_lecture !== undefined ? Boolean(has_lecture) : (current.has_lecture ?? true);
    const isTD = has_td !== undefined ? Boolean(has_td) : (current.has_td ?? true);
    const isTP = has_tp !== undefined ? Boolean(has_tp) : (current.has_tp ?? false);
    if (isLecture) session_types.push('lecture');
    if (isTD) session_types.push('td');
    if (isTP) session_types.push('tp');

    const explicitLecture = lecture_hours !== undefined ? Number(lecture_hours) : (existingMeta.lecture_hours !== undefined ? Number(existingMeta.lecture_hours) : null);
    const explicitTD = td_hours !== undefined ? Number(td_hours) : (existingMeta.td_hours !== undefined ? Number(existingMeta.td_hours) : null);
    const explicitTP = tp_hours !== undefined ? Number(tp_hours) : (existingMeta.tp_hours !== undefined ? Number(existingMeta.tp_hours) : null);

    const effectiveLectureHours = explicitLecture !== null ? explicitLecture : (isLecture ? 1.5 : 0);
    const effectiveTDHours = explicitTD !== null ? explicitTD : (isTD ? 1.5 : 0);
    const effectiveTPHours = explicitTP !== null ? explicitTP : (isTP ? 1.5 : 0);

    const calculatedTotal = effectiveLectureHours + effectiveTDHours + effectiveTPHours;
    const effectiveWeekly = weekly_hours !== undefined
      ? Number(weekly_hours)
      : (calculatedTotal > 0 ? calculatedTotal : Number(current.weekly_hours ?? existingMeta.weekly_hours ?? 3.0));

    let parsedSpecialties = undefined;
    if (specialties !== undefined) {
      if (Array.isArray(specialties)) {
        parsedSpecialties = specialties.map(s => String(s).trim()).filter(Boolean);
      } else if (typeof specialties === 'string') {
        parsedSpecialties = specialties.split(/[،,]/).map(s => s.trim()).filter(Boolean);
      }
    } else if (specialization !== undefined && typeof specialization === 'string') {
      parsedSpecialties = specialization.split(/[،,]/).map(s => s.trim()).filter(Boolean);
    }

    const currentSpecialties = Array.isArray(existingMeta.specialties)
      ? existingMeta.specialties
      : (existingMeta.specialization ? existingMeta.specialization.split(/[،,]/).map(s => s.trim()).filter(Boolean) : []);
    const effectiveSpecialties = parsedSpecialties !== undefined ? parsedSpecialties : currentSpecialties;
    const effectiveSpecializationStr = effectiveSpecialties.length > 0
      ? effectiveSpecialties.join('، ')
      : (specialization !== undefined ? specialization : (existingMeta.specialization || ''));

    const metaPayload = {
      ...existingMeta,
      semester: effectiveSemester,
      credits: effectiveCredits,
      coefficient: effectiveCoef,
      study_level: effectiveLevel,
      session_types,
      specialization: effectiveSpecializationStr,
      specialties: effectiveSpecialties,
      specialization_id: specialization_id !== undefined ? (specialization_id ? Number(specialization_id) : null) : (current.specialization_id ?? existingMeta.specialization_id ?? null),
      specialization_ids: Array.isArray(specialization_ids)
        ? specialization_ids.map(Number)
        : (specialization_id ? [Number(specialization_id)] : (existingMeta.specialization_ids || [])),
      lecture_hours: effectiveLectureHours,
      td_hours: effectiveTDHours,
      tp_hours: effectiveTPHours,
      weekly_hours: effectiveWeekly
    };

    const updatePayload = {
      name: name !== undefined ? name.trim() : current.name,
      code: code !== undefined ? (code ? code.trim() : null) : current.code,
      department_id: department_id !== undefined ? (department_id ? Number(department_id) : null) : current.department_id,
      specialization_id: metaPayload.specialization_id,
      semester: effectiveSemester,
      credits: effectiveCredits,
      coefficient: effectiveCoef,
      has_lecture: isLecture,
      has_td: isTD,
      has_tp: isTP,
      study_level: effectiveLevel,
      weekly_hours: effectiveWeekly,
      metadata: JSON.stringify(metaPayload)
    };

    let updated = null;
    try {
      updated = await coursesRepository.update(
        id,
        updatePayload,
        { expectedVersion: version !== undefined ? Number(version) : undefined, userId: req.user?.id }
      );
    } catch (err) {
      if (err.name === 'OptimisticLockError') throw err;
      // Fallback for pre-migration schema
      updated = await coursesRepository.update(
        id,
        {
          name: updatePayload.name,
          code: updatePayload.code,
          department_id: updatePayload.department_id,
          metadata: updatePayload.metadata
        },
        { expectedVersion: version !== undefined ? Number(version) : undefined, userId: req.user?.id }
      );
    }

    // Sync course_specializations
    if (Array.isArray(metaPayload.specialization_ids)) {
      try {
        await executeQuery(`DELETE FROM course_specializations WHERE course_id = $1`, [id]);
        for (const sId of metaPayload.specialization_ids) {
          await executeQuery(`
            INSERT INTO course_specializations (course_id, specialization_id, semester)
            VALUES ($1, $2, $3)
            ON CONFLICT (course_id, specialization_id, semester) DO NOTHING
          `, [id, sId, effectiveSemester]);
        }
      } catch {
        // Safe ignore if table doesn't exist yet
      }
    }

    res.json(enrichCourseRow(updated));
  } catch (err) {
    if (err.name === 'OptimisticLockError') {
      return res.status(409).json({ error: err.message, expectedVersion: err.expectedVersion, actualVersion: err.actualVersion });
    }
    console.error('[UpdateCourse] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function deleteCourse(req, res) {
  try {
    const { id } = req.params;
    const result = await coursesRepository.archive(id, { userId: req.user?.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function restoreCourse(req, res) {
  try {
    const { id } = req.params;
    const result = await coursesRepository.restore(id, { userId: req.user?.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * P16: Export Courses to formatted Excel (.xlsx)
 */
async function exportCoursesExcel(req, res) {
  try {
    const withArchived = req.query.withArchived === 'true';
    const { semester, specialization_id, department_id } = req.query;

    let rows = [];
    try {
      rows = await executeQuery(`
        SELECT c.*,
               d.name as department_name,
               s.name as specialization_name
        FROM courses c
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN specializations s ON c.specialization_id = s.id
        WHERE ($1 = true OR c.deleted_at IS NULL)
        ORDER BY c.name ASC
      `, [withArchived]);
    } catch {
      rows = await coursesRepository.list({ withArchived, orderBy: 'name ASC' });
    }

    let enriched = (rows || []).map(enrichCourseRow);
    if (semester) enriched = enriched.filter((c) => c.semester === semester);
    if (specialization_id) enriched = enriched.filter((c) => c.specialization_id === Number(specialization_id));
    if (department_id) enriched = enriched.filter((c) => c.department_id === Number(department_id));

    const wb = buildCoursesExportWorkbook(enriched);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `courses-curriculum-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[ExportCoursesExcel] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * P16: Download blank Excel template for course import
 */
async function downloadCoursesTemplate(req, res) {
  try {
    const wb = buildCoursesTemplateWorkbook();
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="courses-curriculum-template.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('[DownloadCoursesTemplate] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * P16: Dry-Run preview for Course Excel import
 */
async function previewCoursesImport(req, res) {
  try {
    if (process.env.FEATURE_COURSE_EXCEL_IMPORT_EXPORT === 'false') {
      return res.status(403).json({
        error: {
          code: 'FEATURE_DISABLED',
          message_ar: 'ميزة استيراد وتصدير المقاييس عبر Excel معطلة حالياً عبر إعدادات البيئة.'
        }
      });
    }

    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'لم يتم إرسال أي صفوف صالحة للمعاينة' });
    }

    let existingCourses = [];
    try {
      existingCourses = await executeQuery('SELECT * FROM courses WHERE deleted_at IS NULL');
    } catch {
      existingCourses = await coursesRepository.list({ withArchived: false });
    }

    let departments = [];
    try {
      departments = await executeQuery('SELECT id, name FROM departments');
    } catch {
      departments = [];
    }

    let specializations = [];
    try {
      specializations = await executeQuery('SELECT id, name, department_id FROM specializations');
    } catch {
      specializations = [];
    }

    const dryRun = dryRunCoursesImport(rows, existingCourses, departments, specializations);

    res.json({
      success: true,
      ...dryRun
    });
  } catch (err) {
    console.error('[PreviewCoursesImport] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * P16: Atomic commit for course Excel import via UnitOfWork
 */
async function commitCoursesImport(req, res) {
  try {
    if (process.env.FEATURE_COURSE_EXCEL_IMPORT_EXPORT === 'false') {
      return res.status(403).json({
        error: {
          code: 'FEATURE_DISABLED',
          message_ar: 'ميزة استيراد وتصدير المقاييس عبر Excel معطلة حالياً عبر إعدادات البيئة.'
        }
      });
    }

    const { rows, skipErrors = false } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'قائمة المقاييس فارغة' });
    }

    const importStats = await unitOfWork(async (uow) => {
      const existingRes = await uow.query('SELECT * FROM courses WHERE deleted_at IS NULL');
      const existing = existingRes.rows || existingRes;

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const item of rows) {
        if (!item || !item.name || !item.name.trim()) {
          skippedCount++;
          continue;
        }

        if (item.action === 'unchanged' || item.action === 'error') {
          skippedCount++;
          continue;
        }

        const name = item.name.trim();
        const code = item.code ? item.code.trim() : null;
        const semester = item.semester === 'S2' ? 'S2' : 'S1';
        const studyLevel = item.study_level || 'L1';
        const credits = Number(item.credits) || 3;
        const coefficient = Number(item.coefficient) || 2;
        const hasLecture = item.has_lecture !== false;
        const hasTD = item.has_td !== false;
        const hasTP = Boolean(item.has_tp);
        const deptId = item.department_id ? Number(item.department_id) : null;
        const specId = item.specialization_id ? Number(item.specialization_id) : null;

        const session_types = [];
        if (hasLecture) session_types.push('lecture');
        if (hasTD) session_types.push('td');
        if (hasTP) session_types.push('tp');

        const explicitLecture = item.lecture_hours !== undefined ? Number(item.lecture_hours) : null;
        const explicitTD = item.td_hours !== undefined ? Number(item.td_hours) : null;
        const explicitTP = item.tp_hours !== undefined ? Number(item.tp_hours) : null;

        const effectiveLectureHours = explicitLecture !== null ? explicitLecture : (hasLecture ? 1.5 : 0);
        const effectiveTDHours = explicitTD !== null ? explicitTD : (hasTD ? 1.5 : 0);
        const effectiveTPHours = explicitTP !== null ? explicitTP : (hasTP ? 1.5 : 0);

        const calculatedTotal = effectiveLectureHours + effectiveTDHours + effectiveTPHours;
        const weeklyHours = Number(item.weekly_hours) || (calculatedTotal > 0 ? calculatedTotal : 3.0);

        let parsedSpecialties = [];
        if (Array.isArray(item.specialties)) {
          parsedSpecialties = item.specialties.map(s => String(s).trim()).filter(Boolean);
        } else if (typeof item.specialties === 'string' && item.specialties.trim()) {
          parsedSpecialties = item.specialties.split(/[،,]/).map(s => s.trim()).filter(Boolean);
        } else if (typeof item.specialization === 'string' && item.specialization.trim()) {
          parsedSpecialties = item.specialization.split(/[،,]/).map(s => s.trim()).filter(Boolean);
        }

        const specializationText = parsedSpecialties.length > 0
          ? parsedSpecialties.join('، ')
          : (item.specialization || '');

        const metaPayload = {
          semester,
          credits,
          coefficient,
          study_level: studyLevel,
          session_types,
          specialization: specializationText,
          specialties: parsedSpecialties,
          specialization_id: specId,
          specialization_ids: specId ? [specId] : [],
          lecture_hours: effectiveLectureHours,
          td_hours: effectiveTDHours,
          tp_hours: effectiveTPHours,
          weekly_hours: weeklyHours
        };

        let targetId = item.id ? Number(item.id) : null;
        if (!targetId && code) {
          const match = existing.find((c) => c.code && c.code.trim().toLowerCase() === code.toLowerCase());
          if (match) targetId = match.id;
        }
        if (!targetId) {
          const match = existing.find((c) => c.name && c.name.trim().toLowerCase() === name.toLowerCase());
          if (match) targetId = match.id;
        }

        if (targetId) {
          // Update
          try {
            await uow.query(`
              UPDATE courses
              SET name = $1, code = $2, department_id = $3, specialization_id = $4,
                  semester = $5, credits = $6, coefficient = $7,
                  has_lecture = $8, has_td = $9, has_tp = $10,
                  study_level = $11, weekly_hours = $12, metadata = $13,
                  version = COALESCE(version, 1) + 1
              WHERE id = $14
            `, [name, code, deptId, specId, semester, credits, coefficient, hasLecture, hasTD, hasTP, studyLevel, weeklyHours, JSON.stringify(metaPayload), targetId]);
          } catch {
            // Fallback for pre-migration schema
            await uow.query(`
              UPDATE courses
              SET name = $1, code = $2, department_id = $3, metadata = $4, version = COALESCE(version, 1) + 1
              WHERE id = $5
            `, [name, code, deptId, JSON.stringify(metaPayload), targetId]);
          }
          updatedCount++;
        } else {
          // Insert
          let insertedId = null;
          try {
            const insRes = await uow.query(`
              INSERT INTO courses (name, code, department_id, specialization_id, semester, credits, coefficient, has_lecture, has_td, has_tp, study_level, weekly_hours, metadata, version)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1)
              RETURNING id
            `, [name, code, deptId, specId, semester, credits, coefficient, hasLecture, hasTD, hasTP, studyLevel, weeklyHours, JSON.stringify(metaPayload)]);
            const insertedRow = insRes.rows ? insRes.rows[0] : insRes[0];
            insertedId = insertedRow?.id;
          } catch {
            const insRes = await uow.query(`
              INSERT INTO courses (name, code, department_id, metadata, version)
              VALUES ($1, $2, $3, $4, 1)
              RETURNING id
            `, [name, code, deptId, JSON.stringify(metaPayload)]);
            const insertedRow = insRes.rows ? insRes.rows[0] : insRes[0];
            insertedId = insertedRow?.id;
          }

          if (insertedId && specId) {
            try {
              await uow.query(`
                INSERT INTO course_specializations (course_id, specialization_id, semester)
                VALUES ($1, $2, $3)
                ON CONFLICT (course_id, specialization_id, semester) DO NOTHING
              `, [insertedId, specId, semester]);
            } catch {
              // safe ignore
            }
          }
          createdCount++;
        }
      }

      return { createdCount, updatedCount, skippedCount };
    });

    res.json({
      success: true,
      message_ar: `اكتمل استيراد المقاييس بنجاح: تم إنشاء ${importStats.createdCount} مقياس جديد، وتحديث ${importStats.updatedCount} مقياس، وتخطي ${importStats.skippedCount} صف.`,
      stats: importStats
    });
  } catch (err) {
    console.error('[CommitCoursesImport] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * P16: Pedagogical Curriculum Guide Summary
 */
async function getCurriculumGuide(req, res) {
  try {
    let courses = [];
    try {
      courses = await executeQuery(`
        SELECT c.*,
               d.name as department_name,
               s.name as specialization_name
        FROM courses c
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN specializations s ON c.specialization_id = s.id
        WHERE c.deleted_at IS NULL
        ORDER BY c.study_level ASC, c.semester ASC, c.name ASC
      `);
    } catch {
      courses = await coursesRepository.list({ withArchived: false, orderBy: 'name ASC' });
    }

    const enriched = (courses || []).map(enrichCourseRow);

    const s1Courses = enriched.filter((c) => c.semester === 'S1');
    const s2Courses = enriched.filter((c) => c.semester === 'S2');

    const totalCredits = enriched.reduce((sum, c) => sum + (c.credits || 0), 0);
    const totalCoef = enriched.reduce((sum, c) => sum + (c.coefficient || 0), 0);

    res.json({
      totalCourses: enriched.length,
      s1Count: s1Courses.length,
      s2Count: s2Courses.length,
      totalCredits,
      totalCoef,
      courses: enriched
    });
  } catch (err) {
    console.error('[GetCurriculumGuide] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  restoreCourse,
  exportCoursesExcel,
  downloadCoursesTemplate,
  previewCoursesImport,
  commitCoursesImport,
  getCurriculumGuide
};
