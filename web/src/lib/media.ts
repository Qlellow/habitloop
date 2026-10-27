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

/**
 * 파이어폭스(Gecko). 스크롤을 따로 돌리는 방식이라, 스크롤에 맞춰 JS 로 움직이는 효과가 한 박자씩 늦어 끊겨 보인다.
 * 그런 효과는 파이어폭스에서 끈다 (global.css 의 @supports (-moz-appearance: none) 와 같은 판정)
 */
export const isGecko = typeof CSS !== 'undefined' && CSS.supports('-moz-appearance', 'none');
