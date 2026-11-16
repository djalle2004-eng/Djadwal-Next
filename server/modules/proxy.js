const http = require('http');
const path = require('path');
const fs = require('fs');

const LEGACY_DIST = path.join(__dirname, '../../dist');
const NEXT_APP_URL = process.env.NEXT_APP_URL || 'http://localhost:3000';

// Next.js direct handler integration (custom server support)
let nextApp = null;
let nextRequestHandler = null;

try {
  let nextFactory;
  try {
    nextFactory = require('next');
  } catch {
    const nextPath = require.resolve('next', { paths: [path.join(__dirname, '../../apps/web')] });
    nextFactory = require(nextPath);
  }
  const isDev = process.env.NODE_ENV !== 'production';
  nextApp = nextFactory({ dev: isDev, dir: path.join(__dirname, '../../apps/web') });
  nextApp.prepare().then(() => {
    nextRequestHandler = nextApp.getRequestHandler();
    console.log('[StranglerProxy] Next.js custom server prepared and getRequestHandler ready');
  }).catch((err) => {
    console.warn('[StranglerProxy] Next.js direct prepare skipped (using reverse proxy):', err.message);
  });
} catch (e) {
  // Not fatal, reverse proxy forwardToNext handles communication
}

/**
 * Proxy request to Next.js App Router
 */
function forwardToNext(req, res, targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    const headers = {
      ...req.headers,
      host: parsed.host,
      'x-forwarded-host': req.headers.host || '',
      'x-forwarded-proto': req.protocol || 'http',
      'x-strangler-proxy': 'express-strangler',
    };

    let bodyData = null;
    if (req.body && Object.keys(req.body).length > 0) {
      bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      headers['content-length'] = Buffer.byteLength(bodyData);
    }

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: req.originalUrl || req.url,
      method: req.method,
      headers,
    };

    const client = parsed.protocol === 'https:' ? require('https') : http;
    const proxyReq = client.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.warn(`[StranglerProxy] Next.js unreachable at ${targetUrl}:`, err.message);
      // Resilient fallback to legacy UI
      res.setHeader('X-Strangler-Fallback', 'true');
      res.sendFile(path.join(LEGACY_DIST, 'index.html'));
    });

    if (bodyData) {
      proxyReq.write(bodyData);
      proxyReq.end();
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      proxyReq.end();
    } else {
      req.pipe(proxyReq);
    }
  } catch (err) {
    console.error('[StranglerProxy] Error creating proxy request:', err);
    res.sendFile(path.join(LEGACY_DIST, 'index.html'));
  }
}

/**
 * Next.js Request Handler:
 * Uses direct nextRequestHandler if prepared, otherwise forwards to NEXT_APP_URL
 */
function handle(req, res) {
  if (nextRequestHandler) {
    return nextRequestHandler(req, res);
  }
  return forwardToNext(req, res, NEXT_APP_URL);
}

/**
 * Evaluates whether a given pathname is migrated to Next.js App Router
 * based on MIGRATED_ROUTES feature flag.
 */
function isRouteMigrated(pathname) {
  const p = (pathname || '/').toLowerCase();

  // 1. Direct Legacy Routes are NEVER treated as migrated
  if (p === '/legacy' || p.startsWith('/legacy/')) {
    return false;
  }

  // 2. Next.js internal static assets (_next) are always handled by Next.js
  if (p.startsWith('/_next/')) {
    return true;
  }

  // 3. Feature Flag: MIGRATED_ROUTES
  // Default: '*' (all modern App Router screens)
  const rawEnv = process.env.MIGRATED_ROUTES;
  const rawMigrated = (rawEnv !== undefined && rawEnv !== 'undefined')
    ? rawEnv
    : '*';

  // Instant emergency rollback if empty or 'none'
  if (!rawMigrated || rawMigrated.trim() === '' || rawMigrated.trim().toLowerCase() === 'none') {
    return false;
  }

  if (rawMigrated.trim() === '*') {
    return true;
  }

  const migratedList = rawMigrated
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);

  // Root '/' matches if either '/' or '/dashboard' is migrated
  if (p === '/') {
    return migratedList.includes('/') || migratedList.includes('/dashboard');
  }

  return migratedList.some((route) => p === route || p.startsWith(`${route}/`));
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
    const subpath = req.path.replace(/^\/legacy/, '');
    const candidateFile = path.join(LEGACY_DIST, subpath);
    if (subpath && fs.existsSync(candidateFile) && fs.statSync(candidateFile).isFile()) {
      return res.sendFile(candidateFile);
    }
    return res.sendFile(path.join(LEGACY_DIST, 'index.html'));
  }

  // 3. Next.js internal static assets (_next)
  if (p.startsWith('/_next/')) {
    return handle(req, res);
  }

  // 4. Feature Flag: MIGRATED_ROUTES
  if (isRouteMigrated(p)) {
    return handle(req, res);
  }

  // Default: Fallback to Legacy UI
  res.sendFile(path.join(LEGACY_DIST, 'index.html'));
}

module.exports = {
  handle,
  isRouteMigrated,
  stranglerUiMiddleware,
  forwardToNext,
};

