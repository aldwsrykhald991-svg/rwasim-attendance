'use client';

// شاشة التحضير الميداني — مصممة للجوال أولاً: السرعة ثم الوضوح ثم الجمال.
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SheetRow } from '@/lib/field/data';
import type { AttendanceStatus } from '@/lib/field/db';
import { formatStamp, STATUS_LABEL } from '@/lib/field/format';
import { fieldApi } from './api';
import { AttendanceBadge, btn } from './ui';

interface Props {
  projectId: number;
  dayId: number;
  groupId: number;
  projectName: string;
  dayText: string;
  groupName: string;
  rows: SheetRow[];
  readOnly: boolean;
  readOnlyReason: string;
  memberName: string;
}

const CHOICES: { status: AttendanceStatus; label: string; on: string; icon: string }[] = [
  { status: 'PRESENT', label: 'حاضر', on: 'bg-emerald-700 border-emerald-700 text-white', icon: 'fa-check' },
  { status: 'ABSENT', label: 'غائب', on: 'bg-red-600 border-red-600 text-white', icon: 'fa-xmark' },
  { status: 'OTHER', label: 'أخرى', on: 'bg-amber-500 border-amber-500 text-slate-900', icon: 'fa-pen' },
];

const CARD_TONE: Record<AttendanceStatus, string> = {
  PRESENT: 'border-emerald-200',
  ABSENT: 'border-red-200',
  OTHER: 'border-amber-200',
  NOT_MARKED: 'border-fd-line',
};

/** توحيد الأحرف العربية للبحث: بلا تشكيل، والهمزات والتاء المربوطة والألف المقصورة موحّدة */
function norm(v: string): string {
  return v.replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase().trim();
}

interface Desired { status: AttendanceStatus; otherReason: string | null }

const SYNC_MS = 15000;

export default function AttendanceSheet(props: Props) {
  const { projectId, dayId, groupId, readOnly } = props;
  const [rows, setRows] = useState(props.rows);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [unsaved, setUnsaved] = useState<Set<number>>(new Set());
  const [online, setOnline] = useState(true);
  const [otherFor, setOtherFor] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [onlyRemaining, setOnlyRemaining] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState('');

  // آخر حالة مؤكدة من الخادم لكل طالب، وطابور «آخر حالة مطلوبة» لكل طالب
  const confirmed = useRef(new Map(props.rows.map(r => [r.studentId, r])));
  const queue = useRef(new Map<number, Desired>());
  const inflight = useRef(new Set<number>());
  const attempts = useRef(new Map<number, number>());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const marked = rows.filter(r => r.status !== 'NOT_MARKED').length;
  const total = rows.length;
  const remaining = total - marked;
  const visible = useMemo(() => {
    const q = norm(search);
    return rows.filter(r => (!onlyRemaining || r.status === 'NOT_MARKED') && (!q || norm(r.name).includes(q)));
  }, [rows, onlyRemaining, search]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  const setFlag = (setter: typeof setPending, id: number, on: boolean) =>
    setter(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });

  /**
   * يرسل آخر حالة مطلوبة للطالب، طلباً واحداً في كل مرة (لا تتسابق الطلبات).
   * عند انقطاع الشبكة تبقى الحالة ظاهرة مع علامة «لم يُحفظ» ويُعاد الإرسال تلقائياً.
   */
  const pump = useCallback(async (studentId: number) => {
    if (inflight.current.has(studentId)) return;
    inflight.current.add(studentId);
    try {
      while (queue.current.has(studentId)) {
        const want = queue.current.get(studentId)!;
        queue.current.delete(studentId);
        const res = await fieldApi('/api/field/attendance', { projectId, dayId, studentId, ...want });
        if (res.ok) {
          attempts.current.delete(studentId);
          setFlag(setUnsaved, studentId, false);
          setRows(rs => {
            const cur = rs.find(r => r.studentId === studentId);
            if (cur && !queue.current.has(studentId)) confirmed.current.set(studentId, cur);
            return rs;
          });
          continue;
        }
        if (res.retryable) {
          // لا نفقد اختيار المشرف: نعيده للطابور ما لم يختر حالة أحدث
          if (!queue.current.has(studentId)) queue.current.set(studentId, want);
          setFlag(setUnsaved, studentId, true);
          const n = (attempts.current.get(studentId) ?? 0) + 1;
          attempts.current.set(studentId, n);
          const delay = Math.min(30000, 2000 * 2 ** Math.min(n - 1, 4));
          clearTimeout(timers.current.get(studentId));
          timers.current.set(studentId, setTimeout(() => pump(studentId), delay));
          return;
        }
        // رفض من الخادم (صلاحية/أرشفة/جلسة): نرجع للحالة المؤكدة ونعرض السبب
        if (!queue.current.has(studentId)) {
          const back = confirmed.current.get(studentId);
          if (back) setRows(rs => rs.map(r => r.studentId === studentId ? back : r));
          setFlag(setUnsaved, studentId, false);
        }
        flash(res.status === 401 ? 'انتهت الجلسة، سجّل الدخول من جديد' : res.error);
      }
    } finally {
      inflight.current.delete(studentId);
      if (!queue.current.has(studentId)) setFlag(setPending, studentId, false);
    }
  }, [projectId, dayId]);

  function save(studentId: number, status: AttendanceStatus, otherReason: string | null = null) {
    const before = rows.find(r => r.studentId === studentId);
    if (!before) return;
    if (before.status === status && (before.otherReason ?? null) === otherReason) return;
    const now = new Date().toISOString();
    const isFirst = !before.recordedByName;
    setRows(rs => rs.map(r => r.studentId === studentId ? {
      ...r, status, otherReason,
      recordedByName: isFirst ? props.memberName : r.recordedByName, recordedAt: isFirst ? now : r.recordedAt,
      updatedByName: props.memberName, updatedAt: now,
    } : r));
    queue.current.set(studentId, { status, otherReason });
    setFlag(setPending, studentId, true);
    clearTimeout(timers.current.get(studentId));
    pump(studentId);
  }

  /** مزامنة مع الخادم: تُحدّث الطلاب الذين لا تغيير معلّق عليهم (لدعم أكثر من مشرف) */
  const sync = useCallback(async () => {
    const res = await fieldApi<{ rows: SheetRow[] }>(
      `/api/field/attendance?projectId=${projectId}&dayId=${dayId}&groupId=${groupId}`, undefined, 'GET');
    if (!res.ok) return false;
    const fresh = new Map(res.data.rows.map(r => [r.studentId, r]));
    const busy = (id: number) => queue.current.has(id) || inflight.current.has(id);
    for (const [id, r] of fresh) if (!busy(id)) confirmed.current.set(id, r);
    setRows(rs => {
      const kept = rs.filter(r => fresh.has(r.studentId) || busy(r.studentId)).map(r => (busy(r.studentId) ? r : fresh.get(r.studentId)!));
      const have = new Set(kept.map(r => r.studentId));
      const added = res.data.rows.filter(r => !have.has(r.studentId));
      return added.length ? [...kept, ...added].sort((x, y) => x.name.localeCompare(y.name, 'ar', { numeric: true, sensitivity: 'base' })) : kept;
    });
    return true;
  }, [projectId, dayId, groupId]);

  useEffect(() => {
    const retryAll = () => { for (const id of queue.current.keys()) { clearTimeout(timers.current.get(id)); pump(id); } };
    const onOnline = () => { setOnline(true); retryAll(); sync(); };
    const onOffline = () => setOnline(false);
    const onVisible = () => { if (document.visibilityState === 'visible') { retryAll(); sync(); } };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (queue.current.size || inflight.current.size) { e.preventDefault(); e.returnValue = ''; }
    };
    setOnline(navigator.onLine);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('beforeunload', onLeave);
    const tick = setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) sync(); }, SYNC_MS);
    const pendingTimers = timers.current;
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('beforeunload', onLeave);
      clearInterval(tick);
      for (const t of pendingTimers.values()) clearTimeout(t);
    };
  }, [pump, sync]);

  function tap(row: SheetRow, status: AttendanceStatus) {
    if (status === 'OTHER') {
      setOtherFor(row.studentId);
      setReason(row.status === 'OTHER' ? row.otherReason ?? '' : '');
      return;
    }
    if (otherFor === row.studentId) setOtherFor(null);
    save(row.studentId, status);
  }

  function saveOther(e: React.FormEvent) {
    e.preventDefault();
    if (otherFor == null || !reason.trim()) return;
    const id = otherFor;
    setOtherFor(null);
    save(id, 'OTHER', reason.trim());
  }

  async function markAllPresent() {
    setBulkBusy(true);
    const res = await fieldApi<{ changed: number }>('/api/field/attendance/all-present', { projectId, dayId, groupId });
    setBulkBusy(false);
    setConfirmAll(false);
    if (!res.ok) return flash(res.error);
    // نقرأ النتيجة من الخادم بدل تخمينها محلياً (قد يكون مشرف آخر غيّر حالات في الأثناء)
    const synced = await sync();
    if (!synced) {
      const now = new Date().toISOString();
      setRows(rs => rs.map(r => r.status === 'NOT_MARKED' && !queue.current.has(r.studentId) ? {
        ...r, status: 'PRESENT', otherReason: null,
        recordedByName: r.recordedByName ?? props.memberName, recordedAt: r.recordedAt ?? now,
        updatedByName: props.memberName, updatedAt: now,
      } : r));
    }
    flash(`تم تسجيل ${res.data.changed} طالب كحاضرين`);
  }

  const waiting = unsaved.size;

  return (
    <div className="pb-28" data-fx="off">
      <Link href={`/field/projects/${projectId}/days/${dayId}`} className="mb-2 inline-flex items-center gap-1.5 text-sm text-fd-muted hover:text-fd-petrol">
        <i className="fa-solid fa-arrow-right text-xs" /> المجموعات
      </Link>
      <div className="text-xs text-fd-muted">{props.projectName} • {props.dayText}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-fd-petrol">{props.groupName}</h1>
        {total > 0 && remaining === 0 && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700"><i className="fa-solid fa-circle-check ml-1" />اكتمل التحضير</span>
        )}
      </div>
      <p className="mt-1 text-fd-petrol">تم تحضير <b>{marked}</b> من <b>{total}</b> {total === 1 ? 'طالب' : 'طلاب'}</p>

      {readOnly && props.readOnlyReason && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <i className="fa-solid fa-lock ml-1" />{props.readOnlyReason}
        </div>
      )}

      {!readOnly && (!online || waiting > 0) && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status" aria-live="polite">
          <i className="fa-solid fa-wifi ml-1" />
          {!online ? 'لا يوجد اتصال بالإنترنت.' : 'الاتصال ضعيف.'}
          {waiting > 0
            ? ` ${waiting} ${waiting === 1 ? 'تغيير' : 'تغييرات'} لم تُحفظ بعد، وستُحفظ تلقائياً عند عودة الاتصال. لا تغلق الصفحة.`
            : ' يمكنك المتابعة وستُحفظ التغييرات عند عودة الاتصال.'}
        </div>
      )}

      {total > 8 && (
        <div className="mt-4">
          <label className="sr-only" htmlFor="student-search">بحث باسم الطالب</label>
          <input id="student-search" type="search" inputMode="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ابحث باسم الطالب" autoComplete="off"
            className="w-full rounded-xl border border-fd-line bg-white px-4 py-3 text-slate-800 outline-none focus:border-fd-teal focus:ring-2 focus:ring-fd-teal/20" />
        </div>
      )}

      {total > 0 && (
        <div className="mt-4 flex gap-2 text-sm">
          <button type="button" onClick={() => setOnlyRemaining(false)}
            className={`rounded-full px-3.5 py-1.5 font-semibold ${!onlyRemaining ? 'bg-fd-petrol text-white' : 'bg-white text-fd-muted ring-1 ring-fd-line'}`}>
            الكل ({total})
          </button>
          <button type="button" onClick={() => setOnlyRemaining(true)}
            className={`rounded-full px-3.5 py-1.5 font-semibold ${onlyRemaining ? 'bg-fd-petrol text-white' : 'bg-white text-fd-muted ring-1 ring-fd-line'}`}>
            لم يُحضَّروا ({remaining})
          </button>
        </div>
      )}

      <ul className="mt-3 space-y-2.5">
        {total === 0 && <li className="rounded-2xl border border-dashed border-fd-line bg-white p-6 text-center text-sm text-fd-muted">لا يوجد طلاب في هذه المجموعة.</li>}
        {onlyRemaining && !search && total > 0 && remaining === 0 && (
          <li className="rounded-2xl bg-emerald-50 p-6 text-center text-sm font-semibold text-emerald-700">تم تحضير جميع الطلاب ✓</li>
        )}
        {search && visible.length === 0 && total > 0 && (
          <li className="rounded-2xl border border-dashed border-fd-line bg-white p-6 text-center text-sm text-fd-muted">لا يوجد طالب بهذا الاسم في المجموعة.</li>
        )}
        {visible.map(r => {
          const busy = pending.has(r.studentId);
          const editingOther = otherFor === r.studentId;
          return (
            <li key={r.studentId} className={`gcard-tone rounded-2xl border-2 p-3.5 transition ${CARD_TONE[r.status]}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[17px] font-bold leading-snug text-fd-petrol">{r.name}</div>
                  {r.status === 'OTHER' && r.otherReason && !editingOther && (
                    <div className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-sm text-amber-800">{r.otherReason}</div>
                  )}
                  {r.updatedByName && r.status !== 'NOT_MARKED' && (
                    <div className="mt-1 text-[11px] text-fd-muted">
                      {r.updatedByName} • {formatStamp(r.updatedAt)}
                      {r.recordedByName && r.recordedByName !== r.updatedByName && <> (أول تحضير: {r.recordedByName})</>}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {unsaved.has(r.studentId) ? (
                    <button type="button" onClick={() => { clearTimeout(timers.current.get(r.studentId)); pump(r.studentId); }}
                      className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-300">
                      لم يُحفظ • إعادة
                    </button>
                  ) : busy ? (
                    <span className="text-xs text-fd-muted" role="status">جارٍ الحفظ…</span>
                  ) : null}
                  {readOnly || r.status === 'NOT_MARKED' ? <AttendanceBadge status={r.status} /> : null}
                </div>
              </div>

              {!readOnly && (
                <>
                  <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={`حالة ${r.name}`}>
                    {CHOICES.map(c => {
                      const on = r.status === c.status || (editingOther && c.status === 'OTHER');
                      return (
                        <button key={c.status} type="button" role="radio" aria-checked={on} onClick={() => tap(r, c.status)}
                          className={`flex h-12 items-center justify-center gap-1.5 rounded-xl border-2 text-[15px] font-bold transition ${on ? `${c.on} gpop` : 'border-fd-line bg-white text-slate-600 active:bg-slate-50'}`}>
                          <i className={`fa-solid ${c.icon} text-sm`} /> {c.label}
                        </button>
                      );
                    })}
                  </div>

                  {editingOther && (
                    <form onSubmit={saveOther} className="mt-2.5">
                      <label className="sr-only" htmlFor={`reason-${r.studentId}`}>السبب</label>
                      <textarea id={`reason-${r.studentId}`} autoFocus rows={2} maxLength={300} value={reason}
                        onChange={e => setReason(e.target.value)} placeholder="اكتب السبب"
                        className="w-full rounded-xl border-2 border-amber-300 bg-white px-3 py-2.5 outline-none focus:border-amber-500" />
                      <div className="mt-2 flex gap-2">
                        <button className="flex-1 rounded-xl bg-amber-500 py-3 font-bold text-slate-900 disabled:opacity-40" disabled={!reason.trim()}>
                          حفظ «أخرى»
                        </button>
                        <button type="button" className="rounded-xl border border-fd-line px-4 py-3 text-fd-muted" onClick={() => setOtherFor(null)}>إلغاء</button>
                      </div>
                      {!reason.trim() && <p className="mt-1 text-xs text-amber-700">كتابة السبب إلزامية لحفظ حالة «أخرى».</p>}
                    </form>
                  )}

                  {r.status !== 'NOT_MARKED' && !editingOther && (
                    <button type="button" onClick={() => save(r.studentId, 'NOT_MARKED')}
                      className="mt-2 text-xs text-fd-muted underline-offset-2 hover:underline">
                      إرجاع إلى «{STATUS_LABEL.NOT_MARKED}»
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {!readOnly && total > 0 && (
        <div className="gbar fixed inset-x-0 bottom-0 z-20 px-4 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-fd-muted">{remaining ? `متبقي ${remaining}` : 'اكتمل التحضير ✓'}</div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`gbarfill h-full rounded-full transition-all duration-500 ${remaining ? 'bg-fd-orange' : 'bg-emerald-500'}`} style={{ width: `${total ? (marked / total) * 100 : 0}%` }} />
              </div>
            </div>
            <button type="button" className={`${btn.dark} py-3`} disabled={remaining === 0} onClick={() => setConfirmAll(true)}>
              <i className="fa-solid fa-check-double" /> تحضير الجميع حاضر
            </button>
          </div>
        </div>
      )}

      {confirmAll && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-fd-petrol">تحضير الجميع حاضر</h2>
            <p className="mt-2 text-slate-700">هل تريد تسجيل جميع طلاب المجموعة كحاضرين؟</p>
            {marked > 0 && (
              <p className="mt-2 text-sm text-fd-muted">سيُسجَّل {remaining} طالب لم يُحضَّروا بعد، ولن تتغير الحالات المحددة مسبقاً.</p>
            )}
            <div className="mt-5 flex gap-2">
              <button type="button" className={`${btn.primary} flex-1`} disabled={bulkBusy} onClick={markAllPresent}>
                {bulkBusy ? 'جارٍ التسجيل…' : 'نعم، سجّلهم حاضرين'}
              </button>
              <button type="button" className={btn.ghost} disabled={bulkBusy} onClick={() => setConfirmAll(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4" role="status">
          <div className="rounded-xl bg-fd-petrol px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
}
