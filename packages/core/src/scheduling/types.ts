/**
 * Djadwal Core: Scheduling Types and Constraint Specifications (P13)
 */

export type SessionType = 'lecture' | 'td' | 'tp' | string;
export type RoomType = 'lecture_hall' | 'amphi' | 'td_room' | 'lab_tp' | 'standard' | string;
export type ConflictSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export type ConflictType =
  | 'PROFESSOR_OVERLAP'
  | 'ROOM_OVERLAP'
  | 'GROUP_OVERLAP'
  | 'CAPACITY_EXCEEDED'
  | 'ROOM_TYPE_MISMATCH'
  | 'WORKLOAD_EXCEEDED'
  | 'PROFESSOR_UNAVAILABLE'
  | 'INSTITUTIONAL_BLOCK'
  | 'GROUP_GAP_EXCEEDED';

export type ResolutionAction =
  | 'MOVE_SLOT'
  | 'CHANGE_ROOM'
  | 'CHANGE_PROFESSOR'
  | 'SWAP_SLOT';

export interface TimeSlot {
  dayOfWeek: number; // 0: Sunday ... 6: Saturday
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  slotIndex?: number;
}

export interface SuggestedResolution {
  id: string;
  action: ResolutionAction;
  titleArabic: string;
  descriptionArabic: string;
  targetDay?: number;
  targetStartTime?: string;
  targetEndTime?: string;
  targetRoomId?: number | string;
  targetRoomName?: string;
  targetProfessorId?: number | string;
  targetProfessorName?: string;
  targetSessionId?: number | string;
  impactSummaryArabic?: string;
}

export interface ConflictParties {
  professorId?: number | string;
  professorName?: string;
  roomId?: number | string;
  roomName?: string;
  groupId?: number | string;
  groupName?: string;
  courseId?: number | string;
  courseName?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  sessionIds: Array<number | string>;
}

export interface ExplainableConflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  titleArabic: string;
  explanationArabic: string;
  parties: ConflictParties;
  suggestedResolutions: [SuggestedResolution, SuggestedResolution, SuggestedResolution];
}

export interface SchedulingTask {
  id: number | string;
  assignmentId?: number | string;
  courseId: number | string;
  courseName: string;
  professorId: number | string;
  professorName: string;
  groupId: number | string;
  groupName: string;
  sessionType: SessionType;
  durationMinutes: number;
  studentCount: number;
  requiredRoomType?: RoomType;
  assignedSlot?: TimeSlot;
  assignedRoomId?: number | string;
  assignedRoomName?: string;
  fixed?: boolean;
  itemStatus?: 'proposed' | 'accepted' | 'rejected' | 'modified';
  metadata?: Record<string, any>;
}

export interface ProfessorProfile {
  id: number | string;
  name: string;
  maxWeeklyHours: number;
  maxDailySessions: number;
  unavailabilities: Array<{ dayOfWeek: number; startTime: string; endTime: string; reason?: string }>;
  preferredDays?: number[];
}

export interface RoomProfile {
  id: number | string;
  name: string;
  capacity: number;
  roomType: RoomType;
  equipment?: string[];
}

export interface GroupProfile {
  id: number | string;
  name: string;
  studentCount: number;
  parentGroupId?: number | string;
  maxDailyGaps?: number;
}

export interface CourseProfile {
  id: number | string;
  name: string;
  code?: string;
  sessionType?: SessionType;
  requiredRoomType?: RoomType;
}

export interface InstitutionalConfig {
  blockedSlots: Array<{ dayOfWeek: number; startTime: string; endTime: string; reasonArabic: string }>;
  workingDays: number[];
  standardSlots: Array<{ startTime: string; endTime: string }>;
}

export interface SchedulingConstraints {
  professors: Map<string, ProfessorProfile>;
  rooms: Map<string, RoomProfile>;
  groups: Map<string, GroupProfile>;
  courses: Map<string, CourseProfile>;
  institutional: InstitutionalConfig;
}

export interface SchedulingMetrics {
  generationDurationMs: number;
  totalSessions: number;
  criticalConflictsCount: number;
  majorConflictsCount: number;
  minorConflictsCount: number;
  roomUtilizationRate: number; // percentage 0-100
  professorWorkloadBalanceScore: number; // 0-100 higher is more balanced
  humanAcceptanceRate: number; // percentage 0-100
}

export type VersionStatus = 'draft' | 'review' | 'approved' | 'published' | 'archived';

export interface ScheduleVersion {
  id: number;
  semesterId: number;
  versionNumber: number;
  title: string;
  status: VersionStatus;
  note: string;
  createdBy: number;
  approvedBy?: number | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  metrics: SchedulingMetrics;
  criticalConflictsCount: number;
  totalSessionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleVersionItem {
  id: number;
  scheduleVersionId: number;
  assignmentId?: number;
  courseId: number;
  courseName?: string;
  professorId: number;
  professorName?: string;
  groupId: number;
  groupName?: string;
  roomId: number;
  roomName?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  itemStatus: 'proposed' | 'accepted' | 'rejected' | 'modified';
  note?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface VisualDiffItem {
  id: string;
  diffType: 'added' | 'removed' | 'modified' | 'unchanged';
  before?: Partial<SchedulingTask>;
  after?: Partial<SchedulingTask>;
  changeSummaryArabic: string;
  conflictsResolved?: string[];
  conflictsIntroduced?: string[];
}

export interface VisualDiffResult {
  versionAId: number;
  versionBId: number;
  versionANumber: number;
  versionBNumber: number;
  items: VisualDiffItem[];
  stats: {
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    unchangedCount: number;
    netConflictDelta: number;
  };
}

export interface ImpactSimulationResult {
  professorsImpactedCount: number;
  professorsImpactedPct: number;
  professorsImpactedNames: string[];
  roomsImpactedCount: number;
  roomsImpactedPct: number;
  roomsImpactedNames: string[];
  groupsImpactedCount: number;
  groupsImpactedPct: number;
  groupsImpactedNames: string[];
  sessionsMovedCount: number;
  sessionsAddedCount: number;
  sessionsRemovedCount: number;
  netConflictReduction: number;
  summaryArabic: string;
}
