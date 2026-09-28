import { authStore } from '../auth/authStore';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const BASE = import.meta.env.VITE_API_URL ?? '';

type Query = Record<string, string | number | undefined | null>;

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  let url = BASE + path;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  const token = authStore.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (res.status === 401 && token) {
    // 만료/위조 토큰은 즉시 버린다
    authStore.signOut();
  }
  if (!res.ok) {
    let message = '잠시 후 다시 시도해 주세요';
    try {
      message = ((await res.json()) as { message?: string }).message ?? message;
    } catch {
      // body 없음
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
