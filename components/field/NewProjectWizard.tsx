'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dayOrdinal, formatDay, PROJECT_STATUS_LABEL } from '@/lib/field/format';
import { fieldApi } from './api';
import { btn, Card, input } from './ui';
import RosterImport from './RosterImport';
import type { RosterEntry } from '@/lib/field/roster-import';

interface Student { id: number; name: string }
interface Member { id: number; name: string }

const STEPS = ['المشروع والأيام', 'المجموعات', 'الطلاب', 'المخولون بالتحضير', 'المراجعة'];

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function clampCount(v: string, max: number) {
  return Math.max(1, Math.min(max, Math.floor(Number(v) || 1)));
}

export default function NewProjectWizard({ students: initialStudents, members, today, currentMemberId }: {
  students: Student[]; members: Member[]; today: string; currentMemberId: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [status, setStatus] = useState<'UPCOMING' | 'ACTIVE'>('UPCOMING');
  const [days, setDays] = useState([{ date: today, name: '' }]);
  const [groups, setGroups] = useState(['']);
  const [students, setStudents] = useState(initialStudents);
  const [assign, setAssign] = useState<Record<number, number>>({}); // studentId -> group index
  const [search, setSearch] = useState('');
  const [newNames, setNewNames] = useState('');
  const [notice, setNotice] = useState('');
  const [supervisors, setSupervisors] = useState<Set<number>>(new Set(members.map(m => m.id)));

  const selectedIds = Object.keys(assign).map(Number);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? students.filter(s => s.name.toLowerCase().includes(q)) : students;
  }, [students, search]);

  function setDayCount(n: number) {
    setDays(ds => {
      if (n <= ds.length) return ds.slice(0, n);
      const last = ds[ds.length - 1]?.date || today;
      return [...ds, ...Array.from({ length: n - ds.length }, (_, i) => ({ date: addDays(last, i + 1), name: '' }))];
    });
  }

  function setGroupCount(n: number) {
    setGroups(gs => (n <= gs.length ? gs.slice(0, n) : [...gs, ...Array(n - gs.length).fill('')]));
    setAssign(a => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v >= n ? 0 : v])));
  }

  function toggleStudent(id: number) {
    setAssign(a => {
      const next = { ...a };
      if (id in next) delete next[id];
      else next[id] = 0;
      return next;
    });
  }

  function distributeEvenly() {
    const ids = students.filter(s => s.id in assign).map(s => s.id);
    setAssign(Object.fromEntries(ids.map((id, i) => [id, i % groups.length])));
  }

  /** يعتمد السجل المستورد: ينشئ الطلاب الجدد، يضيف المجموعات، ويوزّع كل طالب على مجموعته */
  async function applyRoster(entries: RosterEntry[]) {
    const byName = new Map<string, RosterEntry>();
    for (const e of entries) if (!byName.has(e.name.toLowerCase())) byName.set(e.name.toLowerCase(), e);
    const unique = [...byName.values()];
    setBusy(true); setError(''); setNotice('');
    const created: Student[] = [];
    for (let i = 0; i < unique.length; i += 500) {
      const r = await fieldApi<{ students: Student[] }>('/api/field/students', { names: unique.slice(i, i + 500).map(e => e.name) });
      if (!r.ok) { setBusy(false); return setError(r.error); }
      created.push(...r.data.students);
    }
    setBusy(false);

    const nextGroups = groups.map(g => g.trim()).filter(Boolean);
    for (const e of unique) {
      if (e.group && !nextGroups.some(g => g.toLowerCase() === e.group!.toLowerCase())) nextGroups.push(e.group);
    }
    if (!nextGroups.length) nextGroups.push('');
    const idByName = new Map(created.map(s => [s.name.toLowerCase(), s.id]));
    const nextAssign: Record<number, number> = {};
    for (const e of unique) {
      const id = idByName.get(e.name.toLowerCase());
      if (id == null) continue;
      const gi = e.group ? nextGroups.findIndex(g => g.toLowerCase() === e.group!.toLowerCase()) : 0;
      nextAssign[id] = Math.max(0, gi);
    }
    setGroups(nextGroups);
    setAssign(a => ({ ...a, ...nextAssign }));
    setStudents(prev => {
      const have = new Set(prev.map(s => s.id));
      return [...prev, ...created.filter(s => !have.has(s.id))].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    });
    const noGroup = unique.filter(e => !e.group).length;
    setNotice(`تم استيراد ${Object.keys(nextAssign).length} طالب في ${nextGroups.filter(Boolean).length} مجموعات${noGroup ? ` — ${noGroup} بدون مجموعة وُضعوا في «${nextGroups[0] || 'المجموعة الأولى'}»` : ''}. راجع التوزيع ثم تابع.`);
    setStep(2);
  }

  async function addNewStudents() {
    const names = newNames.split('\n').map(s => s.trim()).filter(Boolean);
    if (!names.length) return;
    setBusy(true); setError('');
    const r = await fieldApi<{ students: Student[] }>('/api/field/students', { names });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setStudents(prev => {
      const have = new Set(prev.map(s => s.id));
      return [...prev, ...r.data.students.filter(s => !have.has(s.id))].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    });
    setAssign(a => ({ ...a, ...Object.fromEntries(r.data.students.filter(s => !(s.id in a)).map(s => [s.id, 0])) }));
    setNewNames('');
  }

  function validate(s: number): string {
    if (s === 0) {
      if (name.trim().length < 2) return 'اكتب اسم المشروع';
      if (days.some(d => !d.date)) return 'حدد تاريخ كل يوم';
      if (new Set(days.map(d => d.date)).size !== days.length) return 'لا يمكن تكرار نفس التاريخ';
    }
    if (s === 1) {
      if (groups.some(g => !g.trim())) return 'اكتب اسم كل مجموعة';
      if (new Set(groups.map(g => g.trim().toLowerCase())).size !== groups.length) return 'أسماء المجموعات يجب ألا تتكرر';
    }
    if (s === 3 && supervisors.size === 0) return 'حدد عضواً واحداً على الأقل';
    return '';
  }

  function next() {
    const e = validate(step);
    setError(e);
    if (!e) setStep(step + 1);
  }

  async function submit() {
    for (let s = 0; s < 4; s++) {
      const e = validate(s);
      if (e) { setStep(s); return setError(e); }
    }
    setBusy(true); setError('');
    const r = await fieldApi<{ id: number }>('/api/field/projects', {
      name, status,
      days: days.map(d => ({ date: d.date, name: d.name })),
      groups: groups.map(g => ({ name: g })),
      participants: Object.entries(assign).map(([studentId, group]) => ({ studentId: Number(studentId), group })),
      supervisorIds: [...supervisors],
    });
    if (!r.ok) { setBusy(false); return setError(r.error); }
    router.replace(`/field/projects/${r.data.id}`);
    router.refresh();
  }

  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="pb-24">
      <ol className="mb-5 flex gap-1.5 overflow-x-auto pb-1 text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold ${i === step ? 'bg-fd-petrol text-white' : i < step ? 'bg-fd-teal/15 text-fd-petrol' : 'bg-white text-fd-muted ring-1 ring-fd-line'}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i === step ? 'bg-fd-orange-solid' : i < step ? 'bg-fd-teal text-white' : 'bg-fd-bg'}`}>
              {i < step ? <i className="fa-solid fa-check" /> : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <Card>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-fd-petrol">اسم المشروع</span>
              <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="مثال: مشوار الأشبال" autoFocus />
            </label>
            <div className="mt-4">
              <span className="mb-1 block text-sm font-semibold text-fd-petrol">حالة المشروع</span>
              <div className="grid grid-cols-2 gap-2">
                {(['UPCOMING', 'ACTIVE'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setStatus(s)}
                    className={`rounded-xl border-2 py-3 font-semibold ${status === s ? 'border-fd-orange bg-fd-orange/5 text-fd-petrol' : 'border-fd-line text-fd-muted'}`}>
                    {PROJECT_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-fd-petrol">عدد أيام المشروع</span>
              <input type="number" min={1} max={60} className={`${input} !w-24 text-center`} value={days.length}
                onChange={e => setDayCount(clampCount(e.target.value, 60))} />
            </label>
            <div className="mt-4 space-y-3">
              {days.map((d, i) => (
                <div key={i} className="rounded-xl bg-fd-bg p-3">
                  <div className="mb-2 text-sm font-bold text-fd-teal">{dayOrdinal(i)}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input type="date" className={input} value={d.date} aria-label="التاريخ"
                      onChange={e => setDays(ds => ds.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                    <input className={input} value={d.name} placeholder="اسم اليوم (اختياري)" aria-label="اسم اليوم"
                      onChange={e => setDays(ds => ds.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  </div>
                </div>
              ))}
            </div>
            {days.length > 1 && <p className="mt-2 text-xs text-fd-muted">تُرتّب الأيام تلقائياً حسب التاريخ.</p>}
          </Card>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
        <Card className="border-fd-teal/40">
          <div className="mb-1 font-bold text-fd-petrol"><i className="fa-solid fa-file-import ml-1 text-fd-teal" /> لديك سجل بأسماء الطلاب ومجموعاتهم؟</div>
          <p className="mb-3 text-xs text-fd-muted">ارفعه أو الصقه، وسيقرأ النظام كل اسم مع مجموعته وينشئ المجموعات ويوزّع الطلاب تلقائياً.</p>
          <RosterImport onApply={applyRoster} busy={busy} applyLabel="استيراد وتوزيع"
            noGroupNote="الطلاب بدون مجموعة يوضعون في أول مجموعة ويمكنك تغييرهم في الخطوة التالية." />
        </Card>
        <div className="text-center text-xs text-fd-muted">أو أدخل المجموعات يدوياً</div>
        <Card>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-fd-petrol">عدد المجموعات</span>
            <input type="number" min={1} max={50} className={`${input} !w-24 text-center`} value={groups.length}
              onChange={e => setGroupCount(clampCount(e.target.value, 50))} />
          </label>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {groups.map((g, i) => (
              <input key={i} className={input} value={g} placeholder={`اسم المجموعة ${i + 1}`} aria-label={`اسم المجموعة ${i + 1}`}
                onChange={e => setGroups(gs => gs.map((x, j) => j === i ? e.target.value : x))} />
            ))}
          </div>
        </Card>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}
          {!notice && (
            <button type="button" className="text-sm font-semibold text-fd-teal" onClick={() => setStep(1)}>
              <i className="fa-solid fa-file-import ml-1" /> لديك سجل جاهز؟ استورد الطلاب ومجموعاتهم
            </button>
          )}
          <Card>
            <div className="mb-2 text-sm font-semibold text-fd-petrol">إضافة طلاب جدد للفريق</div>
            <textarea className={input} rows={3} value={newNames} onChange={e => setNewNames(e.target.value)} placeholder="اسم في كل سطر" />
            <button type="button" className={`${btn.ghost} mt-2`} onClick={addNewStudents} disabled={busy || !newNames.trim()}>
              <i className="fa-solid fa-user-plus" /> إضافة واختيار
            </button>
          </Card>
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-fd-petrol">الطلاب المشاركون <span className="text-fd-orange-solid">({selectedIds.length})</span></div>
              <div className="flex gap-2">
                <button type="button" className="text-xs font-semibold text-fd-teal"
                  onClick={() => setAssign(a => ({ ...Object.fromEntries(filtered.map(s => [s.id, 0])), ...a }))}>تحديد الكل</button>
                <button type="button" className="text-xs font-semibold text-fd-muted" onClick={() => setAssign({})}>إلغاء التحديد</button>
              </div>
            </div>
            {students.length > 6 && <input className={`${input} mb-3`} placeholder="بحث بالاسم" value={search} onChange={e => setSearch(e.target.value)} />}
            {selectedIds.length > 0 && groups.length > 1 && (
              <button type="button" className={`${btn.ghost} mb-3 w-full`} onClick={distributeEvenly}>
                <i className="fa-solid fa-shuffle" /> توزيع تلقائي بالتساوي على {groups.length} مجموعات
              </button>
            )}
            {students.length === 0 ? (
              <p className="text-sm text-fd-muted">لا يوجد طلاب في الفريق بعد — أضفهم من الأعلى.</p>
            ) : (
              <ul className="divide-y divide-fd-line">
                {filtered.map(s => {
                  const on = s.id in assign;
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2">
                      <label className="flex flex-1 cursor-pointer items-center gap-3 py-1">
                        <input type="checkbox" className="h-5 w-5 accent-fd-orange" checked={on} onChange={() => toggleStudent(s.id)} />
                        <span className={on ? 'font-semibold text-fd-petrol' : 'text-slate-600'}>{s.name}</span>
                      </label>
                      {on && (
                        <select className="rounded-lg border border-fd-line bg-white px-2 py-1.5 text-sm" aria-label={`مجموعة ${s.name}`}
                          value={assign[s.id]} onChange={e => setAssign(a => ({ ...a, [s.id]: Number(e.target.value) }))}>
                          {groups.map((g, i) => <option key={i} value={i}>{g || `مجموعة ${i + 1}`}</option>)}
                        </select>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {step === 3 && (
        <Card>
          <div className="mb-1 text-sm font-semibold text-fd-petrol">أعضاء الفريق المخولون بالتحضير</div>
          <p className="mb-3 text-xs text-fd-muted">غير المخولين يستطيعون الاطلاع على المشروع دون تعديل الحضور.</p>
          <ul className="space-y-2">
            {members.map(m => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-fd-line px-3 py-3">
                  <input type="checkbox" className="h-5 w-5 accent-fd-orange" checked={supervisors.has(m.id)}
                    onChange={() => setSupervisors(s => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} />
                  <span className="font-semibold text-fd-petrol">{m.name}</span>
                  {m.id === currentMemberId && <span className="text-xs text-fd-muted">(أنت)</span>}
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <h2 className="text-xl font-bold text-fd-petrol">{name}</h2>
          <div className="mt-1 text-sm text-fd-muted">الحالة: {PROJECT_STATUS_LABEL[status]}</div>
          <div className="mt-4 space-y-1.5 text-sm">
            {sortedDays.map((d, i) => (
              <div key={i} className="flex justify-between rounded-lg bg-fd-bg px-3 py-2">
                <span className="font-semibold text-fd-petrol">{dayOrdinal(i)}{d.name && ` — ${d.name}`}</span>
                <span className="text-fd-muted">{formatDay(d.date)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {groups.map((g, i) => (
              <div key={i} className="rounded-lg border border-fd-line px-3 py-2 text-sm">
                <b className="text-fd-petrol">{g}</b> — {Object.values(assign).filter(v => v === i).length} طالب
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm text-fd-muted">
            المخولون: {members.filter(m => supervisors.has(m.id)).map(m => m.name).join('، ')}
          </div>
        </Card>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-fd-line bg-white/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-5xl gap-2">
          {step > 0 && <button type="button" className={btn.ghost} onClick={() => { setError(''); setStep(step - 1); }}>السابق</button>}
          {step < STEPS.length - 1 ? (
            <button type="button" className={`${btn.dark} flex-1`} onClick={next}>التالي</button>
          ) : (
            <button type="button" className={`${btn.primary} flex-1`} onClick={submit} disabled={busy}>
              {busy ? 'جارٍ الإنشاء…' : 'إنشاء المشروع'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
