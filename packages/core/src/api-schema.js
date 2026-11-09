const { z } = require('zod');

function formatV1Error(code, messageAr, traceId, details) {
  return {
    error: {
      code,
      message_ar: messageAr,
      trace_id: traceId,
      ...(details ? { details } : {})
    }
  };
}

const createDepartmentSchema = z.object({
  name: z.string({ required_error: 'اسم القسم مطلوب' }).trim().min(2, 'اسم القسم يجب أن لا يقل عن حرفين').max(150),
  code: z.string().trim().max(50).optional().nullable()
});

const updateDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  code: z.string().trim().max(50).optional().nullable()
});

const createRoomSchema = z.object({
  name: z.string({ required_error: 'اسم القاعة مطلوب' }).trim().min(1, 'اسم القاعة مطلوب').max(100),
  capacity: z.coerce.number().int().min(0, 'السعة يجب أن تكون رقماً موجباً').default(0)
});

const updateRoomSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  capacity: z.coerce.number().int().min(0).optional(),
  version: z.coerce.number().int().optional()
});

const createCourseSchema = z.object({
  name: z.string({ required_error: 'اسم المقياس مطلوب' }).trim().min(1, 'اسم المقياس مطلوب').max(150),
  code: z.string().trim().max(50).optional().nullable(),
  department_id: z.coerce.number().int().optional().nullable(),
  metadata: z.union([z.string(), z.record(z.any())]).optional()
});

const updateCourseSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  code: z.string().trim().max(50).optional().nullable(),
  department_id: z.coerce.number().int().optional().nullable(),
  metadata: z.union([z.string(), z.record(z.any())]).optional(),
  version: z.coerce.number().int().optional()
});

const createGroupSchema = z.object({
  name: z.string({ required_error: 'اسم الفوج مطلوب' }).trim().min(1, 'اسم الفوج مطلوب').max(100),
  specialization: z.string().trim().max(100).optional().nullable(),
  department_id: z.coerce.number().int().optional().nullable(),
  parent_group_id: z.coerce.number().int().optional().nullable(),
  group_type: z.string().trim().default('group'),
  year: z.string().trim().optional().nullable()
});

const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  specialization: z.string().trim().max(100).optional().nullable(),
  department_id: z.coerce.number().int().optional().nullable(),
  parent_group_id: z.coerce.number().int().optional().nullable(),
  group_type: z.string().trim().optional(),
  year: z.string().trim().optional().nullable(),
  version: z.coerce.number().int().optional()
});

const createProfessorSchema = z.object({
  name: z.string({ required_error: 'اسم الأستاذ مطلوب' }).trim().min(2, 'اسم الأستاذ يجب أن لا يقل عن حرفين'),
  email: z.string().email('البريد الإلكتروني غير صالح').optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  title: z.string().trim().optional().nullable(),
  academic_title: z.string().trim().optional().nullable()
});

const updateProfessorSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().email('البريد الإلكتروني غير صالح').optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  title: z.string().trim().optional().nullable(),
  academic_title: z.string().trim().optional().nullable(),
  version: z.coerce.number().int().optional()
});

const bulkImportProfessorsSchema = z.object({
  professors: z.array(createProfessorSchema).min(1, 'قائمة الأساتذة يجب أن تحتوي على أستاذ واحد على الأقل')
});

const createAssignmentSchema = z.object({
  group_id: z.coerce.number().int({ message: 'معرف الفوج مطلوب' }),
  course_id: z.coerce.number().int({ message: 'معرف المقياس مطلوب' }),
  professor_id: z.coerce.number().int({ message: 'معرف الأستاذ مطلوب' }),
  room_id: z.coerce.number().int({ message: 'معرف القاعة مطلوب' }),
  day_of_week: z.coerce.number().int().min(0).max(6, 'اليوم يجب أن يكون بين 0 و 6'),
  start_time: z.string().regex(/^\d{1,2}:\d{2}$/, 'توقيت البداية غير صالح (HH:mm)'),
  end_time: z.string().regex(/^\d{1,2}:\d{2}$/, 'توقيت النهاية غير صالح (HH:mm)'),
  academic_year: z.string().optional().default(''),
  semester: z.string().optional().default('1'),
  specialization: z.string().optional().default(''),
  session_type: z.string().optional().default('lecture')
});

const updateAssignmentSchema = z.object({
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

const swapAssignmentSchema = z.object({
  idA: z.coerce.number().int({ message: 'معرف الحصة الأولى مطلوب' }),
  idB: z.coerce.number().int({ message: 'معرف الحصة الثانية مطلوب' })
});

const moveAssignmentSchema = z.object({
  day_of_week: z.coerce.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{1,2}:\d{2}$/),
  end_time: z.string().regex(/^\d{1,2}:\d{2}$/),
  room_id: z.coerce.number().int().optional(),
  version: z.coerce.number().int().optional()
});

const createExtraSessionSchema = z.object({
  group_id: z.coerce.number().int().optional().nullable(),
  course_id: z.coerce.number().int({ message: 'معرف المقياس مطلوب' }),
  professor_id: z.coerce.number().int({ message: 'معرف الأستاذ مطلوب' }),
  room_id: z.coerce.number().int({ message: 'معرف القاعة مطلوب' }),
  session_date: z.string().min(8, 'تاريخ الحصة مطلوب (YYYY-MM-DD)'),
  start_time: z.string().regex(/^\d{1,2}:\d{2}$/, 'توقيت البداية غير صالح (HH:mm)'),
  end_time: z.string().regex(/^\d{1,2}:\d{2}$/, 'توقيت النهاية غير صالح (HH:mm)'),
  session_type: z.string().optional().default('makeup'),
  description: z.string().optional().default(''),
  academic_year: z.string().optional().default(''),
  semester: z.string().optional().default(''),
  reason: z.string().optional().default(''),
  exam_note: z.string().optional().default('')
});

const updateExtraSessionSchema = z.object({
  group_id: z.coerce.number().int().optional().nullable(),
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
  version: z.coerce.number().int().optional()
});

module.exports = {
  formatV1Error,
  createDepartmentSchema,
  updateDepartmentSchema,
  createRoomSchema,
  updateRoomSchema,
  createCourseSchema,
  updateCourseSchema,
  createGroupSchema,
  updateGroupSchema,
  createProfessorSchema,
  updateProfessorSchema,
  bulkImportProfessorsSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  swapAssignmentSchema,
  moveAssignmentSchema,
  createExtraSessionSchema,
  updateExtraSessionSchema
};

