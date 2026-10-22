import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireFieldPage } from '@/lib/field/auth';
import { getProject } from '@/lib/field/data';
import { dayLabel, formatDayFull } from '@/lib/field/format';
import { Empty, PageTitle } from '@/components/field/ui';

export default async function GroupDayPickerPage({ params }: { params: Promise<{ projectId: string; groupId: string }> }) {
  const { projectId: pid, groupId: gid } = await params;
  const projectId = Number(pid);
  const groupId = Number(gid);
  const ctx = await requireFieldPage(projectId);
  const data = await getProject(ctx.teamId, projectId);
  const group = data?.groups.find(g => g.id === groupId);
  if (!data || !group) notFound();

  return (
    <div>
      <PageTitle
        back={{ href: `/field/projects/${projectId}/groups`, label: 'المجموعات' }}
        title="اختر يوم التحضير"
        sub={`${data.project.name} • ${group.name}`}
      />
      {data.days.length === 0 ? <Empty icon="fa-calendar">لا توجد أيام في هذا المشروع.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.days.map(d => (
            <Link key={d.id} href={`/field/projects/${projectId}/days/${d.id}/groups/${groupId}?from=groups`}
              className="gcard block rounded-2xl p-4 transition hover:ring-2 hover:ring-fd-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-teal">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-fd-petrol">{dayLabel(d.index, d.name)}</h2>
                <i className="fa-solid fa-chevron-left text-sm text-fd-teal" />
              </div>
              <p className="mt-1 text-sm text-fd-muted">{formatDayFull(d.date)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
