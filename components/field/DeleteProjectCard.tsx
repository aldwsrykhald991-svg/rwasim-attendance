'use client';

// حذف المشروع نهائياً — يتطلب كتابة اسم المشروع حتى لا يُحذف بالخطأ.
import { useState } from 'react';
import { fieldApi } from './api';
import { input } from './ui';

export default function DeleteProjectCard({ projectId, name }: { projectId: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const match = typed.trim() === name.trim();

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!match) return;
    setBusy(true); setError('');
    const r = await fieldApi(`/api/field/projects/${projectId}`, { confirmName: typed.trim() }, 'DELETE');
    if (!r.ok) { setBusy(false); return setError(r.error); }
    window.location.replace('/field/home');
  }

  return (
    <div id="delete" className="mt-8 scroll-mt-32 rounded-2xl border border-red-200 bg-white/80 p-4 sm:p-5" data-fx="off">
      <div className="font-bold text-red-700"><i className="fa-solid fa-triangle-exclamation ml-1" />حذف المشروع</div>
      <p className="mt-1 text-sm text-slate-700">
        يحذف المشروع نهائياً مع أيامه ومجموعاته وكل سجلات الحضور وسجل التعديلات ورابط التحضير. لا يمكن التراجع. طلاب الفريق وأعضاؤه لا يُحذفون.
      </p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 font-medium text-red-700 hover:bg-red-50">
          <i className="fa-solid fa-trash" /> حذف المشروع
        </button>
      ) : (
        <form onSubmit={remove} className="mt-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">للتأكيد اكتب اسم المشروع: <b className="text-fd-petrol">{name}</b></span>
            <input className={input} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" aria-label="اسم المشروع للتأكيد" />
          </label>
          {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={!match || busy}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-40">
              <i className="fa-solid fa-trash" /> {busy ? 'جارٍ الحذف…' : 'حذف نهائي'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setTyped(''); setError(''); }}
              className="rounded-xl border border-fd-line bg-white px-4 py-2.5 font-medium text-fd-petrol">إلغاء</button>
          </div>
        </form>
      )}
    </div>
  );
}
