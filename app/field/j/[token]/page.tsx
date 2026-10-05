import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { ensureFieldTables } from '@/lib/field/db';
import { getFieldContext } from '@/lib/field/auth';
import JoinScreen from '@/components/field/JoinScreen';

// الرابط مفتاح دخول: لا يُسرَّب في ترويسة Referer
export const metadata: Metadata = { referrer: 'no-referrer' };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const token = decodeURIComponent((await params).token);
  await ensureFieldTables();
  const [link] = token.length >= 20 && token.length <= 80 ? await query<{ projectId: number; teamId: number; projectName: string; status: string; teamName: string }>(
    `SELECT l.projectId, l.teamId, p.name AS projectName, p.status, t.name AS teamName
     FROM FieldProjectLink l
     JOIN FieldProject p ON p.id = l.projectId AND p.teamId = l.teamId
     JOIN FieldTeam t ON t.id = l.teamId
     WHERE l.token = ?`, [token]) : [];

  if (!link) return <JoinScreen state="invalid" />;
  if (link.status === 'FINISHED') return <JoinScreen state="archived" projectName={link.projectName} teamName={link.teamName} />;

  // من له جلسة صالحة في الفريق نفسه يدخل مباشرة
  const ctx = await getFieldContext();
  if (ctx?.memberId && ctx.teamId === Number(link.teamId) && (!ctx.scopeProjectId || ctx.scopeProjectId === Number(link.projectId))) {
    redirect(`/field/projects/${Number(link.projectId)}`);
  }

  const names = await query<{ id: number; name: string }>(
    `SELECT m.id, m.name FROM FieldProjectSupervisor s
     JOIN FieldTeamMember m ON m.id = s.memberId AND m.teamId = s.teamId
     WHERE s.projectId = ? AND s.teamId = ? AND m.active = 1 ORDER BY m.name`, [Number(link.projectId), Number(link.teamId)]);

  return (
    <JoinScreen state="ok" token={token} projectName={link.projectName} teamName={link.teamName}
      names={names.map(n => ({ id: Number(n.id), name: n.name }))} />
  );
}
