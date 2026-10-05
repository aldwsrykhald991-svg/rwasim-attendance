// حدّ المحاولات محفوظ في قاعدة البيانات: يعمل عبر كل نسخ الخادم (serverless).
import type { NextRequest } from 'next/server';
import { query, mutate } from '@/lib/db';

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return (fwd.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim().slice(0, 64);
}

/** هل تجاوز المفتاح الحد داخل النافذة الحالية؟ */
export async function isLimited(key: string, max: number): Promise<boolean> {
  const [row] = await query<{ n: number; until: number }>(`SELECT n, until FROM FieldRateLimit WHERE key = ?`, [key]);
  return !!row && Number(row.until) > Date.now() && Number(row.n) >= max;
}

/** يسجّل محاولة: يبدأ نافذة جديدة إن انتهت السابقة */
export async function recordHit(key: string, windowMs: number): Promise<void> {
  const now = Date.now();
  await mutate(
    `INSERT INTO FieldRateLimit (key, n, until) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       n = CASE WHEN FieldRateLimit.until > ? THEN FieldRateLimit.n + 1 ELSE 1 END,
       until = CASE WHEN FieldRateLimit.until > ? THEN FieldRateLimit.until ELSE excluded.until END`,
    [key, now + windowMs, now, now]);
}

export async function clearHits(key: string): Promise<void> {
  await mutate(`DELETE FROM FieldRateLimit WHERE key = ?`, [key]);
}
