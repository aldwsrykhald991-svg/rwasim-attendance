import Link from 'next/link';
import type { ProjectSummary } from '@/lib/field/data';
import { formatDay } from '@/lib/field/format';
import { ProjectStatusBadge } from './ui';

export function dateRange(first: string | null, last: string | null): string {
  if (!first) return '—';
  return first === last || !last ? formatDay(first) : `${formatDay(first)} — ${formatDay(last)}`;
}

export default function ProjectCard({ p }: { p: ProjectSummary }) {
  return (
    <Link href={`/field/projects/${p.id}`}
      className="gcard rw-fx-float rw-fx-glow group block rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-fd-petrol group-hover:text-fd-petrol-2">{p.name}</h3>
        <ProjectStatusBadge status={p.status} />
      </div>
      <div className="mt-1 text-sm text-fd-muted">
        <i className="fa-regular fa-calendar ml-1 text-xs text-fd-teal" />{dateRange(p.firstDate, p.lastDate)}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fd-muted">
        <span><b className="text-fd-petrol">{p.dayCount}</b> {p.dayCount === 1 ? 'يوم' : 'أيام'}</span>
        <span><b className="text-fd-petrol">{p.groupCount}</b> مجموعات</span>
        <span><b className="text-fd-petrol">{p.participantCount}</b> طالب</span>
      </div>
    </Link>
  );
}
