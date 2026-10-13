import { useSyncExternalStore } from 'react';
import { useMediaQuery } from './media';

/**
 * 게시글 미니 창: 글을 작은 창으로 띄워 두고 다른 글을 둘러볼 수 있다 (데스크톱 전용).
 * 창 목록은 화면 이동과 상관없이 남고, 새로고침해도 이 탭에서는 그대로 (sessionStorage).
 */
export interface MiniWindow {
  postId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  minimized: boolean;
  /** 나중에 누른 창이 위로 */
  z: number;
}

export const MAX_WINDOWS = 4;
export const MIN_W = 320;
export const MIN_H = 220;
const DEFAULT_W = 420;
const DEFAULT_H = 520;
/** 접힌 창 높이 (제목 줄만) */
export const BAR_H = 44;
/** 새 창이 처음 열리는 높이 (사이트 헤더 바로 아래) */
const TOP = 64 + 12;
/** 창을 브라우저 밖으로 밀어내도 다시 잡을 수 있게 제목 줄은 이만큼 남긴다 (오른쪽 버튼 셋을 빼고도 잡을 곳이 남게) */
const KEEP = 180;
const KEY = 'loop:mini-windows';

let windows: MiniWindow[] = load();
const listeners = new Set<() => void>();

function load(): MiniWindow[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as MiniWindow[];
    return Array.isArray(saved) ? saved.filter((w) => Number.isInteger(w.postId)).slice(0, MAX_WINDOWS) : [];
  } catch {
    return [];
  }
}

function set(next: MiniWindow[]) {
  windows = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 저장소를 못 쓰면 이번 화면에서만 */
  }
  listeners.forEach((l) => l());
}

const topZ = () => windows.reduce((m, w) => Math.max(m, w.z), 0) + 1;

/**
 * 창은 헤더 위로도, 브라우저 밖으로도 옮길 수 있다 (밖으로 나간 부분은 브라우저 경계에서 잘려 보인다).
 * 다만 제목 줄은 다시 잡을 수 있게: 위로는 브라우저 위 끝까지, 좌우 · 아래로는 제목 줄이 조금(KEEP · 한 줄) 남을 때까지만
 */
export function clampToViewport(w: MiniWindow): MiniWindow {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(Math.max(w.w, MIN_W), vw);
  const height = Math.min(Math.max(w.h, MIN_H), vh);
  return {
    ...w,
    w: width,
    h: height,
    x: Math.min(Math.max(w.x, KEEP - width), vw - KEEP),
    y: Math.min(Math.max(w.y, 0), vh - BAR_H),
  };
}

export const miniWindows = {
  /** 이미 열려 있으면 앞으로 가져오고 펼친다. 가득 차 있으면 가장 오래 안 본 창을 닫는다 */
  open(postId: number) {
    const existing = windows.find((w) => w.postId === postId);
    if (existing) {
      set(windows.map((w) => (w.postId === postId ? { ...w, minimized: false, z: topZ() } : w)));
      return;
    }
    const kept = windows.length >= MAX_WINDOWS ? [...windows].sort((a, b) => b.z - a.z).slice(0, MAX_WINDOWS - 1) : windows;
    // 오른쪽에서 시작해 새 창일수록 왼쪽 아래로 비껴 놓는다 (앞 창의 제목 줄이 가려지지 않게)
    const n = kept.length;
    const fresh = clampToViewport({
      postId,
      w: DEFAULT_W,
      h: DEFAULT_H,
      x: window.innerWidth - DEFAULT_W - 24 - n * 28,
      y: TOP + n * (BAR_H + 4),
      minimized: false,
      z: topZ(),
    });
    set([...kept, fresh]);
  },
  close(postId: number) {
    set(windows.filter((w) => w.postId !== postId));
  },
  focus(postId: number) {
    const w = windows.find((x) => x.postId === postId);
    if (!w || w.z === topZ() - 1) return;
    set(windows.map((x) => (x.postId === postId ? { ...x, z: topZ() } : x)));
  },
  update(postId: number, patch: Partial<MiniWindow>) {
    set(windows.map((w) => (w.postId === postId ? clampToViewport({ ...w, ...patch }) : w)));
  },
  /** 브라우저 창 크기가 바뀌면 모든 창을 화면 안으로 */
  fitAll() {
    set(windows.map(clampToViewport));
  },
};

export function useMiniWindows(): MiniWindow[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => windows,
    () => windows,
  );
}

/** 미니 창은 마우스를 쓰는 넓은 화면(1024px 이상)에서만 */
export const MINI_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';
export const useMiniEnabled = () => useMediaQuery(MINI_QUERY);
