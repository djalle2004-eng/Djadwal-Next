const { extraSessionsRepository } = require('../../../packages/core/src/repositories/index.js');
const { unitOfWork } = require('../../../packages/core/src/unitOfWork.js');
const { executeQuery } = require('../../database.js');

function dateToSystemDayOfWeek(dateStr) {
  if (!dateStr) return 1;
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const jsDay = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  if (jsDay === 0) return 1; // Sunday in Djadwal is 1
  if (jsDay === 6) return 0; // Saturday in Djadwal is 0
  return jsDay + 1; // Mon-Fri (1-5) -> 2-6
}

const OFFICIAL_SLOTS = [
  { start: '08:00', end: '09:30', label: '08:00 - 09:30' },
  { start: '09:30', end: '11:00', label: '09:30 - 11:00' },
  { start: '11:00', end: '12:30', label: '11:00 - 12:30' },
  { start: '12:30', end: '14:00', label: '12:30 - 14:00' },
  { start: '14:00', end: '15:30', label: '14:00 - 15:30' },
  { start: '15:30', end: '17:00', label: '15:30 - 17:00' },
];

function timeToMinutes(t) {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function isTimeOverlap(s1, e1, s2, e2) {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(e1) > timeToMinutes(s2);
}

async function findConflicts({ session_date, start_time, end_time, room_id, professor_id, group_id, academic_year, semester, exclude_id = null }) {
  const conflicts = [];
  const systemDay = dateToSystemDayOfWeek(session_date);

  // 1. Check conflicts with regular assignments on that day of week
  let regSql = `
    SELECT a.*, r.name as room_name, p.name as professor_name, g.name as group_name, c.name as course_name
    FROM assignments a
    LEFT JOIN rooms r ON a.room_id = r.id
    LEFT JOIN professors p ON a.professor_id = p.id
    LEFT JOIN groups g ON a.group_id = g.id
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE a.day_of_week = $1
      AND (a.start_time < $2 AND a.end_time > $3)
  `;
  const regParams = [systemDay, end_time, start_time];
  let pIdx = 4;

  if (academic_year) {
    regSql += ` AND a.academic_year = $${pIdx++}`;
    regParams.push(academic_year);
  }

  const regRows = await executeQuery(regSql, regParams);
  for (const row of regRows) {
    if (room_id && row.room_id === Number(room_id)) {
      conflicts.push({
        type: 'room',
        source: 'assignment',
        message: `القاعة "${row.room_name || room_id}" مشغولة بحصة أسبوعية (${row.course_name || ''} - ${row.group_name || ''}) من ${row.start_time} إلى ${row.end_time}`,
        details: row
      });
    }
    if (professor_id && row.professor_id === Number(professor_id)) {
      conflicts.push({
        type: 'professor',
        source: 'assignment',
        message: `الأستاذ "${row.professor_name || professor_id}" لديه حصة أسبوعية (${row.course_name || ''} - ${row.group_name || ''}) من ${row.start_time} إلى ${row.end_time}`,
        details: row
      });
    }
    if (group_id && row.group_id === Number(group_id)) {
      conflicts.push({
        type: 'group',
        source: 'assignment',
        message: `الفوج "${row.group_name || group_id}" لديه حصة أسبوعية (${row.course_name || ''}) من ${row.start_time} إلى ${row.end_time}`,
        details: row
      });
    }
  }

  // 2. Check conflicts with other extra sessions on the exact date
  let extraSql = `
    SELECT s.*, r.name as room_name, p.name as professor_name, g.name as group_name, c.name as course_name
    FROM extra_sessions s
    LEFT JOIN rooms r ON s.room_id = r.id
    LEFT JOIN professors p ON s.professor_id = p.id
    LEFT JOIN groups g ON s.group_id = g.id
    LEFT JOIN courses c ON s.course_id = c.id
    WHERE s.session_date = $1
      AND (s.is_archived = 0 OR s.is_archived IS NULL)
      AND (s.start_time < $2 AND s.end_time > $3)
  `;
  const extraParams = [session_date, end_time, start_time];
  let eIdx = 4;

  if (exclude_id) {
    extraSql += ` AND s.id != $${eIdx++}`;
    extraParams.push(Number(exclude_id));
  }

  const extraRows = await executeQuery(extraSql, extraParams);
  for (const row of extraRows) {
    if (room_id && row.room_id === Number(room_id)) {
      conflicts.push({
        type: 'room',
        source: 'extra_session',
        message: `القاعة "${row.room_name || room_id}" محجوزة مسبقًا لحصة إضافية/تعويضية (${row.course_name || ''}) من ${row.start_time} إلى ${row.end_time}`,
        details: row
      });
    }
    if (professor_id && row.professor_id === Number(professor_id)) {
      conflicts.push({
        type: 'professor',
        source: 'extra_session',
        message: `الأستاذ "${row.professor_name || professor_id}" مبرمج مسبقًا لحصة إضافية/تعويضية من ${row.start_time} إلى ${row.end_time}`,
        details: row
      });
    }
    if (group_id && row.group_id === Number(group_id)) {
      conflicts.push({
        type: 'group',
        source: 'extra_session',
        message: `الفوج "${row.group_name || group_id}" لديه حصة إضافية/تعويضية مبرمجة من ${row.start_time} إلى ${row.end_time}`,
        details: row
      });
    }
  }

  return conflicts;
}

async function listExtraSessions(req, res) {
  try {
    const { academicYear, semester, sessionDate, roomId, professorId, groupId, sessionType, isArchived } = req.query;
    const whereClauses = [];
    const params = [];
    let idx = 1;

    if (academicYear) {
      whereClauses.push(`s.academic_year = $${idx++}`);
      params.push(academicYear);
    }
    if (semester) {
      whereClauses.push(`(
        REPLACE(s.semester, 'ـ', '') = REPLACE($${idx++}, 'ـ', '')
        OR REPLACE(REPLACE(s.semester, 'ـ', ''), 'السداسي', 'الفصل') = REPLACE(REPLACE($${idx++}, 'ـ', ''), 'السداسي', 'الفصل')
      )`);
      params.push(semester);
      params.push(semester);
    }
    if (sessionDate) {
      whereClauses.push(`s.session_date = $${idx++}`);
      params.push(sessionDate);
    }
    if (roomId) {
      whereClauses.push(`s.room_id = $${idx++}`);
      params.push(Number(roomId));
    }
    if (professorId) {
      whereClauses.push(`s.professor_id = $${idx++}`);
      params.push(Number(professorId));
    }
    if (groupId) {
      whereClauses.push(`s.group_id = $${idx++}`);
      params.push(Number(groupId));
    }
    if (sessionType) {
      whereClauses.push(`s.session_type = $${idx++}`);
      params.push(sessionType);
    }
    if (isArchived !== undefined && isArchived !== '') {
      whereClauses.push(`(s.is_archived = $${idx++} OR (s.is_archived IS NULL AND $${idx++} = 0))`);
      const archVal = Number(isArchived) === 1 ? 1 : 0;
      params.push(archVal);
      params.push(archVal);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    let sql = `
      SELECT s.*,
             g.name as group_name,
             c.name as course_name,
             p.name as professor_name,
             r.name as room_name,
             r.capacity as room_capacity,
             r.building as room_building
      FROM extra_sessions s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN professors p ON s.professor_id = p.id
      LEFT JOIN rooms r ON s.room_id = r.id
      ${whereStr}
      ORDER BY s.session_date DESC, s.start_time ASC
    `;

    if (req.query.limit) {
      const limitVal = Math.min(Number(req.query.limit) || 100, 5000);
      sql += ` LIMIT $${idx++}`;
      params.push(limitVal);
    }

    const rows = await executeQuery(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('listExtraSessions error:', err);
    res.status(500).json({ error: 'FAILED_TO_FETCH_EXTRA_SESSIONS', message: err.message });
  }
}

async function getExtraSession(req, res) {
  try {
    const { id } = req.params;
    const sql = `
      SELECT s.*,
             g.name as group_name,
             c.name as course_name,
             p.name as professor_name,
             r.name as room_name,
             r.capacity as room_capacity,
             r.building as room_building
      FROM extra_sessions s
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN professors p ON s.professor_id = p.id
      LEFT JOIN rooms r ON s.room_id = r.id
      WHERE s.id = $1
    `;
    const rows = await executeQuery(sql, [Number(id)]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'الحصة غير موجودة' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_GET_EXTRA_SESSION', message: err.message });
  }
}

async function checkConflictsEndpoint(req, res) {
  try {
    const { session_date, start_time, end_time, room_id, professor_id, group_id, academic_year, semester, exclude_id } = req.body;
    if (!session_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS', message: 'التاريخ وأوقات الحصة مطلوبة' });
    }
    const conflicts = await findConflicts({ session_date, start_time, end_time, room_id, professor_id, group_id, academic_year, semester, exclude_id });
    res.json({ conflicts, has_conflicts: conflicts.length > 0 });
  } catch (err) {
    res.status(500).json({ error: 'CONFLICT_CHECK_FAILED', message: err.message });
  }
}

async function createExtraSession(req, res) {
  const uow = unitOfWork;
  try {
    const sessionData = req.body;
    const {
      session_date,
      start_time,
      end_time,
      room_id,
      professor_id,
      group_id,
      academic_year,
      semester,
      ignore_conflicts
    } = sessionData;

    if (!session_date || !start_time || !end_time || !room_id || !professor_id || !sessionData.course_id) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'الحقول المطلوبة: المقياس، الأستاذ، القاعة، التاريخ، توقيت البداية والنهاية'
      });
    }

    if (!ignore_conflicts) {
      const conflicts = await findConflicts({
        session_date,
        start_time,
        end_time,
        room_id,
        professor_id,
        group_id,
        academic_year,
        semester
      });

      if (conflicts.length > 0) {
        return res.status(409).json({
          error: {
            code: 'CONFLICT_DETECTED',
            message_ar: conflicts[0].message,
            details: conflicts
          }
        });
      }
    }

    const created = await uow.runInTransaction(async () => {
      const payload = {
        group_id: group_id ? Number(group_id) : null,
        course_id: Number(sessionData.course_id),
        professor_id: Number(professor_id),
        room_id: Number(room_id),
        session_date,
        start_time,
        end_time,
        session_type: sessionData.session_type || 'makeup',
        description: sessionData.description || '',
        academic_year: sessionData.academic_year || '',
        semester: sessionData.semester || '',
        reason: sessionData.reason || '',
        is_archived: 0,
        exam_note: sessionData.exam_note || '',
        version: 1
      };
      return await extraSessionsRepository.create(payload, uow);
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('createExtraSession error:', err);
    res.status(500).json({ error: 'FAILED_TO_CREATE_EXTRA_SESSION', message: err.message });
  }
}

async function updateExtraSession(req, res) {
  const uow = unitOfWork;
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existing = await extraSessionsRepository.findById(Number(id));
    if (!existing) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'الحصة غير موجودة' });
    }

    const session_date = updateData.session_date || existing.session_date;
    const start_time = updateData.start_time || existing.start_time;
    const end_time = updateData.end_time || existing.end_time;
    const room_id = updateData.room_id !== undefined ? updateData.room_id : existing.room_id;
    const professor_id = updateData.professor_id !== undefined ? updateData.professor_id : existing.professor_id;
    const group_id = updateData.group_id !== undefined ? updateData.group_id : existing.group_id;
    const academic_year = updateData.academic_year || existing.academic_year;
    const semester = updateData.semester || existing.semester;

    if (!updateData.ignore_conflicts) {
      const conflicts = await findConflicts({
        session_date,
        start_time,
        end_time,
        room_id,
        professor_id,
        group_id,
        academic_year,
        semester,
        exclude_id: id
      });

      if (conflicts.length > 0) {
        return res.status(409).json({
          error: {
            code: 'CONFLICT_DETECTED',
            message_ar: conflicts[0].message,
            details: conflicts
          }
        });
      }
    }

    const updated = await uow.runInTransaction(async () => {
      return await extraSessionsRepository.update(Number(id), updateData, uow);
    });

    res.json(updated);
  } catch (err) {
    console.error('updateExtraSession error:', err);
    if (err.statusCode === 409 || err.message?.includes('version')) {
      return res.status(409).json({ error: 'CONFLICT', message: 'تم تعديل هذه الحصة بواسطة مستخدم آخر' });
    }
    res.status(500).json({ error: 'FAILED_TO_UPDATE_EXTRA_SESSION', message: err.message });
  }
}

async function deleteExtraSession(req, res) {
  const uow = unitOfWork;
  try {
    const { id } = req.params;
    await uow.runInTransaction(async () => {
      await extraSessionsRepository.delete(Number(id), uow);
    });
    res.json({ success: true, message: 'تم حذف الحصة بنجاح' });
  } catch (err) {
    console.error('deleteExtraSession error:', err);
    res.status(500).json({ error: 'FAILED_TO_DELETE_EXTRA_SESSION', message: err.message });
  }
}

async function archivePastSessions(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const updateSql = `
      UPDATE extra_sessions
      SET is_archived = 1, updated_at = NOW()
      WHERE session_date < $1
        AND (is_archived = 0 OR is_archived IS NULL)
    `;
    const result = await executeQuery(updateSql, [today]);
    const archivedCount = result?.rowCount || result?.affectedRows || result?.length || 0;
    res.json({ success: true, archived: archivedCount, message: `تمت أرشفة ${archivedCount} حصة منتهية بنجاح` });
  } catch (err) {
    console.error('archivePastSessions error:', err);
    res.status(500).json({ error: 'FAILED_TO_ARCHIVE_SESSIONS', message: err.message });
  }
}

async function getAvailableRoomsEndpoint(req, res) {
  try {
    const {
      date,
      session_date,
      time_slot,
      start_time: qStart,
      end_time: qEnd,
      academic_year,
      semester,
      building,
      room_type,
      min_capacity
    } = req.query;

    const targetDate = date || session_date || new Date().toISOString().split('T')[0];
    const systemDay = dateToSystemDayOfWeek(targetDate);

    let start_time = qStart;
    let end_time = qEnd;
    if (time_slot && !start_time && !end_time) {
      const parts = time_slot.split('-').map(s => s.trim());
      if (parts.length === 2) {
        start_time = parts[0];
        end_time = parts[1];
      }
    }
    if (!start_time || !end_time) {
      start_time = OFFICIAL_SLOTS[0].start;
      end_time = OFFICIAL_SLOTS[0].end;
    }

    // 1. Fetch active rooms
    let roomSql = `
      SELECT id, name, capacity, building, room_type
      FROM rooms
      WHERE (is_deleted = 0 OR is_deleted IS NULL)
    `;
    const roomParams = [];
    let rIdx = 1;

    if (building && building !== 'all') {
      roomSql += ` AND building = $${rIdx++}`;
      roomParams.push(building);
    }
    if (room_type && room_type !== 'all') {
      roomSql += ` AND room_type = $${rIdx++}`;
      roomParams.push(room_type);
    }
    if (min_capacity && Number(min_capacity) > 0) {
      roomSql += ` AND capacity >= $${rIdx++}`;
      roomParams.push(Number(min_capacity));
    }
    roomSql += ` ORDER BY name ASC`;

    const rooms = await executeQuery(roomSql, roomParams);

    // 2. Fetch regular assignments for systemDay
    let regSql = `
      SELECT a.*, r.name as room_name, p.name as professor_name, g.name as group_name, c.name as course_name
      FROM assignments a
      LEFT JOIN rooms r ON a.room_id = r.id
      LEFT JOIN professors p ON a.professor_id = p.id
      LEFT JOIN groups g ON a.group_id = g.id
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.day_of_week = $1
    `;
    const regParams = [systemDay];
    let regIdx = 2;
    if (academic_year) {
      regSql += ` AND a.academic_year = $${regIdx++}`;
      regParams.push(academic_year);
    }
    const regularAssignments = await executeQuery(regSql, regParams);

    // 3. Fetch extra sessions for targetDate
    let extraSql = `
      SELECT s.*, r.name as room_name, p.name as professor_name, g.name as group_name, c.name as course_name
      FROM extra_sessions s
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN professors p ON s.professor_id = p.id
      LEFT JOIN groups g ON s.group_id = g.id
      LEFT JOIN courses c ON s.course_id = c.id
      WHERE s.session_date = $1
        AND (s.is_archived = 0 OR s.is_archived IS NULL)
    `;
    const extraSessions = await executeQuery(extraSql, [targetDate]);

    // 4. Evaluate each room for the target slot and build slot matrix
    const evaluatedRooms = [];
    let availableCount = 0;
    let occupiedCount = 0;

    for (const room of rooms) {
      const regInTarget = regularAssignments.find(a =>
        a.room_id === room.id && isTimeOverlap(start_time, end_time, a.start_time, a.end_time)
      );
      const extraInTarget = extraSessions.find(s =>
        s.room_id === room.id && isTimeOverlap(start_time, end_time, s.start_time, s.end_time)
      );

      const isAvailable = !regInTarget && !extraInTarget;
      if (isAvailable) {
        availableCount++;
      } else {
        occupiedCount++;
      }

      let occupant = null;
      if (regInTarget) {
        occupant = {
          type: 'regular',
          course_name: regInTarget.course_name || 'مقياس رسمي',
          professor_name: regInTarget.professor_name || 'أستاذ',
          group_name: regInTarget.group_name || 'فوج',
          start_time: regInTarget.start_time,
          end_time: regInTarget.end_time
        };
      } else if (extraInTarget) {
        occupant = {
          type: 'extra',
          session_type: extraInTarget.session_type,
          course_name: extraInTarget.course_name || 'مقياس إضافي',
          professor_name: extraInTarget.professor_name || 'أستاذ',
          group_name: extraInTarget.group_name || 'فوج',
          start_time: extraInTarget.start_time,
          end_time: extraInTarget.end_time,
          reason: extraInTarget.reason || ''
        };
      }

      // Matrix slots for this room across all 6 official slots
      const slotsState = {};
      for (const slot of OFFICIAL_SLOTS) {
        const slotReg = regularAssignments.find(a =>
          a.room_id === room.id && isTimeOverlap(slot.start, slot.end, a.start_time, a.end_time)
        );
        const slotExtra = extraSessions.find(s =>
          s.room_id === room.id && isTimeOverlap(slot.start, slot.end, s.start_time, s.end_time)
        );

        if (slotReg) {
          slotsState[slot.label] = {
            status: 'occupied_regular',
            course_name: slotReg.course_name || '',
            professor_name: slotReg.professor_name || '',
            group_name: slotReg.group_name || '',
            time: `${slotReg.start_time} - ${slotReg.end_time}`
          };
        } else if (slotExtra) {
          slotsState[slot.label] = {
            status: 'occupied_extra',
            session_type: slotExtra.session_type,
            course_name: slotExtra.course_name || '',
            professor_name: slotExtra.professor_name || '',
            group_name: slotExtra.group_name || '',
            time: `${slotExtra.start_time} - ${slotExtra.end_time}`,
            reason: slotExtra.reason || ''
          };
        } else {
          slotsState[slot.label] = {
            status: 'available'
          };
        }
      }

      evaluatedRooms.push({
        room,
        is_available: isAvailable,
        occupant,
        slots: slotsState
      });
    }

    const dayNames = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const dayNameAr = dayNames[systemDay] || '';

    res.json({
      target_date: targetDate,
      system_day: systemDay,
      day_name_ar: dayNameAr,
      time_slot: `${start_time} - ${end_time}`,
      total_rooms: rooms.length,
      available_count: availableCount,
      occupied_count: occupiedCount,
      vacancy_rate: rooms.length > 0 ? Math.round((availableCount / rooms.length) * 100) : 0,
      rooms: evaluatedRooms,
      official_slots: OFFICIAL_SLOTS
    });
  } catch (err) {
    console.error('getAvailableRoomsEndpoint error:', err);
    res.status(500).json({ error: 'FAILED_TO_GET_AVAILABLE_ROOMS', message: err.message });
  }
}

module.exports = {
  listExtraSessions,
  getExtraSession,
  createExtraSession,
  updateExtraSession,
  deleteExtraSession,
  archivePastSessions,
  checkConflictsEndpoint,
  getAvailableRoomsEndpoint,
  OFFICIAL_SLOTS
};

