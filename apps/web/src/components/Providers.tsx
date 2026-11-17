'use client';

import React from 'react';
import { SandboxProvider } from '@/context/SandboxContext';
import SandboxBanner from '@/components/SandboxBanner';
import SandboxCommitModal from '@/components/SandboxCommitModal';
import SandboxDraftsModal from '@/components/SandboxDraftsModal';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SandboxProvider>
      <SandboxBanner />
      {children}
      <SandboxCommitModal />
      <SandboxDraftsModal />
    </SandboxProvider>
  );
}
