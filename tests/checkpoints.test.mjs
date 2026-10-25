import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { startFieldServer, tokens } from './helpers/field-server.mjs';

let fixture, scoped, full, readOnly, first, second;
let original;
const cookieOf = res => res.headers.get('set-cookie')?.split(';')[0];
const rows = async (sql, args = []) => (await fixture.db.execute({ sql, args })).rows.map(r => ({ ...r }));
const request = (path, cookie, body, method = body ? 'POST' : 'GET') => fetch(fixture.base + path, {
  method, redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const endpoint = '/api/field/projects/101/checkpoints';
async function create(name, dayId = 1011, cookie = scoped, path = endpoint) {
  const res = await request(path, cookie, { dayId, name });
  return { status: res.status, body: await res.json() };
}
async function mark(checkpointId, studentId, status, otherReason, cookie = scoped, dayId = 1011, projectId = 101) {
  return request('/api/field/attendance', cookie, { projectId, dayId, checkpointId, studentId, status, otherReason });
}
async function sheet(checkpointId, dayId = 1011, groupId = 1001, cookie = scoped, projectId = 101) {
  const res = await request(`/api/field/attendance?projectId=${projectId}&dayId=${dayId}&groupId=${groupId}&checkpointId=${checkpointId}`, cookie);
  assert.equal(res.status, 200);
  return (await res.json()).rows;
}
const state = list => list.map(r => [r.studentId, r.status, r.otherReason]);
const html = async path => (await (await request(path, scoped)).text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');

before(async () => {
  fixture = await startFieldServer();
  const join = await request('/api/field/join', null, { token: tokens.today, memberId: 11 });
  scoped = cookieOf(join);
  const login = await request('/api/field/auth/login', null, { identifier: 'TEST', password: 'test-password' });
  const team = cookieOf(login);
  full = cookieOf(await request('/api/field/auth/member', team, { memberId: 11 }));
  readOnly = cookieOf(await request('/api/field/auth/member', team, { memberId: 12 }));
  original = await rows('SELECT * FROM FieldAttendance ORDER BY id');
});
after(async () => { await fixture?.close(); });

test('a trip can have multiple named checkpoints on one day without changing earlier attendance', async () => {
  const a = await create('من المركز إلى الحديقة');
  const b = await create('من الحديقة إلى المتحف');
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  first = a.body.checkpointId; second = b.body.checkpointId;
  assert.ok(first > 0 && second > first);
  assert.deepEqual(await rows('SELECT * FROM FieldAttendance ORDER BY id'), original);
  for (const id of [first, second]) {
    assert.deepEqual(state(await sheet(id)), [[1, 'NOT_MARKED', null], [2, 'NOT_MARKED', null], [3, 'NOT_MARKED', null], [4, 'NOT_MARKED', null]]);
  }
});

test('the same student has independent status, reason, actor and timestamps in every checkpoint', async () => {
  assert.equal((await mark(first, 1, 'ABSENT')).status, 200);
  assert.equal((await mark(first, 2, 'OTHER', 'مراجعة طبية')).status, 200);
  assert.equal((await mark(second, 1, 'PRESENT')).status, 200);
  const a = await sheet(first); const b = await sheet(second); const legacy = await sheet(0);
  assert.deepEqual(a.slice(0, 2).map(r => [r.status, r.otherReason]), [['ABSENT', null], ['OTHER', 'مراجعة طبية']]);
  assert.equal(b[0].status, 'PRESENT'); assert.equal(b[1].status, 'NOT_MARKED');
  assert.equal(legacy[0].status, 'PRESENT'); assert.equal(legacy[1].status, 'ABSENT');
  assert.equal(a[0].recordedByName, 'مشرف الاختبار'); assert.ok(a[0].recordedAt);
  assert.deepEqual(await rows('SELECT * FROM FieldAttendance ORDER BY id'), original);
});

test('edits update only the selected checkpoint and retain original record metadata', async () => {
  const [old] = await rows('SELECT * FROM FieldCheckpointAttendance WHERE checkpointId = ? AND studentId = 1', [first]);
  assert.equal((await mark(first, 1, 'OTHER', 'عاد لاحقاً')).status, 200);
  const [updated] = await rows('SELECT * FROM FieldCheckpointAttendance WHERE checkpointId = ? AND studentId = 1', [first]);
  assert.equal(updated.id, old.id); assert.equal(updated.recordedAt, old.recordedAt);
  assert.equal((await sheet(second))[0].status, 'PRESENT');
  const audit = await rows('SELECT * FROM FieldCheckpointAuditLog WHERE checkpointId = ? AND studentId = 1 ORDER BY id', [first]);
  assert.equal(audit.length, 2); assert.equal(audit[1].oldStatus, 'ABSENT');
  assert.equal(audit[1].newStatus, 'OTHER'); assert.match(audit[1].dayLabel, /من المركز إلى الحديقة/);
  assert.equal((await rows('SELECT COUNT(*) AS n FROM FieldAttendanceAuditLog'))[0].n, 0);
});

test('bulk attendance preserves absent/other cases and does not mark another group or checkpoint', async () => {
  const res = await request('/api/field/attendance/all-present', scoped, { projectId: 101, dayId: 1011, groupId: 1001, checkpointId: first });
  assert.equal(res.status, 200); assert.equal((await res.json()).changed, 2);
  assert.deepEqual(state(await sheet(first)), [[1, 'OTHER', 'عاد لاحقاً'], [2, 'OTHER', 'مراجعة طبية'], [3, 'PRESENT', null], [4, 'PRESENT', null]]);
  assert.equal((await sheet(second))[2].status, 'NOT_MARKED');
  assert.equal((await sheet(first, 1011, 1002))[0].status, 'NOT_MARKED');
  assert.equal((await mark(first, 5, 'ABSENT')).status, 200);
  assert.equal((await sheet(first, 1011, 1002))[0].status, 'ABSENT');
  assert.deepEqual(await rows('SELECT * FROM FieldAttendance ORDER BY id'), original);
});

test('latest checkpoint opens directly; prior checkpoints and their progress remain selectable', async () => {
  const page = await html('/field/projects/101/groups');
  assert.match(page, new RegExp(`groups/1001\\?from=groups(?:&amp;|&)checkpointId=${second}`));
  const earlier = await html(`/field/projects/101/groups?dayId=1011&checkpointId=${first}`);
  assert.match(earlier, new RegExp(`groups/1001\\?from=groups(?:&amp;|&)checkpointId=${first}`));
  const attendance = await html(`/field/projects/101/days/1011/groups/1001?from=groups&checkpointId=${first}`);
  assert.match(attendance, /عاد لاحقاً/); assert.match(attendance, /محطة جديدة/);
  assert.match(attendance, new RegExp(`groups\\?dayId=1011(?:&amp;|&)checkpointId=${first}`));
  const daily = await html('/field/projects/101/days/1011');
  assert.match(daily, new RegExp(`option value="${second}" selected`));
  const legacy = await html('/field/projects/101/days/1011/groups/1001?checkpointId=0');
  assert.match(legacy, /href="\/field\/projects\/101\/days\/1011\?checkpointId=0"/);
});

test('report, export and audit history include each checkpoint separately', async () => {
  const report = await html('/field/projects/101/report');
  for (const text of ['من المركز إلى الحديقة', 'من الحديقة إلى المتحف', 'الطالب يُحسب مرة في كل محطة', 'عاد لاحقاً']) assert.ok(report.includes(text), text);
  const res = await request('/api/field/projects/101/export', scoped);
  assert.equal(res.status, 200);
  const csv = (await res.text()).replace(/^\uFEFF/, '').trim().split('\r\n').map(line => line.split(','));
  const [header, ...people] = csv;
  const a = header.findIndex(v => v.includes('من المركز إلى الحديقة'));
  const b = header.findIndex(v => v.includes('من الحديقة إلى المتحف'));
  assert.ok(a > 1 && b > a);
  const student = people.find(p => p[0] === 'طالب 1');
  assert.equal(student[a], 'أخرى: عاد لاحقاً'); assert.equal(student[b], 'حاضر');
  const log = await html('/field/projects/101/log');
  assert.match(log, /من المركز إلى الحديقة/); assert.match(log, /من الحديقة إلى المتحف/);
  const events = await rows('SELECT eventKey FROM FieldAttendanceHistory');
  assert.equal(new Set(events.map(e => e.eventKey)).size, events.length);
});

test('read-only, cross-project, cross-team and mismatched-day requests stay restricted', async () => {
  assert.equal((await create('مرفوض', 1011, readOnly)).status, 403);
  assert.equal((await create('مرفوض', 1020, scoped, '/api/field/projects/102/checkpoints')).status, 403);
  assert.equal((await create('مرفوض', 2010, full, '/api/field/projects/201/checkpoints')).status, 404);
  assert.equal((await create('مرفوض', 1020)).status, 404);
  assert.equal((await mark(first, 1, 'PRESENT', null, readOnly)).status, 403);
  assert.equal((await mark(first, 1, 'PRESENT', null, scoped, 1010)).status, 404);
  assert.equal((await mark(first, 1, 'PRESENT', null, full, 1020, 102)).status, 404);
  assert.equal((await request(`/api/field/attendance?projectId=101&dayId=1010&groupId=1001&checkpointId=${first}`, scoped)).status, 404);
  const page = (await (await request(`/field/projects/101/days/1011/groups/1001?checkpointId=${first}`, readOnly)).text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  assert.doesNotMatch(page, /محطة جديدة/); assert.match(page, /لست ضمن المخولين/);
});

test('invalid station identifiers and duplicate names are rejected; concurrent creation stays unique', async () => {
  for (const id of [-1, '', true, {}, [], '1.5', 'nope']) assert.equal((await mark(id, 1, 'PRESENT')).status, 400);
  assert.equal((await create('من المركز إلى الحديقة')).status, 409);
  const both = await Promise.all([create('العودة إلى المركز'), create('العودة إلى المركز')]);
  assert.deepEqual(both.map(r => r.status).sort(), [201, 409]);
  assert.equal((await rows("SELECT COUNT(*) AS n FROM FieldCheckpoint WHERE name = 'العودة إلى المركز'"))[0].n, 1);
  const latest = both.find(r => r.status === 201).body.checkpointId;
  assert.ok((await sheet(latest)).every(r => r.status === 'NOT_MARKED'));
  assert.equal((await sheet(first))[0].otherReason, 'عاد لاحقاً');
});

test('concurrent bulk marking never overwrites explicit absent or other statuses', async () => {
  const point = await create('تحقق تزامن المشرفين');
  const id = point.body.checkpointId;
  const responses = await Promise.all([
    request('/api/field/attendance/all-present', scoped, { projectId: 101, dayId: 1011, groupId: 1001, checkpointId: id }),
    mark(id, 1, 'OTHER', 'مع مشرف آخر'),
    mark(id, 2, 'ABSENT'),
  ]);
  assert.ok(responses.every(r => r.status === 200));
  const saved = await sheet(id);
  assert.equal(saved[0].status, 'OTHER'); assert.equal(saved[0].otherReason, 'مع مشرف آخر');
  assert.equal(saved[1].status, 'ABSENT');
  const audit = await rows('SELECT studentId, oldStatus, newStatus FROM FieldCheckpointAuditLog WHERE checkpointId = ? ORDER BY id', [id]);
  for (const student of [1, 2]) {
    const events = audit.filter(e => e.studentId === student);
    for (let i = 1; i < events.length; i++) assert.equal(events[i].oldStatus, events[i - 1].newStatus);
  }
});

test('legacy clients without a station keep writing only the first attendance record', async () => {
  const current = state(await sheet(second));
  const res = await request('/api/field/attendance', scoped, { projectId: 101, dayId: 1011, studentId: 1, status: 'ABSENT' });
  assert.equal(res.status, 200); assert.equal((await sheet(0))[0].status, 'ABSENT');
  assert.deepEqual(state(await sheet(second)), current);
  assert.equal((await sheet(first))[0].otherReason, 'عاد لاحقاً');
});

test('records in later stations protect days and students from deletion and are cleaned with a confirmed project deletion', async () => {
  const point = await create('انتقال اختباري', 1020, full, '/api/field/projects/102/checkpoints');
  assert.equal(point.status, 201);
  assert.equal((await mark(point.body.checkpointId, 1, 'PRESENT', null, full, 1020, 102)).status, 200);
  for (const body of [{ action: 'deleteDay', dayId: 1020 }, { action: 'removeParticipant', studentId: 1 }]) {
    assert.equal((await request('/api/field/projects/102', full, body, 'PATCH')).status, 400);
  }
  assert.equal((await request('/api/field/projects/102', full, { confirmName: 'مشروع يوم آخر' }, 'DELETE')).status, 200);
  for (const table of ['FieldCheckpoint', 'FieldCheckpointAttendance', 'FieldCheckpointAuditLog']) {
    assert.equal((await rows(`SELECT COUNT(*) AS n FROM ${table} WHERE projectId = 102`))[0].n, 0);
  }
  assert.equal((await sheet(first))[0].otherReason, 'عاد لاحقاً');
});

test('archiving and revoked links block new checkpoints and writes while preserving past records', async () => {
  await fixture.db.execute("UPDATE FieldProject SET status = 'FINISHED' WHERE id = 101");
  assert.equal((await create('محطة مؤرشفة')).status, 409);
  assert.equal((await mark(first, 1, 'PRESENT')).status, 409);
  assert.equal((await sheet(first))[0].otherReason, 'عاد لاحقاً');
  await fixture.db.execute("UPDATE FieldProjectLink SET token = 'revoked-station-test-token-123456' WHERE projectId = 101");
  assert.equal((await create('رابط ملغى')).status, 401);
  assert.equal((await mark(first, 1, 'PRESENT')).status, 401);
});
