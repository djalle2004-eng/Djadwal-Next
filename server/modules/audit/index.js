const crypto = require('crypto');
const { changeLogRepository, calculateDeleteImpact } = require('../../../packages/core/src/repositories/index.js');
const { unitOfWork } = require('../../../packages/core/src/unitOfWork.js');
const { executeQuery } = require('../../database.js');
const auditService = require('../../services/audit.js');

const PRIMARY_JWT_RAW = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

async function listChanges(req, res) {
  try {
    const limit = Number(req.query.limit || 50);
    const { entityType, entityId } = req.query;
    const rows = await changeLogRepository.getRecent(limit, entityType, entityId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function undoChange(req, res) {
  try {
    const { id } = req.params;
    const result = await unitOfWork(async (uow) => {
      return await changeLogRepository.undo(Number(id), {
        uow,
        userId: req.user?.id
      });
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getDeleteImpact(req, res) {
  try {
    const { entity, id } = req.params;
    const result = await calculateDeleteImpact(entity, id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listAuditLogs(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const rows = await executeQuery('SELECT * FROM audit_log ORDER BY id DESC LIMIT $1', [limit]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createAuditLog(req, res) {
  try {
    const { action, entity_type, entity_id, details } = req.body;
    await auditService.logAudit(req, { action, entity_type, entity_id, details });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function generateExportUrl(req, res) {
  try {
    const { format = 'jsonl' } = req.body || {};
    const expiresInSeconds = 300;
    const expires = Date.now() + expiresInSeconds * 1000;
    const sig = crypto
      .createHmac('sha256', PRIMARY_JWT_RAW)
      .update(`${expires}:${format}`)
      .digest('hex');

    const downloadUrl = `/api/audit-logs/export?format=${encodeURIComponent(format)}&expires=${expires}&sig=${sig}`;
    res.json({
      downloadUrl,
      expiresInSeconds,
      expiresAt: new Date(expires).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function exportAuditLogs(req, res) {
  try {
    const { format = 'jsonl', expires, sig, limit = 5000 } = req.query;
    let isAuthorized = false;

    if (sig && expires) {
      const exp = parseInt(expires, 10);
      if (Date.now() <= exp) {
        const expectedSig = crypto
          .createHmac('sha256', PRIMARY_JWT_RAW)
          .update(`${expires}:${format}`)
          .digest('hex');
        if (sig === expectedSig) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      const token = req.cookies?.['__Host-token'] || 
                    req.cookies?.token || 
                    (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/, ''));
      if (token) {
        const { jwtVerify } = require('jose');
        const JWT_SECRET = new TextEncoder().encode(PRIMARY_JWT_RAW);
        try {
          const { payload } = await jwtVerify(token, JWT_SECRET);
          if (payload && String(payload.role).toLowerCase() === 'admin') {
            isAuthorized = true;
            req.user = payload;
          }
        } catch (_) {}
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'غير مصرح لك بتصدير سجلات التدقيق'
      });
    }

    const maxRows = Math.min(parseInt(limit, 10) || 5000, 10000);
    const rows = await executeQuery(
      `SELECT al.*, u.full_name as user_name
       FROM audit_log al 
       LEFT JOIN users u ON al.user_id = u.id 
       ORDER BY al.id ASC LIMIT $1`,
      [maxRows]
    );

    const verifyResult = await auditService.verifyAuditChain();
    const chainStatus = verifyResult.valid ? 'verified' : 'tampered';
    const headHash = verifyResult.headHash || 'genesis';

    res.setHeader('X-Audit-Chain-Status', chainStatus);
    res.setHeader('X-Audit-Head-Hash', headHash);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-export-${Date.now()}.csv"`);
      
      const headers = ['id', 'created_at', 'user_id', 'user_name', 'action', 'entity_type', 'entity_id', 'details', 'ip_address', 'prev_hash', 'row_hash', 'claimed_by'];
      const escapeCsv = (v) => {
        if (v === null || v === undefined) return '';
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      
      let csv = headers.join(',') + '\n';
      for (const r of rows) {
        csv += headers.map(h => escapeCsv(r[h])).join(',') + '\n';
      }
      return res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-export-${Date.now()}.jsonl"`);

      let output = '';
      for (const r of rows) {
        output += JSON.stringify(r) + '\n';
      }
      return res.send(output);
    }
  } catch (exportErr) {
    console.error('Audit export error:', exportErr);
    res.status(500).json({ error: exportErr.message });
  }
}

module.exports = {
  listChanges,
  undoChange,
  getDeleteImpact,
  listAuditLogs,
  createAuditLog,
  generateExportUrl,
  exportAuditLogs
};

