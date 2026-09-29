import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, compact, useAuth, useChannel, useFeed } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { BookmarkButton, JoinButton } from '../components/JoinButton';
import { Footer, Page } from '../components/Layout';
import { PostList } from '../components/PostList';
import { PopularCard } from '../components/Sidebar';
import { preload } from '../lib/preload';
import { ui } from '../components/ui';
import s from './pages.styles';
import NotFoundPage from './NotFoundPage';
import { cn } from '../lib/cn';

export default function ChannelPage() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { isLoggedIn } = useAuth();
  const { data: channel, error, isPlaceholderData } = useChannel(slug);
  const categories = channel?.categories ?? [];
  const raw = Number(params.get('category'));
  // 지워진 카테고리 주소로 들어오면 전체 탭으로 보여 준다
  const active = categories.find((c) => c.id === raw);
  const feed = useFeed({ channel: slug, category: active?.id });
  const selectTab = (id?: number) => setParams(id ? { category: String(id) } : {}, { replace: true });

  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundPage message="없거나 사라진 채널이에요" />;
  }

  // 글쓰기는 가입한 사람만, 관리자 전용 카테고리 탭에서는 관리자만
  const canWrite = !!channel?.joined && (!active?.ownerOnly || channel.mine);
  const writeParams = new URLSearchParams({ channel: slug });
  if (active) writeParams.set('category', String(active.id));
  const writeTo = `/write?${writeParams}`;

  return (
    <Page
      variant="twoRight"
      right={
        <>
          <PopularCard channel={slug} title="이 채널 인기글" />
          <Footer />
        </>
      }
    >
      <section className={ui.card}>
        <div className={s.banner}>
          {channel ? (
            <>
              <div className={s.bannerTop}>
                <ChannelIcon slug={channel.slug} name={channel.name} size={56} />
                <div className={s.bannerInfo}>
                  <h1 className={s.bannerName}>{channel.name}</h1>
                  <div className={s.bannerSlug}>c/{channel.slug}</div>
                </div>
                <div className={s.bannerActions}>
                  {!isPlaceholderData && <BookmarkButton channel={channel} />}
                  {!isPlaceholderData && <JoinButton channel={channel} />}
                  {channel.mine && (
                    <Link
                      to={`/c/${slug}/manage`}
                      className={cn(ui.button, ui.ghost)}
                      onPointerEnter={preload.channelManage}
                    >
                      채널 관리
                    </Link>
                  )}
                  {canWrite && isLoggedIn && (
                    <Link
                      to={writeTo}
                      className={cn(ui.button, ui.primary)}
                      onPointerEnter={preload.write}
                    >
                      글쓰기
                    </Link>
                  )}
                </div>
              </div>
              {channel.description && <p className={s.bannerDesc}>{channel.description}</p>}
              <div className={s.bannerMeta}>
                멤버 {compact(channel.memberCount)}명 · 글 {compact(channel.postCount)}개
                {channel.ownerNickname && ` · 만든 사람 ${channel.ownerNickname}`}
              </div>
            </>
          ) : (
            <div className={s.bannerTop} style={{ paddingBottom: 20 }}>
              <div className={ui.skeleton} style={{ width: 56, height: 56 }} />
              <div className={ui.skeleton} style={{ width: 160, height: 26 }} />
            </div>
          )}
        </div>
        {categories.length > 0 && (
          <div className={ui.tabs} role="tablist" aria-label="카테고리" style={{ padding: '0 14px' }}>
            <button type="button" role="tab" className={ui.tab} aria-selected={!active} onClick={() => selectTab()}>
              전체
            </button>
            {categories.map((c) => (
              <button
                type="button"
                key={c.id}
                role="tab"
                className={ui.tab}
                aria-selected={active?.id === c.id}
                onClick={() => selectTab(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </section>
      <section className={ui.card}>
        <PostList
          query={feed}
          badge="category"
          empty={active ? `'${active.name}'에 아직 글이 없어요` : '이 채널의 첫 글을 남겨 보세요!'}
        />
      </section>
    </Page>
  );
}
