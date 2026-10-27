import { Link } from 'react-router-dom';
import { useVillage } from '@loop/shared';
import { ui } from '../ui';
import { preload } from '../../lib/preload';
import { VillageScene } from './VillageScene';

/** 채널 오른쪽 단: 우리 마을 (작은 그림 + 레벨 + 다음 건물까지) */
export function VillageCard({ slug }: { slug: string }) {
  const { data: v } = useVillage(slug);
  if (!v) return null;
  const prev = v.items.filter((i) => i.unlocked).reduce((m, i) => Math.max(m, i.bricks), 0);
  const p = v.next ? Math.min(1, (v.bricks - prev) / Math.max(1, v.next.bricks - prev)) : 1;
  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.sectionTitle} style={{ fontSize: 16 }}>
          우리 마을 <span className="text-[13px] font-semibold text-fg-weak">Lv.{v.level}</span>
          {v.festival && <span className="ml-1 text-[13px]">🎆</span>}
        </h2>
        <Link to={`/c/${slug}/village`} className={ui.cardLink} onPointerEnter={preload.village}>
          구경하기
        </Link>
      </div>
      <Link to={`/c/${slug}/village`} className="block px-4" onPointerEnter={preload.village} aria-label="마을 구경하기">
        <VillageScene village={v} compact />
      </Link>
      <div className="px-5 pt-3 pb-4">
        <div className="flex justify-between text-[12px] text-fg-weak mb-1.5">
          <span>{v.next ? `다음: ${v.next.name}` : '마을 완성!'}</span>
          <span className="tabular-nums">
            🧱 {v.bricks.toLocaleString()}
            {v.next && ` / ${v.next.bricks.toLocaleString()}`}
          </span>
        </div>
        <div className="village-progress">
          <span style={{ '--p': p } as React.CSSProperties} />
        </div>
      </div>
    </section>
  );
}
