'use client';

import React from 'react';
import { SandboxProvider } from '@/context/SandboxContext';
import { OfflineProvider } from '@/context/OfflineContext';
import SandboxBanner from '@/components/SandboxBanner';
import SandboxCommitModal from '@/components/SandboxCommitModal';
import SandboxDraftsModal from '@/components/SandboxDraftsModal';
import OfflineStatusBanner from '@/components/OfflineStatusBanner';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <OfflineProvider>
      <SandboxProvider>
        <OfflineStatusBanner />
        <SandboxBanner />
        {children}
        <SandboxCommitModal />
        <SandboxDraftsModal />
      </SandboxProvider>
    </OfflineProvider>
  );
}
