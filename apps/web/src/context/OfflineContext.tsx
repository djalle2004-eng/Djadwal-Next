'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getPendingMutations,
  removePendingMutation,
  updateMutationStatus,
  queueOfflineMutation,
  clearDeviceData,
  getDataSaverSetting,
  setDataSaverSetting,
  OfflineMutation,
} from '@/lib/offline-db';
import { api } from '@/lib/api';

interface OfflineContextType {
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  dataSaverMode: boolean;
  toggleDataSaverMode: () => Promise<void>;
  pendingMutations: OfflineMutation[];
  isSyncing: boolean;
  syncNow: () => Promise<{ synced: number; failed: number }>;
  queueMutation: (mutation: Omit<OfflineMutation, 'createdAt' | 'status' | 'retries'>) => Promise<void>;
  lastUpdatedTimestamp: number | null;
  setLastUpdatedTimestamp: (ts: number | null) => void;
  canInstallPwa: boolean;
  installPwa: () => Promise<void>;
  clearAllDeviceData: () => Promise<{ success: boolean; clearedStores: string[] }>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState<boolean>(false);
  const [dataSaverMode, setDataSaverMode] = useState<boolean>(false);
  const [pendingMutations, setPendingMutations] = useState<OfflineMutation[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastUpdatedTimestamp, setLastUpdatedTimestamp] = useState<number | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  // Refresh pending mutations list from IndexedDB
  const refreshPendingMutations = useCallback(async () => {
    try {
      const items = await getPendingMutations();
      setPendingMutations(items);
    } catch (_) {}
  }, []);

  // 1. Initialize Network Listeners & Data Saver setting
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync when back online
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load of pending mutations and data-saver preference
    refreshPendingMutations();
    getDataSaverSetting().then(setDataSaverMode);

    // Listen for PWA installation prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 2. Register Service Worker in production/supporting environments
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          setIsServiceWorkerReady(true);
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed (normal in dev/test):', err);
        });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // 3. Sync Pending Mutations FIFO
  const syncNow = useCallback(async () => {
    if (isSyncing || !navigator.onLine) {
      return { synced: 0, failed: 0 };
    }

    setIsSyncing(true);
    let synced = 0;
    let failed = 0;

    try {
      const queue = await getPendingMutations();
      for (const item of queue) {
        await updateMutationStatus(item.id, 'syncing');
        try {
          // Send request with exact Idempotency-Key
          await apiFetchDirect(item.url, {
            method: item.method,
            body: item.body ? JSON.stringify(item.body) : undefined,
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': item.idempotencyKey,
            },
          });

          await removePendingMutation(item.id);
          synced++;
        } catch (err: any) {
          console.error(`[SyncEngine] Failed to sync mutation ${item.id}:`, err);
          await updateMutationStatus(item.id, 'failed', err?.messageAr || err?.message || 'فشلت المزامنة');
          failed++;
        }
      }
    } finally {
      await refreshPendingMutations();
      setIsSyncing(false);
    }

    return { synced, failed };
  }, [isSyncing, refreshPendingMutations]);

  // Direct fetch helper for the sync engine
  const apiFetchDirect = async (url: string, init: RequestInit) => {
    const fullUrl = url.startsWith('/api') ? url : `/api/v1${url.startsWith('/') ? '' : '/'}${url}`;
    const res = await fetch(fullUrl, { ...init, credentials: 'include' });
    if (!res.ok) {
      let data: any = {};
      try {
        data = await res.json();
      } catch (_) {}
      throw new Error(data?.error?.message_ar || `HTTP error ${res.status}`);
    }
    return res.json().catch(() => ({}));
  };

  // Queue a mutation when offline
  const queueMutation = useCallback(
    async (mutation: Omit<OfflineMutation, 'createdAt' | 'status' | 'retries'>) => {
      await queueOfflineMutation(mutation);
      await refreshPendingMutations();
    },
    [refreshPendingMutations]
  );

  // Toggle Data Saver Mode
  const toggleDataSaverMode = useCallback(async () => {
    const nextVal = !dataSaverMode;
    setDataSaverMode(nextVal);
    await setDataSaverSetting(nextVal);
  }, [dataSaverMode]);

  // Install PWA Prompt
  const installPwa = useCallback(async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('[PWA] User response to install prompt:', outcome);
    setDeferredInstallPrompt(null);
  }, [deferredInstallPrompt]);

  // Clear all device data
  const handleClearAllDeviceData = useCallback(async () => {
    const result = await clearDeviceData();
    await refreshPendingMutations();
    setLastUpdatedTimestamp(null);
    return result;
  }, [refreshPendingMutations]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isServiceWorkerReady,
        dataSaverMode,
        toggleDataSaverMode,
        pendingMutations,
        isSyncing,
        syncNow,
        queueMutation,
        lastUpdatedTimestamp,
        setLastUpdatedTimestamp,
        canInstallPwa: Boolean(deferredInstallPrompt),
        installPwa,
        clearAllDeviceData: handleClearAllDeviceData,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
