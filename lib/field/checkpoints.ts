import { query } from '@/lib/db';

export interface CheckpointRow {
  id: number;
  dayId: number;
  name: string;
  createdByName: string | null;
  createdAt: string | null;
}

export function firstCheckpoint(dayId: number): CheckpointRow {
  return { id: 0, dayId, name: 'التحضير الأول', createdByName: null, createdAt: null };
}

export async function getProjectCheckpoints(teamId: number, projectId: number): Promise<CheckpointRow[]> {
  const rows = await query<CheckpointRow>(
    `SELECT id, projectDayId AS dayId, name, createdByName, createdAt
     FROM FieldCheckpoint WHERE teamId = ? AND projectId = ? ORDER BY id`, [teamId, projectId]);
  return rows.map(c => ({ ...c, id: Number(c.id), dayId: Number(c.dayId) }));
}

export function checkpointsForDay(rows: CheckpointRow[], dayId: number): CheckpointRow[] {
  return [firstCheckpoint(dayId), ...rows.filter(c => c.dayId === dayId)];
}

export function selectCheckpoint(rows: CheckpointRow[], requested?: string): CheckpointRow | undefined {
  if (requested === undefined) return rows.at(-1);
  if (!/^\d+$/.test(requested)) return undefined;
  return rows.find(c => c.id === Number(requested));
}

/** غياب القيمة في API قديم يعني التحضير الأول، ولا يحوّل كتابة قديمة لمحطة جديدة. */
export function checkpointId(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'string' && typeof value !== 'number') return NaN;
  if (!/^\d+$/.test(String(value))) return NaN;
  const id = Number(value);
  return Number.isSafeInteger(id) && id >= 0 ? id : NaN;
}

export async function hasAttendanceTarget(teamId: number, projectId: number, dayId: number, groupId: number, id: number) {
  const [row] = await query(
    `SELECT d.id FROM FieldProjectDay d
     JOIN FieldGroup g ON g.projectId = d.projectId AND g.teamId = d.teamId
     WHERE d.id = ? AND d.projectId = ? AND d.teamId = ? AND g.id = ?
       AND (? = 0 OR EXISTS (SELECT 1 FROM FieldCheckpoint c
         WHERE c.id = ? AND c.teamId = d.teamId AND c.projectId = d.projectId AND c.projectDayId = d.id))`,
    [dayId, projectId, teamId, groupId, id, id]);
  return !!row;
}
