import { ApiError, apiUrl } from '@loop/shared';

/**
 * 사용자 화면에서 난 오류를 서버(/api/client-errors)로 보낸다. 관리자 화면 '오류' 탭에서 모아 본다.
 *  - 같은 오류는 이 화면에서 한 번만, 한 번 띄운 화면에서 최대 10개까지
 *  - 확장 프로그램 · 브라우저 잡음(ResizeObserver 등) · 요청 취소 · API 오류(화면이 이미 처리)는 보내지 않는다
 *  - 배포 뒤 옛 화면 조각(청크)을 못 받으면 한 번만 새로고침해서 새 버전을 받는다
 */
type Kind = 'render' | 'error' | 'rejection' | 'chunk';

const sent = new Set<string>();
let count = 0;
const NOISE = /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|AbortError|The operation was aborted|Load failed$/i;
const CHUNK = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (CSS )?chunk/i;
const RELOAD_KEY = 'loop.chunkReload';

export const isChunkError = (e: unknown) => CHUNK.test(String((e as Error)?.message ?? e));

/** 인터넷이 끊겨서 못 받은 것 (새 버전 때문이 아님): 새로고침하면 브라우저의 오프라인 화면만 뜬다 */
export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * 옛 청크를 못 받았을 때: 30초 안에 이미 한 번 새로고침했으면 또 하지 않는다 (무한 새로고침 방지).
 * 오프라인이면 새로고침하지 않는다 (화면이 '인터넷 연결을 확인해 주세요' 를 보여 준다)
 */
export function reloadForNewVersion(): boolean {
  if (isOffline()) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

export function reportError(kind: Kind, error: unknown) {
  if (error instanceof ApiError || (isOffline() && isChunkError(error))) return;
  const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error ?? null));
  const message = `${e.name && e.name !== 'Error' ? `${e.name}: ` : ''}${e.message}`.slice(0, 500);
  const stack = (e.stack ?? '').slice(0, 4000);
  if (NOISE.test(message) || NOISE.test(stack)) return;
  const key = `${kind}|${message}`;
  if (sent.has(key) || ++count > 10) return;
  sent.add(key);
  try {
    void fetch(apiUrl('/api/client-errors'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: isChunkError(e) ? 'chunk' : kind, message, stack, url: location.pathname, release: __RELEASE__ }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // 보고는 덤: 실패해도 아무것도 하지 않는다
  }
}

/** 앱 시작 때 한 번: 잡히지 않은 오류 · Promise 거부를 보고한다 */
export function installErrorReporting() {
  window.addEventListener('error', (e) => {
    // 이미지 · 스크립트 로드 실패(e.error 없음)는 빼고 진짜 오류만
    if (e.error) reportError('error', e.error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (isChunkError(e.reason) && reloadForNewVersion()) return;
    reportError('rejection', e.reason);
  });
  // Vite: 미리 받기(preload) 실패 = 새 배포로 옛 파일이 없어졌다
  window.addEventListener('vite:preloadError', (e) => {
    if (reloadForNewVersion()) e.preventDefault();
  });
}
