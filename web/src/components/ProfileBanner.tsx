import { apiUrl, bannerBackground } from '@loop/shared';
import { cn } from '../lib/cn';

/** 프로필 배너 (기본 배너 그라데이션 또는 내 사진). 없으면 연한 기본 띠 */
export function ProfileBanner({ banner, className }: { banner?: string | null; className?: string }) {
  const background = bannerBackground(banner, apiUrl('')) ?? 'linear-gradient(120deg, var(--primary-weak), var(--field))';
  return <div aria-hidden className={cn('w-full aspect-[3/1] max-h-[220px]', className)} style={{ background }} />;
}
