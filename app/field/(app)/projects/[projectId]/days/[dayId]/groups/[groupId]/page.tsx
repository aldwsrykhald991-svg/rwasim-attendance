import { notFound } from 'next/navigation';
import { requireFieldPage } from '@/lib/field/auth';
import { getGroupSheet, getProject } from '@/lib/field/data';
import { dayOrdinal, formatDay } from '@/lib/field/format';
import AttendanceSheet from '@/components/field/AttendanceSheet';

export default async function GroupAttendancePage({ params }: { params: Promise<{ projectId: string; dayId: string; groupId: string }> }) {
  const ctx = await requireFieldPage();
  const p = await params;
  const projectId = Number(p.projectId);
  const dayId = Number(p.dayId);
  const groupId = Number(p.groupId);
  const data = await getProject(ctx.teamId, projectId);
  const day = data?.days.find(d => d.id === dayId);
  const group = data?.groups.find(g => g.id === groupId);
  if (!data || !day || !group) notFound();

  const rows = await getGroupSheet(ctx.teamId, projectId, dayId, groupId);
  const archived = data.project.status === 'FINISHED';
  const authorized = data.supervisors.some(s => s.memberId === ctx.memberId);

  return (
    <AttendanceSheet
      key={`${dayId}-${groupId}`}
      projectId={projectId}
      dayId={dayId}
      groupId={groupId}
      projectName={data.project.name}
      dayText={`${dayOrdinal(day.index)}${day.name ? ` — ${day.name}` : ''} • ${formatDay(day.date)}`}
      groupName={group.name}
      rows={rows}
      readOnly={archived || !authorized}
      readOnlyReason={archived ? 'المشروع مؤرشف — العرض للقراءة فقط.' : !authorized ? 'لست ضمن المخولين بالتحضير في هذا المشروع — العرض للقراءة فقط.' : ''}
      memberName={ctx.memberName}
    />
  );
}
