import type { Metadata } from 'next';
import FloatingFx from '@/components/field/FloatingFx';

export const metadata: Metadata = {
  title: 'منصة التحضير الميداني',
  description: 'منصة لإدارة التحضير الميداني للمشاريع والبرامج',
};

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-fd-bg text-slate-800">{children}<FloatingFx /></div>;
}
