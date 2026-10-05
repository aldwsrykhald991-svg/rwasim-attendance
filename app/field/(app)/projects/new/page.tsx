import { requireFieldPage } from '@/lib/field/auth';
import { listMembers, listStudents } from '@/lib/field/data';
import { todayInRiyadh } from '@/lib/field/db';
import NewProjectWizard from '@/components/field/NewProjectWizard';
import { PageTitle } from '@/components/field/ui';

export default async function NewProjectPage() {
  const ctx = await requireFieldPage();
  const [students, members] = await Promise.all([listStudents(ctx.teamId), listMembers(ctx.teamId)]);
  return (
    <div>
      <PageTitle back={{ href: '/field/home', label: 'المشاريع' }} title="إنشاء مشروع جديد" />
      <NewProjectWizard
        students={students.filter(s => Number(s.active)).map(s => ({ id: Number(s.id), name: s.name }))}
        members={members.filter(m => Number(m.active)).map(m => ({ id: Number(m.id), name: m.name }))}
        today={todayInRiyadh()}
        currentMemberId={ctx.memberId}
      />
    </div>
  );
}
