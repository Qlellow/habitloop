import { useEffect, useRef, type HTMLAttributes } from 'react';
import { bindCursorZone } from '../lib/cursor';
import { useMediaQuery } from '../lib/media';
import { useSettings, type CursorStyle } from '../lib/settings';
import { cn } from '../lib/cn';

/** 마우스가 있는 기기에서만, 동작 줄이기를 켜지 않았을 때만 */
const QUERY = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

/**
 * 인터랙티브 커서를 쓰는 특별한 영역 (로그인 · 회원가입, 초대, 404, 설정 미리보기).
 * 사이트 전체가 아니라 이 안에서만 커서가 바뀐다. 디자인은 설정(화면 › 인터랙티브 커서)을 따르고, preview 로 바꿔 볼 수 있다
 */
export function CursorZone({ preview, className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { preview?: CursorStyle }) {
  const ref = useRef<HTMLDivElement>(null);
  const { cursor } = useSettings();
  const can = useMediaQuery(QUERY);
  const style = preview ?? (cursor === 'off' ? undefined : cursor);
  const on = can && !!style;

  useEffect(() => {
    if (!on || !ref.current || !style) return;
    return bindCursorZone(ref.current, style);
  }, [on, style]);

  return (
    <div ref={ref} className={cn(className, on && 'cursor-zone')} {...rest}>
      {children}
    </div>
  );
}
