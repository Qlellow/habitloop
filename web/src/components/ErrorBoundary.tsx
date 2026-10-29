import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { isChunkError, isOffline, reloadForNewVersion, reportError } from '../lib/errorReport';
import { toast } from './Toast';
import { ui } from './ui';
import { cn } from '../lib/cn';

/** 인터넷이 다시 연결되면 새로고침해서 못 받은 화면을 받는다 */
function useReloadWhenOnline(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onOnline = () => location.reload();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [enabled]);
}

/** 화면이 깨졌을 때 보여 줄 안내 (흰 화면 대신). 화면 조각을 못 받았으면 인터넷이 끊긴 것인지 새 버전인지 나눠 알려 준다 */
export function CrashScreen({ onRetry, chunk }: { onRetry?: () => void; chunk?: boolean }) {
  const offline = !!chunk && isOffline();
  useReloadWhenOnline(offline);
  const [title, desc, icon] = offline
    ? ['인터넷 연결이 끊겼어요', '연결되면 자동으로 다시 불러와요.', '📡']
    : chunk
      ? ['새 버전이 나왔어요', '새로고침하면 최신 화면으로 바뀌어요.', '🔄']
      : ['화면을 그리다 문제가 생겼어요', '잠깐 뒤 다시 시도해 주세요. 문제가 계속되면 자동으로 운영진에게 알려졌어요.', '🫧'];
  return (
    <div className="w-full max-w-[480px] mx-auto px-6 py-20 text-center" role="alert">
      <div className="text-[44px] leading-none" aria-hidden>
        {icon}
      </div>
      <h1 className="mt-4 mb-0 text-[20px] font-bold text-fg-strong">{title}</h1>
      <p className="mt-2 mb-0 text-[15px] text-fg-sub">{desc}</p>
      <div className="mt-6 flex justify-center gap-2">
        {onRetry && !chunk && (
          <button type="button" className={cn(ui.button, ui.ghost)} onClick={onRetry}>
            다시 시도
          </button>
        )}
        <button
          type="button"
          className={cn(ui.button, ui.primary)}
          onClick={() => (isOffline() ? toast('아직 인터넷에 연결되지 않았어요') : location.reload())}
        >
          {offline ? '다시 시도' : '새로고침'}
        </button>
        {!chunk && (
          <a href="/" className={cn(ui.button, ui.text)}>
            홈으로
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * 화면 하나가 렌더 중 오류로 깨져도 사이트 전체가 하얘지지 않게 막는다.
 * fallback 이 null 이면 조용히 숨긴다 (떠 있는 도크 · 펫 같은 덤 UI)
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode | null; name?: string; /** 바뀌면(예: 주소) 오류를 지우고 다시 그려 본다 */ resetKey?: string },
  { error?: unknown }
> {
  state: { error?: unknown } = {};

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error !== undefined) this.setState({ error: undefined });
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // 배포로 옛 화면 조각이 없어졌으면 한 번 새로고침
    if (isChunkError(error) && reloadForNewVersion()) return;
    const e = error instanceof Error ? error : new Error(String(error));
    if (info.componentStack) e.stack = `${e.stack ?? ''}\n--- ${this.props.name ?? 'component'}${info.componentStack}`;
    reportError('render', e);
  }

  render() {
    if (this.state.error === undefined) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return <CrashScreen chunk={isChunkError(this.state.error)} onRetry={() => this.setState({ error: undefined })} />;
  }
}

/** 라우터가 잡은 오류 (로더 · 렌더) */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <CrashScreen />;
  }
  if (isChunkError(error) && reloadForNewVersion()) return null;
  reportError('render', error);
  return <CrashScreen chunk={isChunkError(error)} />;
}
