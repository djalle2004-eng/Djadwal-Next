const { executeQuery } = require('../../database.js');

async function exportBackupSnapshot(req, res) {
  try {
    const [
      academicYears,
      semesters,
      departments,
      specializations,
      groups,
      professors,
      courses,
      rooms,
      assignments,
      extraSessions
    ] = await Promise.all([
      executeQuery('SELECT * FROM academic_years ORDER BY year_name ASC').catch(() => []),
      executeQuery('SELECT * FROM semesters ORDER BY id ASC').catch(() => []),
      executeQuery('SELECT * FROM departments ORDER BY id ASC').catch(() => []),
      executeQuery('SELECT * FROM specializations ORDER BY id ASC').catch(() => []),
      executeQuery('SELECT * FROM groups ORDER BY id ASC').catch(() => []),
      executeQuery('SELECT id, name, title, department_id, email, phone, max_hours_per_week, is_active FROM professors ORDER BY id ASC').catch(() => []),
      executeQuery('SELECT * FROM courses ORDER BY id ASC').catch(() => []),
      executeQuery('SELECT * FROM rooms ORDER BY id ASC').catch(() => []),
      executeQuery('SELECT * FROM assignments ORDER BY id ASC').catch(() => []),
      executeQuery('SELECT * FROM extra_sessions ORDER BY id ASC').catch(() => [])
    ]);

    const assignmentsCurrentYear = assignments.filter(a => a.academic_year === '2026-2027');

    const snapshot = {
      meta: {
        application: 'Djadwal Unified Timetable System',
        version: '1.0.0',
        environment: 'Production',
        exported_at: new Date().toISOString(),
        checksum_assignments_total: assignments.length,
        checksum_assignments_2026_2027: assignmentsCurrentYear.length
      },
      counts: {
        academic_years: academicYears.length,
        semesters: semesters.length,
        departments: departments.length,
        specializations: specializations.length,
        groups: groups.length,
        professors: professors.length,
        courses: courses.length,
        rooms: rooms.length,
        assignments_total: assignments.length,
        assignments_2026_2027: assignmentsCurrentYear.length,
        extra_sessions: extraSessions.length
      },
      data: {
        academic_years: academicYears,
        semesters: semesters,
        departments: departments,
        specializations: specializations,
        groups: groups,
        professors: professors,
        courses: courses,
        rooms: rooms,
        assignments: assignments,
        extra_sessions: extraSessions
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="djadwal_backup_${new Date().toISOString().split('T')[0]}.json"`
    );
    res.json(snapshot);
  } catch (err) {
    console.error('Backup snapshot export failed:', err);
    res.status(500).json({ error: 'BACKUP_FAILED', message: err.message });
  }
}

module.exports = {
  exportBackupSnapshot
};
