import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { safeNext } from '@loop/shared';

/**
 * 로그인 · 회원가입 뒤에 돌아갈 곳.
 * 주소(?next=)에 넣으면 로그인 ↔ 회원가입을 오갈 때마다 next 가 겹겹이 쌓이므로,
 * 주소는 /login, /signup 그대로 두고 history state({ from }) 로만 넘긴다.
 */
export interface AuthState {
  from?: string;
}

const AUTH_PATHS = ['/login', '/signup', '/password/reset'];
const isAuthPath = (path: string) => AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}?`));

/** 돌아갈 곳으로 쓸 수 있는 내부 경로인지 (로그인·회원가입 화면 자신은 제외) */
function clean(from: string | null | undefined) {
  const path = safeNext(from, '');
  return path && !isAuthPath(path) ? path : undefined;
}

/** 지금 화면에서 로그인/회원가입으로 보낼 때 넘길 state. 이미 로그인·회원가입 화면이면 받은 값을 그대로 넘긴다 */
export function useAuthState(): AuthState {
  const { pathname, search, state } = useLocation();
  if (isAuthPath(pathname)) return { from: (state as AuthState | null)?.from };
  return { from: clean(pathname + search) };
}

/** 로그인 · 회원가입이 끝나면 갈 곳 (예전 ?next= 주소로 들어와도 받아 준다) */
export function useReturnTo(): string {
  const { search, state } = useLocation();
  return clean((state as AuthState | null)?.from) ?? clean(new URLSearchParams(search).get('next')) ?? '/';
}

/**
 * 로그아웃 · 탈퇴처럼 로그인 상태가 풀리는 일은, 로그인이 필요한 화면(마이페이지 등)을 먼저 떠난 뒤에 한다.
 * 로그인 상태는 바로 바뀌지만 화면 이동은 조금 늦게 반영돼서, 그 사이에 떠나려던 화면이
 * '로그인이 필요해요' 하고 로그인 화면으로 보내 버리기 때문이다.
 */
let pendingSignOut: { to: string; run: () => void } | undefined;

export function useLeaveThenSignOut() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (to: string, run: () => void) => {
    if (pathname === to) {
      run();
      return;
    }
    pendingSignOut = { to, run };
    navigate(to, { replace: true });
  };
}

/** 가장 바깥 레이아웃에서 한 번: 이동이 끝나면 미뤄 둔 로그아웃을 한다 */
export function useRunPendingSignOut() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pendingSignOut && pathname === pendingSignOut.to) {
      const { run } = pendingSignOut;
      pendingSignOut = undefined;
      run();
    }
  }, [pathname]);
}
