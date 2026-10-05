// أدوات عرض مشتركة بين الخادم والواجهة (بدون أي وصول لقاعدة البيانات)

export const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'حاضر',
  ABSENT: 'غائب',
  NOT_MARKED: 'لم يتم التحضير',
  OTHER: 'أخرى',
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  UPCOMING: 'قادم',
  ACTIVE: 'جارٍ',
  FINISHED: 'منتهٍ',
};

const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

export function dayOrdinal(index: number): string {
  return index < ORDINALS.length ? `اليوم ${ORDINALS[index]}` : `اليوم ${index + 1}`;
}

/** "اليوم الثاني — أجرّب بشجاعة" */
export function dayLabel(index: number, name?: string | null): string {
  const base = dayOrdinal(index);
  return name ? `${base} — ${name}` : base;
}

const dateFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const dateFmtFull = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateTimeFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Riyadh',
});

/** "12 أكتوبر" من YYYY-MM-DD */
export function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : dateFmt.format(d);
}

export function formatDayFull(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : dateFmtFull.format(d);
}

/** يحوّل datetime('now') من SQLite (UTC بدون منطقة) إلى نص محلي */
export function formatStamp(sqliteUtc: string | null | undefined): string {
  if (!sqliteUtc) return '';
  const d = new Date(sqliteUtc.includes('T') ? sqliteUtc : `${sqliteUtc.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? sqliteUtc : dateTimeFmt.format(d);
}

export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export type Progress = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';

export function progressOf(marked: number, total: number): Progress {
  if (total > 0 && marked >= total) return 'DONE';
  if (marked > 0) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}
