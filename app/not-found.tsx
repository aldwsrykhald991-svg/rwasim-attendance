import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-fd-petrol">الصفحة غير موجودة</h1>
      <p className="mt-2 max-w-sm text-sm text-fd-muted">
        ربما حُذف هذا العنصر أو أن الرابط يخص فريقاً آخر.
      </p>
      <Link href="/field/home" className="mt-5 rounded-xl bg-fd-orange-solid px-5 py-3 font-semibold text-white hover:bg-fd-orange-dark">
        العودة إلى الرئيسية
      </Link>
    </div>
  );
}
