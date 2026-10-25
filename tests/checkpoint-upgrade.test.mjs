import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startFieldServer, tokens } from './helpers/field-server.mjs';

test('upgrading a database with existing daily attendance preserves the original record and unique index', async () => {
  let oldRecord;
  const fixture = await startFieldServer({ beforeStart: async db => {
    // An already-populated pre-checkpoint database, created before the new server starts.
    await db.execute(`CREATE TABLE FieldAttendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT, teamId INTEGER NOT NULL, projectId INTEGER NOT NULL,
      projectDayId INTEGER NOT NULL, groupId INTEGER NOT NULL, studentId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'NOT_MARKED', otherReason TEXT,
      recordedById INTEGER, recordedByName TEXT, recordedAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedById INTEGER, updatedByName TEXT, updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    await db.execute('CREATE UNIQUE INDEX idx_fatt_unique ON FieldAttendance(projectId, projectDayId, studentId)');
    await db.execute(`INSERT INTO FieldAttendance
      (id, teamId, projectId, projectDayId, groupId, studentId, status, otherReason, recordedById, recordedByName, recordedAt, updatedById, updatedByName, updatedAt)
      VALUES (500, 1, 101, 1011, 1001, 99, 'OTHER', 'سجل قبل التحديث', 11, 'المشرف السابق', '2026-01-01 07:00:00', 11, 'المشرف السابق', '2026-01-01 08:00:00')`);
    oldRecord = { ...((await db.execute('SELECT * FROM FieldAttendance WHERE id = 500')).rows[0]) };
  } });
  try {
    const join = await fetch(fixture.base + '/api/field/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokens.today, memberId: 11 }) });
    const cookie = join.headers.get('set-cookie').split(';')[0];
    const post = (path, body) => fetch(fixture.base + path, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const created = await post('/api/field/projects/101/checkpoints', { dayId: 1011, name: 'أول انتقال بعد التحديث' });
    assert.equal(created.status, 201);
    const checkpointId = (await created.json()).checkpointId;
    const mark = await post('/api/field/attendance', { projectId: 101, dayId: 1011, studentId: 1, checkpointId, status: 'PRESENT' });
    assert.equal(mark.status, 200);
    assert.deepEqual({ ...((await fixture.db.execute('SELECT * FROM FieldAttendance WHERE id = 500')).rows[0]) }, oldRecord);
    assert.equal((await fixture.db.execute("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name = 'idx_fatt_unique'")).rows[0].n, 1);
    assert.equal((await fixture.db.execute('SELECT checkpointId FROM FieldAttendanceRecord WHERE studentId = 99')).rows[0].checkpointId, 0);
    assert.equal((await fixture.db.execute({ sql: 'SELECT status FROM FieldCheckpointAttendance WHERE checkpointId = ?', args: [checkpointId] })).rows[0].status, 'PRESENT');
  } finally { await fixture.close(); }
});
