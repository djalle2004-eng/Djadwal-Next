const { executeQuery } = require('../../database.js');

async function getAppConfig(req, res) {
  try {
    const rows = await executeQuery('SELECT * FROM app_config');
    const config = {};
    for (const r of rows) config[r.key] = r.value;
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateAppConfig(req, res) {
  try {
    const { key, value } = req.body;
    await executeQuery(
      'INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, String(value)]
    );
    res.json({ success: true, key, value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getPrintSettings(req, res) {
  try {
    const rows = await executeQuery('SELECT setting_key, setting_value FROM print_settings');
    const settings = {};
    for (const r of rows) settings[r.setting_key] = r.setting_value;
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updatePrintSettings(req, res) {
  try {
    const settings = req.body?.settings || req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'الإعدادات غير صالحة' });
    }
    for (const [k, v] of Object.entries(settings)) {
      await executeQuery(
        'INSERT INTO print_settings (setting_key, setting_value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP',
        [k, String(v)]
      );
    }
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function exportData(req, res) {
  try {
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {}
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getEmailSettings(req, res) {
  try {
    const rows = await executeQuery('SELECT app_email, is_authenticated, last_auth_date FROM email_settings LIMIT 1');
    res.json(rows[0] || { app_email: '', is_authenticated: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listSnapshots(req, res) {
  try {
    const rows = await executeQuery('SELECT id, name, created_at FROM sandbox_snapshots ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createSnapshot(req, res) {
  try {
    const { name, data } = req.body;
    const [created] = await executeQuery(
      'INSERT INTO sandbox_snapshots (name, data, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING id, name, created_at',
      [name || 'Snapshot', typeof data === 'object' ? JSON.stringify(data) : String(data || '{}')]
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAppConfig,
  updateAppConfig,
  getPrintSettings,
  updatePrintSettings,
  getEmailSettings,
  listSnapshots,
  createSnapshot,
  exportData
};

