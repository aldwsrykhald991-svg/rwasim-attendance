import { redirect } from 'next/navigation';
import { getFieldContext } from '@/lib/field/auth';
import { listMembers } from '@/lib/field/data';
import WhoAmI from '@/components/field/WhoAmI';

export default async function WhoPage() {
  const ctx = await getFieldContext();
  if (!ctx) redirect('/field');
  const members = (await listMembers(ctx.teamId)).filter(m => Number(m.active)).map(m => ({ id: Number(m.id), name: m.name }));
  return <WhoAmI teamName={ctx.teamName} members={members} currentId={ctx.memberId} />;
}
