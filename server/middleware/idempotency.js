const crypto = require('crypto');
const { executeQuery } = require('../database.js');
const { formatV1Error } = require('../../packages/core/src/api-schema.js');

function computeRequestHash(req) {
  const parts = [
    req.method.toUpperCase(),
    req.originalUrl || req.url,
    JSON.stringify(req.body || {})
  ];
  return crypto.createHash('sha256').update(parts.join('::')).digest('hex');
}

/**
 * Idempotency Middleware for write operations.
 * Caches and replays identical write responses, preventing duplicate records.
 */
function idempotencyMiddleware() {
  return async (req, res, next) => {
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
    const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    if (!isWrite || !rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
      return next();
    }

    const key = rawKey.trim();
    const requestHash = computeRequestHash(req);

    try {
      // 1. Check if key exists in idempotency_keys table
      const rows = await executeQuery('SELECT * FROM idempotency_keys WHERE key = $1 LIMIT 1', [key]);

      if (rows && rows.length > 0) {
        const existing = rows[0];
        const isExpired = new Date(existing.expires_at).getTime() < Date.now();

        if (isExpired) {
          await executeQuery('DELETE FROM idempotency_keys WHERE key = $1', [key]);
        } else {
          // Verify hash
          if (existing.request_hash === requestHash) {
            res.setHeader('Idempotency-Replay', 'true');
            let parsedBody = existing.response_body;
            try {
              if (typeof existing.response_body === 'string') {
                parsedBody = JSON.parse(existing.response_body);
              }
            } catch (_) {}
            return res.status(existing.status_code).json(parsedBody);
          } else {
            // Mismatch: same key reused for a different payload
            return res.status(422).json(
              formatV1Error(
                'IDEMPOTENCY_PAYLOAD_MISMATCH',
                'تم استخدام مفتاح عدم التكرار (Idempotency-Key) مسبقًا مع حمولة طلب مختلفة.',
                req.traceId || 'unknown'
              )
            );
          }
        }
      }

      // 2. Intercept response to capture and store once executed
      const originalJson = res.json.bind(res);
      let isSaved = false;

      res.json = async function (body) {
        if (!isSaved) {
          isSaved = true;
          try {
            await saveIdempotency(key, req, res.statusCode, body);
          } catch (err) {
            console.warn('⚠️ Warning: Failed to save idempotency key:', err.message);
          }
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.error('Idempotency middleware error:', err);
      next();
    }
  };
}

async function saveIdempotency(key, req, statusCode, responseBody) {
  const requestHash = computeRequestHash(req);
  const path = req.originalUrl || req.url;
  const method = req.method.toUpperCase();
  const bodyStr = typeof responseBody === 'object' ? JSON.stringify(responseBody) : String(responseBody);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours TTL

  await executeQuery(
    `INSERT INTO idempotency_keys (key, method, path, request_hash, status_code, response_body, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7)
     ON CONFLICT (key) DO UPDATE
     SET status_code = EXCLUDED.status_code, response_body = EXCLUDED.response_body, expires_at = EXCLUDED.expires_at`,
    [key, method, path, requestHash, statusCode, bodyStr, expiresAt]
  );
}

module.exports = {
  idempotencyMiddleware
};
