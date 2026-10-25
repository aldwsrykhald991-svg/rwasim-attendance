import { NextRequest, NextResponse } from 'next/server';
import { mutate } from '@/lib/db';
import { bad, requireFieldMember } from '@/lib/field/auth';
import { loadMarkTarget } from '@/lib/field/attendance';
import { cleanName } from '@/lib/field/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const projectId = Number((await params).projectId);
  const auth = await requireFieldMember(projectId);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const dayId = Number(body.dayId);
  if (![projectId, dayId].every(n => Number.isSafeInteger(n) && n > 0)) return bad('طلب غير صحيح');
  const name = cleanName(body.name, 80);
  if (name.length < 2) return bad('اكتب اسم المحطة أو الانتقال');
  if (name === 'التحضير الأول') return bad('اختر اسماً يميز المحطة الجديدة عن التحضير الأول');
  const target = await loadMarkTarget(auth.ctx, projectId, dayId);
  if (!target.ok) return bad(target.error, target.status);
  const result = await mutate(
    `INSERT INTO FieldCheckpoint (teamId, projectId, projectDayId, name, createdByName)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    [auth.ctx.teamId, projectId, dayId, name, auth.ctx.memberName]);
  if (!result.changes) return bad('توجد محطة بهذا الاسم في اليوم نفسه. اخترها من القائمة أو اكتب اسماً مختلفاً.', 409);
  return NextResponse.json({ ok: true, checkpointId: result.id }, { status: 201 });
}
