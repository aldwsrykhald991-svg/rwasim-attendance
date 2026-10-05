import { notFound, redirect } from 'next/navigation';
import { requireFieldPage } from '@/lib/field/auth';
import { getProject, listMembers, listStudents } from '@/lib/field/data';
import ProjectManager from '@/components/field/ProjectManager';
import { PageTitle } from '@/components/field/ui';

export default async function ManageProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const ctx = await requireFieldPage();
  const projectId = Number((await params).projectId);
  const data = await getProject(ctx.teamId, projectId);
  if (!data) notFound();
  // المشروع المؤرشف لا يُدار — يُعاد فتحه أولاً من صفحة المشروع
  if (data.project.status === 'FINISHED') redirect(`/field/projects/${projectId}`);
  const [students, members] = await Promise.all([listStudents(ctx.teamId), listMembers(ctx.teamId)]);

  return (
    <div>
      <PageTitle back={{ href: `/field/projects/${projectId}`, label: data.project.name }} title="إدارة المشروع"
        sub="الأيام والمجموعات والطلاب والمخولون بالتحضير" />
      <ProjectManager
        projectId={projectId}
        name={data.project.name}
        days={data.days}
        groups={data.groups}
        participants={data.participants}
        supervisorIds={data.supervisors.map(s => s.memberId)}
        students={students.filter(s => Number(s.active)).map(s => ({ id: Number(s.id), name: s.name }))}
        members={members.filter(m => Number(m.active)).map(m => ({ id: Number(m.id), name: m.name }))}
      />
    </div>
  );
}
