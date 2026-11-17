const { professorsRepository, professorAcademicProfilesRepository } = require('../../../packages/core/src/repositories/index.js');
const { unitOfWork } = require('../../../packages/core/src/unitOfWork.js');
const { executeQuery } = require('../../database.js');
const XLSX = require('xlsx');
const {
  OFFICIAL_ACADEMIC_RANKS,
  normalizeAcademicRank,
  getRankDefinition
} = require('../../../packages/core/src/constants/professor-ranks.js');
const {
  dryRunProfessorsImport,
  buildProfessorsExportWorkbook,
  buildProfessorsTemplateWorkbook,
  parseIsTemporary
} = require('../../../packages/core/src/excel/professor-excel.js');

async function listProfessors(req, res) {
  try {
    const withArchived = req.query.withArchived === 'true';
    const { academicYear, isTemporary, rank } = req.query;

    const whereClauses = [];
    const params = [];
    let idx = 1;

    if (!withArchived) {
      whereClauses.push('p.deleted_at IS NULL');
    }

    if (isTemporary !== undefined && isTemporary !== '') {
      const isTemp = isTemporary === 'true' || isTemporary === '1';
      whereClauses.push(`COALESCE(pap.is_temporary, p.is_temporary) = $${idx++}`);
      params.push(isTemp);
    }

    if (rank) {
      const normalizedRank = normalizeAcademicRank(rank);
      whereClauses.push(`COALESCE(pap.academic_rank, p.academic_rank) = $${idx++}`);
      params.push(normalizedRank);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // If an academicYear is specified, join historical profile for that specific season!
    let joinYearClause = '';
    if (academicYear) {
      joinYearClause = `LEFT JOIN professor_academic_profiles pap ON p.id = pap.professor_id AND pap.academic_year = $${idx++}`;
      params.push(academicYear);
    } else {
      joinYearClause = `LEFT JOIN (
        SELECT pap1.professor_id, pap1.academic_rank, pap1.is_temporary, pap1.academic_year
        FROM professor_academic_profiles pap1
        INNER JOIN (
          SELECT professor_id, MAX(created_at) as max_created
          FROM professor_academic_profiles
          GROUP BY professor_id
        ) pap2 ON pap1.professor_id = pap2.professor_id AND pap1.created_at = pap2.max_created
      ) pap ON p.id = pap.professor_id`;
    }

    const sql = `
      SELECT p.*,
             COALESCE(pap.academic_rank, p.academic_rank, 'assistant_professor') as effective_rank,
             COALESCE(pap.is_temporary, p.is_temporary, false) as effective_is_temporary,
             pap.academic_year as profile_season
      FROM professors p
      ${joinYearClause}
      ${whereStr}
      ORDER BY p.name ASC
    `;

    let rows;
    try {
      rows = await executeQuery(sql, params);
    } catch (queryErr) {
      console.warn('[Professors] Enriched query failed, falling back to basic professors query:', queryErr.message);
      // Fallback in case table or join has transient issue
      const fallbackWhere = whereClauses
        .map(w => w.replace(/COALESCE\(pap\.[^,]+,\s*(p\.[^)]+)\)/g, '$1'))
        .join(' AND ');
      const fallbackParams = academicYear ? params.slice(0, params.length - 1) : params;
      const fallbackSql = `SELECT p.*, p.academic_rank as effective_rank, p.is_temporary as effective_is_temporary FROM professors p ${fallbackWhere ? `WHERE ${fallbackWhere}` : ''} ORDER BY p.name ASC`;
      rows = await executeQuery(fallbackSql, fallbackParams);
    }

    // Format with official Arabic rank labels
    const enriched = rows.map(r => {
      const normRank = normalizeAcademicRank(r.effective_rank || r.title);
      const def = getRankDefinition(normRank);
      return {
        ...r,
        academic_rank: normRank,
        rank_label_arabic: def.labelArabic,
        is_temporary: Boolean(r.effective_is_temporary)
      };
    });

    res.json(enriched);
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

    const normRank = normalizeAcademicRank(row.academic_rank || row.title);
    const def = getRankDefinition(normRank);

    res.json({
      ...row,
      academic_rank: normRank,
      rank_label_arabic: def.labelArabic,
      is_temporary: Boolean(row.is_temporary)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createProfessor(req, res) {
  try {
    const { name, email, phone, title, academic_title, academic_rank, is_temporary, academic_year } = req.body;
    const normRank = normalizeAcademicRank(academic_rank || title);
    const def = getRankDefinition(normRank);
    const finalIsTemporary = is_temporary !== undefined ? Boolean(is_temporary) : def.isTemporary;

    const created = await professorsRepository.create(
      {
        name,
        email,
        phone,
        title: title || def.labelArabic,
        academic_title: academic_title || def.labelArabic,
        academic_rank: normRank,
        is_temporary: finalIsTemporary
      },
      { userId: req.user?.id }
    );

    // If an academic_year was specified, record historical snapshot
    if (academic_year && created?.id) {
      await recordHistoricalProfile(created.id, academic_year, normRank, finalIsTemporary);
    }

    res.status(201).json({
      ...created,
      academic_rank: normRank,
      rank_label_arabic: def.labelArabic,
      is_temporary: finalIsTemporary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateProfessor(req, res) {
  try {
    const { id } = req.params;
    const { name, email, phone, title, academic_title, academic_rank, is_temporary, academic_year, version } = req.body;

    const updatePayload = {};
    if (name !== undefined) updatePayload.name = name;
    if (email !== undefined) updatePayload.email = email;
    if (phone !== undefined) updatePayload.phone = phone;

    let normRank;
    if (academic_rank !== undefined || title !== undefined) {
      normRank = normalizeAcademicRank(academic_rank || title);
      const def = getRankDefinition(normRank);
      updatePayload.academic_rank = normRank;
      updatePayload.title = title || def.labelArabic;
      updatePayload.academic_title = academic_title || def.labelArabic;
      if (is_temporary === undefined) {
        updatePayload.is_temporary = def.isTemporary;
      }
    }

    if (is_temporary !== undefined) {
      updatePayload.is_temporary = Boolean(is_temporary);
    }

    const updated = await professorsRepository.update(
      id,
      updatePayload,
      { expectedVersion: version !== undefined ? Number(version) : undefined, userId: req.user?.id }
    );

    // If academic_year is provided, upsert seasonal snapshot
    if (academic_year && normRank) {
      const finalTemp = updatePayload.is_temporary !== undefined ? updatePayload.is_temporary : false;
      await recordHistoricalProfile(id, academic_year, normRank, finalTemp);
    }

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

async function getProfessorHistory(req, res) {
  try {
    const { id } = req.params;
    const rows = await executeQuery(`
      SELECT pap.*, ay.year_name
      FROM professor_academic_profiles pap
      LEFT JOIN academic_years ay ON pap.academic_year_id = ay.id
      WHERE pap.professor_id = $1
      ORDER BY pap.academic_year DESC
    `, [Number(id)]);

    const enriched = rows.map(r => {
      const def = getRankDefinition(r.academic_rank);
      return {
        ...r,
        rank_label_arabic: def.labelArabic,
        is_temporary: Boolean(r.is_temporary)
      };
    });

    res.json({
      professorId: Number(id),
      history: enriched
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function recordProfessorHistoryEndpoint(req, res) {
  try {
    const { id } = req.params;
    const { academic_year, academic_rank, is_temporary, department, notes } = req.body;

    const normRank = normalizeAcademicRank(academic_rank);
    const def = getRankDefinition(normRank);
    const finalTemp = is_temporary !== undefined ? Boolean(is_temporary) : def.isTemporary;

    const profile = await recordHistoricalProfile(
      id,
      academic_year,
      normRank,
      finalTemp,
      department,
      notes
    );

    res.status(201).json({
      success: true,
      profile
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getRanksList(req, res) {
  res.json({
    ranks: OFFICIAL_ACADEMIC_RANKS
  });
}

async function recordHistoricalProfile(profId, academicYear, rank, isTemp, department = '', notes = '', context = {}) {
  // Upsert into professor_academic_profiles
  const def = getRankDefinition(rank);
  const sql = `
    INSERT INTO professor_academic_profiles (
      professor_id, academic_year, academic_rank, is_temporary, weekly_statutory_quota, department, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (professor_id, academic_year) DO UPDATE
    SET academic_rank = EXCLUDED.academic_rank,
        is_temporary = EXCLUDED.is_temporary,
        weekly_statutory_quota = EXCLUDED.weekly_statutory_quota,
        department = COALESCE(EXCLUDED.department, professor_academic_profiles.department),
        notes = COALESCE(EXCLUDED.notes, professor_academic_profiles.notes),
        updated_at = now()
    RETURNING *
  `;
  const params = [
    Number(profId),
    academicYear,
    rank,
    Boolean(isTemp),
    Math.round(def.statutoryQuotaHours || 0),
    department || '',
    notes || ''
  ];

  if (context.uow) {
    const res = await context.uow.query(sql, params);
    return res.rows ? res.rows[0] : res[0];
  }

  const rows = await executeQuery(sql, params);
  return rows[0];
}

/**
 * P15: Export professors to formatted .xlsx file
 */
async function exportProfessorsExcel(req, res) {
  try {
    const withArchived = req.query.withArchived === 'true';
    const whereClauses = [];
    if (!withArchived) {
      whereClauses.push('deleted_at IS NULL');
    }
    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = await executeQuery(`SELECT * FROM professors ${whereStr} ORDER BY name ASC`);
    const wb = buildProfessorsExportWorkbook(rows);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `professors-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[ExportProfessorsExcel] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * P15: Download blank template for professor import
 */
async function downloadProfessorsTemplate(req, res) {
  try {
    const wb = buildProfessorsTemplateWorkbook();
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="professors-template.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('[DownloadProfessorsTemplate] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * P15: Dry-Run preview for professor Excel import
 */
async function previewProfessorsImport(req, res) {
  try {
    if (process.env.FEATURE_PROFESSOR_EXCEL_IMPORT_EXPORT === 'false') {
      return res.status(403).json({
        error: {
          code: 'FEATURE_DISABLED',
          message_ar: 'ميزة استيراد وتصدير الأساتذة عبر Excel معطلة حالياً عبر إعدادات البيئة.'
        }
      });
    }

    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'لم يتم إرسال أي صفوف صالحة للمعاينة' });
    }

    const existing = await executeQuery('SELECT * FROM professors WHERE deleted_at IS NULL');
    const dryRun = dryRunProfessorsImport(rows, existing);

    res.json({
      success: true,
      ...dryRun
    });
  } catch (err) {
    console.error('[PreviewProfessorsImport] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * P15: Atomic commit for professor Excel import via UnitOfWork
 */
async function commitProfessorsImport(req, res) {
  try {
    if (process.env.FEATURE_PROFESSOR_EXCEL_IMPORT_EXPORT === 'false') {
      return res.status(403).json({
        error: {
          code: 'FEATURE_DISABLED',
          message_ar: 'ميزة استيراد وتصدير الأساتذة عبر Excel معطلة حالياً عبر إعدادات البيئة.'
        }
      });
    }

    const { rows, skipErrors = false, academicYear = '2026-2027' } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'قائمة الأساتذة فارغة' });
    }

    const importStats = await unitOfWork(async (uow) => {
      // 1. Fetch active professors inside the unit of work transaction
      const existingRes = await uow.query('SELECT * FROM professors WHERE deleted_at IS NULL');
      const existing = existingRes.rows || existingRes;

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const item of rows) {
        if (!item || !item.name || !item.name.trim()) {
          skippedCount++;
          continue;
        }

        if (item.action === 'unchanged' || item.action === 'error') {
          skippedCount++;
          continue;
        }

        const normRank = normalizeAcademicRank(item.academic_rank || item.title);
        const rankDef = getRankDefinition(normRank);
        const isTemp = parseIsTemporary(item.is_temporary, rankDef.isTemporary || normRank === 'temporary');

        const profPayload = {
          name: item.name.trim(),
          email: item.email && item.email.trim() ? item.email.trim() : null,
          phone: item.phone && item.phone.trim() ? item.phone.trim() : null,
          title: item.rank_label_arabic || rankDef.labelArabic,
          academic_title: item.rank_label_arabic || rankDef.labelArabic,
          academic_rank: normRank,
          is_temporary: isTemp,
          department: item.department && item.department.trim() ? item.department.trim() : null,
          phd_specialization: item.specialization && item.specialization.trim() ? item.specialization.trim() : null,
          full_name_arabic: item.name.trim(),
          professional_email: item.email && item.email.trim() ? item.email.trim() : null,
          primary_phone: item.phone && item.phone.trim() ? item.phone.trim() : null
        };

        // Determine if updating or creating
        let targetId = item.id ? Number(item.id) : null;
        if (!targetId && item.email && item.email.trim()) {
          const match = existing.find(p => p.email && p.email.trim().toLowerCase() === item.email.trim().toLowerCase());
          if (match) targetId = match.id;
        }
        if (!targetId && item.name && item.name.trim()) {
          const match = existing.find(p => p.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase());
          if (match) targetId = match.id;
        }

        if (targetId) {
          await professorsRepository.update(targetId, profPayload, { uow, userId: req.user?.id });
          if (academicYear) {
            await recordHistoricalProfile(
              targetId,
              academicYear,
              normRank,
              isTemp,
              profPayload.department || '',
              'تحديث جماعي عبر ملف Excel',
              { uow }
            );
          }
          updatedCount++;
        } else {
          const created = await professorsRepository.create(profPayload, { uow, userId: req.user?.id });
          if (academicYear && created?.id) {
            await recordHistoricalProfile(
              created.id,
              academicYear,
              normRank,
              isTemp,
              profPayload.department || '',
              'استيراد جماعي عبر ملف Excel',
              { uow }
            );
          }
          createdCount++;
        }
      }

      return {
        createdCount,
        updatedCount,
        skippedCount,
        totalProcessed: createdCount + updatedCount
      };
    });

    res.json({
      success: true,
      message_ar: `تم استيراد ${importStats.createdCount} أستاذ جديد وتحديث ${importStats.updatedCount} بنجاح.`,
      ...importStats
    });
  } catch (err) {
    console.error('[CommitProfessorsImport] Error:', err);
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
        const normRank = normalizeAcademicRank(p.academic_rank || p.title);
        const def = getRankDefinition(normRank);
        const isTemp = p.is_temporary !== undefined ? Boolean(p.is_temporary) : def.isTemporary;

        const created = await professorsRepository.create(
          {
            name: p.name.trim(),
            email: p.email || null,
            phone: p.phone || null,
            title: p.title || def.labelArabic,
            academic_title: p.academic_title || def.labelArabic,
            academic_rank: normRank,
            is_temporary: isTemp
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
  getProfessorHistory,
  recordProfessorHistoryEndpoint,
  getRanksList,
  bulkImportProfessors,
  exportProfessorsExcel,
  downloadProfessorsTemplate,
  previewProfessorsImport,
  commitProfessorsImport
};
