import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { bad, requireFieldMember } from '@/lib/field/auth';
import { applyChanges } from '@/lib/field/attendance';
import { checkpointId, hasAttendanceTarget } from '@/lib/field/checkpoints';

/**
 * «تحضير الجميع حاضر»: يسجل طلاب المجموعة الذين لم يُحضَّروا بعد كحاضرين.
 * الحالات المحددة مسبقاً (غائب / أخرى) لا تُمس حتى لا تضيع أسباب مكتوبة.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = Number(body.projectId);
  const auth = await requireFieldMember(projectId);
  if (!auth.ok) return auth.res;
  const { teamId } = auth.ctx;
  const dayId = Number(body.dayId);
  const groupId = Number(body.groupId);
  const checkpoint = checkpointId(body.checkpointId);
  if (![projectId, dayId, groupId].every(n => Number.isSafeInteger(n) && n > 0) || !Number.isFinite(checkpoint)) return bad('طلب غير صحيح');
  if (!await hasAttendanceTarget(teamId, projectId, dayId, groupId, checkpoint)) return bad('اليوم أو المجموعة أو المحطة غير موجودة', 404);

  const rows = await query<{ studentId: number }>(
    `SELECT studentId FROM FieldProjectParticipant WHERE projectId = ? AND groupId = ? AND teamId = ?`,
    [projectId, groupId, teamId]);

  const r = await applyChanges(auth.ctx, projectId, dayId,
    rows.map(row => ({ studentId: Number(row.studentId), status: 'PRESENT' as const, otherReason: null })), checkpoint, true);
  if (!r.ok) return bad(r.error, r.status);
  return NextResponse.json({ ok: true, changed: r.changed });
}
