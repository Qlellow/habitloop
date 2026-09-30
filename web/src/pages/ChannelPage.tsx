import { useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, compact, useAuth, useChannel, useFeed } from '@loop/shared';
import { ChannelIcon } from '../components/ChannelIcon';
import { ChannelIntro } from '../components/ChannelIntro';
import { BookmarkButton, JoinButton } from '../components/JoinButton';
import { Page } from '../components/Layout';
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
  const headerRef = useRef<HTMLElement>(null);

  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundPage message="없거나 사라진 채널이에요" />;
  }

  // 글쓰기는 팔로우한 사람만, 운영진 전용 카테고리 탭에서는 운영진만
  const canWrite = !!channel?.joined && (!active?.ownerOnly || channel.staff);
  const writeParams = new URLSearchParams({ channel: slug });
  if (active) writeParams.set('category', String(active.id));
  const writeTo = `/write?${writeParams}`;

  return (
    <Page
      variant="twoRight"
      right={
        <>
          <PopularCard channel={slug} title="이 채널 인기글" />
        </>
      }
    >
      <section className={ui.card} ref={headerRef}>
        <div className={cn(s.banner, categories.length === 0 && 'pb-6')}>
          {channel ? (
            <>
              <div className={s.bannerTop}>
                <ChannelIcon channel={channel} size={56} />
                <div className={s.bannerInfo}>
                  <h1 className={s.bannerName}>{channel.name}</h1>
                  <div className={s.bannerSlug}>
                    팔로워 {compact(channel.memberCount)}명 · 글 {compact(channel.postCount)}개
                  </div>
                </div>
                <div className={s.bannerActions}>
                  {!isPlaceholderData && <BookmarkButton channel={channel} />}
                  {!isPlaceholderData && <JoinButton channel={channel} />}
                  {channel.canManage && (
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
              {channel.description && (
                <ChannelIntro key={channel.slug} source={channel.description} headerRef={headerRef} />
              )}
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
