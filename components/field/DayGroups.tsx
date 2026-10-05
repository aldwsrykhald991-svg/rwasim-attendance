'use client';

// مجموعات اليوم: الضغط على المجموعة يعرض أسماء طلابها تحتها مع حالة كل طالب
import Link from 'next/link';
import { useState } from 'react';
import { progressOf } from '@/lib/field/format';
import { AttendanceBadge, Bar, btn } from './ui';

export interface DayGroup {
  id: number;
  name: string;
  total: number;
  marked: number;
  students: { studentId: number; name: string; status: string; otherReason: string | null }[];
}

export default function DayGroups({ projectId, dayId, groups }: { projectId: number; dayId: number; groups: DayGroup[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const allOpen = groups.length > 0 && open.size === groups.length;

  function toggle(id: number) {
    setOpen(o => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  return (
    <div>
      {groups.length > 1 && (
        <div className="mb-2 flex justify-end">
          <button type="button" className="text-sm font-semibold text-fd-teal"
            onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map(g => g.id)))}>
            {allOpen ? 'إخفاء الأسماء' : 'عرض أسماء كل المجموعات'}
          </button>
        </div>
      )}
      <div className="grid items-start gap-3 sm:grid-cols-2">
        {groups.map(g => {
          const prog = progressOf(g.marked, g.total);
          const isOpen = open.has(g.id);
          const left = g.total - g.marked;
          return (
            <div key={g.id} className={`gcard rw-fx-float rounded-2xl ${prog === 'DONE' ? 'gcard-done' : ''}`}>
              <button type="button" onClick={() => toggle(g.id)} aria-expanded={isOpen}
                className="block w-full p-4 text-right">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-lg font-bold text-fd-petrol">
                    <i className={`fa-solid fa-chevron-down text-xs text-fd-muted transition ${isOpen ? 'rotate-180' : ''}`} />
                    {g.name}
                  </div>
                  <span className="text-sm font-semibold text-fd-petrol">{g.marked} / {g.total}</span>
                </div>
                <div className="my-3"><Bar value={g.marked} total={g.total} tone={prog === 'DONE' ? 'green' : 'orange'} /></div>
                <div className="flex items-center justify-between text-sm">
                  {prog === 'DONE' ? (
                    <span className="font-semibold text-emerald-700"><i className="fa-solid fa-circle-check ml-1" />اكتمل التحضير</span>
                  ) : prog === 'IN_PROGRESS' ? (
                    <span className="font-semibold text-amber-700">متبقي {left} {left === 1 ? 'طالب' : 'طلاب'}</span>
                  ) : (
                    <span className="text-fd-muted">{g.total ? 'لم يبدأ' : 'لا يوجد طلاب'}</span>
                  )}
                  <span className="text-xs text-fd-muted">{isOpen ? 'إخفاء الأسماء' : 'اضغط لعرض الأسماء'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-fd-line px-4 pb-4 pt-2">
                  {g.students.length === 0 ? (
                    <p className="py-2 text-sm text-fd-muted">لا يوجد طلاب في هذه المجموعة.</p>
                  ) : (
                    <ol className="divide-y divide-fd-line">
                      {g.students.map((s, i) => (
                        <li key={s.studentId} className="flex items-center justify-between gap-2 py-2">
                          <span className="min-w-0 text-fd-petrol">
                            <span className="ml-2 inline-block w-5 text-xs text-fd-muted">{i + 1}</span>
                            {s.name}
                            {s.status === 'OTHER' && s.otherReason && <span className="mr-2 text-xs text-amber-700">({s.otherReason})</span>}
                          </span>
                          <AttendanceBadge status={s.status} />
                        </li>
                      ))}
                    </ol>
                  )}
                  <Link href={`/field/projects/${projectId}/days/${dayId}/groups/${g.id}`} className={`${btn.primary} mt-3 w-full`}>
                    <i className="fa-solid fa-clipboard-check" /> {prog === 'DONE' ? 'فتح المجموعة' : 'تحضير المجموعة'}
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
