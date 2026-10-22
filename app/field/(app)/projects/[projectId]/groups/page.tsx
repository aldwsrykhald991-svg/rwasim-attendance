import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireFieldPage } from '@/lib/field/auth';
import { getProject, getProjectCounts } from '@/lib/field/data';
import { todayInRiyadh } from '@/lib/field/db';
import { dayLabel, formatDayFull, progressOf } from '@/lib/field/format';
import { Bar, Empty, PageTitle, ProgressBadge } from '@/components/field/ui';

export default async function ProjectGroupsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const projectId = Number((await params).projectId);
  const ctx = await requireFieldPage(projectId);
  const data = await getProject(ctx.teamId, projectId);
  if (!data) notFound();

  // لا نختار يوماً سابقاً أو قادماً تلقائياً، ولا نخمن عند تكرار تاريخ اليوم.
  const todayDate = todayInRiyadh();
  const todayDays = data.days.filter(d => d.date === todayDate);
  const today = todayDays.length === 1 ? todayDays[0] : null;
  const counts = today ? await getProjectCounts(ctx.teamId, projectId, [today], data.groups) : null;
  const archived = data.project.status === 'FINISHED';
  const authorized = data.supervisors.some(s => s.memberId === ctx.memberId);

  return (
    <div>
      <PageTitle
        title="مجموعات المشروع"
        sub={data.project.name}
      />

      {archived || !authorized ? (
        <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <i className="fa-solid fa-lock ml-1" />
          {archived ? 'المشروع مؤرشف — العرض للقراءة فقط.' : 'لست ضمن المخولين بالتحضير في هذا المشروع — العرض للقراءة فقط.'}
        </p>
      ) : null}

      {today ? (
        <div className="gcard-soft mb-5 rounded-2xl p-4">
          <p className="font-bold text-fd-petrol"><i className="fa-regular fa-calendar-check ml-2 text-fd-teal" />{dayLabel(today.index, today.name)}</p>
          <p className="mt-1 text-sm text-fd-muted">{formatDayFull(today.date)} — تم اختيار يوم التحضير تلقائياً.</p>
          <p className="mt-2 text-sm text-fd-petrol">اختر مجموعتك لفتح كشف الطلاب مباشرة.</p>
        </div>
      ) : data.days.length > 0 ? (
        <p className="mb-5 rounded-2xl border border-fd-line bg-white p-4 text-sm text-fd-petrol">
          {todayDays.length > 1 ? 'يوجد أكثر من يوم بتاريخ اليوم.' : 'لا يوجد يوم في المشروع يطابق تاريخ اليوم.'}
          {' '}اختر مجموعتك ثم حدّد يوم التحضير.
        </p>
      ) : (
        <Empty icon="fa-calendar">لم تُضف أيام لهذا المشروع بعد. اطلب من مسؤول المشروع إضافة يوم للتحضير.</Empty>
      )}

      {data.groups.length === 0 ? <Empty icon="fa-layer-group">لا توجد مجموعات في هذا المشروع.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.groups.map(g => {
            const c = today && counts ? counts.cell(today.id, g.id) : null;
            const total = c?.total ?? data.participants.filter(p => p.groupId === g.id).length;
            const content = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-fd-petrol">{g.name}</h2>
                  <span className="shrink-0 text-sm text-fd-muted">{total} {total === 1 ? 'طالب' : 'طلاب'}</span>
                </div>
                {c && (
                  <>
                    <div className="my-3"><Bar value={c.marked} total={c.total} tone={c.total > 0 && c.marked >= c.total ? 'green' : 'orange'} /></div>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <ProgressBadge progress={progressOf(c.marked, c.total)} />
                      <span dir="ltr" className="text-fd-muted">{c.marked} / {c.total}</span>
                    </div>
                  </>
                )}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-fd-line pt-3 font-semibold text-fd-orange-dark">
                  <span>{archived || !authorized ? 'فتح المجموعة' : today ? 'تحضير المجموعة' : 'اختيار يوم التحضير'}</span>
                  <i className="fa-solid fa-arrow-left text-sm" />
                </div>
              </>
            );
            return data.days.length ? (
              <Link key={g.id}
                href={today ? `/field/projects/${projectId}/days/${today.id}/groups/${g.id}?from=groups` : `/field/projects/${projectId}/groups/${g.id}`}
                className="gcard block rounded-2xl p-4 transition hover:ring-2 hover:ring-fd-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-teal">
                {content}
              </Link>
            ) : (
              <div key={g.id} className="gcard rounded-2xl p-4 opacity-60">
                <h2 className="text-lg font-bold text-fd-petrol">{g.name}</h2>
                <p className="mt-1 text-sm text-fd-muted">{total} طالب — لا يوجد يوم للتحضير.</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
