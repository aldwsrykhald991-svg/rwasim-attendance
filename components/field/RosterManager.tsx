'use client';

// إدارة قائمة أسماء الفريق: الطلاب أو الأعضاء
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fieldApi } from './api';
import { btn, Card, input } from './ui';

interface Item { id: number; name: string; active: number; note?: string }

export default function RosterManager({ kind, items, currentId }: { kind: 'students' | 'members'; items: Item[]; currentId?: number }) {
  const router = useRouter();
  const isStudents = kind === 'students';
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => (showInactive || Number(i.active)) && (!q || i.name.toLowerCase().includes(q)));
  }, [items, search, showInactive]);
  const inactiveCount = items.filter(i => !Number(i.active)).length;

  async function call(url: string, body: unknown, method: 'POST' | 'PATCH', ok: string) {
    setBusy(true); setMsg(null);
    const r = await fieldApi<{ added?: number; skipped?: number }>(url, body, method);
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return false; }
    const extra = r.data.skipped ? ` (تم تجاهل ${r.data.skipped} اسم مكرر)` : '';
    setMsg({ ok: true, text: ok + extra });
    router.refresh();
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ok = isStudents
      ? await call('/api/field/students', { names: text.split('\n') }, 'POST', 'تمت الإضافة')
      : await call('/api/field/members', { name: text }, 'POST', 'تمت إضافة العضو');
    if (ok) setText('');
  }

  const base = isStudents ? '/api/field/students' : '/api/field/members';

  return (
    <div>
      <Card>
        <form onSubmit={add}>
          <div className="mb-2 text-sm font-semibold text-fd-petrol">{isStudents ? 'إضافة طلاب' : 'إضافة عضو للفريق'}</div>
          {isStudents ? (
            <textarea className={input} rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="اسم في كل سطر — يمكنك لصق قائمة كاملة" />
          ) : (
            <input className={input} value={text} onChange={e => setText(e.target.value)} placeholder="اسم العضو" />
          )}
          <button className={`${btn.primary} mt-2`} disabled={busy || !text.trim()}><i className="fa-solid fa-plus" /> إضافة</button>
        </form>
      </Card>

      {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}

      <div className="mb-2 mt-5 flex flex-wrap items-center gap-2">
        <input className={`${input} !py-2 sm:max-w-xs`} placeholder="بحث" value={search} onChange={e => setSearch(e.target.value)} />
        {inactiveCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-fd-muted">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> إظهار الموقوفين ({inactiveCount})
          </label>
        )}
      </div>

      <Card className="!p-0">
        {list.length === 0 ? <p className="p-4 text-sm text-fd-muted">لا توجد أسماء.</p> : (
          <ul className="divide-y divide-fd-line">
            {list.map(i => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                {editing?.id === i.id ? (
                  <form className="flex flex-1 gap-2" onSubmit={async e => {
                    e.preventDefault();
                    if (await call(`${base}/${i.id}`, { name: editing.name }, 'PATCH', 'تم تعديل الاسم')) setEditing(null);
                  }}>
                    <input className={`${input} !py-2`} value={editing.name} onChange={e => setEditing({ id: i.id, name: e.target.value })} autoFocus aria-label="الاسم" />
                    <button className={`${btn.dark} !py-2`} disabled={busy}>حفظ</button>
                    <button type="button" className={`${btn.ghost} !py-2`} onClick={() => setEditing(null)}>إلغاء</button>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <span className={`font-semibold ${Number(i.active) ? 'text-fd-petrol' : 'text-slate-500 line-through'}`}>{i.name}</span>
                      {i.id === currentId && <span className="mr-2 text-xs text-fd-orange-solid">(أنت)</span>}
                      {i.note && <span className="mr-2 text-xs text-fd-muted">{i.note}</span>}
                    </div>
                    <button className="px-2 text-sm text-fd-teal" onClick={() => setEditing({ id: i.id, name: i.name })} aria-label={`تعديل ${i.name}`}>
                      <i className="fa-solid fa-pen" />
                    </button>
                    {i.id !== currentId && (
                      <button className={`px-2 text-xs ${Number(i.active) ? 'text-red-700' : 'text-emerald-700'}`} disabled={busy}
                        onClick={() => call(`${base}/${i.id}`, { active: !Number(i.active) }, 'PATCH', Number(i.active) ? 'تم الإيقاف' : 'تمت الإعادة')}>
                        {Number(i.active) ? 'إيقاف' : 'إعادة'}
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {isStudents && (
        <p className="mt-3 text-xs text-fd-muted">
          تعديل اسم الطالب أو إيقافه لا يغيّر المشاريع السابقة؛ كل مشروع يحتفظ بالأسماء والمجموعات كما كانت وقت تنفيذه.
        </p>
      )}
    </div>
  );
}
