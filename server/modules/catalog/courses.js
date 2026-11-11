const { coursesRepository } = require('../../../packages/core/src/repositories/index.js');

async function listCourses(req, res) {
  try {
    const withArchived = req.query.withArchived === 'true';
    const rows = await coursesRepository.list({ withArchived, orderBy: 'name ASC' });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getCourse(req, res) {
  try {
    const { id } = req.params;
    const withArchived = req.query.withArchived === 'true';
    const row = await coursesRepository.get(id, { withArchived });
    if (!row) {
      return res.status(404).json({ error: 'المقياس غير موجود' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createCourse(req, res) {
  try {
    const { name, code, metadata, department_id } = req.body;
    const metaStr = typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || '{}');
    const created = await coursesRepository.create(
      { name, code, metadata: metaStr, department_id },
      { userId: req.user?.id }
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateCourse(req, res) {
  try {
    const { id } = req.params;
    const { name, code, metadata, department_id, version } = req.body;
    const metaStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;
    const updated = await coursesRepository.update(
      id,
      { name, code, metadata: metaStr, department_id },
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

module.exports = {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  restoreCourse
};

