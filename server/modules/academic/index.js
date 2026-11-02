const { executeQuery } = require('../../database.js');
const { unitOfWork } = require('../../../packages/core/src/unitOfWork.js');

// --- Academic Years ---
async function listAcademicYears(req, res) {
  try {
    const rows = await executeQuery('SELECT * FROM academic_years ORDER BY year_name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getActiveAcademicYear(req, res) {
  try {
    const rows = await executeQuery('SELECT * FROM academic_years WHERE is_current = 1 LIMIT 1');
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createAcademicYear(req, res) {
  try {
    const { yearName, setAsCurrent } = req.body;
    const isCurrent = setAsCurrent ? 1 : 0;

    const result = await unitOfWork(async (uow) => {
      if (isCurrent === 1) {
        await uow.query('UPDATE academic_years SET is_current = 0');
      }
      const [created] = await uow.query(
        'INSERT INTO academic_years (year_name, is_current) VALUES ($1, $2) RETURNING *',
        [yearName, isCurrent]
      );
      return created;
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function activateAcademicYear(req, res) {
  try {
    const { id } = req.params;
    await unitOfWork(async (uow) => {
      await uow.query('UPDATE academic_years SET is_current = 0');
      await uow.query('UPDATE academic_years SET is_current = 1 WHERE id = $1', [id]);
    });
    res.json({ success: true, activeId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteAcademicYear(req, res) {
  try {
    const { id } = req.params;
    await executeQuery('DELETE FROM academic_years WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// --- Semesters ---
async function listSemesters(req, res) {
  try {
    const { academicYearId } = req.query;
    let sql = 'SELECT * FROM semesters';
    const params = [];
    if (academicYearId) {
      sql += ' WHERE academic_year_id = $1';
      params.push(academicYearId);
    }
    sql += ' ORDER BY semester_name ASC';
    const rows = await executeQuery(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getActiveSemester(req, res) {
  try {
    const { academicYearId } = req.query;
    let sql = 'SELECT * FROM semesters WHERE is_current = 1';
    const params = [];
    if (academicYearId) {
      sql += ' AND academic_year_id = $1';
      params.push(academicYearId);
    }
    sql += ' LIMIT 1';
    const rows = await executeQuery(sql, params);
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createSemester(req, res) {
  try {
    const { academicYearId, semesterName, startDate, endDate, setAsCurrent, isPublic } = req.body;
    const isCurr = setAsCurrent ? 1 : 0;
    const isPub = isPublic !== undefined ? (isPublic ? 1 : 0) : 1;

    const result = await unitOfWork(async (uow) => {
      if (isCurr === 1) {
        await uow.query('UPDATE semesters SET is_current = 0 WHERE academic_year_id = $1', [academicYearId]);
      }
      const [created] = await uow.query(
        `INSERT INTO semesters (academic_year_id, semester_name, start_date, end_date, is_current, is_public, version)
         VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING *`,
        [academicYearId, semesterName, startDate || null, endDate || null, isCurr, isPub]
      );
      return created;
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateSemester(req, res) {
  try {
    const { id } = req.params;
    const { semesterName, startDate, endDate, isPublic, version } = req.body;
    const isPub = isPublic !== undefined ? (isPublic ? 1 : 0) : 1;

    const [updated] = await executeQuery(
      `UPDATE semesters
       SET semester_name = $1, start_date = $2, end_date = $3, is_public = $4, version = COALESCE(version, 1) + 1
       WHERE id = $5 RETURNING *`,
      [semesterName, startDate, endDate, isPub, id]
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function activateSemester(req, res) {
  try {
    const { id } = req.params;
    await unitOfWork(async (uow) => {
      const [sem] = await uow.query('SELECT academic_year_id FROM semesters WHERE id = $1', [id]);
      if (sem) {
        await uow.query('UPDATE semesters SET is_current = 0 WHERE academic_year_id = $1', [sem.academic_year_id]);
      }
      await uow.query('UPDATE semesters SET is_current = 1 WHERE id = $1', [id]);
    });
    res.json({ success: true, activeId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteSemester(req, res) {
  try {
    const { id } = req.params;
    await executeQuery('DELETE FROM semesters WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listAcademicYears,
  getActiveAcademicYear,
  createAcademicYear,
  activateAcademicYear,
  deleteAcademicYear,
  listSemesters,
  getActiveSemester,
  createSemester,
  updateSemester,
  activateSemester,
  deleteSemester
};

