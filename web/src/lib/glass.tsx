import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Liquid Glass 굴절 (Aave "Building Glass for the Web" 방식).
 * backdrop-filter: url() 은 크로미움에서만 되므로, 유리 아래에 보일 "내용 자체"에 filter: url() 을 건다 → 사파리 · 파이어폭스도 된다.
 *
 * 변위 지도 한 장에 세 가지를 담는다.
 *   R: 가로로 끌어올 양, G: 세로로 끌어올 양 (128 = 그대로)
 *   B: 굴절시킬 곳(255) / 손대지 않을 곳(0). 가운데 글자는 필터를 거쳐도 원본 그대로 두어 흐려지지 않게 한다
 */

interface MapOptions {
  /** 모서리 둥글기 (axis 가 xy 일 때) */
  radius?: number;
  /** 가장자리에서 굴절되는 띠의 두께 */
  bezel: number;
  /** xy: 네 변 모두, y: 위 · 아래 변만 (스크롤 목록) */
  axis?: 'xy' | 'y';
}

const cache = new Map<string, string>();

function displacementMap(w: number, h: number, { radius = 0, bezel, axis = 'xy' }: MapOptions) {
  const key = `${w}x${h}:${radius}:${bezel}:${axis}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const hx = w / 2 - radius;
  const hy = h / 2 - radius;
  for (let y = 0; y < h; y++) {
    const py = y + 0.5 - h / 2;
    for (let x = 0; x < w; x++) {
      // 테두리까지 안쪽 거리(dist)와 바깥 방향(nx, ny)
      let dist: number;
      let nx = 0;
      let ny = 0;
      if (axis === 'y') {
        dist = Math.min(y + 0.5, h - y - 0.5);
        ny = py < 0 ? -1 : 1;
      } else {
        const px = x + 0.5 - w / 2;
        const qx = Math.abs(px) - hx;
        const qy = Math.abs(py) - hy;
        if (qx > 0 && qy > 0) {
          const len = Math.hypot(qx, qy) || 1;
          dist = radius - len;
          nx = (qx / len) * Math.sign(px);
          ny = (qy / len) * Math.sign(py);
        } else if (qx > qy) {
          dist = radius - qx;
          nx = Math.sign(px);
        } else {
          dist = radius - qy;
          ny = Math.sign(py);
        }
      }
      const t = Math.max(0, 1 - dist / bezel);
      const mag = t * t; // 가장자리로 갈수록 세게 (볼록한 유리 단면)
      const i = (y * w + x) * 4;
      // 안쪽 내용을 끌어와서 가장자리에서 늘어나 보이게
      d[i] = 128 - nx * mag * 127;
      d[i + 1] = 128 - ny * mag * 127;
      d[i + 2] = t > 0 ? 255 : 0;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

/**
 * 굴절 SVG 필터. 크기가 바뀌면 id 도 바뀐다 (사파리는 같은 id 의 필터 결과를 캐시해 옛 모습을 보여 줄 수 있다).
 * 쓰는 쪽은 style={{ filter: `url(#${id})` }}
 */
export function GlassFilter({ id, w, h, scale, ...map }: MapOptions & { id: string; w: number; h: number; scale: number }) {
  if (w < 1 || h < 1) return null;
  const url = displacementMap(w, h, map);
  if (!url) return null;
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feImage href={url} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" result="bent" />
      {/* 파란 채널 → 알파: 굴절시킬 곳만 휜 그림, 나머지는 원본 */}
      <feColorMatrix in="map" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="mask" />
      <feComposite in="bent" in2="mask" operator="in" result="edge" />
      <feComposite in="SourceGraphic" in2="mask" operator="out" result="middle" />
      <feMerge>
        <feMergeNode in="middle" />
        <feMergeNode in="edge" />
      </feMerge>
    </filter>
  );
}

export const glassFilterId = (name: string, w: number, h: number) => `glass-${name}-${w}x${h}`;

/** 요소의 안쪽 크기 (스크롤바 제외) */
export function useClientSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
