import { Link, NavLink } from 'react-router-dom';
import { compact, useAuth, useChannels, useMyChannels, usePopular, type ChannelSummary } from '@loop/shared';
import { ChannelIcon } from './ChannelIcon';
import { preload } from '../lib/preload';
import ui from './ui.module.css';
import s from './Sidebar.module.css';

function ChannelLinks({ channels }: { channels: ChannelSummary[] }) {
  return (
    <ul className={s.list}>
      {channels.map((c) => (
        <li key={c.slug}>
          <NavLink to={`/c/${c.slug}`} className={s.channel} onPointerEnter={preload.channel}>
            <ChannelIcon slug={c.slug} name={c.name} size={26} />
            <span className={s.channelName}>{c.name}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/** 왼쪽 사이드바: 내가 가입한 채널 + 인기 채널 바로가기 */
export function ChannelSidebar() {
  const { isLoggedIn } = useAuth();
  const mine = useMyChannels(isLoggedIn);
  const { data } = useChannels();
  const joined = new Set(mine.data?.map((c) => c.slug));
  return (
    <nav className={s.block} aria-label="채널">
      {isLoggedIn && (
        <div className={s.section}>
          <h2 className={s.heading}>내 채널</h2>
          {mine.data && mine.data.length > 0 ? (
            <ChannelLinks channels={mine.data} />
          ) : mine.data ? (
            <p className={s.hint}>가입한 채널이 없어요. 채널에 가입하면 여기에 모여요.</p>
          ) : null}
        </div>
      )}
      <h2 className={s.heading}>인기 채널</h2>
      <ul className={s.list}>
        {data
          ? data
              .filter((c) => !joined.has(c.slug))
              .slice(0, 10)
              .map((c) => (
                <li key={c.slug}>
                  <NavLink to={`/c/${c.slug}`} className={s.channel} onPointerEnter={preload.channel}>
                    <ChannelIcon slug={c.slug} name={c.name} size={26} />
                    <span className={s.channelName}>{c.name}</span>
                  </NavLink>
                </li>
              ))
          : Array.from({ length: 6 }, (_, i) => (
              <li key={i} className={s.channel}>
                <span className={ui.skeleton} style={{ width: 26, height: 26 }} />
                <span className={ui.skeleton} style={{ width: 90, height: 16 }} />
              </li>
            ))}
      </ul>
      <Link to="/channels" className={s.more} onPointerEnter={preload.channels}>
        모든 채널 보기 →
      </Link>
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
      <ol className={s.list}>
        {data.map((post, i) => (
          <li key={post.id}>
            <Link to={`/posts/${post.id}`} state={{ summary: post }} className={s.rank} onPointerEnter={preload.post}>
              <span className={s.rankNo}>{i + 1}</span>
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
    </section>
  );
}
