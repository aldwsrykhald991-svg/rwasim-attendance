'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Motion } from '@/lib/field/motion';

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
