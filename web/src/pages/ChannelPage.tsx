import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ApiError,
  compact,
  timeAgo,
  useAuth,
  useChannel,
  useChannelPosts,
  useMembership,
  useNotices,
  type ChannelDetail,
  type PostSort,
  type PostSummary,
} from '@loop/shared';
import { toast } from '../components/Toast';
import { useAuthState } from '../lib/authNav';
import { Dropdown } from '../components/Dropdown';
import { ChevronDownIcon, ChevronUpIcon, PinIcon, SearchIcon } from '../components/Icons';
import { Pagination } from '../components/Pagination';
import { scrollToElement } from '../lib/scroll';
import { useSettings } from '../lib/settings';
import { ChannelIcon } from '../components/ChannelIcon';
import { ChannelIntro } from '../components/ChannelIntro';
import { BookmarkButton, JoinButton } from '../components/JoinButton';
import { Page } from '../components/Layout';
import { PostItem, PostListSkeleton } from '../components/PostList';
import { PopularCard } from '../components/Sidebar';
import { preload } from '../lib/preload';
import { ui } from '../components/ui';
import s from './pages.styles';
import NotFoundPage from './NotFoundPage';
import { cn } from '../lib/cn';

const SORT_OPTIONS: { value: PostSort; label: string }[] = [
  { value: 'latest', label: '최신순' },
  { value: 'likes', label: '공감순' },
  { value: 'comments', label: '댓글순' },
  { value: 'views', label: '조회순' },
];

/**
 * 공지(운영진 전용 카테고리 글): 전체 탭 맨 위에 고정. 많아져도 글 목록을 가리지 않게 하나만 보여 주고
 * 나머지는 채널 소개처럼 '⌄ 더 보기'로 펼친다.
 */
function Notices({ notices }: { notices: PostSummary[] }) {
  const [open, setOpen] = useState(false);
  if (notices.length === 0) return null;
  const shown = open ? notices : notices.slice(0, 1);
  return (
    <div className="border-b border-line bg-pressed">
      <ul className="list-none m-0 p-0">
        {shown.map((n) => (
          <li key={n.id}>
            <Link
              to={`/posts/${n.id}`}
              state={{ summary: n }}
              className="group flex items-center gap-2 px-5 py-3 text-[15px] transition-colors hover:bg-field"
              onPointerEnter={preload.post}
            >
              <span className="flex-none inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] bg-primary-weak text-primary text-xs font-bold [&>svg]:w-3.5 [&>svg]:h-3.5">
                <PinIcon />
                {n.categoryName ?? '공지'}
              </span>
              <span className="min-w-0 truncate font-semibold text-fg-strong group-hover:text-primary">{n.title}</span>
              <time className="flex-none ml-auto pl-2 text-xs text-fg-weak" dateTime={n.createdAt}>
                {timeAgo(n.createdAt)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
      {notices.length > 1 && (
        <div className="flex justify-center">
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1.5 text-sm font-semibold text-fg-weak transition-colors hover:text-fg-sub [&>svg]:w-4 [&>svg]:h-4"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
            {open ? '공지 접기' : `공지 ${notices.length - 1}개 더 보기`}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 볼 수 없는 채널: 비공개(초대 코드로 팔로우) · 19세 이상(설정에서 나이 확인)
 */
function LockedGate({ channel }: { channel: ChannelDetail }) {
  const { isLoggedIn, user } = useAuth();
  const authState = useAuthState();
  const join = useMembership(channel.slug);
  const [code, setCode] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 4) return;
    join.mutate(
      { code: code.trim() },
      {
        onSuccess: () => toast(`${channel.name} 채널을 팔로우했어요`),
        onError: (err) => toast(err.message),
      },
    );
  };
  if (channel.locked === 'adult') {
    return (
      <section className={cn(ui.card, 'flex flex-col items-center px-6 py-14 text-center')}>
        <span className="text-[52px] leading-none" role="img" aria-label="만 19세 이상">
          🔞
        </span>
        <h2 className="mt-4 mb-1.5 text-xl font-bold text-fg-strong">만 19세 이상만 볼 수 있는 채널이에요</h2>
        <p className="mt-0 mb-6 text-fg-sub">
          {user?.ageChecked ? '나이 확인 결과 만 19세 미만이라 볼 수 없어요.' : '설정에서 생년월일로 나이를 확인하면 볼 수 있어요.'}
        </p>
        {!isLoggedIn ? (
          <Link to="/login" state={authState} className={cn(ui.button, ui.primary)}>
            로그인
          </Link>
        ) : (
          !user?.ageChecked && (
            <Link to="/me/settings" className={cn(ui.button, ui.primary)}>
              나이 확인하러 가기
            </Link>
          )
        )}
      </section>
    );
  }
  return (
    <section className={cn(ui.card, 'flex flex-col items-center px-6 py-14 text-center')}>
      <span className="grid place-items-center w-14 h-14 rounded-full bg-field text-2xl" aria-hidden>
        🔒
      </span>
      <h2 className="mt-4 mb-1.5 text-xl font-bold text-fg-strong">비공개 채널이에요</h2>
      <p className="mt-0 mb-6 text-fg-sub">초대받은 사람만 볼 수 있어요. 받은 초대 링크를 열거나 초대 코드를 입력해 주세요.</p>
      {isLoggedIn ? (
        <form className="flex w-full max-w-[340px] gap-2" onSubmit={submit}>
          <input
            className={cn(ui.input, 'flex-1 text-center tracking-[0.2em] uppercase')}
            placeholder="초대 코드"
            aria-label="초대 코드"
            maxLength={16}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button type="submit" className={cn(ui.button, ui.primary)} disabled={code.length < 4 || join.isPending}>
            팔로우
          </button>
        </form>
      ) : (
        <Link to="/login" state={authState} className={cn(ui.button, ui.primary)}>
          로그인하고 초대 코드 입력하기
        </Link>
      )}
    </section>
  );
}

export default function ChannelPage() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { isLoggedIn } = useAuth();
  const { data: channel, error, isPlaceholderData } = useChannel(slug);
  const categories = channel?.categories ?? [];
  const raw = Number(params.get('category'));
  // 지워진 카테고리 주소로 들어오면 전체 탭으로 보여 준다
  const active = categories.find((c) => c.id === raw);
  const q = params.get('q') ?? '';
  const sort = (SORT_OPTIONS.some((o) => o.value === params.get('sort')) ? params.get('sort') : 'latest') as PostSort;
  const page = Math.max(1, Number(params.get('page')) || 1);
  // 전체 탭(검색 중이 아닐 때): 공지는 위에 고정하고 목록에서는 뺀다
  const pinNotices = !active && !q;
  // 잠긴 채널(비공개 · 19세 이상)은 글을 받지 않는다 (서버도 403)
  const open = !!channel && !channel.locked && !isPlaceholderData;
  const notices = useNotices(slug, pinNotices && open);
  const list = useChannelPosts(
    {
      channel: slug,
      category: active?.id,
      q,
      sort,
      page,
      excludeNotices: pinNotices,
    },
    open,
  );
  const { showExcerpt } = useSettings();
  /** 주소(?category·q·sort·page)를 고친다. 페이지 말고 다른 걸 바꾸면 1페이지로 */
  const update = (next: { category?: number | null; q?: string; sort?: PostSort; page?: number }) => {
    const p = new URLSearchParams(params);
    const set = (k: string, v: string | number | null | undefined) => (v ? p.set(k, String(v)) : p.delete(k));
    if ('category' in next) set('category', next.category);
    if ('q' in next) set('q', next.q?.trim());
    if ('sort' in next) set('sort', next.sort === 'latest' ? null : next.sort);
    set('page', 'page' in next && next.page !== 1 ? next.page : null);
    setParams(p, { replace: true });
  };
  const selectTab = (id?: number) => update({ category: id ?? null });
  const headerRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement>(null);

  // 검색창의 검색어 · 카테고리는 고르는 동안엔 그대로 두고, 검색(엔터 · 검색 버튼)할 때 함께 주소에 반영한다
  const [search, setSearch] = useState(q);
  const [draftCategory, setDraftCategory] = useState<number | null>(active?.id ?? null);
  useEffect(() => setSearch(q), [q]);
  useEffect(() => setDraftCategory(active?.id ?? null), [active?.id]);
  const draft = categories.find((c) => c.id === draftCategory);
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    update({ q: search, category: draftCategory });
  };

  const goPage = (n: number) => {
    update({ page: n });
    if (listRef.current) scrollToElement(listRef.current);
  };

  if (error instanceof ApiError && error.status === 404) {
    return <NotFoundPage message="없거나 사라진 채널이에요" />;
  }

  // 글쓰기는 팔로우한 사람만, 운영진 전용 카테고리 탭에서는 운영진만
  const canWrite = !!channel?.joined && (!active?.ownerOnly || channel.staff);
  const writeParams = new URLSearchParams({ channel: slug });
  if (active) writeParams.set('category', String(active.id));
  const writeTo = `/write?${writeParams}`;

  return (
    <Page variant="twoRight" right={<>{open && <PopularCard channel={slug} title="이 채널 인기글" />}</>}>
      <section className={ui.card} ref={headerRef}>
        <div className={cn(s.banner, categories.length === 0 && 'pb-6')}>
          {channel ? (
            <>
              <div className={s.bannerTop}>
                <ChannelIcon channel={channel} size={56} />
                <div className={s.bannerInfo}>
                  <h1 className={s.bannerName}>
                    {channel.name}
                    {channel.visibility === 'private' && (
                      <span className={cn(ui.badge, 'ml-2 align-[3px]')} title="초대받은 사람만 팔로우할 수 있는 채널">
                        🔒 비공개
                      </span>
                    )}
                    {channel.adult && (
                      <span className="ml-1.5 text-[20px] align-[1px]" title="만 19세 이상" role="img" aria-label="만 19세 이상">
                        🔞
                      </span>
                    )}
                  </h1>
                  <div className={s.bannerSlug}>
                    팔로워 {compact(channel.memberCount)}명 · 글 {compact(channel.postCount)}개
                  </div>
                </div>
                <div className={s.bannerActions}>
                  {!isPlaceholderData && !channel.locked && <BookmarkButton channel={channel} />}
                  {!isPlaceholderData && !channel.locked && <JoinButton channel={channel} />}
                  {channel.canManage && (
                    <Link to={`/c/${slug}/manage`} className={cn(ui.button, ui.ghost)} onPointerEnter={preload.channelManage}>
                      채널 관리
                    </Link>
                  )}
                  {canWrite && isLoggedIn && (
                    <Link to={writeTo} className={cn(ui.button, ui.primary)} onPointerEnter={preload.write}>
                      글쓰기
                    </Link>
                  )}
                </div>
              </div>
              {channel.description && <ChannelIntro key={channel.slug} source={channel.description} headerRef={headerRef} />}
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
              <button type="button" key={c.id} role="tab" className={ui.tab} aria-selected={active?.id === c.id} onClick={() => selectTab(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </section>
      {channel?.locked && !isPlaceholderData && <LockedGate channel={channel} />}
      {open && (
        <section className={ui.card} ref={listRef}>
          {/* 목록 위: 카테고리 · 정렬 · 검색(제목·본문) · 검색 버튼 (공지는 정렬과 상관없이 위에 고정) */}
          <form role="search" className="flex flex-wrap items-center gap-2 px-5 pt-4 pb-3 border-b border-line" onSubmit={submitSearch}>
            {categories.length > 0 && (
              <Dropdown
                label="카테고리"
                value={draftCategory}
                options={[
                  { value: null, label: '전체 카테고리' },
                  ...categories.map((c) => ({
                    value: c.id as number | null,
                    label: c.name,
                  })),
                ]}
                onChange={setDraftCategory}
                className="w-[150px] max-[520px]:flex-1"
              />
            )}
            <Dropdown
              label="정렬"
              value={sort}
              options={SORT_OPTIONS}
              onChange={(v) => update({ sort: v })}
              className="w-[120px] max-[520px]:flex-1"
            />
            <label className="relative flex-1 min-w-[180px]">
              <SearchIcon className="absolute left-0 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-fg-weak pointer-events-none" />
              <input
                type="search"
                className={cn(ui.input, 'pl-7')}
                placeholder={draft ? `'${draft.name}'에서 검색` : '이 채널에서 검색'}
                aria-label="채널 글 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={50}
              />
            </label>
            <button type="submit" className={cn(ui.button, ui.primary)}>
              검색
            </button>
          </form>
          {pinNotices && notices.data && <Notices notices={notices.data} />}
          {list.isPending ? (
            <PostListSkeleton />
          ) : list.isError ? (
            <div className={ui.empty}>
              불러오지 못했어요
              <div style={{ marginTop: 12 }}>
                <button type="button" className={cn(ui.button, ui.secondary, ui.small)} onClick={() => list.refetch()}>
                  다시 시도
                </button>
              </div>
            </div>
          ) : list.data.items.length === 0 ? (
            <div className={ui.empty}>
              {q ? `'${q}'(으)로 찾은 글이 없어요` : active ? `'${active.name}'에 아직 글이 없어요` : '이 채널의 첫 글을 남겨 보세요!'}
            </div>
          ) : (
            <>
              {/* 페이지를 넘기는 동안에는 이전 페이지를 흐리게 보여 준다 */}
              <ul className={cn('list-none m-0 p-0 transition-opacity', list.isPlaceholderData && 'opacity-60')}>
                {list.data.items.map((post) => (
                  <PostItem key={post.id} post={post} badge="category" showExcerpt={showExcerpt} />
                ))}
              </ul>
              <Pagination page={list.data.page} pages={list.data.pages} onChange={goPage} />
            </>
          )}
        </section>
      )}
    </Page>
  );
}
