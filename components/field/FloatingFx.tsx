'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Motion, reduced } from '@/lib/field/motion';

/** يُشغّل الهوية العائمة (طفو، ميلان، وهج، مؤشر زجاجي) ويعيد تهيئتها عند تغيّر الصفحة. */
export default function FloatingFx() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.setAttribute('data-rw-cursor', '');
    const id = requestAnimationFrame(() => Motion.init(document));
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  return null;
}

/** مفتاح «الحركة: تشغيل / إيقاف» — يُحفظ في المتصفح. */
export function MotionSwitch() {
  const [on, setOn] = useState(true);
  const [lock, setLock] = useState(false);
  useEffect(() => { setOn(Motion.isOn()); setLock(reduced()); }, []);
  return (
    <button
      type="button" role="switch" aria-checked={on} disabled={lock}
      title={lock ? 'إعدادات جهازك تُوقف الحركة' : undefined}
      onClick={() => { const n = !on; setOn(n); Motion.set(n); }}
      className="flex w-full items-center justify-between gap-3 text-right disabled:opacity-60"
    >
      <span>
        <span className="block font-semibold text-fd-petrol">الحركة: تشغيل / إيقاف</span>
        <span className="block text-xs text-fd-muted">الطفو والميلان والوهج والمؤشر الزجاجي. شاشة التحضير بلا حركة دائمًا.</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-fd-teal' : 'bg-slate-500'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'right-[22px]' : 'right-0.5'}`} />
      </span>
    </button>
  );
}
