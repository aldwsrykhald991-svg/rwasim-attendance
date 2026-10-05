import { notFound } from 'next/navigation';
import { requireFieldPage } from '@/lib/field/auth';
import { getOtherCases, getProject, getProjectCounts, type Counts } from '@/lib/field/data';
import { dayLabel, formatDay, formatStamp, percent } from '@/lib/field/format';
import { Card, Empty, PageTitle, SectionTitle, Stat } from '@/components/field/ui';

function sum(list: Counts[]): Counts {
  const r: Counts = { total: 0, present: 0, absent: 0, other: 0, notMarked: 0, marked: 0 };
  for (const c of list) {
    r.total += c.total; r.present += c.present; r.absent += c.absent; r.other += c.other; r.marked += c.marked; r.notMarked += c.notMarked;
  }
  return r;
}

function Row({ label, sub, c }: { label: string; sub?: string; c: Counts }) {
  return (
    <tr className="border-t border-fd-line">
      <td className="min-w-[7.5rem] px-3 py-2.5">
        <div className="font-semibold text-fd-petrol">{label}</div>
        {sub && <div className="text-xs text-fd-muted">{sub}</div>}
      </td>
      <td className="px-1 py-2.5 text-center">{c.total}</td>
      <td className="px-1 py-2.5 text-center text-emerald-700">{c.present}</td>
      <td className="px-1 py-2.5 text-center text-red-700">{c.absent}</td>
      <td className="px-1 py-2.5 text-center text-amber-700">{c.other}</td>
      <td className="px-1 py-2.5 text-center text-slate-600">{c.notMarked}</td>
      <td className="px-1 py-2.5 text-center font-bold text-fd-petrol">{c.marked ? `${percent(c.present, c.total)}%` : '—'}</td>
    </tr>
  );
}

function Table({ children, first, totalLabel = 'المشاركون' }: { children: React.ReactNode; first: string; totalLabel?: string }) {
  return (
    <div className="gcard rw-fx-float overflow-x-auto rounded-2xl">
      <table className="w-full sm:min-w-[560px] text-sm">
        <thead className="bg-fd-bg text-xs text-fd-muted">
          <tr>
            <th className="min-w-[7.5rem] px-3 py-2 text-right font-semibold">{first}</th>
            <th className="px-1 py-2 font-semibold">{totalLabel}</th>
            <th className="px-1 py-2 font-semibold">حاضر</th>
            <th className="px-1 py-2 font-semibold">غائب</th>
            <th className="px-1 py-2 font-semibold">أخرى</th>
            <th className="px-1 py-2 font-semibold">لم يُحضَّر</th>
            <th className="px-1 py-2 font-semibold">نسبة الحضور</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const ctx = await requireFieldPage(Number((await params).projectId));
  const projectId = Number((await params).projectId);
  const data = await getProject(ctx.teamId, projectId);
  if (!data) notFound();
  const { project, days, groups, participants } = data;
  const [counts, others] = await Promise.all([
    getProjectCounts(ctx.teamId, projectId, days, groups),
    getOtherCases(ctx.teamId, projectId),
  ]);
  // الإجمالي ونسب المجموعات تُحسب على الأيام التي بدأ تحضيرها فقط
  const started = days.filter(d => counts.byDay(d.id).marked > 0);
  const overall = sum(started.map(d => counts.byDay(d.id)));
  const dayById = new Map(days.map(d => [d.id, d]));

  return (
    <div>
      <PageTitle back={{ href: `/field/projects/${projectId}`, label: project.name }} title="ملخص الحضور"
        sub={`${project.name} • ${days.length} ${days.length === 1 ? 'يوم' : 'أيام'}`}
        actions={
          <a href={`/api/field/projects/${projectId}/export`} download
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-fd-line bg-white px-4 py-2.5 font-medium text-fd-petrol hover:bg-slate-50">
            <i className="fa-solid fa-file-arrow-down" /> تنزيل Excel (CSV)
          </a>
        } />

      <SectionTitle>الإجمالي للمشروع</SectionTitle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="عدد المشاركين" value={participants.length} />
        <Stat label="الحاضرون" value={overall.present} tone="text-emerald-700" />
        <Stat label="الغائبون" value={overall.absent} tone="text-red-700" />
        <Stat label="حالات «أخرى»" value={overall.other} tone="text-amber-700" />
        <Stat label="لم يتم تحضيرهم" value={overall.notMarked} tone="text-slate-600" />
        <Stat label="نسبة الحضور" value={overall.marked ? `${percent(overall.present, overall.total)}%` : '—'} tone="text-fd-orange-dark" />
      </div>
      <p className="mt-2 text-xs text-fd-muted">
        الإجمالي محسوب على {started.length} من {days.length} {days.length === 1 ? 'يوم' : 'أيام'} بدأ تحضيرها. نسبة الحضور = الحاضرون ÷ المشاركين في تلك الأيام.
      </p>

      <SectionTitle>حسب اليوم</SectionTitle>
      <Table first="اليوم">
        {days.map(d => <Row key={d.id} label={dayLabel(d.index, d.name)} sub={formatDay(d.date)} c={counts.byDay(d.id)} />)}
      </Table>

      <SectionTitle>حسب المجموعة</SectionTitle>
      {groups.length ? (
        <Table first="المجموعة" totalLabel="سجلات متوقعة">
          {groups.map(g => <Row key={g.id} label={g.name} c={sum(started.map(d => counts.cell(d.id, g.id)))} />)}
        </Table>
      ) : <Empty icon="fa-layer-group">لا توجد مجموعات</Empty>}
      <p className="mt-2 text-xs text-fd-muted">سجلات متوقعة = عدد طلاب المجموعة × الأيام التي بدأ تحضيرها.</p>

      <SectionTitle>تفصيل كل يوم حسب المجموعات</SectionTitle>
      <div className="space-y-2">
        {days.map(d => (
          <details key={d.id} className="gcard rw-fx-float group rounded-2xl">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold text-fd-petrol">
              <span>{dayLabel(d.index, d.name)} <span className="text-xs font-normal text-fd-muted">• {formatDay(d.date)}</span></span>
              <i className="fa-solid fa-chevron-down text-xs text-fd-muted transition group-open:rotate-180" />
            </summary>
            <div className="px-2 pb-2">
              <Table first="المجموعة">
                {groups.map(g => <Row key={g.id} label={g.name} c={counts.cell(d.id, g.id)} />)}
              </Table>
            </div>
          </details>
        ))}
      </div>

      <SectionTitle>سجل حالات «أخرى» وملاحظاتها</SectionTitle>
      {others.length ? (
        <div className="space-y-2">
          {others.map((o, i) => {
            const d = dayById.get(Number(o.dayId));
            return (
              <Card key={i} className="!p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-fd-petrol">{o.studentName} <span className="text-xs font-normal text-fd-muted">• {o.groupName}</span></div>
                  <div className="text-xs text-fd-muted">{d ? dayLabel(d.index, d.name) : ''}</div>
                </div>
                <div className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{o.otherReason}</div>
                <div className="mt-1 text-[11px] text-fd-muted">{o.byName} • {formatStamp(o.at)}</div>
              </Card>
            );
          })}
        </div>
      ) : <Empty icon="fa-pen">لا توجد حالات «أخرى» في هذا المشروع.</Empty>}
    </div>
  );
}
