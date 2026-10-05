'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandedBackdrop, BrandHeading } from './AuthScreen';
import { btn, input } from './ui';
import { fieldApi } from './api';
import LogoutButton from './LogoutButton';

export default function WhoAmI({ teamName, members, currentId }: {
  teamName: string;
  members: { id: number; name: string }[];
  currentId: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | 'new' | null>(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(members.length === 0);

  async function choose(payload: { memberId: number } | { newName: string }, key: number | 'new') {
    setBusy(key); setError('');
    const r = await fieldApi('/api/field/auth/member', payload);
    if (!r.ok) { setBusy(null); return setError(r.error); }
    router.replace('/field/home');
    router.refresh();
  }

  return (
    <BrandedBackdrop>
      <BrandHeading sub={`الفريق: ${teamName}`} />
      <div className="gcard rw-fx-float rw-fx-glow w-full max-w-md rounded-3xl p-5 sm:p-6">
        <h2 className="text-xl font-bold text-fd-petrol">من أنت؟</h2>
        <p className="mb-4 mt-1 text-sm text-fd-muted">اختر اسمك ليُسجَّل باسمك كل تحضير أو تعديل تقوم به.</p>

        <div className="grid gap-2">
          {members.map(m => (
            <button key={m.id} type="button" disabled={busy !== null} onClick={() => choose({ memberId: m.id }, m.id)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-right font-semibold transition ${m.id === currentId ? 'border-fd-orange bg-fd-orange/5 text-fd-petrol' : 'border-fd-line text-fd-petrol hover:border-fd-teal hover:bg-fd-bg'}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fd-teal/15 text-fd-petrol">{m.name.trim().charAt(0)}</span>
              <span className="flex-1">{m.name}</span>
              {busy === m.id ? <i className="fa-solid fa-spinner animate-spin text-fd-muted" /> : <i className="fa-solid fa-chevron-left text-xs text-fd-muted" />}
            </button>
          ))}
        </div>

        {adding ? (
          <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); choose({ newName }, 'new'); }}>
            <input className={input} placeholder="اكتب اسمك" value={newName} onChange={e => setNewName(e.target.value)} required minLength={2} autoFocus />
            <button className={btn.primary} disabled={busy !== null}>متابعة</button>
          </form>
        ) : (
          <button type="button" className="mt-4 text-sm font-semibold text-fd-orange-solid" onClick={() => setAdding(true)}>
            <i className="fa-solid fa-plus text-xs" /> اسمي غير موجود — أضفني للفريق
          </button>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-5 border-t border-fd-line pt-3 text-center">
          <LogoutButton className="text-sm text-fd-muted hover:text-fd-petrol" />
        </div>
      </div>
    </BrandedBackdrop>
  );
}
