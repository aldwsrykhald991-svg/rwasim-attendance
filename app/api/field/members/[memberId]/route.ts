import { NextRequest, NextResponse } from 'next/server';
import { query, mutate } from '@/lib/db';
import { cleanName } from '@/lib/field/db';
import { bad, requireFieldMember } from '@/lib/field/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const auth = await requireFieldMember();
  if (!auth.ok) return auth.res;
  const { teamId, memberId: me } = auth.ctx;
  const id = Number((await params).memberId);
  const [m] = await query(`SELECT id FROM FieldTeamMember WHERE id = ? AND teamId = ?`, [id, teamId]);
  if (!m) return bad('العضو غير موجود', 404);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (body.name !== undefined) {
    const name = cleanName(body.name, 60);
    if (name.length < 2) return bad('اكتب اسم العضو');
    const [dup] = await query(
      `SELECT id FROM FieldTeamMember WHERE teamId = ? AND name = ? COLLATE NOCASE AND id <> ?`, [teamId, name, id]);
    if (dup) return bad('يوجد عضو بهذا الاسم', 409);
    // تغيير الاسم لا يمس المشاريع السابقة (تحفظ اسم المشرف كلقطة تاريخية)
    await mutate(`UPDATE FieldTeamMember SET name = ? WHERE id = ? AND teamId = ?`, [name, id, teamId]);
  }
  if (body.active !== undefined) {
    if (!body.active && id === me) return bad('لا يمكنك إيقاف حسابك الحالي');
    await mutate(`UPDATE FieldTeamMember SET active = ? WHERE id = ? AND teamId = ?`, [body.active ? 1 : 0, id, teamId]);
  }
  return NextResponse.json({ ok: true });
}
