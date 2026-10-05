import { requireFieldPage } from '@/lib/field/auth';
import { listStudents } from '@/lib/field/data';
import RosterManager from '@/components/field/RosterManager';
import { PageTitle } from '@/components/field/ui';

export default async function StudentsPage() {
  const ctx = await requireFieldPage();
  const students = await listStudents(ctx.teamId);
  const activeCount = students.filter(s => Number(s.active)).length;
  return (
    <div>
      <PageTitle title="طلاب الفريق" sub={`${activeCount} طالب نشط — يُختار منهم المشاركون عند إنشاء كل مشروع`} />
      <RosterManager
        kind="students"
        items={students.map(s => ({
          id: Number(s.id), name: s.name, active: Number(s.active),
          deletable: !Number(s.projects),
          note: Number(s.projects) ? `${s.projects} ${Number(s.projects) === 1 ? 'مشروع' : 'مشاريع'}` : undefined,
        }))}
      />
    </div>
  );
}
