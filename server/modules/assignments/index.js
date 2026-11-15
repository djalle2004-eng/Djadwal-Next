const { assignmentsRepository } = require('../../../packages/core/src/repositories/index.js');
const { unitOfWork } = require('../../../packages/core/src/unitOfWork.js');
const { executeQuery } = require('../../database.js');

async function listAssignments(req, res) {
  try {
    const { academicYear, semester, specialization, professorId, groupId, roomId } = req.query;
    const whereClauses = [];
    const params = [];
    let idx = 1;

    if (academicYear) {
      whereClauses.push(`a.academic_year = $${idx++}`);
      params.push(academicYear);
    }
    if (semester) {
      // تطبيع الأسماء للتعامل مع كشيدة التطويل وتطابق "السداسي" و"الفصل"
      whereClauses.push(`(
        REPLACE(a.semester, 'ـ', '') = REPLACE($${idx++}, 'ـ', '')
        OR REPLACE(REPLACE(a.semester, 'ـ', ''), 'السداسي', 'الفصل') = REPLACE(REPLACE($${idx++}, 'ـ', ''), 'السداسي', 'الفصل')
      )`);
      params.push(semester);
      params.push(semester);
    }
    if (specialization) {
      whereClauses.push(`g.specialization = $${idx++}`);
      params.push(specialization);
    }
    if (professorId) {
      whereClauses.push(`a.professor_id = $${idx++}`);
      params.push(Number(professorId));
    }
    if (groupId) {
      whereClauses.push(`a.group_id = $${idx++}`);
      params.push(Number(groupId));
    }
    if (roomId) {
      whereClauses.push(`a.room_id = $${idx++}`);
      params.push(Number(roomId));
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    let sql = `
      SELECT a.*,
             g.name as group_name,
             c.name as course_name,
             p.name as professor_name,
             r.name as room_name
      FROM assignments a
      LEFT JOIN groups g ON a.group_id = g.id
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN professors p ON a.professor_id = p.id
      LEFT JOIN rooms r ON a.room_id = r.id
      ${whereStr}
      ORDER BY a.day_of_week ASC, a.start_time ASC
    `;

    if (req.query.limit) {
      const limitVal = Math.min(Number(req.query.limit) || 100, 5000);
      sql += ` LIMIT $${idx++}`;
      params.push(limitVal);
    }

    const rows = await executeQuery(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getAssignment(req, res) {
  try {
    const { id } = req.params;
    const row = await assignmentsRepository.get(id);
    if (!row) {
      return res.status(404).json({ error: 'الحصة غير موجودة' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createAssignment(req, res) {
  try {
    const { group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization, session_type, ignore_conflicts } = req.body;

    if (!ignore_conflicts) {
      const check = await findAssignmentConflicts({
        day_of_week,
        start_time,
        end_time,
        room_id,
        professor_id,
        group_id,
        academic_year,
        semester
      });
      if (check.has_conflicts) {
        return res.status(409).json({
          error: 'SCHEDULE_CONFLICT',
          message: 'يوجد تعارض في التوقيت أو القاعة أو الأستاذ أو الفوج',
          conflicts: check.conflicts
        });
      }
    }

    const created = await assignmentsRepository.create(
      { group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization, session_type },
      { userId: req.user?.id }
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateAssignment(req, res) {
  try {
    const { id } = req.params;
    const { group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization, session_type, version, ignore_conflicts } = req.body;

    if (!ignore_conflicts) {
      const check = await findAssignmentConflicts({
        day_of_week,
        start_time,
        end_time,
        room_id,
        professor_id,
        group_id,
        academic_year,
        semester,
        exclude_id: id
      });
      if (check.has_conflicts) {
        return res.status(409).json({
          error: 'SCHEDULE_CONFLICT',
          message: 'يوجد تعارض في التوقيت أو القاعة أو الأستاذ أو الفوج',
          conflicts: check.conflicts
        });
      }
    }

    const updated = await assignmentsRepository.update(
      id,
      { group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization, session_type },
      { expectedVersion: version !== undefined ? Number(version) : undefined, userId: req.user?.id }
    );
    res.json(updated);
  } catch (err) {
    if (err.name === 'OptimisticLockError') {
      return res.status(409).json({ error: err.message, expectedVersion: err.expectedVersion, actualVersion: err.actualVersion });
    }
    res.status(500).json({ error: err.message });
  }
}

async function deleteAssignment(req, res) {
  try {
    const { id } = req.params;
    await executeQuery('DELETE FROM assignments WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function swapAssignments(req, res) {
  try {
    const { idA, idB } = req.body;
    if (!idA || !idB) {
      return res.status(400).json({ error: 'يجب تحديد معرف الحصتين المراد تبديلهما (idA, idB)' });
    }

    const result = await unitOfWork(async (uow) => {
      return await assignmentsRepository.swap(Number(idA), Number(idB), {
        uow,
        userId: req.user?.id
      });
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function moveAssignment(req, res) {
  try {
    const { id } = req.params;
    const { day_of_week, start_time, end_time, room_id, version } = req.body;

    const result = await unitOfWork(async (uow) => {
      return await assignmentsRepository.move(
        Number(id),
        { day_of_week, start_time, end_time, room_id },
        {
          uow,
          userId: req.user?.id,
          expectedVersion: version !== undefined ? Number(version) : undefined
        }
      );
    });

    res.json(result);
  } catch (err) {
    if (err.name === 'OptimisticLockError') {
      return res.status(409).json({ error: err.message, expectedVersion: err.expectedVersion, actualVersion: err.actualVersion });
    }
    res.status(500).json({ error: err.message });
  }
}

function timeToMinutes(t) {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function isTimeOverlap(s1, e1, s2, e2) {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(e1) > timeToMinutes(s2);
}

async function findAssignmentConflicts({
  day_of_week,
  start_time,
  end_time,
  room_id,
  professor_id,
  group_id,
  academic_year,
  semester,
  exclude_id
}) {
  const conflicts = [];
  const day = Number(day_of_week);

  // 1. Professor conflict (ignore 'غير معين' and ignore if same physical room = merged session)
  if (professor_id) {
    const profs = await executeQuery('SELECT id, name FROM professors WHERE id = $1', [Number(professor_id)]);
    const profName = profs[0]?.name || '';
    if (profName && profName !== 'غير معين' && !profName.includes('غير معين')) {
      const profRows = await executeQuery(
        `SELECT a.id, a.day_of_week, a.start_time, a.end_time, a.room_id,
                p.name as professor_name, c.name as course_name, g.name as group_name, r.name as room_name
         FROM assignments a
         LEFT JOIN professors p ON a.professor_id = p.id
         LEFT JOIN courses c ON a.course_id = c.id
         LEFT JOIN groups g ON a.group_id = g.id
         LEFT JOIN rooms r ON a.room_id = r.id
         WHERE a.professor_id = $1 AND a.day_of_week = $2
           AND ($3 = '' OR a.academic_year = $3)
           AND NOT (a.end_time <= $4 OR a.start_time >= $5)
           AND ($6::int IS NULL OR a.id != $6)`,
        [Number(professor_id), day, academic_year || '', start_time, end_time, exclude_id ? Number(exclude_id) : null]
      );
      for (const row of profRows) {
        // If assigned in the exact same room, this is a joint/merged session, not a conflict
        if (room_id && Number(row.room_id) === Number(room_id)) {
          continue;
        }
        conflicts.push({
          type: 'professor',
          message: `الأستاذ (${row.professor_name || profName}) لديه حصة أخرى في نفس التوقيت: ${row.course_name || ''} مع ${row.group_name || ''} في ${row.room_name || ''} (#${row.id})`,
          assignment: row
        });
      }
    }
  }

  // 2. Room conflict (ignore 'عن بعد')
  if (room_id) {
    const rms = await executeQuery('SELECT id, name FROM rooms WHERE id = $1', [Number(room_id)]);
    const roomName = rms[0]?.name || '';
    if (roomName && roomName !== 'عن بعد' && !roomName.includes('عن بعد')) {
      const roomRows = await executeQuery(
        `SELECT a.id, a.day_of_week, a.start_time, a.end_time,
                r.name as room_name, c.name as course_name, g.name as group_name, p.name as professor_name
         FROM assignments a
         LEFT JOIN rooms r ON a.room_id = r.id
         LEFT JOIN courses c ON a.course_id = c.id
         LEFT JOIN groups g ON a.group_id = g.id
         LEFT JOIN professors p ON a.professor_id = p.id
         WHERE a.room_id = $1 AND a.day_of_week = $2
           AND ($3 = '' OR a.academic_year = $3)
           AND NOT (a.end_time <= $4 OR a.start_time >= $5)
           AND ($6::int IS NULL OR a.id != $6)`,
        [Number(room_id), day, academic_year || '', start_time, end_time, exclude_id ? Number(exclude_id) : null]
      );
      for (const row of roomRows) {
        if (row.room_name && (row.room_name === 'عن بعد' || row.room_name.includes('عن بعد'))) {
          continue;
        }
        conflicts.push({
          type: 'room',
          message: `القاعة (${row.room_name || roomName}) محجوزة بحصة أخرى: ${row.course_name || ''} (${row.professor_name || ''}) مع ${row.group_name || ''} (#${row.id})`,
          assignment: row
        });
      }
    }
  }

  // 3. Group conflict (hierarchical: direct group, child groups, parent group)
  if (group_id) {
    const grps = await executeQuery('SELECT id, name, parent_group_id FROM groups WHERE id = $1', [Number(group_id)]);
    const parentId = grps[0]?.parent_group_id || null;

    const groupRows = await executeQuery(
      `SELECT a.id, a.day_of_week, a.start_time, a.end_time, a.group_id,
              g.name as group_name, c.name as course_name, p.name as professor_name, r.name as room_name
       FROM assignments a
       LEFT JOIN groups g ON a.group_id = g.id
       LEFT JOIN courses c ON a.course_id = c.id
       LEFT JOIN professors p ON a.professor_id = p.id
       LEFT JOIN rooms r ON a.room_id = r.id
       WHERE (a.group_id = $1 OR ($7::int IS NOT NULL AND a.group_id = $7) OR a.group_id IN (SELECT id FROM groups WHERE parent_group_id = $1))
         AND a.day_of_week = $2
         AND ($3 = '' OR a.academic_year = $3)
         AND NOT (a.end_time <= $4 OR a.start_time >= $5)
         AND ($6::int IS NULL OR a.id != $6)`,
      [Number(group_id), day, academic_year || '', start_time, end_time, exclude_id ? Number(exclude_id) : null, parentId]
    );
    for (const row of groupRows) {
      conflicts.push({
        type: 'group',
        message: `الفوج (${row.group_name || 'المحدد'}) مبرمج لحصة أخرى في نفس التوقيت: ${row.course_name || ''} (${row.professor_name || ''}) في ${row.room_name || ''} (#${row.id})`,
        assignment: row
      });
    }
  }

  return { conflicts, has_conflicts: conflicts.length > 0 };
}

async function checkConflictsEndpoint(req, res) {
  try {
    const {
      day_of_week,
      start_time,
      end_time,
      room_id,
      professor_id,
      group_id,
      academic_year,
      semester,
      exclude_id
    } = req.body;

    const result = await findAssignmentConflicts({
      day_of_week,
      start_time,
      end_time,
      room_id,
      professor_id,
      group_id,
      academic_year,
      semester,
      exclude_id
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function auditConflictsEndpoint(req, res) {
  try {
    const { academic_year, semester } = req.query;
    const year = academic_year || '2026-2027';
    const sem = semester || '';

    const rows = await executeQuery(
      `SELECT a.id, a.day_of_week, a.start_time, a.end_time, a.academic_year, a.semester,
              a.professor_id, p.name as professor_name,
              a.room_id, r.name as room_name,
              a.group_id, g.name as group_name, g.parent_group_id,
              a.course_id, c.name as course_name
       FROM assignments a
       LEFT JOIN professors p ON a.professor_id = p.id
       LEFT JOIN rooms r ON a.room_id = r.id
       LEFT JOIN groups g ON a.group_id = g.id
       LEFT JOIN courses c ON a.course_id = c.id
       WHERE a.academic_year = $1
         AND ($2 = '' OR a.semester = $2)
       ORDER BY a.day_of_week, a.start_time`,
      [year, sem]
    );

    const conflicts = [];
    const seenPairs = new Set();

    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a1 = rows[i];
        const a2 = rows[j];

        if (Number(a1.day_of_week) !== Number(a2.day_of_week)) continue;
        if (!isTimeOverlap(a1.start_time, a1.end_time, a2.start_time, a2.end_time)) continue;

        const pairKey = [a1.id, a2.id].sort((x, y) => x - y).join('-');
        if (seenPairs.has(pairKey)) continue;

        // 1. Professor conflict
        if (
          a1.professor_id &&
          a2.professor_id &&
          Number(a1.professor_id) === Number(a2.professor_id) &&
          a1.professor_name &&
          a1.professor_name !== 'غير معين' &&
          !a1.professor_name.includes('غير معين')
        ) {
          if (Number(a1.room_id) !== Number(a2.room_id)) {
            seenPairs.add(pairKey);
            conflicts.push({
              type: 'professor',
              message: `تعارض أستاذ: ${a1.professor_name} مكلف بحصتين في نفس التوقيت (${a1.start_time} - ${a1.end_time}) في قاعتين مختلفتين (${a1.room_name} و ${a2.room_name})`,
              assignmentA: a1,
              assignmentB: a2
            });
            continue;
          }
        }

        // 2. Room conflict
        if (
          a1.room_id &&
          a2.room_id &&
          Number(a1.room_id) === Number(a2.room_id) &&
          a1.room_name &&
          a1.room_name !== 'عن بعد' &&
          !a1.room_name.includes('عن بعد')
        ) {
          seenPairs.add(pairKey);
          conflicts.push({
            type: 'room',
            message: `تعارض قاعة: القاعة ${a1.room_name} محجوزة بحصتين متزامنتين (${a1.course_name} مع ${a1.group_name}) و (${a2.course_name} مع ${a2.group_name})`,
            assignmentA: a1,
            assignmentB: a2
          });
          continue;
        }

        // 3. Group conflict
        const isSameGroup = a1.group_id && a2.group_id && Number(a1.group_id) === Number(a2.group_id);
        const isParentChild =
          (a1.group_id && a2.parent_group_id && Number(a1.group_id) === Number(a2.parent_group_id)) ||
          (a2.group_id && a1.parent_group_id && Number(a2.group_id) === Number(a1.parent_group_id));

        if (isSameGroup || isParentChild) {
          seenPairs.add(pairKey);
          conflicts.push({
            type: 'group',
            message: `تعارض فوج: ${a1.group_name} مبرمج لحصتين متزامنتين (${a1.course_name} و ${a2.course_name}) في نفس الفترة`,
            assignmentA: a1,
            assignmentB: a2
          });
          continue;
        }
      }
    }

    const byType = {
      professor: conflicts.filter(c => c.type === 'professor').length,
      room: conflicts.filter(c => c.type === 'room').length,
      group: conflicts.filter(c => c.type === 'group').length
    };

    res.json({
      totalConflicts: conflicts.length,
      byType,
      academicYear: year,
      semester: sem,
      conflicts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function previewBulkImport(req, res) {
  try {
    const { academic_year, semester, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'قائمة التكليفات فارغة' });
    }

    const year = academic_year || '2026-2027';

    // Load reference data
    const [profList, courseList, roomList, groupList, existingAssignments] = await Promise.all([
      executeQuery('SELECT id, name FROM professors WHERE deleted_at IS NULL'),
      executeQuery('SELECT id, name, code FROM courses WHERE deleted_at IS NULL'),
      executeQuery('SELECT id, name FROM rooms WHERE deleted_at IS NULL'),
      executeQuery('SELECT id, name, year, specialization FROM groups WHERE deleted_at IS NULL'),
      executeQuery(
        'SELECT id, professor_id, room_id, group_id, day_of_week, start_time, end_time FROM assignments WHERE academic_year = $1',
        [year]
      )
    ]);

    const normalize = (str) => (str || '').toString().trim().toLowerCase().replace(/[\u064B-\u065F\u0640]/g, '');

    const profMapByName = new Map();
    const profMapById = new Map();
    profList.forEach((p) => {
      profMapByName.set(normalize(p.name), p);
      profMapById.set(Number(p.id), p);
    });

    const courseMapByName = new Map();
    const courseMapByCode = new Map();
    const courseMapById = new Map();
    courseList.forEach((c) => {
      courseMapByName.set(normalize(c.name), c);
      if (c.code) courseMapByCode.set(normalize(c.code), c);
      courseMapById.set(Number(c.id), c);
    });

    const roomMapByName = new Map();
    const roomMapById = new Map();
    roomList.forEach((r) => {
      roomMapByName.set(normalize(r.name), r);
      roomMapById.set(Number(r.id), r);
    });

    const groupMapByName = new Map();
    const groupMapById = new Map();
    groupList.forEach((g) => {
      groupMapByName.set(normalize(g.name), g);
      groupMapById.set(Number(g.id), g);
    });

    const missingEntities = {
      professors: new Set(),
      courses: new Set(),
      rooms: new Set(),
      groups: new Set()
    };

    const previewRows = [];
    let validCount = 0;
    let conflictCount = 0;
    let errorCount = 0;

    const timeOverlaps = (s1, e1, s2, e2) => !(e1 <= s2 || s1 >= e2);

    for (let i = 0; i < items.length; i++) {
      const raw = items[i];
      const errors = [];
      const warnings = [];

      // Resolve Professor
      let prof = null;
      if (raw.professor_id) prof = profMapById.get(Number(raw.professor_id));
      if (!prof && raw.professor_name) prof = profMapByName.get(normalize(raw.professor_name));
      if (!prof) {
        const name = (raw.professor_name || `أستاذ #${raw.professor_id || i + 1}`).trim();
        missingEntities.professors.add(name);
        warnings.push(`الأستاذ "${name}" غير مسجل في النظام وسيتم إنشاؤه.`);
      }

      // Resolve Course
      let course = null;
      if (raw.course_id) course = courseMapById.get(Number(raw.course_id));
      if (!course && raw.course_code) course = courseMapByCode.get(normalize(raw.course_code));
      if (!course && raw.course_name) course = courseMapByName.get(normalize(raw.course_name));
      if (!course) {
        const name = (raw.course_name || raw.course_code || `مقياس #${raw.course_id || i + 1}`).trim();
        missingEntities.courses.add(name);
        warnings.push(`المقياس "${name}" غير مسجل في النظام وسيتم إنشاؤه.`);
      }

      // Resolve Room
      let room = null;
      if (raw.room_id) room = roomMapById.get(Number(raw.room_id));
      if (!room && raw.room_name) room = roomMapByName.get(normalize(raw.room_name));
      if (!room) {
        const name = (raw.room_name || `قاعة #${raw.room_id || i + 1}`).trim();
        missingEntities.rooms.add(name);
        warnings.push(`القاعة "${name}" غير مسجلة في النظام وستُنشأ تلقائياً.`);
      }

      // Resolve Group
      let group = null;
      if (raw.group_id) group = groupMapById.get(Number(raw.group_id));
      if (!group && raw.group_name) group = groupMapByName.get(normalize(raw.group_name));
      if (!group) {
        const name = (raw.group_name || `فوج #${raw.group_id || i + 1}`).trim();
        missingEntities.groups.add(name);
        warnings.push(`الفوج "${name}" غير مسجل في النظام وسيتم إنشاؤه.`);
      }

      const day = Number(raw.day_of_week ?? 0);
      const start = String(raw.start_time || '').trim();
      const end = String(raw.end_time || '').trim();

      if (!start || !end) {
        errors.push('توقيت بداية ونهاية الحصة مطلوب.');
      }

      // Check external conflict with existing assignments
      let hasConflict = false;
      for (const ex of existingAssignments) {
        if (Number(ex.day_of_week) === day && timeOverlaps(start, end, ex.start_time, ex.end_time)) {
          if (prof && Number(ex.professor_id) === Number(prof.id)) {
            hasConflict = true;
            errors.push(`تعارض: الأستاذ مرتبط بحصة مسبقة في قاعدة البيانات (#${ex.id}).`);
          }
          if (room && Number(ex.room_id) === Number(room.id)) {
            hasConflict = true;
            errors.push(`تعارض: القاعة محجوزة بحصة مسبقة في قاعدة البيانات (#${ex.id}).`);
          }
          if (group && Number(ex.group_id) === Number(group.id)) {
            hasConflict = true;
            errors.push(`تعارض: الفوج مرتبط بحصة مسبقة في قاعدة البيانات (#${ex.id}).`);
          }
        }
      }

      // Check internal conflict inside the same imported batch
      for (let j = 0; j < i; j++) {
        const prev = previewRows[j];
        if (prev.day_of_week === day && timeOverlaps(start, end, prev.start_time, prev.end_time)) {
          if (prof && prev.professor_id && Number(prev.professor_id) === Number(prof.id)) {
            hasConflict = true;
            errors.push(`تعارض داخلي: الأستاذ مكرر في نفس التوقيت بالملف (الصف ${j + 1}).`);
          }
          if (room && prev.room_id && Number(prev.room_id) === Number(room.id)) {
            hasConflict = true;
            errors.push(`تعارض داخلي: القاعة مكررة في نفس التوقيت بالملف (الصف ${j + 1}).`);
          }
          if (group && prev.group_id && Number(prev.group_id) === Number(group.id)) {
            hasConflict = true;
            errors.push(`تعارض داخلي: الفوج مكرر في نفس التوقيت بالملف (الصف ${j + 1}).`);
          }
        }
      }

      if (hasConflict) conflictCount++;
      if (errors.length > 0) errorCount++;
      else validCount++;

      previewRows.push({
        rowIndex: i + 1,
        professor_id: prof ? prof.id : null,
        professor_name: prof ? prof.name : (raw.professor_name || ''),
        course_id: course ? course.id : null,
        course_name: course ? course.name : (raw.course_name || raw.course_code || ''),
        room_id: room ? room.id : null,
        room_name: room ? room.name : (raw.room_name || ''),
        group_id: group ? group.id : null,
        group_name: group ? group.name : (raw.group_name || ''),
        day_of_week: day,
        start_time: start,
        end_time: end,
        session_type: raw.session_type || 'lecture',
        specialization: raw.specialization || (group ? group.specialization : ''),
        status: errors.length > 0 ? (hasConflict ? 'conflict' : 'error') : warnings.length > 0 ? 'warning' : 'valid',
        errors,
        warnings
      });
    }

    res.json({
      total: items.length,
      validCount,
      conflictCount,
      errorCount,
      missingEntities: {
        professors: Array.from(missingEntities.professors),
        courses: Array.from(missingEntities.courses),
        rooms: Array.from(missingEntities.rooms),
        groups: Array.from(missingEntities.groups)
      },
      rows: previewRows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function bulkImportAssignments(req, res) {
  try {
    const { academic_year, semester, auto_create_missing, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'قائمة التكليفات فارغة' });
    }

    const year = academic_year || '2026-2027';
    const sem = semester || '1';

    const result = await unitOfWork(async (uow) => {
      const normalize = (str) => (str || '').toString().trim().toLowerCase().replace(/[\u064B-\u065F\u0640]/g, '');

      // Load references within transaction
      const profList = await uow.query('SELECT id, name FROM professors');
      const courseList = await uow.query('SELECT id, name, code FROM courses');
      const roomList = await uow.query('SELECT id, name FROM rooms');
      const groupList = await uow.query('SELECT id, name FROM groups');

      const profMapByName = new Map();
      const profMapById = new Map();
      profList.forEach((p) => {
        profMapByName.set(normalize(p.name), p.id);
        profMapById.set(Number(p.id), p.id);
      });

      const courseMapByName = new Map();
      const courseMapByCode = new Map();
      const courseMapById = new Map();
      courseList.forEach((c) => {
        courseMapByName.set(normalize(c.name), c.id);
        if (c.code) courseMapByCode.set(normalize(c.code), c.id);
        courseMapById.set(Number(c.id), c.id);
      });

      const roomMapByName = new Map();
      const roomMapById = new Map();
      roomList.forEach((r) => {
        roomMapByName.set(normalize(r.name), r.id);
        roomMapById.set(Number(r.id), r.id);
      });

      const groupMapByName = new Map();
      const groupMapById = new Map();
      groupList.forEach((g) => {
        groupMapByName.set(normalize(g.name), g.id);
        groupMapById.set(Number(g.id), g.id);
      });

      const createdEntities = { professors: 0, courses: 0, rooms: 0, groups: 0 };

      const getOrCreateProf = async (name, id) => {
        if (id && profMapById.has(Number(id))) return profMapById.get(Number(id));
        const key = normalize(name);
        if (profMapByName.has(key)) return profMapByName.get(key);
        if (!auto_create_missing) throw new Error(`الأستاذ "${name}" غير مسجل في النظام`);
        const [created] = await uow.query(
          `INSERT INTO professors (name, created_at, updated_at) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
          [name.trim()]
        );
        profMapByName.set(key, created.id);
        profMapById.set(created.id, created.id);
        createdEntities.professors++;
        return created.id;
      };

      const getOrCreateCourse = async (name, code, id) => {
        if (id && courseMapById.has(Number(id))) return courseMapById.get(Number(id));
        const key = normalize(name);
        if (courseMapByName.has(key)) return courseMapByName.get(key);
        if (code && courseMapByCode.has(normalize(code))) return courseMapByCode.get(normalize(code));
        if (!auto_create_missing) throw new Error(`المقياس "${name || code}" غير مسجل في النظام`);
        const [created] = await uow.query(
          `INSERT INTO courses (name, code, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
          [(name || code || 'مقياس جديد').trim(), (code || '').trim() || null]
        );
        courseMapByName.set(key, created.id);
        courseMapById.set(created.id, created.id);
        createdEntities.courses++;
        return created.id;
      };

      const getOrCreateRoom = async (name, id) => {
        if (id && roomMapById.has(Number(id))) return roomMapById.get(Number(id));
        const key = normalize(name);
        if (roomMapByName.has(key)) return roomMapByName.get(key);
        if (!auto_create_missing) throw new Error(`القاعة "${name}" غير مسجلة في النظام`);
        const [created] = await uow.query(
          `INSERT INTO rooms (name, capacity, created_at, updated_at) VALUES ($1, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
          [name.trim()]
        );
        roomMapByName.set(key, created.id);
        roomMapById.set(created.id, created.id);
        createdEntities.rooms++;
        return created.id;
      };

      const getOrCreateGroup = async (name, id, spec, yearLevel) => {
        if (id && groupMapById.has(Number(id))) return groupMapById.get(Number(id));
        const key = normalize(name);
        if (groupMapByName.has(key)) return groupMapByName.get(key);
        if (!auto_create_missing) throw new Error(`الفوج "${name}" غير مسجل في النظام`);
        const [created] = await uow.query(
          `INSERT INTO groups (name, specialization, year, group_type, created_at, updated_at) VALUES ($1, $2, $3, 'group', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
          [name.trim(), spec || null, yearLevel || 'L1']
        );
        groupMapByName.set(key, created.id);
        groupMapById.set(created.id, created.id);
        createdEntities.groups++;
        return created.id;
      };

      const insertedAssignments = [];

      for (const item of items) {
        const profId = await getOrCreateProf(item.professor_name, item.professor_id);
        const courseId = await getOrCreateCourse(item.course_name, item.course_code, item.course_id);
        const roomId = await getOrCreateRoom(item.room_name, item.room_id);
        const groupId = await getOrCreateGroup(item.group_name, item.group_id, item.specialization, item.year);

        const [created] = await uow.query(
          `INSERT INTO assignments (
            professor_id, course_id, group_id, room_id,
            day_of_week, start_time, end_time,
            academic_year, semester, session_type, specialization,
            version, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11,
            1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING *`,
          [
            profId,
            courseId,
            groupId,
            roomId,
            Number(item.day_of_week ?? 0),
            item.start_time,
            item.end_time,
            year,
            sem,
            item.session_type || 'lecture',
            item.specialization || ''
          ]
        );

        insertedAssignments.push(created);

        await uow.recordChange({
          entity_type: 'assignments',
          entity_id: created.id,
          action: 'create',
          before_state: null,
          after_state: created,
          changed_by: req.user?.id
        });
      }

      return {
        count: insertedAssignments.length,
        createdEntities
      };
    });

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getCoverageAudit(req, res) {
  try {
    const { academicYear, semester } = req.query;
    const year = academicYear || '2026-2027';

    // 1. Courses with 0 assignments
    const unassignedCourses = await executeQuery(
      `SELECT c.id, c.name, c.code, c.metadata
       FROM courses c
       WHERE c.deleted_at IS NULL
         AND c.id NOT IN (
           SELECT DISTINCT course_id FROM assignments
           WHERE academic_year = $1 AND ($2 = '' OR semester = $2)
         )
       ORDER BY c.name ASC`,
      [year, semester || '']
    );

    // 2. Assignments without a room
    const missingRoomSessions = await executeQuery(
      `SELECT a.id, a.day_of_week, a.start_time, a.end_time, a.session_type,
              c.name as course_name, p.name as professor_name, g.name as group_name
       FROM assignments a
       LEFT JOIN courses c ON a.course_id = c.id
       LEFT JOIN professors p ON a.professor_id = p.id
       LEFT JOIN groups g ON a.group_id = g.id
       WHERE a.academic_year = $1 AND ($2 = '' OR a.semester = $2)
         AND (a.room_id IS NULL OR a.room_id = 0)
       ORDER BY a.day_of_week ASC, a.start_time ASC`,
      [year, semester || '']
    );

    // 3. Groups with missing TD or TP
    const groupRows = await executeQuery(
      `SELECT g.id, g.name, g.year, g.specialization,
              COUNT(a.id) as total_sessions,
              COUNT(CASE WHEN a.session_type = 'td' THEN 1 END) as td_count,
              COUNT(CASE WHEN a.session_type = 'tp' THEN 1 END) as tp_count,
              COUNT(CASE WHEN a.session_type = 'lecture' THEN 1 END) as lecture_count
       FROM groups g
       LEFT JOIN assignments a ON g.id = a.group_id AND a.academic_year = $1 AND ($2 = '' OR a.semester = $2)
       WHERE g.deleted_at IS NULL
       GROUP BY g.id, g.name, g.year, g.specialization
       ORDER BY g.name ASC`,
      [year, semester || '']
    );

    res.json({
      unassignedCourses,
      missingRoomSessions,
      groupCoverage: groupRows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  swapAssignments,
  moveAssignment,
  checkConflictsEndpoint,
  auditConflictsEndpoint,
  previewBulkImport,
  bulkImportAssignments,
  getCoverageAudit
};

