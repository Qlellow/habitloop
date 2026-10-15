import { RoleBadge } from './RoleBadge';
import { UserAvatar } from './UserAvatar';
import { memo, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { compact, REACTIONS, timeAgo, usePostPreview, type CursorPage, type PostPreview, type PostSummary } from '@loop/shared';
import { preload } from '../lib/preload';
import { useSettings } from '../lib/settings';
import { CommentIcon, HeartIcon, PictureInPictureIcon } from './Icons';
import { miniWindows, useMiniEnabled } from '../lib/miniWindows';
import s from './PostList.styles';
import { ui } from './ui';
import { cn } from '../lib/cn';

/** 마우스가 있는 기기에서만 카드를 펼친다 (터치는 누르면 바로 글로 가니까) */
const canHover = typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
/** 이만큼 머물러야 펼친다 (지나가기만 하면 그대로). 받아 오기는 조금 먼저 시작한다 */
const OPEN_DELAY = 340;
const FETCH_DELAY = 140;

/** 살아있는 카드: 마우스를 잠시 올리면 펼친다. 펼칠 내용은 그때 받아 온다 */
function useLiveCard(postId: number) {
  const { livePreview } = useSettings();
  const enabled = canHover && livePreview;
  const [want, setWant] = useState(false);
  const [load, setLoad] = useState(false);
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);
  const { data } = usePostPreview(postId, enabled && load);
  const handlers = enabled
    ? {
        onPointerEnter: (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return;
          clear();
          timers.current.push(window.setTimeout(() => setLoad(true), FETCH_DELAY));
          timers.current.push(window.setTimeout(() => setWant(true), OPEN_DELAY));
        },
        onPointerLeave: () => {
          clear();
          setWant(false);
        },
      }
    : {};
  // 내용이 막 도착했으면 접힌 채로 한 번 그린 뒤 펼쳐야 애니메이션이 보인다
  const ready = enabled && want && !!data;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!ready) return setOpen(false);
    let raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => setOpen(true))));
    return () => cancelAnimationFrame(raf);
  }, [ready]);
  return { open, data, handlers };
}

/** 펼친 카드 안: 더 긴 미리보기 · 반응 · 최근 댓글 */
function LivePanel({ data, showExcerpt }: { data: PostPreview; showExcerpt: boolean }) {
  const reactions = REACTIONS.filter((r) => (data.reactions?.[r.kind] ?? 0) > 0);
  const mine = new Set(data.myReactions ?? []);
  const more = data.commentCount - data.comments.length;
  return (
    <div className="live-panel">
      {showExcerpt && (
        <p className="live-excerpt">
          {data.blockedAuthor ? '차단한 사용자의 글이에요' : data.excerpt || '내용 없이 제목만 있는 글이에요'}
          {[...data.excerpt].length >= 260 && '…'}
        </p>
      )}
      <div className="live-reactions" aria-label="반응">
        <span className={cn('live-chip', data.liked && 'is-mine')}>
          <HeartIcon filled={data.liked} /> {compact(data.likeCount)}
        </span>
        {reactions.map((r) => (
          <span key={r.kind} className={cn('live-chip', mine.has(r.kind) && 'is-mine')} title={r.label}>
            <span className="live-emoji">{r.emoji}</span> {compact(data.reactions[r.kind] ?? 0)}
          </span>
        ))}
        {reactions.length === 0 && data.likeCount === 0 && <span className="live-none">아직 반응이 없어요</span>}
      </div>
      {data.comments.length > 0 ? (
        <ul className="live-comments" aria-label="최근 댓글">
          {data.comments.map((c) => (
            <li key={c.id}>
              <UserAvatar nickname={c.nickname} avatarUrl={c.avatarUrl} size={18} />
              <b>{c.nickname}</b>
              <span className="live-comment-text">{c.content}</span>
              <time dateTime={c.createdAt}>{timeAgo(c.createdAt)}</time>
            </li>
          ))}
          {more > 0 && <li className="live-more">댓글 {compact(more)}개 더</li>}
        </ul>
      ) : (
        <div className="live-none">아직 댓글이 없어요 · 첫 댓글을 남겨 보세요</div>
      )}
    </div>
  );
}

/** badge: 홈에서는 채널 이름, 채널 안에서는 카테고리 이름을 보여 준다 */
export type Badge = 'channel' | 'category';

export const PostItem = memo(function PostItem({
  post,
  badge = 'channel',
  showExcerpt = true,
}: {
  post: PostSummary;
  badge?: Badge;
  showExcerpt?: boolean;
}) {
  const label = badge === 'channel' ? post.channelName : post.categoryName;
  const navigate = useNavigate();
  const mini = useMiniEnabled();
  const live = useLiveCard(post.id);
  const time = (
    // 미니 창 버튼이 뜨는 동안(마우스를 올렸을 때)은 시간을 비켜 준다
    <time className={cn(s.time, mini && 'group-hover/item:invisible')} dateTime={post.createdAt}>
      {timeAgo(post.createdAt)}
    </time>
  );
  // 작성자를 누르면 프로필로 (글 링크 안이라 <a> 를 겹치지 않고 직접 이동한다)
  const author = (className?: string) => (
    <span
      className={cn(s.author, className)}
      role="link"
      title={`${post.authorNickname} 프로필 보기`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/u/${post.authorId}`);
      }}
    >
      <UserAvatar nickname={post.authorNickname} avatarUrl={post.authorAvatar} size={20} />
      <span className="truncate hover:underline underline-offset-2">{post.authorNickname}</span>
      <RoleBadge role={post.authorRole} size={16} />
    </span>
  );
  return (
    <li className={cn(s.item, 'relative group/item', live.open && 'live-open')} {...live.handlers}>
      <Link
        to={`/posts/${post.id}`}
        state={{ summary: post }}
        className={s.link}
        onPointerEnter={preload.post}
        onFocus={preload.post}
      >
        {/* 위: 채널(또는 카테고리) ··· 시간 / 가운데: 작성자 / 아래: 제목·내용 ··· 공감·댓글·조회.
            채널 안이라 채널 이름이 없으면 그 줄을 작성자가 채워 빈칸 없이 당긴다 */}
        {label ? (
          <>
            <div className={s.meta}>
              <span className={s.badge}>{label}</span>
              {time}
            </div>
            {author('mt-1.5')}
          </>
        ) : (
          <div className={s.meta}>
            {author()}
            {time}
          </div>
        )}
        <div className={s.bottom}>
          <div className="flex-1 min-w-0">
            <h3 className={s.title}>{post.title}</h3>
            {/* 펼치면 두 줄 미리보기는 접히고 아래 더 긴 미리보기가 대신한다 */}
            {showExcerpt && (
              <div className={cn('live-fold', live.open && 'is-folded')}>
                <div>
                  <p className={s.excerpt}>{post.excerpt}</p>
                </div>
              </div>
            )}
          </div>
          <div className={s.stats}>
            <span className={s.stat}>
              <HeartIcon /> {compact(post.likeCount)}
            </span>
            <span className={s.stat}>
              <CommentIcon /> {compact(post.commentCount)}
            </span>
            <span>조회 {compact(post.viewCount)}</span>
          </div>
        </div>
        {live.data && (
          <div className={cn('live-card', live.open && 'is-open')} aria-hidden={!live.open}>
            <div>
              <LivePanel data={live.data} showExcerpt={showExcerpt} />
            </div>
          </div>
        )}
      </Link>
      {/* 데스크톱: 글을 작은 창으로 띄워 두고 목록을 계속 둘러본다 (링크 안에 버튼을 넣지 않고 위에 겹친다) */}
      {mini && (
        <button
          type="button"
          className={s.miniButton}
          aria-label={`'${post.title}' 작은 창으로 보기`}
          title="작은 창으로 보기"
          onClick={() => miniWindows.open(post.id)}
        >
          <PictureInPictureIcon />
          작은 창
        </button>
      )}
    </li>
  );
});

export function PostListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={s.skeletonItem}>
          <div className={ui.skeleton} style={{ width: 120, height: 14 }} />
          <div className={ui.skeleton} style={{ width: '70%', height: 20, marginTop: 10 }} />
          <div className={ui.skeleton} style={{ width: '95%', height: 16, marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

type FeedQuery = UseInfiniteQueryResult<InfiniteData<CursorPage<PostSummary>>>;

/** 무한 스크롤 목록. 끝에 닿기 전에(rootMargin) 다음 페이지를 미리 불러온다. */
export function PostList({ query, empty, badge, excerpt }: { query: FeedQuery; empty: string; badge?: Badge; excerpt?: boolean }) {
  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;
  const sentinel = useRef<HTMLDivElement>(null);
  const settings = useSettings();
  // excerpt: 본문 미리보기를 이 목록만 따로 정할 때 (나만의 홈 위젯)
  const showExcerpt = excerpt ?? settings.showExcerpt;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) return <PostListSkeleton />;
  if (isError)
    return (
      <div className={ui.empty}>
        불러오지 못했어요
        <div style={{ marginTop: 12 }}>
          <button type="button" className={cn(ui.button, ui.secondary, ui.small)} onClick={() => refetch()}>
            다시 시도
          </button>
        </div>
      </div>
    );

  const posts = data.pages.flatMap((p) => p.items);
  if (posts.length === 0) return <div className={ui.empty}>{empty}</div>;

  return (
    <>
      <ul className={s.list}>
        {posts.map((post) => (
          <PostItem key={post.id} post={post} badge={badge} showExcerpt={showExcerpt} />
        ))}
      </ul>
      <div ref={sentinel} className={s.sentinel} />
      {isFetchingNextPage && <div className={ui.spinner} role="progressbar" aria-label="불러오는 중" />}
    </>
  );
}
