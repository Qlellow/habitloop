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
  options: { method?: string; body?: unknown; query?: Query; signal?: AbortSignal; blob?: Blob } = {},
): Promise<T> {
  const { method = 'GET', body, query, signal, blob } = options;
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
  else headers['X-Viewer'] = authStore.getViewerId();
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // 이미지 같은 바이너리는 그대로 보낸다 (Content-Type 은 blob 의 type)
  if (blob) headers['Content-Type'] = blob.type;

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: blob ?? (body === undefined ? undefined : JSON.stringify(body)), signal });
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

/** 서버 주소를 붙인 절대 경로 (img src 처럼 fetch 를 거치지 않는 곳에서 쓴다) */
export function apiUrl(path: string) {
  return baseUrl + path;
}

/** 채널 프로필 이미지 주소. 이미지가 없으면 undefined (그때는 첫 글자 아이콘을 그린다) */
export function channelIconUrl(channel: { slug: string; iconVersion?: number }) {
  return channel.iconVersion && channel.iconVersion > 0
    ? apiUrl(`/api/channels/${encodeURIComponent(channel.slug)}/icon?v=${channel.iconVersion}`)
    : undefined;
}
