// الدخول برابط التحضير السريع: بلا اسم فريق ولا كلمة مرور، ومقيد بمشروع واحد.
import { NextRequest, NextResponse } from 'next/server';
import { query, mutate } from '@/lib/db';
import { ensureFieldTables, cleanName, todayInRiyadh } from '@/lib/field/db';
import { bad, setFieldCookie, signFieldToken } from '@/lib/field/auth';
import { linkKey } from '@/lib/field/link';
import { clientIp, isLimited, recordHit } from '@/lib/field/rate-limit';

const MAX_MEMBERS = 200;

export async function POST(req: NextRequest) {
  await ensureFieldTables();
  const ipKey = `join-ip:${clientIp(req)}`;
  if (await isLimited(ipKey, 40)) return bad('محاولات كثيرة، حاول بعد دقائق', 429);
  await recordHit(ipKey, 10 * 60 * 1000);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const token = String(body.token ?? '');
  if (token.length < 20 || token.length > 80) return bad('الرابط غير صالح', 404);

  const [link] = await query<{ projectId: number; teamId: number; token: string; status: string }>(
    `SELECT l.projectId, l.teamId, l.token, p.status
     FROM FieldProjectLink l JOIN FieldProject p ON p.id = l.projectId AND p.teamId = l.teamId
     WHERE l.token = ?`, [token]);
  if (!link) return bad('هذا الرابط لم يعد صالحاً. اطلب رابطاً جديداً من مسؤول المشروع.', 404);
  if (link.status === 'FINISHED') return bad('المشروع مؤرشف ولا يقبل التحضير', 409);
  const teamId = Number(link.teamId);
  const projectId = Number(link.projectId);

  let memberId: number;
  let memberName: string;
  if (body.memberId !== undefined) {
    // اختيار اسم من المخولين بالتحضير في المشروع
    const [m] = await query<{ id: number; name: string }>(
      `SELECT m.id, m.name FROM FieldProjectSupervisor s
       JOIN FieldTeamMember m ON m.id = s.memberId AND m.teamId = s.teamId
       WHERE s.projectId = ? AND s.teamId = ? AND m.id = ? AND m.active = 1`, [projectId, teamId, Number(body.memberId)]);
    if (!m) return bad('الاسم غير موجود في هذا المشروع', 404);
    memberId = Number(m.id); memberName = m.name;
  } else {
    const name = cleanName(body.name, 60);
    if (name.length < 2) return bad('اكتب اسمك');
    const [existing] = await query<{ id: number; name: string; active: number }>(
      `SELECT id, name, active FROM FieldTeamMember WHERE teamId = ? AND name = ? COLLATE NOCASE`, [teamId, name]);
    if (existing && !Number(existing.active)) return bad('هذا الاسم موقوف في الفريق. تواصل مع مسؤول الفريق.', 403);
    if (existing) {
      memberId = Number(existing.id); memberName = existing.name;
    } else {
      const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM FieldTeamMember WHERE teamId = ?`, [teamId]);
      if (Number(n) >= MAX_MEMBERS) return bad('بلغ الفريق الحد الأقصى من الأعضاء. تواصل مع مسؤول الفريق.', 409);
      memberId = (await mutate(`INSERT INTO FieldTeamMember (teamId, name) VALUES (?, ?)`, [teamId, name])).id;
      memberName = name;
    }
  }
  // حامل الرابط مخوَّل بالتحضير في هذا المشروع
  await mutate(
    `INSERT INTO FieldProjectSupervisor (teamId, projectId, memberId, snapshotName) VALUES (?, ?, ?, ?)
     ON CONFLICT(projectId, memberId) DO NOTHING`, [teamId, projectId, memberId, memberName]);

  // إن كان اليوم أحد أيام المشروع نفتح يومه مباشرة
  const [today] = await query<{ id: number }>(
    `SELECT id FROM FieldProjectDay WHERE projectId = ? AND teamId = ? AND date = ?`, [projectId, teamId, todayInRiyadh()]);
  const next = today ? `/field/projects/${projectId}/days/${Number(today.id)}` : `/field/projects/${projectId}`;

  const res = NextResponse.json({ ok: true, next });
  setFieldCookie(res, await signFieldToken({ teamId, memberId, projectId, linkKey: linkKey(link.token) }));
  return res;
}
