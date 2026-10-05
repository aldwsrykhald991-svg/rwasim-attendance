import { NextRequest, NextResponse } from 'next/server';
import { query, mutate, batch } from '@/lib/db';
import { cleanName, isIsoDate, isProjectStatus } from '@/lib/field/db';
import { bad, requireFieldMember } from '@/lib/field/auth';

interface Body {
  name?: unknown;
  status?: unknown;
  days?: { date?: unknown; name?: unknown }[];
  groups?: { name?: unknown }[];
  participants?: { studentId?: unknown; group?: unknown }[];
  supervisorIds?: unknown[];
}

/** إنشاء مشروع كامل: الأيام + المجموعات + المشاركون (لقطة) + المخولون بالتحضير */
export async function POST(req: NextRequest) {
  const auth = await requireFieldMember();
  if (!auth.ok) return auth.res;
  const { teamId, memberId, memberName } = auth.ctx;
  const body = await req.json().catch(() => ({})) as Body;

  const name = cleanName(body.name, 100);
  if (name.length < 2) return bad('اكتب اسم المشروع');
  const status = isProjectStatus(body.status) ? body.status : 'UPCOMING';

  const days = (Array.isArray(body.days) ? body.days : []).map(d => ({ date: d?.date, name: cleanName(d?.name, 60) || null }));
  if (days.length < 1) return bad('المشروع يحتاج يوماً واحداً على الأقل');
  if (days.length > 60) return bad('عدد الأيام كبير جداً');
  if (days.some(d => !isIsoDate(d.date))) return bad('حدد تاريخاً صحيحاً لكل يوم');
  if (new Set(days.map(d => d.date)).size !== days.length) return bad('لا يمكن تكرار نفس التاريخ لأكثر من يوم');

  const groups = (Array.isArray(body.groups) ? body.groups : []).map(g => cleanName(g?.name, 40));
  if (groups.length < 1) return bad('أضف مجموعة واحدة على الأقل');
  if (groups.length > 50) return bad('عدد المجموعات كبير جداً');
  if (groups.some(g => !g)) return bad('اكتب اسم كل مجموعة');
  if (new Set(groups.map(g => g.toLowerCase())).size !== groups.length) return bad('أسماء المجموعات يجب ألا تتكرر');

  const parts = (Array.isArray(body.participants) ? body.participants : []).map(p => ({
    studentId: Number(p?.studentId), group: Number(p?.group),
  }));
  if (parts.some(p => !Number.isInteger(p.group) || p.group < 0 || p.group >= groups.length)) return bad('وزّع كل طالب على مجموعة');
  if (new Set(parts.map(p => p.studentId)).size !== parts.length) return bad('طالب مكرر في القائمة');

  // التحقق أن كل الطلاب والأعضاء يتبعون هذا الفريق فقط
  const students = await query<{ id: number; name: string }>(
    `SELECT id, name FROM FieldStudent WHERE teamId = ? AND active = 1`, [teamId]);
  const studentName = new Map(students.map(s => [Number(s.id), s.name]));
  if (parts.some(p => !studentName.has(p.studentId))) return bad('بعض الطلاب غير موجودين في فريقك');

  const supIds = [...new Set((Array.isArray(body.supervisorIds) ? body.supervisorIds : []).map(Number))];
  const members = await query<{ id: number; name: string }>(
    `SELECT id, name FROM FieldTeamMember WHERE teamId = ? AND active = 1`, [teamId]);
  const memberNameById = new Map(members.map(m => [Number(m.id), m.name]));
  if (supIds.some(id => !memberNameById.has(id))) return bad('بعض المشرفين غير موجودين في فريقك');
  if (!supIds.length) return bad('حدد عضواً واحداً على الأقل مخولاً بالتحضير');

  const project = await mutate(
    `INSERT INTO FieldProject (teamId, name, status, createdById, createdByName, archivedAt)
     VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'FINISHED' THEN datetime('now') END)`,
    [teamId, name, status, memberId, memberName, status]);
  const projectId = project.id;

  try {
    const sortedDays = [...days].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    await batch([
      ...sortedDays.map((d, i) => ({
        sql: `INSERT INTO FieldProjectDay (teamId, projectId, date, name, sortOrder) VALUES (?, ?, ?, ?, ?)`,
        args: [teamId, projectId, String(d.date), d.name, i],
      })),
      ...groups.map((g, i) => ({
        sql: `INSERT INTO FieldGroup (teamId, projectId, name, sortOrder) VALUES (?, ?, ?, ?)`,
        args: [teamId, projectId, g, i],
      })),
      ...supIds.map(id => ({
        sql: `INSERT INTO FieldProjectSupervisor (teamId, projectId, memberId, snapshotName) VALUES (?, ?, ?, ?)`,
        args: [teamId, projectId, id, memberNameById.get(id)!],
      })),
    ]);
    const groupRows = await query<{ id: number; sortOrder: number }>(
      `SELECT id, sortOrder FROM FieldGroup WHERE projectId = ? AND teamId = ?`, [projectId, teamId]);
    const groupIdByIndex = new Map(groupRows.map(g => [Number(g.sortOrder), Number(g.id)]));
    if (parts.length) {
      await batch(parts.map(p => ({
        sql: `INSERT INTO FieldProjectParticipant (teamId, projectId, groupId, studentId, snapshotName, snapshotGroupName)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [teamId, projectId, groupIdByIndex.get(p.group)!, p.studentId, studentName.get(p.studentId)!, groups[p.group]],
      })));
    }
  } catch (err) {
    await batch(['FieldProjectParticipant', 'FieldProjectSupervisor', 'FieldGroup', 'FieldProjectDay', 'FieldProject'].map(t => ({
      sql: t === 'FieldProject' ? `DELETE FROM FieldProject WHERE id = ? AND teamId = ?` : `DELETE FROM ${t} WHERE projectId = ? AND teamId = ?`,
      args: [projectId, teamId],
    })));
    console.error('field project create failed', err);
    return bad('تعذر إنشاء المشروع، حاول مرة أخرى', 500);
  }

  return NextResponse.json({ ok: true, id: projectId });
}
