import { Link, NavLink } from 'react-router-dom';
import { compact, useAuth, useChannels, useMyChannels, usePopular, type ChannelSummary } from '@loop/shared';
import { ChannelIcon } from './ChannelIcon';
import { TrophyIcon } from './Icons';
import { SlideHover } from './SlideHover';
import { preload } from '../lib/preload';
import { ui } from './ui';
import s from './Sidebar.styles';

/** 인기 목록은 다섯 개까지 */
export const POPULAR_LIMIT = 5;

const TROPHY = ['#f5b400', '#a7b1bc', '#c7793a']; // 금 · 은 · 동
const TROPHY_LABEL = ['1위', '2위', '3위'];

/** 순위 표시: 1~3위는 금·은·동 트로피, 그 아래는 숫자 */
export function RankMark({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span className={s.trophy} role="img" aria-label={TROPHY_LABEL[rank - 1]}>
        <TrophyIcon style={{ color: TROPHY[rank - 1] }} />
      </span>
    );
  }
  return <span className={s.rankNo}>{rank}</span>;
}

function ChannelLinks({ channels }: { channels: ChannelSummary[] }) {
  return (
    <ul className={s.list}>
      {channels.map((c) => (
        <li key={c.slug}>
          <NavLink to={`/c/${c.slug}`} className={s.channel} onPointerEnter={preload.channel}>
            <ChannelIcon channel={c} size={26} />
            <span className={s.channelName}>{c.name}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/** 사이드바를 다 불러오기 전에 보여 줄 자리 (제목 · 채널 줄) */
function SidebarSkeleton({ sections }: { sections: number[] }) {
  return (
    <div aria-hidden>
      {sections.map((rows, i) => (
        <div key={i} className={i < sections.length - 1 ? s.section : undefined}>
          <div className="px-2.5 pt-1.5 pb-2.5">
            <span className={ui.skeleton} style={{ display: 'block', width: 72, height: 13 }} />
          </div>
          {Array.from({ length: rows }, (_, j) => (
            <div key={j} className={s.channel}>
              <span className={ui.skeleton} style={{ width: 26, height: 26 }} />
              <span className={ui.skeleton} style={{ width: 70 + ((j * 37) % 50), height: 16 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * 왼쪽 사이드바: 팔로우한 채널(북마크한 채널 먼저) + 인기 채널 TOP 5 (등수는 API 의 최근 7일 활동 점수).
 * 내가 만든 채널은 홈에서 보여 주지 않는다 (마이페이지 > 내 채널).
 * 필요한 목록을 다 불러오기 전에는 스켈레톤만 보여 준다 (빈 제목이 잠깐 보였다 바뀌지 않게).
 */
export function ChannelSidebar() {
  const { isLoggedIn } = useAuth();
  const mine = useMyChannels(isLoggedIn);
  const { data } = useChannels();
  if (!data || (isLoggedIn && !mine.data)) return <SidebarSkeleton sections={isLoggedIn ? [3, POPULAR_LIMIT] : [POPULAR_LIMIT]} />;

  const joined = new Set(mine.data?.map((c) => c.slug));
  const followed = mine.data?.filter((c) => !c.owner) ?? [];
  const popular = data.filter((c) => !joined.has(c.slug)).slice(0, POPULAR_LIMIT);
  return (
    <nav className={s.block} aria-label="채널">
      {isLoggedIn && (
        <div className={s.section}>
          <h2 className={s.heading}>팔로우한 채널</h2>
          {followed.length > 0 ? (
            <ChannelLinks channels={followed} />
          ) : (
            <p className={s.hint}>팔로우한 채널이 없어요. 채널을 팔로우하면 여기에 모여요.</p>
          )}
        </div>
      )}
      <h2 className={s.heading} title="최근 7일 동안 새 글 · 댓글 · 공감 · 새 팔로워 · 활동한 사람이 많은 순">
        인기 채널 <span className="font-medium">· 최근 7일</span>
      </h2>
      {/* 다른 채널로 옮기면 hover 상자가 이전 채널에서 미끄러져 온다 */}
      <SlideHover>
        <ul className={s.list}>
          {popular.map((c, i) => (
            <li key={c.slug}>
              <NavLink to={`/c/${c.slug}`} className={s.popularChannel} onPointerEnter={preload.channel}>
                <RankMark rank={i + 1} />
                <ChannelIcon channel={c} size={26} />
                <span className={s.channelName}>{c.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </SlideHover>
      <Link to="/channels" className={s.more} onPointerEnter={preload.channels}>
        모든 채널 보기 →
      </Link>
    </nav>
  );
}

/**
 * 좁은 화면(1100px 이하)용: 왼쪽 사이드바 대신 홈 본문 위에 내 채널을 가로로 넘겨 보는 줄.
 * 로그인하면 팔로우한 채널(북마크한 채널 먼저), 아니면(또는 하나도 없으면) 인기 채널.
 */
export function ChannelStrip() {
  const { isLoggedIn } = useAuth();
  const mine = useMyChannels(isLoggedIn);
  const popular = useChannels();
  // 내가 만든 채널은 홈에서 보여 주지 않는다
  const followed = mine.data?.filter((c) => !c.owner) ?? [];
  const showMine = isLoggedIn && followed.length > 0;
  const channels: ChannelSummary[] = showMine ? followed : (popular.data?.slice(0, 12) ?? []);
  if (channels.length === 0) return null;
  return (
    <nav className={s.strip} aria-label={showMine ? '팔로우한 채널' : '인기 채널'}>
      <div className={s.stripHead}>
        <h2 className={s.stripTitle}>{showMine ? '팔로우한 채널' : '인기 채널'}</h2>
        <Link to={showMine ? '/me/channels' : '/channels'} className={s.stripMore} onPointerEnter={preload.channels}>
          전체 보기
        </Link>
      </div>
      {/* 인기 채널 → 내 채널로 바뀌면 새 목록으로 갈아 끼워 가로 스크롤을 처음 위치로 */}
      <ul key={showMine ? 'mine' : 'popular'} className={s.stripList}>
        {channels.map((c) => (
          <li key={c.slug} className="flex-none">
            <Link to={`/c/${c.slug}`} className={s.stripItem} onPointerEnter={preload.channel}>
              <ChannelIcon channel={c} size={28} />
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** 오른쪽 사이드바: 인기글 (전체 또는 채널별) */
export function PopularCard({ channel, title = '지금 인기 있는 글' }: { channel?: string; title?: string }) {
  const { data } = usePopular(channel);
  if (!data || data.length === 0) return null;
  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <h2 className={ui.sectionTitle} style={{ fontSize: 16 }}>
          {title}
        </h2>
      </div>
      {/* 인기 채널과 같이: hover 상자가 글을 따라 미끄러져 움직인다 */}
      <SlideHover className={s.rankList}>
        <ol className={s.list}>
          {data.slice(0, POPULAR_LIMIT).map((post, i) => (
            <li key={post.id}>
              <Link to={`/posts/${post.id}`} state={{ summary: post }} className={s.rank} onPointerEnter={preload.post}>
                <RankMark rank={i + 1} />
                <span className={s.rankBody}>
                  <span className={s.rankTitle}>{post.title}</span>
                  <span className={s.rankMeta}>
                    {post.channelName} · 좋아요 {compact(post.likeCount)} · 댓글 {compact(post.commentCount)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </SlideHover>
    </section>
  );
}
