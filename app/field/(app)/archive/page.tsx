import { requireFieldPage } from '@/lib/field/auth';
import { listProjects } from '@/lib/field/data';
import ProjectCard from '@/components/field/ProjectCard';
import { Empty, PageTitle } from '@/components/field/ui';

export default async function FieldArchive() {
  const ctx = await requireFieldPage();
  const archived = (await listProjects(ctx.teamId))
    .filter(p => p.status === 'FINISHED')
    .sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? ''));

  return (
    <div>
      <PageTitle title="أرشيف المشاريع" sub="كل مشروع منتهٍ محفوظ بأيامه ومجموعاته وطلابه وحضوره كما كان وقت التنفيذ." />
      {archived.length ? (
        <div className="grid gap-3 sm:grid-cols-2">{archived.map(p => <ProjectCard key={p.id} p={p} />)}</div>
      ) : (
        <Empty icon="fa-box-archive">لا توجد مشاريع مؤرشفة بعد. عند تغيير حالة المشروع إلى «منتهٍ» ينتقل إلى هنا.</Empty>
      )}
    </div>
  );
}
