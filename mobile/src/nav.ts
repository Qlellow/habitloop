import { router } from 'expo-router';

/**
 * 끝난 화면(로그인 · 글쓰기 등)을 닫는다. 앞 화면이 없으면(링크로 바로 열었을 때) 홈으로.
 * router.back() 만 쓰면 돌아갈 곳이 없을 때 그 화면에 그대로 남는다
 */
export function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
