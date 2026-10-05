import { NextRequest, NextResponse } from 'next/server';
import { query, mutate, batch } from '@/lib/db';
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

/** حذف عضو من الفريق. اسمه يبقى في سجلات التحضير السابقة (محفوظة كلقطة). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const auth = await requireFieldMember();
  if (!auth.ok) return auth.res;
  const { teamId, memberId: me } = auth.ctx;
  const id = Number((await params).memberId);
  if (id === me) return bad('لا يمكنك حذف حسابك الحالي');
  const [m] = await query(`SELECT id FROM FieldTeamMember WHERE id = ? AND teamId = ?`, [id, teamId]);
  if (!m) return bad('العضو غير موجود', 404);
  // لا نترك مشروعاً قائماً بلا أي مخوَّل بالتحضير
  const [sole] = await query<{ name: string }>(
    `SELECT p.name FROM FieldProjectSupervisor s
     JOIN FieldProject p ON p.id = s.projectId AND p.teamId = s.teamId
     WHERE s.memberId = ? AND s.teamId = ? AND p.status <> 'FINISHED'
       AND (SELECT COUNT(*) FROM FieldProjectSupervisor x WHERE x.projectId = s.projectId AND x.teamId = s.teamId) = 1
     LIMIT 1`, [id, teamId]);
  if (sole) return bad(`هذا العضو هو المخوَّل الوحيد بالتحضير في مشروع «${sole.name}». أضف مخوَّلاً آخر أولاً.`, 409);
  await batch([
    { sql: `DELETE FROM FieldProjectSupervisor WHERE memberId = ? AND teamId = ?`, args: [id, teamId] },
    { sql: `DELETE FROM FieldTeamMember WHERE id = ? AND teamId = ?`, args: [id, teamId] },
  ]);
  return NextResponse.json({ ok: true });
}
