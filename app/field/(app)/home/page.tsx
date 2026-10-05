import Link from 'next/link';
import { requireFieldPage } from '@/lib/field/auth';
import { listProjects } from '@/lib/field/data';
import { dayOrdinal, formatDay } from '@/lib/field/format';
import ProjectCard from '@/components/field/ProjectCard';
import { btn, Empty, SectionTitle } from '@/components/field/ui';

export default async function FieldHome() {
  const ctx = await requireFieldPage();
  const projects = await listProjects(ctx.teamId);
  const active = projects.filter(p => p.status === 'ACTIVE');
  const upcoming = projects.filter(p => p.status === 'UPCOMING')
    .sort((a, b) => (a.firstDate ?? '9999').localeCompare(b.firstDate ?? '9999'));
  const archived = projects.filter(p => p.status === 'FINISHED');
  const today = active.find(p => p.todayDay);
  const featured = today ?? active[0];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-fd-muted">أهلاً {ctx.memberName}</div>
          <h1 className="text-2xl font-bold text-fd-petrol">مشاريع الفريق</h1>
        </div>
        <Link href="/field/projects/new" className={btn.primary}>
          <i className="fa-solid fa-plus" /> إنشاء مشروع جديد
        </Link>
      </div>

      {featured && (
        <div className="gcard-dark rw-fx-tilt rw-fx-float rw-fx-glow rw-fx-glow--gold relative rounded-3xl p-5 text-white sm:p-6">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <span className="gsheen" />
          <div aria-hidden className="gring-a pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full border-[14px] border-fd-orange/40" />
          <div aria-hidden className="gring-b pointer-events-none absolute -bottom-14 left-16 h-32 w-32 rounded-full border-[10px] border-white/15" />
          </div>
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-fd-orange-solid px-3 py-1 text-xs font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              {featured.todayDay ? 'اليوم لديك مشروع' : 'مشروع جارٍ الآن'}
            </span>
            <h2 className="mt-3 text-2xl font-bold">{featured.name}</h2>
            {featured.todayDay && (
              <div className="mt-1 text-white/80">
                {dayOrdinal(featured.todayDay.index)}
                {featured.todayDay.name && <> — <span className="font-semibold text-white">{featured.todayDay.name}</span></>}
                <span className="mx-2 text-white/70">•</span>{formatDay(featured.todayDay.date)}
              </div>
            )}
            <Link
              href={featured.todayDay ? `/field/projects/${featured.id}/days/${featured.todayDay.id}` : `/field/projects/${featured.id}`}
              className={`${btn.primary} gpulse mt-5 w-full sm:w-auto`}
            >
              <i className="fa-solid fa-clipboard-check" /> {featured.todayDay ? 'بدء التحضير' : 'دخول للتحضير'}
            </Link>
          </div>
        </div>
      )}

      <SectionTitle>المشاريع الحالية</SectionTitle>
      {active.length ? (
        <div className="grid gap-3 sm:grid-cols-2">{active.map(p => <ProjectCard key={p.id} p={p} />)}</div>
      ) : (
        <Empty icon="fa-person-running">لا توجد مشاريع جارية الآن.</Empty>
      )}

      <SectionTitle>المشاريع القادمة</SectionTitle>
      {upcoming.length ? (
        <div className="grid gap-3 sm:grid-cols-2">{upcoming.map(p => <ProjectCard key={p.id} p={p} />)}</div>
      ) : (
        <Empty icon="fa-calendar-plus">لا توجد مشاريع قادمة. <Link href="/field/projects/new" className="font-semibold text-fd-orange-solid">أنشئ مشروعاً</Link></Empty>
      )}

      <SectionTitle>أرشيف المشاريع</SectionTitle>
      <Link href="/field/archive" className="gcard rw-fx-float rw-fx-glow flex items-center gap-3 rounded-2xl p-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-fd-teal/15 text-fd-petrol"><i className="fa-solid fa-box-archive" /></span>
        <div className="flex-1">
          <div className="font-bold text-fd-petrol">{archived.length} مشروع مؤرشف</div>
          <div className="text-xs text-fd-muted">
            {archived.length ? archived.slice(0, 3).map(p => p.name).join('، ') : 'المشاريع المنتهية تنتقل هنا كاملة'}
          </div>
        </div>
        <i className="fa-solid fa-chevron-left text-xs text-fd-muted" />
      </Link>
    </div>
  );
}
