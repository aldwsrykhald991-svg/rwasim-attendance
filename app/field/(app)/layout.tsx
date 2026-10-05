import { requireFieldShell } from '@/lib/field/auth';
import Shell from '@/components/field/Shell';

export default async function FieldAppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireFieldShell();
  return <Shell teamName={ctx.teamName} memberName={ctx.memberName} scopeProjectId={ctx.scopeProjectId}>{children}</Shell>;
}
