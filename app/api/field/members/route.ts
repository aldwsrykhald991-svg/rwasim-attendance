import { NextRequest, NextResponse } from 'next/server';
import { query, mutate } from '@/lib/db';
import { cleanName } from '@/lib/field/db';
import { bad, requireFieldMember } from '@/lib/field/auth';

export async function POST(req: NextRequest) {
  const auth = await requireFieldMember();
  if (!auth.ok) return auth.res;
  const { teamId } = auth.ctx;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const name = cleanName(body.name, 60);
  if (name.length < 2) return bad('اكتب اسم العضو');
  const [dup] = await query(`SELECT id FROM FieldTeamMember WHERE teamId = ? AND name = ? COLLATE NOCASE`, [teamId, name]);
  if (dup) return bad('يوجد عضو بهذا الاسم', 409);
  const r = await mutate(`INSERT INTO FieldTeamMember (teamId, name) VALUES (?, ?)`, [teamId, name]);
  return NextResponse.json({ ok: true, id: r.id });
}
