import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useChannel, useFeed } from '../api/queries';
import { ChannelIcon } from '../components/ChannelIcon';
import { Main, SubHeader } from '../components/Layout';
import { PostList } from '../components/PostList';
import { compact } from '../lib/format';
import { preload } from '../lib/preload';
import ch from '../components/Channel.module.css';
import ui from '../components/ui.module.css';
import d from './PostDetail.module.css';
import { PopularSection, WriteFab } from './HomePage';
import NotFoundPage from './NotFoundPage';

export default function ChannelPage() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: channel, error } = useChannel(slug);
  const categories = channel?.categories ?? [];
  const raw = Number(params.get('category'));
  // 지워진 카테고리 주소로 들어오면 전체 탭으로 보여 준다
  const active = categories.find((c) => c.id === raw);
  const feed = useFeed({ channel: slug, category: active?.id });
  const selectTab = (id?: number) => setParams(id ? { category: String(id) } : {}, { replace: true });

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
            <Link to={`/c/${slug}/manage`} className={d.headerAction} style={{ lineHeight: '36px' }}
              onPointerEnter={preload.channelManage}>
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
              {categories.length > 0 && (
                <div className={`${ui.chips} ${ch.heroTabs}`} role="tablist" aria-label="카테고리">
                  <button role="tab" className={ui.chip} aria-pressed={!active} aria-selected={!active} onClick={() => selectTab()}>
                    전체
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      role="tab"
                      className={ui.chip}
                      aria-pressed={active?.id === c.id}
                      aria-selected={active?.id === c.id}
                      onClick={() => selectTab(c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className={ch.heroTop}>
              <div className={`${ch.heroIcon} ${ui.skeleton}`} />
              <div className={ui.skeleton} style={{ width: 120, height: 24 }} />
            </div>
          )}
        </section>
        {!active && <PopularSection channel={slug} />}
        <section className={ui.card}>
          <h2 className={ui.sectionTitle}>{active ? active.name : '최신 글'}</h2>
          <PostList
            query={feed}
            badge="category"
            empty={active ? `'${active.name}'에 아직 글이 없어요` : '이 채널의 첫 글을 남겨 보세요!'}
          />
        </section>
      </Main>
      {/* 관리자 전용 카테고리 탭에서는 관리자에게만 글쓰기 버튼을 보여 준다 */}
      {(!active?.ownerOnly || channel?.mine) && <WriteFab channel={slug} category={active?.id} />}
    </>
  );
}
