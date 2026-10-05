import type { Metadata } from 'next';
import FloatingFx from '@/components/field/FloatingFx';

export const metadata: Metadata = {
  title: 'منصة التحضير الميداني',
  description: 'منصة لإدارة التحضير الميداني للمشاريع والبرامج',
};

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen text-slate-800">
      <div aria-hidden className="gsky">
        <span className="gsky-a" /><span className="gsky-b" /><span className="gsky-c" />
      </div>
      <div className="relative z-10">{children}</div>
      <FloatingFx />
    </div>
  );
}
