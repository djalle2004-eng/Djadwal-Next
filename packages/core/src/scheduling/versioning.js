/**
 * Djadwal Core: Schedule Versioning & Approval Workflow (CommonJS runtime)
 */

const { getDayNameArabic } = require('./constraints.js');

class ScheduleApprovalError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ScheduleApprovalError';
    this.code = code;
  }
}

function validateDualApproval(createdBy, approverId) {
  if (Number(createdBy) === Number(approverId)) {
    throw new ScheduleApprovalError(
      `الموافقة المزدوجة إلزامية: لا يجوز لصانع المسودة (المستخدم #${createdBy}) اعتمادها أو نشرها بنفسه وفق لوائح الحوكمة البيداغوجية.`,
      'DUAL_APPROVAL_VIOLATION'
    );
  }
}

function validatePublishReadiness(version, conflicts) {
  const criticalCount = conflicts
    ? conflicts.filter(c => c.severity === 'CRITICAL').length
    : (version.criticalConflictsCount || version.critical_conflicts_count || 0);

  if (criticalCount > 0) {
    throw new ScheduleApprovalError(
      `يُمنع نشر الجدول لوجود تعارضات حرجة غير مُعالجة (عدد: ${criticalCount}). يجب معالجة كافة التعارضات الحرجة أو اختيار أحد البدائل المقترحة قبل النشر.`,
      'CRITICAL_CONFLICTS_BLOCK_PUBLISH'
    );
  }
}

function canTransitionStatus(currentStatus, newStatus, createdBy, actorId) {
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
      if (newStatus === 'draft') return { allowed: true };
      if (newStatus === 'archived') return { allowed: true };
      return { allowed: false, reasonArabic: 'الإصدار في مرحلة المراجعة ولا يمكن نشره مباشرة إلا بعد الاعتماد الإداري.' };

    case 'approved':
      if (newStatus === 'published') {
        if (Number(createdBy) === Number(actorId)) {
          return { allowed: false, reasonArabic: 'مبدأ الرقابة الثنائية: النشر يتطلب مصادقة إدارية من مستخدم مختلف عن منشئ النسخة.' };
        }
        return { allowed: true };
      }
      if (newStatus === 'draft') return { allowed: true };
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

function computeVisualDiff(versionA, versionB) {
  const itemsA = versionA.items || [];
  const itemsB = versionB.items || [];

  const diffItems = [];
  const mapA = new Map();
  itemsA.forEach(item => {
    const key = `${item.course_id || item.courseId}:${item.group_id || item.groupId}:${item.session_type || item.sessionType || 'lecture'}`;
    mapA.set(key, item);
  });

  const matchedKeysInB = new Set();

  for (const itemB of itemsB) {
    const key = `${itemB.course_id || itemB.courseId}:${itemB.group_id || itemB.groupId}:${itemB.session_type || itemB.sessionType || 'lecture'}`;
    matchedKeysInB.add(key);

    const itemA = mapA.get(key);

    if (!itemA) {
      diffItems.push({
        id: `diff_add_${itemB.id}`,
        diffType: 'added',
        after: toPartialTask(itemB),
        changeSummaryArabic: `إضافة حصة جديدة «${itemB.course_name || itemB.courseName || itemB.course_id}» للفوج «${itemB.group_name || itemB.groupName || itemB.group_id}» يوم ${getDayNameArabic(itemB.day_of_week || itemB.dayOfWeek)} (${itemB.start_time || itemB.startTime} - ${itemB.end_time || itemB.endTime}) في «${itemB.room_name || itemB.roomName || itemB.room_id}».`
      });
    } else {
      const dayA = itemA.day_of_week !== undefined ? itemA.day_of_week : itemA.dayOfWeek;
      const dayB = itemB.day_of_week !== undefined ? itemB.day_of_week : itemB.dayOfWeek;
      const startA = itemA.start_time || itemA.startTime;
      const startB = itemB.start_time || itemB.startTime;
      const endA = itemA.end_time || itemA.endTime;
      const endB = itemB.end_time || itemB.endTime;
      const roomA = itemA.room_id || itemA.roomId;
      const roomB = itemB.room_id || itemB.roomId;
      const profA = itemA.professor_id || itemA.professorId;
      const profB = itemB.professor_id || itemB.professorId;

      const slotChanged = dayA !== dayB || startA !== startB || endA !== endB;
      const roomChanged = String(roomA) !== String(roomB);
      const profChanged = String(profA) !== String(profB);

      if (slotChanged || roomChanged || profChanged) {
        const changes = [];
        if (slotChanged) {
          changes.push(`التوقيت من (${getDayNameArabic(dayA)} ${startA}) إلى (${getDayNameArabic(dayB)} ${startB})`);
        }
        if (roomChanged) {
          changes.push(`القاعة من «${itemA.room_name || itemA.roomName || roomA}» إلى «${itemB.room_name || itemB.roomName || roomB}»`);
        }
        if (profChanged) {
          changes.push(`الأستاذ من «${itemA.professor_name || itemA.professorName || profA}» إلى «${itemB.professor_name || itemB.professorName || profB}»`);
        }

        diffItems.push({
          id: `diff_mod_${itemB.id}`,
          diffType: 'modified',
          before: toPartialTask(itemA),
          after: toPartialTask(itemB),
          changeSummaryArabic: `تعديل حصة «${itemB.course_name || itemB.courseName || itemB.course_id}» للفوج «${itemB.group_name || itemB.groupName || itemB.group_id}»: ${changes.join('، ')}.`
        });
      } else {
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

  for (const [key, itemA] of mapA.entries()) {
    if (!matchedKeysInB.has(key)) {
      const dayA = itemA.day_of_week !== undefined ? itemA.day_of_week : itemA.dayOfWeek;
      const startA = itemA.start_time || itemA.startTime;
      const endA = itemA.end_time || itemA.endTime;
      diffItems.push({
        id: `diff_rem_${itemA.id}`,
        diffType: 'removed',
        before: toPartialTask(itemA),
        changeSummaryArabic: `إلغاء حصة «${itemA.course_name || itemA.courseName || itemA.course_id}» للفوج «${itemA.group_name || itemA.groupName || itemA.group_id}» المقررة سابقاً يوم ${getDayNameArabic(dayA)} (${startA} - ${endA}).`
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
    versionANumber: versionA.versionNumber || versionA.version_number,
    versionBNumber: versionB.versionNumber || versionB.version_number,
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

function toPartialTask(item) {
  return {
    id: item.id,
    courseId: item.course_id || item.courseId,
    courseName: item.course_name || item.courseName || '',
    professorId: item.professor_id || item.professorId,
    professorName: item.professor_name || item.professorName || '',
    groupId: item.group_id || item.groupId,
    groupName: item.group_name || item.groupName || '',
    sessionType: item.session_type || item.sessionType,
    assignedRoomId: item.room_id || item.roomId,
    assignedRoomName: item.room_name || item.roomName || '',
    assignedSlot: {
      dayOfWeek: item.day_of_week !== undefined ? item.day_of_week : item.dayOfWeek,
      startTime: item.start_time || item.startTime,
      endTime: item.end_time || item.endTime
    },
    itemStatus: item.item_status || item.itemStatus
  };
}

module.exports = {
  ScheduleApprovalError,
  validateDualApproval,
  validatePublishReadiness,
  canTransitionStatus,
  computeVisualDiff
};
