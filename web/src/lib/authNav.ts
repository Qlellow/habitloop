import { useLocation } from 'react-router-dom';
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
