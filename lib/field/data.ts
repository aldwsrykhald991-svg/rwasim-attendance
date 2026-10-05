// قراءات منصة التحضير الميداني — كل دالة تستقبل teamId من الجلسة (الخادم)
// وكل استعلام مقيد به، فلا يمكن لفريق قراءة بيانات فريق آخر حتى بمعرفة الرابط.
import { query } from '@/lib/db';
import { ensureFieldTables, todayInRiyadh, type AttendanceStatus, type ProjectStatus } from './db';

export interface ProjectRow {
  id: number;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  archivedAt: string | null;
}

export interface DayRow { id: number; date: string; name: string | null; sortOrder: number; index: number }
export interface GroupRow { id: number; name: string; sortOrder: number }

export interface Counts { total: number; present: number; absent: number; other: number; notMarked: number; marked: number }

function emptyCounts(total = 0): Counts {
  return { total, present: 0, absent: 0, other: 0, notMarked: total, marked: 0 };
}

function addStatus(c: Counts, status: string, n: number) {
  if (status === 'PRESENT') c.present += n;
  else if (status === 'ABSENT') c.absent += n;
  else if (status === 'OTHER') c.other += n;
  else return;
  c.marked += n;
  c.notMarked = Math.max(0, c.total - c.marked);
}

function sumCounts(list: Counts[]): Counts {
  const r = emptyCounts(0);
  for (const c of list) {
    r.total += c.total; r.present += c.present; r.absent += c.absent; r.other += c.other; r.marked += c.marked;
  }
  r.notMarked = Math.max(0, r.total - r.marked);
  return r;
}

export async function listMembers(teamId: number) {
  await ensureFieldTables();
  return query<{ id: number; name: string; active: number }>(
    `SELECT id, name, active FROM FieldTeamMember WHERE teamId = ? ORDER BY active DESC, name`, [teamId]);
}

export async function listStudents(teamId: number) {
  await ensureFieldTables();
  return query<{ id: number; name: string; active: number; projects: number }>(
    `SELECT s.id, s.name, s.active,
       (SELECT COUNT(*) FROM FieldProjectParticipant p WHERE p.studentId = s.id AND p.teamId = s.teamId) AS projects
     FROM FieldStudent s WHERE s.teamId = ? ORDER BY s.active DESC, s.name`, [teamId]);
}

export interface ProjectSummary extends ProjectRow {
  dayCount: number;
  groupCount: number;
  participantCount: number;
  firstDate: string | null;
  lastDate: string | null;
  todayDay: { id: number; index: number; name: string | null; date: string } | null;
}

export async function listProjects(teamId: number): Promise<ProjectSummary[]> {
  await ensureFieldTables();
  const today = todayInRiyadh();
  const [projects, days] = await Promise.all([
    query<ProjectRow & { groupCount: number; participantCount: number }>(
      `SELECT p.id, p.name, p.status, p.createdAt, p.archivedAt,
         (SELECT COUNT(*) FROM FieldGroup g WHERE g.projectId = p.id AND g.teamId = p.teamId) AS groupCount,
         (SELECT COUNT(*) FROM FieldProjectParticipant pp WHERE pp.projectId = p.id AND pp.teamId = p.teamId) AS participantCount
       FROM FieldProject p WHERE p.teamId = ? ORDER BY p.createdAt DESC`, [teamId]),
    query<{ id: number; projectId: number; date: string; name: string | null }>(
      `SELECT id, projectId, date, name FROM FieldProjectDay WHERE teamId = ? ORDER BY projectId, sortOrder, date, id`, [teamId]),
  ]);
  const byProject = new Map<number, typeof days>();
  for (const d of days) {
    const list = byProject.get(Number(d.projectId)) ?? [];
    list.push(d);
    byProject.set(Number(d.projectId), list);
  }
  return projects.map(p => {
    const pd = byProject.get(Number(p.id)) ?? [];
    const dates = pd.map(d => d.date).sort();
    const ti = pd.findIndex(d => d.date === today);
    return {
      ...p,
      id: Number(p.id),
      groupCount: Number(p.groupCount),
      participantCount: Number(p.participantCount),
      dayCount: pd.length,
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
      todayDay: ti >= 0 ? { id: Number(pd[ti].id), index: ti, name: pd[ti].name, date: pd[ti].date } : null,
    };
  });
}

export async function getProject(teamId: number, projectId: number) {
  await ensureFieldTables();
  if (!Number.isInteger(projectId) || projectId <= 0) return null;
  const [project] = await query<ProjectRow & { createdByName: string | null }>(
    `SELECT id, name, status, createdAt, archivedAt, createdByName FROM FieldProject WHERE id = ? AND teamId = ?`, [projectId, teamId]);
  if (!project) return null;
  const [dayRows, groups, participants, supervisors] = await Promise.all([
    query<Omit<DayRow, 'index'>>(
      `SELECT id, date, name, sortOrder FROM FieldProjectDay WHERE projectId = ? AND teamId = ? ORDER BY sortOrder, date, id`, [projectId, teamId]),
    query<GroupRow>(
      `SELECT id, name, sortOrder FROM FieldGroup WHERE projectId = ? AND teamId = ? ORDER BY sortOrder, id`, [projectId, teamId]),
    query<{ id: number; studentId: number; groupId: number; snapshotName: string; snapshotGroupName: string }>(
      `SELECT id, studentId, groupId, snapshotName, snapshotGroupName FROM FieldProjectParticipant
       WHERE projectId = ? AND teamId = ? ORDER BY snapshotName`, [projectId, teamId]),
    query<{ memberId: number; snapshotName: string }>(
      `SELECT memberId, snapshotName FROM FieldProjectSupervisor WHERE projectId = ? AND teamId = ? ORDER BY snapshotName`, [projectId, teamId]),
  ]);
  const days: DayRow[] = dayRows.map((d, index) => ({ ...d, id: Number(d.id), index }));
  return {
    project: { ...project, id: Number(project.id) },
    days,
    groups: groups.map(g => ({ ...g, id: Number(g.id) })),
    participants: participants.map(p => ({ ...p, id: Number(p.id), studentId: Number(p.studentId), groupId: Number(p.groupId) })),
    supervisors: supervisors.map(s => ({ ...s, memberId: Number(s.memberId) })),
  };
}

/** عدادات الحضور لكل (يوم × مجموعة). المجموعة تُحسب حسب مجموعة المشارك في المشروع. */
export async function getProjectCounts(teamId: number, projectId: number, days: DayRow[], groups: GroupRow[]) {
  const [groupSizes, rows] = await Promise.all([
    query<{ groupId: number; n: number }>(
      `SELECT groupId, COUNT(*) AS n FROM FieldProjectParticipant WHERE projectId = ? AND teamId = ? GROUP BY groupId`, [projectId, teamId]),
    query<{ dayId: number; groupId: number; status: string; n: number }>(
      `SELECT a.projectDayId AS dayId, pp.groupId AS groupId, a.status, COUNT(*) AS n
       FROM FieldAttendance a
       JOIN FieldProjectParticipant pp ON pp.projectId = a.projectId AND pp.studentId = a.studentId AND pp.teamId = a.teamId
       WHERE a.projectId = ? AND a.teamId = ?
       GROUP BY a.projectDayId, pp.groupId, a.status`, [projectId, teamId]),
  ]);
  const size = new Map(groupSizes.map(g => [Number(g.groupId), Number(g.n)]));
  const cell = new Map<string, Counts>();
  for (const d of days) for (const g of groups) cell.set(`${d.id}:${g.id}`, emptyCounts(size.get(g.id) ?? 0));
  for (const r of rows) {
    const c = cell.get(`${Number(r.dayId)}:${Number(r.groupId)}`);
    if (c) addStatus(c, r.status, Number(r.n));
  }
  const byDay = new Map<number, Counts>();
  for (const d of days) byDay.set(d.id, sumCounts(groups.map(g => cell.get(`${d.id}:${g.id}`)!)));
  const byGroup = new Map<number, Counts>();
  for (const g of groups) byGroup.set(g.id, sumCounts(days.map(d => cell.get(`${d.id}:${g.id}`)!)));
  const total = sumCounts([...byDay.values()]);
  return {
    cell: (dayId: number, groupId: number) => cell.get(`${dayId}:${groupId}`) ?? emptyCounts(0),
    byDay: (dayId: number) => byDay.get(dayId) ?? emptyCounts(0),
    byGroup: (groupId: number) => byGroup.get(groupId) ?? emptyCounts(0),
    total,
  };
}

export interface SheetRow {
  studentId: number;
  name: string;
  status: AttendanceStatus;
  otherReason: string | null;
  recordedByName: string | null;
  recordedAt: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

export async function getGroupSheet(teamId: number, projectId: number, dayId: number, groupId: number): Promise<SheetRow[]> {
  const rows = await query<SheetRow>(
    `SELECT pp.studentId, pp.snapshotName AS name,
       COALESCE(a.status, 'NOT_MARKED') AS status, a.otherReason,
       a.recordedByName, a.recordedAt, a.updatedByName, a.updatedAt
     FROM FieldProjectParticipant pp
     LEFT JOIN FieldAttendance a
       ON a.projectId = pp.projectId AND a.studentId = pp.studentId AND a.projectDayId = ? AND a.teamId = pp.teamId
     WHERE pp.projectId = ? AND pp.groupId = ? AND pp.teamId = ?
     ORDER BY pp.snapshotName`, [dayId, projectId, groupId, teamId]);
  return rows.map(r => ({ ...r, studentId: Number(r.studentId) }));
}

export async function getOtherCases(teamId: number, projectId: number) {
  return query<{ dayId: number; studentName: string; groupName: string; otherReason: string; byName: string | null; at: string }>(
    `SELECT a.projectDayId AS dayId, pp.snapshotName AS studentName, pp.snapshotGroupName AS groupName, a.otherReason,
       COALESCE(a.updatedByName, a.recordedByName) AS byName, a.updatedAt AS at
     FROM FieldAttendance a
     JOIN FieldProjectParticipant pp ON pp.projectId = a.projectId AND pp.studentId = a.studentId AND pp.teamId = a.teamId
     WHERE a.projectId = ? AND a.teamId = ? AND a.status = 'OTHER'
     ORDER BY a.projectDayId, pp.snapshotName`, [projectId, teamId]);
}

export async function getMarkers(teamId: number, projectId: number) {
  return query<{ name: string; n: number }>(
    `SELECT changedByName AS name, COUNT(*) AS n FROM FieldAttendanceAuditLog
     WHERE projectId = ? AND teamId = ? GROUP BY changedByName ORDER BY n DESC`, [projectId, teamId]);
}

export async function getAuditLog(teamId: number, projectId: number, limit = 500) {
  return query<{
    id: number; studentName: string; dayLabel: string; groupName: string; oldStatus: string; newStatus: string;
    oldReason: string | null; newReason: string | null; changedByName: string; changedAt: string;
  }>(
    `SELECT id, studentName, dayLabel, groupName, oldStatus, newStatus, oldReason, newReason, changedByName, changedAt
     FROM FieldAttendanceAuditLog WHERE projectId = ? AND teamId = ? ORDER BY changedAt DESC, id DESC LIMIT ?`,
    [projectId, teamId, limit]);
}

/** طلاب كل مجموعة مع حالتهم في يوم معيّن (لعرض الأسماء تحت المجموعة) */
export async function getDayRoster(teamId: number, projectId: number, dayId: number) {
  const rows = await query<{ groupId: number; studentId: number; name: string; status: AttendanceStatus; otherReason: string | null }>(
    `SELECT pp.groupId, pp.studentId, pp.snapshotName AS name,
       COALESCE(a.status, 'NOT_MARKED') AS status, a.otherReason
     FROM FieldProjectParticipant pp
     LEFT JOIN FieldAttendance a
       ON a.projectId = pp.projectId AND a.studentId = pp.studentId AND a.projectDayId = ? AND a.teamId = pp.teamId
     WHERE pp.projectId = ? AND pp.teamId = ?
     ORDER BY pp.snapshotName`, [dayId, projectId, teamId]);
  return rows.map(r => ({ ...r, groupId: Number(r.groupId), studentId: Number(r.studentId) }));
}
