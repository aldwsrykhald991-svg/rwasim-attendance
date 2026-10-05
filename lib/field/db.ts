// منصة التحضير الميداني — جداول مستقلة تماماً (بادئة Field*)
// لا تشارك أي جدول مع منصتي الأشبال أو المتوسط والثانوي.
// كل جدول يحمل teamId ليُقيَّد كل استعلام بالفريق الحالي على مستوى الخادم.
import { batch } from '@/lib/db';

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'NOT_MARKED', 'OTHER'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const PROJECT_STATUSES = ['UPCOMING', 'ACTIVE', 'FINISHED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS FieldTeam (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    adminName TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fteam_name ON FieldTeam(name COLLATE NOCASE)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fteam_code ON FieldTeam(code)`,

  `CREATE TABLE IF NOT EXISTS FieldTeamMember (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamId INTEGER NOT NULL,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fmember_team ON FieldTeamMember(teamId)`,

  `CREATE TABLE IF NOT EXISTS FieldStudent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamId INTEGER NOT NULL,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fstudent_team ON FieldStudent(teamId)`,

  `CREATE TABLE IF NOT EXISTS FieldProject (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamId INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'UPCOMING',
    createdById INTEGER,
    createdByName TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    archivedAt TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fproject_team ON FieldProject(teamId, status)`,

  `CREATE TABLE IF NOT EXISTS FieldProjectDay (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamId INTEGER NOT NULL,
    projectId INTEGER NOT NULL,
    date TEXT NOT NULL,
    name TEXT,
    sortOrder INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fday_project ON FieldProjectDay(projectId)`,
  `CREATE INDEX IF NOT EXISTS idx_fday_team_date ON FieldProjectDay(teamId, date)`,

  `CREATE TABLE IF NOT EXISTS FieldGroup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamId INTEGER NOT NULL,
    projectId INTEGER NOT NULL,
    name TEXT NOT NULL,
    sortOrder INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fgroup_project ON FieldGroup(projectId)`,

  // لقطة تاريخية: الاسم والمجموعة كما كانا وقت المشروع
  `CREATE TABLE IF NOT EXISTS FieldProjectParticipant (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamId INTEGER NOT NULL,
    projectId INTEGER NOT NULL,
    groupId INTEGER NOT NULL,
    studentId INTEGER NOT NULL,
    snapshotName TEXT NOT NULL,
    snapshotGroupName TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fpart_unique ON FieldProjectParticipant(projectId, studentId)`,
  `CREATE INDEX IF NOT EXISTS idx_fpart_group ON FieldProjectParticipant(groupId)`,

  `CREATE TABLE IF NOT EXISTS FieldProjectSupervisor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamId INTEGER NOT NULL,
    projectId INTEGER NOT NULL,
    memberId INTEGER NOT NULL,
    snapshotName TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fsup_unique ON FieldProjectSupervisor(projectId, memberId)`,

  // طالب واحد + مشروع واحد + يوم واحد = سجل حضور واحد فقط
  `CREATE TABLE IF NOT EXISTS FieldAttendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamId INTEGER NOT NULL,
    projectId INTEGER NOT NULL,
    projectDayId INTEGER NOT NULL,
    groupId INTEGER NOT NULL,
    studentId INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'NOT_MARKED',
    otherReason TEXT,
    recordedById INTEGER,
    recordedByName TEXT,
    recordedAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedById INTEGER,
    updatedByName TEXT,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (status IN ('PRESENT','ABSENT','NOT_MARKED','OTHER')),
    CHECK (status <> 'OTHER' OR length(trim(coalesce(otherReason, ''))) > 0)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fatt_unique ON FieldAttendance(projectId, projectDayId, studentId)`,
  `CREATE INDEX IF NOT EXISTS idx_fatt_day ON FieldAttendance(projectDayId)`,

  `CREATE TABLE IF NOT EXISTS FieldAttendanceAuditLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamId INTEGER NOT NULL,
    attendanceId INTEGER NOT NULL,
    projectId INTEGER NOT NULL,
    projectDayId INTEGER NOT NULL,
    groupId INTEGER NOT NULL,
    studentId INTEGER NOT NULL,
    studentName TEXT NOT NULL,
    projectName TEXT NOT NULL,
    dayLabel TEXT NOT NULL,
    groupName TEXT NOT NULL,
    oldStatus TEXT NOT NULL,
    newStatus TEXT NOT NULL,
    oldReason TEXT,
    newReason TEXT,
    changedById INTEGER,
    changedByName TEXT NOT NULL,
    changedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_faudit_project ON FieldAttendanceAuditLog(projectId, changedAt)`,

  // حدّ المحاولات (دخول/إنشاء) — محفوظ في القاعدة لأن ذاكرة الخادم لا تُشارك بين النسخ
  `CREATE TABLE IF NOT EXISTS FieldRateLimit (
    key TEXT PRIMARY KEY,
    n INTEGER NOT NULL DEFAULT 0,
    until INTEGER NOT NULL
  )`,
];

let ready: Promise<void> | null = null;

export function ensureFieldTables(): Promise<void> {
  if (!ready) {
    // دفعة واحدة بدل عشرات الرحلات إلى القاعدة عند أول طلب
    ready = batch(STATEMENTS.map(sql => ({ sql }))).catch(err => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

export function isAttendanceStatus(v: unknown): v is AttendanceStatus {
  return typeof v === 'string' && (ATTENDANCE_STATUSES as readonly string[]).includes(v);
}

export function isProjectStatus(v: unknown): v is ProjectStatus {
  return typeof v === 'string' && (PROJECT_STATUSES as readonly string[]).includes(v);
}

export function cleanName(v: unknown, max = 80): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

/** تاريخ اليوم بتوقيت السعودية بصيغة YYYY-MM-DD */
export function todayInRiyadh(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
