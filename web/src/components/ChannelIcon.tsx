import { channelColor } from '@loop/shared';

export function ChannelIcon({ slug, name, size = 32 }: { slug: string; name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: channelColor(slug),
        color: '#fff',
        fontSize: size * 0.44,
        fontWeight: 800,
      }}
    >
      {name.slice(0, 1)}
    </span>
  );
}
