/** 헤더(64px) 아래로 살짝 띄워서 멈춘다 */
export const SCROLL_OFFSET = 64 + 12;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

let running = 0;

/**
 * 페이지를 y 위치까지 ease-in-out 으로 부드럽게 스크롤한다.
 * (scrollTo 의 smooth 는 속도 곡선을 정할 수 없어 직접 그린다)
 * 움직임 줄이기를 켠 사용자에게는 바로 이동한다. 사용자가 휠·터치로 끼어들면 멈춘다.
 */
export function smoothScrollTo(y: number, duration = 520) {
  const start = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const target = Math.max(0, Math.min(y, max));
  const distance = target - start;
  const id = ++running;
  if (Math.abs(distance) < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, target);
    return;
  }
  const stop = () => (running = id + 1);
  window.addEventListener('wheel', stop, { once: true, passive: true });
  window.addEventListener('touchstart', stop, { once: true, passive: true });
  const t0 = performance.now();
  const step = (now: number) => {
    if (running !== id) return;
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, start + distance * easeInOutCubic(t));
    if (t < 1) requestAnimationFrame(step);
    else {
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
    }
  };
  requestAnimationFrame(step);
}

/** 요소의 위쪽이 헤더 바로 아래에 오도록 스크롤 */
export function scrollToElement(el: Element, duration?: number) {
  smoothScrollTo(el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET, duration);
}
