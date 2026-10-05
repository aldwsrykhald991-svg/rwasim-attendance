import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { ensureFieldTables, cleanName } from '@/lib/field/db';
import { bad, setFieldCookie, signFieldToken } from '@/lib/field/auth';
import { clearHits, clientIp, isLimited, recordHit } from '@/lib/field/rate-limit';

// حد محاولات الدخول الخاطئة: لكل فريق ولكل عنوان IP، محفوظ في القاعدة
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 10;
const MAX_FAILS_IP = 30;
const MAX_FAILS_TEAM = 100;

export async function POST(req: NextRequest) {
  await ensureFieldTables();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const identifier = cleanName(body.identifier, 60);
  const password = String(body.password ?? '');
  if (!identifier || !password) return bad('اكتب اسم الفريق أو رمزه وكلمة المرور');

  // المفتاح الأساسي (فريق + عنوان) حتى لا يستطيع غريب قفل فريق على أصحابه،
  // ومعه سقف أعلى للفريق كله وللعنوان كله ضد التخمين الموزّع.
  const ip = clientIp(req);
  const key = `login:${identifier.toLowerCase()}:${ip}`;
  const teamKey = `login-team:${identifier.toLowerCase()}`;
  const ipKey = `login-ip:${ip}`;
  if (await isLimited(key, MAX_FAILS) || await isLimited(teamKey, MAX_FAILS_TEAM) || await isLimited(ipKey, MAX_FAILS_IP)) {
    return bad('محاولات كثيرة، حاول بعد 10 دقائق', 429);
  }

  const [team] = await query<{ id: number; passwordHash: string }>(
    `SELECT id, passwordHash FROM FieldTeam WHERE name = ? COLLATE NOCASE OR code = ? LIMIT 1`,
    [identifier, identifier.toUpperCase()]);
  const ok = team ? await bcrypt.compare(password, team.passwordHash) : false;
  if (!team || !ok) {
    await Promise.all([recordHit(key, WINDOW_MS), recordHit(teamKey, WINDOW_MS), recordHit(ipKey, WINDOW_MS)]);
    return bad('اسم الفريق أو كلمة المرور غير صحيحة', 401);
  }
  await clearHits(key);

  const res = NextResponse.json({ ok: true });
  setFieldCookie(res, await signFieldToken({ teamId: Number(team.id), memberId: null }));
  return res;
}
