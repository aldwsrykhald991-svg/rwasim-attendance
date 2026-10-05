'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlatformLogo, FieldFooter } from './Brand';
import { btn, input } from './ui';
import { fieldApi } from './api';

export function BrandedBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-fd-bg">
      <div aria-hidden className="rw-fx-aura rw-fx-aura--teal rw-fx-parallax -right-24 -top-24 h-80 w-80" data-depth="0.25" />
      <div aria-hidden className="rw-fx-aura rw-fx-aura--orange rw-fx-parallax -left-20 top-1/2 h-64 w-64" data-depth="-0.2" />
      <div aria-hidden className="rw-fx-aura rw-fx-aura--deep rw-fx-parallax -bottom-28 right-1/4 h-72 w-72" data-depth="0.15" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">{children}</div>
      <div className="relative z-10">
        <FieldFooter />
      </div>
    </div>
  );
}

export function BrandHeading({ sub }: { sub?: string }) {
  return (
    <div className="mb-6 text-center">
      <span className="rw-fx-seal rw-fx-float"><PlatformLogo height={88} /></span>
      <h1 className="mt-4 text-2xl font-bold text-fd-petrol">منصة التحضير الميداني</h1>
      <p className="mt-1 text-sm text-fd-muted">{sub ?? 'تحضير المشاريع والبرامج في الميدان — ببساطة ووضوح'}</p>
    </div>
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'create'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState('');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [team, setTeam] = useState({ teamName: '', adminName: '', password: '', confirm: '' });

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await fieldApi('/api/field/auth/login', { identifier, password });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.replace('/field/who');
    router.refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (team.password !== team.confirm) return setError('كلمتا المرور غير متطابقتين');
    setBusy(true); setError('');
    const r = await fieldApi<{ code: string }>('/api/field/auth/register', team);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setCreatedCode(r.data.code);
  }

  if (createdCode) {
    return (
      <BrandedBackdrop>
        <BrandHeading sub="تم إنشاء حساب الفريق بنجاح" />
        <div className="rw-fx-glass rw-fx-glow w-full max-w-md rounded-3xl p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <i className="fa-solid fa-check text-xl" />
          </div>
          <div className="font-bold text-fd-petrol">{team.teamName}</div>
          <p className="mt-3 text-sm text-fd-muted">رمز الفريق — يمكن استخدامه بدل الاسم عند الدخول:</p>
          <div className="my-3 rounded-2xl bg-fd-bg py-3 font-mono text-3xl font-bold tracking-[0.3em] text-fd-petrol" dir="ltr">{createdCode}</div>
          <p className="mb-5 text-xs text-fd-muted">احتفظ بالرمز وكلمة المرور وشاركهما مع أعضاء فريقك فقط.</p>
          <button className={`${btn.primary} w-full`} onClick={() => { router.replace('/field/home'); router.refresh(); }}>
            ابدأ الآن
          </button>
        </div>
      </BrandedBackdrop>
    );
  }

  return (
    <BrandedBackdrop>
      <BrandHeading />
      <div className="rw-fx-glass rw-fx-glow w-full max-w-md rounded-3xl p-5 sm:p-6">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-fd-bg p-1 text-sm">
          {(['login', 'create'] as const).map(t => (
            <button key={t} type="button" onClick={() => { setTab(t); setError(''); }}
              className={`rounded-lg py-2.5 font-semibold ${tab === t ? 'bg-white text-fd-petrol shadow-sm' : 'text-fd-muted'}`}>
              {t === 'login' ? 'دخول الفريق' : 'إنشاء فريق جديد'}
            </button>
          ))}
        </div>

        {tab === 'login' ? (
          <form onSubmit={login} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-fd-petrol">اسم الفريق أو رمز الفريق</span>
              <input className={input} value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" required />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-fd-petrol">كلمة المرور</span>
              <input className={input} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button className={`${btn.primary} w-full`} disabled={busy}>{busy ? 'جارٍ الدخول…' : 'دخول'}</button>
            <p className="pt-1 text-center text-xs text-fd-muted">
              أول مرة؟ <button type="button" className="font-semibold text-fd-orange-solid" onClick={() => { setTab('create'); setError(''); }}>أنشئ حساباً لفريقك</button>
            </p>
            {error && (
              <p className="rounded-lg bg-fd-bg px-3 py-2 text-center text-xs text-fd-muted">
                لا يوجد دخول قبل إنشاء الفريق. إن لم تنشئ فريقك بعد فاختر «إنشاء فريق جديد» بالأعلى.
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={create} className="space-y-3">
            {([
              ['teamName', 'اسم الفريق', 'text', 'organization'],
              ['adminName', 'اسم المسؤول عن الفريق', 'text', 'name'],
              ['password', 'كلمة مرور الفريق (8 أحرف على الأقل)', 'password', 'new-password'],
              ['confirm', 'تأكيد كلمة المرور', 'password', 'new-password'],
            ] as const).map(([key, label, type, ac]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-sm font-medium text-fd-petrol">{label}</span>
                <input className={input} type={type} autoComplete={ac} required minLength={key.startsWith('p') || key === 'confirm' ? 8 : 2}
                  value={team[key]} onChange={e => setTeam({ ...team, [key]: e.target.value })} />
              </label>
            ))}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button className={`${btn.primary} w-full`} disabled={busy}>{busy ? 'جارٍ الإنشاء…' : 'إنشاء الفريق'}</button>
            <p className="text-center text-xs text-fd-muted">لكل فريق حساب مستقل لا يطّلع عليه أي فريق آخر.</p>
          </form>
        )}
      </div>
    </BrandedBackdrop>
  );
}
