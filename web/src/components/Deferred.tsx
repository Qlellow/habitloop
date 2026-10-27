import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { reportBadgeEvent, useAuth } from '@loop/shared';
import { OPEN_EVENT } from '../lib/commandPalette';
import { useMiniWindows } from '../lib/miniWindows';
import { rememberedRoom, useVoice } from '../lib/voice';
import { useVoiceWindow } from '../lib/voiceWindow';
import { useSettings } from '../lib/settings';
import { useMediaQuery } from '../lib/media';

/**
 * 모든 화면에 붙어 있지만 쓸 때만 필요한 것들은, 필요해지는 순간에 받는다 (첫 화면 JS 를 줄인다).
 *  - 커맨드 팔레트: Ctrl/⌘+K · 검색 버튼을 누르면 (한가할 때 미리 받아 둔다)
 *  - 게시글 미니 창: 창을 하나라도 띄우면 (본문 마크다운 · 코드 강조가 여기 딸려 온다)
 *  - 음성방 도크: 통화 중이거나, 방 화면이 열렸거나, 새로고침 전에 들어가 있던 방이 있으면
 *  - 인터랙티브 커서: 설정에서 켰고 마우스가 있으면
 *  - 데스크톱 펫: 로그인했고 '돌아다니기'를 켰으면
 *  - 새 배지 알림: 로그인했으면
 * 한 번 받으면 계속 둔다 (음성방 도크는 통화가 끝날 때 정리할 일이 있다)
 */

const loadPalette = () => import('./CommandPalette');
const CommandPalette = lazy(loadPalette);
const MiniWindows = lazy(() => import('./MiniWindows').then((m) => ({ default: m.MiniWindows })));
const VoiceDock = lazy(() => import('./VoiceDock').then((m) => ({ default: m.VoiceDock })));
const PixelParticles = lazy(() => import('./PixelParticles').then((m) => ({ default: m.PixelParticles })));
const DesktopPet = lazy(() => import('./DesktopPet').then((m) => ({ default: m.DesktopPet })));
const BadgeUnlock = lazy(() => import('./BadgeUnlock').then((m) => ({ default: m.BadgeUnlock })));

/** 한 번 참이 되면 계속 참 */
function useLatch(on: boolean) {
  const [v, setV] = useState(on);
  useEffect(() => {
    if (on) setV(true);
  }, [on]);
  return v || on;
}

function PaletteHost() {
  const [open, setOpen] = useState(false);
  const loaded = useLatch(open);
  const { pathname } = useLocation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    // 처음 열 때 기다리지 않게, 화면이 한가해지면 미리 받아 둔다
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2500));
    const id = idle(() => void loadPalette());
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.cancelIdleCallback?.(id as number);
    };
  }, []);
  // 다른 화면으로 가면 닫는다 (뒤로 가기 등)
  useEffect(() => setOpen(false), [pathname]);
  // 숨은 배지 '키보드 마법사': 팔레트를 연 횟수
  useEffect(() => {
    if (open) void reportBadgeEvent('palette');
  }, [open]);
  return loaded ? <CommandPalette open={open} setOpen={setOpen} /> : null;
}

export function DeferredUi() {
  const { isLoggedIn } = useAuth();
  const { cursorFx, petRoam } = useSettings();
  const mouse = useMediaQuery('(hover: hover) and (pointer: fine)');
  const mini = useLatch(useMiniWindows().length > 0);
  const v = useVoice();
  const win = useVoiceWindow();
  const voice = useLatch(v.status !== 'idle' || win.mode !== 'closed' || (isLoggedIn && rememberedRoom() != null));
  const fx = useLatch(cursorFx && mouse);
  const pet = useLatch(isLoggedIn && petRoam && mouse);
  return (
    <Suspense fallback={null}>
      {/* Ctrl/⌘ + K: 키보드로 이동 · 글쓰기 · 테마 · 찾기 */}
      <PaletteHost />
      {/* 게시글 미니 창 (데스크톱): 화면을 옮겨도 떠 있다 */}
      {mini && <MiniWindows />}
      {/* 채널 음성채팅: 들어가 있는 동안 화면을 옮겨도 이어진다 */}
      {voice && <VoiceDock />}
      {/* 인터랙티브 커서: 마우스를 올린 버튼 · 아이콘이 도트 파티클을 뿜는다 */}
      {fx && <PixelParticles />}
      {/* 내 펫이 화면을 돌아다닌다 */}
      {pet && <DesktopPet />}
      {/* 새 배지를 받으면 반짝이며 알린다 */}
      {isLoggedIn && <BadgeUnlock />}
    </Suspense>
  );
}
