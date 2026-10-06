import { useState } from 'react';
import { apiUrl } from '@loop/shared';
import { cn } from '../lib/cn';

/** 사용자 프로필 사진. 사진이 없거나 못 불러오면 닉네임 첫 글자 */
export function UserAvatar({ nickname, avatarUrl, size = 32, className }: { nickname: string; avatarUrl?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState<string>();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (avatarUrl && broken !== avatarUrl) {
    return (
      <img
        src={apiUrl(avatarUrl)}
        alt=""
        aria-hidden
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(avatarUrl)}
        className={cn('flex-none rounded-full object-cover bg-field', className)}
        style={style}
      />
    );
  }
  return (
    <span aria-hidden className={cn('flex-none grid place-items-center rounded-full bg-primary-weak text-primary font-bold', className)} style={style}>
      {nickname.slice(0, 1)}
    </span>
  );
}
