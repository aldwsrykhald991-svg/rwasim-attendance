import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

export const tokens = {
  today: 'today-project-test-token-123456789',
  otherDay: 'other-day-test-token-1234567890',
  duplicate: 'duplicate-date-test-token-123456',
  empty: 'empty-project-test-token-12345678',
  noGroups: 'no-groups-test-token-1234567890',
  archived: 'archived-test-token-12345678901',
};

export async function startFieldServer({ beforeStart } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'rwasim-attendance-test-'));
  const db = createClient({ url: `file:${join(dir, 'test.db')}` });
  if (beforeStart) await beforeStart(db);
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(done => socket.close(done));
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [
    '--import', fileURLToPath(new URL('./fixed-clock.mjs', import.meta.url)),
    resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port),
  ], {
    cwd: process.cwd(),
    env: { ...process.env, TURSO_DATABASE_URL: `file:${join(dir, 'test.db')}`, TURSO_AUTH_TOKEN: '',
      JWT_SECRET: 'isolated-regression-test-secret-not-for-production', NEXT_TELEMETRY_DISABLED: '1', TZ: 'UTC' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  server.stdout.on('data', chunk => { logs += chunk; });
  server.stderr.on('data', chunk => { logs += chunk; });
  async function close() {
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM');
      await once(server, 'exit');
    }
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
  try {
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (server.exitCode !== null || server.signalCode !== null) throw new Error(logs);
      try {
        const res = await fetch(`${base}/field/j/invalid`, { signal: AbortSignal.timeout(1000) });
        if (res.status === 200) { ready = true; break; }
      } catch { /* The server is still starting. */ }
      await new Promise(done => setTimeout(done, 100));
    }
    if (!ready) throw new Error(`Test server did not become ready:\n${logs}`);
    const password = await bcrypt.hash('test-password', 4);
    const sql = async (sql, args = []) => db.execute({ sql, args });
    for (const [id, name, code] of [[1, 'فريق الاختبار', 'TEST'], [2, 'فريق آخر', 'OTHER']]) {
      await sql('INSERT INTO FieldTeam (id, name, code, adminName, passwordHash) VALUES (?, ?, ?, ?, ?)', [id, name, code, 'المسؤول', password]);
    }
    for (const [id, teamId, name, active] of [[11, 1, 'مشرف الاختبار', 1], [12, 1, 'عضو للقراءة', 1], [13, 1, 'عضو موقوف', 0], [21, 2, 'مشرف آخر', 1]]) {
      await sql('INSERT INTO FieldTeamMember (id, teamId, name, active) VALUES (?, ?, ?, ?)', [id, teamId, name, active]);
    }
    for (const [id, teamId, name, status] of [[101, 1, 'مشروع اليوم', 'ACTIVE'], [102, 1, 'مشروع يوم آخر', 'ACTIVE'], [103, 1, 'مشروع التاريخ المكرر', 'ACTIVE'], [104, 1, 'مشروع بلا أيام', 'UPCOMING'], [105, 1, 'مشروع بلا مجموعات', 'ACTIVE'], [106, 1, 'مشروع مؤرشف', 'FINISHED'], [201, 2, 'بيانات فريق آخر', 'ACTIVE']]) {
      await sql('INSERT INTO FieldProject (id, teamId, name, status) VALUES (?, ?, ?, ?)', [id, teamId, name, status]);
      await sql('INSERT INTO FieldProjectSupervisor (teamId, projectId, memberId, snapshotName) VALUES (?, ?, ?, ?)', [teamId, id, teamId === 1 ? 11 : 21, 'مشرف الاختبار']);
    }
    for (const [id, projectId, date, order] of [[1010, 101, '2030-04-10', 0], [1011, 101, '2030-04-11', 1], [1012, 101, '2030-04-12', 2], [1020, 102, '2030-04-10', 0], [1021, 102, '2030-04-12', 1], [1030, 103, '2030-04-11', 0], [1031, 103, '2030-04-11', 1], [1050, 105, '2030-04-11', 0], [1060, 106, '2030-04-11', 0], [2010, 201, '2030-04-11', 0]]) {
      await sql('INSERT INTO FieldProjectDay (id, teamId, projectId, date, sortOrder) VALUES (?, ?, ?, ?, ?)', [id, projectId === 201 ? 2 : 1, projectId, date, order]);
    }
    for (const [id, projectId, name] of [[1001, 101, 'مجموعة الصقور'], [1002, 101, 'مجموعة الأبطال'], [2001, 102, 'مجموعة النجوم'], [3001, 103, 'مجموعة التحدي'], [4001, 104, 'مجموعة بلا يوم'], [8001, 106, 'مجموعة مؤرشفة'], [9001, 201, 'مجموعة الفريق الآخر']]) {
      await sql('INSERT INTO FieldGroup (id, teamId, projectId, name) VALUES (?, ?, ?, ?)', [id, projectId === 201 ? 2 : 1, projectId, name]);
    }
    for (let id = 1; id <= 5; id++) {
      await sql('INSERT INTO FieldStudent (id, teamId, name) VALUES (?, 1, ?)', [id, `طالب ${id}`]);
      await sql('INSERT INTO FieldProjectParticipant (teamId, projectId, groupId, studentId, snapshotName, snapshotGroupName) VALUES (1, 101, ?, ?, ?, ?)', [id === 5 ? 1002 : 1001, id, `طالب ${id}`, id === 5 ? 'مجموعة الأبطال' : 'مجموعة الصقور']);
    }
    await sql("INSERT INTO FieldProjectParticipant (teamId, projectId, groupId, studentId, snapshotName, snapshotGroupName) VALUES (1, 102, 2001, 1, 'طالب 1', 'مجموعة النجوم')");
    for (const [projectId, token] of [[101, tokens.today], [102, tokens.otherDay], [103, tokens.duplicate], [104, tokens.empty], [105, tokens.noGroups], [106, tokens.archived]]) {
      await sql('INSERT INTO FieldProjectLink (projectId, teamId, token) VALUES (?, 1, ?)', [projectId, token]);
    }
    for (const [studentId, status, reason] of [[1, 'PRESENT', null], [2, 'ABSENT', null], [3, 'OTHER', 'موعد سابق']]) {
      await sql('INSERT INTO FieldAttendance (teamId, projectId, projectDayId, groupId, studentId, status, otherReason, recordedById, recordedByName, updatedById, updatedByName) VALUES (1, 101, 1011, 1001, ?, ?, ?, 11, ?, 11, ?)', [studentId, status, reason, 'المسجل السابق', 'المسجل السابق']);
    }
    await sql("INSERT INTO FieldAttendance (teamId, projectId, projectDayId, groupId, studentId, status, otherReason, recordedByName) VALUES (1, 101, 1010, 1001, 1, 'OTHER', 'حالة يوم سابق', 'المسجل السابق')");
    return { base, db, close, logs: () => logs };
  } catch (error) {
    await close();
    throw error;
  }
}
