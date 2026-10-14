import type { HTMLAttributes } from 'react';

/**
 * 특별한 화면 (로그인 · 회원가입, 초대, 404, 설정 미리보기).
 * 설정에서 "특별한 화면에서만"을 켜면 도트 파티클(lib/pixelFx)이 이 안에서만 나온다
 */
export function CursorZone(props: HTMLAttributes<HTMLDivElement>) {
  return <div data-fx-zone="" {...props} />;
}
