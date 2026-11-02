import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, useChannel, useChannelRanking } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { RankingTable, useMyUid } from '../components/ChannelTools';
import { Page } from '../components/Layout';
import { ui } from '../components/ui';
import { cn } from '../lib/cn';
import { usePageTitle } from '../lib/title';

/** 채널 랭킹 시즌: 한 달 동안의 활동 점수 순위 (지난 시즌도 넘겨 볼 수 있다) */
const shift = (season: string, d: number) => {
  const [y, m] = season.split('-').map(Number);
  const t = y * 12 + (m - 1) + d;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

export default function RankingPage() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const season = params.get('season') ?? undefined;
  const { data: channel } = useChannel(slug);
  const { data, error, isFetching } = useChannelRanking(slug, season);
  const me = useMyUid();
  usePageTitle(channel ? `${channel.name} 랭킹` : undefined);
  const label = (s: string) => `${s.slice(0, 4)}년 ${Number(s.slice(5))}월`;
  return (
    <Page variant="single">
      <div className="flex items-center gap-3 mb-1">
        {channel && <ChannelIcon channel={channel} size={40} />}
        <h1 className="m-0 text-[22px] font-bold text-fg-strong">{channel?.name ?? ''} 랭킹 시즌</h1>
        <Link to={`/c/${slug}`} className={cn(ui.cardLink, 'ml-auto')}>
          채널로 →
        </Link>
      </div>
      <p className="m-0 mb-4 text-sm text-fg-sub">
        한 달 동안 이 채널에서 쓴 글 5점 · 댓글 2점 · 받은 공감 1점 (글 30개 · 댓글 100개까지). 시즌이 끝나면 1~3위에게{' '}
        {data?.prizes.join(' · ') ?? '300 · 200 · 100'}P를 줘요.
      </p>
      {error instanceof ApiError ? (
        <div className={cn(ui.card, 'p-8 text-center text-fg-sub')}>{error.message}</div>
      ) : !data ? (
        <div className={ui.spinner} />
      ) : (
        <section className={ui.card}>
          <nav className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border" aria-label="시즌 고르기">
            <button
              type="button"
              className={cn(ui.button, ui.text, ui.small)}
              disabled={data.season <= data.firstSeason}
              onClick={() => setParams({ season: shift(data.season, -1) })}
            >
              ‹ 지난 시즌
            </button>
            <b className={cn('text-[16px] text-fg-strong', isFetching && 'opacity-60')}>
              {label(data.season)}{' '}
              {data.current ? (
                <span className={cn(ui.badge, 'ml-1 align-[2px]')}>진행 중</span>
              ) : (
                <span className="text-[13px] font-medium text-fg-weak">시즌 끝</span>
              )}
            </b>
            <button
              type="button"
              className={cn(ui.button, ui.text, ui.small)}
              disabled={data.current}
              onClick={() => setParams({ season: shift(data.season, 1) })}
            >
              다음 시즌 ›
            </button>
          </nav>
          {data.ranks.length ? (
            <RankingTable rows={data.ranks} me={me} />
          ) : (
            <p className="m-0 p-8 text-center text-sm text-fg-weak">이 시즌에는 아직 활동이 없어요</p>
          )}
          {data.me === null && (
            <p className="m-0 px-4 py-3 text-center text-[13px] text-fg-weak">아직 20위 안에 들지 못했어요. 이 채널에서 글과 댓글로 함께해요!</p>
          )}
        </section>
      )}
    </Page>
  );
}
