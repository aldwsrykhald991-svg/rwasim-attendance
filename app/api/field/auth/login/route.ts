import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { ensureFieldTables, cleanName } from '@/lib/field/db';
import { bad, setFieldCookie, signFieldToken } from '@/lib/field/auth';

// حد بسيط لمحاولات الدخول الخاطئة (لكل نسخة خادم)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map<string, { n: number; until: number }>();

export async function POST(req: NextRequest) {
  await ensureFieldTables();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const identifier = cleanName(body.identifier, 60);
  const password = String(body.password ?? '');
  if (!identifier || !password) return bad('اكتب اسم الفريق أو رمزه وكلمة المرور');

  const key = identifier.toLowerCase();
  const now = Date.now();
  const f = fails.get(key);
  if (f && f.until > now && f.n >= MAX_FAILS) return bad('محاولات كثيرة، حاول بعد دقائق', 429);

  const [team] = await query<{ id: number; passwordHash: string }>(
    `SELECT id, passwordHash FROM FieldTeam WHERE name = ? COLLATE NOCASE OR code = ? LIMIT 1`,
    [identifier, identifier.toUpperCase()]);
  const ok = team ? await bcrypt.compare(password, team.passwordHash) : false;
  if (!team || !ok) {
    const cur = f && f.until > now ? f : { n: 0, until: now + WINDOW_MS };
    cur.n += 1;
    fails.set(key, cur);
    return bad('اسم الفريق أو كلمة المرور غير صحيحة', 401);
  }
  fails.delete(key);

  const res = NextResponse.json({ ok: true });
  setFieldCookie(res, await signFieldToken({ teamId: Number(team.id), memberId: null }));
  return res;
}
