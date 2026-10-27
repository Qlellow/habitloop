import type { BadgeTier, FeaturedBadge } from '@loop/shared';
import { cn } from '../lib/cn';
import '../styles/badges.css';

export const TIER_LABEL: Record<BadgeTier, string> = { common: '일반', rare: '희귀', legendary: '전설' };

/** 배지 메달: 등급마다 테두리 색이 다르다 (전설은 빛이 지나간다). locked 면 흑백, secret 이면 점선 */
export function BadgeMedal({
  icon,
  tier,
  size = 40,
  locked,
  secret,
  className,
  style,
}: {
  icon: string;
  tier: BadgeTier;
  size?: number;
  locked?: boolean;
  secret?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn('badge-medal', className)}
      data-tier={tier}
      data-locked={locked || undefined}
      data-secret={secret || undefined}
      style={{ ...style, '--badge-size': `${size}px` } as React.CSSProperties}
      aria-hidden
    >
      <span className="badge-medal-face">{icon}</span>
    </span>
  );
}

/** 닉네임 옆 대표 배지 (작은 메달 + 이름은 툴팁) */
export function BadgeMark({ badge, size = 18, className }: { badge?: FeaturedBadge; size?: number; className?: string }) {
  if (!badge) return null;
  return (
    <span className={cn('inline-flex align-[-0.2em]', className)} title={`${badge.name} · ${TIER_LABEL[badge.tier]} 배지`} role="img" aria-label={`대표 배지 ${badge.name}`}>
      <BadgeMedal icon={badge.icon} tier={badge.tier} size={size} />
    </span>
  );
}
