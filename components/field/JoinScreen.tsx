'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BrandedBackdrop } from './AuthScreen';
import { fieldApi } from './api';
import { btn, input } from './ui';

interface Props {
  state: 'ok' | 'invalid' | 'archived';
  token?: string;
  projectName?: string;
  teamName?: string;
  names?: { id: number; name: string }[];
}

export default function JoinScreen({ state, token, projectName, teamName, names = [] }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function join(body: { memberId: number } | { name: string }) {
    setBusy(true); setError('');
    const r = await fieldApi<{ next: string }>('/api/field/join', { token, ...body });
    if (!r.ok) { setBusy(false); return setError(r.error); }
    // تنقّل كامل حتى تُقرأ الجلسة الجديدة من الخادم
    window.location.replace(r.data.next);
  }

  return (
    <BrandedBackdrop>
      <div className="mb-6 text-center">
        {state === 'ok' ? (
          <>
            <p className="text-sm text-fd-muted">تحضير مشروع</p>
            <h1 className="text-2xl font-bold text-fd-petrol">{projectName}</h1>
            <p className="mt-1 text-sm text-fd-muted">{teamName}</p>
          </>
        ) : (
          <h1 className="text-2xl font-bold text-fd-petrol">{state === 'archived' ? projectName : 'الرابط غير صالح'}</h1>
        )}
      </div>

      <div className="gcard rw-fx-float w-full max-w-md rounded-3xl p-5 sm:p-6">
        {state === 'invalid' && (
          <p className="text-center text-slate-700">هذا الرابط لم يعد صالحاً أو تم تغييره. اطلب رابطاً جديداً من مسؤول المشروع.</p>
        )}
        {state === 'archived' && (
          <p className="text-center text-slate-700">هذا المشروع مؤرشف ولا يقبل التحضير عبر الرابط.</p>
        )}
        {state !== 'ok' && (
          <Link href="/field" className={`${btn.ghost} mt-4 w-full`}>دخول الفريق</Link>
        )}

        {state === 'ok' && (
          <>
            <h2 className="text-lg font-bold text-fd-petrol">من أنت؟</h2>
            <p className="mt-1 text-sm text-fd-muted">يُسجَّل اسمك مع كل تحضير تقوم به.</p>
            {names.length > 0 && (
              <div className="mt-4 grid gap-2">
                {names.map(n => (
                  <button key={n.id} type="button" disabled={busy} onClick={() => join({ memberId: n.id })}
                    className="flex items-center gap-3 rounded-xl border border-fd-line bg-white px-4 py-3.5 text-right font-semibold text-fd-petrol transition hover:border-fd-teal disabled:opacity-50">
                    <i className="fa-solid fa-user text-fd-teal" /> {n.name}
                  </button>
                ))}
              </div>
            )}
            <form className="mt-4" onSubmit={e => { e.preventDefault(); if (name.trim().length >= 2) join({ name: name.trim() }); }}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-fd-petrol">{names.length ? 'اسمي ليس في القائمة' : 'اكتب اسمك'}</span>
                <input className={input} value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="name" placeholder="الاسم" />
              </label>
              {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
              <button className={`${btn.primary} mt-3 w-full`} disabled={busy || name.trim().length < 2}>
                {busy ? 'جارٍ الدخول…' : 'دخول للتحضير'}
              </button>
            </form>
            <p className="mt-3 text-center text-xs text-fd-muted">هذا الرابط يفتح تحضير هذا المشروع فقط.</p>
          </>
        )}
      </div>
    </BrandedBackdrop>
  );
}
