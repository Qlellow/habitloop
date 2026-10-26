import { useEffect } from 'react';

/**
 * 양방향 sticky: 화면보다 긴 사이드바도 끝까지 볼 수 있게.
 *  - 화면에 다 들어가면: 지금처럼 헤더 아래(위쪽)에 붙는다
 *  - 화면보다 길면: 페이지와 함께 스크롤되다가, 내려갈 때는 아래 끝이 보이는 곳에서, 올라갈 때는 위 끝이 보이는 곳에서 붙는다
 *    (sticky 의 top 을 스크롤한 만큼 [화면 높이 - 사이드바 높이, 헤더 아래] 사이에서 옮긴다)
 * 긴 사이드바에는 data-tall 을 달아, '천천히 따라오는'(useFollowScroll) 흔들림은 빼게 한다.
 * 좁은 화면(860px 이하, 사이드바가 아래로 내려가 붙지 않는 폭)에서는 아무것도 하지 않는다
 */
const GAP = 16;

const headerTop = () => (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64) + 40;

export function useSmartSticky(refs: { current: HTMLElement | null }[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let last = window.scrollY;
    const tops = new Map<HTMLElement, number>();
    const place = (dy: number) => {
      const wide = window.innerWidth > 860;
      const max = headerTop();
      for (const r of refs) {
        const el = r.current;
        if (!el) continue;
        if (!wide) {
          el.style.top = '';
          delete el.dataset.tall;
          continue;
        }
        const min = Math.min(max, window.innerHeight - el.offsetHeight - GAP);
        const tall = min < max;
        if (tall) el.dataset.tall = '1';
        else delete el.dataset.tall;
        // 페이지 맨 위 · 맨 아래에서는 위 끝 · 아래 끝을 보인다 (끝에서 튕기는 스크롤에 흔들리지 않게)
        const y = window.scrollY;
        const atTop = y <= 0;
        const atBottom = y + window.innerHeight >= document.documentElement.scrollHeight - 2;
        const top = atTop ? max : atBottom ? min : Math.max(min, Math.min(max, (tops.get(el) ?? max) - dy));
        tops.set(el, top);
        el.style.top = `${top}px`;
      }
    };
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - last;
      last = y;
      place(dy);
    };
    const onResize = () => place(0);
    place(0);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    // 사이드바 안의 내용이 늘거나 줄어도 다시 맞춘다
    const ro = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => place(0));
    for (const r of refs) if (r.current) ro?.observe(r.current);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
      for (const r of refs) {
        if (!r.current) continue;
        r.current.style.top = '';
        delete r.current.dataset.tall;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
