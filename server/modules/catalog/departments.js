const { departmentsRepository } = require('../../../packages/core/src/repositories/index.js');
const { unitOfWork } = require('../../../packages/core/src/unitOfWork.js');
const { executeQuery } = require('../../database.js');

async function listDepartments(req, res) {
  try {
    const withArchived = req.query.withArchived === 'true';
    const rows = await departmentsRepository.list({ withArchived, orderBy: 'name ASC' });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getDepartment(req, res) {
  try {
    const { id } = req.params;
    const withArchived = req.query.withArchived === 'true';
    const row = await departmentsRepository.get(id, { withArchived });
    if (!row) {
      return res.status(404).json({ error: 'القسم غير موجود' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createDepartment(req, res) {
  try {
    const { name, code } = req.body;
    const created = await departmentsRepository.create(
      { name, code },
      { userId: req.user?.id }
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateDepartment(req, res) {
  try {
    const { id } = req.params;
    const { name, code } = req.body;
    const updated = await departmentsRepository.update(
      id,
      { name, code },
      { userId: req.user?.id }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteDepartment(req, res) {
  try {
    const { id } = req.params;
    const result = await departmentsRepository.archive(id, { userId: req.user?.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function archiveCascadeDepartment(req, res) {
  try {
    const { id } = req.params;
    const result = await unitOfWork(async (uow) => {
      const [dept] = await uow.query('SELECT * FROM departments WHERE id = $1', [id]);
      if (!dept) throw new Error(`القسم رقم #${id} غير موجود`);

      await uow.query('UPDATE departments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      await uow.query('UPDATE courses SET deleted_at = CURRENT_TIMESTAMP WHERE department_id = $1 AND deleted_at IS NULL', [id]);
      await uow.query('UPDATE groups SET deleted_at = CURRENT_TIMESTAMP WHERE department_id = $1 AND deleted_at IS NULL', [id]);

      await uow.recordChange({
        entity_type: 'departments',
        entity_id: id,
        action: 'archive',
        before_state: dept,
        after_state: { ...dept, deleted_at: new Date().toISOString() },
        changed_by: req.user?.id
      });

      return { success: true, departmentId: id, message: 'تم أرشفة القسم والمقاييس والأفواج التابعة بنجاح' };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  archiveCascadeDepartment
};

