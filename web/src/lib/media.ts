import { useSyncExternalStore } from 'react';

/** CSS 미디어 쿼리가 맞는지 (창 크기가 바뀌면 다시 그린다) */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** 폰 (태블릿 제외): 사이트의 모바일 기준 520px 이하 */
export const PHONE_QUERY = '(max-width: 520px)';
export const usePhone = () => useMediaQuery(PHONE_QUERY);
