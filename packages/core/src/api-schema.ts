import { z } from 'zod';

/**
 * Standard API v1 Error Response Structure
 */
export interface ApiV1ErrorPayload {
  error: {
    code: string;
    message_ar: string;
    trace_id: string;
    details?: any[];
  };
}

export function formatV1Error(
  code: string,
  messageAr: string,
  traceId: string,
  details?: any[]
): ApiV1ErrorPayload {
  return {
    error: {
      code,
      message_ar: messageAr,
      trace_id: traceId,
      ...(details ? { details } : {})
    }
  };
}

// ==========================================
// Zod Schemas for Input Validation
// ==========================================

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, 'اسم القسم يجب أن لا يقل عن حرفين').max(150),
  code: z.string().trim().max(50).optional().nullable()
});

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  code: z.string().trim().max(50).optional().nullable()
});

export const createRoomSchema = z.object({
  name: z.string().trim().min(1, 'اسم القاعة مطلوب').max(100),
  capacity: z.coerce.number().int().min(0, 'السعة يجب أن تكون رقماً موجباً').default(0)
});

export const updateRoomSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  capacity: z.coerce.number().int().min(0).optional(),
  version: z.coerce.number().int().optional()
});

export const createCourseSchema = z.object({
  name: z.string().trim().min(1, 'اسم المقياس مطلوب').max(150),
  code: z.string().trim().max(50).optional().nullable(),
  department_id: z.coerce.number().int().optional().nullable(),
  specialization_id: z.coerce.number().int().optional().nullable(),
  specialization_ids: z.array(z.coerce.number().int()).optional(),
  semester: z.string().trim().max(10).optional().default('S1'),
  credits: z.coerce.number().int().min(1).max(30).optional().default(3),
  coefficient: z.coerce.number().int().min(1).max(10).optional().default(2),
  has_lecture: z.boolean().optional().default(true),
  has_td: z.boolean().optional().default(true),
  has_tp: z.boolean().optional().default(false),
  study_level: z.string().trim().max(50).optional().default('L1'),
  weekly_hours: z.coerce.number().min(0).max(50).optional().default(3),
  metadata: z.union([z.string(), z.record(z.string(), z.any())]).optional()
});

export const updateCourseSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  code: z.string().trim().max(50).optional().nullable(),
  department_id: z.coerce.number().int().optional().nullable(),
  specialization_id: z.coerce.number().int().optional().nullable(),
  specialization_ids: z.array(z.coerce.number().int()).optional(),
  semester: z.string().trim().max(10).optional(),
  credits: z.coerce.number().int().min(1).max(30).optional(),
  coefficient: z.coerce.number().int().min(1).max(10).optional(),
  has_lecture: z.boolean().optional(),
  has_td: z.boolean().optional(),
  has_tp: z.boolean().optional(),
  study_level: z.string().trim().max(50).optional(),
  weekly_hours: z.coerce.number().min(0).max(50).optional(),
  metadata: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
  version: z.coerce.number().int().optional()
});

export const bulkImportCoursesSchema = z.object({
  courses: z.array(createCourseSchema),
  skipErrors: z.boolean().optional().default(true),
  replace_existing: z.boolean().optional().default(false)
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'اسم الفوج مطلوب').max(100),
  specialization: z.string().trim().max(100).optional().nullable(),
  department_id: z.coerce.number().int().optional().nullable(),
  parent_group_id: z.coerce.number().int().optional().nullable(),
  group_type: z.string().trim().default('group'),
  year: z.string().trim().optional().nullable()
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  specialization: z.string().trim().max(100).optional().nullable(),
  department_id: z.coerce.number().int().optional().nullable(),
  parent_group_id: z.coerce.number().int().optional().nullable(),
  group_type: z.string().trim().optional(),
  year: z.string().trim().optional().nullable(),
  version: z.coerce.number().int().optional()
});

export const createProfessorSchema = z.object({
  name: z.string().trim().min(2, 'اسم الأستاذ يجب أن لا يقل عن حرفين'),
  email: z.string().email('البريد الإلكتروني غير صالح').optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  title: z.string().trim().optional().nullable(),
  academic_title: z.string().trim().optional().nullable(),
  academic_rank: z.string().trim().optional().nullable(),
  is_temporary: z.boolean().optional().default(false)
});

export const updateProfessorSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().email('البريد الإلكتروني غير صالح').optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  title: z.string().trim().optional().nullable(),
  academic_title: z.string().trim().optional().nullable(),
  academic_rank: z.string().trim().optional().nullable(),
  is_temporary: z.boolean().optional(),
  version: z.coerce.number().int().optional()
});

export const createProfessorHistorySchema = z.object({
  academic_year: z.string().min(4, 'السنة الجامعية مطلوبة (مثلاً 2026-2027)'),
  academic_year_id: z.coerce.number().int().optional().nullable(),
  academic_rank: z.string().trim().min(1, 'الرتبة الأكاديمية مطلوبة'),
  is_temporary: z.boolean().optional().default(false),
  department: z.string().optional().nullable(),
  notes: z.string().optional().default('')
});

export const bulkImportProfessorsSchema = z.object({
  professors: z.array(createProfessorSchema).min(1, 'قائمة الأساتذة يجب أن تحتوي على أستاذ واحد على الأقل')
});

export const createAssignmentSchema = z.object({
  group_id: z.coerce.number().int({ message: 'معرف الفوج مطلوب' }),
  course_id: z.coerce.number().int({ message: 'معرف المقياس مطلوب' }),
  professor_id: z.coerce.number().int({ message: 'معرف الأستاذ مطلوب' }),
  room_id: z.coerce.number().int({ message: 'معرف القاعة مطلوب' }),
  day_of_week: z.coerce.number().int().min(0).max(6, 'اليوم يجب أن يكون بين 0 (السبت) و 6 (الجمعة)'),
  start_time: z.string().regex(/^\d{1,2}:\d{2}$/, 'توقيت البداية غير صالح (HH:mm)'),
  end_time: z.string().regex(/^\d{1,2}:\d{2}$/, 'توقيت النهاية غير صالح (HH:mm)'),
  academic_year: z.string().optional().default(''),
  semester: z.string().optional().default('1'),
  specialization: z.string().optional().default(''),
  session_type: z.string().optional().default('lecture')
});

export const updateAssignmentSchema = z.object({
  group_id: z.coerce.number().int().optional(),
  course_id: z.coerce.number().int().optional(),
  professor_id: z.coerce.number().int().optional(),
  room_id: z.coerce.number().int().optional(),
  day_of_week: z.coerce.number().int().min(0).max(6).optional(),
  start_time: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  end_time: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  academic_year: z.string().optional(),
  semester: z.string().optional(),
  specialization: z.string().optional(),
  session_type: z.string().optional(),
  version: z.coerce.number().int().optional()
});

export const swapAssignmentSchema = z.object({
  idA: z.coerce.number().int({ message: 'معرف الحصة الأولى مطلوب' }),
  idB: z.coerce.number().int({ message: 'معرف الحصة الثانية مطلوب' })
});

export const moveAssignmentSchema = z.object({
  day_of_week: z.coerce.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{1,2}:\d{2}$/),
  end_time: z.string().regex(/^\d{1,2}:\d{2}$/),
  room_id: z.coerce.number().int().optional(),
  version: z.coerce.number().int().optional()
});

export const createExtraSessionSchema = z.object({
  group_id: z.coerce.number().int().optional().nullable(),
  group_ids: z.array(z.coerce.number().int()).optional(),
  room_ids: z.array(z.coerce.number().int()).optional(),
  course_id: z.coerce.number().int({ message: 'معرف المقياس مطلوب' }),
  professor_id: z.coerce.number().int({ message: 'معرف الأستاذ مطلوب' }),
  room_id: z.coerce.number().int().optional(),
  session_date: z.string().min(8, 'تاريخ الحصة مطلوب (YYYY-MM-DD)'),
  start_time: z.string().regex(/^\d{1,2}:\d{2}$/, 'توقيت البداية غير صالح (HH:mm)'),
  end_time: z.string().regex(/^\d{1,2}:\d{2}$/, 'توقيت النهاية غير صالح (HH:mm)'),
  session_type: z.string().optional().default('makeup'),
  description: z.string().optional().default(''),
  academic_year: z.string().optional().default(''),
  semester: z.string().optional().default(''),
  reason: z.string().optional().default(''),
  exam_note: z.string().optional().default(''),
  ignore_conflicts: z.boolean().optional().default(false)
});

export const updateExtraSessionSchema = z.object({
  group_id: z.coerce.number().int().optional().nullable(),
  group_ids: z.array(z.coerce.number().int()).optional(),
  room_ids: z.array(z.coerce.number().int()).optional(),
  course_id: z.coerce.number().int().optional(),
  professor_id: z.coerce.number().int().optional(),
  room_id: z.coerce.number().int().optional(),
  session_date: z.string().min(8).optional(),
  start_time: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  end_time: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  session_type: z.string().optional(),
  description: z.string().optional(),
  academic_year: z.string().optional(),
  semester: z.string().optional(),
  reason: z.string().optional(),
  is_archived: z.coerce.number().int().optional(),
  exam_note: z.string().optional(),
  version: z.coerce.number().int().optional(),
  ignore_conflicts: z.boolean().optional()
});

// ==========================================
// P13 Scheduling & Versions Validation Schemas
// ==========================================

export const generateScheduleSchema = z.object({
  semester_id: z.coerce.number().int().optional(),
  academic_year: z.string().optional(),
  mode: z.enum(['fast', 'optimize']).optional().default('fast'),
  timeout_ms: z.coerce.number().int().min(1000).max(180000).optional().default(30000),
  save_as_draft: z.boolean().optional().default(false),
  draft_title: z.string().optional().default('مسودة مقترحة آلياً'),
  seed: z.coerce.number().int().optional()
});

export const explainConflictsSchema = z.object({
  sessions: z.array(z.any()).optional(),
  semester_id: z.coerce.number().int().optional(),
  academic_year: z.string().optional()
});

export const createScheduleVersionSchema = z.object({
  semester_id: z.coerce.number().int({ message: 'معرف السداسي مطلوب' }),
  title: z.string().trim().min(1, 'عنوان الإصدار مطلوب'),
  note: z.string().optional().default(''),
  items: z.array(z.any()).optional().default([])
});

export const transitionVersionSchema = z.object({
  new_status: z.enum(['draft', 'review', 'approved', 'published', 'archived']),
  note: z.string().optional()
});

export const updateVersionItemDecisionSchema = z.object({
  decision: z.enum(['accepted', 'rejected', 'modified', 'proposed']),
  note: z.string().optional(),
  updated_data: z.record(z.string(), z.any()).optional()
});

export const simulateImpactSchema = z.object({
  semester_id: z.coerce.number().int().optional(),
  proposed_items: z.array(z.any()).min(1, 'قائمة الحصص المقترحة مطلوبة للتحليل')
});


