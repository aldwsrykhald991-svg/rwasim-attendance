export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-label="جارٍ التحميل">
      <div className="h-8 w-40 rounded-lg bg-slate-200" />
      <div className="h-28 rounded-2xl bg-slate-200" />
      <div className="h-20 rounded-2xl bg-slate-200" />
      <div className="h-20 rounded-2xl bg-slate-200" />
    </div>
  );
}
