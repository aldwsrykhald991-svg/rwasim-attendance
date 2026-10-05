'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Motion } from '@/lib/field/motion';

/** يُشغّل الهوية العائمة (طفو، ميلان، وهج) ويعيد تهيئتها عند تغيّر الصفحة. */
export default function FloatingFx() {
  const pathname = usePathname();
  useEffect(() => {
    // الهالة التي كانت تتبع المؤشر وتكبر حول الأزرار أُزيلت بطلب صاحب المنصة
    document.documentElement.removeAttribute('data-rw-cursor');
    const id = requestAnimationFrame(() => Motion.init(document));
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  return null;
}
