import s from './Channel.module.css';

// 채널마다 이미지 업로드 없이도 구분되도록, slug 로 정해지는 색 + 첫 글자 아이콘
const COLORS = ['#3182f6', '#00c471', '#ff8a3d', '#8b5cf6', '#f04452', '#0ab4c9', '#e5a500', '#4e5968'];

function colorOf(slug: string) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function ChannelIcon({ slug, name, large }: { slug: string; name: string; large?: boolean }) {
  return (
    <span className={large ? s.heroIcon : s.icon} style={{ background: colorOf(slug) }} aria-hidden>
      {name.slice(0, 1)}
    </span>
  );
}
