/**
 * Djadwal Offline Database & Mutation Synchronization Engine
 * Built on IndexedDB for zero main-thread blocking and strict data hygiene.
 * Red lines strictly enforced: Zero credentials/passwords stored.
 */

const DB_NAME = 'djadwal_offline_db';
const DB_VERSION = 1;

export interface TimetableCachePayload {
  id: string; // e.g. "schedule_2026-2027_S1"
  academicYear: string;
  semester: string;
  assignments: any[];
  groups: any[];
  professors: any[];
  rooms: any[];
  courses: any[];
  cachedAt: number; // Unix timestamp ms
  version?: number;
}

export interface OfflineMutation {
  id: string; // UUID
  url: string; // Endpoint e.g. "/api/v1/assignments/12/move"
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  idempotencyKey: string;
  description: string; // Arabic description for UI
  createdAt: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string | null;
  retries?: number;
}

/**
 * Open or upgrade the IndexedDB database
 */
export function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Timetables store: caches published read-only schedule data
      if (!db.objectStoreNames.contains('timetables')) {
        db.createObjectStore('timetables', { keyPath: 'id' });
      }

      // 2. Mutation sync queue store: holds offline changes until online
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 3. Device meta store: settings, data saver toggle, last sync time
      if (!db.objectStoreNames.contains('device_meta')) {
        db.createObjectStore('device_meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save complete published timetable to IndexedDB
 */
export async function saveOfflineTimetable(payload: Omit<TimetableCachePayload, 'id' | 'cachedAt'>): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('timetables', 'readwrite');
    const store = tx.objectStore('timetables');

    const id = `schedule_${payload.academicYear}_${payload.semester}`;
    const record: TimetableCachePayload = {
      ...payload,
      id,
      cachedAt: Date.now(),
    };

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve cached timetable from IndexedDB for offline viewing
 */
export async function getOfflineTimetable(
  academicYear: string,
  semester: string
): Promise<TimetableCachePayload | null> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction('timetables', 'readonly');
      const store = tx.objectStore('timetables');
      const id = `schedule_${academicYear}_${semester}`;

      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    return null;
  }
}

/**
 * Enqueue an offline mutation request into the sync queue
 */
export async function queueOfflineMutation(mutation: Omit<OfflineMutation, 'createdAt' | 'status' | 'retries'>): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');

    const record: OfflineMutation = {
      ...mutation,
      createdAt: Date.now(),
      status: 'pending',
      retries: 0,
    };

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all pending mutations waiting to be synced
 */
export async function getPendingMutations(): Promise<OfflineMutation[]> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const req = store.getAll();

      req.onsuccess = () => {
        const items: OfflineMutation[] = req.result || [];
        // Sort oldest first (FIFO)
        items.sort((a, b) => a.createdAt - b.createdAt);
        resolve(items);
      };
      req.onerror = () => resolve([]);
    });
  } catch (_) {
    return [];
  }
}

/**
 * Remove a successfully synced mutation from the queue
 */
export async function removePendingMutation(id: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update mutation status in the queue
 */
export async function updateMutationStatus(
  id: string,
  status: 'pending' | 'syncing' | 'failed',
  error?: string | null
): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      if (!getReq.result) return resolve();
      const item: OfflineMutation = {
        ...getReq.result,
        status,
        error: error !== undefined ? error : getReq.result.error,
        retries: (getReq.result.retries || 0) + (status === 'failed' ? 1 : 0),
      };
      const putReq = store.put(item);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Red line 4: Clear all device data & local caches
 * Ensures complete privacy and data protection on shared devices.
 */
export async function clearDeviceData(): Promise<{ success: boolean; clearedStores: string[] }> {
  const cleared: string[] = [];

  // 1. Clear IndexedDB stores
  try {
    const db = await openOfflineDB();
    const storeNames = Array.from(db.objectStoreNames);
    const tx = db.transaction(storeNames, 'readwrite');

    for (const name of storeNames) {
      tx.objectStore(name).clear();
      cleared.push(`IndexedDB: ${name}`);
    }
  } catch (err) {
    console.warn('[OfflineDB] Error clearing IndexedDB:', err);
  }

  // 2. Clear CacheStorage
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
        cleared.push(`CacheStorage: ${key}`);
      }
    } catch (err) {
      console.warn('[OfflineDB] Error clearing CacheStorage:', err);
    }
  }

  // 3. Clear localStorage sandbox keys
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('djadwal_') || key.startsWith('sandbox_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => {
        localStorage.removeItem(k);
        cleared.push(`localStorage: ${k}`);
      });
    } catch (_) {}
  }

  // 4. Notify Service Worker to invalidate
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL_DATA' });
  }

  return { success: true, clearedStores: cleared };
}

/**
 * Data Saver Mode Setting (Network Information API + User preference)
 */
export async function getDataSaverSetting(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && (navigator as any).connection?.saveData) {
    return true;
  }
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction('device_meta', 'readonly');
      const store = tx.objectStore('device_meta');
      const req = store.get('data_saver_mode');
      req.onsuccess = () => resolve(req.result ? Boolean(req.result.value) : false);
      req.onerror = () => resolve(false);
    });
  } catch (_) {
    return false;
  }
}

export async function setDataSaverSetting(enabled: boolean): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('device_meta', 'readwrite');
    const store = tx.objectStore('device_meta');
    const req = store.put({ key: 'data_saver_mode', value: enabled });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
