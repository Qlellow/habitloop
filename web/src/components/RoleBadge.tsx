import type { ChannelRole } from '@loop/shared';
import { GearIcon, StarIcon, WrenchIcon } from './Icons';
import { cn } from '../lib/cn';

export const ROLE_LABEL: Record<ChannelRole, string> = { OWNER: '소유자', ADMIN: '관리자', MANAGER: '매니저' };

// 색은 global.css 의 --role-* 토큰 (다크 모드에서는 배경을 어둡게)
const STYLE: Record<ChannelRole, { box: string; Icon: typeof StarIcon }> = {
  OWNER: { box: 'bg-[var(--role-owner-bg)] text-[var(--role-owner)]', Icon: StarIcon },
  ADMIN: { box: 'bg-[var(--role-admin-bg)] text-[var(--role-admin)]', Icon: GearIcon },
  MANAGER: { box: 'bg-[var(--role-manager-bg)] text-[var(--role-manager)]', Icon: WrenchIcon },
};

/**
 * 닉네임 바로 오른쪽에 붙는 채널 운영진 배지 (소유자 ★ · 관리자 ⚙ · 매니저 🔧).
 * 일반 멤버는 role 이 없어 아무것도 그리지 않는다.
 */
export function RoleBadge({ role, size = 18, className }: { role?: ChannelRole | 'MEMBER' | null; size?: number; className?: string }) {
  if (!role || role === 'MEMBER') return null;
  const { box, Icon } = STYLE[role];
  return (
    <span
      role="img"
      aria-label={ROLE_LABEL[role]}
      title={`채널 ${ROLE_LABEL[role]}`}
      className={cn('inline-grid flex-none place-items-center rounded-[5px] align-[-3px]', box, className)}
      style={{ width: size, height: size }}
    >
      <Icon width={Math.round(size * 0.66)} height={Math.round(size * 0.66)} />
    </span>
  );
}
