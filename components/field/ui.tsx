// عناصر واجهة بسيطة لمنصة التحضير الميداني (تعمل في مكونات الخادم والعميل)
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PROJECT_STATUS_LABEL, STATUS_LABEL, type Progress } from '@/lib/field/format';

export const btn = {
  primary: 'inline-flex items-center justify-center gap-2 rounded-xl bg-fd-orange-solid px-5 py-3 font-semibold text-white shadow-sm hover:bg-fd-orange-dark disabled:opacity-50',
  dark: 'inline-flex items-center justify-center gap-2 rounded-xl bg-fd-petrol px-5 py-3 font-semibold text-white hover:bg-fd-petrol-2 disabled:opacity-50',
  ghost: 'inline-flex items-center justify-center gap-2 rounded-xl border border-fd-line bg-white px-4 py-2.5 font-medium text-fd-petrol hover:bg-slate-50 disabled:opacity-50',
  danger: 'inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50',
};

export const input = 'w-full rounded-xl border border-fd-line bg-white px-4 py-3 text-slate-800 outline-none focus:border-fd-teal focus:ring-2 focus:ring-fd-teal/20';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`gcard rw-fx-float rounded-2xl p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function PageTitle({ title, sub, back, actions }: { title: string; sub?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <div className="mb-5">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1.5 text-sm text-fd-muted hover:text-fd-petrol">
          <i className="fa-solid fa-arrow-right text-xs" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-fd-petrol">{title}</h1>
          {sub && <div className="mt-1 text-sm text-fd-muted">{sub}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 mt-7 flex items-center gap-2 text-lg font-bold text-fd-petrol">
      <span className="h-5 w-1.5 rounded-full bg-fd-orange" />
      {children}
    </h2>
  );
}

const PROJECT_TONE: Record<string, string> = {
  ACTIVE: 'bg-fd-orange/15 text-fd-orange-dark',
  UPCOMING: 'bg-fd-teal/15 text-fd-petrol',
  FINISHED: 'bg-slate-100 text-slate-600',
};

export function ProjectStatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PROJECT_TONE[status] ?? ''}`}>{PROJECT_STATUS_LABEL[status] ?? status}</span>;
}

const PROGRESS: Record<Progress, { label: string; cls: string; icon: string }> = {
  DONE: { label: 'تم التحضير', cls: 'bg-emerald-50 text-emerald-700', icon: 'fa-circle-check' },
  IN_PROGRESS: { label: 'التحضير جارٍ', cls: 'bg-amber-50 text-amber-700', icon: 'fa-hourglass-half' },
  NOT_STARTED: { label: 'لم يبدأ', cls: 'bg-slate-100 text-slate-600', icon: 'fa-circle' },
};

export function ProgressBadge({ progress, doneLabel }: { progress: Progress; doneLabel?: string }) {
  const p = PROGRESS[progress];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${p.cls}`}>
      <i className={`fa-solid ${p.icon} text-[10px]`} /> {progress === 'DONE' && doneLabel ? doneLabel : p.label}
    </span>
  );
}

export function Bar({ value, total, tone = 'teal' }: { value: number; total: number; tone?: 'teal' | 'green' | 'orange' }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const color = tone === 'green' ? 'bg-emerald-500' : tone === 'orange' ? 'bg-fd-orange' : 'bg-fd-teal';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="gcard-soft rounded-xl px-3 py-2.5">
      <div className="text-xs text-fd-muted">{label}</div>
      <div className={`mt-0.5 text-xl font-bold ${tone ?? 'text-fd-petrol'}`}>{value}</div>
    </div>
  );
}

const ATT_TONE: Record<string, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  ABSENT: 'bg-red-50 text-red-700',
  OTHER: 'bg-amber-50 text-amber-700',
  NOT_MARKED: 'bg-slate-100 text-slate-600',
};

export function AttendanceBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ATT_TONE[status] ?? ''}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function Empty({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="gcard-soft rounded-2xl border-dashed px-4 py-8 text-center text-fd-muted">
      <i className={`fa-solid ${icon} mb-2 text-2xl text-fd-teal`} />
      <div className="text-sm">{children}</div>
    </div>
  );
}
