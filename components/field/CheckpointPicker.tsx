'use client';

import { useId, useState } from 'react';
import type { CheckpointRow } from '@/lib/field/checkpoints';
import { formatStamp } from '@/lib/field/format';
import { fieldApi } from './api';
import { btn, input } from './ui';

export interface CheckpointPickerProps {
  projectId: number;
  dayId: number;
  checkpoints: CheckpointRow[];
  selectedId: number;
  canCreate: boolean;
  href: string;
}

export default function CheckpointPicker({ projectId, dayId, checkpoints, selectedId, canCreate, href, disabled = false, disabledReason = 'انتظر حفظ الحالات المعلّقة قبل الانتقال إلى محطة أخرى.' }: CheckpointPickerProps & { disabled?: boolean; disabledReason?: string }) {
  const id = useId();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = checkpoints.find(c => c.id === selectedId);

  function open(checkpoint: number) {
    const url = new URL(href, window.location.origin);
    url.searchParams.set('checkpointId', String(checkpoint));
    // تنقل كامل: لا ينتقل طابور الحفظ أو حالات الطلاب من محطة إلى أخرى.
    window.location.assign(url.toString());
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy || disabled) return;
    setBusy(true); setError('');
    const res = await fieldApi<{ checkpointId: number }>(`/api/field/projects/${projectId}/checkpoints`, { dayId, name });
    if (!res.ok) { setBusy(false); setError(res.error); return; }
    open(res.data.checkpointId);
  }

  return (
    <section className="my-4 rounded-2xl border border-fd-line bg-white p-4" aria-label="محطات التحضير">
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-fd-petrol">محطة التحضير</label>
      <h2 className="mb-3 break-words text-lg font-bold text-fd-petrol">{selected?.name}</h2>
      <div className="flex flex-wrap gap-2">
        <select id={id} value={selectedId} disabled={disabled || busy} className={`${input} min-w-0 flex-1 !w-auto`}
          onChange={e => open(Number(e.target.value))}>
          {checkpoints.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.name}</option>)}
        </select>
        <button type="button" className={btn.ghost} disabled={disabled || busy} onClick={() => window.location.reload()}
          title="تحديث قائمة المحطات" aria-label="تحديث قائمة المحطات">تحديث</button>
        {canCreate && <button type="button" className={btn.primary} disabled={disabled || busy}
          onClick={() => { setAdding(v => !v); setError(''); }} aria-expanded={adding}>
          <i className="fa-solid fa-plus" /> محطة جديدة
        </button>}
      </div>
      {selected?.createdAt && <p className="mt-2 text-xs text-fd-muted">أضافها {selected.createdByName} • {formatStamp(selected.createdAt)}</p>}
      <p className="mt-2 text-xs text-fd-muted">{canCreate ? 'عند كل انتقال، افتح محطة جديدة لتحضير الطلاب من جديد. يبقى سجل كل محطة محفوظاً.' : 'اختر المحطة لاستعراض سجل تحضيرها.'}</p>
      {disabled && <p className="mt-2 text-sm text-amber-700" role="status">{disabledReason}</p>}
      {adding && <form onSubmit={create} className="mt-3 border-t border-fd-line pt-3">
        <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-semibold text-fd-petrol">اسم المحطة أو الانتقال</label>
        <input id={`${id}-name`} className={input} value={name} onChange={e => setName(e.target.value)}
          maxLength={80} placeholder="مثال: من المركز إلى الحديقة" required minLength={2} disabled={disabled || busy} autoFocus />
        <p className="mt-2 text-xs text-fd-muted">المحطة مشتركة بين مجموعات المشروع لهذا اليوم؛ إذا أضافها مشرف آخر اخترها من القائمة.</p>
        {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
        <button type="submit" className={`${btn.primary} mt-3 w-full`} disabled={disabled || busy || name.trim().length < 2}>
          {busy ? 'جارٍ فتح المحطة…' : 'إنشاء المحطة وبدء التحضير'}
        </button>
      </form>}
    </section>
  );
}
