const bcrypt = require('bcrypt');
const { executeQuery } = require('../../database.js');
const { unitOfWork } = require('../../../packages/core/src/unitOfWork.js');
const { professorsRepository } = require('../../../packages/core/src/repositories/index.js');

async function listUsers(req, res) {
  try {
    const rows = await executeQuery(
      'SELECT id, username, full_name, email, role, professor_id, is_active, last_login, created_at FROM users ORDER BY username'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getUser(req, res) {
  try {
    const { id } = req.params;
    const rows = await executeQuery(
      'SELECT id, username, full_name, email, role, professor_id, is_active, last_login, created_at FROM users WHERE id = $1 LIMIT 1',
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createUser(req, res) {
  try {
    const { username, password, full_name, email, role, professor_id } = req.body;
    const password_hash = await bcrypt.hash(password, 10);

    const [created] = await executeQuery(
      `INSERT INTO users (username, password_hash, full_name, email, role, professor_id, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, CURRENT_TIMESTAMP)
       RETURNING id, username, full_name, email, role, professor_id, is_active, created_at`,
      [username, password_hash, full_name || null, email || null, role || 'staff', professor_id || null]
    );

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createUserWithProfessor(req, res) {
  try {
    const { username, password, full_name, email, role, professorData } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await unitOfWork(async (uow) => {
      const profName = professorData?.name || full_name || username;
      const profEmail = professorData?.email || email || null;

      const createdProf = await professorsRepository.create(
        {
          name: profName,
          email: profEmail,
          phone: professorData?.phone || null,
          title: professorData?.title || null,
          academic_title: professorData?.academic_title || null
        },
        { uow, userId: req.user?.id }
      );

      const [newUser] = await uow.query(
        `INSERT INTO users (username, password_hash, full_name, email, role, professor_id, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 1, CURRENT_TIMESTAMP)
         RETURNING id, username, full_name, email, role, professor_id, is_active, created_at`,
        [username, password_hash, full_name || profName, email || profEmail, role || 'staff', createdProf.id]
      );

      await uow.recordChange({
        entity_type: 'users',
        entity_id: newUser.id,
        action: 'create',
        after_state: { user: newUser, professor: createdProf },
        changed_by: req.user?.id
      });

      return { user: newUser, professor: createdProf };
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { username, full_name, email, role, professor_id, is_active, password } = req.body;

    const existing = await executeQuery('SELECT * FROM users WHERE id = $1', [id]);
    if (!existing || !existing[0]) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    const cur = existing[0];

    let passwordHash = cur.password_hash;
    if (password && typeof password === 'string' && password.trim()) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const [updated] = await executeQuery(
      `UPDATE users
       SET username = $1, full_name = $2, email = $3, role = $4, professor_id = $5, is_active = $6, password_hash = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING id, username, full_name, email, role, professor_id, is_active, created_at, updated_at`,
      [
        username !== undefined ? username : cur.username,
        full_name !== undefined ? full_name : cur.full_name,
        email !== undefined ? email : cur.email,
        role !== undefined ? role : cur.role,
        professor_id !== undefined ? professor_id : cur.professor_id,
        is_active !== undefined ? is_active : cur.is_active,
        passwordHash,
        id
      ]
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    await executeQuery('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getUserPermissions(req, res) {
  try {
    const { id } = req.params;
    const rows = await executeQuery('SELECT permissions FROM users WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'المستخدم غير موجود' });
    let perms = [];
    try {
      perms = rows[0].permissions ? JSON.parse(rows[0].permissions) : [];
    } catch (_) {}
    res.json({ permissions: perms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateUserPermissions(req, res) {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    const permStr = JSON.stringify(Array.isArray(permissions) ? permissions : []);
    await executeQuery('UPDATE users SET permissions = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [permStr, id]);
    res.json({ success: true, permissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  createUserWithProfessor,
  updateUser,
  deleteUser,
  getUserPermissions,
  updateUserPermissions
};

