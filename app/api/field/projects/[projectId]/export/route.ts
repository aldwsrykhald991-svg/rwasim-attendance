// تصدير حضور المشروع كملف CSV (طالب × يوم) يفتح مباشرة في Excel.
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { bad, requireFieldMember } from '@/lib/field/auth';
import { getProject } from '@/lib/field/data';
import { dayLabel, formatDay, STATUS_LABEL } from '@/lib/field/format';

/** يمنع تنفيذ الخلية كمعادلة في Excel، ويهرّب الفواصل وعلامات الاقتباس */
function cell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const projectId = Number((await params).projectId);
  const auth = await requireFieldMember(projectId);
  if (!auth.ok) return auth.res;
  const { teamId } = auth.ctx;
  const data = await getProject(teamId, projectId);
  if (!data) return bad('المشروع غير موجود', 404);

  const marks = await query<{ studentId: number; dayId: number; status: string; otherReason: string | null }>(
    `SELECT studentId, projectDayId AS dayId, status, otherReason FROM FieldAttendance WHERE projectId = ? AND teamId = ?`,
    [projectId, teamId]);
  const by = new Map(marks.map(m => [`${Number(m.studentId)}:${Number(m.dayId)}`, m]));

  const header = ['الاسم', 'المجموعة', ...data.days.map(d => `${dayLabel(d.index, d.name)} (${formatDay(d.date)})`), 'حاضر', 'غائب', 'أخرى', 'لم يتم التحضير'];
  const lines = [header.map(cell).join(',')];
  const people = [...data.participants].sort((a, b) =>
    a.snapshotGroupName.localeCompare(b.snapshotGroupName, 'ar') || a.snapshotName.localeCompare(b.snapshotName, 'ar'));
  for (const p of people) {
    const count = { PRESENT: 0, ABSENT: 0, OTHER: 0, NOT_MARKED: 0 } as Record<string, number>;
    const cols = data.days.map(d => {
      const m = by.get(`${p.studentId}:${d.id}`);
      const status = m?.status ?? 'NOT_MARKED';
      count[status] = (count[status] ?? 0) + 1;
      return status === 'OTHER' && m?.otherReason ? `${STATUS_LABEL.OTHER}: ${m.otherReason}` : STATUS_LABEL[status] ?? status;
    });
    lines.push([p.snapshotName, p.snapshotGroupName, ...cols, count.PRESENT, count.ABSENT, count.OTHER, count.NOT_MARKED].map(cell).join(','));
  }

  const name = encodeURIComponent(`حضور-${data.project.name}.csv`);
  // BOM حتى يقرأ Excel العربية بترميز UTF-8
  return new Response(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance-${projectId}.csv"; filename*=UTF-8''${name}`,
      'Cache-Control': 'no-store',
    },
  });
}
