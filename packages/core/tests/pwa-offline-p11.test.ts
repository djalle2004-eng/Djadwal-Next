import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('P11 PWA, Offline Mode & Mutation Sync Verification Suite', () => {
  const WEB_ROOT = path.resolve(__dirname, '../../../apps/web');
  const PUBLIC_DIR = path.resolve(WEB_ROOT, 'public');
  const SW_PATH = path.resolve(PUBLIC_DIR, 'sw.js');
  const MANIFEST_JSON_PATH = path.resolve(PUBLIC_DIR, 'manifest.json');
  const MANIFEST_TS_PATH = path.resolve(WEB_ROOT, 'src/app/manifest.ts');
  const OFFLINE_DB_PATH = path.resolve(WEB_ROOT, 'src/lib/offline-db.ts');
  const OFFLINE_CTX_PATH = path.resolve(WEB_ROOT, 'src/context/OfflineContext.tsx');
  const BANNER_PATH = path.resolve(WEB_ROOT, 'src/components/OfflineStatusBanner.tsx');
  const BACKUPS_PAGE_PATH = path.resolve(WEB_ROOT, 'src/app/settings/backups/page.tsx');

  // 1. Service Worker Caching Strategies Verification
  it('1. Confirms Service Worker exists with differentiated caching strategies', () => {
    expect(fs.existsSync(SW_PATH), 'public/sw.js must exist').toBe(true);
    const swContent = fs.readFileSync(SW_PATH, 'utf8');

    // Strategy 1: Network-First for API reads (/api/)
    expect(swContent).toContain("url.pathname.startsWith('/api/')");
    expect(swContent).toContain('caches.open(CACHE_API)');
    expect(swContent).toContain('X-Djadwal-Offline-Cache');

    // Strategy 2: Stale-While-Revalidate for Web App Shell & Next.js static chunks
    expect(swContent).toContain('CACHE_STATIC');
    expect(swContent).toContain('cachedResponse || fetchPromise');

    // Strategy 3: Cache-First for fonts and media
    expect(swContent).toContain('fonts.gstatic.com');
    expect(swContent).toContain('CACHE_FONTS');

    // Strategy 4: Strict Network-Only for mutating requests (POST/PUT/DELETE) and auth
    expect(swContent).toContain("request.method !== 'GET'");
    expect(swContent).toContain("url.pathname.includes('/auth')");
    expect(swContent).toContain("url.pathname.includes('/login')");

    // Cache versioning and invalidation
    expect(swContent).toContain('INVALIDATE_CACHE');
    expect(swContent).toContain('CLEAR_ALL_DATA');
    expect(swContent).toContain('skipWaiting');
    expect(swContent).toContain('clients.claim()');
  });

  // 2. Web App Manifest Verification
  it('2. Confirms valid Web App Manifest with Arabic shortcuts and icons', () => {
    expect(fs.existsSync(MANIFEST_JSON_PATH), 'public/manifest.json must exist').toBe(true);
    const manifestJson = JSON.parse(fs.readFileSync(MANIFEST_JSON_PATH, 'utf8'));

    expect(manifestJson.name).toContain('Djadwal');
    expect(manifestJson.short_name).toBe('Djadwal');
    expect(manifestJson.display).toBe('standalone');
    expect(manifestJson.dir).toBe('rtl');
    expect(manifestJson.lang).toBe('ar');
    expect(manifestJson.theme_color).toBe('#059669');
    expect(manifestJson.background_color).toBe('#f8fafc');

    // Icons check
    expect(manifestJson.icons.length).toBeGreaterThanOrEqual(2);
    const icon192 = manifestJson.icons.find((i: any) => i.sizes === '192x192');
    const icon512 = manifestJson.icons.find((i: any) => i.sizes === '512x512');
    expect(icon192).toBeDefined();
    expect(icon512).toBeDefined();

    // Shortcuts check: جدولي, التكليفات, إشعاراتي, تعارضاتي
    expect(manifestJson.shortcuts.length).toBeGreaterThanOrEqual(3);
    const shortcutUrls = manifestJson.shortcuts.map((s: any) => s.url);
    expect(shortcutUrls).toContain('/schedule');
    expect(shortcutUrls).toContain('/assignments');
    expect(shortcutUrls).toContain('/settings/audit-undo');

    // Next.js App Router metadata manifest.ts check
    expect(fs.existsSync(MANIFEST_TS_PATH)).toBe(true);
  });

  // 3. IndexedDB Offline Storage and Hygiene Verification
  it('3. Confirms IndexedDB storage with strict security (zero sensitive data stored)', () => {
    expect(fs.existsSync(OFFLINE_DB_PATH)).toBe(true);
    const dbContent = fs.readFileSync(OFFLINE_DB_PATH, 'utf8');

    // Object stores
    expect(dbContent).toContain('timetables');
    expect(dbContent).toContain('sync_queue');
    expect(dbContent).toContain('device_meta');

    // Functions
    expect(dbContent).toContain('saveOfflineTimetable');
    expect(dbContent).toContain('getOfflineTimetable');
    expect(dbContent).toContain('queueOfflineMutation');
    expect(dbContent).toContain('getPendingMutations');
    expect(dbContent).toContain('clearDeviceData');

    // Red Line 1 & 2: Zero passwords, JWT tokens, or credentials stored as data properties
    expect(dbContent).not.toMatch(/password\s*:/i);
    expect(dbContent).not.toMatch(/jwt_token/i);
    expect(dbContent).not.toMatch(/token_hash/i);
  });

  // 4. Offline Mutation Queue & Idempotency Guarantee
  it('4. Confirms Offline Mutation Queue with Idempotency-Key and FIFO dispatch', () => {
    const dbContent = fs.readFileSync(OFFLINE_DB_PATH, 'utf8');
    const ctxContent = fs.readFileSync(OFFLINE_CTX_PATH, 'utf8');

    // Queue stores idempotencyKey and status
    expect(dbContent).toContain('idempotencyKey: string');
    expect(dbContent).toContain("status: 'pending'");

    // FIFO dispatch order
    expect(dbContent).toContain('a.createdAt - b.createdAt');

    // Dispatch sends Idempotency-Key header
    expect(ctxContent).toContain("'Idempotency-Key': item.idempotencyKey");
    expect(ctxContent).toContain('updateMutationStatus');
    expect(ctxContent).toContain('removePendingMutation');
  });

  // 5. Data Protection Policy: Clear Device Data Button in Settings
  it('5. Confirms "حذف بيانات الجهاز والتخزين المؤقت" exists in Settings with full purge', () => {
    expect(fs.existsSync(BACKUPS_PAGE_PATH)).toBe(true);
    const backupsContent = fs.readFileSync(BACKUPS_PAGE_PATH, 'utf8');

    expect(backupsContent).toContain('حذف بيانات الجهاز والتخزين المؤقت');
    expect(backupsContent).toContain('clearAllDeviceData');
    expect(backupsContent).toContain('clearDeviceDataModalOpen');
    expect(backupsContent).toContain('تأكيد حذف بيانات الجهاز والتخزين المؤقت');
  });

  // 6. Visual Status Indicators: Offline bar, relative time & pending sync badge
  it('6. Confirms OfflineStatusBanner displays relative time and pending sync state', () => {
    expect(fs.existsSync(BANNER_PATH)).toBe(true);
    const bannerContent = fs.readFileSync(BANNER_PATH, 'utf8');

    expect(bannerContent).toContain('أنت تعمل حالياً دون اتصال بالإنترنت');
    expect(bannerContent).toContain('آخر تحديث:');
    expect(bannerContent).toContain('بانتظار المزامنة');
    expect(bannerContent).toContain('توفير البيانات');
    expect(bannerContent).toContain('تثبيت تطبيق');
    expect(bannerContent).toContain('Djadwal');
  });

  // 7. Schedule Page Integration: Offline Read Fallback & Offline Queue
  it('7. Confirms /schedule page integrates offline read fallback and mutation queueing', () => {
    const schedPath = path.resolve(WEB_ROOT, 'src/app/schedule/page.tsx');
    const schedContent = fs.readFileSync(schedPath, 'utf8');

    expect(schedContent).toContain('saveOfflineTimetable');
    expect(schedContent).toContain('getOfflineTimetable');
    expect(schedContent).toContain('queueMutation');
    expect(schedContent).toContain('isOnline');
    expect(schedContent).toContain('بانتظار المزامنة');
  });
});
