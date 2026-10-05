import { notFound } from 'next/navigation';
import { requireFieldPage } from '@/lib/field/auth';
import { getAuditLog, getProject } from '@/lib/field/data';
import { formatStamp } from '@/lib/field/format';
import { AttendanceBadge, Empty, PageTitle } from '@/components/field/ui';

export default async function AuditLogPage({ params }: { params: Promise<{ projectId: string }> }) {
  const ctx = await requireFieldPage();
  const projectId = Number((await params).projectId);
  const data = await getProject(ctx.teamId, projectId);
  if (!data) notFound();
  const log = await getAuditLog(ctx.teamId, projectId);

  return (
    <div>
      <PageTitle back={{ href: `/field/projects/${projectId}`, label: data.project.name }} title="سجل التعديلات"
        sub="كل تحضير أو تعديل على الحضور مع الحالة السابقة والجديدة ومن قام به ومتى." />
      {log.length === 0 ? (
        <Empty icon="fa-clock-rotate-left">لم يُسجَّل أي تحضير بعد.</Empty>
      ) : (
        <ol className="space-y-2">
          {log.map(e => (
            <li key={e.id} className="rounded-2xl border border-fd-line bg-white p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-fd-petrol">{e.studentName}</div>
                <div className="text-xs text-fd-muted">{formatStamp(e.changedAt)}</div>
              </div>
              <div className="mt-0.5 text-xs text-fd-muted">{e.dayLabel} • {e.groupName}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <AttendanceBadge status={e.oldStatus} />
                <i className="fa-solid fa-arrow-left text-xs text-fd-muted" />
                <AttendanceBadge status={e.newStatus} />
                <span className="mr-auto text-xs text-fd-muted"><i className="fa-solid fa-user ml-1" />{e.changedByName}</span>
              </div>
              {(e.oldReason || e.newReason) && (
                <div className="mt-2 space-y-1 text-xs">
                  {e.oldReason && <div className="text-slate-600 line-through">السبب السابق: {e.oldReason}</div>}
                  {e.newReason && <div className="rounded-lg bg-amber-50 px-2 py-1 text-amber-900">السبب: {e.newReason}</div>}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {log.length >= 500 && <p className="mt-3 text-center text-xs text-fd-muted">يُعرض آخر 500 تعديل.</p>}
    </div>
  );
}
