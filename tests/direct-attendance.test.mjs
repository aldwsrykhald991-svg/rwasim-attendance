import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startFieldServer, tokens } from './helpers/field-server.mjs';

let fixture;
let scoped;
let full;
const request = (path, cookie, body) => fetch(`${fixture.base}${path}`, {
  redirect: 'manual',
  headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
  ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
});
const sessionCookie = res => res.headers.get('set-cookie')?.split(';')[0];
const pageText = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
const rows = async (sql, args = []) => (await fixture.db.execute({ sql, args })).rows.map(row => ({ ...row }));
async function assertNotFound(res) {
  // Next may already have streamed the authenticated layout with HTTP 200.
  if (res.status === 404) return;
  assert.equal(res.status, 200);
  assert.match(await res.text(), /NEXT_HTTP_ERROR_FALLBACK;404/);
}
async function join(token = tokens.today, member = { memberId: 11 }) {
  const res = await request('/api/field/join', null, { token, ...member });
  assert.equal(res.status, 200);
  return { res, cookie: sessionCookie(res), body: await res.json() };
}

before(async () => {
  fixture = await startFieldServer();
  scoped = (await join()).cookie;
  const login = await request('/api/field/auth/login', null, { identifier: 'TEST', password: 'test-password' });
  assert.equal(login.status, 200);
  const member = await request('/api/field/auth/member', sessionCookie(login), { memberId: 11 });
  full = sessionCookie(member);
});
after(async () => { await fixture?.close(); });

test('new group routes require an authenticated identity', async () => {
  for (const path of ['/field/projects/101/groups', '/field/projects/101/groups/1001']) {
    const res = await request(path);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get('location'), '/field');
  }
});

test('choosing a listed or new identity always lands on project groups', async () => {
  const listed = await join();
  assert.equal(listed.body.next, '/field/projects/101/groups');
  const named = await join(tokens.otherDay, { name: 'مشرف جديد للاختبار' });
  assert.equal(named.body.next, '/field/projects/102/groups');
  assert.equal((await rows('SELECT COUNT(*) AS n FROM FieldAttendanceAuditLog'))[0].n, 0);
});

test('an existing valid session follows the same direct-link landing', async () => {
  for (const cookie of [scoped, full]) {
    const res = await request(`/field/j/${tokens.today}`, cookie);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get('location'), '/field/projects/101/groups');
  }
});

test('Riyadh date wins over UTC and a single group click opens the saved sheet', async () => {
  const before = await rows('SELECT * FROM FieldAttendance ORDER BY id');
  const res = await request('/field/projects/101/groups', scoped);
  const html = pageText(await res.text());
  assert.match(html, /مجموعات المشروع/);
  assert.match(html, /تم اختيار يوم التحضير تلقائياً/);
  assert.match(html, /href="\/field\/projects\/101\/days\/1011\/groups\/1001\?from=groups"/);
  assert.doesNotMatch(html, /days\/1010\/groups/);
  const sheet = pageText(await (await request('/field/projects/101/days/1011/groups/1001?from=groups', scoped)).text());
  assert.match(sheet, /طالب 1/);
  assert.match(sheet, /المسجل السابق/);
  assert.match(sheet, /موعد سابق/);
  assert.match(sheet, /href="\/field\/projects\/101\/groups"/);
  assert.match(sheet, /تغيير يوم التحضير/);
  assert.deepEqual(await rows('SELECT * FROM FieldAttendance ORDER BY id'), before);
  assert.equal((await rows('SELECT COUNT(*) AS n FROM FieldAttendanceAuditLog'))[0].n, 0);
});

test('without a matching day the group is selected before the day, with no default date', async () => {
  const { cookie, body } = await join(tokens.otherDay);
  assert.equal(body.next, '/field/projects/102/groups');
  const html = pageText(await (await request(body.next, cookie)).text());
  assert.match(html, /لا يوجد يوم في المشروع يطابق تاريخ اليوم/);
  assert.match(html, /href="\/field\/projects\/102\/groups\/2001"/);
  assert.doesNotMatch(html, /href="[^\"]*\/days\//);
  const picker = await request('/field/projects/102/groups/2001', cookie);
  assert.equal(picker.status, 200);
  const days = pageText(await picker.text());
  assert.match(days, /اختر يوم التحضير/);
  assert.match(days, /مجموعة النجوم/);
  for (const day of [1020, 1021]) assert.match(days, new RegExp(`href="/field/projects/102/days/${day}/groups/2001\\?from=groups"`));
});

test('duplicate dates ask for a day instead of silently picking the first one', async () => {
  const { cookie } = await join(tokens.duplicate);
  const html = pageText(await (await request('/field/projects/103/groups', cookie)).text());
  assert.match(html, /يوجد أكثر من يوم بتاريخ اليوم/);
  assert.match(html, /href="\/field\/projects\/103\/groups\/3001"/);
});

test('empty projects show useful states without a broken attendance link', async () => {
  const { cookie } = await join(tokens.empty);
  const html = pageText(await (await request('/field/projects/104/groups', cookie)).text());
  assert.match(html, /لم تُضف أيام لهذا المشروع بعد/);
  assert.doesNotMatch(html, /href="[^\"]*\/groups\/4001/);
  const empty = await join(tokens.noGroups);
  const noGroups = pageText(await (await request('/field/projects/105/groups', empty.cookie)).text());
  assert.match(noGroups, /لا توجد مجموعات في هذا المشروع/);
});

test('normal team login, identity selection, day groups and back navigation stay unchanged', async () => {
  const login = await request('/api/field/auth/login', null, { identifier: 'TEST', password: 'test-password' });
  const loginCookie = sessionCookie(login);
  assert.equal((await request('/field', loginCookie)).headers.get('location'), '/field/who');
  const member = await request('/api/field/auth/member', loginCookie, { memberId: 11 });
  const cookie = sessionCookie(member);
  assert.equal((await request('/field', cookie)).headers.get('location'), '/field/home');
  const day = pageText(await (await request('/field/projects/101/days/1011', cookie)).text());
  assert.match(day, /اضغط لعرض الأسماء/);
  const sheet = pageText(await (await request('/field/projects/101/days/1011/groups/1001', cookie)).text());
  assert.match(sheet, /href="\/field\/projects\/101\/days\/1011"/);
  assert.doesNotMatch(sheet, /تغيير يوم التحضير/);
});

test('scoped sessions cannot access another project or team management', async () => {
  for (const path of ['/field/projects/102/groups', '/field/projects/102/groups/2001', '/field/projects/201/groups']) {
    const res = await request(path, scoped);
    const html = await res.text();
    if (res.status === 307) assert.equal(res.headers.get('location'), '/field/projects/101');
    else {
      assert.equal(res.status, 200);
      assert.match(html, /http-equiv="refresh" content="1;url=\/field\/projects\/101"/);
    }
    assert.doesNotMatch(html, /بيانات فريق آخر/);
  }
  assert.equal((await request('/api/field/members', scoped, { name: 'عضو جديد' })).status, 403);
  assert.equal((await request('/api/field/attendance', scoped, { projectId: 102, dayId: 1020, studentId: 1, status: 'PRESENT' })).status, 403);
  await assertNotFound(await request('/field/projects/201/groups', full));
  for (const path of ['/field/projects/101/groups/2001', '/field/projects/101/days/1020/groups/1001?from=groups', '/field/projects/101/days/1011/groups/2001?from=groups']) {
    await assertNotFound(await request(path, scoped));
  }
});

test('read-only members remain read-only even through the new pages', async () => {
  const login = await request('/api/field/auth/login', null, { identifier: 'TEST', password: 'test-password' });
  const member = await request('/api/field/auth/member', sessionCookie(login), { memberId: 12 });
  const cookie = sessionCookie(member);
  const html = pageText(await (await request('/field/projects/101/groups', cookie)).text());
  assert.match(html, /لست ضمن المخولين/);
  assert.equal((await request('/api/field/attendance', cookie, { projectId: 101, dayId: 1011, studentId: 1, status: 'ABSENT' })).status, 403);
  assert.equal((await rows('SELECT COUNT(*) AS n FROM FieldProjectSupervisor WHERE memberId = 12'))[0].n, 0);
});

test('saved statuses survive a new mark and bulk attendance preserves absent/other cases', async () => {
  const original = (await rows('SELECT * FROM FieldAttendance WHERE projectId = 101 AND projectDayId = 1011 AND studentId = 1'))[0];
  const mark = await request('/api/field/attendance', scoped, { projectId: 101, dayId: 1011, studentId: 1, status: 'ABSENT' });
  assert.equal(mark.status, 200);
  const updated = (await rows('SELECT * FROM FieldAttendance WHERE projectId = 101 AND projectDayId = 1011 AND studentId = 1'))[0];
  assert.equal(updated.id, original.id);
  assert.equal(updated.recordedByName, original.recordedByName);
  assert.equal(updated.recordedAt, original.recordedAt);
  assert.equal(updated.updatedByName, 'مشرف الاختبار');
  const bulk = await request('/api/field/attendance/all-present', scoped, { projectId: 101, dayId: 1011, groupId: 1001 });
  assert.equal(bulk.status, 200);
  assert.equal((await bulk.json()).changed, 1);
  const saved = await rows('SELECT studentId, status, otherReason FROM FieldAttendance WHERE projectId = 101 AND projectDayId = 1011 ORDER BY studentId');
  assert.deepEqual(saved, [{ studentId: 1, status: 'ABSENT', otherReason: null }, { studentId: 2, status: 'ABSENT', otherReason: null }, { studentId: 3, status: 'OTHER', otherReason: 'موعد سابق' }, { studentId: 4, status: 'PRESENT', otherReason: null }]);
  assert.equal((await rows('SELECT COUNT(*) AS n FROM FieldAttendanceAuditLog'))[0].n, 2);
  assert.equal((await rows('SELECT otherReason FROM FieldAttendance WHERE projectDayId = 1010'))[0].otherReason, 'حالة يوم سابق');
});

test('invalid/revoked links, inactive identities and archived projects retain their restrictions', async () => {
  assert.equal((await request('/api/field/join', null, { token: 'invalid' })).status, 404);
  assert.equal((await request('/api/field/join', null, { token: tokens.today, memberId: 13 })).status, 404);
  assert.equal((await request('/api/field/join', null, { token: tokens.today, name: 'عضو موقوف' })).status, 403);
  assert.equal((await request('/api/field/join', null, { token: tokens.archived, memberId: 11 })).status, 409);
  await fixture.db.execute("UPDATE FieldProject SET status = 'FINISHED' WHERE id = 101");
  const archived = pageText(await (await request('/field/projects/101/days/1011/groups/1001?from=groups', scoped)).text());
  assert.match(archived, /المشروع مؤرشف/);
  assert.equal((await request('/api/field/attendance', scoped, { projectId: 101, dayId: 1011, studentId: 1, status: 'PRESENT' })).status, 409);
  await fixture.db.execute("UPDATE FieldProjectLink SET token = 'replacement-test-token-123456789' WHERE projectId = 101");
  assert.equal((await request('/field/projects/101/groups', scoped)).headers.get('location'), '/field');
  assert.equal((await request('/api/field/attendance', scoped, { projectId: 101, dayId: 1011, studentId: 1, status: 'PRESENT' })).status, 401);
});
