import { redirect } from 'next/navigation';
import { getFieldContext } from '@/lib/field/auth';
import AuthScreen from '@/components/field/AuthScreen';

export default async function FieldEntry() {
  const ctx = await getFieldContext();
  if (ctx?.scopeProjectId) redirect(`/field/projects/${ctx.scopeProjectId}`);
  if (ctx) redirect(ctx.memberId ? '/field/home' : '/field/who');
  return <AuthScreen />;
}
