// مساعد قاعدة البيانات (libSQL / SQLite / Turso) الذي تعتمد عليه منصة التحضير الميداني.
import { createClient, type InValue } from '@libsql/client';
import path from 'path';

const isLocal = !process.env.TURSO_DATABASE_URL;
export const db = createClient(
  isLocal
    ? { url: `file:${path.join(process.cwd(), 'prisma', 'dev.db')}` }
    : { url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN },
);

type QueryArg = InValue | null;

export async function query<T = Record<string, unknown>>(sql: string, args: QueryArg[] = []): Promise<T[]> {
  const result = await db.execute({ sql, args });
  return result.rows as unknown as T[];
}

export async function mutate(sql: string, args: QueryArg[] = []): Promise<{ id: number; changes: number }> {
  const result = await db.execute({ sql, args });
  return { id: Number(result.lastInsertRowid), changes: result.rowsAffected };
}

export async function batch(statements: { sql: string; args?: QueryArg[] }[]): Promise<void> {
  await db.batch(statements.map(s => ({ sql: s.sql, args: s.args ?? [] })), 'write');
}
