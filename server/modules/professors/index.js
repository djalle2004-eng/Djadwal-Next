const { professorsRepository } = require('../../../packages/core/src/repositories/index.js');
const { unitOfWork } = require('../../../packages/core/src/unitOfWork.js');

async function listProfessors(req, res) {
  try {
    const withArchived = req.query.withArchived === 'true';
    const rows = await professorsRepository.list({ withArchived, orderBy: 'name ASC' });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getProfessor(req, res) {
  try {
    const { id } = req.params;
    const withArchived = req.query.withArchived === 'true';
    const row = await professorsRepository.get(id, { withArchived });
    if (!row) {
      return res.status(404).json({ error: 'الأستاذ غير موجود' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createProfessor(req, res) {
  try {
    const { name, email, phone, title, academic_title } = req.body;
    const created = await professorsRepository.create(
      { name, email, phone, title, academic_title },
      { userId: req.user?.id }
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateProfessor(req, res) {
  try {
    const { id } = req.params;
    const { name, email, phone, title, academic_title, version } = req.body;
    const updated = await professorsRepository.update(
      id,
      { name, email, phone, title, academic_title },
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

async function deleteProfessor(req, res) {
  try {
    const { id } = req.params;
    const result = await professorsRepository.archive(id, { userId: req.user?.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function restoreProfessor(req, res) {
  try {
    const { id } = req.params;
    const result = await professorsRepository.restore(id, { userId: req.user?.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function bulkImportProfessors(req, res) {
  try {
    const { professors: profList } = req.body;
    if (!Array.isArray(profList) || profList.length === 0) {
      return res.status(400).json({ error: 'قائمة الأساتذة فارغة' });
    }

    const inserted = await unitOfWork(async (uow) => {
      const results = [];
      for (const p of profList) {
        if (!p.name || !p.name.trim()) {
          throw new Error('اسم الأستاذ حقل إجباري لجميع السجلات');
        }
        const created = await professorsRepository.create(
          {
            name: p.name.trim(),
            email: p.email || null,
            phone: p.phone || null,
            title: p.title || null,
            academic_title: p.academic_title || null
          },
          { uow, userId: req.user?.id }
        );
        results.push(created);
      }
      return results;
    });

    res.json({ success: true, count: inserted.length, professors: inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listProfessors,
  getProfessor,
  createProfessor,
  updateProfessor,
  deleteProfessor,
  restoreProfessor,
  bulkImportProfessors
};

