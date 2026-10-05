'use client';

import { useRouter } from 'next/navigation';
import { fieldApi } from './api';

export default function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (!confirm('تسجيل الخروج من حساب الفريق؟')) return;
        await fieldApi('/api/field/auth/logout', {});
        router.replace('/field');
        router.refresh();
      }}
    >
      <i className="fa-solid fa-arrow-right-from-bracket" /> خروج
    </button>
  );
}
