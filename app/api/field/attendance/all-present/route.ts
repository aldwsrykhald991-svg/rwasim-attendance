import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { bad, requireFieldMember } from '@/lib/field/auth';
import { applyChanges } from '@/lib/field/attendance';

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

  const rows = await query<{ studentId: number }>(
    `SELECT pp.studentId FROM FieldProjectParticipant pp
     LEFT JOIN FieldAttendance a ON a.projectId = pp.projectId AND a.studentId = pp.studentId AND a.projectDayId = ? AND a.teamId = pp.teamId
     WHERE pp.projectId = ? AND pp.groupId = ? AND pp.teamId = ? AND COALESCE(a.status, 'NOT_MARKED') = 'NOT_MARKED'`,
    [dayId, projectId, groupId, teamId]);

  const r = await applyChanges(auth.ctx, projectId, dayId,
    rows.map(row => ({ studentId: Number(row.studentId), status: 'PRESENT' as const, otherReason: null })));
  if (!r.ok) return bad(r.error, r.status);
  return NextResponse.json({ ok: true, changed: r.changed });
}
