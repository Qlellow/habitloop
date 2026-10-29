import { Link, useParams } from 'react-router-dom';
import { ApiError, compact, useChannel, useVillage, type VillageItem } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { Page } from '../components/Layout';
import { UserAvatar } from '../components/UserAvatar';
import { ui } from '../components/ui';
import { iconOf, VillageIcon, VillageScene } from '../components/village/VillageScene';
import { cn } from '../lib/cn';
import NotFoundPage from './NotFoundPage';
import { usePageTitle } from '../lib/title';

const Bar = ({ p, className }: { p: number; className?: string }) => (
  <div className={cn('village-progress', className)}>
    <span style={{ '--p': Math.max(0, Math.min(1, p)) } as React.CSSProperties} />
  </div>
);

function ItemCard({ item, need }: { item: VillageItem; need: number }) {
  return (
    <li
      className={cn(
        'relative flex flex-col items-center gap-2 rounded-lg border px-3 pt-4 pb-3 text-center',
        item.unlocked ? 'border-border bg-surface' : 'border-dashed border-border bg-[color-mix(in_srgb,var(--field)_45%,var(--surface))]',
      )}
      title={item.description}
    >
      {item.isNew && <span className="absolute top-2 right-2 px-1.5 py-px rounded-sm bg-primary text-white text-[11px] font-bold">NEW</span>}
      <div className="h-[64px] grid place-items-end">
        <VillageIcon name={iconOf(item.code)} fit={[84, 64]} locked={!item.unlocked} />
      </div>
      <div className={cn('text-[14px] font-bold', item.unlocked ? 'text-fg-strong' : 'text-fg-sub')}>{item.name}</div>
      <div className="text-[12px] text-fg-weak leading-snug line-clamp-2 min-h-[2lh]">{item.description}</div>
      <div className="text-[12px] font-semibold tabular-nums text-fg-weak">
        {item.unlocked ? (item.bricks === 0 ? '처음부터' : `🧱 ${item.bricks.toLocaleString()} 달성`) : `🧱 ${need.toLocaleString()}개 더`}
      </div>
    </li>
  );
}

/** 채널 마을: 채널 사람들의 활동(벽돌)으로 함께 짓는 도트 마을 */
export default function VillagePage() {
  const slug = useParams().slug ?? '';
  const channel = useChannel(slug).data;
  usePageTitle(channel && `${channel.name} 마을`);
  const { data: v, error } = useVillage(slug);

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage message="없거나 사라진 채널이에요" />;
  if (error instanceof ApiError && error.status === 403) return <NotFoundPage message={error.message} hint="이 채널의 마을은 지금 볼 수 없어요." />;

  const prev = v ? v.items.filter((i) => i.unlocked).reduce((m, i) => Math.max(m, i.bricks), 0) : 0;
  return (
    <Page variant="single">
      <div className="flex items-center gap-3 min-w-0">
        {channel && <ChannelIcon channel={channel} size={44} />}
        <div className="min-w-0">
          <Link to={`/c/${slug}`} className="text-[13px] font-semibold text-fg-weak hover:text-primary">
            {channel?.name ?? slug} 채널로 →
          </Link>
          <h1 className="m-0 text-[24px] font-bold text-fg-strong truncate">{channel?.name ?? ''} 마을</h1>
        </div>
        {v && (
          <div className="ml-auto text-right flex-none">
            <div className="text-[13px] text-fg-weak">
              Lv.<b className="text-fg-strong text-[18px]">{v.level}</b> / {v.maxLevel}
            </div>
            <div className="text-[13px] text-fg-sub tabular-nums">🧱 {v.bricks.toLocaleString()}</div>
          </div>
        )}
      </div>

      <section className={cn(ui.card, 'p-3')}>
        {v ? <VillageScene village={v} /> : <div className={cn(ui.skeleton, 'w-full aspect-[8/3]')} />}
        {v && (
          <div className="px-3 pt-4 pb-2">
            <div className="flex justify-between gap-3 text-[14px] mb-2">
              <span className="text-fg-sub">
                {v.next ? (
                  <>
                    다음 건물 <b className="text-fg-strong">{v.next.name}</b>까지 벽돌 <b className="text-fg-strong tabular-nums">{v.next.need.toLocaleString()}</b>개
                  </>
                ) : (
                  <b className="text-fg-strong">🏰 모든 건물을 지었어요!</b>
                )}
              </span>
              {v.next && (
                <span className="text-fg-weak tabular-nums">
                  {v.bricks.toLocaleString()} / {v.next.bricks.toLocaleString()}
                </span>
              )}
            </div>
            <Bar p={v.next ? (v.bricks - prev) / Math.max(1, v.next.bricks - prev) : 1} />
          </div>
        )}
      </section>

      {v && (
        <div className="grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
          <section className={cn(ui.card, 'p-5')}>
            <h2 className="m-0 text-[16px] font-bold text-fg-strong">이번 주 공동 목표 {v.festival && <span className="ml-1">🎆</span>}</h2>
            <p className="mt-1 mb-3 text-[13px] text-fg-weak">
              {v.festival ? '지난주 목표를 넘겨서 이번 주는 마을 축제예요!' : '이번 주에 목표를 넘기면 다음 주 내내 마을에 축제가 열려요.'}
            </p>
            <div className="flex justify-between text-[13px] text-fg-sub mb-1.5">
              <span>{v.week.bricks >= v.week.goal ? '🎉 목표 달성! 다음 주는 축제' : `🧱 ${(v.week.goal - v.week.bricks).toLocaleString()}개 남았어요`}</span>
              <span className="tabular-nums">
                {v.week.bricks.toLocaleString()} / {v.week.goal.toLocaleString()}
              </span>
            </div>
            <Bar p={v.week.bricks / v.week.goal} />
          </section>
          <section className={cn(ui.card, 'p-5')}>
            <h2 className="m-0 mb-3 text-[16px] font-bold text-fg-strong">이번 주 마을을 지은 사람</h2>
            {v.contributors.length === 0 ? (
              <p className="m-0 text-[13px] text-fg-weak">아직 없어요. 글이나 댓글로 첫 벽돌을 올려 보세요!</p>
            ) : (
              <ol className="list-none m-0 p-0 flex flex-col gap-2">
                {v.contributors.map((c, i) => (
                  <li key={c.id}>
                    <Link to={`/u/${c.id}`} className="flex items-center gap-2.5 text-[14px] hover:text-primary">
                      <span className="w-4 text-center text-[13px] font-bold text-fg-weak">{i + 1}</span>
                      <UserAvatar nickname={c.nickname} avatarUrl={c.avatarUrl} size={24} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-fg-strong">{c.nickname}</span>
                      <span className="text-[13px] text-fg-weak tabular-nums">🧱 {compact(c.bricks)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {v && (
        <section className={ui.card}>
          <div className={ui.cardHead}>
            <h2 className={ui.sectionTitle}>
              건물 <span className="text-fg-weak font-semibold">{v.level}/{v.maxLevel}</span>
            </h2>
          </div>
          <ul className="list-none m-0 px-5 pb-5 grid grid-cols-5 gap-2.5 max-[860px]:grid-cols-4 max-[640px]:grid-cols-3 max-[420px]:grid-cols-2 max-[520px]:px-4">
            {v.items.map((i) => (
              <ItemCard key={i.code} item={i} need={Math.max(0, i.bricks - v.bricks)} />
            ))}
          </ul>
        </section>
      )}

      {v && (
        <section className={cn(ui.card, 'p-5')}>
          <h2 className="m-0 text-[16px] font-bold text-fg-strong">벽돌 쌓는 법</h2>
          <p className="mt-1 mb-3 text-[13px] text-fg-weak">채널 사람들의 활동이 모두 벽돌이 돼요. 한 번 지은 건물은 사라지지 않아요.</p>
          <div className="grid grid-cols-4 gap-2 max-[640px]:grid-cols-2 text-center">
            {[
              ['✍️', '글', 10, v.breakdown.posts],
              ['💬', '댓글', 3, v.breakdown.comments],
              ['❤️', '공감 · 반응', 1, v.breakdown.reactions],
              ['👥', '팔로워', 5, v.breakdown.followers],
            ].map(([icon, label, n, count]) => (
              <div key={label as string} className="rounded-md bg-field px-3 py-3">
                <div className="text-[20px]">{icon}</div>
                <div className="mt-1 text-[13px] font-semibold text-fg-strong">
                  {label} = 🧱{n}
                </div>
                <div className="text-[12px] text-fg-weak tabular-nums">지금 {(count as number).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}
