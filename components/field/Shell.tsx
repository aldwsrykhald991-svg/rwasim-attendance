'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PlatformLogo, FieldFooter } from './Brand';
import LogoutButton from './LogoutButton';

const NAV = [
  { href: '/field/home', label: 'الرئيسية', icon: 'fa-house' },
  { href: '/field/archive', label: 'الأرشيف', icon: 'fa-box-archive' },
  { href: '/field/students', label: 'الطلاب', icon: 'fa-user-graduate' },
  { href: '/field/team', label: 'الفريق', icon: 'fa-users' },
];

export default function Shell({ teamName, memberName, scopeProjectId = null, children }: { teamName: string; memberName: string; scopeProjectId?: number | null; children: ReactNode }) {
  // من دخل برابط التحضير السريع يرى مشروعه فقط
  const home = scopeProjectId ? `/field/projects/${scopeProjectId}` : '/field/home';
  const nav = scopeProjectId ? [{ href: home, label: 'المشروع', icon: 'fa-clipboard-check' }] : NAV;
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="gheader sticky top-0 z-30 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Link href={home} className="flex min-w-0 items-center gap-2.5">
            <PlatformLogo height={38} variant="light" />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-bold">التحضير الميداني</div>
            </div>
          </Link>
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 text-left leading-tight sm:block">
              <div className="truncate text-[11px] text-white/80">الفريق الحالي</div>
              <div className="truncate text-sm font-semibold">{teamName}</div>
            </div>
{scopeProjectId ? (
              <span className="flex max-w-[9.5rem] items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm">
                <i className="fa-solid fa-user text-xs text-fd-orange" />
                <span className="truncate">{memberName}</span>
              </span>
            ) : (
            <Link
              href="/field/who"
              title="تبديل المستخدم"
              className="flex max-w-[9.5rem] items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
            >
              <i className="fa-solid fa-user text-xs text-fd-orange" />
              <span className="truncate">{memberName}</span>
            </Link>
            )}
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-3 pb-2 text-sm">
          {nav.map(n => {
            const active = pathname === n.href || ((n.href === '/field/home' || !!scopeProjectId) && pathname.startsWith('/field/projects'));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 ${active ? 'bg-fd-orange-solid font-semibold text-white' : 'text-white/75 hover:bg-white/10'}`}
              >
                <i className={`fa-solid ${n.icon} text-xs`} /> {n.label}
              </Link>
            );
          })}
          <LogoutButton className="mr-auto flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-white/80 hover:bg-white/10" />
        </nav>
      </header>
      <div className="gbar-top sm:hidden px-4 py-1.5 text-xs text-fd-muted">
        الفريق: <span className="font-semibold text-fd-petrol">{teamName}</span>
      </div>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">{children}</main>
      <FieldFooter />
    </div>
  );
}
