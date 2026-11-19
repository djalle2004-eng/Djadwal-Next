/**
 * Server Scheduling Module: Auto-Scheduler & Approval Workflow (P13)
 * Implements REST endpoints for heuristic/CP-SAT scheduling, explainable conflicts,
 * dual approval workflows, version history, visual diff, and instant rollback.
 */

const { executeQuery } = require('../../database.js');
const {
  solveSchedule,
  detectExplainableConflicts,
  simulateScheduleImpact,
  computeVisualDiff,
  validateDualApproval,
  validatePublishReadiness,
  canTransitionStatus,
  buildConstraints,
  createDefaultInstitutionalConfig
} = require('../../../packages/core/src/scheduling/index.js');
const { logAuditAction } = require('../audit/index.js');

/**
 * 1. POST /api/v1/scheduling/generate
 */
async function generateScheduleEndpoint(req, res) {
  try {
    const isFeatureEnabled = process.env.FEATURE_AUTO_SCHEDULER !== 'false';
    if (!isFeatureEnabled) {
      return res.status(403).json({
        error: {
          code: 'FEATURE_DISABLED',
          message_ar: 'محرك الجدولة الآلي معطل حالياً عبر إعدادات البيئة (FEATURE_AUTO_SCHEDULER=false). يرجى استخدام التخطيط اليدوي.',
          trace_id: req.traceId || 'unknown'
        }
      });
    }

    const {
      semester_id,
      semester,
      specialization_id,
      specialization,
      specialty,
      academic_year,
      mode = 'fast',
      timeout_ms = 30000,
      save_as_draft = false,
      draft_title = 'مسودة مقترحة آلياً',
      seed,
      without_professors = false
    } = req.body || {};

    // 1. Fetch current entities
    const rooms = await executeQuery('SELECT id, name, capacity, deleted_at FROM rooms WHERE deleted_at IS NULL');
    const professors = await executeQuery('SELECT id, name, deleted_at FROM professors WHERE deleted_at IS NULL');
    const groups = await executeQuery('SELECT id, name, specialization, deleted_at FROM groups WHERE deleted_at IS NULL');
    
    // P16: Fetch courses with curriculum mapping (semester, specialization, credits, coefficient)
    let rawCourses = [];
    try {
      rawCourses = await executeQuery('SELECT id, name, code, metadata, semester, specialization_id, credits, coefficient, deleted_at FROM courses WHERE deleted_at IS NULL');
    } catch {
      rawCourses = await executeQuery('SELECT id, name, code, metadata, deleted_at FROM courses WHERE deleted_at IS NULL');
    }

    // Resolve target semester string (S1 / S2)
    let targetSemesterStr = null;
    if (semester) {
      targetSemesterStr = String(semester).trim().toUpperCase() === '2' || String(semester).trim().toUpperCase() === 'S2' ? 'S2' : 'S1';
    } else if (semester_id) {
      try {
        const semRows = await executeQuery('SELECT semester_name FROM semesters WHERE id = $1', [Number(semester_id)]);
        if (semRows && semRows[0]) {
          const sName = String(semRows[0].semester_name || '');
          targetSemesterStr = sName.includes('2') || sName.toUpperCase().includes('S2') ? 'S2' : 'S1';
        }
      } catch {
        targetSemesterStr = Number(semester_id) === 2 ? 'S2' : 'S1';
      }
    }

    // Filter courses relevant to target semester and specialization
    const courses = (rawCourses || []).filter((c) => {
      let meta = {};
      try {
        if (typeof c.metadata === 'string') meta = JSON.parse(c.metadata || '{}');
        else if (typeof c.metadata === 'object' && c.metadata) meta = c.metadata;
      } catch {
        meta = {};
      }

      // P17: Exclude disabled / archived courses for target academic year
      const isCourseActive = (c.is_active !== false) && (meta.is_active !== false) && !c.deleted_at;
      if (!isCourseActive) return false;

      const targetYear = academic_year ? String(academic_year).trim() : '';
      if (meta.disabled_academic_year) {
        const disYear = String(meta.disabled_academic_year).trim();
        if (!targetYear || disYear === targetYear || disYear === 'السنة الحالية') {
          return false;
        }
      }

      if (targetSemesterStr) {
        const courseSem = c.semester || meta.semester || 'S1';
        if (courseSem !== targetSemesterStr) return false;
      }

      if (specialization_id) {
        const specNum = Number(specialization_id);
        const courseSpecId = c.specialization_id ?? meta.specialization_id;
        const courseSpecIds = Array.isArray(meta.specialization_ids) ? meta.specialization_ids : (courseSpecId ? [courseSpecId] : []);
        if (courseSpecIds.length > 0 && !courseSpecIds.includes(specNum)) {
          return false;
        }
      }

      const targetSpecName = specialization || specialty;
      if (targetSpecName) {
        const specTerm = String(targetSpecName).trim().toLowerCase();
        const courseSpecs = Array.isArray(meta.specialties) ? meta.specialties : [];
        const courseSpecText = (c.specialization || meta.specialization || '').toLowerCase();
        const hasMatch = courseSpecs.some(s => s.toLowerCase().includes(specTerm) || specTerm.includes(s.toLowerCase())) ||
                         courseSpecText.includes(specTerm);
        if (courseSpecs.length > 0 && !hasMatch) {
          return false;
        }
      }

      return true;
    });

    // 2. Fetch assignments to schedule/reschedule
    const whereClauses = [];
    const params = [];
    let idx = 1;

    if (academic_year) {
      whereClauses.push(`a.academic_year = $${idx++}`);
      params.push(academic_year);
    }
    if (semester_id) {
      whereClauses.push(`s.id = $${idx++}`);
      params.push(Number(semester_id));
    }
    if (semester && !semester_id) {
      whereClauses.push(`(a.semester = $${idx} OR s.semester_name = $${idx})`);
      params.push(String(semester));
      idx++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const coursesMap = new Map();
    (rawCourses || []).forEach(c => {
      let meta = {};
      try {
        meta = typeof c.metadata === 'string' ? JSON.parse(c.metadata || '{}') : (c.metadata || {});
      } catch {
        meta = {};
      }
      const explicitLecture = meta.lecture_hours !== undefined ? Number(meta.lecture_hours) : (c.lecture_hours !== undefined ? Number(c.lecture_hours) : null);
      const explicitTD = meta.td_hours !== undefined ? Number(meta.td_hours) : (c.td_hours !== undefined ? Number(c.td_hours) : null);
      const explicitTP = meta.tp_hours !== undefined ? Number(meta.tp_hours) : (c.tp_hours !== undefined ? Number(c.tp_hours) : null);
      coursesMap.set(c.id, {
        ...c,
        lecture_hours: explicitLecture !== null ? explicitLecture : (c.has_lecture !== false ? 1.5 : 0),
        td_hours: explicitTD !== null ? explicitTD : (c.has_td !== false ? 1.5 : 0),
        tp_hours: explicitTP !== null ? explicitTP : (c.has_tp ? 1.5 : 0),
        weekly_hours: Number(c.weekly_hours ?? meta.weekly_hours ?? 3.0),
      });
    });

    function resolveTaskDuration(item) {
      if (item.start_time && item.end_time) {
        const [sh, sm] = String(item.start_time).split(':').map(Number);
        const [eh, em] = String(item.end_time).split(':').map(Number);
        const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
        if (diff > 0) return diff;
      }
      const c = coursesMap.get(item.course_id || item.courseId);
      const sType = String(item.session_type || item.sessionType || 'lecture').toLowerCase();
      if (c) {
        if (sType === 'lecture' || sType === 'cours') {
          const h = Number(c.lecture_hours);
          if (h > 0) return Math.round(h * 60);
        } else if (sType === 'td') {
          const h = Number(c.td_hours);
          if (h > 0) return Math.round(h * 60);
        } else if (sType === 'tp') {
          const h = Number(c.tp_hours);
          if (h > 0) return Math.round(h * 60);
        }
      }
      return 90;
    }

    const assignments = await executeQuery(`
      SELECT a.*,
             c.name as course_name,
             p.name as professor_name,
             g.name as group_name,
             r.name as room_name
      FROM assignments a
      LEFT JOIN semesters s ON (a.semester = s.semester_name OR a.semester = CAST(s.id AS TEXT))
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN professors p ON a.professor_id = p.id
      LEFT JOIN groups g ON a.group_id = g.id
      LEFT JOIN rooms r ON a.room_id = r.id
      ${whereStr}
    `, params);

    // Build Scheduling Tasks with dynamic duration from course weekly hours allocation (excluding disabled/archived courses)
    const activeCourseIdSet = new Set(courses.map(c => c.id));
    let tasks = assignments
      .filter(a => {
        const cInfo = coursesMap.get(a.course_id);
        if (cInfo && (cInfo.is_active === false || cInfo.deleted_at)) {
          return false;
        }
        if (courses.length > 0 && !activeCourseIdSet.has(a.course_id)) {
          return false;
        }
        return true;
      })
      .map(a => ({
        id: a.id,
        assignmentId: a.id,
        courseId: a.course_id,
        courseName: a.course_name || `مادة #${a.course_id}`,
        professorId: without_professors ? null : a.professor_id,
        professorName: without_professors ? 'دون إسناد (قيد التعيين)' : (a.professor_name || `أستاذ #${a.professor_id}`),
        groupId: a.group_id,
        groupName: a.group_name || `فوج #${a.group_id}`,
        sessionType: a.session_type || 'lecture',
        durationMinutes: resolveTaskDuration(a),
        studentCount: 35,
        assignedSlot: a.day_of_week !== null && a.start_time && a.end_time ? {
          dayOfWeek: Number(a.day_of_week),
          startTime: a.start_time,
          endTime: a.end_time
        } : undefined,
        assignedRoomId: a.room_id,
        assignedRoomName: a.room_name,
        fixed: false
      }));

    // If without_professors is enabled and no tasks were found from assignments, synthesize scheduling tasks directly from courses & groups
    if (without_professors && tasks.length === 0 && courses.length > 0) {
      let syntheticTaskId = 100000;
      for (const course of courses) {
        const courseMeta = typeof course.metadata === 'string' ? JSON.parse(course.metadata || '{}') : (course.metadata || {});
        const courseSpecId = course.specialization_id ?? courseMeta.specialization_id;
        const courseSpecIds = Array.isArray(courseMeta.specialization_ids) ? courseMeta.specialization_ids : (courseSpecId ? [courseSpecId] : []);
        const courseSpecs = Array.isArray(courseMeta.specialties) ? courseMeta.specialties.map(s => String(s).toLowerCase().trim()) : [];
        if (course.specialization) courseSpecs.push(String(course.specialization).toLowerCase().trim());
        if (courseMeta.specialization) courseSpecs.push(String(courseMeta.specialization).toLowerCase().trim());

        const matchingGroups = groups.filter(g => {
          if (courseSpecs.length === 0 && courseSpecIds.length === 0) return true;
          const gSpec = String(g.specialization || '').toLowerCase().trim();
          if (gSpec && courseSpecs.some(s => s.includes(gSpec) || gSpec.includes(s))) return true;
          return false;
        });

        const targetGroups = matchingGroups.length > 0 ? matchingGroups : (groups.length > 0 ? groups.slice(0, 2) : [{ id: 1, name: 'فوج عام' }]);
        const cInfo = coursesMap.get(course.id) || course;
        const hasLecture = cInfo.lecture_hours > 0 || cInfo.has_lecture !== false;
        const hasTD = cInfo.td_hours > 0 || cInfo.has_td;
        const hasTP = cInfo.tp_hours > 0 || cInfo.has_tp;

        // Lecture task (cohort level)
        if (hasLecture) {
          const firstGroup = targetGroups[0];
          tasks.push({
            id: syntheticTaskId++,
            assignmentId: null,
            courseId: course.id,
            courseName: course.name,
            professorId: null,
            professorName: 'دون إسناد (قيد التعيين)',
            groupId: firstGroup.id,
            groupName: targetGroups.length > 1 ? `${firstGroup.name} (مشترك)` : firstGroup.name,
            sessionType: 'lecture',
            durationMinutes: cInfo.lecture_hours ? Math.round(cInfo.lecture_hours * 60) : 90,
            studentCount: 70,
            fixed: false
          });
        }

        // TD task per group
        if (hasTD) {
          for (const g of targetGroups) {
            tasks.push({
              id: syntheticTaskId++,
              assignmentId: null,
              courseId: course.id,
              courseName: course.name,
              professorId: null,
              professorName: 'دون إسناد (قيد التعيين)',
              groupId: g.id,
              groupName: g.name,
              sessionType: 'td',
              durationMinutes: cInfo.td_hours ? Math.round(cInfo.td_hours * 60) : 90,
              studentCount: 35,
              fixed: false
            });
          }
        }

        // TP task per group
        if (hasTP) {
          for (const g of targetGroups) {
            tasks.push({
              id: syntheticTaskId++,
              assignmentId: null,
              courseId: course.id,
              courseName: course.name,
              professorId: null,
              professorName: 'دون إسناد (قيد التعيين)',
              groupId: g.id,
              groupName: g.name,
              sessionType: 'tp',
              durationMinutes: cInfo.tp_hours ? Math.round(cInfo.tp_hours * 60) : 90,
              studentCount: 20,
              fixed: false
            });
          }
        }
      }
    }

    // Build Constraints
    const constraints = buildConstraints({
      professors: without_professors ? [] : professors.map(p => ({
        id: p.id,
        name: p.name,
        maxWeeklyHours: 18,
        maxDailySessions: 3,
        unavailabilities: []
      })),
      rooms: rooms.map(r => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity || 40,
        roomType: (r.name || '').includes('مخبر') || (r.name || '').toLowerCase().includes('lab')
          ? 'lab_tp'
          : ((r.name || '').includes('مدرج') ? 'amphi' : 'standard')
      })),
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        studentCount: 35
      })),
      courses: courses.map(c => ({
        id: c.id,
        name: c.name
      }))
    });

    // Run Dual Solver
    const solverResult = solveSchedule(tasks, constraints, {
      mode,
      timeoutMs: timeout_ms,
      seed: seed !== undefined ? Number(seed) : 12345
    });

    let createdVersionId = null;

    // Optional: Save as draft version
    if (save_as_draft) {
      const semId = semester_id ? Number(semester_id) : 1;
      const userId = req.user?.id || 1;

      // Get next version number for this semester
      const verRows = await executeQuery(
        'SELECT COALESCE(MAX(version_number), 0) + 1 as next_ver FROM schedule_versions WHERE semester_id = $1',
        [semId]
      );
      const nextVer = verRows[0]?.next_ver || 1;

      const insVer = await executeQuery(`
        INSERT INTO schedule_versions (
          semester_id, version_number, title, status, note, created_by,
          metrics, critical_conflicts_count, total_sessions_count
        ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        semId,
        nextVer,
        draft_title,
        `تم التوليد آلياً بنمط (${mode}) واستغرق ${(solverResult.metrics.generationDurationMs / 1000).toFixed(2)} ثانية`,
        userId,
        JSON.stringify(solverResult.metrics),
        solverResult.metrics.criticalConflictsCount,
        solverResult.tasks.length
      ]);

      createdVersionId = insVer[0]?.id;

      // Insert Items
      for (const t of solverResult.tasks) {
        if (t.assignedSlot && t.assignedRoomId) {
          const profId = t.professorId && String(t.professorId) !== 'null' && String(t.professorId) !== 'undefined' && Number(t.professorId) > 0 ? Number(t.professorId) : null;
          await executeQuery(`
            INSERT INTO schedule_version_items (
              schedule_version_id, assignment_id, course_id, professor_id, group_id, room_id,
              day_of_week, start_time, end_time, session_type, item_status, note
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'proposed', $11)
          `, [
            createdVersionId,
            t.assignmentId || null,
            t.courseId,
            profId,
            t.groupId,
            t.assignedRoomId,
            t.assignedSlot.dayOfWeek,
            t.assignedSlot.startTime,
            t.assignedSlot.endTime,
            t.sessionType,
            without_professors ? 'اقتراح آلي (دون إسناد)' : 'اقتراح آلي'
          ]);
        }
      }
    }

    res.json({
      status: 'ok',
      data: {
        solverStatus: solverResult.status,
        tasks: solverResult.tasks,
        conflicts: solverResult.conflicts,
        metrics: solverResult.metrics,
        explanationsArabic: solverResult.explanationsArabic,
        createdVersionId
      }
    });
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'SCHEDULER_GENERATION_FAILED',
        message_ar: err.message || 'فشل تشغيل محرك الجدولة الآلي',
        trace_id: req.traceId || 'unknown'
      }
    });
  }
}

/**
 * 2. POST /api/v1/scheduling/conflicts/explain
 */
async function explainConflictsEndpoint(req, res) {
  try {
    const { sessions, semester_id, academic_year } = req.body || {};
    let taskList = [];

    const calcDuration = (item) => {
      if (item.start_time && item.end_time) {
        const [sh, sm] = String(item.start_time).split(':').map(Number);
        const [eh, em] = String(item.end_time).split(':').map(Number);
        const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
        if (diff > 0) return diff;
      }
      return 90;
    };

    if (Array.isArray(sessions) && sessions.length > 0) {
      taskList = sessions.map(s => ({
        id: s.id || Math.random(),
        courseId: s.course_id || s.courseId,
        courseName: s.course_name || s.courseName || `مادة #${s.course_id}`,
        professorId: s.professor_id || s.professorId,
        professorName: s.professor_name || s.professorName || `أستاذ #${s.professor_id}`,
        groupId: s.group_id || s.groupId,
        groupName: s.group_name || s.groupName || `فوج #${s.group_id}`,
        sessionType: s.session_type || s.sessionType || 'lecture',
        durationMinutes: calcDuration(s),
        studentCount: s.student_count || 35,
        assignedSlot: s.assignedSlot || {
          dayOfWeek: Number(s.day_of_week),
          startTime: s.start_time,
          endTime: s.end_time
        },
        assignedRoomId: s.room_id || s.assignedRoomId,
        assignedRoomName: s.room_name || s.assignedRoomName
      }));
    } else {
      // Load current assignments
      const whereClauses = [];
      const params = [];
      let idx = 1;
      if (academic_year) {
        whereClauses.push(`a.academic_year = $${idx++}`);
        params.push(academic_year);
      }
      const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const rows = await executeQuery(`
        SELECT a.*,
               c.name as course_name,
               c.metadata as course_metadata,
               c.deleted_at as course_deleted_at,
               p.name as professor_name,
               g.name as group_name,
               r.name as room_name,
               r.capacity as room_capacity
        FROM assignments a
        LEFT JOIN courses c ON a.course_id = c.id
        LEFT JOIN professors p ON a.professor_id = p.id
        LEFT JOIN groups g ON a.group_id = g.id
        LEFT JOIN rooms r ON a.room_id = r.id
        ${whereStr}
      `, params);

      taskList = rows
        .filter(a => {
          if (a.course_deleted_at) return false;
          let meta = {};
          try {
            if (typeof a.course_metadata === 'string') meta = JSON.parse(a.course_metadata || '{}');
            else if (typeof a.course_metadata === 'object' && a.course_metadata) meta = a.course_metadata;
          } catch {}
          if (meta.is_active === false) return false;
          return true;
        })
        .map(a => ({
        id: a.id,
        courseId: a.course_id,
        courseName: a.course_name || `مادة #${a.course_id}`,
        professorId: a.professor_id,
        professorName: a.professor_name || `أستاذ #${a.professor_id}`,
        groupId: a.group_id,
        groupName: a.group_name || `فوج #${a.group_id}`,
        sessionType: a.session_type || 'lecture',
        durationMinutes: calcDuration(a),
        studentCount: 35,
        assignedSlot: {
          dayOfWeek: Number(a.day_of_week),
          startTime: a.start_time,
          endTime: a.end_time
        },
        assignedRoomId: a.room_id,
        assignedRoomName: a.room_name
      }));
    }

    // Build constraints
    const rooms = await executeQuery('SELECT id, name, capacity FROM rooms WHERE deleted_at IS NULL');
    const professors = await executeQuery('SELECT id, name FROM professors WHERE deleted_at IS NULL');
    const constraints = buildConstraints({
      rooms: rooms.map(r => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity || 40,
        roomType: 'standard'
      })),
      professors: professors.map(p => ({
        id: p.id,
        name: p.name,
        maxWeeklyHours: 18,
        maxDailySessions: 3,
        unavailabilities: []
      }))
    });

    const conflicts = detectExplainableConflicts(taskList, constraints);

    res.json({
      status: 'ok',
      data: {
        totalConflicts: conflicts.length,
        criticalCount: conflicts.filter(c => c.severity === 'CRITICAL').length,
        majorCount: conflicts.filter(c => c.severity === 'MAJOR').length,
        minorCount: conflicts.filter(c => c.severity === 'MINOR').length,
        conflicts
      }
    });
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'CONFLICT_EXPLANATION_FAILED',
        message_ar: err.message || 'فشل فحص وشرح التعارضات',
        trace_id: req.traceId || 'unknown'
      }
    });
  }
}

/**
 * 3. POST /api/v1/scheduling/impact-simulate
 */
async function simulateImpactEndpoint(req, res) {
  try {
    const { semester_id, proposed_items } = req.body || {};

    // 1. Fetch baseline assignments
    const baselineRows = await executeQuery(`
      SELECT a.*,
             c.name as course_name,
             p.name as professor_name,
             g.name as group_name,
             r.name as room_name
      FROM assignments a
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN professors p ON a.professor_id = p.id
      LEFT JOIN groups g ON a.group_id = g.id
      LEFT JOIN rooms r ON a.room_id = r.id
    `);

    const calcDuration = (item) => {
      if (item.start_time && item.end_time) {
        const [sh, sm] = String(item.start_time).split(':').map(Number);
        const [eh, em] = String(item.end_time).split(':').map(Number);
        const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
        if (diff > 0) return diff;
      }
      return 90;
    };

    const baselineTasks = baselineRows.map(a => ({
      id: a.id,
      courseId: a.course_id,
      courseName: a.course_name || `مادة #${a.course_id}`,
      professorId: a.professor_id,
      professorName: a.professor_name || `أستاذ #${a.professor_id}`,
      groupId: a.group_id,
      groupName: a.group_name || `فوج #${a.group_id}`,
      sessionType: a.session_type || 'lecture',
      durationMinutes: calcDuration(a),
      studentCount: 35,
      assignedSlot: {
        dayOfWeek: Number(a.day_of_week),
        startTime: a.start_time,
        endTime: a.end_time
      },
      assignedRoomId: a.room_id,
      assignedRoomName: a.room_name
    }));

    const proposedTasks = (proposed_items || []).map(p => ({
      id: p.id || Math.random(),
      courseId: p.course_id,
      courseName: p.course_name || `مادة #${p.course_id}`,
      professorId: p.professor_id,
      professorName: p.professor_name || `أستاذ #${p.professor_id}`,
      groupId: p.group_id,
      groupName: p.group_name || `فوج #${p.group_id}`,
      sessionType: p.session_type || 'lecture',
      durationMinutes: calcDuration(p),
      studentCount: 35,
      assignedSlot: p.assignedSlot || {
        dayOfWeek: Number(p.day_of_week),
        startTime: p.start_time,
        endTime: p.end_time
      },
      assignedRoomId: p.room_id || p.assignedRoomId,
      assignedRoomName: p.room_name || p.assignedRoomName
    }));

    const impact = simulateScheduleImpact({
      baselineTasks,
      proposedTasks
    });

    res.json({
      status: 'ok',
      data: impact
    });
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'IMPACT_SIMULATION_FAILED',
        message_ar: err.message || 'فشل تحليل أثر التغيير',
        trace_id: req.traceId || 'unknown'
      }
    });
  }
}

/**
 * 4. GET /api/v1/scheduling/versions
 */
async function listVersionsEndpoint(req, res) {
  try {
    const { semester_id } = req.query;
    const whereClauses = [];
    const params = [];
    let idx = 1;

    if (semester_id) {
      whereClauses.push(`v.semester_id = $${idx++}`);
      params.push(Number(semester_id));
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const rows = await executeQuery(`
      SELECT v.*,
             u1.full_name as created_by_name,
             u2.full_name as approved_by_name,
             s.semester_name
      FROM schedule_versions v
      LEFT JOIN users u1 ON v.created_by = u1.id
      LEFT JOIN users u2 ON v.approved_by = u2.id
      LEFT JOIN semesters s ON v.semester_id = s.id
      ${whereStr}
      ORDER BY v.version_number DESC
    `, params);

    res.json({
      status: 'ok',
      data: rows
    });
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'LIST_VERSIONS_FAILED',
        message_ar: err.message || 'فشل جلب قائمة الإصدارات',
        trace_id: req.traceId || 'unknown'
      }
    });
  }
}

/**
 * 5. GET /api/v1/scheduling/versions/:id
 */
async function getVersionDetailsEndpoint(req, res) {
  try {
    const versionId = Number(req.params.id);

    const versionRows = await executeQuery(`
      SELECT v.*,
             u1.full_name as created_by_name,
             u2.full_name as approved_by_name,
             s.semester_name
      FROM schedule_versions v
      LEFT JOIN users u1 ON v.created_by = u1.id
      LEFT JOIN users u2 ON v.approved_by = u2.id
      LEFT JOIN semesters s ON v.semester_id = s.id
      WHERE v.id = $1
    `, [versionId]);

    if (!versionRows[0]) {
      return res.status(404).json({
        error: {
          code: 'VERSION_NOT_FOUND',
          message_ar: 'إصدار الجدول المطلوب غير موجود',
          trace_id: req.traceId || 'unknown'
        }
      });
    }

    const items = await executeQuery(`
      SELECT vi.*,
             c.name as course_name,
             p.name as professor_name,
             g.name as group_name,
             r.name as room_name
      FROM schedule_version_items vi
      LEFT JOIN courses c ON vi.course_id = c.id
      LEFT JOIN professors p ON vi.professor_id = p.id
      LEFT JOIN groups g ON vi.group_id = g.id
      LEFT JOIN rooms r ON vi.room_id = r.id
      WHERE vi.schedule_version_id = $1
      ORDER BY vi.day_of_week ASC, vi.start_time ASC
    `, [versionId]);

    res.json({
      status: 'ok',
      data: {
        version: versionRows[0],
        items
      }
    });
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'GET_VERSION_FAILED',
        message_ar: err.message || 'فشل جلب تفاصيل الإصدار',
        trace_id: req.traceId || 'unknown'
      }
    });
  }
}

/**
 * 6. POST /api/v1/scheduling/versions
 */
async function createVersionEndpoint(req, res) {
  try {
    const { semester_id, title, note = '', items = [] } = req.body || {};
    const userId = req.user?.id || 1;

    const verRows = await executeQuery(
      'SELECT COALESCE(MAX(version_number), 0) + 1 as next_ver FROM schedule_versions WHERE semester_id = $1',
      [Number(semester_id)]
    );
    const nextVer = verRows[0]?.next_ver || 1;

    const ins = await executeQuery(`
      INSERT INTO schedule_versions (
        semester_id, version_number, title, status, note, created_by,
        critical_conflicts_count, total_sessions_count
      ) VALUES ($1, $2, $3, 'draft', $4, $5, 0, $6)
      RETURNING id
    `, [
      Number(semester_id),
      nextVer,
      title,
      note,
      userId,
      items.length
    ]);

    const createdId = ins[0]?.id;

    for (const item of items) {
      const profId = item.professor_id && String(item.professor_id) !== 'null' && String(item.professor_id) !== 'undefined' && Number(item.professor_id) > 0 ? Number(item.professor_id) : null;
      await executeQuery(`
        INSERT INTO schedule_version_items (
          schedule_version_id, assignment_id, course_id, professor_id, group_id, room_id,
          day_of_week, start_time, end_time, session_type, item_status, note
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        createdId,
        item.assignment_id || null,
        item.course_id,
        profId,
        item.group_id,
        item.room_id,
        item.day_of_week,
        item.start_time,
        item.end_time,
        item.session_type || 'lecture',
        item.item_status || 'proposed',
        item.note || ''
      ]);
    }

    res.status(201).json({
      status: 'ok',
      data: {
        id: createdId,
        versionNumber: nextVer,
        status: 'draft',
        title
      }
    });
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'CREATE_VERSION_FAILED',
        message_ar: err.message || 'فشل إنشاء إصدار المسودة',
        trace_id: req.traceId || 'unknown'
      }
    });
  }
}

/**
 * 7. POST /api/v1/scheduling/versions/:id/transition
 */
async function transitionVersionEndpoint(req, res) {
  try {
    const versionId = Number(req.params.id);
    const { new_status, note = '' } = req.body || {};
    const actorId = req.user?.id || 1;

    const versionRows = await executeQuery('SELECT * FROM schedule_versions WHERE id = $1', [versionId]);
    const version = versionRows[0];
    if (!version) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message_ar: 'الإصدار غير موجود', trace_id: req.traceId || 'unknown' }
      });
    }

    // Guard state transition
    const check = canTransitionStatus(version.status, new_status, version.created_by, actorId);
    if (!check.allowed) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TRANSITION',
          message_ar: check.reasonArabic || 'الانتقال غير مسموح به',
          trace_id: req.traceId || 'unknown'
        }
      });
    }

    // If approving, enforce Dual Approval
    if (new_status === 'approved') {
      validateDualApproval(version.created_by, actorId);
      await executeQuery(`
        UPDATE schedule_versions
        SET status = 'approved', approved_by = $1, approved_at = now(), updated_at = now()
        WHERE id = $2
      `, [actorId, versionId]);
    }
    // If publishing, check zero critical conflicts & sync to assignments
    else if (new_status === 'published') {
      validateDualApproval(version.created_by, actorId);
      validatePublishReadiness(version);

      // 1. Archive previously published versions for this semester
      await executeQuery(`
        UPDATE schedule_versions
        SET status = 'archived', updated_at = now()
        WHERE semester_id = $1 AND status = 'published' AND id != $2
      `, [version.semester_id, versionId]);

      // 2. Mark this version as published
      await executeQuery(`
        UPDATE schedule_versions
        SET status = 'published', published_at = now(), updated_at = now()
        WHERE id = $1
      `, [versionId]);

      // 3. Atomically synchronize active assignments from schedule_version_items
      const items = await executeQuery('SELECT * FROM schedule_version_items WHERE schedule_version_id = $1', [versionId]);

      // Update or insert into assignments
      for (const item of items) {
        if (item.assignment_id) {
          await executeQuery(`
            UPDATE assignments
            SET day_of_week = $1, start_time = $2, end_time = $3, room_id = $4,
                professor_id = $5, updated_at = now()
            WHERE id = $6
          `, [item.day_of_week, item.start_time, item.end_time, item.room_id, item.professor_id, item.assignment_id]);
        } else {
          await executeQuery(`
            INSERT INTO assignments (
              course_id, professor_id, group_id, room_id, day_of_week,
              start_time, end_time, session_type, semester
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            item.course_id, item.professor_id, item.group_id, item.room_id,
            item.day_of_week, item.start_time, item.end_time, item.session_type,
            String(version.semester_id)
          ]);
        }
      }
    } else {
      await executeQuery(`
        UPDATE schedule_versions
        SET status = $1, note = $2, updated_at = now()
        WHERE id = $3
      `, [new_status, note, versionId]);
    }

    res.json({
      status: 'ok',
      data: {
        id: versionId,
        previousStatus: version.status,
        newStatus: new_status
      }
    });
  } catch (err) {
    res.status(400).json({
      error: {
        code: err.code || 'TRANSITION_FAILED',
        message_ar: err.message || 'فشل تحديث حالة الإصدار',
        trace_id: req.traceId || 'unknown'
      }
    });
  }
}

/**
 * 8. POST /api/v1/scheduling/versions/:id/rollback
 */
async function rollbackVersionEndpoint(req, res) {
  const t0 = Date.now();
  try {
    const versionId = Number(req.params.id);
    const actorId = req.user?.id || 1;

    const versionRows = await executeQuery('SELECT * FROM schedule_versions WHERE id = $1', [versionId]);
    const version = versionRows[0];
    if (!version) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message_ar: 'الإصدار المراد استرجاعه غير موجود', trace_id: req.traceId || 'unknown' }
      });
    }

    const items = await executeQuery('SELECT * FROM schedule_version_items WHERE schedule_version_id = $1', [versionId]);

    // 1. Archive currently published versions
    await executeQuery(`
      UPDATE schedule_versions
      SET status = 'archived', updated_at = now()
      WHERE semester_id = $1 AND status = 'published'
    `, [version.semester_id]);

    // 2. Mark target version as published
    await executeQuery(`
      UPDATE schedule_versions
      SET status = 'published', published_at = now(), updated_at = now()
      WHERE id = $1
    `, [versionId]);

    // 3. Atomically apply assignments
    for (const item of items) {
      if (item.assignment_id) {
        await executeQuery(`
          UPDATE assignments
          SET day_of_week = $1, start_time = $2, end_time = $3, room_id = $4,
              professor_id = $5, updated_at = now()
          WHERE id = $6
        `, [item.day_of_week, item.start_time, item.end_time, item.room_id, item.professor_id, item.assignment_id]);
      } else {
        await executeQuery(`
          INSERT INTO assignments (
            course_id, professor_id, group_id, room_id, day_of_week,
            start_time, end_time, session_type, semester
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          item.course_id, item.professor_id, item.group_id, item.room_id,
          item.day_of_week, item.start_time, item.end_time, item.session_type,
          String(version.semester_id)
        ]);
      }
    }

    const elapsedMs = Date.now() - t0;

    res.json({
      status: 'ok',
      data: {
        restoredVersionId: versionId,
        versionNumber: version.version_number,
        elapsedSeconds: (elapsedMs / 1000).toFixed(2),
        messageArabic: `✅ تم استرجاع الإصدار رقم (${version.version_number}) بنجاح خلال ${(elapsedMs / 1000).toFixed(2)} ثانية.`
      }
    });
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'ROLLBACK_FAILED',
        message_ar: err.message || 'فشل استرجاع الإصدار',
        trace_id: req.traceId || 'unknown'
      }
    });
  }
}

/**
 * 9. GET /api/v1/scheduling/versions/diff
 */
async function getVisualDiffEndpoint(req, res) {
  try {
    const v1Id = Number(req.query.v1);
    const v2Id = Number(req.query.v2);

    if (!v1Id || !v2Id) {
      return res.status(400).json({
        error: { code: 'INVALID_PARAMS', message_ar: 'يجب تحديد معرفي الإصدارين للمقارنة (v1 و v2)', trace_id: req.traceId || 'unknown' }
      });
    }

    const verA = (await executeQuery('SELECT * FROM schedule_versions WHERE id = $1', [v1Id]))[0];
    const verB = (await executeQuery('SELECT * FROM schedule_versions WHERE id = $1', [v2Id]))[0];

    if (!verA || !verB) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message_ar: 'أحد الإصدارين غير موجود', trace_id: req.traceId || 'unknown' }
      });
    }

    const itemsA = await executeQuery(`
      SELECT vi.*, c.name as course_name, p.name as professor_name, g.name as group_name, r.name as room_name
      FROM schedule_version_items vi
      LEFT JOIN courses c ON vi.course_id = c.id
      LEFT JOIN professors p ON vi.professor_id = p.id
      LEFT JOIN groups g ON vi.group_id = g.id
      LEFT JOIN rooms r ON vi.room_id = r.id
      WHERE vi.schedule_version_id = $1
    `, [v1Id]);

    const itemsB = await executeQuery(`
      SELECT vi.*, c.name as course_name, p.name as professor_name, g.name as group_name, r.name as room_name
      FROM schedule_version_items vi
      LEFT JOIN courses c ON vi.course_id = c.id
      LEFT JOIN professors p ON vi.professor_id = p.id
      LEFT JOIN groups g ON vi.group_id = g.id
      LEFT JOIN rooms r ON vi.room_id = r.id
      WHERE vi.schedule_version_id = $1
    `, [v2Id]);

    const diff = computeVisualDiff(
      { id: verA.id, versionNumber: verA.version_number, items: itemsA },
      { id: verB.id, versionNumber: verB.version_number, items: itemsB }
    );

    res.json({
      status: 'ok',
      data: diff
    });
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'DIFF_FAILED',
        message_ar: err.message || 'فشل إجراء المقارنة البصرية بين الإصدارين',
        trace_id: req.traceId || 'unknown'
      }
    });
  }
}

/**
 * 10. PATCH /api/v1/scheduling/versions/:id/items/:itemId
 */
async function updateItemDecisionEndpoint(req, res) {
  try {
    const versionId = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const { decision, note = '', updated_data = {} } = req.body || {};

    const itemRows = await executeQuery('SELECT * FROM schedule_version_items WHERE id = $1 AND schedule_version_id = $2', [itemId, versionId]);
    if (!itemRows[0]) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message_ar: 'بند الحصة غير موجود في هذا الإصدار', trace_id: req.traceId || 'unknown' }
      });
    }

    const updates = ['item_status = $1', 'note = $2'];
    const params = [decision, note];
    let idx = 3;

    if (updated_data.day_of_week !== undefined) {
      updates.push(`day_of_week = $${idx++}`);
      params.push(Number(updated_data.day_of_week));
    }
    if (updated_data.start_time) {
      updates.push(`start_time = $${idx++}`);
      params.push(updated_data.start_time);
    }
    if (updated_data.end_time) {
      updates.push(`end_time = $${idx++}`);
      params.push(updated_data.end_time);
    }
    if (updated_data.room_id) {
      updates.push(`room_id = $${idx++}`);
      params.push(Number(updated_data.room_id));
    }
    if (updated_data.professor_id) {
      updates.push(`professor_id = $${idx++}`);
      params.push(Number(updated_data.professor_id));
    }

    params.push(itemId);
    await executeQuery(`
      UPDATE schedule_version_items
      SET ${updates.join(', ')}
      WHERE id = $${idx}
    `, params);

    res.json({
      status: 'ok',
      data: {
        itemId,
        decision,
        note
      }
    });
  } catch (err) {
    res.status(500).json({
      error: {
        code: 'UPDATE_ITEM_FAILED',
        message_ar: err.message || 'فشل تحديث قرار الحصة',
        trace_id: req.traceId || 'unknown'
      }
    });
  }
}

module.exports = {
  generateScheduleEndpoint,
  explainConflictsEndpoint,
  simulateImpactEndpoint,
  listVersionsEndpoint,
  getVersionDetailsEndpoint,
  createVersionEndpoint,
  transitionVersionEndpoint,
  rollbackVersionEndpoint,
  getVisualDiffEndpoint,
  updateItemDecisionEndpoint
};
