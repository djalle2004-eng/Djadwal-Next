const { groupsRepository } = require('../../../packages/core/src/repositories/index.js');

async function listGroups(req, res) {
  try {
    const withArchived = req.query.withArchived === 'true';
    const rows = await groupsRepository.list({ withArchived, orderBy: 'name ASC' });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getGroup(req, res) {
  try {
    const { id } = req.params;
    const withArchived = req.query.withArchived === 'true';
    const row = await groupsRepository.get(id, { withArchived });
    if (!row) {
      return res.status(404).json({ error: 'الفوج غير موجود' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createGroup(req, res) {
  try {
    const { name, department_id, group_type, specialization, parent_group_id, year } = req.body;
    const created = await groupsRepository.create(
      { name, department_id, group_type: group_type || 'group', specialization, parent_group_id, year },
      { userId: req.user?.id }
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateGroup(req, res) {
  try {
    const { id } = req.params;
    const { name, department_id, group_type, specialization, parent_group_id, year, version } = req.body;
    const updated = await groupsRepository.update(
      id,
      { name, department_id, group_type, specialization, parent_group_id, year },
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

async function deleteGroup(req, res) {
  try {
    const { id } = req.params;
    const result = await groupsRepository.archive(id, { userId: req.user?.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup
};

