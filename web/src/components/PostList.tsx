import { RoleBadge } from './RoleBadge';
import { UserAvatar } from './UserAvatar';
import { memo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { compact, timeAgo, type CursorPage, type PostSummary } from '@loop/shared';
import { preload } from '../lib/preload';
import { useSettings } from '../lib/settings';
import { CommentIcon, HeartIcon } from './Icons';
import s from './PostList.styles';
import { ui } from './ui';
import { cn } from '../lib/cn';

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
  return (
    <li className={s.item}>
      <Link
        to={`/posts/${post.id}`}
        state={{ summary: post }}
        className={s.link}
        onPointerEnter={preload.post}
        onFocus={preload.post}
      >
        {/* 위: 채널(또는 카테고리) ··· 시간 / 아래: 공감·댓글·조회 ··· 작성자 */}
        <div className={s.meta}>
          {label && <span className={s.badge}>{label}</span>}
          <time className={s.time} dateTime={post.createdAt}>
            {timeAgo(post.createdAt)}
          </time>
        </div>
        <h3 className={s.title}>{post.title}</h3>
        {showExcerpt && <p className={s.excerpt}>{post.excerpt}</p>}
        <div className={s.stats}>
          <span className={s.stat}>
            <HeartIcon /> {compact(post.likeCount)}
          </span>
          <span className={s.stat}>
            <CommentIcon /> {compact(post.commentCount)}
          </span>
          <span>조회 {compact(post.viewCount)}</span>
          {/* 작성자를 누르면 프로필로 (글 링크 안이라 <a> 를 겹치지 않고 직접 이동한다) */}
          <span
            className={s.author}
            role="link"
            title={`${post.authorNickname} 프로필 보기`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/u/${post.authorId}`);
            }}
          >
            <UserAvatar nickname={post.authorNickname} avatarUrl={post.authorAvatar} size={18} />
            <span className="truncate hover:underline underline-offset-2">{post.authorNickname}</span>
            <RoleBadge role={post.authorRole} size={16} />
          </span>
        </div>
      </Link>
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
export function PostList({ query, empty, badge }: { query: FeedQuery; empty: string; badge?: Badge }) {
  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;
  const sentinel = useRef<HTMLDivElement>(null);
  const { showExcerpt } = useSettings();

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
