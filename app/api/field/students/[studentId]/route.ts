import { NextRequest, NextResponse } from 'next/server';
import { query, mutate } from '@/lib/db';
import { cleanName } from '@/lib/field/db';
import { bad, requireFieldMember } from '@/lib/field/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await requireFieldMember();
  if (!auth.ok) return auth.res;
  const { teamId } = auth.ctx;
  const id = Number((await params).studentId);
  const [s] = await query(`SELECT id FROM FieldStudent WHERE id = ? AND teamId = ?`, [id, teamId]);
  if (!s) return bad('الطالب غير موجود', 404);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (body.name !== undefined) {
    const name = cleanName(body.name);
    if (name.length < 2) return bad('اكتب اسم الطالب');
    // يغيّر الاسم في سجل الفريق فقط؛ المشاريع تحتفظ بالاسم وقت المشروع (snapshotName)
    await mutate(`UPDATE FieldStudent SET name = ? WHERE id = ? AND teamId = ?`, [name, id, teamId]);
  }
  if (body.active !== undefined) {
    await mutate(`UPDATE FieldStudent SET active = ? WHERE id = ? AND teamId = ?`, [body.active ? 1 : 0, id, teamId]);
  }
  return NextResponse.json({ ok: true });
}
