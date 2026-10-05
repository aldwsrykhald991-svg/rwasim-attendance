'use client';

export async function fieldApi<T = Record<string, unknown>>(
  url: string,
  body: unknown,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error || 'حدث خطأ، حاول مرة أخرى' };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'تعذر الاتصال، تحقق من الشبكة' };
  }
}
