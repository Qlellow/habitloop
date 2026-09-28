import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useChannel, useFeed } from '../api/queries';
import { ChannelIcon } from '../components/ChannelIcon';
import { Main, SubHeader } from '../components/Layout';
import { PostList } from '../components/PostList';
import { compact } from '../lib/format';
import ch from '../components/Channel.module.css';
import ui from '../components/ui.module.css';
import d from './PostDetail.module.css';
import { PopularSection, WriteFab } from './HomePage';
import NotFoundPage from './NotFoundPage';

export default function ChannelPage() {
  const { slug = '' } = useParams();
  const { data: channel, error } = useChannel(slug);
  const feed = useFeed({ channel: slug });

  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundPage message="없거나 사라진 채널이에요" />;
  }

  return (
    <>
      <SubHeader
        title={channel?.name}
        backTo="/"
        right={
          channel?.mine && (
            <Link to={`/c/${slug}/edit`} className={d.headerAction} style={{ lineHeight: '36px' }}>
              관리
            </Link>
          )
        }
      />
      <Main>
        <section className={`${ui.card} ${ch.hero}`} style={{ marginBottom: 12 }}>
          {channel ? (
            <>
              <div className={ch.heroTop}>
                <ChannelIcon slug={channel.slug} name={channel.name} large />
                <div style={{ minWidth: 0 }}>
                  <h1 className={ch.heroName}>{channel.name}</h1>
                  <div className={ch.heroSlug}>c/{channel.slug}</div>
                </div>
              </div>
              {channel.description && <p className={ch.heroDesc}>{channel.description}</p>}
              <div className={ch.heroMeta}>
                글 {compact(channel.postCount)}개{channel.ownerNickname && ` · 만든 사람 ${channel.ownerNickname}`}
              </div>
            </>
          ) : (
            <div className={ch.heroTop}>
              <div className={`${ch.heroIcon} ${ui.skeleton}`} />
              <div className={ui.skeleton} style={{ width: 120, height: 24 }} />
            </div>
          )}
        </section>
        <PopularSection channel={slug} />
        <section className={ui.card}>
          <h2 className={ui.sectionTitle}>최신 글</h2>
          <PostList query={feed} showChannel={false} empty="이 채널의 첫 글을 남겨 보세요!" />
        </section>
      </Main>
      <WriteFab channel={slug} />
    </>
  );
}
