import { notFound } from 'next/navigation';
import { requireFieldPage } from '@/lib/field/auth';
import { getDayRoster, getProject, getProjectCounts } from '@/lib/field/data';
import { dayOrdinal, formatDayFull } from '@/lib/field/format';
import DayGroups from '@/components/field/DayGroups';
import { Empty, PageTitle, Stat } from '@/components/field/ui';

export default async function DayPage({ params }: { params: Promise<{ projectId: string; dayId: string }> }) {
  const ctx = await requireFieldPage(Number((await params).projectId));
  const p = await params;
  const projectId = Number(p.projectId);
  const dayId = Number(p.dayId);
  const data = await getProject(ctx.teamId, projectId);
  const day = data?.days.find(d => d.id === dayId);
  if (!data || !day) notFound();
  const [counts, roster] = await Promise.all([
    getProjectCounts(ctx.teamId, projectId, data.days, data.groups),
    getDayRoster(ctx.teamId, projectId, day.id),
  ]);
  const total = counts.byDay(day.id);

  return (
    <div>
      <PageTitle
        back={{ href: `/field/projects/${projectId}`, label: data.project.name }}
        title={day.name ? `${dayOrdinal(day.index)} — ${day.name}` : dayOrdinal(day.index)}
        sub={formatDayFull(day.date)}
      />
      <div className="mb-5 grid grid-cols-3 gap-2">
        <Stat label="الطلاب" value={total.total} />
        <Stat label="المجموعات" value={data.groups.length} />
        <Stat label="تم تحضيرهم" value={`${total.marked}/${total.total}`} tone={total.total && total.marked >= total.total ? 'text-emerald-700' : 'text-fd-orange-dark'} />
      </div>

      {data.groups.length === 0 ? <Empty icon="fa-layer-group">لا توجد مجموعات في هذا المشروع.</Empty> : (
        <DayGroups
          projectId={projectId}
          dayId={day.id}
          groups={data.groups.map(g => {
            const c = counts.cell(day.id, g.id);
            return { id: g.id, name: g.name, total: c.total, marked: c.marked, students: roster.filter(r => r.groupId === g.id) };
          })}
        />
      )}
    </div>
  );
}
