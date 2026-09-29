import { memo, useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { compact, timeAgo, useAuth, useChannelPreviews, type ChannelPreview } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { Page } from '../components/Layout';
import { preload } from '../lib/preload';
import ui from '../components/ui.module.css';
import s from './pages.module.css';
import b from './ChannelsPage.module.css';

/** 채널 카드: 채널 정보 + 최근 글 최대 8개 미리보기 */
const ChannelBoard = memo(function ChannelBoard({ channel }: { channel: ChannelPreview }) {
  const { slug, name, description, postCount, recentPosts } = channel;
  return (
    <section className={b.board}>
      <Link to={`/c/${slug}`} className={b.head} onPointerEnter={preload.channel}>
        <ChannelIcon slug={slug} name={name} size={36} />
        <span className={b.headText}>
          <span className={b.name}>{name}</span>
          <span className={b.meta}>
            c/{slug} · 글 {compact(postCount)}개
          </span>
        </span>
        <span className={b.go} aria-hidden>
          ›
        </span>
      </Link>
      {description && <p className={b.desc}>{description}</p>}
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

function BoardSkeleton() {
  return (
    <section className={b.board} aria-hidden>
      <div className={b.head}>
        <span className={ui.skeleton} style={{ width: 36, height: 36 }} />
        <span className={ui.skeleton} style={{ width: 110, height: 18 }} />
      </div>
      <div className={b.list} style={{ padding: '6px 18px 14px' }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={ui.skeleton} style={{ height: 14, margin: '10px 0', width: `${90 - i * 7}%` }} />
        ))}
      </div>
    </section>
  );
}

export default function ChannelsPage() {
  const { isLoggedIn } = useAuth();
  const [input, setInput] = useState('');
  // 입력은 즉시 반영하고, 검색 요청은 렌더가 한가할 때 보낸다
  const q = useDeferredValue(input);
  const { data, isPending } = useChannelPreviews(q);
  const createTo = isLoggedIn ? '/channels/new' : '/login?next=/channels/new';

  return (
    <Page variant="wide">
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>채널</h1>
          <p className={s.pageDesc}>채널마다 최근에 올라온 글을 한눈에 볼 수 있어요.</p>
        </div>
        <div className={b.tools}>
          <input
            type="search"
            className={ui.input}
            placeholder="채널 이름이나 주소로 찾기"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="채널 검색"
          />
          <Link to={createTo} className={`${ui.button} ${ui.primary}`} onPointerEnter={preload.channelForm}>
            채널 만들기
          </Link>
        </div>
      </div>
      {isPending ? (
        <div className={b.grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <BoardSkeleton key={i} />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className={b.grid}>
          {data.map((c) => (
            <ChannelBoard key={c.slug} channel={c} />
          ))}
        </div>
      ) : (
        <div className={`${ui.card} ${ui.empty}`}>
          찾는 채널이 없어요
          <div style={{ marginTop: 16 }}>
            <Link to={createTo} className={`${ui.button} ${ui.secondary} ${ui.small}`}>
              새 채널 만들기
            </Link>
          </div>
        </div>
      )}
    </Page>
  );
}
