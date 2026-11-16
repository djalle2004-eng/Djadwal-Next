const http = require('http');
const path = require('path');
const fs = require('fs');

const LEGACY_DIST = path.join(__dirname, '../../dist');
const NEXT_APP_URL = process.env.NEXT_APP_URL || 'http://localhost:3000';

/**
 * Proxy request to Next.js App Router
 */
function forwardToNext(req, res, targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: req.originalUrl || req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: parsed.host,
        'x-forwarded-host': req.headers.host || '',
        'x-forwarded-proto': req.protocol || 'http',
        'x-strangler-proxy': 'express-strangler',
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.warn(`[StranglerProxy] Next.js unreachable at ${NEXT_APP_URL}:`, err.message);
      // Resilient fallback to legacy UI
      res.setHeader('X-Strangler-Fallback', 'true');
      res.sendFile(path.join(LEGACY_DIST, 'index.html'));
    });

    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      proxyReq.write(bodyData);
    }

    req.pipe(proxyReq);
  } catch (err) {
    console.error('[StranglerProxy] Error creating proxy request:', err);
    res.sendFile(path.join(LEGACY_DIST, 'index.html'));
  }
}

/**
 * Strangler UI Middleware
 */
function stranglerUiMiddleware(req, res, next) {
  const p = req.path.toLowerCase();

  // 1. Never touch API, ping, or upload routes
  if (
    p.startsWith('/api/') ||
    p === '/api/ping' ||
    p === '/ping' ||
    p.startsWith('/uploads/')
  ) {
    return next();
  }

  // 2. Direct Legacy Route (/legacy and /legacy/*)
  if (p === '/legacy' || p.startsWith('/legacy/')) {
    // If request has file extension, attempt to serve it
    const subpath = req.path.replace(/^\/legacy/, '');
    const candidateFile = path.join(LEGACY_DIST, subpath);
    if (subpath && fs.existsSync(candidateFile) && fs.statSync(candidateFile).isFile()) {
      return res.sendFile(candidateFile);
    }
    return res.sendFile(path.join(LEGACY_DIST, 'index.html'));
  }

  // 3. Next.js internal static assets (_next)
  if (p.startsWith('/_next/')) {
    return forwardToNext(req, res, NEXT_APP_URL);
  }

  // 4. Feature Flag: MIGRATED_ROUTES
  // Default to modern Next.js App Router for all routes ('*') except explicit /legacy
  const rawMigrated = process.env.MIGRATED_ROUTES !== undefined
    ? process.env.MIGRATED_ROUTES
    : '*';

  if (!rawMigrated || rawMigrated.trim() === '' || rawMigrated.trim().toLowerCase() === 'none') {
    // Fallback completely to legacy dist
    return res.sendFile(path.join(LEGACY_DIST, 'index.html'));
  }

  const targetRoute = p === '/' ? '/dashboard' : p;

  const isMigrated = rawMigrated.trim() === '*' || rawMigrated
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean)
    .some((route) => targetRoute === route || targetRoute.startsWith(`${route}/`));

  if (isMigrated) {
    return forwardToNext(req, res, NEXT_APP_URL);
  }

  // Default: Fallback to Legacy UI
  res.sendFile(path.join(LEGACY_DIST, 'index.html'));
}

module.exports = {
  stranglerUiMiddleware,
  forwardToNext,
};

