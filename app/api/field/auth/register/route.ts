import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { query, mutate } from '@/lib/db';
import { ensureFieldTables, cleanName } from '@/lib/field/db';
import { bad, setFieldCookie, signFieldToken } from '@/lib/field/auth';
import { clientIp, isLimited, recordHit } from '@/lib/field/rate-limit';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return s;
}

export async function POST(req: NextRequest) {
  await ensureFieldTables();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const teamName = cleanName(body.teamName, 60);
  const adminName = cleanName(body.adminName, 60);
  const password = String(body.password ?? '');
  const confirm = String(body.confirm ?? '');

  if (teamName.length < 2) return bad('اكتب اسم الفريق');
  if (adminName.length < 2) return bad('اكتب اسم المسؤول عن الفريق');
  if (password.length < 8) return bad('كلمة المرور يجب ألا تقل عن 8 أحرف');
  if (password.length > 128) return bad('كلمة المرور طويلة جداً');
  if (password !== confirm) return bad('كلمتا المرور غير متطابقتين');

  // حد إنشاء الفرق من العنوان نفسه: 5 فرق في الساعة
  const ipKey = `register-ip:${clientIp(req)}`;
  if (await isLimited(ipKey, 5)) return bad('أنشأت عدة فرق خلال وقت قصير، حاول لاحقاً', 429);

  const [exists] = await query(`SELECT id FROM FieldTeam WHERE name = ? COLLATE NOCASE`, [teamName]);
  if (exists) return bad('يوجد فريق بهذا الاسم، اختر اسماً آخر', 409);

  let code = makeCode();
  for (let i = 0; i < 5; i++) {
    const [taken] = await query(`SELECT id FROM FieldTeam WHERE code = ?`, [code]);
    if (!taken) break;
    code = makeCode();
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const team = await mutate(
    `INSERT INTO FieldTeam (name, code, adminName, passwordHash) VALUES (?, ?, ?, ?)`,
    [teamName, code, adminName, passwordHash]);
  // المسؤول هو أول عضو في الفريق، ويُختار تلقائياً كمستخدم حالي
  const member = await mutate(`INSERT INTO FieldTeamMember (teamId, name) VALUES (?, ?)`, [team.id, adminName]);

  await recordHit(ipKey, 60 * 60 * 1000);

  const res = NextResponse.json({ ok: true, code });
  setFieldCookie(res, await signFieldToken({ teamId: team.id, memberId: member.id }));
  return res;
}
