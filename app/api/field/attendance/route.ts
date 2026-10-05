import { NextRequest, NextResponse } from 'next/server';
import { isAttendanceStatus } from '@/lib/field/db';
import { bad, requireFieldMember } from '@/lib/field/auth';
import { applyChanges } from '@/lib/field/attendance';
import { getGroupSheet } from '@/lib/field/data';

/** قراءة حالة مجموعة في يوم — تُستعمل لمزامنة الشاشة بين أكثر من مشرف */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const projectId = Number(q.get('projectId'));
  const auth = await requireFieldMember(projectId);
  if (!auth.ok) return auth.res;
  const dayId = Number(q.get('dayId'));
  const groupId = Number(q.get('groupId'));
  if (![projectId, dayId, groupId].every(n => Number.isInteger(n) && n > 0)) return bad('طلب غير صحيح');
  const rows = await getGroupSheet(auth.ctx.teamId, projectId, dayId, groupId);
  return NextResponse.json({ ok: true, rows }, { headers: { 'Cache-Control': 'no-store' } });
}

/** تسجيل/تعديل حالة طالب واحد في يوم من أيام المشروع */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = Number(body.projectId);
  const auth = await requireFieldMember(projectId);
  if (!auth.ok) return auth.res;
  const dayId = Number(body.dayId);
  const studentId = Number(body.studentId);
  if (![projectId, dayId, studentId].every(n => Number.isInteger(n) && n > 0)) return bad('طلب غير صحيح');
  if (!isAttendanceStatus(body.status)) return bad('حالة غير صحيحة');

  // «أخرى» تتطلب سبباً مكتوباً — لا توجد قائمة أسباب جاهزة
  const otherReason = body.status === 'OTHER' ? String(body.otherReason ?? '').trim().slice(0, 300) : null;
  if (body.status === 'OTHER' && !otherReason) return bad('اكتب السبب لحفظ حالة «أخرى»');

  const r = await applyChanges(auth.ctx, projectId, dayId, [{ studentId, status: body.status, otherReason }]);
  if (!r.ok) return bad(r.error, r.status);
  return NextResponse.json({ ok: true, changed: r.changed });
}
