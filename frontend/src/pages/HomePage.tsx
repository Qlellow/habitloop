import { Link } from 'react-router-dom';
import { useChannels, useFeed, usePopular } from '../api/queries';
import { useAuth } from '../auth/authStore';
import { ChannelIcon } from '../components/ChannelIcon';
import { Main, MainHeader, layoutStyles } from '../components/Layout';
import { PencilIcon } from '../components/Icons';
import { PostList } from '../components/PostList';
import { compact } from '../lib/format';
import { preload } from '../lib/preload';
import ch from '../components/Channel.module.css';
import list from '../components/PostList.module.css';
import ui from '../components/ui.module.css';

function ChannelRail() {
  const { data } = useChannels();
  return (
    <section className={ui.card} style={{ marginBottom: 12 }}>
      <div className={ch.sectionHead}>
        <h2 className={ui.sectionTitle}>인기 채널</h2>
        <Link to="/channels" className={ch.more} onPointerEnter={preload.channels}>
          전체 보기
        </Link>
      </div>
      <div className={ch.rail}>
        {data
          ? data.slice(0, 10).map((c) => (
              <Link key={c.slug} to={`/c/${c.slug}`} className={ch.railCard} onPointerEnter={preload.channel}>
                <ChannelIcon slug={c.slug} name={c.name} />
                <span className={ch.railName}>{c.name}</span>
                <span className={ch.railMeta}>글 {compact(c.postCount)}개</span>
              </Link>
            ))
          : Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`${ch.railCard} ${ui.skeleton}`} style={{ height: 118 }} />
            ))}
      </div>
    </section>
  );
}

export function PopularSection({ channel }: { channel?: string }) {
  const { data } = usePopular(channel);
  if (!data || data.length === 0) return null;
  return (
    <section className={ui.card} style={{ marginBottom: 12 }}>
      <h2 className={ui.sectionTitle}>지금 인기 있는 글</h2>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {data.map((post, i) => (
          <li key={post.id}>
            <Link
              to={`/posts/${post.id}`}
              state={{ summary: post }}
              className={list.rankItem}
              onPointerEnter={preload.post}
            >
              <span className={list.rank}>{i + 1}</span>
              <span className={list.rankTitle}>{post.title}</span>
              <span className={list.rankLikes}>♥ {post.likeCount}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function WriteFab({ channel }: { channel?: string }) {
  const { isLoggedIn } = useAuth();
  const to = channel ? `/write?channel=${encodeURIComponent(channel)}` : '/write';
  return (
    <Link
      to={isLoggedIn ? to : `/login?next=${encodeURIComponent(to)}`}
      className={layoutStyles.fab}
      onPointerEnter={isLoggedIn ? preload.write : preload.login}
    >
      <PencilIcon width={20} height={20} /> 글쓰기
    </Link>
  );
}

export default function HomePage() {
  const feed = useFeed({});
  return (
    <>
      <MainHeader />
      <Main>
        <ChannelRail />
        <PopularSection />
        <section className={ui.card}>
          <h2 className={ui.sectionTitle}>전체 글</h2>
          <PostList query={feed} empty="아직 글이 없어요. 첫 글을 남겨 보세요!" />
        </section>
      </Main>
      <WriteFab />
    </>
  );
}
