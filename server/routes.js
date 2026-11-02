const express = require('express');
const router = express.Router();
const { executeQuery } = require('./database');
const { jwtVerify } = require('jose');
const emailService = require('./emailService');
const auditService = require('./services/audit');
const authService = require('./services/auth');
const { authorize } = require('./authz/authorize');
const { createStranglerProxy } = require('./middleware/stranglerProxy');

// --- Module Handlers ---
const authModule = require('./modules/auth/index.js');
const deptModule = require('./modules/catalog/departments.js');
const roomModule = require('./modules/catalog/rooms.js');
const courseModule = require('./modules/catalog/courses.js');
const groupModule = require('./modules/catalog/groups.js');
const profModule = require('./modules/professors/index.js');
const assignModule = require('./modules/assignments/index.js');
const acadModule = require('./modules/academic/index.js');
const userModule = require('./modules/users/index.js');
const auditModule = require('./modules/audit/index.js');
const settingsModule = require('./modules/settings/index.js');
const aiModule = require('./modules/ai/index.js');

// --- Secrets & Tokens ---
const PRIMARY_JWT_RAW = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const PREVIOUS_JWT_RAW = process.env.JWT_SECRET_PREVIOUS;
const JWT_SECRET = new TextEncoder().encode(PRIMARY_JWT_RAW);
const JWT_SECRET_PREVIOUS = PREVIOUS_JWT_RAW ? new TextEncoder().encode(PREVIOUS_JWT_RAW) : null;

// Isolated Heartbeat Ping: Returns 200 OK from memory in < 5ms without DB touch
router.get('/ping', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch (_) {
    if (JWT_SECRET_PREVIOUS) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET_PREVIOUS);
        return payload;
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

async function requireAuth(req, res, next) {
  const token = req.cookies['__Host-token'] || req.cookies.token || (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/, ''));
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const user = await verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  if (user.sessionId) {
    try {
      const sessions = await executeQuery('SELECT revoked_at, expires_at FROM sessions WHERE id = ?', [user.sessionId]);
      if (sessions.length === 0 || sessions[0].revoked_at !== null || new Date(sessions[0].expires_at) < new Date()) {
        return res.status(401).json({ error: 'SESSION_REVOKED', message: 'انتهت صلاحية الجلسة أو تم إلغاؤها' });
      }
    } catch (_) {}
  }

  req.user = user;
  next();
}

async function logAudit(req, payload) {
  return auditService.logAudit(req, payload);
}

// ==========================================
// 1. Authentication & Session Routes
// ==========================================
router.post('/auth/signin', authModule.handleSignin);
router.post('/auth/login', authModule.handleSignin);
router.post('/auth/signout', authModule.handleSignout);
router.post('/auth/logout', authModule.handleSignout);
router.post('/auth/refresh', authModule.handleRefresh);

router.get('/auth/me', async (req, res) => {
  const token = req.cookies['__Host-token'] || req.cookies.token || (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/, ''));
  if (!token) return res.json({ user: null });
  const payload = await verifyToken(token);
  if (!payload) return res.json({ user: null });

  const userId = payload.userId || payload.id;
  const users = await executeQuery('SELECT id, username, email, role, full_name, email_verified_at FROM users WHERE id = ?', [userId]);
  res.json({ user: users[0] || null });
});

router.get('/auth/sessions', requireAuth, authModule.handleGetSessions);
router.delete('/auth/sessions/:id', requireAuth, authModule.handleRevokeSession);
router.post('/auth/forgot-password', authModule.handleForgotPassword);
router.post('/auth/reset-password', authModule.handleResetPassword);
router.post('/auth/signup', authModule.handleSignup);
router.post('/auth/invitations', requireAuth, authModule.handleCreateInvitation);

// ==========================================
// 2. Catalog: Departments (Strangler Proxy)
// ==========================================
router.get('/departments', authorize('departments', 'view'), createStranglerProxy('departments', deptModule.listDepartments, deptModule.listDepartments));
router.get('/departments/:id', authorize('departments', 'view'), deptModule.getDepartment);
router.post('/departments', authorize('departments', 'create'), deptModule.createDepartment);
router.put('/departments/:id', authorize('departments', 'update'), deptModule.updateDepartment);
router.delete('/departments/:id', authorize('departments', 'delete'), deptModule.deleteDepartment);
router.post('/departments/:id/archive-cascade', authorize('departments', 'delete'), deptModule.archiveCascadeDepartment);

// ==========================================
// 3. Catalog: Rooms (Strangler Proxy)
// ==========================================
router.get('/rooms', authorize('rooms', 'view'), createStranglerProxy('rooms', roomModule.listRooms, roomModule.listRooms));
router.get('/rooms/:id', authorize('rooms', 'view'), roomModule.getRoom);
router.post('/rooms', authorize('rooms', 'create'), roomModule.createRoom);
router.put('/rooms/:id', authorize('rooms', 'update'), roomModule.updateRoom);
router.delete('/rooms/:id', authorize('rooms', 'delete'), roomModule.deleteRoom);

// ==========================================
// 4. Catalog: Courses (Strangler Proxy)
// ==========================================
router.get('/courses', authorize('courses', 'view'), createStranglerProxy('courses', courseModule.listCourses, courseModule.listCourses));
router.get('/courses/:id', authorize('courses', 'view'), courseModule.getCourse);
router.post('/courses', authorize('courses', 'create'), courseModule.createCourse);
router.put('/courses/:id', authorize('courses', 'update'), courseModule.updateCourse);
router.delete('/courses/:id', authorize('courses', 'delete'), courseModule.deleteCourse);

// ==========================================
// 5. Catalog: Groups (Strangler Proxy)
// ==========================================
router.get('/groups', authorize('groups', 'view'), createStranglerProxy('groups', groupModule.listGroups, groupModule.listGroups));
router.get('/groups/:id', authorize('groups', 'view'), groupModule.getGroup);
router.post('/groups', authorize('groups', 'create'), groupModule.createGroup);
router.put('/groups/:id', authorize('groups', 'update'), groupModule.updateGroup);
router.delete('/groups/:id', authorize('groups', 'delete'), groupModule.deleteGroup);

// ==========================================
// 6. Professors (Strangler Proxy)
// ==========================================
router.get('/professors', authorize('professors', 'view'), createStranglerProxy('professors', profModule.listProfessors, profModule.listProfessors));
router.get('/professors/:id', authorize('professors', 'view'), profModule.getProfessor);
router.post('/professors', authorize('professors', 'create'), profModule.createProfessor);
router.put('/professors/:id', authorize('professors', 'update'), profModule.updateProfessor);
router.delete('/professors/:id', authorize('professors', 'delete'), profModule.deleteProfessor);
router.post('/professors/bulk-import', authorize('professors', 'create'), profModule.bulkImportProfessors);

// ==========================================
// 7. Assignments (Strangler Proxy)
// ==========================================
router.get('/assignments', authorize('assignments', 'view'), createStranglerProxy('assignments', assignModule.listAssignments, assignModule.listAssignments));
router.get('/assignments/:id', authorize('assignments', 'view'), assignModule.getAssignment);
router.post('/assignments', authorize('assignments', 'create'), assignModule.createAssignment);
router.put('/assignments/:id', authorize('assignments', 'update'), assignModule.updateAssignment);
router.delete('/assignments/:id', authorize('assignments', 'delete'), assignModule.deleteAssignment);
router.post('/assignments/swap', authorize('assignments', 'update'), assignModule.swapAssignments);
router.post('/assignments/:id/move', authorize('assignments', 'update'), assignModule.moveAssignment);

// ==========================================
// 8. Academic Years & Semesters
// ==========================================
router.get('/academic-years', authorize('academic_years', 'view'), acadModule.listAcademicYears);
router.get('/academic-years/active', authorize('academic_years', 'view'), acadModule.getActiveAcademicYear);
router.post('/academic-years', authorize('academic_years', 'create'), acadModule.createAcademicYear);
router.post('/academic-years/:id/activate', authorize('academic_years', 'update'), acadModule.activateAcademicYear);
router.delete('/academic-years/:id', authorize('academic_years', 'delete'), acadModule.deleteAcademicYear);

router.get('/semesters', authorize('semesters', 'view'), acadModule.listSemesters);
router.get('/semesters/active', authorize('semesters', 'view'), acadModule.getActiveSemester);
router.post('/semesters', authorize('semesters', 'create'), acadModule.createSemester);
router.put('/semesters/:id', authorize('semesters', 'update'), acadModule.updateSemester);
router.post('/semesters/:id/activate', authorize('semesters', 'update'), acadModule.activateSemester);
router.delete('/semesters/:id', authorize('semesters', 'delete'), acadModule.deleteSemester);

// ==========================================
// 9. Users & Permissions
// ==========================================
router.get('/users', authorize('users', 'view'), userModule.listUsers);
router.get('/users/:id', authorize('users', 'view'), userModule.getUser);
router.post('/users', authorize('users', 'create'), userModule.createUser);
router.post('/users/with-professor', authorize('users', 'create'), userModule.createUserWithProfessor);
router.put('/users/:id', authorize('users', 'update'), userModule.updateUser);
router.delete('/users/:id', authorize('users', 'delete'), userModule.deleteUser);
router.get('/users/:id/permissions', authorize('permissions', 'view'), userModule.getUserPermissions);
router.put('/users/:id/permissions', authorize('permissions', 'update'), userModule.updateUserPermissions);

// ==========================================
// 10. Audit, Changes & Impact Analysis
// ==========================================
router.get('/changes', authorize('audit', 'view'), auditModule.listChanges);
router.post('/changes/:id/undo', authorize('assignments', 'update'), auditModule.undoChange);
router.get('/:entity/:id/delete-impact', authorize('departments', 'view'), auditModule.getDeleteImpact);
router.get('/audit-logs', authorize('audit_logs', 'view'), auditModule.listAuditLogs);
router.post('/audit-logs', authorize('audit_logs', 'create'), auditModule.createAuditLog);
router.post('/audit-logs/export-url', authorize('audit_logs', 'export'), auditModule.generateExportUrl);
router.get('/audit-logs/export', auditModule.exportAuditLogs);

// ==========================================
// 11. Configuration, Settings, Snapshots & Backup
// ==========================================
router.get('/app-config', authorize('app_config', 'view'), settingsModule.getAppConfig);
router.post('/app-config', authorize('app_config', 'update'), settingsModule.updateAppConfig);

router.get('/print-settings', authorize('print_settings', 'view'), settingsModule.getPrintSettings);
router.post('/print-settings', authorize('print_settings', 'update'), settingsModule.updatePrintSettings);
router.put('/print-settings', authorize('print_settings', 'update'), settingsModule.updatePrintSettings);

router.post('/sandbox/save', authorize('sandbox_snapshots', 'create'), settingsModule.createSnapshot);
router.get('/sandbox/list', authorize('sandbox_snapshots', 'view'), settingsModule.listSnapshots);

router.get('/export/data', authorize('backup', 'export'), settingsModule.exportData);
router.get('/export/database', authorize('backup', 'export'), settingsModule.exportData);

router.get('/email/settings', authorize('email', 'view'), settingsModule.getEmailSettings);
router.get('/database/status', aiModule.getDatabaseStatus);

// ==========================================
// 12. AI Assistant Proxy
// ==========================================
router.post('/ai/assist', authorize('ai', 'create'), aiModule.handleAiAssist);

router._authHelpers = {
  createToken: (user) => {
    const { SignJWT } = require('jose');
    return new SignJWT({
      id: user.id,
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionId: user.sessionId
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(JWT_SECRET);
  },
  verifyToken,
  requireAuth,
  authService,
  auditService,
  authorize
};

module.exports = router;
