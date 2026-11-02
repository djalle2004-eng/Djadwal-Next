import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Strangler UI Routing Middleware
 * Directs traffic based on the dynamic MIGRATED_ROUTES feature flag.
 *
 * Rules:
 * 1. STRICT EXCLUSION: /api/*, /api/v1/*, and especially /api/ping & /ping
 *    are NEVER touched or delayed (< 5ms, 0 DB queries).
 * 2. Static Next.js assets (_next, favicon, icons) are always served directly.
 * 3. /legacy routes are served by the legacy SPA.
 * 4. If a route is listed in MIGRATED_ROUTES => served by Next.js.
 * 5. If not listed in MIGRATED_ROUTES => redirected/rewritten to /legacy.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Strict Exemption for API, Ping, and Next.js internal assets
  if (
    pathname.startsWith('/api/') ||
    pathname === '/api/ping' ||
    pathname === '/ping' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    pathname.includes('.') // static files like favicon.ico, images, etc.
  ) {
    return NextResponse.next();
  }

  // 2. Direct access to /legacy routes
  if (pathname.startsWith('/legacy')) {
    return NextResponse.next();
  }

  // 3. Evaluate MIGRATED_ROUTES feature flag
  // Format: comma-separated paths, e.g. "/dashboard,/professors,/rooms,/courses,/groups,/schedule,/sessions,/print"
  // Default to full set if not configured, or empty string "" for emergency rollback.
  const rawMigrated = process.env.MIGRATED_ROUTES !== undefined
    ? process.env.MIGRATED_ROUTES
    : '/dashboard,/professors,/rooms,/courses,/groups,/schedule,/sessions,/print,/login';

  const migratedRoutes = rawMigrated
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);

  const cleanPath = pathname.toLowerCase();

  // Root path '/' aliases to '/dashboard'
  const targetRoute = cleanPath === '/' ? '/dashboard' : cleanPath;

  const isMigrated = migratedRoutes.some((route) => {
    return targetRoute === route || targetRoute.startsWith(`${route}/`);
  });

  // 4. If route is migrated, serve via Next.js
  if (isMigrated) {
    const response = NextResponse.next();
    response.headers.set('X-Served-By', 'nextjs-app-router');
    response.headers.set('X-Strangler-Status', 'migrated');
    return response;
  }

  // 5. If route is not migrated, route to legacy SPA
  const legacyUrl = new URL(`/legacy${pathname === '/' ? '' : pathname}`, request.url);
  legacyUrl.search = request.nextUrl.search;
  
  const response = NextResponse.rewrite(legacyUrl);
  response.headers.set('X-Served-By', 'legacy-spa-proxy');
  response.headers.set('X-Strangler-Status', 'legacy-fallback');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled directly)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

