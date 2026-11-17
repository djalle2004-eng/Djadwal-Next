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

const DEFAULT_PRINT_SETTINGS = {
  republic_name_ar: 'الجمهورية الجزائرية الديمقراطية الشعبية',
  ministry_name_ar: 'وزارة التعليم العالي والبحث العلمي',
  university_name_ar: 'جامعة الشهيد حمه لخضر - الوادي',
  faculty_name_ar: 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير',
  department_name_ar: 'قسم التدريس والبرمجة البيداغوجية',
  deanery_name_ar: 'نيابة العمادة للدراسات والمسائل المرتبطة بالطلبة',
  service_name_ar: 'مصلحة التدريس',
  reference_number_format: '2027-2026 / ك ع ا . ت. ع. ت / ن. ع. م. د / م ت',
  city_name_ar: 'الوادي',
  university_logo_url: '',
  faculty_logo_url: '',
  enable_watermark: true,
  watermark_opacity: 0.08,
  logo_size: 80,
  schedule_officer_title: 'مسؤول التوقيت والبرمجة',
  schedule_officer_name: 'أ. د. بلقاسم',
  department_head_title: 'رئيس القسم',
  department_head_name: 'د. لخضر',
  vice_dean_title: 'نائب العميد المكلف بالدراسات والمسائل المرتبطة بالطلبة',
  vice_dean_name: 'أ. د. محمد',
  custom_footer_ar: 'ملاحظة: يرجى من جميع الأساتذة والطلبة الالتزام بالقاعات والأوقات المحددة رسمياً.',
  exam_disclaimer_ar: 'ملاحظة: الغياب عن الفرض المحروس يترتب عليه علامة صفر ولا يعاد إلا بمبرر قانوني',
  page_size: 'A4',
  orientation: 'landscape',
  font_size: 10,
  header_font_size: 14,
  title_font_size: 16,
  show_colors: true,
  show_print_date: true,
  show_page_numbers: false,
  table_border_width: 1
};

async function getPrintSettings(req, res) {
  try {
    const rows = await executeQuery('SELECT * FROM print_settings WHERE id = 1 LIMIT 1');
    if (rows && rows.length > 0) {
      res.json({
        ...DEFAULT_PRINT_SETTINGS,
        ...rows[0]
      });
    } else {
      res.json(DEFAULT_PRINT_SETTINGS);
    }
  } catch (err) {
    // Return defaults if table is not yet initialized
    res.json(DEFAULT_PRINT_SETTINGS);
  }
}

async function updatePrintSettings(req, res) {
  try {
    const b = req.body || {};
    const existing = await executeQuery('SELECT id FROM print_settings WHERE id = 1 LIMIT 1').catch(() => []);

    if (existing && existing.length > 0) {
      const sql = `
        UPDATE print_settings
        SET republic_name_ar = COALESCE($1, republic_name_ar),
            ministry_name_ar = COALESCE($2, ministry_name_ar),
            university_name_ar = COALESCE($3, university_name_ar),
            faculty_name_ar = COALESCE($4, faculty_name_ar),
            university_logo_url = COALESCE($5, university_logo_url),
            faculty_logo_url = COALESCE($6, faculty_logo_url),
            custom_footer_ar = COALESCE($7, custom_footer_ar),
            exam_disclaimer_ar = COALESCE($8, exam_disclaimer_ar),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        RETURNING *
      `;
      const [updated] = await executeQuery(sql, [
        b.republic_name_ar,
        b.ministry_name_ar,
        b.university_name_ar,
        b.faculty_name_ar,
        b.university_logo_url,
        b.faculty_logo_url,
        b.custom_footer_ar,
        b.exam_disclaimer_ar
      ]);
      res.json({ ...DEFAULT_PRINT_SETTINGS, ...b, ...(updated || {}) });
    } else {
      const sql = `
        INSERT INTO print_settings (id, republic_name_ar, ministry_name_ar, university_name_ar, faculty_name_ar, university_logo_url, faculty_logo_url, custom_footer_ar, exam_disclaimer_ar)
        VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const [created] = await executeQuery(sql, [
        b.republic_name_ar || DEFAULT_PRINT_SETTINGS.republic_name_ar,
        b.ministry_name_ar || DEFAULT_PRINT_SETTINGS.ministry_name_ar,
        b.university_name_ar || DEFAULT_PRINT_SETTINGS.university_name_ar,
        b.faculty_name_ar || DEFAULT_PRINT_SETTINGS.faculty_name_ar,
        b.university_logo_url || null,
        b.faculty_logo_url || null,
        b.custom_footer_ar || DEFAULT_PRINT_SETTINGS.custom_footer_ar,
        b.exam_disclaimer_ar || DEFAULT_PRINT_SETTINGS.exam_disclaimer_ar
      ]);
      res.json({ ...DEFAULT_PRINT_SETTINGS, ...b, ...(created || {}) });
    }
  } catch (err) {
    console.error('updatePrintSettings error:', err);
    // Still return accepted payload so client can store locally
    res.json({ ...DEFAULT_PRINT_SETTINGS, ...req.body, updated_local_only: true });
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

async function getSnapshot(req, res) {
  try {
    const { id } = req.params;
    const [row] = await executeQuery('SELECT id, name, data, created_at FROM sandbox_snapshots WHERE id = $1', [id]);
    if (!row) {
      return res.status(404).json({ error: 'المسودة غير موجودة' });
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteSnapshot(req, res) {
  try {
    const { id } = req.params;
    await executeQuery('DELETE FROM sandbox_snapshots WHERE id = $1', [id]);
    res.json({ success: true, message: 'تم حذف المسودة بنجاح' });
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
  getSnapshot,
  deleteSnapshot,
  exportData,
  DEFAULT_PRINT_SETTINGS
};
