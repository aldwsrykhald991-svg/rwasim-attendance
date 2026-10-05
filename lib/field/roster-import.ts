// تحليل سجل الطلاب ومجموعاتهم من ملف (Excel/CSV) أو نص ملصوق.
// يتعرف تلقائياً على عمود الاسم وعمود المجموعة، ويدعم كذلك القوائم المقسمة
// بعناوين مثل «مجموعة عزم:» يتبعها أسماء الطلاب سطراً سطراً.

export interface RosterEntry { name: string; group: string | null }

export interface ParsedTable {
  rows: string[][];           // الصفوف بعد إزالة العنوان
  header: string[] | null;    // صف العناوين إن وُجد
  columns: number;            // عدد الأعمدة
  nameCol: number;            // العمود المقترح للاسم
  groupCol: number | null;    // العمود المقترح للمجموعة (null = لا يوجد)
  grouped: RosterEntry[] | null; // إن كان النص قائمة مقسمة بعناوين مجموعات
}

// عناوين الأعمدة تُطابق الخلية كاملة (حتى لا يُعتبر اسم مثل «باسم الاسمري» عنواناً)
const NAME_HEADER = /^(?:ال)?(?:اسم|أسماء|اسماء)(?:\s+(?:ال)?(?:طالب|طلاب|مشارك|مشاركين|رباعي|كامل|الثلاثي))*$|^(?:full\s*)?(?:student\s*)?name$|^student$/i;
const GROUP_HEADER = /^(?:ال)?(?:مجموعة|مجموعه|مجموعات|فريق|فرقة|أسرة|اسرة)(?:\s+.{0,15})?$|^(?:group|team|squad)(?:\s*name)?$/i;
const GROUP_LINE = /^\s*(?:ال)?(?:مجموعة|فريق|فرقة|أسرة|اسرة|group|team)\s*[:：\-–—]?\s*(.+?)\s*[:：]?\s*$/i;

const AR_DIGITS: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

export function cleanCell(v: unknown): string {
  return String(v ?? '').replace(/[‏‎ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** يزيل الترقيم في بداية الاسم مثل «1-» أو «٣)» أو «- » */
export function cleanName(v: string): string {
  return cleanCell(v).replace(/^[\d٠-٩]+\s*[-.)\]ـ:]\s*/, '').replace(/^[-•*·]\s*/, '').trim();
}

function isNumberish(v: string): boolean {
  const s = v.replace(/[٠-٩]/g, d => AR_DIGITS[d]).trim();
  return s !== '' && /^[\d\s.\-/+]+$/.test(s);
}

/** تقسيم النص الملصوق إلى صفوف وأعمدة */
export function textToRows(text: string): string[][] {
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
  const sep = lines.some(l => l.includes('\t')) ? /\t/
    : lines.filter(l => /[,،;|]/.test(l)).length >= lines.length / 2 ? /[,،;|]/
    : lines.filter(l => /\s[-–—]\s/.test(l)).length >= lines.length / 2 ? /\s[-–—]\s/
    : null;
  return lines.map(l => (sep ? l.split(sep) : [l]).map(cleanCell));
}

function parseGroupedList(rows: string[][]): RosterEntry[] | null {
  const lines = rows.map(r => r.filter(Boolean).join(' '));
  const isHeader = (l: string) => /[:：]\s*$/.test(l) || GROUP_LINE.test(l);
  const headers = lines.filter(isHeader).length;
  if (headers === 0 || headers === lines.length) return null;
  const out: RosterEntry[] = [];
  let current: string | null = null;
  for (const l of lines) {
    if (isHeader(l)) {
      const m = l.match(GROUP_LINE);
      current = cleanCell((m ? m[1] : l).replace(/[:：]\s*$/, '')) || null;
    } else {
      const name = cleanName(l);
      if (name) out.push({ name, group: current });
    }
  }
  return out;
}

export function analyzeRows(input: string[][]): ParsedTable {
  const raw = input.map(r => r.map(cleanCell)).filter(r => r.some(Boolean));
  const columns = Math.max(0, ...raw.map(r => r.length));

  if (columns <= 1) {
    return { rows: raw, header: null, columns: 1, nameCol: 0, groupCol: null, grouped: parseGroupedList(raw) };
  }

  // صف العناوين: أول صف فيه كلمة «اسم» أو «مجموعة»
  let header: string[] | null = null;
  let body = raw;
  const hIdx = raw.slice(0, 5).findIndex(r => r.some(c => NAME_HEADER.test(c) || GROUP_HEADER.test(c)) && !r.some(c => c.length > 40));
  if (hIdx >= 0) {
    header = raw[hIdx];
    body = raw.slice(hIdx + 1);
  }

  let nameCol = header ? header.findIndex(c => NAME_HEADER.test(c) && !GROUP_HEADER.test(c)) : -1;
  let groupCol = header ? header.findIndex(c => GROUP_HEADER.test(c)) : -1;

  // تخمين بالمحتوى عند غياب العناوين
  const stats = Array.from({ length: columns }, (_, i) => {
    const vals = body.map(r => r[i] ?? '').filter(Boolean);
    const textual = vals.filter(v => !isNumberish(v));
    const distinct = new Set(textual.map(v => v.toLowerCase())).size;
    return {
      i,
      textual: vals.length ? textual.length / vals.length : 0,
      fill: body.length ? vals.length / body.length : 0,
      distinctRatio: textual.length ? distinct / textual.length : 1,
      avgLen: textual.length ? textual.reduce((s, v) => s + v.length, 0) / textual.length : 0,
    };
  });
  const candidates = stats.filter(s => s.textual > 0.7 && s.fill > 0.5);
  if (nameCol < 0) {
    const pool = candidates.filter(c => c.i !== groupCol);
    nameCol = (pool.sort((a, b) => b.distinctRatio * b.avgLen - a.distinctRatio * a.avgLen)[0] ?? stats[0]).i;
  }
  if (groupCol < 0) {
    // عمود المجموعة = العمود النصي الأكثر تكراراً في قيمه (أسماء المجموعات تتكرر، أسماء الطلاب لا)
    const best = candidates.filter(c => c.i !== nameCol).sort((a, b) => a.distinctRatio - b.distinctRatio)[0];
    groupCol = best && (best.distinctRatio < 0.85 || body.length < 4) && best.avgLen <= 30 ? best.i : -1;
  }
  return { rows: body, header, columns, nameCol, groupCol: groupCol >= 0 ? groupCol : null, grouped: null };
}

export function toEntries(t: ParsedTable, nameCol: number, groupCol: number | null): RosterEntry[] {
  if (t.grouped) return t.grouped;
  return t.rows
    .map(r => ({ name: cleanName(r[nameCol] ?? ''), group: groupCol == null ? null : cleanCell(r[groupCol] ?? '') || null }))
    .filter(e => e.name.length >= 2 && !isNumberish(e.name));
}

/** ملخص للمعاينة: المجموعات بترتيب ظهورها وعدد طلاب كل منها */
export function summarize(entries: RosterEntry[]) {
  const groups = new Map<string, { name: string; students: string[] }>();
  const seen = new Set<string>();
  let duplicates = 0;
  let noGroup = 0;
  for (const e of entries) {
    const key = e.name.toLowerCase();
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    if (!e.group) { noGroup++; continue; }
    const gk = e.group.toLowerCase();
    if (!groups.has(gk)) groups.set(gk, { name: e.group, students: [] });
    groups.get(gk)!.students.push(e.name);
  }
  return { groups: [...groups.values()], unique: seen.size, duplicates, noGroup };
}

/** يقرأ ملف Excel أو CSV أو نص في المتصفح ويحوله إلى صفوف */
export async function fileToRows(file: File): Promise<string[][]> {
  if (/\.(txt)$/i.test(file.name) || file.type === 'text/plain') return textToRows(await file.text());
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
  return rows.map(r => r.map(cleanCell));
}
