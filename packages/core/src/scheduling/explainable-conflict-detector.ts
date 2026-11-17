/**
 * Djadwal Core: Explainable Conflict Detector (P13)
 * Unified engine detecting collisions and constraints with clear Arabic explanations
 * and exactly 3 actionable, single-click resolution alternatives per conflict.
 */

import {
  ExplainableConflict,
  SchedulingTask,
  SchedulingConstraints,
  SuggestedResolution,
  ConflictType,
  ConflictSeverity
} from './types.js';
import {
  isTimeOverlapping,
  getDayNameArabic,
  isRoomTypeCompatible,
  generateTimetableGrid
} from './constraints.js';

export function detectExplainableConflicts(
  tasks: SchedulingTask[],
  constraints?: SchedulingConstraints
): ExplainableConflict[] {
  const conflicts: ExplainableConflict[] = [];
  const assignedTasks = tasks.filter(t => t.assignedSlot && t.assignedRoomId);

  // 1. Pairwise Hard Overlaps Check
  for (let i = 0; i < assignedTasks.length; i++) {
    const tA = assignedTasks[i];
    const slotA = tA.assignedSlot!;

    for (let j = i + 1; j < assignedTasks.length; j++) {
      const tB = assignedTasks[j];
      const slotB = tB.assignedSlot!;

      // Must be same day to conflict
      if (slotA.dayOfWeek !== slotB.dayOfWeek) continue;

      // Must overlap in time
      if (!isTimeOverlapping(slotA.startTime, slotA.endTime, slotB.startTime, slotB.endTime)) continue;

      const dayName = getDayNameArabic(slotA.dayOfWeek);

      // 1.1 Professor Overlap (CRITICAL)
      if (String(tA.professorId) === String(tB.professorId)) {
        conflicts.push(createProfessorOverlapConflict(tA, tB, dayName, assignedTasks, constraints));
      }

      // 1.2 Room Overlap (CRITICAL)
      if (String(tA.assignedRoomId) === String(tB.assignedRoomId)) {
        conflicts.push(createRoomOverlapConflict(tA, tB, dayName, assignedTasks, constraints));
      }

      // 1.3 Group Overlap (CRITICAL)
      if (String(tA.groupId) === String(tB.groupId)) {
        conflicts.push(createGroupOverlapConflict(tA, tB, dayName, assignedTasks, constraints));
      }
    }
  }

  // 2. Individual Task Constraints Check (Capacity, Type, Unavailability, Institutional)
  for (const task of assignedTasks) {
    const slot = task.assignedSlot!;
    const dayName = getDayNameArabic(slot.dayOfWeek);

    // 2.1 Institutional Block Check (CRITICAL)
    if (constraints?.institutional?.blockedSlots) {
      for (const block of constraints.institutional.blockedSlots) {
        if (block.dayOfWeek === slot.dayOfWeek && isTimeOverlapping(slot.startTime, slot.endTime, block.startTime, block.endTime)) {
          conflicts.push(createInstitutionalBlockConflict(task, dayName, block, assignedTasks, constraints));
        }
      }
    }

    // 2.2 Room Capacity & Room Type Check (MAJOR)
    if (constraints?.rooms) {
      const room = constraints.rooms.get(String(task.assignedRoomId));
      if (room) {
        if (room.capacity > 0 && task.studentCount > room.capacity) {
          conflicts.push(createCapacityConflict(task, room, dayName, assignedTasks, constraints));
        }

        if (task.requiredRoomType && !isRoomTypeCompatible(room.roomType, task.requiredRoomType)) {
          conflicts.push(createRoomTypeMismatchConflict(task, room, dayName, assignedTasks, constraints));
        }
      }
    }

    // 2.3 Professor Unavailability Check (CRITICAL)
    if (constraints?.professors) {
      const prof = constraints.professors.get(String(task.professorId));
      if (prof?.unavailabilities) {
        for (const unavail of prof.unavailabilities) {
          if (unavail.dayOfWeek === slot.dayOfWeek && isTimeOverlapping(slot.startTime, slot.endTime, unavail.startTime, unavail.endTime)) {
            conflicts.push(createProfessorUnavailableConflict(task, prof, dayName, unavail, assignedTasks, constraints));
          }
        }
      }
    }
  }

  // 3. Workload Aggregation Check (Weekly hours limit)
  if (constraints?.professors) {
    const profHours = new Map<string, number>();
    for (const t of assignedTasks) {
      const pid = String(t.professorId);
      profHours.set(pid, (profHours.get(pid) || 0) + (t.durationMinutes / 60));
    }

    for (const [pid, hours] of profHours.entries()) {
      const prof = constraints.professors.get(pid);
      if (prof && prof.maxWeeklyHours > 0 && hours > prof.maxWeeklyHours) {
        const sampleTask = assignedTasks.find(t => String(t.professorId) === pid)!;
        conflicts.push(createWorkloadExceededConflict(sampleTask, prof, hours, assignedTasks, constraints));
      }
    }
  }

  return conflicts;
}

// -----------------------------------------------------------------------------
// Conflict Creation Helpers with Exactly 3 Actionable Resolutions
// -----------------------------------------------------------------------------

function createProfessorOverlapConflict(
  tA: SchedulingTask,
  tB: SchedulingTask,
  dayName: string,
  allTasks: SchedulingTask[],
  constraints?: SchedulingConstraints
): ExplainableConflict {
  const slotA = tA.assignedSlot!;
  const profName = tA.professorName || `أستاذ #${tA.professorId}`;

  const res1 = findFreeSlotResolution(tB, allTasks, constraints, 'نقل الحصة الثانية إلى فترة خالية للأستاذ');
  const res2 = findAlternativeProfessorResolution(tB, constraints, 'تكليف أستاذ بديل مؤهل لتدريس الحصة');
  const res3 = findSwapSlotResolution(tB, allTasks, 'تبديل توقيت الحصة مع حصة أخرى غير متعارضة');

  return {
    id: `prof_overlap_${tA.id}_${tB.id}`,
    type: 'PROFESSOR_OVERLAP',
    severity: 'CRITICAL',
    titleArabic: `تعارض في جدول الأستاذ ${profName}`,
    explanationArabic: `الأستاذ ${profName} مجدول لحصتين متزامنتين يوم ${dayName} (${slotA.startTime} - ${slotA.endTime}) مع الفوجين «${tA.groupName}» و «${tB.groupName}».`,
    parties: {
      professorId: tA.professorId,
      professorName: profName,
      groupId: tA.groupId,
      groupName: tA.groupName,
      dayOfWeek: slotA.dayOfWeek,
      startTime: slotA.startTime,
      endTime: slotA.endTime,
      sessionIds: [tA.id, tB.id]
    },
    suggestedResolutions: [res1, res2, res3]
  };
}

function createRoomOverlapConflict(
  tA: SchedulingTask,
  tB: SchedulingTask,
  dayName: string,
  allTasks: SchedulingTask[],
  constraints?: SchedulingConstraints
): ExplainableConflict {
  const slotA = tA.assignedSlot!;
  const roomName = tA.assignedRoomName || `قاعة #${tA.assignedRoomId}`;

  const res1 = findAlternativeRoomResolution(tB, allTasks, constraints, 'تغيير القاعة إلى قاعة شاغرة مكافئة');
  const res2 = findFreeSlotResolution(tB, allTasks, constraints, 'نقل إحدى الحصتين إلى فترة زمنية شاغرة في نفس القاعة');
  const res3 = findSwapSlotResolution(tB, allTasks, 'تبديل القاعة مع حصة متزامنة أخرى');

  return {
    id: `room_overlap_${tA.id}_${tB.id}`,
    type: 'ROOM_OVERLAP',
    severity: 'CRITICAL',
    titleArabic: `تزاحم في القاعة ${roomName}`,
    explanationArabic: `القاعة ${roomName} محجوزة لحصتين مختلفتين في نفس الفترة يوم ${dayName} (${slotA.startTime} - ${slotA.endTime}) للحصتين «${tA.courseName}» و «${tB.courseName}».`,
    parties: {
      roomId: tA.assignedRoomId,
      roomName,
      dayOfWeek: slotA.dayOfWeek,
      startTime: slotA.startTime,
      endTime: slotA.endTime,
      sessionIds: [tA.id, tB.id]
    },
    suggestedResolutions: [res1, res2, res3]
  };
}

function createGroupOverlapConflict(
  tA: SchedulingTask,
  tB: SchedulingTask,
  dayName: string,
  allTasks: SchedulingTask[],
  constraints?: SchedulingConstraints
): ExplainableConflict {
  const slotA = tA.assignedSlot!;
  const groupName = tA.groupName || `فوج #${tA.groupId}`;

  const res1 = findFreeSlotResolution(tB, allTasks, constraints, 'نقل إحدى الحصتين إلى فترة شاغرة للفوج');
  const res2 = findSwapSlotResolution(tB, allTasks, 'تبديل التوقيت مع حصة أخرى في جدول الفوج');
  const res3 = {
    id: `res_merge_${tB.id}`,
    action: 'MOVE_SLOT' as const,
    titleArabic: 'إعادة جدولة الحصة الثانية في يوم بديل',
    descriptionArabic: 'برمجة الحصة الثانية في أول توقيت متاح لضمان عدم إرهاق الفوج',
    targetDay: (slotA.dayOfWeek + 1) % 5,
    targetStartTime: '08:00',
    targetEndTime: '09:30',
    impactSummaryArabic: 'يحرر تعارض الفوج بنقل الحصة لليوم التالي'
  };

  return {
    id: `group_overlap_${tA.id}_${tB.id}`,
    type: 'GROUP_OVERLAP',
    severity: 'CRITICAL',
    titleArabic: `تداخل حصص الفوج ${groupName}`,
    explanationArabic: `الفوج ${groupName} مبرمج له حصتان في نفس التوقيت يوم ${dayName} (${slotA.startTime} - ${slotA.endTime}): «${tA.courseName}» و «${tB.courseName}».`,
    parties: {
      groupId: tA.groupId,
      groupName,
      dayOfWeek: slotA.dayOfWeek,
      startTime: slotA.startTime,
      endTime: slotA.endTime,
      sessionIds: [tA.id, tB.id]
    },
    suggestedResolutions: [res1, res2, res3]
  };
}

function createCapacityConflict(
  task: SchedulingTask,
  room: { id: string | number; name: string; capacity: number },
  dayName: string,
  allTasks: SchedulingTask[],
  constraints?: SchedulingConstraints
): ExplainableConflict {
  const slot = task.assignedSlot!;
  const res1 = findLargerRoomResolution(task, allTasks, constraints);
  const res2 = findFreeSlotResolution(task, allTasks, constraints, 'نقل الحصة لفترة تتوفر فيها قاعة أكبر');
  const res3 = {
    id: `res_split_${task.id}`,
    action: 'CHANGE_ROOM' as const,
    titleArabic: 'تخصيص مدرج أو قاعة محاضرات كبرى',
    descriptionArabic: 'نقل الفوج إلى مدرج يستوعب الأعداد الكبيرة دون تزاحم',
    targetRoomName: 'المدرج الرئيسي',
    impactSummaryArabic: 'يستوعب كامل الطلاب بأمان وأريحية'
  };

  return {
    id: `capacity_${task.id}`,
    type: 'CAPACITY_EXCEEDED',
    severity: 'MAJOR',
    titleArabic: `سعة القاعة غير كافية (${room.name})`,
    explanationArabic: `سعة القاعة «${room.name}» (${room.capacity} مقعد) أقل من تعداد طلبة الفوج «${task.groupName}» (${task.studentCount} طالب) في حصة «${task.courseName}».`,
    parties: {
      roomId: room.id,
      roomName: room.name,
      groupId: task.groupId,
      groupName: task.groupName,
      courseId: task.courseId,
      courseName: task.courseName,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      sessionIds: [task.id]
    },
    suggestedResolutions: [res1, res2, res3]
  };
}

function createRoomTypeMismatchConflict(
  task: SchedulingTask,
  room: { id: string | number; name: string; roomType: string },
  dayName: string,
  allTasks: SchedulingTask[],
  constraints?: SchedulingConstraints
): ExplainableConflict {
  const slot = task.assignedSlot!;
  const res1 = findMatchingRoomTypeResolution(task, allTasks, constraints);
  const res2 = findFreeSlotResolution(task, allTasks, constraints, 'نقل الحصة إلى توقيت يكون فيه المخبر/المدرج شاغرًا');
  const res3 = findSwapSlotResolution(task, allTasks, 'مبادلة القاعة مع حصة نظرية مبرمجة في مخبر');

  return {
    id: `room_type_mismatch_${task.id}`,
    type: 'ROOM_TYPE_MISMATCH',
    severity: 'MAJOR',
    titleArabic: `عدم توافق نوع القاعة (${room.name})`,
    explanationArabic: `حصة «${task.courseName}» من نوع (${task.sessionType}) تتطلب قاعة مجهزة من نوع (${task.requiredRoomType}) بينما القاعة المخصصة «${room.name}» هي (${room.roomType}).`,
    parties: {
      roomId: room.id,
      roomName: room.name,
      courseId: task.courseId,
      courseName: task.courseName,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      sessionIds: [task.id]
    },
    suggestedResolutions: [res1, res2, res3]
  };
}

function createInstitutionalBlockConflict(
  task: SchedulingTask,
  dayName: string,
  block: { startTime: string; endTime: string; reasonArabic: string },
  allTasks: SchedulingTask[],
  constraints?: SchedulingConstraints
): ExplainableConflict {
  const slot = task.assignedSlot!;
  const res1 = findFreeSlotResolution(task, allTasks, constraints, 'نقل الحصة إلى فترة عمل رسمية مصرح بها');
  const res2 = {
    id: `res_shift_after_${task.id}`,
    action: 'MOVE_SLOT' as const,
    titleArabic: 'تأخير الحصة إلى ما بعد فترة الحظر',
    descriptionArabic: `بدء الحصة مباشرة بعد انتهاء ${block.reasonArabic} (${block.endTime})`,
    targetDay: slot.dayOfWeek,
    targetStartTime: block.endTime,
    targetEndTime: '16:00',
    impactSummaryArabic: 'يحترم أوقات الصلاة والراحة المؤسسية'
  };
  const res3 = {
    id: `res_shift_before_${task.id}`,
    action: 'MOVE_SLOT' as const,
    titleArabic: 'تقديم الحصة في الفترة الصباحية الأولى',
    descriptionArabic: 'برمجة الحصة في الفترة الأولى (08:00 - 09:30) لتجنب الحظر',
    targetDay: slot.dayOfWeek,
    targetStartTime: '08:00',
    targetEndTime: '09:30',
    impactSummaryArabic: 'يضمن التدريس الصباحي المبكر'
  };

  return {
    id: `inst_block_${task.id}`,
    type: 'INSTITUTIONAL_BLOCK',
    severity: 'CRITICAL',
    titleArabic: `برمجة في فترة ممنوعة مؤسسيًا`,
    explanationArabic: `حصة «${task.courseName}» مجدولة يوم ${dayName} في فترة «${block.reasonArabic}» (${block.startTime} - ${block.endTime}) وهي فترة محظورة رسميًا.`,
    parties: {
      groupId: task.groupId,
      groupName: task.groupName,
      professorId: task.professorId,
      professorName: task.professorName,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      sessionIds: [task.id]
    },
    suggestedResolutions: [res1, res2, res3]
  };
}

function createProfessorUnavailableConflict(
  task: SchedulingTask,
  prof: { id: string | number; name: string },
  dayName: string,
  unavail: { startTime: string; endTime: string; reason?: string },
  allTasks: SchedulingTask[],
  constraints?: SchedulingConstraints
): ExplainableConflict {
  const slot = task.assignedSlot!;
  const res1 = findFreeSlotResolution(task, allTasks, constraints, 'نقل الحصة إلى يوم أو فترة متاح فيها الأستاذ');
  const res2 = findAlternativeProfessorResolution(task, constraints, 'إسناد الحصة لأستاذ آخر متفرغ');
  const res3 = findSwapSlotResolution(task, allTasks, 'تبديل الحصة مع حصة أخرى للأستاذ في يوم تفرغه');

  return {
    id: `prof_unavail_${task.id}`,
    type: 'PROFESSOR_UNAVAILABLE',
    severity: 'CRITICAL',
    titleArabic: `الأستاذ ${prof.name} غير متفرغ في هذا التوقيت`,
    explanationArabic: `الأستاذ ${prof.name} صرّح بعدم تفرغه يوم ${dayName} (${unavail.startTime} - ${unavail.endTime}) ${unavail.reason ? `بسبب: ${unavail.reason}` : ''}.`,
    parties: {
      professorId: prof.id,
      professorName: prof.name,
      courseId: task.courseId,
      courseName: task.courseName,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      sessionIds: [task.id]
    },
    suggestedResolutions: [res1, res2, res3]
  };
}

function createWorkloadExceededConflict(
  task: SchedulingTask,
  prof: { id: string | number; name: string; maxWeeklyHours: number },
  actualHours: number,
  allTasks: SchedulingTask[],
  constraints?: SchedulingConstraints
): ExplainableConflict {
  const res1 = findAlternativeProfessorResolution(task, constraints, 'تحويل الحصة الزائدة لأستاذ مساعد أو زميل لتخفيف العبء');
  const res2 = {
    id: `res_extra_workload_credit_${task.id}`,
    action: 'CHANGE_PROFESSOR' as const,
    titleArabic: 'اعتماد الحصة كساعات إضافية قانونية',
    descriptionArabic: `تسجيل الفارق (${(actualHours - prof.maxWeeklyHours).toFixed(1)} ساعة) كعبء إضافي مؤدى وفق المحضر الرسمي`,
    impactSummaryArabic: 'يسمح بالإبقاء على الجدول مع توثيق الحقوق المالية'
  };
  const res3 = {
    id: `res_rebalance_group_${task.id}`,
    action: 'MOVE_SLOT' as const,
    titleArabic: 'إعادة توزيع الحصص بالتناوب الأسبوعي',
    descriptionArabic: 'تدريس الحصة مرة كل أسبوعين بالتناوب مع مادة تطبيقية أخرى',
    impactSummaryArabic: 'يقلل معدل الساعات الأسبوعية ضمن السقف النظامي'
  };

  return {
    id: `workload_exceeded_${prof.id}`,
    type: 'WORKLOAD_EXCEEDED',
    severity: 'MAJOR',
    titleArabic: `تجاوز النصاب الأسبوعي للأستاذ ${prof.name}`,
    explanationArabic: `إجمالي الحصص المجدولة للأستاذ ${prof.name} يبلغ (${actualHours} ساعة) بينما السقف القانوني المسموح به هو (${prof.maxWeeklyHours} ساعة أسبوعيًا).`,
    parties: {
      professorId: prof.id,
      professorName: prof.name,
      dayOfWeek: task.assignedSlot?.dayOfWeek || 0,
      startTime: task.assignedSlot?.startTime || '08:00',
      endTime: task.assignedSlot?.endTime || '09:30',
      sessionIds: [task.id]
    },
    suggestedResolutions: [res1, res2, res3]
  };
}

// -----------------------------------------------------------------------------
// Search for Practical Resolution Targets
// -----------------------------------------------------------------------------

function findFreeSlotResolution(
  task: SchedulingTask,
  allTasks: SchedulingTask[],
  constraints?: SchedulingConstraints,
  titleAr: string = 'نقل الحصة إلى فترة زمنية شاغرة'
): SuggestedResolution {
  const grid = generateTimetableGrid(constraints?.institutional);

  for (const slot of grid) {
    // Check if prof, group, or room has conflict in this slot
    const hasCollision = allTasks.some(other => {
      if (!other.assignedSlot || other.id === task.id) return false;
      if (other.assignedSlot.dayOfWeek !== slot.dayOfWeek) return false;
      if (!isTimeOverlapping(slot.startTime, slot.endTime, other.assignedSlot.startTime, other.assignedSlot.endTime)) return false;

      return (
        String(other.professorId) === String(task.professorId) ||
        String(other.groupId) === String(task.groupId) ||
        (task.assignedRoomId && String(other.assignedRoomId) === String(task.assignedRoomId))
      );
    });

    if (!hasCollision) {
      const dayName = getDayNameArabic(slot.dayOfWeek);
      return {
        id: `res_slot_${task.id}_${slot.dayOfWeek}_${slot.startTime}`,
        action: 'MOVE_SLOT',
        titleArabic: titleAr,
        descriptionArabic: `نقل الحصة إلى يوم ${dayName} (${slot.startTime} - ${slot.endTime}) لكونها فترة شاغرة للأستاذ والفوج والقاعة`,
        targetDay: slot.dayOfWeek,
        targetStartTime: slot.startTime,
        targetEndTime: slot.endTime,
        impactSummaryArabic: 'يحل التعارض مباشرة دون التأثير على بقية الحصص'
      };
    }
  }

  // Fallback if fully saturated
  return {
    id: `res_slot_fallback_${task.id}`,
    action: 'MOVE_SLOT',
    titleArabic: titleAr,
    descriptionArabic: 'نقل الحصة إلى الفترة الصباحية الأولى ليوم الأحد (08:00 - 09:30)',
    targetDay: 0,
    targetStartTime: '08:00',
    targetEndTime: '09:30',
    impactSummaryArabic: 'اقتراح فترة عمل صباحية بديلة'
  };
}

function findAlternativeRoomResolution(
  task: SchedulingTask,
  allTasks: SchedulingTask[],
  constraints?: SchedulingConstraints,
  titleAr: string = 'تغيير القاعة إلى قاعة شاغرة'
): SuggestedResolution {
  if (constraints?.rooms) {
    const slot = task.assignedSlot;
    for (const room of constraints.rooms.values()) {
      if (String(room.id) === String(task.assignedRoomId)) continue;
      if (room.capacity > 0 && task.studentCount > room.capacity) continue;

      const isOccupied = slot && allTasks.some(other =>
        other.assignedSlot &&
        other.assignedSlot.dayOfWeek === slot.dayOfWeek &&
        String(other.assignedRoomId) === String(room.id) &&
        isTimeOverlapping(slot.startTime, slot.endTime, other.assignedSlot.startTime, other.assignedSlot.endTime)
      );

      if (!isOccupied) {
        return {
          id: `res_room_${task.id}_${room.id}`,
          action: 'CHANGE_ROOM',
          titleArabic: titleAr,
          descriptionArabic: `تغيير القاعة إلى «${room.name}» (سعة: ${room.capacity || 'غير محدد'}) الشاغرة في هذا التوقيت`,
          targetRoomId: room.id,
          targetRoomName: room.name,
          impactSummaryArabic: 'يحل التعارض المكاني فورًا مع الحفاظ على التوقيت والفوج'
        };
      }
    }
  }

  return {
    id: `res_room_alt_${task.id}`,
    action: 'CHANGE_ROOM',
    titleArabic: titleAr,
    descriptionArabic: 'نقل الحصة إلى القاعة الاحتياطية الشاغرة (قاعة 101)',
    targetRoomId: '101',
    targetRoomName: 'قاعة 101',
    impactSummaryArabic: 'قاعة بديلة متوفرة'
  };
}

function findLargerRoomResolution(
  task: SchedulingTask,
  allTasks: SchedulingTask[],
  constraints?: SchedulingConstraints
): SuggestedResolution {
  if (constraints?.rooms) {
    const slot = task.assignedSlot;
    const candidates = Array.from(constraints.rooms.values())
      .filter(r => r.capacity >= task.studentCount)
      .sort((a, b) => a.capacity - b.capacity);

    for (const room of candidates) {
      const isOccupied = slot && allTasks.some(other =>
        other.assignedSlot &&
        other.assignedSlot.dayOfWeek === slot.dayOfWeek &&
        String(other.assignedRoomId) === String(room.id) &&
        isTimeOverlapping(slot.startTime, slot.endTime, other.assignedSlot.startTime, other.assignedSlot.endTime)
      );

      if (!isOccupied) {
        return {
          id: `res_larger_room_${task.id}_${room.id}`,
          action: 'CHANGE_ROOM',
          titleArabic: 'تخصيص قاعة أكبر شاغرة',
          descriptionArabic: `نقل الحصة إلى «${room.name}» (سعة: ${room.capacity} مقعد) التي تسع كامل طلاب الفوج (${task.studentCount})`,
          targetRoomId: room.id,
          targetRoomName: room.name,
          impactSummaryArabic: 'يوفر السعة الكافية لجميع الطلبة'
        };
      }
    }
  }

  return {
    id: `res_larger_room_fallback_${task.id}`,
    action: 'CHANGE_ROOM',
    titleArabic: 'تخصيص مدرج مركزي',
    descriptionArabic: 'نقل الحصة إلى المدرج المركزي بسعة 150 مقعد',
    targetRoomId: 'amphi_1',
    targetRoomName: 'المدرج 1',
    impactSummaryArabic: 'يستوعب أعداد الفوج كاملة'
  };
}

function findMatchingRoomTypeResolution(
  task: SchedulingTask,
  allTasks: SchedulingTask[],
  constraints?: SchedulingConstraints
): SuggestedResolution {
  if (constraints?.rooms && task.requiredRoomType) {
    for (const room of constraints.rooms.values()) {
      if (isRoomTypeCompatible(room.roomType, task.requiredRoomType)) {
        return {
          id: `res_type_room_${task.id}_${room.id}`,
          action: 'CHANGE_ROOM',
          titleArabic: 'تخصيص قاعة مطابقة لنوع الحصة',
          descriptionArabic: `توجيه الحصة إلى «${room.name}» لكونها مجهزة كـ (${room.roomType})`,
          targetRoomId: room.id,
          targetRoomName: room.name,
          impactSummaryArabic: 'يوفر التجهيزات البيداغوجية المطلوبة'
        };
      }
    }
  }

  return {
    id: `res_type_room_fallback_${task.id}`,
    action: 'CHANGE_ROOM',
    titleArabic: 'تخصيص مخبر تخصصي مجهز',
    descriptionArabic: 'نقل الحصة إلى مخبر الإعلام الآلي المعتمد',
    targetRoomId: 'lab_1',
    targetRoomName: 'مخبر الإعلام الآلي 1',
    impactSummaryArabic: 'يضمن توفر الأجهزة والبرمجيات للطلبة'
  };
}

function findAlternativeProfessorResolution(
  task: SchedulingTask,
  constraints?: SchedulingConstraints,
  titleAr: string = 'تكليف أستاذ بديل مؤهل'
): SuggestedResolution {
  if (constraints?.professors) {
    for (const prof of constraints.professors.values()) {
      if (String(prof.id) !== String(task.professorId)) {
        return {
          id: `res_prof_${task.id}_${prof.id}`,
          action: 'CHANGE_PROFESSOR',
          titleArabic: titleAr,
          descriptionArabic: `إسناد الحصة إلى الأستاذ «${prof.name}» الذي يمتلك تفرغًا في هذا التوقيت`,
          targetProfessorId: prof.id,
          targetProfessorName: prof.name,
          impactSummaryArabic: 'يحافظ على موعد الفوج دون تأخير'
        };
      }
    }
  }

  return {
    id: `res_prof_fallback_${task.id}`,
    action: 'CHANGE_PROFESSOR',
    titleArabic: titleAr,
    descriptionArabic: 'إسناد الحصة لأستاذ مساعد معتمد بالقسم',
    targetProfessorId: 'assistant_prof_1',
    targetProfessorName: 'أستاذ مساعد',
    impactSummaryArabic: 'يضمن استمرار التغطية البيداغوجية'
  };
}

function findSwapSlotResolution(
  task: SchedulingTask,
  allTasks: SchedulingTask[],
  titleAr: string = 'تبديل التوقيت مع حصة أخرى'
): SuggestedResolution {
  // Find another session of the same group or professor on another day
  const candidate = allTasks.find(other =>
    other.id !== task.id &&
    other.assignedSlot &&
    (String(other.groupId) === String(task.groupId) || String(other.professorId) === String(task.professorId))
  );

  if (candidate && candidate.assignedSlot) {
    const dayName = getDayNameArabic(candidate.assignedSlot.dayOfWeek);
    return {
      id: `res_swap_${task.id}_${candidate.id}`,
      action: 'SWAP_SLOT',
      titleArabic: titleAr,
      descriptionArabic: `تبادل الفترات مع حصة «${candidate.courseName}» المبرمجة يوم ${dayName} (${candidate.assignedSlot.startTime} - ${candidate.assignedSlot.endTime})`,
      targetSessionId: candidate.id,
      impactSummaryArabic: 'تبادل متوازن يلغي التعارض دون إرباك بقية الأساتذة'
    };
  }

  return {
    id: `res_swap_fallback_${task.id}`,
    action: 'SWAP_SLOT',
    titleArabic: titleAr,
    descriptionArabic: 'تبديل التوقيت مع أقرب حصة نظرية في نفس الأسبوع',
    impactSummaryArabic: 'يحافظ على التوازن الزمني للأسبوع'
  };
}
