// رابط التحضير السريع: مفتاح عشوائي لكل مشروع يُدخل حامله إلى تحضير هذا المشروع فقط.
import { createHash, randomBytes } from 'crypto';
import { query } from '@/lib/db';

export function makeLinkToken(): string {
  return randomBytes(24).toString('base64url'); // 192 بت: لا يمكن تخمينه
}

/** بصمة قصيرة للمفتاح تُحفظ في الجلسة؛ تغيير الرابط أو إيقافه يُبطل الجلسات القديمة */
export function linkKey(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

export async function getProjectLink(teamId: number, projectId: number): Promise<string | null> {
  const [row] = await query<{ token: string }>(
    `SELECT token FROM FieldProjectLink WHERE projectId = ? AND teamId = ?`, [projectId, teamId]);
  return row?.token ?? null;
}
