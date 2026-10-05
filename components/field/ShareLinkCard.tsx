'use client';

// رابط التحضير السريع: يرسله مسؤول المشروع للمشرفين فيدخلون للتحضير مباشرة.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fieldApi } from './api';
import { btn } from './ui';

export default function ShareLinkCard({ projectId, projectName, token }: { projectId: number; projectName: string; token: string | null }) {
  const router = useRouter();
  const [current, setCurrent] = useState(token);
  const [origin, setOrigin] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [canShare, setCanShare] = useState(false);

  useEffect(() => { setOrigin(window.location.origin); setCanShare(typeof navigator.share === 'function'); }, []);
  useEffect(() => { setCurrent(token); }, [token]);

  const url = current && origin ? `${origin}/field/j/${current}` : '';
  const message = `رابط تحضير «${projectName}»: افتحه واكتب اسمك وابدأ التحضير مباشرة.\n${url}`;

  function flash(msg: string) { setNote(msg); setTimeout(() => setNote(''), 3000); }

  async function call(action: 'createLink' | 'revokeLink') {
    setBusy(true);
    const r = await fieldApi<{ token?: string }>(`/api/field/projects/${projectId}`, { action }, 'PATCH');
    setBusy(false);
    if (!r.ok) return flash(r.error);
    setCurrent(action === 'createLink' ? r.data.token ?? null : null);
    flash(action === 'createLink' ? 'الرابط جاهز' : 'تم إيقاف الرابط');
    router.refresh();
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); flash('تم نسخ الرابط'); }
    catch { flash('تعذر النسخ، انسخ الرابط يدوياً'); }
  }

  return (
    <div className="gcard rw-fx-float mt-4 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-fd-petrol"><i className="fa-solid fa-link ml-1 text-fd-teal" />رابط التحضير السريع</div>
          <p className="mt-1 text-sm text-fd-muted">
            من يفتح الرابط يكتب اسمه ويبدأ تحضير هذا المشروع مباشرة، بلا اسم فريق ولا كلمة مرور. لا يرى مشاريعك الأخرى ولا يدير الفريق.
          </p>
        </div>
      </div>

      {!current ? (
        <button type="button" className={`${btn.primary} mt-3`} disabled={busy} onClick={() => call('createLink')}>
          <i className="fa-solid fa-wand-magic-sparkles" /> {busy ? 'جارٍ الإنشاء…' : 'إنشاء رابط'}
        </button>
      ) : (
        <>
          <div className="mt-3 break-all rounded-xl bg-fd-bg px-3 py-2.5 font-mono text-xs text-fd-petrol" dir="ltr">{url || '…'}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={btn.primary} onClick={copy} disabled={!url}><i className="fa-solid fa-copy" /> نسخ الرابط</button>
            {canShare && (
              <button type="button" className={btn.ghost} disabled={!url}
                onClick={() => { navigator.share({ title: `تحضير ${projectName}`, text: message }).catch(() => {}); }}>
                <i className="fa-solid fa-share-nodes" /> مشاركة
              </button>
            )}
            <a className={btn.ghost} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(message)}`}>
              <i className="fa-brands fa-whatsapp" /> واتساب
            </a>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <button type="button" className="text-fd-muted underline-offset-2 hover:underline" disabled={busy}
              onClick={() => { if (confirm('تغيير الرابط يوقف الرابط القديم ويُخرج كل من دخل به. متابعة؟')) call('createLink'); }}>
              تغيير الرابط
            </button>
            <button type="button" className="text-red-700 underline-offset-2 hover:underline" disabled={busy}
              onClick={() => { if (confirm('إيقاف الرابط يُخرج كل من دخل به. متابعة؟')) call('revokeLink'); }}>
              إيقاف الرابط
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-800">أرسله للمشرفين فقط: كل من يملك الرابط يستطيع تحضير طلاب هذا المشروع.</p>
        </>
      )}
      {note && <p className="mt-2 text-xs font-semibold text-fd-petrol" role="status">{note}</p>}
    </div>
  );
}
