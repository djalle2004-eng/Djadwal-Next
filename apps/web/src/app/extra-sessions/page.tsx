'use client';

import React, { Suspense } from 'react';
import { AvailableRoomsContent } from '../available-rooms/page';

export default function ExtraSessionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3 text-slate-500 font-semibold text-sm">
            <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
            <span>جاري تحميل الحصص الإضافية والتعويضية...</span>
          </div>
        </div>
      }
    >
      <AvailableRoomsContent initialTab="log" />
    </Suspense>
  );
}
