// كتابة الحضور: سجل مستقل لكل (مشروع + يوم + محطة + طالب).
// القراءة والكتابة وسجل التعديل في معاملة واحدة حتى لا تتسابق تحضيرات المشرفين.
import { query, db } from '@/lib/db';
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
export async function loadMarkTarget(ctx: MarkContext, projectId: number, dayId: number, checkpointId = 0):
  Promise<{ ok: true; projectName: string; dayText: string } | Fail> {
  if (!Number.isSafeInteger(checkpointId) || checkpointId < 0) return { ok: false, error: 'محطة غير صحيحة', status: 400 };
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

  let checkpointName = 'التحضير الأول';
  if (checkpointId > 0) {
    const [checkpoint] = await query<{ name: string }>(
      `SELECT name FROM FieldCheckpoint WHERE id = ? AND teamId = ? AND projectId = ? AND projectDayId = ?`,
      [checkpointId, ctx.teamId, projectId, dayId]);
    if (!checkpoint) return { ok: false, error: 'المحطة غير موجودة في هذا اليوم', status: 404 };
    checkpointName = checkpoint.name;
  }
  const day = days[index];
  return { ok: true, projectName: project.name, dayText: `${dayLabel(index, day.name)} (${formatDay(day.date)}) • ${checkpointName}` };
}

export async function applyChanges(ctx: MarkContext, projectId: number, dayId: number, changes: Change[], checkpointId = 0, onlyUnmarked = false):
  Promise<{ ok: true; changed: number } | Fail> {
  const target = await loadMarkTarget(ctx, projectId, dayId, checkpointId);
  if (!target.ok) return target;
  if (!changes.length) return { ok: true, changed: 0 };

  const transaction = await db.transaction('write');
  try {
    const read = async <T,>(sql: string, args: (string | number | null)[]): Promise<T[]> =>
      (await transaction.execute({ sql, args })).rows as unknown as T[];
    const attendanceTable = checkpointId > 0 ? 'FieldCheckpointAttendance' : 'FieldAttendance';
    const auditTable = checkpointId > 0 ? 'FieldCheckpointAuditLog' : 'FieldAttendanceAuditLog';
    const extraColumn = checkpointId > 0 ? ', checkpointId' : '';
    const extraValue = checkpointId > 0 ? ', ?' : '';
    const extraArgs = checkpointId > 0 ? [checkpointId] : [];
    const checkpointFilter = checkpointId > 0 ? ' AND checkpointId = ?' : '';

    const ids = changes.map(c => c.studentId);
    const marks = ids.map(() => '?').join(',');
    const [participants, existing] = await Promise.all([
      read<{ studentId: number; groupId: number; snapshotName: string; snapshotGroupName: string }>(
        `SELECT studentId, groupId, snapshotName, snapshotGroupName FROM FieldProjectParticipant
         WHERE projectId = ? AND teamId = ? AND studentId IN (${marks})`, [projectId, ctx.teamId, ...ids]),
      read<{ studentId: number; status: string; otherReason: string | null }>(
        `SELECT studentId, status, otherReason FROM FieldAttendanceRecord
         WHERE projectId = ? AND projectDayId = ? AND teamId = ? AND checkpointId = ? AND studentId IN (${marks})`, [projectId, dayId, ctx.teamId, checkpointId, ...ids]),
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
      if (onlyUnmarked && oldStatus !== 'NOT_MARKED') continue;
      if (oldStatus === c.status && (oldReason ?? null) === newReason) continue;
      changed++;
      statements.push({
        sql: `INSERT INTO ${attendanceTable}
                (teamId, projectId, projectDayId, groupId, studentId, status, otherReason, recordedById, recordedByName, updatedById, updatedByName${extraColumn})
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${extraValue})
              ON CONFLICT(projectId, projectDayId${extraColumn}, studentId) DO UPDATE SET
                status = excluded.status, otherReason = excluded.otherReason, groupId = excluded.groupId,
                updatedById = excluded.updatedById, updatedByName = excluded.updatedByName, updatedAt = datetime('now')`,
        args: [ctx.teamId, projectId, dayId, p.groupId, c.studentId, c.status, newReason,
          ctx.memberId, ctx.memberName, ctx.memberId, ctx.memberName, ...extraArgs],
      });
      statements.push({
        sql: `INSERT INTO ${auditTable}
                (teamId, attendanceId, projectId, projectDayId, groupId, studentId, studentName, projectName, dayLabel, groupName,
                 oldStatus, newStatus, oldReason, newReason, changedById, changedByName${extraColumn})
              VALUES (?, (SELECT id FROM ${attendanceTable} WHERE projectId = ? AND projectDayId = ? AND studentId = ?${checkpointFilter}),
                      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${extraValue})`,
        args: [ctx.teamId, projectId, dayId, c.studentId, ...extraArgs,
          projectId, dayId, p.groupId, c.studentId, p.snapshotName, target.projectName, target.dayText, p.snapshotGroupName,
          oldStatus, c.status, oldReason, newReason, ctx.memberId, ctx.memberName, ...extraArgs],
      });
    }
    if (statements.length) await transaction.batch(statements);
    await transaction.commit();
    return { ok: true, changed };
  } finally {
    transaction.close();
  }
}
