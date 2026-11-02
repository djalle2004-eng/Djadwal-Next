const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { createClient } = require('@libsql/client');

async function main() {
  console.log('🚀 === Selective Restore: 2026-2027 Assignments ===\n');

  const backupFile = path.join(__dirname, '..', 'djadwal-backup-2026-10-13T21-50-02.json');
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found at: ${backupFile}`);
  }

  console.log('1. Reading backup file...');
  const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const allAssignments = backupData.tables.assignments || [];

  // Filter 2026-2027 assignments (IDs 6230 to 7326)
  const assignments2026 = allAssignments.filter(a => a.academic_year === '2026-2027');
  console.log(`   Found ${assignments2026.length} assignments for academic year 2026-2027.`);

  if (assignments2026.length === 0) {
    console.log('⚠️ No assignments found for 2026-2027. Exiting.');
    return;
  }

  // Database clients
  const neonPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const tursoClient = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  try {
    // 2. Restore to Neon PostgreSQL
    console.log('\n2. Restoring assignments into Neon PostgreSQL...');
    const neonClient = await neonPool.connect();

    try {
      await neonClient.query('BEGIN');

      const batchSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < assignments2026.length; i += batchSize) {
        const batch = assignments2026.slice(i, i + batchSize);

        for (const row of batch) {
          const insertSql = `
            INSERT INTO assignments (
              id, group_id, course_id, professor_id, room_id,
              day_of_week, start_time, end_time, session_type,
              academic_year, semester, specialization, created_at, version
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id) DO UPDATE SET
              group_id = EXCLUDED.group_id,
              course_id = EXCLUDED.course_id,
              professor_id = EXCLUDED.professor_id,
              room_id = EXCLUDED.room_id,
              day_of_week = EXCLUDED.day_of_week,
              start_time = EXCLUDED.start_time,
              end_time = EXCLUDED.end_time,
              session_type = EXCLUDED.session_type,
              academic_year = EXCLUDED.academic_year,
              semester = EXCLUDED.semester,
              specialization = EXCLUDED.specialization,
              updated_at = NOW();
          `;

          const values = [
            row.id,
            row.group_id,
            row.course_id,
            row.professor_id,
            row.room_id,
            row.day_of_week,
            row.start_time,
            row.end_time,
            row.session_type || 'lecture',
            row.academic_year,
            row.semester,
            row.specialization || '',
            row.created_at || new Date().toISOString(),
            1 // default version for optimistic locking
          ];

          await neonClient.query(insertSql, values);
          insertedCount++;
        }
        process.stdout.write(`   Restored ${insertedCount} / ${assignments2026.length} rows in Neon...\r`);
      }

      // Realign sequence
      const seqRes = await neonClient.query(`SELECT pg_get_serial_sequence('assignments', 'id') as seq`);
      const seq = seqRes.rows[0]?.seq;
      if (seq) {
        await neonClient.query(`
          SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM assignments), 1), true);
        `);
        console.log(`\n   🔢 Realigned Neon assignments ID sequence.`);
      }

      await neonClient.query('COMMIT');
      console.log(`   ✅ Successfully committed ${insertedCount} rows in Neon PostgreSQL.`);
    } catch (neonErr) {
      await neonClient.query('ROLLBACK');
      throw neonErr;
    } finally {
      neonClient.release();
    }

    // 3. Restore to Turso Cloud (Dual-Write Sync)
    console.log('\n3. Synchronizing assignments to Turso (Dual-Write Backup)...');
    const batchSizeTurso = 50;
    let tursoInserted = 0;

    for (let i = 0; i < assignments2026.length; i += batchSizeTurso) {
      const batch = assignments2026.slice(i, i + batchSizeTurso);
      const statements = batch.map(row => ({
        sql: `
          INSERT INTO assignments (
            id, group_id, course_id, professor_id, room_id,
            day_of_week, start_time, end_time, session_type,
            academic_year, semester, specialization, created_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            group_id = excluded.group_id,
            course_id = excluded.course_id,
            professor_id = excluded.professor_id,
            room_id = excluded.room_id,
            day_of_week = excluded.day_of_week,
            start_time = excluded.start_time,
            end_time = excluded.end_time,
            session_type = excluded.session_type,
            academic_year = excluded.academic_year,
            semester = excluded.semester,
            specialization = excluded.specialization;
        `,
        args: [
          row.id,
          row.group_id,
          row.course_id,
          row.professor_id,
          row.room_id,
          row.day_of_week,
          row.start_time,
          row.end_time,
          row.session_type || 'lecture',
          row.academic_year,
          row.semester,
          row.specialization || '',
          row.created_at || new Date().toISOString(),
          1
        ]
      }));

      await tursoClient.batch(statements);
      tursoInserted += batch.length;
      process.stdout.write(`   Synced ${tursoInserted} / ${assignments2026.length} rows to Turso...\r`);
    }
    console.log(`\n   ✅ Successfully synchronized ${tursoInserted} rows to Turso.`);

    // 4. Verification Check
    console.log('\n4. Verifying Row Counts across Databases...');
    const neonCheck = await neonPool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE academic_year = '2026-2027') as year_2026,
        COUNT(*) FILTER (WHERE academic_year = '2025-2026') as year_2025,
        MAX(id) as max_id
      FROM assignments
    `);
    console.log('   Neon PostgreSQL:');
    console.table(neonCheck.rows);

    const tursoCheck = await tursoClient.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN academic_year = '2026-2027' THEN 1 ELSE 0 END) as year_2026,
        SUM(CASE WHEN academic_year = '2025-2026' THEN 1 ELSE 0 END) as year_2025,
        MAX(id) as max_id
      FROM assignments
    `);
    console.log('   Turso Cloud:');
    console.table(tursoCheck.rows);

    console.log('\n🎉 ALL DONE! The 2026-2027 assignments are fully restored and verified.');
  } finally {
    await neonPool.end();
  }
}

main().catch(err => {
  console.error('❌ Restore failed:', err);
  process.exit(1);
});

