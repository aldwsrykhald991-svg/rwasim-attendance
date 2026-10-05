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
        {/* سديم: ألوان الهوية تدور في مدارات حول مركز الشاشة */}
        <i className="gneb gneb-1" /><i className="gneb gneb-2" /><i className="gneb gneb-3" /><i className="gneb gneb-4" />
        {/* مدارات رفيعة عليها كواكب صغيرة */}
        <b className="gorbit gorbit-1"><em /></b><b className="gorbit gorbit-2"><em /></b><b className="gorbit gorbit-3"><em /></b>
        {/* نجوم تومض */}
        {Array.from({ length: 16 }, (_, i) => <u key={i} className="gstar" style={{ top: `${(i * 37 + 9) % 97}%`, left: `${(i * 53 + 5) % 96}%`, animationDelay: `${-(i * 0.47).toFixed(2)}s` }} />)}
      </div>
      <div className="relative z-10">{children}</div>
      <FloatingFx />
    </div>
  );
}
