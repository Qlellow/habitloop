/**
 * 글 본문 이미지의 편집 설정.
 * 마크다운에는 `![캡션](/api/images/ID#w=60&ar=0.75&c=0.1,0.1,0.8,0.8&s=circle&r=12&a=left&nr=0.66)` 처럼
 * 이미지 주소 뒤 #(fragment) 에 설정을 적는다. 서버로는 # 뒤가 가지 않으므로 원본 이미지는 그대로이고,
 * 화면에 그릴 때만 크기·자르기·모양을 CSS 로 적용한다 (언제든 다시 편집할 수 있다).
 */
export type ImageShape = 'rect' | 'circle';
export type ImageAlign = 'left' | 'center' | 'right';

export interface CropRect {
  /** 원본 이미지 기준 비율 (0~1) */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageParams {
  /** 본문 너비 대비 가로 크기 (%) */
  w: number;
  /** 보이는 세로/가로 비율. 자유롭게 늘이고 줄인 경우에만 있다 (없으면 원래 비율) */
  ar?: number;
  /** 자르기 영역 */
  crop?: CropRect;
  shape: ImageShape;
  /** 모서리 둥글기 (px, 사각형일 때) */
  r: number;
  align: ImageAlign;
  /** 원본의 세로/가로 비율 (자른 영역의 비율을 계산할 때 쓴다) */
  nr?: number;
}

export const DEFAULT_PARAMS: ImageParams = { w: 100, shape: 'rect', r: 8, align: 'center' };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const num = (v: string | null, min: number, max: number) => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) ? clamp(n, min, max) : undefined;
};
const round = (n: number, digits = 4) => Number(n.toFixed(digits));

/** 주소에서 이미지 주소와 편집 설정을 나눈다 */
export function parseImageSrc(src: string): { url: string; params: ImageParams } {
  const hash = src.indexOf('#');
  const url = hash >= 0 ? src.slice(0, hash) : src;
  const q = new URLSearchParams(hash >= 0 ? src.slice(hash + 1) : '');
  const c = (q.get('c') ?? '').split(',').map(Number);
  let crop: CropRect | undefined;
  if (c.length === 4 && c.every(Number.isFinite)) {
    const x = clamp(c[0], 0, 1);
    const y = clamp(c[1], 0, 1);
    const w = clamp(c[2], 0.01, 1 - x);
    const h = clamp(c[3], 0.01, 1 - y);
    if (w > 0 && h > 0) crop = { x, y, w, h };
  }
  const shape = q.get('s') === 'circle' ? 'circle' : 'rect';
  const align = q.get('a');
  return {
    url,
    params: {
      w: num(q.get('w'), 10, 100) ?? DEFAULT_PARAMS.w,
      ar: num(q.get('ar'), 0.05, 20),
      crop,
      shape,
      r: num(q.get('r'), 0, 64) ?? DEFAULT_PARAMS.r,
      align: align === 'left' || align === 'right' ? align : 'center',
      nr: num(q.get('nr'), 0.01, 100),
    },
  };
}

/** 이미지 주소 + 편집 설정 → 마크다운에 넣을 주소 (기본값은 적지 않는다) */
export function buildImageSrc(url: string, p: ImageParams): string {
  const q: string[] = [];
  if (p.w !== DEFAULT_PARAMS.w) q.push(`w=${round(p.w, 1)}`);
  if (p.ar !== undefined) q.push(`ar=${round(p.ar)}`);
  if (p.crop) q.push(`c=${[p.crop.x, p.crop.y, p.crop.w, p.crop.h].map((n) => round(n)).join(',')}`);
  if (p.shape === 'circle') q.push('s=circle');
  if (p.r !== DEFAULT_PARAMS.r) q.push(`r=${Math.round(p.r)}`);
  if (p.align !== 'center') q.push(`a=${p.align}`);
  if (p.nr !== undefined && (p.crop || p.ar !== undefined)) q.push(`nr=${round(p.nr)}`);
  return q.length ? `${url}#${q.join('&')}` : url;
}

/** 화면에 보이는 세로/가로 비율 (원래 비율 그대로면 undefined) */
export function displayRatio(p: ImageParams): number | undefined {
  if (p.ar !== undefined) return p.ar;
  if (p.crop && p.nr !== undefined) return (p.crop.h * p.nr) / p.crop.w;
  return undefined;
}

/**
 * 마크다운 본문에서 n 번째 이미지(![..](..))의 위치를 찾는다. 코드 블록·인라인 코드 안은 건너뛴다
 * (렌더러가 매기는 순서 data-i 와 맞춘다).
 */
export function findImageToken(source: string, index: number): { start: number; end: number; alt: string; src: string } | undefined {
  // 코드 부분은 같은 길이의 공백으로 가려서 위치는 그대로 두고 매칭만 막는다
  const masked = source
    .replace(/```[\s\S]*?(```|$)/g, (m) => ' '.repeat(m.length))
    .replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
  const re = /!\[([^\]\n]*)\]\(([^)\s]+)\)/g;
  let i = 0;
  for (let m = re.exec(masked); m; m = re.exec(masked)) {
    if (i++ === index) {
      return { start: m.index, end: m.index + m[0].length, alt: source.slice(m.index + 2, m.index + 2 + m[1].length), src: m[2] };
    }
  }
  return undefined;
}

/** 글자 위치 pos 가 들어 있는 이미지가 몇 번째인지 (작성 화면에서 커서가 이미지 위에 있는지 볼 때) */
export function imageIndexAt(source: string, pos: number): number | undefined {
  for (let i = 0; ; i++) {
    const t = findImageToken(source, i);
    if (!t || t.start > pos) return undefined;
    if (pos <= t.end) return i;
  }
}

/** n 번째 이미지의 캡션·주소를 바꾼 새 본문 */
export function replaceImageToken(source: string, index: number, alt: string, src: string): string {
  const t = findImageToken(source, index);
  if (!t) return source;
  return source.slice(0, t.start) + `![${alt.replace(/[[\]\n]/g, '')}](${src})` + source.slice(t.end);
}

/** n 번째 이미지를 지운 새 본문 (그 줄이 이미지뿐이면 줄째로) */
export function removeImageToken(source: string, index: number): string {
  const t = findImageToken(source, index);
  if (!t) return source;
  let { start, end } = t;
  if ((start === 0 || source[start - 1] === '\n') && (end === source.length || source[end] === '\n')) end = Math.min(source.length, end + 1);
  return source.slice(0, start) + source.slice(end);
}
