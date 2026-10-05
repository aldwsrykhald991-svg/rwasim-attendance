'use client';

export type ApiResult<T> =
  | { ok: true; data: T }
  /** retryable = انقطاع شبكة أو خطأ خادم مؤقت؛ يصح إعادة المحاولة بنفس الطلب */
  | { ok: false; error: string; retryable: boolean; status: number };

export async function fieldApi<T = Record<string, unknown>>(
  url: string,
  body?: unknown,
  method: 'POST' | 'PATCH' | 'GET' = 'POST',
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: (data as { error?: string }).error || 'حدث خطأ، حاول مرة أخرى',
        retryable: res.status >= 500 || res.status === 408,
        status: res.status,
      };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'تعذر الاتصال، تحقق من الشبكة', retryable: true, status: 0 };
  }
}
