// جلسة منصة التحضير الميداني — مستقلة عن أي جلسة أخرى في الموقع.
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { query } from '@/lib/db';
import { ensureFieldTables } from './db';

export const FIELD_COOKIE = 'field_session';
const AUDIENCE = 'field-platform';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 يوماً

export interface FieldSession {
  teamId: number;
  memberId: number | null;
}

export interface FieldContext {
  teamId: number;
  teamName: string;
  teamCode: string;
  memberId: number | null;
  memberName: string | null;
}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is not set');
  return new TextEncoder().encode(s);
}

export async function signFieldToken(session: FieldSession): Promise<string> {
  return new SignJWT({ teamId: session.teamId, memberId: session.memberId })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export function setFieldCookie(res: NextResponse, token: string) {
  res.cookies.set(FIELD_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearFieldCookie(res: NextResponse) {
  res.cookies.set(FIELD_COOKIE, '', { path: '/', maxAge: 0 });
}

async function readSession(): Promise<FieldSession | null> {
  const token = (await cookies()).get(FIELD_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE });
    const teamId = Number(payload.teamId);
    if (!Number.isInteger(teamId) || teamId <= 0) return null;
    const memberId = payload.memberId == null ? null : Number(payload.memberId);
    return { teamId, memberId: Number.isInteger(memberId) ? memberId : null };
  } catch {
    return null;
  }
}

/**
 * يقرأ الجلسة ويتحقق من قاعدة البيانات أن الفريق موجود وأن العضو المختار
 * ينتمي لهذا الفريق وما زال نشطاً. لا يُوثق بأي قيمة قادمة من الواجهة.
 */
export const getFieldContext = cache(async (): Promise<FieldContext | null> => {
  const session = await readSession();
  if (!session) return null;
  await ensureFieldTables();
  const [team] = await query<{ id: number; name: string; code: string }>(
    `SELECT id, name, code FROM FieldTeam WHERE id = ?`, [session.teamId]);
  if (!team) return null;
  let memberName: string | null = null;
  let memberId: number | null = null;
  if (session.memberId) {
    const [m] = await query<{ id: number; name: string }>(
      `SELECT id, name FROM FieldTeamMember WHERE id = ? AND teamId = ? AND active = 1`, [session.memberId, team.id]);
    if (m) { memberId = Number(m.id); memberName = m.name; }
  }
  return { teamId: Number(team.id), teamName: team.name, teamCode: team.code, memberId, memberName };
});

export type ApiAuth =
  | { ok: true; ctx: FieldContext & { memberId: number; memberName: string } }
  | { ok: false; res: NextResponse };

/** للـ APIs: يتطلب فريقاً مسجلاً + عضواً محدداً (من أنت؟) */
export async function requireFieldMember(): Promise<ApiAuth> {
  const ctx = await getFieldContext();
  if (!ctx) return { ok: false, res: NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 }) };
  if (!ctx.memberId || !ctx.memberName) {
    return { ok: false, res: NextResponse.json({ error: 'اختر اسمك أولاً' }, { status: 403 }) };
  }
  return { ok: true, ctx: { ...ctx, memberId: ctx.memberId, memberName: ctx.memberName } };
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** لصفحات المنصة: يتطلب فريقاً + عضواً محدداً، وإلا يعيد التوجيه */
export async function requireFieldPage(): Promise<FieldContext & { memberId: number; memberName: string }> {
  const ctx = await getFieldContext();
  if (!ctx) redirect('/field');
  if (!ctx.memberId || !ctx.memberName) redirect('/field/who');
  return { ...ctx, memberId: ctx.memberId, memberName: ctx.memberName };
}
