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
    const { group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization, session_type } = req.body;
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
    const { group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization, session_type, version } = req.body;
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

module.exports = {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  swapAssignments,
  moveAssignment
};

