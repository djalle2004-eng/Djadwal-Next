'use client';

import React, { useState, useEffect } from 'react';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  X,
} from 'lucide-react';
import { useOffline } from '@/context/OfflineContext';
import { Button, Badge } from '@djadwal/ui';

export default function OfflineStatusBanner() {
  const {
    isOnline,
    pendingMutations,
    isSyncing,
    syncNow,
    lastUpdatedTimestamp,
    dataSaverMode,
    toggleDataSaverMode,
    canInstallPwa,
    installPwa,
  } = useOffline();

  const [timeAgo, setTimeAgo] = useState<string>('');
  const [isInstallDismissed, setIsInstallDismissed] = useState(false);

  // Compute friendly Arabic relative time
  useEffect(() => {
    if (!lastUpdatedTimestamp) {
      setTimeAgo('');
      return;
    }

    const updateRelative = () => {
      const diffSec = Math.floor((Date.now() - lastUpdatedTimestamp) / 1000);
      if (diffSec < 60) {
        setTimeAgo('منذ لحظات');
      } else if (diffSec < 3600) {
        const mins = Math.floor(diffSec / 60);
        setTimeAgo(`منذ ${mins} ${mins === 1 ? 'دقيقة' : mins === 2 ? 'دقيقتين' : mins <= 10 ? 'دقائق' : 'دقيقة'}`);
      } else {
        const hours = Math.floor(diffSec / 3600);
        setTimeAgo(`منذ ${hours} ${hours === 1 ? 'ساعة' : 'ساعات'}`);
      }
    };

    updateRelative();
    const interval = setInterval(updateRelative, 30000);
    return () => clearInterval(interval);
  }, [lastUpdatedTimestamp]);

  return (
    <div className="space-y-2 mb-4 no-print">
      {/* 1. Offline Mode Banner */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white rounded-2xl shadow-lg border border-amber-500 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/30 text-amber-100 shrink-0">
              <WifiOff className="w-5 h-5 animate-pulse" />
            </div>
            <div className="text-sm">
              <span className="font-extrabold block">
                أنت تعمل حالياً دون اتصال بالإنترنت (وضع القاعات Offline)
              </span>
              <span className="text-amber-100 text-xs">
                يتم عرض البيانات المحفوظة محلياً في الذاكرة الآمنة للجهاز
                {timeAgo ? ` • آخر تحديث: ${timeAgo}` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pendingMutations.length > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-900/60 text-amber-200 text-xs font-bold border border-amber-400/40">
                بانتظار المزامنة ({pendingMutations.length})
              </span>
            )}
            <button
              type="button"
              onClick={toggleDataSaverMode}
              className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 transition-colors ${
                dataSaverMode
                  ? 'bg-amber-400 text-amber-950 border-amber-300'
                  : 'bg-amber-800/60 text-amber-200 border-amber-500/40'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>توفير البيانات</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Pending Sync Queue Alert (when back online) */}
      {isOnline && pendingMutations.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 shrink-0">
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div className="text-sm">
              <span className="font-bold block">
                لديك {pendingMutations.length} طلبات تعديل محفوظة محلياً «بانتظار المزامنة»
              </span>
              <span className="text-xs text-blue-700 dark:text-blue-300">
                تم حفظ التغييرات محلياً مع مفتاح عدم التكرار (Idempotency-Key) لضمان عدم التكرار.
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={syncNow}
            disabled={isSyncing}
            className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة التغييرات الآن'}</span>
          </Button>
        </div>
      )}

      {/* 3. Guided PWA Install Banner */}
      {canInstallPwa && !isInstallDismissed && (
        <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-xs text-emerald-900 dark:text-emerald-100">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium">
              تثبيت تطبيق <strong className="font-bold">Djadwal</strong> على جهازك للوصول السريع بدون إنترنت واستعراض الجداول في القاعات.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={installPwa}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              تثبيت التطبيق
            </button>
            <button
              type="button"
              onClick={() => setIsInstallDismissed(true)}
              className="p-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-md transition-colors"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
