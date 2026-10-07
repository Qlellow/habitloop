import { memo, useDeferredValue, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { compact, timeAgo, useAuth, useChannelPreviews, plainText, type ChannelPreview } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { SearchIcon } from '../components/Icons';
import { Page } from '../components/Layout';
import { Masonry } from '../components/Masonry';
import { preload } from '../lib/preload';
import { ui } from '../components/ui';
import s from './pages.styles';
import b from './ChannelsPage.styles';
import { cn } from '../lib/cn';

/** 채널 카드: 채널 정보 + 최근 글 최대 8개 미리보기 */
const ChannelBoard = memo(function ChannelBoard({ channel }: { channel: ChannelPreview }) {
  const { slug, name, description, postCount, memberCount, joined, recentPosts } = channel;
  return (
    <section className={b.board}>
      <Link to={`/c/${slug}`} className={b.head} onPointerEnter={preload.channel}>
        <ChannelIcon channel={channel} size={36} />
        <span className={b.headText}>
          <span className={b.name}>
            {name}
            {joined && <span className={b.joined}>팔로잉</span>}
          </span>
          <span className={b.meta}>
            팔로워 {compact(memberCount)} · 글 {compact(postCount)}
          </span>
        </span>
        <span className={b.go} aria-hidden>
          ›
        </span>
      </Link>
      {description && <p className={b.desc}>{plainText(description)}</p>}
      {recentPosts.length > 0 ? (
        <ul className={b.list}>
          {recentPosts.map((post) => (
            <li key={post.id}>
              <Link to={`/posts/${post.id}`} state={{ summary: post }} className={b.row} onPointerEnter={preload.post}>
                {post.categoryName && <span className={b.badge}>{post.categoryName}</span>}
                <span className={b.title}>{post.title}</span>
                {post.commentCount > 0 && <span className={b.comments}>[{compact(post.commentCount)}]</span>}
                <time className={b.time} dateTime={post.createdAt}>
                  {timeAgo(post.createdAt)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={b.empty}>아직 올라온 글이 없어요</p>
      )}
      {postCount > recentPosts.length && (
        <Link to={`/c/${slug}`} className={b.more} onPointerEnter={preload.channel}>
          글 {compact(postCount)}개 전체 보기 →
        </Link>
      )}
    </section>
  );
});

/** 채널 카드 높이 추정(px): 머리 64 + 소개 26 + 글 한 줄 34 (없으면 빈 안내 69) + 전체 보기 41 */
function boardHeight({ description, recentPosts, postCount }: ChannelPreview) {
  return (
    66 +
    (description ? 26 : 0) +
    (recentPosts.length ? 13 + recentPosts.length * 34 : 69) +
    (postCount > recentPosts.length ? 41 : 0)
  );
}

/** 스켈레톤도 메이슨리로: 카드마다 글 줄 수를 달리해 실제 목록처럼 높이가 제각각 */
const SKELETON_ROWS = [8, 3, 6, 5, 8, 2];

function BoardSkeleton({ rows }: { rows: number }) {
  return (
    <section className={b.board} aria-hidden>
      <div className={b.head}>
        <span className={ui.skeleton} style={{ width: 36, height: 36 }} />
        <span className={ui.skeleton} style={{ width: 110, height: 18 }} />
      </div>
      <div className={b.list} style={{ padding: '6px 18px 14px' }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={ui.skeleton} style={{ height: 14, margin: '10px 0', width: `${90 - ((i * 13) % 40)}%` }} />
        ))}
      </div>
    </section>
  );
}

export default function ChannelsPage() {
  const { isLoggedIn } = useAuth();
  // 헤더 검색에서 "결과 모두 보기"로 오면 ?q= 로 검색어가 넘어온다
  const [params] = useSearchParams();
  const [input, setInput] = useState(params.get('q') ?? '');
  // 입력은 즉시 반영하고, 검색 요청은 렌더가 한가할 때 보낸다
  const q = useDeferredValue(input);
  const { data, isPending } = useChannelPreviews(q);
  const createTo = isLoggedIn ? '/channels/new' : '/login';

  return (
    <Page variant="wide">
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>채널</h1>
          <p className={s.pageDesc}>채널마다 최근에 올라온 글을 한눈에 볼 수 있어요.</p>
        </div>
        <div className={b.tools}>
          {/* 넓은 화면은 헤더 검색을 쓰고, 헤더 검색이 숨는 폰에서만 여기서 찾는다 */}
          <label className={b.search}>
            <input
              type="search"
              className={cn(ui.input, 'peer pl-7')}
              placeholder="채널 이름으로 찾기"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="채널 검색"
              onDrop={(e) => e.preventDefault()}
            />
            {/* 헤더 검색과 같은 돋보기: 입력칸 뒤에 두어 포커스되면(peer-focus) 브랜드 색 */}
            <SearchIcon className={b.searchIcon} />
          </label>
          <Link to={createTo} state={isLoggedIn ? undefined : { from: '/channels/new' }} className={cn(ui.button, ui.primary)} onPointerEnter={preload.channelForm}>
            채널 만들기
          </Link>
        </div>
      </div>
      {isPending ? (
        <Masonry
          items={SKELETON_ROWS.map((rows, i) => ({ rows, i }))}
          keyOf={(x) => String(x.i)}
          estimate={(x) => 70 + x.rows * 34}
          render={(x) => <BoardSkeleton rows={x.rows} />}
        />
      ) : data && data.length > 0 ? (
        // 글이 많은 채널과 적은 채널의 높이가 달라도 빈틈 없이 쌓는다 (메이슨리)
        <Masonry items={data} keyOf={(c) => c.slug} estimate={boardHeight} render={(c) => <ChannelBoard channel={c} />} />
      ) : (
        <div className={cn(ui.card, ui.empty)}>
          찾는 채널이 없어요
          <div style={{ marginTop: 16 }}>
            <Link to={createTo} state={isLoggedIn ? undefined : { from: '/channels/new' }} className={cn(ui.button, ui.secondary, ui.small)}>
              새 채널 만들기
            </Link>
          </div>
        </div>
      )}
    </Page>
  );
}
