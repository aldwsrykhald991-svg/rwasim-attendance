'use client';

import { useEffect } from 'react';

export default function FieldError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-fd-petrol">حدث خطأ غير متوقع</h1>
      <p className="mt-2 max-w-sm text-sm text-fd-muted">
        لم نتمكن من عرض هذه الصفحة. بياناتك المحفوظة لم تتأثر. تحقق من اتصالك ثم أعد المحاولة.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-fd-muted" dir="ltr">{error.digest}</p>}
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => retry()}
          className="rounded-xl bg-fd-orange-solid px-5 py-3 font-semibold text-white hover:bg-fd-orange-dark">
          إعادة المحاولة
        </button>
        <a href="/field/home" className="rounded-xl border border-fd-line bg-white px-5 py-3 font-medium text-fd-petrol">الرئيسية</a>
      </div>
    </div>
  );
}
