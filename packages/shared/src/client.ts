import { authStore } from './auth';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let baseUrl = '';

/** 앱 시작 시 한 번 호출. 웹은 같은 도메인('')을, 앱은 서버 주소를 넘긴다. */
export function configureApi(options: { baseUrl: string }) {
  baseUrl = options.baseUrl.replace(/\/$/, '');
}

type Query = Record<string, string | number | undefined | null>;

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  let url = baseUrl + path;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = authStore.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, '네트워크 연결을 확인해 주세요');
  }

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
