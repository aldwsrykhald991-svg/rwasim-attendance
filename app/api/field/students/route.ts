import { NextRequest, NextResponse } from 'next/server';
import { query, batch } from '@/lib/db';
import { cleanName } from '@/lib/field/db';
import { bad, requireFieldMember } from '@/lib/field/auth';

/** إضافة طالب أو عدة طلاب (اسم في كل سطر). الأسماء المكررة داخل الفريق تُتجاهل. */
export async function POST(req: NextRequest) {
  const auth = await requireFieldMember();
  if (!auth.ok) return auth.res;
  const { teamId } = auth.ctx;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const raw = Array.isArray(body.names) ? body.names : [body.name];
  const names = [...new Map(raw.map(n => cleanName(n)).filter(n => n.length >= 2).map(n => [n.toLowerCase(), n])).values()];
  if (!names.length) return bad('اكتب اسم طالب واحد على الأقل');
  if (names.length > 500) return bad('الحد الأقصى 500 اسم في المرة الواحدة');

  const existing = await query<{ name: string }>(`SELECT name FROM FieldStudent WHERE teamId = ? AND active = 1`, [teamId]);
  const have = new Set(existing.map(e => e.name.toLowerCase()));
  const fresh = names.filter(n => !have.has(n.toLowerCase()));
  if (fresh.length) {
    await batch(fresh.map(n => ({ sql: `INSERT INTO FieldStudent (teamId, name) VALUES (?, ?)`, args: [teamId, n] })));
  }
  const rows = await query<{ id: number; name: string }>(
    `SELECT id, name FROM FieldStudent WHERE teamId = ? AND active = 1`, [teamId]);
  const wanted = new Set(names.map(n => n.toLowerCase()));
  const students = rows.filter(r => wanted.has(r.name.toLowerCase())).map(r => ({ id: Number(r.id), name: r.name }));
  return NextResponse.json({ ok: true, added: fresh.length, skipped: names.length - fresh.length, students });
}
