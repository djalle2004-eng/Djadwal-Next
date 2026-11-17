/**
 * Djadwal Core: Schedule Versioning & Approval Workflow Engine (P13)
 * Manages version lifecycles, strict dual approval (Four-Eyes Principle),
 * visual diff comparisons, item-level accept/reject decisions, and instant rollbacks.
 */

import {
  ScheduleVersion,
  ScheduleVersionItem,
  VersionStatus,
  VisualDiffResult,
  VisualDiffItem,
  ExplainableConflict,
  SchedulingTask
} from './types.js';
import { getDayNameArabic } from './constraints.js';

export class ScheduleApprovalError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ScheduleApprovalError';
  }
}

/**
 * Validates dual approval policy (Four-Eyes Principle: Maker != Checker)
 */
export function validateDualApproval(createdBy: number, approverId: number): void {
  if (Number(createdBy) === Number(approverId)) {
    throw new ScheduleApprovalError(
      `الموافقة المزدوجة إلزامية: لا يجوز لصانع المسودة (المستخدم #${createdBy}) اعتمادها أو نشرها بنفسه وفق لوائح الحوكمة البيداغوجية.`,
      'DUAL_APPROVAL_VIOLATION'
    );
  }
}

/**
 * Validates that an approved version is ready for publication
 */
export function validatePublishReadiness(
  version: Pick<ScheduleVersion, 'status' | 'criticalConflictsCount'>,
  conflicts?: ExplainableConflict[]
): void {
  const criticalCount = conflicts
    ? conflicts.filter(c => c.severity === 'CRITICAL').length
    : (version.criticalConflictsCount || 0);

  if (criticalCount > 0) {
    throw new ScheduleApprovalError(
      `يُمنع نشر الجدول لوجود تعارضات حرجة غير مُعالجة (عدد: ${criticalCount}). يجب معالجة كافة التعارضات الحرجة أو اختيار أحد البدائل المقترحة قبل النشر.`,
      'CRITICAL_CONFLICTS_BLOCK_PUBLISH'
    );
  }
}

/**
 * State Transition Guard for Schedule Version Status
 */
export function canTransitionStatus(
  currentStatus: VersionStatus,
  newStatus: VersionStatus,
  createdBy: number,
  actorId: number
): { allowed: boolean; reasonArabic?: string } {
  // Same status is a no-op
  if (currentStatus === newStatus) {
    return { allowed: true };
  }

  switch (currentStatus) {
    case 'draft':
      if (newStatus === 'review') return { allowed: true };
      if (newStatus === 'archived') return { allowed: true };
      return { allowed: false, reasonArabic: 'المسودة يجب أن تمر أولاً بمرحلة مراجعة القسم (Review) قبل الاعتماد أو النشر.' };

    case 'review':
      if (newStatus === 'approved') {
        if (Number(createdBy) === Number(actorId)) {
          return { allowed: false, reasonArabic: 'مبدأ الرقابة الثنائية: يجب أن يتولى المراجعة والاعتماد مسؤول قسم آخر غير صانع المسودة.' };
        }
        return { allowed: true };
      }
      if (newStatus === 'draft') return { allowed: true }; // Rejected back to draft
      if (newStatus === 'archived') return { allowed: true };
      return { allowed: false, reasonArabic: 'الإصدار في مرحلة المراجعة ولا يمكن نشره مباشرة إلا بعد الاعتماد الإداري.' };

    case 'approved':
      if (newStatus === 'published') {
        if (Number(createdBy) === Number(actorId)) {
          return { allowed: false, reasonArabic: 'مبدأ الرقابة الثنائية: النشر يتطلب مصادقة إدارية من مستخدم مختلف عن منشئ النسخة.' };
        }
        return { allowed: true };
      }
      if (newStatus === 'draft') return { allowed: true }; // Returned for further editing
      if (newStatus === 'archived') return { allowed: true };
      return { allowed: false, reasonArabic: 'الانتقال المطلوب غير متاح من حالة معتمد.' };

    case 'published':
      if (newStatus === 'archived') return { allowed: true };
      return { allowed: false, reasonArabic: 'الإصدار المنشور لا يمكن تعديله مباشرة للحفاظ على استقرار المؤسسة التعليمية؛ أنشئ مسودة جديدة أو استرجع إصداراً سابقاً.' };

    case 'archived':
      return { allowed: false, reasonArabic: 'الإصدار المؤرشف مجمد لأغراض التوثيق والتدقيق فقط.' };

    default:
      return { allowed: false, reasonArabic: 'حالة غير معروفة.' };
  }
}

/**
 * Computes visual difference (Visual Diff) between two versions of the schedule
 */
export function computeVisualDiff(
  versionA: { id: number; versionNumber: number; items: ScheduleVersionItem[] },
  versionB: { id: number; versionNumber: number; items: ScheduleVersionItem[] }
): VisualDiffResult {
  const itemsA = versionA.items || [];
  const itemsB = versionB.items || [];

  const diffItems: VisualDiffItem[] = [];

  // Map by composite business key: courseId + groupId + sessionType
  const mapA = new Map<string, ScheduleVersionItem>();
  itemsA.forEach(item => {
    const key = `${item.courseId}:${item.groupId}:${item.sessionType || 'lecture'}`;
    mapA.set(key, item);
  });

  const matchedKeysInB = new Set<string>();

  // Process items in Version B
  for (const itemB of itemsB) {
    const key = `${itemB.courseId}:${itemB.groupId}:${itemB.sessionType || 'lecture'}`;
    matchedKeysInB.add(key);

    const itemA = mapA.get(key);

    if (!itemA) {
      // Added
      diffItems.push({
        id: `diff_add_${itemB.id}`,
        diffType: 'added',
        after: toPartialTask(itemB),
        changeSummaryArabic: `إضافة حصة جديدة «${itemB.courseName || itemB.courseId}» للفوج «${itemB.groupName || itemB.groupId}» يوم ${getDayNameArabic(itemB.dayOfWeek)} (${itemB.startTime} - ${itemB.endTime}) في «${itemB.roomName || itemB.roomId}».`
      });
    } else {
      // Check if modified
      const slotChanged = itemA.dayOfWeek !== itemB.dayOfWeek || itemA.startTime !== itemB.startTime || itemA.endTime !== itemB.endTime;
      const roomChanged = String(itemA.roomId) !== String(itemB.roomId);
      const profChanged = String(itemA.professorId) !== String(itemB.professorId);

      if (slotChanged || roomChanged || profChanged) {
        const changes: string[] = [];
        if (slotChanged) {
          changes.push(`التوقيت من (${getDayNameArabic(itemA.dayOfWeek)} ${itemA.startTime}) إلى (${getDayNameArabic(itemB.dayOfWeek)} ${itemB.startTime})`);
        }
        if (roomChanged) {
          changes.push(`القاعة من «${itemA.roomName || itemA.roomId}» إلى «${itemB.roomName || itemB.roomId}»`);
        }
        if (profChanged) {
          changes.push(`الأستاذ من «${itemA.professorName || itemA.professorId}» إلى «${itemB.professorName || itemB.professorId}»`);
        }

        diffItems.push({
          id: `diff_mod_${itemB.id}`,
          diffType: 'modified',
          before: toPartialTask(itemA),
          after: toPartialTask(itemB),
          changeSummaryArabic: `تعديل حصة «${itemB.courseName || itemB.courseId}» للفوج «${itemB.groupName || itemB.groupId}»: ${changes.join('، ')}.`
        });
      } else {
        // Unchanged
        diffItems.push({
          id: `diff_unchanged_${itemB.id}`,
          diffType: 'unchanged',
          before: toPartialTask(itemA),
          after: toPartialTask(itemB),
          changeSummaryArabic: `الحصة مطابقة ومستقرة دون أي تغيير.`
        });
      }
    }
  }

  // Find removed items (in A but not in B)
  for (const [key, itemA] of mapA.entries()) {
    if (!matchedKeysInB.has(key)) {
      diffItems.push({
        id: `diff_rem_${itemA.id}`,
        diffType: 'removed',
        before: toPartialTask(itemA),
        changeSummaryArabic: `إلغاء حصة «${itemA.courseName || itemA.courseId}» للفوج «${itemA.groupName || itemA.groupId}» المقررة سابقاً يوم ${getDayNameArabic(itemA.dayOfWeek)} (${itemA.startTime} - ${itemA.endTime}).`
      });
    }
  }

  const addedCount = diffItems.filter(d => d.diffType === 'added').length;
  const removedCount = diffItems.filter(d => d.diffType === 'removed').length;
  const modifiedCount = diffItems.filter(d => d.diffType === 'modified').length;
  const unchangedCount = diffItems.filter(d => d.diffType === 'unchanged').length;

  return {
    versionAId: versionA.id,
    versionBId: versionB.id,
    versionANumber: versionA.versionNumber,
    versionBNumber: versionB.versionNumber,
    items: diffItems,
    stats: {
      addedCount,
      removedCount,
      modifiedCount,
      unchangedCount,
      netConflictDelta: 0
    }
  };
}

function toPartialTask(item: ScheduleVersionItem): Partial<SchedulingTask> {
  return {
    id: item.id,
    courseId: item.courseId,
    courseName: item.courseName || '',
    professorId: item.professorId,
    professorName: item.professorName || '',
    groupId: item.groupId,
    groupName: item.groupName || '',
    sessionType: item.sessionType,
    assignedRoomId: item.roomId,
    assignedRoomName: item.roomName || '',
    assignedSlot: {
      dayOfWeek: item.dayOfWeek,
      startTime: item.startTime,
      endTime: item.endTime
    },
    itemStatus: item.itemStatus
  };
}
