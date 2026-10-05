// كتابة الحضور: سجل واحد لكل (مشروع + يوم + طالب)، يُعدَّل في مكانه
// وكل تغيير يُسجَّل في FieldAttendanceAuditLog ضمن نفس المعاملة.
import { query, batch } from '@/lib/db';
import type { AttendanceStatus } from './db';
import { dayLabel, formatDay } from './format';

export interface MarkContext {
  teamId: number;
  memberId: number;
  memberName: string;
}

export interface Change {
  studentId: number;
  status: AttendanceStatus;
  otherReason: string | null;
}

type Fail = { ok: false; error: string; status: number };

/** يتحقق أن المشروع واليوم يتبعان الفريق، وأن المشروع غير مؤرشف، وأن العضو مخول بالتحضير */
export async function loadMarkTarget(ctx: MarkContext, projectId: number, dayId: number):
  Promise<{ ok: true; projectName: string; dayText: string } | Fail> {
  const [project] = await query<{ name: string; status: string }>(
    `SELECT name, status FROM FieldProject WHERE id = ? AND teamId = ?`, [projectId, ctx.teamId]);
  if (!project) return { ok: false, error: 'المشروع غير موجود', status: 404 };
  if (project.status === 'FINISHED') return { ok: false, error: 'المشروع مؤرشف ولا يمكن تعديل حضوره', status: 409 };

  const days = await query<{ id: number; date: string; name: string | null }>(
    `SELECT id, date, name FROM FieldProjectDay WHERE projectId = ? AND teamId = ? ORDER BY sortOrder, date, id`, [projectId, ctx.teamId]);
  const index = days.findIndex(d => Number(d.id) === dayId);
  if (index < 0) return { ok: false, error: 'اليوم غير موجود', status: 404 };

  const [allowed] = await query(
    `SELECT id FROM FieldProjectSupervisor WHERE projectId = ? AND memberId = ? AND teamId = ?`, [projectId, ctx.memberId, ctx.teamId]);
  if (!allowed) return { ok: false, error: 'لست ضمن المخولين بالتحضير في هذا المشروع', status: 403 };

  const day = days[index];
  return { ok: true, projectName: project.name, dayText: `${dayLabel(index, day.name)} (${formatDay(day.date)})` };
}

export async function applyChanges(ctx: MarkContext, projectId: number, dayId: number, changes: Change[]):
  Promise<{ ok: true; changed: number } | Fail> {
  const target = await loadMarkTarget(ctx, projectId, dayId);
  if (!target.ok) return target;
  if (!changes.length) return { ok: true, changed: 0 };

  const ids = changes.map(c => c.studentId);
  const marks = ids.map(() => '?').join(',');
  const [participants, existing] = await Promise.all([
    query<{ studentId: number; groupId: number; snapshotName: string; snapshotGroupName: string }>(
      `SELECT studentId, groupId, snapshotName, snapshotGroupName FROM FieldProjectParticipant
       WHERE projectId = ? AND teamId = ? AND studentId IN (${marks})`, [projectId, ctx.teamId, ...ids]),
    query<{ studentId: number; status: string; otherReason: string | null }>(
      `SELECT studentId, status, otherReason FROM FieldAttendance
       WHERE projectId = ? AND projectDayId = ? AND teamId = ? AND studentId IN (${marks})`, [projectId, dayId, ctx.teamId, ...ids]),
  ]);
  const partBy = new Map(participants.map(p => [Number(p.studentId), p]));
  const oldBy = new Map(existing.map(e => [Number(e.studentId), e]));
  if (changes.some(c => !partBy.has(c.studentId))) return { ok: false, error: 'الطالب غير مشارك في هذا المشروع', status: 404 };

  const statements: { sql: string; args: (string | number | null)[] }[] = [];
  let changed = 0;
  for (const c of changes) {
    const p = partBy.get(c.studentId)!;
    const old = oldBy.get(c.studentId);
    const oldStatus = old?.status ?? 'NOT_MARKED';
    const oldReason = old?.otherReason ?? null;
    const newReason = c.status === 'OTHER' ? c.otherReason : null;
    if (oldStatus === c.status && (oldReason ?? null) === newReason) continue;
    changed++;
    statements.push({
      sql: `INSERT INTO FieldAttendance
              (teamId, projectId, projectDayId, groupId, studentId, status, otherReason, recordedById, recordedByName, updatedById, updatedByName)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(projectId, projectDayId, studentId) DO UPDATE SET
              status = excluded.status, otherReason = excluded.otherReason, groupId = excluded.groupId,
              updatedById = excluded.updatedById, updatedByName = excluded.updatedByName, updatedAt = datetime('now')`,
      args: [ctx.teamId, projectId, dayId, p.groupId, c.studentId, c.status, newReason,
        ctx.memberId, ctx.memberName, ctx.memberId, ctx.memberName],
    });
    statements.push({
      sql: `INSERT INTO FieldAttendanceAuditLog
              (teamId, attendanceId, projectId, projectDayId, groupId, studentId, studentName, projectName, dayLabel, groupName,
               oldStatus, newStatus, oldReason, newReason, changedById, changedByName)
            VALUES (?, (SELECT id FROM FieldAttendance WHERE projectId = ? AND projectDayId = ? AND studentId = ?),
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [ctx.teamId, projectId, dayId, c.studentId,
        projectId, dayId, p.groupId, c.studentId, p.snapshotName, target.projectName, target.dayText, p.snapshotGroupName,
        oldStatus, c.status, oldReason, newReason, ctx.memberId, ctx.memberName],
    });
  }
  if (statements.length) await batch(statements);
  return { ok: true, changed };
}
