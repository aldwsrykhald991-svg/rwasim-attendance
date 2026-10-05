import { NextRequest, NextResponse } from 'next/server';
import { isAttendanceStatus } from '@/lib/field/db';
import { bad, requireFieldMember } from '@/lib/field/auth';
import { applyChanges } from '@/lib/field/attendance';

/** تسجيل/تعديل حالة طالب واحد في يوم من أيام المشروع */
export async function POST(req: NextRequest) {
  const auth = await requireFieldMember();
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = Number(body.projectId);
  const dayId = Number(body.dayId);
  const studentId = Number(body.studentId);
  if (!isAttendanceStatus(body.status)) return bad('حالة غير صحيحة');

  // «أخرى» تتطلب سبباً مكتوباً — لا توجد قائمة أسباب جاهزة
  const otherReason = body.status === 'OTHER' ? String(body.otherReason ?? '').trim().slice(0, 300) : null;
  if (body.status === 'OTHER' && !otherReason) return bad('اكتب السبب لحفظ حالة «أخرى»');

  const r = await applyChanges(auth.ctx, projectId, dayId, [{ studentId, status: body.status, otherReason }]);
  if (!r.ok) return bad(r.error, r.status);
  return NextResponse.json({ ok: true, changed: r.changed });
}
