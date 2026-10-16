import { useSyncExternalStore } from 'react';

/**
 * 음성방 창 (방 화면: 참여자 · 화면 공유를 크게).
 *  - pip: 브라우저가 지원하면(크롬 · 엣지) 진짜 새 창 (Document Picture-in-Picture). 항상 위에 떠 있고 다른 모니터로도 옮길 수 있다.
 *    같은 페이지가 그리는 창이라 음성 연결 · 화면 공유 영상을 그대로 쓴다 (새 탭은 연결이 따로라 서로 끊긴다)
 *  - inline: 지원하지 않으면 사이트 안의 큰 창 (끌기 · 크기 조절 · 최대화)
 * 창을 닫아도 통화는 이어진다. 통화를 끊으면 창도 닫힌다.
 */

type Mode = 'closed' | 'pip' | 'inline';

interface DocumentPip {
  requestWindow(opts?: { width?: number; height?: number; disallowReturnToOpener?: boolean }): Promise<Window>;
  window: Window | null;
}

const pipApi = () => (typeof window !== 'undefined' ? (window as Window & { documentPictureInPicture?: DocumentPip }).documentPictureInPicture : undefined);
export const canPopOut = () => !!pipApi();

let mode: Mode = 'closed';
let pipWin: Window | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** 사이트의 스타일 · 테마(data-theme 등)를 새 창에 옮기고, 바뀌면 따라가게 한다 */
function mirrorStyles(win: Window) {
  const doc = win.document;
  for (const sheet of [...document.styleSheets]) {
    try {
      const style = doc.createElement('style');
      style.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n');
      doc.head.appendChild(style);
    } catch {
      // 다른 주소의 스타일(글꼴 등)은 규칙을 못 읽으니 링크로
      if (sheet.href) {
        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        doc.head.appendChild(link);
      }
    }
  }
  const copy = () => {
    const from = document.documentElement;
    const to = doc.documentElement;
    for (const a of [...to.attributes]) if (!from.hasAttribute(a.name)) to.removeAttribute(a.name);
    for (const a of [...from.attributes]) to.setAttribute(a.name, a.value);
  };
  copy();
  const mo = new MutationObserver(copy);
  mo.observe(document.documentElement, { attributes: true });
  win.addEventListener('pagehide', () => mo.disconnect(), { once: true });
  doc.title = '루프 음성방';
  doc.body.className = 'voice-pip-body';
}

/**
 * 방 화면 열기. 더블 클릭 · 버튼을 누른 그 순간(사용자 동작 안)에 불러야 새 창을 열 수 있다.
 * popOut=false 면 사이트 안 창으로
 */
export function openVoiceWindow(popOut = true) {
  if (mode !== 'closed' && !(popOut && mode === 'inline' && pipApi())) return;
  const api = pipApi();
  if (!popOut || !api) {
    mode = 'inline';
    return emit();
  }
  // 새 창이 뜰 때까지 사이트 안 창을 잠깐 쓰지 않는다
  api
    .requestWindow({ width: 980, height: 640 })
    .then((win) => {
      mirrorStyles(win);
      pipWin = win;
      mode = 'pip';
      win.addEventListener(
        'pagehide',
        () => {
          if (pipWin !== win) return;
          pipWin = undefined;
          mode = 'closed';
          emit();
        },
        { once: true },
      );
      emit();
    })
    .catch(() => {
      // 막혔으면 (사용자 동작 밖 등) 사이트 안 창으로
      mode = 'inline';
      emit();
    });
}

export function closeVoiceWindow() {
  const win = pipWin;
  pipWin = undefined;
  mode = 'closed';
  emit();
  win?.close();
}

const snapshot = () => mode;

export function useVoiceWindow() {
  const m = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    snapshot,
  );
  return { mode: m, pip: m === 'pip' ? pipWin : undefined };
}
