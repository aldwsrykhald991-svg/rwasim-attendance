'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROJECT_STATUS_LABEL } from '@/lib/field/format';
import { fieldApi } from './api';

const ORDER = ['UPCOMING', 'ACTIVE', 'FINISHED'] as const;

export default function ProjectStatusControl({ projectId, status }: { projectId: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    if (next === status) return;
    const msg = next === 'FINISHED'
      ? 'سيُنقل المشروع إلى الأرشيف ويُقفل الحضور والتعديل عليه. متابعة؟'
      : status === 'FINISHED'
        ? 'إعادة فتح المشروع تسمح بتعديل حضوره وبياناته مرة أخرى. متابعة؟'
        : `تغيير حالة المشروع إلى «${PROJECT_STATUS_LABEL[next]}»؟`;
    if (!confirm(msg)) return;
    setBusy(true);
    const r = await fieldApi(`/api/field/projects/${projectId}`, { action: 'update', status: next }, 'PATCH');
    setBusy(false);
    if (!r.ok) return alert(r.error);
    router.refresh();
  }

  return (
    <div className="inline-flex rounded-xl border border-fd-line bg-white p-1 text-sm" role="radiogroup" aria-label="حالة المشروع">
      {ORDER.map(s => (
        <button key={s} type="button" role="radio" aria-checked={s === status} disabled={busy} onClick={() => change(s)}
          className={`rounded-lg px-3.5 py-1.5 font-semibold transition ${s === status
            ? s === 'ACTIVE' ? 'bg-fd-orange-solid text-white' : s === 'FINISHED' ? 'bg-slate-600 text-white' : 'bg-fd-teal text-white'
            : 'text-fd-muted hover:bg-fd-bg'}`}>
          {PROJECT_STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}
