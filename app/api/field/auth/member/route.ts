// «من أنت؟» — اختيار العضو الذي يستخدم حساب الفريق الآن
import { NextRequest, NextResponse } from 'next/server';
import { query, mutate } from '@/lib/db';
import { cleanName } from '@/lib/field/db';
import { bad, getFieldContext, setFieldCookie, signFieldToken } from '@/lib/field/auth';

export async function POST(req: NextRequest) {
  const ctx = await getFieldContext();
  if (!ctx) return bad('يجب تسجيل الدخول', 401);
  if (ctx.scopeProjectId) return bad('هذا الرابط للتحضير في مشروعه فقط', 403);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  let memberId: number;
  if (body.newName !== undefined) {
    const name = cleanName(body.newName, 60);
    if (name.length < 2) return bad('اكتب الاسم');
    const [dup] = await query<{ id: number; active: number }>(
      `SELECT id, active FROM FieldTeamMember WHERE teamId = ? AND name = ? COLLATE NOCASE`, [ctx.teamId, name]);
    if (dup && Number(dup.active)) return bad('هذا الاسم موجود في القائمة، اختره منها', 409);
    if (dup) {
      await mutate(`UPDATE FieldTeamMember SET active = 1 WHERE id = ? AND teamId = ?`, [dup.id, ctx.teamId]);
      memberId = Number(dup.id);
    } else {
      memberId = (await mutate(`INSERT INTO FieldTeamMember (teamId, name) VALUES (?, ?)`, [ctx.teamId, name])).id;
    }
  } else {
    const [m] = await query<{ id: number }>(
      `SELECT id FROM FieldTeamMember WHERE id = ? AND teamId = ? AND active = 1`, [Number(body.memberId), ctx.teamId]);
    if (!m) return bad('العضو غير موجود في هذا الفريق', 404);
    memberId = Number(m.id);
  }

  const res = NextResponse.json({ ok: true });
  setFieldCookie(res, await signFieldToken({ teamId: ctx.teamId, memberId }));
  return res;
}
