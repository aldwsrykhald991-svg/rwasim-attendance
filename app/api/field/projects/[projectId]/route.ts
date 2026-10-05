// إدارة مشروع قائم: البيانات والحالة، الأيام، المجموعات، المشاركون، المخولون بالتحضير.
// المشروع المنتهي (المؤرشف) مقفل للقراءة فقط إلى أن يُعاد فتحه صراحة.
import { NextRequest, NextResponse } from 'next/server';
import { query, mutate, batch } from '@/lib/db';
import { cleanName, isIsoDate, isProjectStatus } from '@/lib/field/db';
import { bad, requireFieldMember } from '@/lib/field/auth';
import { makeLinkToken } from '@/lib/field/link';

type Body = Record<string, unknown>;

async function resequenceDays(teamId: number, projectId: number) {
  const days = await query<{ id: number }>(
    `SELECT id FROM FieldProjectDay WHERE projectId = ? AND teamId = ? ORDER BY date, id`, [projectId, teamId]);
  await batch(days.map((d, i) => ({ sql: `UPDATE FieldProjectDay SET sortOrder = ? WHERE id = ? AND teamId = ?`, args: [i, d.id, teamId] })));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const auth = await requireFieldMember();
  if (!auth.ok) return auth.res;
  const { teamId } = auth.ctx;
  const projectId = Number((await params).projectId);
  const [project] = await query<{ id: number; status: string }>(
    `SELECT id, status FROM FieldProject WHERE id = ? AND teamId = ?`, [projectId, teamId]);
  if (!project) return bad('المشروع غير موجود', 404);

  const body = await req.json().catch(() => ({})) as Body;
  const action = String(body.action ?? '');

  if (action === 'update') {
    if (body.name !== undefined) {
      if (project.status === 'FINISHED') return bad('المشروع مؤرشف؛ أعد فتحه أولاً للتعديل');
      const name = cleanName(body.name, 100);
      if (name.length < 2) return bad('اكتب اسم المشروع');
      await mutate(`UPDATE FieldProject SET name = ? WHERE id = ? AND teamId = ?`, [name, projectId, teamId]);
    }
    if (body.status !== undefined) {
      if (!isProjectStatus(body.status)) return bad('حالة غير صحيحة');
      await mutate(
        `UPDATE FieldProject SET status = ?, archivedAt = CASE WHEN ? = 'FINISHED' THEN COALESCE(archivedAt, datetime('now')) END
         WHERE id = ? AND teamId = ?`, [body.status, body.status, projectId, teamId]);
    }
    return NextResponse.json({ ok: true });
  }

  // ── رابط التحضير السريع ────────────────────────────────────────────────
  if (action === 'revokeLink') {
    await mutate(`DELETE FROM FieldProjectLink WHERE projectId = ? AND teamId = ?`, [projectId, teamId]);
    return NextResponse.json({ ok: true });
  }

  if (project.status === 'FINISHED') return bad('المشروع مؤرشف؛ أعد فتحه أولاً للتعديل');

  // إنشاء الرابط أو تغييره: التغيير يُبطل الرابط القديم وكل من دخل به
  if (action === 'createLink') {
    const token = makeLinkToken();
    await mutate(
      `INSERT INTO FieldProjectLink (projectId, teamId, token, createdByName) VALUES (?, ?, ?, ?)
       ON CONFLICT(projectId) DO UPDATE SET token = excluded.token, createdByName = excluded.createdByName, createdAt = datetime('now')`,
      [projectId, teamId, token, auth.ctx.memberName]);
    return NextResponse.json({ ok: true, token });
  }

  // ── الأيام ─────────────────────────────────────────────────────────────
  if (action === 'addDay' || action === 'updateDay') {
    if (!isIsoDate(body.date)) return bad('حدد تاريخاً صحيحاً');
    const name = cleanName(body.name, 60) || null;
    const dayId = action === 'updateDay' ? Number(body.dayId) : 0;
    if (action === 'updateDay') {
      const [d] = await query(`SELECT id FROM FieldProjectDay WHERE id = ? AND projectId = ? AND teamId = ?`, [dayId, projectId, teamId]);
      if (!d) return bad('اليوم غير موجود', 404);
    }
    const [dup] = await query(
      `SELECT id FROM FieldProjectDay WHERE projectId = ? AND teamId = ? AND date = ? AND id <> ?`, [projectId, teamId, body.date, dayId]);
    if (dup) return bad('يوجد يوم آخر بنفس التاريخ');
    if (action === 'addDay') {
      await mutate(`INSERT INTO FieldProjectDay (teamId, projectId, date, name) VALUES (?, ?, ?, ?)`, [teamId, projectId, body.date, name]);
    } else {
      await mutate(`UPDATE FieldProjectDay SET date = ?, name = ? WHERE id = ? AND teamId = ?`, [body.date, name, dayId, teamId]);
    }
    await resequenceDays(teamId, projectId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'deleteDay') {
    const dayId = Number(body.dayId);
    const [d] = await query(`SELECT id FROM FieldProjectDay WHERE id = ? AND projectId = ? AND teamId = ?`, [dayId, projectId, teamId]);
    if (!d) return bad('اليوم غير موجود', 404);
    const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM FieldProjectDay WHERE projectId = ? AND teamId = ?`, [projectId, teamId]);
    if (Number(n) <= 1) return bad('المشروع يحتاج يوماً واحداً على الأقل');
    const [used] = await query(`SELECT id FROM FieldAttendance WHERE projectDayId = ? AND teamId = ? LIMIT 1`, [dayId, teamId]);
    if (used) return bad('لا يمكن حذف يوم بدأ فيه التحضير');
    await mutate(`DELETE FROM FieldProjectDay WHERE id = ? AND teamId = ?`, [dayId, teamId]);
    await resequenceDays(teamId, projectId);
    return NextResponse.json({ ok: true });
  }

  // ── المجموعات ──────────────────────────────────────────────────────────
  if (action === 'addGroup' || action === 'renameGroup') {
    const name = cleanName(body.name, 40);
    if (!name) return bad('اكتب اسم المجموعة');
    const groupId = action === 'renameGroup' ? Number(body.groupId) : 0;
    const [dup] = await query(
      `SELECT id FROM FieldGroup WHERE projectId = ? AND teamId = ? AND name = ? COLLATE NOCASE AND id <> ?`, [projectId, teamId, name, groupId]);
    if (dup) return bad('يوجد مجموعة بهذا الاسم');
    if (action === 'addGroup') {
      await mutate(
        `INSERT INTO FieldGroup (teamId, projectId, name, sortOrder)
         VALUES (?, ?, ?, (SELECT COALESCE(MAX(sortOrder), -1) + 1 FROM FieldGroup WHERE projectId = ? AND teamId = ?))`,
        [teamId, projectId, name, projectId, teamId]);
    } else {
      const [g] = await query(`SELECT id FROM FieldGroup WHERE id = ? AND projectId = ? AND teamId = ?`, [groupId, projectId, teamId]);
      if (!g) return bad('المجموعة غير موجودة', 404);
      await batch([
        { sql: `UPDATE FieldGroup SET name = ? WHERE id = ? AND teamId = ?`, args: [name, groupId, teamId] },
        { sql: `UPDATE FieldProjectParticipant SET snapshotGroupName = ? WHERE groupId = ? AND projectId = ? AND teamId = ?`, args: [name, groupId, projectId, teamId] },
      ]);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'deleteGroup') {
    const groupId = Number(body.groupId);
    const [g] = await query(`SELECT id FROM FieldGroup WHERE id = ? AND projectId = ? AND teamId = ?`, [groupId, projectId, teamId]);
    if (!g) return bad('المجموعة غير موجودة', 404);
    const [member] = await query(`SELECT id FROM FieldProjectParticipant WHERE groupId = ? AND teamId = ? LIMIT 1`, [groupId, teamId]);
    if (member) return bad('انقل طلاب المجموعة أولاً ثم احذفها');
    const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM FieldGroup WHERE projectId = ? AND teamId = ?`, [projectId, teamId]);
    if (Number(n) <= 1) return bad('المشروع يحتاج مجموعة واحدة على الأقل');
    await mutate(`DELETE FROM FieldGroup WHERE id = ? AND teamId = ?`, [groupId, teamId]);
    return NextResponse.json({ ok: true });
  }

  // ── المشاركون ──────────────────────────────────────────────────────────
  async function loadGroup(groupId: number) {
    const [g] = await query<{ id: number; name: string }>(
      `SELECT id, name FROM FieldGroup WHERE id = ? AND projectId = ? AND teamId = ?`, [groupId, projectId, teamId]);
    return g;
  }

  if (action === 'addParticipants') {
    const group = await loadGroup(Number(body.groupId));
    if (!group) return bad('اختر المجموعة');
    const ids = [...new Set((Array.isArray(body.studentIds) ? body.studentIds : []).map(Number))];
    if (!ids.length) return bad('اختر طالباً واحداً على الأقل');
    const rows = await query<{ id: number; name: string }>(
      `SELECT s.id, s.name FROM FieldStudent s
       WHERE s.teamId = ? AND s.active = 1
         AND NOT EXISTS (SELECT 1 FROM FieldProjectParticipant p WHERE p.projectId = ? AND p.studentId = s.id)`,
      [teamId, projectId]);
    const allowed = new Map(rows.map(r => [Number(r.id), r.name]));
    const toAdd = ids.filter(id => allowed.has(id));
    if (!toAdd.length) return bad('الطلاب المختارون مضافون مسبقاً أو غير موجودين');
    await batch(toAdd.map(id => ({
      sql: `INSERT INTO FieldProjectParticipant (teamId, projectId, groupId, studentId, snapshotName, snapshotGroupName) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [teamId, projectId, group.id, id, allowed.get(id)!, group.name],
    })));
    return NextResponse.json({ ok: true, added: toAdd.length });
  }

  if (action === 'moveParticipant') {
    const group = await loadGroup(Number(body.groupId));
    if (!group) return bad('اختر المجموعة');
    const r = await mutate(
      `UPDATE FieldProjectParticipant SET groupId = ?, snapshotGroupName = ? WHERE projectId = ? AND studentId = ? AND teamId = ?`,
      [group.id, group.name, projectId, Number(body.studentId), teamId]);
    if (!r.changes) return bad('الطالب غير مشارك في المشروع', 404);
    return NextResponse.json({ ok: true });
  }

  if (action === 'removeParticipant') {
    const studentId = Number(body.studentId);
    const [used] = await query(
      `SELECT id FROM FieldAttendance WHERE projectId = ? AND studentId = ? AND teamId = ? AND status <> 'NOT_MARKED' LIMIT 1`,
      [projectId, studentId, teamId]);
    if (used) return bad('لا يمكن إزالة طالب له سجل حضور في المشروع');
    await batch([
      { sql: `DELETE FROM FieldAttendance WHERE projectId = ? AND studentId = ? AND teamId = ?`, args: [projectId, studentId, teamId] },
      { sql: `DELETE FROM FieldProjectParticipant WHERE projectId = ? AND studentId = ? AND teamId = ?`, args: [projectId, studentId, teamId] },
    ]);
    return NextResponse.json({ ok: true });
  }

  // ── استيراد سجل (اسم + مجموعة) إلى مشروع قائم ──────────────────────────
  // ينشئ الطلاب والمجموعات الناقصة، ويضيف الطلاب للمشروع، وينقل الموجودين لمجموعتهم في السجل.
  if (action === 'importRoster') {
    const raw = Array.isArray(body.rows) ? body.rows : [];
    if (raw.length > 1000) return bad('الحد الأقصى 1000 طالب في المرة الواحدة');
    const rows = new Map<string, { name: string; group: string }>();
    const [firstGroup] = await query<{ name: string }>(
      `SELECT name FROM FieldGroup WHERE projectId = ? AND teamId = ? ORDER BY sortOrder, id LIMIT 1`, [projectId, teamId]);
    for (const r of raw as { name?: unknown; group?: unknown }[]) {
      const name = cleanName(r?.name);
      const group = cleanName(r?.group, 40) || firstGroup?.name || '';
      if (name.length >= 2 && group) rows.set(name.toLowerCase(), { name, group });
    }
    if (!rows.size) return bad('لا توجد أسماء صالحة في السجل');

    // الطلاب
    const students = await query<{ id: number; name: string }>(`SELECT id, name FROM FieldStudent WHERE teamId = ? AND active = 1`, [teamId]);
    const studentByName = new Map(students.map(s => [s.name.toLowerCase(), { id: Number(s.id), name: s.name }]));
    const newStudents = [...rows.values()].filter(r => !studentByName.has(r.name.toLowerCase()));
    if (newStudents.length) {
      await batch(newStudents.map(r => ({ sql: `INSERT INTO FieldStudent (teamId, name) VALUES (?, ?)`, args: [teamId, r.name] })));
      for (const s of await query<{ id: number; name: string }>(`SELECT id, name FROM FieldStudent WHERE teamId = ? AND active = 1`, [teamId])) {
        studentByName.set(s.name.toLowerCase(), { id: Number(s.id), name: s.name });
      }
    }

    // المجموعات
    const groupRows = await query<{ id: number; name: string; sortOrder: number }>(
      `SELECT id, name, sortOrder FROM FieldGroup WHERE projectId = ? AND teamId = ?`, [projectId, teamId]);
    const groupByName = new Map(groupRows.map(g => [g.name.toLowerCase(), { id: Number(g.id), name: g.name }]));
    const newGroups = [...new Map([...rows.values()].filter(r => !groupByName.has(r.group.toLowerCase())).map(r => [r.group.toLowerCase(), r.group])).values()];
    if (newGroups.length) {
      const base = Math.max(-1, ...groupRows.map(g => Number(g.sortOrder))) + 1;
      await batch(newGroups.map((g, i) => ({
        sql: `INSERT INTO FieldGroup (teamId, projectId, name, sortOrder) VALUES (?, ?, ?, ?)`, args: [teamId, projectId, g, base + i],
      })));
      for (const g of await query<{ id: number; name: string }>(`SELECT id, name FROM FieldGroup WHERE projectId = ? AND teamId = ?`, [projectId, teamId])) {
        groupByName.set(g.name.toLowerCase(), { id: Number(g.id), name: g.name });
      }
    }

    // المشاركون
    const current = await query<{ studentId: number; groupId: number }>(
      `SELECT studentId, groupId FROM FieldProjectParticipant WHERE projectId = ? AND teamId = ?`, [projectId, teamId]);
    const currentGroup = new Map(current.map(c => [Number(c.studentId), Number(c.groupId)]));
    const stmts: { sql: string; args: (string | number)[] }[] = [];
    let added = 0, moved = 0;
    for (const r of rows.values()) {
      const s = studentByName.get(r.name.toLowerCase());
      const g = groupByName.get(r.group.toLowerCase());
      if (!s || !g) continue;
      const cur = currentGroup.get(s.id);
      if (cur == null) {
        added++;
        stmts.push({
          sql: `INSERT INTO FieldProjectParticipant (teamId, projectId, groupId, studentId, snapshotName, snapshotGroupName) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [teamId, projectId, g.id, s.id, s.name, g.name],
        });
      } else if (cur !== g.id) {
        moved++;
        stmts.push({
          sql: `UPDATE FieldProjectParticipant SET groupId = ?, snapshotGroupName = ? WHERE projectId = ? AND studentId = ? AND teamId = ?`,
          args: [g.id, g.name, projectId, s.id, teamId],
        });
      }
    }
    if (stmts.length) await batch(stmts);
    return NextResponse.json({ ok: true, added, moved, newStudents: newStudents.length, newGroups: newGroups.length });
  }

  // ── المخولون بالتحضير ──────────────────────────────────────────────────
  if (action === 'setSupervisors') {
    const ids = [...new Set((Array.isArray(body.memberIds) ? body.memberIds : []).map(Number))];
    const members = await query<{ id: number; name: string }>(
      `SELECT id, name FROM FieldTeamMember WHERE teamId = ? AND active = 1`, [teamId]);
    const nameById = new Map(members.map(m => [Number(m.id), m.name]));
    const valid = ids.filter(id => nameById.has(id));
    if (!valid.length) return bad('حدد عضواً واحداً على الأقل');
    await batch([
      { sql: `DELETE FROM FieldProjectSupervisor WHERE projectId = ? AND teamId = ?`, args: [projectId, teamId] },
      ...valid.map(id => ({
        sql: `INSERT INTO FieldProjectSupervisor (teamId, projectId, memberId, snapshotName) VALUES (?, ?, ?, ?)`,
        args: [teamId, projectId, id, nameById.get(id)!],
      })),
    ]);
    return NextResponse.json({ ok: true });
  }

  return bad('إجراء غير معروف');
}
