'use client';

// استيراد سجل الطلاب ومجموعاتهم: ملف Excel/CSV أو نص ملصوق ← معاينة ← اعتماد
import { useMemo, useRef, useState } from 'react';
import { analyzeRows, fileToRows, summarize, textToRows, toEntries, type ParsedTable, type RosterEntry } from '@/lib/field/roster-import';
import { btn, input } from './ui';

const colLetter = (i: number) => String.fromCharCode(65 + (i % 26));

export default function RosterImport({ onApply, busy = false, applyLabel = 'اعتماد السجل', noGroupNote }: {
  onApply: (entries: RosterEntry[]) => void | Promise<void>;
  busy?: boolean;
  applyLabel?: string;
  noGroupNote?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [text, setText] = useState('');
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [fileName, setFileName] = useState('');
  const [nameCol, setNameCol] = useState(0);
  const [groupCol, setGroupCol] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  function load(rows: string[][]) {
    const t = analyzeRows(rows);
    if (!t.rows.length && !t.grouped?.length) { setTable(null); return setError('لم أجد أسماء في السجل'); }
    setError('');
    setTable(t);
    setNameCol(t.nameCol);
    setGroupCol(t.groupCol);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setFileName(f.name);
    try {
      load(await fileToRows(f));
    } catch (e) {
      setTable(null);
      const msg = e instanceof Error && /[\u0600-\u06FF]/.test(e.message) ? e.message : '';
      setError(msg || 'تعذرت قراءة الملف. استخدم ملف Excel (‎.xlsx‎) أو CSV، أو الصق الأسماء نصاً.');
    }
  }

  const entries = useMemo(() => (table ? toEntries(table, nameCol, groupCol) : []), [table, nameCol, groupCol]);
  const sum = useMemo(() => summarize(entries), [entries]);
  const headerLabel = (i: number) => (table?.header?.[i] ? `${table.header[i]}` : `العمود ${colLetter(i)}`);
  const sample = (i: number) => table?.rows.slice(0, 2).map(r => r[i]).filter(Boolean).join('، ');

  function reset() {
    setTable(null); setText(''); setFileName(''); setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div>
      {!table && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-fd-bg p-1 text-sm">
            {(['file', 'paste'] as const).map(m => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(''); }}
                className={`rounded-lg py-2 font-semibold ${mode === m ? 'bg-white text-fd-petrol shadow-sm' : 'text-fd-muted'}`}>
                {m === 'file' ? 'رفع ملف Excel / CSV' : 'لصق نص'}
              </button>
            ))}
          </div>
          {mode === 'file' ? (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-fd-teal/40 bg-fd-teal/5 px-4 py-6 text-center hover:border-fd-teal">
              <i className="fa-solid fa-file-excel text-2xl text-fd-teal" />
              <span className="font-semibold text-fd-petrol">{fileName || 'اختر ملف السجل'}</span>
              <span className="text-xs text-fd-muted">ملف فيه عمود للاسم وعمود للمجموعة — يتعرف النظام عليهما تلقائياً</span>
              <input ref={fileRef} type="file" className="sr-only" accept=".xlsx,.csv,.txt"
                onChange={e => onFile(e.target.files?.[0])} />
            </label>
          ) : (
            <>
              <textarea className={input} rows={6} value={text} onChange={e => setText(e.target.value)}
                placeholder={'الصق من Excel مباشرة، أو اكتب:\nأحمد علي - عزم\nسالم فهد - موج\n\nأو بالعناوين:\nمجموعة عزم:\nأحمد علي\nسالم فهد'} />
              <button type="button" className={`${btn.dark} mt-2`} disabled={!text.trim()} onClick={() => load(textToRows(text))}>
                <i className="fa-solid fa-wand-magic-sparkles" /> تحليل السجل
              </button>
            </>
          )}
        </>
      )}

      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {table && (
        <div>
          {!table.grouped && table.columns > 1 && (
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-fd-petrol">عمود اسم الطالب</span>
                <select className={input} value={nameCol} onChange={e => setNameCol(Number(e.target.value))}>
                  {Array.from({ length: table.columns }, (_, i) => (
                    <option key={i} value={i}>{headerLabel(i)} — {sample(i)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-fd-petrol">عمود المجموعة</span>
                <select className={input} value={groupCol ?? -1} onChange={e => setGroupCol(Number(e.target.value) < 0 ? null : Number(e.target.value))}>
                  <option value={-1}>لا يوجد عمود مجموعة</option>
                  {Array.from({ length: table.columns }, (_, i) => i).filter(i => i !== nameCol).map(i => (
                    <option key={i} value={i}>{headerLabel(i)} — {sample(i)}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="rounded-xl bg-fd-bg p-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span><b className="text-fd-petrol">{sum.unique}</b> طالب</span>
              <span><b className="text-fd-petrol">{sum.groups.length}</b> مجموعات</span>
              {sum.duplicates > 0 && <span className="text-amber-700">{sum.duplicates} اسم مكرر (يُضاف مرة واحدة)</span>}
              {sum.noGroup > 0 && <span className="text-amber-700">{sum.noGroup} بدون مجموعة</span>}
            </div>
            {sum.noGroup > 0 && noGroupNote && <p className="mt-1 text-xs text-amber-700">{noGroupNote}</p>}
            <div className="mt-3 space-y-1.5">
              {sum.groups.map(g => (
                <div key={g.name} className="rounded-lg bg-white">
                  <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-right text-sm"
                    onClick={() => setOpenGroup(openGroup === g.name ? null : g.name)}>
                    <span className="font-semibold text-fd-petrol">{g.name}</span>
                    <span className="text-xs text-fd-muted">{g.students.length} طالب <i className={`fa-solid fa-chevron-down mr-1 transition ${openGroup === g.name ? 'rotate-180' : ''}`} /></span>
                  </button>
                  {openGroup === g.name && (
                    <ol className="px-3 pb-2 text-sm text-slate-700">
                      {g.students.map((n, i) => <li key={n}><span className="ml-2 inline-block w-5 text-xs text-fd-muted">{i + 1}</span>{n}</li>)}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button type="button" className={`${btn.primary} flex-1`} disabled={busy || sum.unique === 0} onClick={() => onApply(entries)}>
              {busy ? 'جارٍ الاستيراد…' : `${applyLabel} (${sum.unique} طالب)`}
            </button>
            <button type="button" className={btn.ghost} disabled={busy} onClick={reset}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
