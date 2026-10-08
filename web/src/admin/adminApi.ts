import { ApiError, apiUrl } from '@loop/shared';

/**
 * 관리자 API 호출. 일반 api() 와 따로 쓴다:
 * - 일반 로그인 토큰을 붙이지 않는다 (관리자 토큰만)
 * - 관리자 401 이 일반 로그인을 풀지 않는다
 * 관리자 토큰은 이 탭에서만 (sessionStorage) 기억한다. 탭을 닫으면 다시 로그인
 */
const TOKEN_KEY = 'loop:admin-token';

export const adminToken = {
  get(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* 저장소를 못 쓰면 이번 화면에서만 */
    }
  },
};

export async function adminApi<T>(key: string, path: string, options: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}): Promise<T> {
  const { method = 'GET', body, query } = options;
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Admin-Key': key };
  const token = adminToken.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(apiUrl(`/api/admin${path}${qs ? `?${qs}` : ''}`), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, '네트워크 연결을 확인해 주세요');
  }
  if (res.status === 401) adminToken.set(null);
  if (!res.ok) {
    let message = '잠시 후 다시 시도해 주세요';
    try {
      message = ((await res.json()) as { message?: string }).message ?? message;
    } catch {
      /* body 없음 */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
