import { useState } from 'react';
import { channelColor, channelIconUrl } from '@loop/shared';

type IconChannel = { slug: string; name: string; iconVersion?: number; color?: number | null };

/**
 * 채널 프로필. 올린 이미지가 있으면 이미지를, 없으면 채널 색 위에 첫 글자를 그린다.
 * src 를 넘기면 그 이미지를 쓴다 (채널 만들기 화면의 미리보기).
 */
export function ChannelIcon({ channel, size = 32, src }: { channel: IconChannel; size?: number; src?: string }) {
  const url = src ?? channelIconUrl(channel);
  const [broken, setBroken] = useState<string>();
  const radius = Math.round(size * 0.22);

  if (url && broken !== url) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(url)}
        style={{ flex: 'none', width: size, height: size, borderRadius: radius, objectFit: 'cover', background: 'var(--field)' }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: radius,
        background: channelColor(channel.slug, channel.color),
        color: '#fff',
        fontSize: size * 0.44,
        fontWeight: 800,
      }}
    >
      {channel.name.slice(0, 1)}
    </span>
  );
}
