'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { DAYS } from '@/constants/timeSlots';

export interface Assignment {
  id: number;
  course_id?: number;
  course_name?: string;
  professor_id?: number;
  professor_name?: string;
  room_id?: number;
  room_name?: string;
  group_id?: number;
  group_name?: string;
  day_of_week: number | string;
  start_time: string;
  end_time: string;
  session_type?: string;
  academic_year?: string;
  semester?: string;
  specialization?: string;
  version?: number;
  [key: string]: any;
}

export type SimulatedActionType = 'move' | 'create' | 'update' | 'delete';

export interface SimulatedChange {
  id: string;
  actionType?: SimulatedActionType;
  timestamp: number;
  assignmentId: number;
  courseName: string;
  groupName: string;
  professorName: string;
  roomName: string;
  details?: any;
  from: {
    day: number;
    dayName: string;
    startTime: string;
    endTime: string;
    roomId?: number;
    roomName?: string;
  };
  to: {
    day: number;
    dayName: string;
    startTime: string;
    endTime: string;
    roomId?: number;
    roomName?: string;
  };
}

export interface SandboxDraft {
  id: string | number;
  name: string;
  createdAt: string;
  assignmentsCount: number;
  changesCount: number;
  data: {
    stagedAssignments: Assignment[];
    simulatedChanges: SimulatedChange[];
  };
}

export interface SandboxContextType {
  isSandboxMode: boolean;
  stagedAssignments: Assignment[];
  originalAssignments: Assignment[];
  simulatedChanges: SimulatedChange[];
  hasChanges: boolean;
  changeCount: number;
  canUndo: boolean;
  canRedo: boolean;
  isCommitting: boolean;
  commitProgress: { current: number; total: number } | null;
  // Modal states
  isCommitModalOpen: boolean;
  setIsCommitModalOpen: (open: boolean) => void;
  isDraftsModalOpen: boolean;
  setIsDraftsModalOpen: (open: boolean) => void;
  // Actions
  enterSandboxMode: (initialAssignments?: Assignment[]) => void;
  exitSandboxMode: () => void;
  syncLiveAssignments: (assignments: Assignment[]) => void;
  applySimulatedMove: (params: {
    assignmentId: number;
    toDayId: number;
    toStartTime: string;
    toEndTime: string;
    toRoomId?: number;
    toRoomName?: string;
  }) => boolean;
  addSimulatedAssignment: (assignmentData: Omit<Assignment, 'id'>) => Assignment;
  updateSimulatedAssignment: (id: number, updatedData: Partial<Assignment>) => boolean;
  deleteSimulatedAssignment: (id: number) => boolean;
  undo: () => void;
  redo: () => void;
  discardChanges: () => void;
  commitChanges: () => Promise<{ success: boolean; appliedCount: number; errors?: any[] }>;
  saveDraft: (name: string) => Promise<boolean>;
  loadDraft: (draft: SandboxDraft) => void;
  listDrafts: () => Promise<SandboxDraft[]>;
  deleteDraft: (draftId: string | number) => Promise<boolean>;
}

const SandboxContext = createContext<SandboxContextType | undefined>(undefined);

const STORAGE_KEY_STATE = 'djadwal_sandbox_active_state_v1';
const STORAGE_KEY_DRAFTS = 'djadwal_sandbox_local_drafts_v1';

export const SandboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSandboxMode, setIsSandboxMode] = useState<boolean>(false);
  const [originalAssignments, setOriginalAssignments] = useState<Assignment[]>([]);
  const [stagedAssignments, setStagedAssignments] = useState<Assignment[]>([]);
  const [simulatedChanges, setSimulatedChanges] = useState<SimulatedChange[]>([]);

  // Undo / Redo stacks of assignments snapshot
  const [history, setHistory] = useState<Assignment[][]>([]);
  const [future, setFuture] = useState<Assignment[][]>([]);

  // Committing progress state
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [commitProgress, setCommitProgress] = useState<{ current: number; total: number } | null>(null);

  // Modals
  const [isCommitModalOpen, setIsCommitModalOpen] = useState<boolean>(false);
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState<boolean>(false);

  // Hydrate sandbox state from sessionStorage on client mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_STATE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isSandboxMode && Array.isArray(parsed.stagedAssignments)) {
          setIsSandboxMode(true);
          setOriginalAssignments(parsed.originalAssignments || []);
          setStagedAssignments(parsed.stagedAssignments || []);
          setSimulatedChanges(parsed.simulatedChanges || []);
        }
      }
    } catch (e) {
      console.warn('Failed to restore sandbox state from sessionStorage:', e);
    }
  }, []);

  // Persist sandbox state to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (isSandboxMode) {
        sessionStorage.setItem(
          STORAGE_KEY_STATE,
          JSON.stringify({
            isSandboxMode: true,
            originalAssignments,
            stagedAssignments,
            simulatedChanges,
          })
        );
      } else {
        sessionStorage.removeItem(STORAGE_KEY_STATE);
      }
    } catch (e) {
      console.warn('Failed to persist sandbox state to sessionStorage:', e);
    }
  }, [isSandboxMode, originalAssignments, stagedAssignments, simulatedChanges]);

  // Sync latest live assignments if not in sandbox mode or when entering
  const syncLiveAssignments = useCallback((assignments: Assignment[]) => {
    setOriginalAssignments((prev) => {
      // Only update original assignments if not currently in sandbox mode
      if (!isSandboxMode) {
        return assignments;
      }
      return prev;
    });
  }, [isSandboxMode]);

  const enterSandboxMode = useCallback((initialAssignments?: Assignment[]) => {
    const baseline = initialAssignments && initialAssignments.length > 0
      ? initialAssignments
      : originalAssignments;

    const cloned = JSON.parse(JSON.stringify(baseline));
    setOriginalAssignments(cloned);
    setStagedAssignments(cloned);
    setSimulatedChanges([]);
    setHistory([]);
    setFuture([]);
    setIsSandboxMode(true);
  }, [originalAssignments]);

  const exitSandboxMode = useCallback(() => {
    setIsSandboxMode(false);
    setStagedAssignments([]);
    setSimulatedChanges([]);
    setHistory([]);
    setFuture([]);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY_STATE);
    }
  }, []);

  const discardChanges = useCallback(() => {
    const restored = JSON.parse(JSON.stringify(originalAssignments));
    setStagedAssignments(restored);
    setSimulatedChanges([]);
    setHistory([]);
    setFuture([]);
  }, [originalAssignments]);

  // Apply a simulated move to an assignment in the sandbox
  const applySimulatedMove = useCallback((params: {
    assignmentId: number;
    toDayId: number;
    toStartTime: string;
    toEndTime: string;
    toRoomId?: number;
    toRoomName?: string;
  }): boolean => {
    const { assignmentId, toDayId, toStartTime, toEndTime, toRoomId, toRoomName } = params;

    const currentSession = stagedAssignments.find((a) => a.id === assignmentId);
    if (!currentSession) return false;

    // Save previous state to history for Undo
    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(stagedAssignments))]);
    setFuture([]); // Clear redo stack on new action

    const fromDayNumber = typeof currentSession.day_of_week === 'number'
      ? currentSession.day_of_week
      : parseInt(String(currentSession.day_of_week), 10) || 0;

    const fromDayName = DAYS.find((d) => d.id === fromDayNumber)?.name || 'غير محدد';
    const toDayName = DAYS.find((d) => d.id === toDayId)?.name || 'غير محدد';

    const changeRecord: SimulatedChange = {
      id: `${Date.now()}-${assignmentId}`,
      timestamp: Date.now(),
      assignmentId,
      courseName: currentSession.course_name || 'مقرر دراسي',
      groupName: currentSession.group_name || 'فوج غير محدد',
      professorName: currentSession.professor_name || 'أستاذ غير محدد',
      roomName: toRoomName || currentSession.room_name || 'قاعة غير محددة',
      from: {
        day: fromDayNumber,
        dayName: fromDayName,
        startTime: currentSession.start_time,
        endTime: currentSession.end_time,
        roomId: currentSession.room_id,
        roomName: currentSession.room_name,
      },
      to: {
        day: toDayId,
        dayName: toDayName,
        startTime: toStartTime,
        endTime: toEndTime,
        roomId: toRoomId,
        roomName: toRoomName || currentSession.room_name,
      },
    };

    // Update staged assignments
    setStagedAssignments((prev) =>
      prev.map((a) => {
        if (a.id === assignmentId) {
          return {
            ...a,
            day_of_week: toDayId,
            start_time: toStartTime,
            end_time: toEndTime,
            room_id: toRoomId !== undefined ? toRoomId : a.room_id,
            room_name: toRoomName !== undefined ? toRoomName : a.room_name,
          };
        }
        return a;
      })
    );

    // Record change (or update if this assignment was already moved in the current simulation session)
    setSimulatedChanges((prev) => {
      const filtered = prev.filter((c) => c.assignmentId !== assignmentId);
      return [...filtered, changeRecord];
    });

    return true;
  }, [stagedAssignments]);

  // Add a simulated assignment in the sandbox
  const addSimulatedAssignment = useCallback((assignmentData: Omit<Assignment, 'id'>): Assignment => {
    const tempId = -Math.floor(Date.now() / 1000 + Math.random() * 10000);
    const newSession: Assignment = {
      ...assignmentData,
      id: tempId,
      version: 1,
    };

    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(stagedAssignments))]);
    setFuture([]);

    const dayNum = Number(newSession.day_of_week);
    const dayName = DAYS.find((d) => d.id === dayNum)?.name || 'غير محدد';

    const changeRecord: SimulatedChange = {
      id: `add-${tempId}`,
      actionType: 'create',
      timestamp: Date.now(),
      assignmentId: tempId,
      courseName: newSession.course_name || 'مقرر جديد',
      groupName: newSession.group_name || 'فوج',
      professorName: newSession.professor_name || 'أستاذ',
      roomName: newSession.room_name || 'قاعة',
      details: {
        course_id: newSession.course_id,
        professor_id: newSession.professor_id,
        group_id: newSession.group_id,
        room_id: newSession.room_id,
        day_of_week: newSession.day_of_week,
        start_time: newSession.start_time,
        end_time: newSession.end_time,
        session_type: newSession.session_type,
        specialization: newSession.specialization,
        academic_year: newSession.academic_year,
        semester: newSession.semester,
      },
      from: {
        day: dayNum,
        dayName: 'غير مبرمج',
        startTime: '—',
        endTime: '—',
      },
      to: {
        day: dayNum,
        dayName,
        startTime: newSession.start_time,
        endTime: newSession.end_time,
        roomId: newSession.room_id,
        roomName: newSession.room_name,
      },
    };

    setStagedAssignments((prev) => [...prev, newSession]);
    setSimulatedChanges((prev) => [...prev, changeRecord]);

    return newSession;
  }, [stagedAssignments]);

  // Update a simulated assignment in the sandbox
  const updateSimulatedAssignment = useCallback((id: number, updatedData: Partial<Assignment>): boolean => {
    const existing = stagedAssignments.find((a) => a.id === id);
    if (!existing) return false;

    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(stagedAssignments))]);
    setFuture([]);

    const merged: Assignment = {
      ...existing,
      ...updatedData,
      id,
    };

    const origDayNum = Number(existing.day_of_week);
    const newDayNum = Number(merged.day_of_week);

    const changeRecord: SimulatedChange = {
      id: `update-${id}-${Date.now()}`,
      actionType: 'update',
      timestamp: Date.now(),
      assignmentId: id,
      courseName: merged.course_name || existing.course_name || 'مقرر',
      groupName: merged.group_name || existing.group_name || 'فوج',
      professorName: merged.professor_name || existing.professor_name || 'أستاذ',
      roomName: merged.room_name || existing.room_name || 'قاعة',
      details: {
        course_id: merged.course_id,
        professor_id: merged.professor_id,
        group_id: merged.group_id,
        room_id: merged.room_id,
        day_of_week: merged.day_of_week,
        start_time: merged.start_time,
        end_time: merged.end_time,
        session_type: merged.session_type,
        specialization: merged.specialization,
        academic_year: merged.academic_year,
        semester: merged.semester,
        version: merged.version,
      },
      from: {
        day: origDayNum,
        dayName: DAYS.find((d) => d.id === origDayNum)?.name || '',
        startTime: existing.start_time,
        endTime: existing.end_time,
        roomId: existing.room_id,
        roomName: existing.room_name,
      },
      to: {
        day: newDayNum,
        dayName: DAYS.find((d) => d.id === newDayNum)?.name || '',
        startTime: merged.start_time,
        endTime: merged.end_time,
        roomId: merged.room_id,
        roomName: merged.room_name,
      },
    };

    setStagedAssignments((prev) => prev.map((a) => (a.id === id ? merged : a)));
    setSimulatedChanges((prev) => {
      const filtered = prev.filter((c) => c.assignmentId !== id);
      return [...filtered, changeRecord];
    });

    return true;
  }, [stagedAssignments]);

  // Delete a simulated assignment in the sandbox
  const deleteSimulatedAssignment = useCallback((id: number): boolean => {
    const existing = stagedAssignments.find((a) => a.id === id);
    if (!existing) return false;

    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(stagedAssignments))]);
    setFuture([]);

    const dayNum = Number(existing.day_of_week);

    const changeRecord: SimulatedChange = {
      id: `delete-${id}-${Date.now()}`,
      actionType: 'delete',
      timestamp: Date.now(),
      assignmentId: id,
      courseName: existing.course_name || 'مقرر',
      groupName: existing.group_name || 'فوج',
      professorName: existing.professor_name || 'أستاذ',
      roomName: existing.room_name || 'قاعة',
      from: {
        day: dayNum,
        dayName: DAYS.find((d) => d.id === dayNum)?.name || '',
        startTime: existing.start_time,
        endTime: existing.end_time,
        roomId: existing.room_id,
        roomName: existing.room_name,
      },
      to: {
        day: dayNum,
        dayName: 'محذوفة (إلغاء الحصة)',
        startTime: '—',
        endTime: '—',
      },
    };

    setStagedAssignments((prev) => prev.filter((a) => a.id !== id));
    setSimulatedChanges((prev) => {
      if (id < 0) {
        return prev.filter((c) => c.assignmentId !== id);
      }
      const filtered = prev.filter((c) => c.assignmentId !== id);
      return [...filtered, changeRecord];
    });

    return true;
  }, [stagedAssignments]);

  const undo = useCallback(() => {
    if (history.length === 0) return;

    const previousState = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    setFuture((prev) => [JSON.parse(JSON.stringify(stagedAssignments)), ...prev]);
    setStagedAssignments(previousState);
    setHistory(newHistory);

    // Recompute simulated changes compared to originalAssignments
    const changes: SimulatedChange[] = [];
    previousState.forEach((staged) => {
      const orig = originalAssignments.find((o) => o.id === staged.id);
      if (orig && (
        orig.day_of_week !== staged.day_of_week ||
        orig.start_time !== staged.start_time ||
        orig.room_id !== staged.room_id
      )) {
        const origDayNum = Number(orig.day_of_week);
        const stagedDayNum = Number(staged.day_of_week);
        changes.push({
          id: `undo-${staged.id}-${Date.now()}`,
          timestamp: Date.now(),
          assignmentId: staged.id,
          courseName: staged.course_name || 'مقرر',
          groupName: staged.group_name || 'فوج',
          professorName: staged.professor_name || 'أستاذ',
          roomName: staged.room_name || 'قاعة',
          from: {
            day: origDayNum,
            dayName: DAYS.find((d) => d.id === origDayNum)?.name || '',
            startTime: orig.start_time,
            endTime: orig.end_time,
            roomId: orig.room_id,
            roomName: orig.room_name,
          },
          to: {
            day: stagedDayNum,
            dayName: DAYS.find((d) => d.id === stagedDayNum)?.name || '',
            startTime: staged.start_time,
            endTime: staged.end_time,
            roomId: staged.room_id,
            roomName: staged.room_name,
          },
        });
      }
    });
    setSimulatedChanges(changes);
  }, [history, stagedAssignments, originalAssignments]);

  const redo = useCallback(() => {
    if (future.length === 0) return;

    const nextState = future[0];
    const newFuture = future.slice(1);

    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(stagedAssignments))]);
    setStagedAssignments(nextState);
    setFuture(newFuture);
  }, [future, stagedAssignments]);

  const canUndo = history.length > 0;
  const canRedo = future.length > 0;
  const hasChanges = simulatedChanges.length > 0;
  const changeCount = simulatedChanges.length;

  // Commit all simulated changes to the live production database
  const commitChanges = useCallback(async (): Promise<{
    success: boolean;
    appliedCount: number;
    errors?: any[];
  }> => {
    if (simulatedChanges.length === 0) {
      exitSandboxMode();
      return { success: true, appliedCount: 0 };
    }

    setIsCommitting(true);
    setCommitProgress({ current: 0, total: simulatedChanges.length });

    const errors: any[] = [];
    let appliedCount = 0;

    for (let i = 0; i < simulatedChanges.length; i++) {
      const change = simulatedChanges[i];
      setCommitProgress({ current: i + 1, total: simulatedChanges.length });

      try {
        if (change.actionType === 'delete') {
          if (change.assignmentId > 0) {
            await api.delete(`/assignments/${change.assignmentId}`);
          }
        } else if (change.actionType === 'create') {
          await api.post('/assignments', change.details);
        } else if (change.actionType === 'update') {
          await api.put(`/assignments/${change.assignmentId}`, change.details);
        } else {
          const payload = change.details || {
            day_of_week: change.to.day,
            start_time: change.to.startTime,
            end_time: change.to.endTime,
            room_id: change.to.roomId,
          };

          await api.post(`/assignments/${change.assignmentId}/move`, payload, {
            skipConflictAlert: true,
          });
        }

        appliedCount++;
      } catch (err: any) {
        console.error(`Failed to commit change for assignment ${change.assignmentId}:`, err);
        errors.push({
          assignmentId: change.assignmentId,
          courseName: change.courseName,
          error: err?.message || 'فشل تطبيق التعديل',
          statusCode: err?.statusCode,
        });
      }
    }

    setIsCommitting(false);
    setCommitProgress(null);

    if (errors.length === 0) {
      // All applied cleanly, exit sandbox
      exitSandboxMode();
      setIsCommitModalOpen(false);
      return { success: true, appliedCount };
    } else {
      // Some failed, keep sandbox open so admin can review
      return { success: false, appliedCount, errors };
    }
  }, [simulatedChanges, exitSandboxMode]);

  // Draft Management (Local & Server Sync)
  const listDrafts = useCallback(async (): Promise<SandboxDraft[]> => {
    const localDrafts: SandboxDraft[] = [];
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_DRAFTS);
        if (stored) {
          localDrafts.push(...JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Error reading local drafts:', e);
      }
    }

    // Attempt to fetch server snapshots as well
    try {
      const serverSnapshots = await api.get('/sandbox/list').catch(() => []);
      if (Array.isArray(serverSnapshots)) {
        serverSnapshots.forEach((snap: any) => {
          if (!localDrafts.some((d) => String(d.id) === String(snap.id))) {
            localDrafts.push({
              id: snap.id,
              name: snap.name || 'مسودة سحابية',
              createdAt: snap.created_at || new Date().toISOString(),
              assignmentsCount: 0,
              changesCount: 0,
              data: typeof snap.data === 'string' ? JSON.parse(snap.data) : (snap.data || {}),
            });
          }
        });
      }
    } catch (_) {
      // Offline or endpoint unavailable, rely on localDrafts
    }

    return localDrafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, []);

  const saveDraft = useCallback(async (name: string): Promise<boolean> => {
    const draftName = name.trim() || `مسودة تجربة (${new Date().toLocaleDateString('ar-DZ')})`;
    const draftPayload: SandboxDraft = {
      id: `local-${Date.now()}`,
      name: draftName,
      createdAt: new Date().toISOString(),
      assignmentsCount: stagedAssignments.length,
      changesCount: simulatedChanges.length,
      data: {
        stagedAssignments,
        simulatedChanges,
      },
    };

    // 1. Save locally
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_DRAFTS);
        const list: SandboxDraft[] = stored ? JSON.parse(stored) : [];
        list.unshift(draftPayload);
        localStorage.setItem(STORAGE_KEY_DRAFTS, JSON.stringify(list.slice(0, 20))); // Keep last 20
      } catch (e) {
        console.warn('Failed to save draft to localStorage:', e);
      }
    }

    // 2. Attempt server sync
    try {
      await api.post('/sandbox/save', {
        name: draftName,
        data: draftPayload.data,
      });
    } catch (_) {
      // Local save is sufficient if server fails or is offline
    }

    return true;
  }, [stagedAssignments, simulatedChanges]);

  const loadDraft = useCallback((draft: SandboxDraft) => {
    if (!draft || !draft.data) return;
    const { stagedAssignments: loadedAssignments, simulatedChanges: loadedChanges } = draft.data;

    setIsSandboxMode(true);
    setStagedAssignments(loadedAssignments || []);
    setSimulatedChanges(loadedChanges || []);
    setHistory([]);
    setFuture([]);
    setIsDraftsModalOpen(false);
  }, []);

  const deleteDraft = useCallback(async (draftId: string | number): Promise<boolean> => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_DRAFTS);
        if (stored) {
          const list: SandboxDraft[] = JSON.parse(stored);
          const filtered = list.filter((d) => String(d.id) !== String(draftId));
          localStorage.setItem(STORAGE_KEY_DRAFTS, JSON.stringify(filtered));
        }
      } catch (e) {
        console.warn('Error deleting draft from localStorage:', e);
      }
    }

    if (typeof draftId === 'number' || !String(draftId).startsWith('local-')) {
      try {
        await api.delete(`/sandbox/${draftId}`).catch(() => {});
      } catch (_) {}
    }

    return true;
  }, []);

  const contextValue = useMemo<SandboxContextType>(
    () => ({
      isSandboxMode,
      stagedAssignments,
      originalAssignments,
      simulatedChanges,
      hasChanges,
      changeCount,
      canUndo,
      canRedo,
      isCommitting,
      commitProgress,
      isCommitModalOpen,
      setIsCommitModalOpen,
      isDraftsModalOpen,
      setIsDraftsModalOpen,
      enterSandboxMode,
      exitSandboxMode,
      syncLiveAssignments,
      applySimulatedMove,
      addSimulatedAssignment,
      updateSimulatedAssignment,
      deleteSimulatedAssignment,
      undo,
      redo,
      discardChanges,
      commitChanges,
      saveDraft,
      loadDraft,
      listDrafts,
      deleteDraft,
    }),
    [
      isSandboxMode,
      stagedAssignments,
      originalAssignments,
      simulatedChanges,
      hasChanges,
      changeCount,
      canUndo,
      canRedo,
      isCommitting,
      commitProgress,
      isCommitModalOpen,
      isDraftsModalOpen,
      enterSandboxMode,
      exitSandboxMode,
      syncLiveAssignments,
      applySimulatedMove,
      addSimulatedAssignment,
      updateSimulatedAssignment,
      deleteSimulatedAssignment,
      undo,
      redo,
      discardChanges,
      commitChanges,
      saveDraft,
      loadDraft,
      listDrafts,
      deleteDraft,
    ]
  );

  return <SandboxContext.Provider value={contextValue}>{children}</SandboxContext.Provider>;
};

export const useSandbox = (): SandboxContextType => {
  const context = useContext(SandboxContext);
  if (!context) {
    throw new Error('useSandbox must be used within a SandboxProvider');
  }
  return context;
};
