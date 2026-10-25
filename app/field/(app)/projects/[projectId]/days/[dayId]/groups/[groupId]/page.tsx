import { notFound } from 'next/navigation';
import { requireFieldPage } from '@/lib/field/auth';
import { getGroupSheet, getProject } from '@/lib/field/data';
import { getProjectCheckpoints, checkpointsForDay, selectCheckpoint } from '@/lib/field/checkpoints';
import { todayInRiyadh } from '@/lib/field/db';
import { dayOrdinal, formatDay } from '@/lib/field/format';
import AttendanceSheet from '@/components/field/AttendanceSheet';

export default async function GroupAttendancePage({ params, searchParams }: {
  params: Promise<{ projectId: string; dayId: string; groupId: string }>;
  searchParams: Promise<{ from?: string; checkpointId?: string }>;
}) {
  const ctx = await requireFieldPage(Number((await params).projectId));
  const p = await params;
  const projectId = Number(p.projectId);
  const dayId = Number(p.dayId);
  const groupId = Number(p.groupId);
  const data = await getProject(ctx.teamId, projectId);
  const day = data?.days.find(d => d.id === dayId);
  const group = data?.groups.find(g => g.id === groupId);
  if (!data || !day || !group) notFound();

  const q = await searchParams;
  const checkpoints = checkpointsForDay(await getProjectCheckpoints(ctx.teamId, projectId), dayId);
  const checkpoint = selectCheckpoint(checkpoints, q.checkpointId ?? '0');
  if (!checkpoint) notFound();
  const rows = await getGroupSheet(ctx.teamId, projectId, dayId, groupId, checkpoint.id);
  const archived = data.project.status === 'FINISHED';
  const authorized = data.supervisors.some(s => s.memberId === ctx.memberId);
  const fromGroups = q.from === 'groups';
  const sheetHref = `/field/projects/${projectId}/days/${dayId}/groups/${groupId}${fromGroups ? '?from=groups' : ''}`;

  const preserveDay = data.days.filter(d => d.date === todayInRiyadh()).length !== 1 || day.date !== todayInRiyadh();
  const groupsQuery = checkpoint.id || checkpoints.length > 1 || preserveDay ? `?dayId=${dayId}&checkpointId=${checkpoint.id}` : '';

  return (
    <AttendanceSheet
      key={`${projectId}-${dayId}-${groupId}-${checkpoint.id}`}
      checkpoint={{ projectId, dayId, checkpoints, selectedId: checkpoint.id, canCreate: !archived && authorized, href: sheetHref }}
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
      groupsHref={fromGroups ? `/field/projects/${projectId}/groups${groupsQuery}` : (checkpoints.length > 1 ? `/field/projects/${projectId}/days/${dayId}?checkpointId=${checkpoint.id}` : undefined)}
      changeDayHref={fromGroups ? `/field/projects/${projectId}/groups/${groupId}` : undefined}
    />
  );
}
