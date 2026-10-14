import { useEffect } from 'react';
import { startPixelFx } from '../lib/pixelFx';
import { useMediaQuery } from '../lib/media';
import { useSettings } from '../lib/settings';

/** 마우스가 있는 기기에서만, 동작 줄이기를 켜지 않았을 때만 */
const QUERY = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

/** 인터랙티브 커서 (도트 파티클). 설정에서 끄거나 특별한 화면에서만 나오게 할 수 있다 */
export function PixelParticles() {
  const { pixelFx, pixelFxSpecialOnly } = useSettings();
  const can = useMediaQuery(QUERY);
  useEffect(() => {
    if (!can || !pixelFx) return;
    return startPixelFx({ specialOnly: pixelFxSpecialOnly });
  }, [can, pixelFx, pixelFxSpecialOnly]);
  return null;
}
