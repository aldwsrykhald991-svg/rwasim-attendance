import { requireFieldPage } from '@/lib/field/auth';
import { listMembers } from '@/lib/field/data';
import RosterManager from '@/components/field/RosterManager';
import { Card, PageTitle } from '@/components/field/ui';

export default async function TeamPage() {
  const ctx = await requireFieldPage();
  const members = await listMembers(ctx.teamId);
  return (
    <div>
      <PageTitle title="الفريق" sub="أعضاء الفريق الذين يستخدمون الحساب ويقومون بالتحضير" />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-fd-muted">اسم الفريق</div>
            <div className="text-lg font-bold text-fd-petrol">{ctx.teamName}</div>
          </div>
          <div className="text-left">
            <div className="text-xs text-fd-muted">رمز الفريق (للدخول)</div>
            <div className="font-mono text-lg font-bold tracking-[0.25em] text-fd-petrol" dir="ltr">{ctx.teamCode}</div>
          </div>
        </div>
      </Card>
      <RosterManager
        kind="members"
        currentId={ctx.memberId}
        items={members.map(m => ({ id: Number(m.id), name: m.name, active: Number(m.active) }))}
      />
    </div>
  );
}
