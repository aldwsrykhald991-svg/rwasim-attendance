'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { dayOrdinal } from '@/lib/field/format';
import { fieldApi } from './api';
import { btn, Card, input, SectionTitle } from './ui';
import RosterImport from './RosterImport';

interface Props {
  projectId: number;
  name: string;
  days: { id: number; date: string; name: string | null; index: number }[];
  groups: { id: number; name: string }[];
  participants: { studentId: number; groupId: number; snapshotName: string }[];
  supervisorIds: number[];
  students: { id: number; name: string }[];
  members: { id: number; name: string }[];
}

export default function ProjectManager(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [name, setName] = useState(p.name);
  const [dayEdits, setDayEdits] = useState<Record<number, { date: string; name: string }>>({});
  const [newDay, setNewDay] = useState({ date: '', name: '' });
  const [groupEdits, setGroupEdits] = useState<Record<number, string>>({});
  const [newGroup, setNewGroup] = useState('');
  const [addGroupId, setAddGroupId] = useState(p.groups[0]?.id ?? 0);
  const [toAdd, setToAdd] = useState<Set<number>>(new Set());
  const [sups, setSups] = useState(new Set(p.supervisorIds));
  const [importOpen, setImportOpen] = useState(false);

  const inProject = new Set(p.participants.map(x => x.studentId));
  const available = p.students.filter(s => !inProject.has(s.id));

  async function run(body: Record<string, unknown>, okText: string, after?: () => void) {
    setBusy(true); setMsg(null);
    const r = await fieldApi(`/api/field/projects/${p.projectId}`, body, 'PATCH');
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: okText });
    after?.();
    router.refresh();
  }

  return (
    <div className="pb-10">
      {msg && (
        <div className={`sticky top-28 z-10 mb-3 rounded-xl px-4 py-2.5 text-sm shadow-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`} role="status">
          {msg.text}
        </div>
      )}

      <Card>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); run({ action: 'update', name }, 'تم حفظ الاسم'); }}>
          <input className={input} value={name} onChange={e => setName(e.target.value)} aria-label="اسم المشروع" />
          <button className={btn.dark} disabled={busy || name.trim() === p.name}>حفظ الاسم</button>
        </form>
      </Card>

      <SectionTitle>أيام المشروع</SectionTitle>
      <div className="space-y-2">
        {p.days.map(d => {
          const e = dayEdits[d.id] ?? { date: d.date, name: d.name ?? '' };
          const dirty = e.date !== d.date || e.name !== (d.name ?? '');
          return (
            <Card key={d.id} className="!p-3">
              <div className="mb-2 text-sm font-bold text-fd-teal">{dayOrdinal(d.index)}</div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                <input type="date" className={input} value={e.date} aria-label="التاريخ" onChange={ev => setDayEdits({ ...dayEdits, [d.id]: { ...e, date: ev.target.value } })} />
                <input className={input} value={e.name} placeholder="اسم اليوم (اختياري)" aria-label="اسم اليوم" onChange={ev => setDayEdits({ ...dayEdits, [d.id]: { ...e, name: ev.target.value } })} />
                <button className={btn.dark} disabled={busy || !dirty} onClick={() => run({ action: 'updateDay', dayId: d.id, ...e }, 'تم حفظ اليوم', () => setDayEdits(x => { const n = { ...x }; delete n[d.id]; return n; }))}>حفظ</button>
                <button className={btn.danger} disabled={busy || p.days.length <= 1} onClick={() => confirm('حذف هذا اليوم؟') && run({ action: 'deleteDay', dayId: d.id }, 'تم حذف اليوم')}>حذف</button>
              </div>
            </Card>
          );
        })}
        <Card className="!p-3">
          <div className="mb-2 text-sm font-semibold text-fd-petrol">إضافة يوم</div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input type="date" className={input} value={newDay.date} aria-label="التاريخ" onChange={e => setNewDay({ ...newDay, date: e.target.value })} />
            <input className={input} value={newDay.name} placeholder="اسم اليوم (اختياري)" aria-label="اسم اليوم" onChange={e => setNewDay({ ...newDay, name: e.target.value })} />
            <button className={btn.primary} disabled={busy || !newDay.date} onClick={() => run({ action: 'addDay', ...newDay }, 'تمت إضافة اليوم', () => setNewDay({ date: '', name: '' }))}>إضافة</button>
          </div>
        </Card>
      </div>

      <SectionTitle>المجموعات</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {p.groups.map(g => {
          const v = groupEdits[g.id] ?? g.name;
          const count = p.participants.filter(x => x.groupId === g.id).length;
          return (
            <Card key={g.id} className="!p-3">
              <div className="flex gap-2">
                <input className={input} value={v} aria-label="اسم المجموعة" onChange={e => setGroupEdits({ ...groupEdits, [g.id]: e.target.value })} />
                <button className={btn.dark} disabled={busy || v.trim() === g.name || !v.trim()} onClick={() => run({ action: 'renameGroup', groupId: g.id, name: v }, 'تم تغيير اسم المجموعة')}>حفظ</button>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-fd-muted">
                <span>{count} طالب</span>
                {count === 0 && p.groups.length > 1 && (
                  <button className="text-red-700" disabled={busy} onClick={() => confirm('حذف المجموعة؟') && run({ action: 'deleteGroup', groupId: g.id }, 'تم حذف المجموعة')}>حذف المجموعة</button>
                )}
              </div>
            </Card>
          );
        })}
        <Card className="!p-3">
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); run({ action: 'addGroup', name: newGroup }, 'تمت إضافة المجموعة', () => setNewGroup('')); }}>
            <input className={input} value={newGroup} placeholder="مجموعة جديدة" aria-label="مجموعة جديدة" onChange={e => setNewGroup(e.target.value)} />
            <button className={btn.primary} disabled={busy || !newGroup.trim()}>إضافة</button>
          </form>
        </Card>
      </div>

      <SectionTitle>الطلاب المشاركون ({p.participants.length})</SectionTitle>
      <Card className="mb-3 border-fd-teal/40">
        <button type="button" className="flex w-full items-center justify-between text-right font-bold text-fd-petrol" onClick={() => setImportOpen(o => !o)}>
          <span><i className="fa-solid fa-file-import ml-1 text-fd-teal" /> استيراد سجل الطلاب ومجموعاتهم</span>
          <i className={`fa-solid fa-chevron-down text-xs text-fd-muted transition ${importOpen ? 'rotate-180' : ''}`} />
        </button>
        {importOpen && (
          <div className="mt-3">
            <p className="mb-3 text-xs text-fd-muted">يُضاف الطلاب الجدد للمشروع، وتُنشأ المجموعات غير الموجودة، ومن هو مشارك أصلاً يُنقل لمجموعته في السجل.</p>
            <RosterImport busy={busy} applyLabel="استيراد إلى المشروع"
              noGroupNote={`الطلاب بدون مجموعة يوضعون في «${p.groups[0]?.name ?? ''}».`}
              onApply={entries => run({ action: 'importRoster', rows: entries }, 'تم استيراد السجل', () => setImportOpen(false))} />
          </div>
        )}
      </Card>
      <Card>
        {p.participants.length === 0 ? <p className="text-sm text-fd-muted">لا يوجد طلاب في المشروع بعد.</p> : (
          <ul className="divide-y divide-fd-line">
            {p.participants.map(s => (
              <li key={s.studentId} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1 font-semibold text-fd-petrol">{s.snapshotName}</span>
                <select className="rounded-lg border border-fd-line bg-white px-2 py-1.5 text-sm" value={s.groupId} disabled={busy} aria-label={`مجموعة ${s.snapshotName}`}
                  onChange={e => run({ action: 'moveParticipant', studentId: s.studentId, groupId: Number(e.target.value) }, `تم نقل ${s.snapshotName}`)}>
                  {p.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button className="px-2 text-sm text-red-700" disabled={busy} aria-label={`إزالة ${s.snapshotName}`}
                  onClick={() => confirm(`إزالة ${s.snapshotName} من المشروع؟`) && run({ action: 'removeParticipant', studentId: s.studentId }, 'تمت الإزالة')}>
                  <i className="fa-solid fa-xmark" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {available.length > 0 && p.groups.length > 0 && (
        <Card className="mt-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-fd-petrol">
            إضافة طلاب إلى مجموعة
            <select className="rounded-lg border border-fd-line bg-white px-2 py-1.5 text-sm" value={addGroupId} onChange={e => setAddGroupId(Number(e.target.value))} aria-label="المجموعة">
              {p.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {available.map(s => (
              <label key={s.id} className="flex cursor-pointer items-center gap-3 py-1.5">
                <input type="checkbox" className="h-5 w-5 accent-fd-orange" checked={toAdd.has(s.id)}
                  onChange={() => setToAdd(t => { const n = new Set(t); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} />
                {s.name}
              </label>
            ))}
          </div>
          <button className={`${btn.primary} mt-3`} disabled={busy || toAdd.size === 0}
            onClick={() => run({ action: 'addParticipants', groupId: addGroupId, studentIds: [...toAdd] }, 'تمت إضافة الطلاب', () => setToAdd(new Set()))}>
            إضافة {toAdd.size || ''} طالب
          </button>
        </Card>
      )}

      <SectionTitle>المخولون بالتحضير</SectionTitle>
      <Card>
        <div className="grid gap-2 sm:grid-cols-2">
          {p.members.map(m => (
            <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-fd-line px-3 py-2.5">
              <input type="checkbox" className="h-5 w-5 accent-fd-orange" checked={sups.has(m.id)}
                onChange={() => setSups(s => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} />
              <span className="font-semibold text-fd-petrol">{m.name}</span>
            </label>
          ))}
        </div>
        <button className={`${btn.dark} mt-3`} disabled={busy || sups.size === 0} onClick={() => run({ action: 'setSupervisors', memberIds: [...sups] }, 'تم حفظ المخولين')}>حفظ المخولين</button>
      </Card>
    </div>
  );
}
