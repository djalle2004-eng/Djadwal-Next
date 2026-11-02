import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export function getDistDir(): string {
  const candidates = [
    path.resolve(process.cwd(), '../../dist'),
    path.resolve(process.cwd(), '../dist'),
    path.resolve(process.cwd(), 'dist'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), '../../dist');
}

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
};

export function serveDistFile(relPath: string) {
  const distDir = getDistDir();
  const cleanRel = relPath.replace(/^\/+/, '');
  const filePath = path.resolve(distDir, cleanRel);

  // Security guard: protect against path traversal
  if (!filePath.startsWith(distDir)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // 1. Direct file match
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const buffer = fs.readFileSync(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000, immutable',
        'X-Served-By': 'nextjs-legacy-dist-static',
      },
    });
  }

  // 2. Fallback to index.html for SPA routes
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Inject base href if requested via /legacy so that relative assets resolve cleanly
    if (!html.includes('<base')) {
      html = html.replace('<head>', '<head>\n  <base href="/legacy/" />');
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Served-By': 'nextjs-legacy-dist-spa',
      },
    });
  }

  return new NextResponse('Legacy build index.html not found', { status: 404 });
}
