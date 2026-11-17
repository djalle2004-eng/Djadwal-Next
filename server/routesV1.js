const express = require('express');
const router = express.Router();

const { traceMiddleware } = require('./middleware/trace.js');
const { idempotencyMiddleware } = require('./middleware/idempotency.js');
const { validateBody } = require('./middleware/validate.js');
const { formatV1Error } = require('../packages/core/src/api-schema.js');

const schemas = require('../packages/core/src/api-schema.js');
const deptModule = require('./modules/catalog/departments.js');
const roomModule = require('./modules/catalog/rooms.js');
const courseModule = require('./modules/catalog/courses.js');
const groupModule = require('./modules/catalog/groups.js');
const profModule = require('./modules/professors/index.js');
const assignModule = require('./modules/assignments/index.js');
const extraSessionModule = require('./modules/extra-sessions/index.js');
const acadModule = require('./modules/academic/index.js');
const userModule = require('./modules/users/index.js');
const auditModule = require('./modules/audit/index.js');
const compatModule = require('./modules/compat/index.js');
const authModule = require('./modules/auth/index.js');
const backupModule = require('./modules/backup/index.js');
const settingsModule = require('./modules/settings/index.js');
const schedulingModule = require('./modules/scheduling/index.js');

// 1. Core V1 Middlewares
router.use(traceMiddleware);
router.use(idempotencyMiddleware());

// 2. Health & Compatibility
router.get('/ping', (req, res) => {
  res.json({ status: 'ok', apiVersion: '1.0.0', timestamp: new Date().toISOString() });
});

router.get('/compat-report', compatModule.getCompatReport);

// 2.5 Authentication & Session Routes
router.post('/auth/signin', authModule.handleSignin);
router.post('/auth/login', authModule.handleSignin);
router.post('/auth/signout', authModule.handleSignout);
router.post('/auth/logout', authModule.handleSignout);
router.post('/auth/refresh', authModule.handleRefresh);

// 3. Catalog - Departments
router.get(['/catalog/departments', '/departments'], deptModule.listDepartments);
router.post('/catalog/departments', validateBody(schemas.createDepartmentSchema), deptModule.createDepartment);
router.get(['/catalog/departments/:id', '/departments/:id'], deptModule.getDepartment);
router.put('/catalog/departments/:id', validateBody(schemas.updateDepartmentSchema), deptModule.updateDepartment);
router.delete('/catalog/departments/:id', deptModule.deleteDepartment);
router.post('/catalog/departments/:id/archive-cascade', deptModule.archiveCascadeDepartment);

// 4. Catalog - Rooms
router.get(['/rooms/available', '/catalog/rooms/available'], extraSessionModule.getAvailableRoomsEndpoint);
router.get(['/catalog/rooms', '/rooms'], roomModule.listRooms);
router.post(['/catalog/rooms', '/rooms'], validateBody(schemas.createRoomSchema), roomModule.createRoom);
router.get(['/catalog/rooms/:id', '/rooms/:id'], roomModule.getRoom);
router.put(['/catalog/rooms/:id', '/rooms/:id'], validateBody(schemas.updateRoomSchema), roomModule.updateRoom);
router.delete(['/catalog/rooms/:id', '/rooms/:id'], roomModule.deleteRoom);
router.post(['/catalog/rooms/:id/restore', '/rooms/:id/restore'], roomModule.restoreRoom);

// 5. Catalog - Courses
router.get(['/catalog/courses', '/courses'], courseModule.listCourses);
router.post(['/catalog/courses', '/courses'], validateBody(schemas.createCourseSchema), courseModule.createCourse);
router.get(['/catalog/courses/:id', '/courses/:id'], courseModule.getCourse);
router.put(['/catalog/courses/:id', '/courses/:id'], validateBody(schemas.updateCourseSchema), courseModule.updateCourse);
router.delete(['/catalog/courses/:id', '/courses/:id'], courseModule.deleteCourse);
router.post(['/catalog/courses/:id/restore', '/courses/:id/restore'], courseModule.restoreCourse);

// 6. Catalog - Groups
router.get(['/catalog/groups', '/groups'], groupModule.listGroups);
router.post(['/catalog/groups', '/groups'], validateBody(schemas.createGroupSchema), groupModule.createGroup);
router.get(['/catalog/groups/:id', '/groups/:id'], groupModule.getGroup);
router.put(['/catalog/groups/:id', '/groups/:id'], validateBody(schemas.updateGroupSchema), groupModule.updateGroup);
router.delete(['/catalog/groups/:id', '/groups/:id'], groupModule.deleteGroup);
router.post(['/catalog/groups/:id/restore', '/groups/:id/restore'], groupModule.restoreGroup);

// 7. Professors
router.get('/professors', profModule.listProfessors);
router.post('/professors', validateBody(schemas.createProfessorSchema), profModule.createProfessor);
router.get('/professors/:id', profModule.getProfessor);
router.put('/professors/:id', validateBody(schemas.updateProfessorSchema), profModule.updateProfessor);
router.delete('/professors/:id', profModule.deleteProfessor);
router.post('/professors/:id/restore', profModule.restoreProfessor);
router.post('/professors/bulk-import', validateBody(schemas.bulkImportProfessorsSchema), profModule.bulkImportProfessors);

// 8. Assignments
router.get('/assignments', assignModule.listAssignments);
router.post('/assignments', validateBody(schemas.createAssignmentSchema), assignModule.createAssignment);
router.get('/assignments/coverage-audit', assignModule.getCoverageAudit);
router.get('/assignments/conflicts/audit', assignModule.auditConflictsEndpoint);
router.post('/assignments/check-conflicts', validateBody(schemas.checkAssignmentConflictsSchema), assignModule.checkConflictsEndpoint);
router.post('/assignments/bulk-import/preview', assignModule.previewBulkImport);
router.post('/assignments/bulk-import', validateBody(schemas.bulkImportAssignmentsSchema), assignModule.bulkImportAssignments);
router.get('/assignments/:id', assignModule.getAssignment);
router.put('/assignments/:id', validateBody(schemas.updateAssignmentSchema), assignModule.updateAssignment);
router.delete('/assignments/:id', assignModule.deleteAssignment);
router.post('/assignments/swap', validateBody(schemas.swapAssignmentSchema), assignModule.swapAssignments);
router.post('/assignments/:id/move', validateBody(schemas.moveAssignmentSchema), assignModule.moveAssignment);

// 8.5 Extra Sessions (Makeup, Extra, Exams)
router.get('/extra-sessions/available-rooms', extraSessionModule.getAvailableRoomsEndpoint);
router.get('/extra-sessions', extraSessionModule.listExtraSessions);
router.post('/extra-sessions', validateBody(schemas.createExtraSessionSchema), extraSessionModule.createExtraSession);
router.get('/extra-sessions/:id', extraSessionModule.getExtraSession);
router.put('/extra-sessions/:id', validateBody(schemas.updateExtraSessionSchema), extraSessionModule.updateExtraSession);
router.delete('/extra-sessions/:id', extraSessionModule.deleteExtraSession);
router.post('/extra-sessions/archive', extraSessionModule.archivePastSessions);
router.post('/extra-sessions/check-conflicts', extraSessionModule.checkConflictsEndpoint);

// 9. Academic Years & Semesters
router.get('/academic/years', acadModule.listAcademicYears);
router.get('/academic/years/active', acadModule.getActiveAcademicYear);
router.post('/academic/years', acadModule.createAcademicYear);
router.post('/academic/years/:id/activate', acadModule.activateAcademicYear);
router.delete('/academic/years/:id', acadModule.deleteAcademicYear);

router.get('/academic/semesters', acadModule.listSemesters);
router.get('/academic/semesters/active', acadModule.getActiveSemester);
router.post('/academic/semesters', acadModule.createSemester);
router.put('/academic/semesters/:id', acadModule.updateSemester);
router.post('/academic/semesters/:id/activate', acadModule.activateSemester);
router.delete('/academic/semesters/:id', acadModule.deleteSemester);

// 10. Audit, Changes & Deletion Impact
router.get('/changes', auditModule.listChanges);
router.post('/changes/:id/undo', auditModule.undoChange);
router.get('/:entity/:id/delete-impact', auditModule.getDeleteImpact);

// 10.5 Users & RBAC
router.get('/users', userModule.listUsers);
router.post('/users', userModule.createUser);
router.get('/users/:id', userModule.getUser);
router.put('/users/:id', userModule.updateUser);
router.delete('/users/:id', userModule.deleteUser);
router.get('/users/:id/permissions', userModule.getUserPermissions);
router.put('/users/:id/permissions', userModule.updateUserPermissions);

// 10.6 Print Settings & Official Identity
router.get('/settings/print', settingsModule.getPrintSettings);
router.put('/settings/print', settingsModule.updatePrintSettings);
router.post('/settings/print', settingsModule.updatePrintSettings);

// 10.7 System Backup & Full Snapshot
router.get(['/system/backup/snapshot', '/backup/snapshot'], backupModule.exportBackupSnapshot);

// 10.8 P13: Auto-Scheduler & Schedule Versioning & Approval Workflow
router.post('/scheduling/generate', validateBody(schemas.generateScheduleSchema), schedulingModule.generateScheduleEndpoint);
router.post('/scheduling/conflicts/explain', validateBody(schemas.explainConflictsSchema), schedulingModule.explainConflictsEndpoint);
router.post('/scheduling/impact-simulate', validateBody(schemas.simulateImpactSchema), schedulingModule.simulateImpactEndpoint);
router.get('/scheduling/versions', schedulingModule.listVersionsEndpoint);
router.post('/scheduling/versions', validateBody(schemas.createScheduleVersionSchema), schedulingModule.createVersionEndpoint);
router.get('/scheduling/versions/diff', schedulingModule.getVisualDiffEndpoint);
router.get('/scheduling/versions/:id', schedulingModule.getVersionDetailsEndpoint);
router.post('/scheduling/versions/:id/transition', validateBody(schemas.transitionVersionSchema), schedulingModule.transitionVersionEndpoint);
router.post('/scheduling/versions/:id/rollback', schedulingModule.rollbackVersionEndpoint);
router.patch('/scheduling/versions/:id/items/:itemId', validateBody(schemas.updateVersionItemDecisionSchema), schedulingModule.updateItemDecisionEndpoint);


// 11. Central V1 Error Handler
router.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');
  const messageAr = err.message || 'حدث خطأ غير متوقع أثناء معالجة الطلب';

  res.status(statusCode).json(formatV1Error(code, messageAr, req.traceId || 'unknown', err.details));
});

module.exports = router;

