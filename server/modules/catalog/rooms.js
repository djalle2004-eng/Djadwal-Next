const { roomsRepository } = require('../../../packages/core/src/repositories/index.js');

async function listRooms(req, res) {
  try {
    const withArchived = req.query.withArchived === 'true';
    const rows = await roomsRepository.list({ withArchived, orderBy: 'name ASC' });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getRoom(req, res) {
  try {
    const { id } = req.params;
    const withArchived = req.query.withArchived === 'true';
    const row = await roomsRepository.get(id, { withArchived });
    if (!row) {
      return res.status(404).json({ error: 'القاعة غير موجودة' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createRoom(req, res) {
  try {
    const { name, capacity } = req.body;
    const created = await roomsRepository.create(
      { name, capacity: Number(capacity || 0) },
      { userId: req.user?.id }
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateRoom(req, res) {
  try {
    const { id } = req.params;
    const { name, capacity, version } = req.body;
    const updated = await roomsRepository.update(
      id,
      { name, capacity: capacity !== undefined ? Number(capacity) : undefined },
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

async function deleteRoom(req, res) {
  try {
    const { id } = req.params;
    const result = await roomsRepository.archive(id, { userId: req.user?.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function restoreRoom(req, res) {
  try {
    const { id } = req.params;
    const result = await roomsRepository.restore(id, { userId: req.user?.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  restoreRoom
};

