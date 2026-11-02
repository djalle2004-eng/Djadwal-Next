const { executeQuery } = require('../database.js');

const inMemoryRouteConfig = new Map();

function getRouteMode(routeName) {
  const envKey = `ROUTE_${routeName.toUpperCase()}`;
  if (inMemoryRouteConfig.has(routeName)) {
    return inMemoryRouteConfig.get(routeName);
  }
  if (process.env[envKey]) {
    return process.env[envKey].toLowerCase();
  }
  return (process.env.API_ROUTING_DEFAULT || 'legacy').toLowerCase();
}

function reloadRoutingConfig(overrides = {}) {
  inMemoryRouteConfig.clear();
  for (const [key, val] of Object.entries(overrides)) {
    inMemoryRouteConfig.set(key, String(val).toLowerCase());
  }
}

function getRoutingConfig() {
  const config = {
    default: process.env.API_ROUTING_DEFAULT || 'legacy',
    overrides: Object.fromEntries(inMemoryRouteConfig.entries())
  };
  return config;
}

/**
 * Normalizes values for structural diff comparison (ignores whitespace and key order)
 */
function normalizeForComparison(val) {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map(normalizeForComparison);
  }
  const sorted = {};
  for (const key of Object.keys(val).sort()) {
    sorted[key] = normalizeForComparison(val[key]);
  }
  return sorted;
}

/**
 * Creates a Strangler Proxy router wrapper.
 */
function createStranglerProxy(routeName, legacyHandler, v1Handler) {
  return async (req, res, next) => {
    const mode = getRouteMode(routeName);

    if (mode === 'v1') {
      return v1Handler(req, res, next);
    }

    if (mode === 'legacy') {
      return legacyHandler(req, res, next);
    }

    // Shadow Mode
    if (mode === 'shadow') {
      const isRead = req.method.toUpperCase() === 'GET';

      if (!isRead) {
        // RED LINE: In write routes, never execute double writes! Fallback to legacy
        return legacyHandler(req, res, next);
      }

      // Read Route Shadow Comparison
      let legacyCapturedStatus = 200;
      let legacyCapturedBody = null;
      let legacyResSent = false;

      const originalJson = res.json.bind(res);
      const originalStatus = res.status.bind(res);

      res.status = function (code) {
        legacyCapturedStatus = code;
        return originalStatus(code);
      };

      res.json = function (body) {
        legacyCapturedBody = body;
        legacyResSent = true;
        const out = originalJson(body);

        // Run v1 shadow execution in background (against Neon PostgreSQL only)
        (async () => {
          try {
            let v1CapturedStatus = 200;
            let v1CapturedBody = null;

            const mockRes = {
              status: (code) => {
                v1CapturedStatus = code;
                return mockRes;
              },
              json: (b) => {
                v1CapturedBody = b;
                return mockRes;
              },
              setHeader: () => mockRes,
              headersSent: false
            };

            await v1Handler(req, mockRes, () => {});

            // Compare legacy and v1 responses
            const statusMatch = legacyCapturedStatus === v1CapturedStatus;
            const normLegacy = JSON.stringify(normalizeForComparison(legacyCapturedBody));
            const normV1 = JSON.stringify(normalizeForComparison(v1CapturedBody));
            const bodyMatch = normLegacy === normV1;

            if (!statusMatch || !bodyMatch) {
              const diffSummary = {
                statusMatch,
                bodyMatch,
                legacyStatus: legacyCapturedStatus,
                v1Status: v1CapturedStatus,
                legacySnippet: normLegacy ? normLegacy.substring(0, 300) : null,
                v1Snippet: normV1 ? normV1.substring(0, 300) : null
              };

              await executeQuery(
                `INSERT INTO api_diff_report (route_name, method, path, legacy_status, v1_status, diff_summary, trace_id, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
                [
                  routeName,
                  req.method.toUpperCase(),
                  req.originalUrl || req.url,
                  legacyCapturedStatus,
                  v1CapturedStatus,
                  JSON.stringify(diffSummary),
                  req.traceId || null
                ]
              );
            }
          } catch (shadowErr) {
            console.warn(`⚠️ [SHADOW_PROXY_WARNING] Shadow execution failed for route ${routeName}:`, shadowErr.message);
          }
        })().catch(() => {});

        return out;
      };

      return legacyHandler(req, res, next);
    }

    // Default fallback
    return legacyHandler(req, res, next);
  };
}

module.exports = {
  createStranglerProxy,
  getRouteMode,
  reloadRoutingConfig,
  getRoutingConfig
};
