import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireFieldPage } from '@/lib/field/auth';
import { getMarkers, getProject, getProjectCounts } from '@/lib/field/data';
import { dayOrdinal, formatDay, formatStamp, percent, progressOf } from '@/lib/field/format';
import { dateRange } from '@/components/field/ProjectCard';
import ProjectStatusControl from '@/components/field/ProjectStatusControl';
import ShareLinkCard from '@/components/field/ShareLinkCard';
import { getProjectLink } from '@/lib/field/link';
import { btn, Card, Empty, PageTitle, ProgressBadge, ProjectStatusBadge, SectionTitle, Stat } from '@/components/field/ui';

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const ctx = await requireFieldPage(Number((await params).projectId));
  const projectId = Number((await params).projectId);
  const data = await getProject(ctx.teamId, projectId);
  if (!data) notFound();
  const { project, days, groups, participants, supervisors } = data;
  const counts = await getProjectCounts(ctx.teamId, projectId, days, groups);
  const markers = await getMarkers(ctx.teamId, projectId);
  const archived = project.status === 'FINISHED';
  // من دخل برابط التحضير السريع: تحضير واطلاع فقط، بلا إدارة ولا مشاركة للرابط
  const scoped = !!ctx.scopeProjectId;
  const linkToken = scoped || archived ? null : await getProjectLink(ctx.teamId, projectId);

  // نسبة الحضور العامة: على الأيام التي بدأ تحضيرها فقط
  const started = days.map(d => counts.byDay(d.id)).filter(c => c.marked > 0);
  const presentSum = started.reduce((s, c) => s + c.present, 0);
  const expected = started.reduce((s, c) => s + c.total, 0);

  return (
    <div>
      <PageTitle
        back={scoped ? undefined : archived ? { href: '/field/archive', label: 'أرشيف المشاريع' } : { href: '/field/home', label: 'المشاريع' }}
        title={project.name}
        sub={<span className="flex flex-wrap items-center gap-2"><ProjectStatusBadge status={project.status} />
          <span><i className="fa-regular fa-calendar ml-1 text-xs text-fd-teal" />{dateRange(days[0]?.date ?? null, days[days.length - 1]?.date ?? null)}</span></span>}
        actions={scoped ? undefined : <ProjectStatusControl projectId={project.id} status={project.status} />}
      />

      {archived && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <i className="fa-solid fa-lock mt-0.5" />
          <div>مشروع مؤرشف{project.archivedAt && <> منذ {formatStamp(project.archivedAt)}</>} — البيانات محفوظة كما كانت وقت المشروع، وللقراءة فقط.</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="عدد الأيام" value={days.length} />
        <Stat label="عدد الطلاب" value={participants.length} />
        <Stat label="عدد المجموعات" value={groups.length} />
        <Stat label="نسبة الحضور العامة" value={expected ? `${percent(presentSum, expected)}%` : '—'} tone="text-fd-orange-dark" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/field/projects/${project.id}/report`} className={btn.ghost}><i className="fa-solid fa-chart-simple" /> ملخص الحضور</Link>
        <Link href={`/field/projects/${project.id}/log`} className={btn.ghost}><i className="fa-solid fa-clock-rotate-left" /> سجل التعديلات</Link>
        {!archived && !scoped && <Link href={`/field/projects/${project.id}/manage`} className={btn.ghost}><i className="fa-solid fa-sliders" /> إدارة المشروع</Link>}
      </div>

      {!scoped && !archived && <ShareLinkCard projectId={project.id} projectName={project.name} token={linkToken} />}

      <SectionTitle>أيام المشروع</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {days.map(d => {
          const c = counts.byDay(d.id);
          return (
            <Link key={d.id} href={`/field/projects/${project.id}/days/${d.id}`}
              className="gcard rw-fx-float rw-fx-glow group rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-fd-teal">{dayOrdinal(d.index)}</div>
                  <div className="mt-0.5 text-lg font-bold text-fd-petrol">{d.name || formatDay(d.date)}</div>
                  {d.name && <div className="text-sm text-fd-muted">{formatDay(d.date)}</div>}
                </div>
                <i className="fa-solid fa-chevron-left mt-1 text-xs text-fd-muted group-hover:text-fd-petrol" />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <ProgressBadge progress={progressOf(c.marked, c.total)} />
                <span className="text-xs text-fd-muted">{c.marked} / {c.total}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <SectionTitle>معلومات المشروع</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="mb-2 text-sm font-bold text-fd-petrol">المجموعات</div>
          {groups.length ? (
            <div className="space-y-2">
              {groups.map(g => {
                const members = participants.filter(p => p.groupId === g.id);
                return (
                  <details key={g.id} className="group rounded-xl bg-fd-bg">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm">
                      <span className="font-semibold text-fd-petrol">{g.name} <span className="text-xs font-normal text-fd-muted">({members.length} طالب)</span></span>
                      <i className="fa-solid fa-chevron-down text-xs text-fd-muted transition group-open:rotate-180" />
                    </summary>
                    <ol className="space-y-1 px-3 pb-3 text-sm text-slate-700">
                      {members.length ? members.map((m, i) => (
                        <li key={m.studentId}><span className="ml-2 inline-block w-5 text-xs text-fd-muted">{i + 1}</span>{m.snapshotName}</li>
                      )) : <li className="text-fd-muted">لا يوجد طلاب</li>}
                    </ol>
                  </details>
                );
              })}
            </div>
          ) : <Empty icon="fa-layer-group">لا توجد مجموعات</Empty>}
        </Card>
        <Card>
          <div className="mb-2 text-sm font-bold text-fd-petrol">المشرفون المخولون بالتحضير</div>
          <div className="flex flex-wrap gap-2">
            {supervisors.map(s => (
              <span key={s.memberId} className="rounded-full bg-fd-teal/10 px-3 py-1 text-sm text-fd-petrol">
                <i className="fa-solid fa-user-check ml-1 text-xs text-fd-teal" />{s.snapshotName}
              </span>
            ))}
          </div>
          {!supervisors.some(s => s.memberId === ctx.memberId) && !archived && (
            <p className="mt-2 text-xs text-amber-700">أنت لست ضمن المخولين بالتحضير في هذا المشروع — يمكنك الاطلاع فقط.</p>
          )}
        </Card>
        {markers.length > 0 && (
          <Card>
            <div className="mb-2 text-sm font-bold text-fd-petrol">من قام بالتحضير</div>
            <div className="flex flex-wrap gap-2 text-sm">
              {markers.map(m => (
                <span key={m.name} className="rounded-full bg-fd-bg px-3 py-1 text-fd-petrol">{m.name} <span className="text-xs text-fd-muted">({m.n} عملية)</span></span>
              ))}
            </div>
          </Card>
        )}
        <Card>
          <div className="text-sm text-fd-muted">
            أُنشئ {formatStamp(project.createdAt)}{project.createdByName && <> بواسطة <b className="text-fd-petrol">{project.createdByName}</b></>}
          </div>
        </Card>
      </div>
    </div>
  );
}
