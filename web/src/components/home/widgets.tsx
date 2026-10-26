import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  compact,
  timeAgo,
  useAuth,
  useChannelPosts,
  useChannels,
  useFeed,
  useMyChannels,
  useMyPet,
  useNotifications,
  usePatPet,
  usePopular,
  useDiscovery,
  useCommunityWeather,
  useReadNotifications,
  useUserProfile,
  PET_STAGES,
  type DiscoveryReason,
  type HomeWidget,
  type HomeWidgetType,
} from '@loop/shared';
import { ChannelIcon } from '../ChannelIcon';
import { UserAvatar } from '../UserAvatar';
import { PostList } from '../PostList';
import { RankMark } from '../Sidebar';
import { SlideHover } from '../SlideHover';
import { PetActor } from '../Pet';
import { NotificationAvatar, notificationMessage } from '../NotificationBell';
import { WeatherSummary } from '../Weather';
import { toast } from '../Toast';
import { preload } from '../../lib/preload';
import { useSettings, periodAt } from '../../lib/settings';
import { ui } from '../ui';
import { cn } from '../../lib/cn';

/**
 * 나만의 홈 위젯 목록. 위젯마다 이름 · 설명 · 기본/최소 크기(칸 · 줄) · 설정 항목 · 그리는 법을 둔다.
 * 새 위젯은 여기와 api/src/users/home-layout.ts 의 WIDGET_TYPES 에 함께 더한다.
 */

export type Options = Record<string, string | number | boolean>;

export type OptionDef =
  | { key: string; label: string; kind: 'switch'; def: boolean; help?: string }
  | { key: string; label: string; kind: 'select'; def: string | number; choices: { value: string | number; label: string }[] }
  | { key: string; label: string; kind: 'channel'; def: string; allowAll?: boolean }
  | { key: string; label: string; kind: 'text'; def: string; max: number; multiline?: boolean; placeholder?: string };

export interface WidgetProps {
  widget: HomeWidget;
  o: Options;
  /** 위젯 안에서 설정을 바로 바꾼다 (메모 글처럼). 편집 중이 아니면 바로 저장된다 */
  setOption: (key: string, value: string | number | boolean) => void;
  editing: boolean;
}

export interface WidgetDef {
  type: HomeWidgetType;
  label: string;
  desc: string;
  /** 카탈로그 아이콘 (글자 하나) */
  glyph: string;
  size: { w: number; h: number };
  min: { w: number; h: number };
  /** 여러 개 놓을 수 있는지 */
  multi?: boolean;
  /** 로그인해야 내용이 보인다 */
  login?: boolean;
  /** 위젯 제목 (설정에서 바꿀 수 있다). 비우면 제목 줄 없이 */
  title: (o: Options) => string;
  /** 제목 줄 오른쪽 '더 보기' 링크 */
  more?: (o: Options) => string | undefined;
  /** 기본으로 내용 높이에 맞춰 늘어나는지 */
  fit?: boolean;
  /** 미리보기 위젯: 안에서 스크롤하지 않는다. 높이 반응형(autoH)이면 높이 = 내용, 아니면 정한 높이에 들어가는 만큼만 */
  preview?: boolean;
  options?: OptionDef[];
  Body: (p: WidgetProps) => ReactNode;
}

/* ───────── 공통 조각 ───────── */

function NeedLogin({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 h-full min-h-[96px] px-4 py-5 text-center text-sm text-fg-sub">
      로그인하면 {what}을(를) 볼 수 있어요
      <Link to="/login" state={{ from: '/' }} className={cn(ui.button, ui.secondary, ui.small)}>
        로그인
      </Link>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 px-5 py-6 text-center text-sm text-fg-weak">{children}</p>;
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="px-5 py-2 flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={ui.skeleton} style={{ height: 16, width: `${90 - ((i * 17) % 35)}%` }} />
      ))}
    </div>
  );
}

const rowLink = 'flex items-center gap-2.5 px-2.5 py-2 rounded-sm min-w-0';

/* ───────── 위젯 ───────── */

function FeedBody({ o }: WidgetProps) {
  const feed = useFeed({});
  const { showExcerpt } = useSettings();
  return <PostList query={feed} empty="아직 글이 없어요. 첫 글을 남겨 보세요!" excerpt={o.excerpt === 'auto' ? showExcerpt : o.excerpt === 'on'} />;
}

function PopularBody({ o }: WidgetProps) {
  const channel = (o.channel as string) || undefined;
  const { data, isPending } = usePopular(channel);
  if (isPending) return <ListSkeleton rows={Number(o.count)} />;
  if (!data?.length) return <Empty>최근 7일 인기글이 아직 없어요</Empty>;
  return (
    <SlideHover className="px-2.5 pb-2.5">
      <ol className="list-none m-0 p-0">
        {data.slice(0, Number(o.count)).map((post, i) => (
          <li key={post.id}>
            <Link to={`/posts/${post.id}`} state={{ summary: post }} className="flex items-center gap-3 px-2.5 py-2.5 rounded-sm" onPointerEnter={preload.post}>
              <RankMark rank={i + 1} />
              <span className="flex-1 min-w-0">
                <span className="line-clamp-2 text-[15px] font-medium text-fg-strong">{post.title}</span>
                <span className="block text-[13px] text-fg-weak">
                  {post.channelName} · 좋아요 {compact(post.likeCount)} · 댓글 {compact(post.commentCount)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </SlideHover>
  );
}

/** 오늘의 발견을 고른 이유 */
export const DISCOVERY_REASON: Record<DiscoveryReason, { icon: string; label: string }> = {
  talk: { icon: '💬', label: '대화가 오가는 글' },
  warm: { icon: '💛', label: '조용히 공감받는 글' },
  long: { icon: '📜', label: '정성 가득한 긴 글' },
  hidden: { icon: '🔍', label: '아직 덜 알려진 글' },
};

const monthDay = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return `${m}월 ${d}일`;
};

/** 오늘의 발견: 반응은 적어도 흥미로운 글 하나를 크게, 아래에 지난 발견 */
function DiscoveryBody({ o }: WidgetProps) {
  const { data, isPending } = useDiscovery();
  if (isPending) return <ListSkeleton rows={3} />;
  const post = data?.post;
  const reason = data?.reason ? DISCOVERY_REASON[data.reason] : undefined;
  const past = o.past ? (data?.past ?? []).slice(0, 3) : [];
  return (
    <div className="px-5 pb-4">
      {post ? (
        <Link to={`/posts/${post.id}`} state={{ summary: post }} className="discovery-card group" onPointerEnter={preload.post}>
          <span className="discovery-sparkles" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-fg-weak">
            <span className="tabular-nums">{monthDay(data!.day)}</span>
            {reason && (
              <span className="discovery-reason">
                <span aria-hidden>{reason.icon}</span> {reason.label}
              </span>
            )}
          </span>
          <span className="block mt-2 text-[16px] leading-snug font-bold text-fg-strong line-clamp-2 group-hover:text-primary">{post.title}</span>
          {post.excerpt && <span className="block mt-1 text-[13px] leading-relaxed text-fg-sub line-clamp-3">{post.excerpt}</span>}
          <span className="flex items-center gap-1.5 mt-3 text-[12px] text-fg-weak min-w-0">
            <UserAvatar nickname={post.authorNickname} avatarUrl={post.authorAvatar ?? undefined} size={18} />
            <span className="truncate">
              {post.authorNickname} · {post.channelName}
            </span>
            <span className="ml-auto flex-none tabular-nums">
              ♡ {compact(post.likeCount)} · 댓글 {compact(post.commentCount)}
            </span>
          </span>
        </Link>
      ) : (
        <Empty>오늘은 소개할 숨은 글을 아직 못 찾았어요</Empty>
      )}
      {past.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[12px] font-semibold text-fg-weak">지난 발견</div>
          <ul className="list-none m-0 p-0">
            {past.map((p) => (
              <li key={p.day}>
                <Link to={`/posts/${p.post.id}`} className="flex items-baseline gap-2 py-1 text-[13px] text-fg-sub hover:text-fg-strong" onPointerEnter={preload.post}>
                  <span className="flex-none w-11 text-[12px] text-fg-weak tabular-nums">{p.day.slice(5).replace('-', '/')}</span>
                  <span className="truncate">{p.post.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 커뮤니티 감정 날씨: 날씨 그림 · 체감 온도 · 한 줄 · 감정 막대 */
function WeatherBody({ o }: WidgetProps) {
  const { data, isPending } = useCommunityWeather();
  if (isPending) return <ListSkeleton rows={2} />;
  if (!data) return <Empty>날씨를 아직 못 쟀어요</Empty>;
  return <WeatherSummary report={data} bars={!!o.bars} />;
}

function ChannelGrid({ channels }: { channels: { slug: string; name: string; iconVersion?: number }[] }) {
  return (
    <ul className="list-none m-0 px-3 pb-3 grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1.5">
      {channels.map((c) => (
        <li key={c.slug}>
          <Link
            to={`/c/${c.slug}`}
            onPointerEnter={preload.channel}
            className="flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-md text-center transition-colors hover:bg-field"
          >
            <ChannelIcon channel={c as never} size={36} />
            <span className="w-full truncate text-[13px] font-medium text-fg">{c.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ChannelRows({ channels, rank }: { channels: { slug: string; name: string }[]; rank?: boolean }) {
  return (
    <SlideHover className="px-2.5 pb-2.5">
      <ul className="list-none m-0 p-0">
        {channels.map((c, i) => (
          <li key={c.slug}>
            <NavLink to={`/c/${c.slug}`} className={cn(rowLink, 'text-[15px] font-medium text-fg')} onPointerEnter={preload.channel}>
              {rank && <RankMark rank={i + 1} />}
              <ChannelIcon channel={c as never} size={26} />
              <span className="flex-1 min-w-0 truncate">{c.name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </SlideHover>
  );
}

function FollowedBody({ o }: WidgetProps) {
  const { isLoggedIn } = useAuth();
  const mine = useMyChannels(isLoggedIn);
  if (!isLoggedIn) return <NeedLogin what="팔로우한 채널" />;
  if (!mine.data) return <ListSkeleton rows={3} />;
  const followed = mine.data.filter((c) => o.owned || !c.owner);
  if (!followed.length) return <Empty>팔로우한 채널이 없어요. 채널을 팔로우하면 여기에 모여요.</Empty>;
  return o.view === 'grid' ? <ChannelGrid channels={followed} /> : <ChannelRows channels={followed} />;
}

function HotChannelsBody({ o }: WidgetProps) {
  const { data } = useChannels();
  if (!data) return <ListSkeleton rows={5} />;
  const list = data.slice(0, Number(o.count));
  return o.view === 'grid' ? <ChannelGrid channels={list} /> : <ChannelRows channels={list} rank />;
}

function NotificationsBody({ o }: WidgetProps) {
  const { isLoggedIn } = useAuth();
  const list = useNotifications(isLoggedIn);
  const read = useReadNotifications();
  const navigate = useNavigate();
  if (!isLoggedIn) return <NeedLogin what="내 알림" />;
  if (list.isPending) return <ListSkeleton />;
  const items = (list.data?.pages.flatMap((p) => p.items) ?? []).filter((n) => !o.unread || !n.read).slice(0, Number(o.count));
  if (!items.length) return <Empty>{o.unread ? '안 읽은 알림이 없어요' : '아직 알림이 없어요'}</Empty>;
  return (
    <ul className="list-none m-0 px-2 pb-2 flex flex-col gap-0.5">
      {items.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => {
              if (!n.read) read.mutate(n.id);
              navigate(`/posts/${n.post.id}`);
            }}
            className={cn('w-full flex gap-2.5 px-2.5 py-2 rounded-sm text-left transition-colors hover:bg-field', !n.read && 'bg-primary-weak')}
          >
            <NotificationAvatar n={n} size={30} />
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] leading-[1.45] text-fg">{notificationMessage(n)}</span>
              <span className="block truncate text-[12px] text-fg-weak">
                {n.post.title} · {timeAgo(n.createdAt)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ActivityBody() {
  const { user, isLoggedIn } = useAuth();
  const { data } = useUserProfile(user?.id ?? '');
  if (!isLoggedIn || !user) return <NeedLogin what="내 활동" />;
  const stats = [
    ['글', data?.postCount, '/me/posts'],
    ['댓글', data?.commentCount, '/me/posts'],
    ['포인트', user.points ?? 0, '/me/points'],
    ['배지', data?.badges?.length, `/u/${user.id}`],
  ] as const;
  return (
    <div className="px-5 pb-4">
      <Link to={`/u/${user.id}`} className="flex items-center gap-2.5 mb-3 group">
        <UserAvatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={36} />
        <span className="min-w-0">
          <span className="block truncate font-bold text-fg-strong group-hover:underline underline-offset-2">{user.nickname}</span>
          <span className="block text-[12px] text-fg-weak">내 프로필 보기</span>
        </span>
      </Link>
      <div className="grid grid-cols-4 gap-1.5">
        {stats.map(([label, n, to]) => (
          <Link key={label} to={to} className="px-1 py-2 rounded-md bg-field text-center transition-colors hover:bg-field-hover">
            <span className="block text-[16px] font-bold text-fg-strong tabular-nums">{n == null ? '·' : compact(n)}</span>
            <span className="block text-[11px] text-fg-weak">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ChannelPostsBody({ o }: WidgetProps) {
  const slug = o.channel as string;
  const { data, isPending, isError } = useChannelPosts({ channel: slug, page: 1 }, !!slug);
  if (!slug) return <Empty>설정에서 채널을 골라 주세요</Empty>;
  if (isError) return <Empty>이 채널을 볼 수 없어요</Empty>;
  if (isPending) return <ListSkeleton rows={Number(o.count)} />;
  const items = data?.items.slice(0, Number(o.count)) ?? [];
  if (!items.length) return <Empty>아직 글이 없어요</Empty>;
  return (
    <SlideHover className="px-2.5 pb-2.5">
      <ul className="list-none m-0 p-0">
        {items.map((p) => (
          <li key={p.id}>
            <Link to={`/posts/${p.id}`} state={{ summary: p }} className="block px-2.5 py-2 rounded-sm" onPointerEnter={preload.post}>
              <span className="block truncate text-[15px] font-medium text-fg-strong">{p.title}</span>
              {o.excerpt && p.excerpt && <span className="block truncate text-[13px] text-fg-sub">{p.excerpt}</span>}
              <span className="block text-[12px] text-fg-weak">
                {p.authorNickname} · {timeAgo(p.createdAt)} · 좋아요 {compact(p.likeCount)} · 댓글 {compact(p.commentCount)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SlideHover>
  );
}

function PetBody() {
  const { isLoggedIn } = useAuth();
  const { data: pet, isPending } = useMyPet(isLoggedIn);
  const pat = usePatPet();
  const [pats, setPats] = useState(0);
  if (!isLoggedIn) return <NeedLogin what="내 펫" />;
  if (isPending) return <ListSkeleton rows={2} />;
  if (!pet)
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full px-4 py-5 text-center text-sm text-fg-sub">
        아직 펫이 없어요
        <Link to="/me/pet" className={cn(ui.button, ui.secondary, ui.small)}>
          펫 데려오기
        </Link>
      </div>
    );
  const span = pet.nextXp - pet.levelXp;
  const doPat = () => {
    setPats((n) => n + 1);
    if (!pat.isPending) pat.mutate(undefined, { onSuccess: (r) => r.gained && toast(`쓰다듬었어요 · 경험치 +${r.xp}`), onError: (e) => toast(e.message) });
  };
  return (
    <div className="flex items-center gap-3 px-5 pb-4">
      <div className="flex-none">
        <PetActor pet={pet} size={4} pats={pats} onPet={doPat} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <Link to="/me/pet" className="truncate font-bold text-fg-strong hover:underline underline-offset-2">
            {pet.name}
          </Link>
          <span className="text-[13px] font-bold text-primary">Lv.{pet.level}</span>
        </div>
        <div className="text-[12px] text-fg-weak">{PET_STAGES[pet.stage].label}</div>
        <div className="pet-xp mt-2" role="progressbar" aria-label="다음 레벨까지" aria-valuemin={0} aria-valuemax={span} aria-valuenow={pet.xp - pet.levelXp}>
          <i style={{ width: `${Math.max(2, Math.min(100, span ? ((pet.xp - pet.levelXp) / span) * 100 : 100))}%` }} />
        </div>
        <button type="button" className={cn(ui.button, ui.ghost, ui.small, 'mt-2.5')} onClick={doPat}>
          쓰다듬기
        </button>
      </div>
    </div>
  );
}

function MakeChannelBody() {
  const { isLoggedIn } = useAuth();
  return (
    <div className="px-5 pb-5">
      <p className="mt-0 mb-3.5 text-sm text-fg-sub">좋아하는 주제로 사람들이 모이는 공간을 만들 수 있어요.</p>
      <Link
        to={isLoggedIn ? '/channels/new' : '/login'}
        state={isLoggedIn ? undefined : { from: '/channels/new' }}
        className={cn(ui.button, ui.secondary, ui.full)}
        onPointerEnter={preload.channelForm}
      >
        채널 만들기
      </Link>
    </div>
  );
}

const GREETING = { morning: '좋은 아침이에요', day: '좋은 오후예요', evening: '편안한 저녁이에요', dawn: '늦은 밤이네요' } as const;

function useNow(ms: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function GreetingBody({ o }: WidgetProps) {
  const { user } = useAuth();
  const now = useNow(o.seconds ? 1000 : 15_000);
  const hello = (o.message as string) || `${GREETING[periodAt(now)]}${user ? `, ${user.nickname}님` : ''}`;
  return (
    <div className={cn('flex h-full items-center gap-4 px-6 py-4', o.align === 'center' && 'justify-center text-center flex-col gap-1')}>
      <div className="flex-1 min-w-0">
        <div className="text-[20px] font-bold text-fg-strong leading-snug">{hello}</div>
        {o.date && (
          <div className="mt-0.5 text-sm text-fg-sub">{now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</div>
        )}
      </div>
      {o.clock && (
        <div className="text-[28px] font-bold text-primary tabular-nums tracking-tight">
          {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: o.seconds ? '2-digit' : undefined, hour12: false })}
        </div>
      )}
    </div>
  );
}

export const MEMO_COLORS = {
  yellow: { label: '노랑', bg: '#fff6c9', fg: '#5c4a00' },
  green: { label: '초록', bg: '#dcf7e6', fg: '#0f4d2b' },
  blue: { label: '파랑', bg: '#e1efff', fg: '#103f7a' },
  pink: { label: '분홍', bg: '#ffe3ec', fg: '#7a1a3a' },
  plain: { label: '기본', bg: 'var(--field)', fg: 'var(--text)' },
} as const;

function MemoBody({ o, setOption, editing }: WidgetProps) {
  const [text, setText] = useState(String(o.text ?? ''));
  useEffect(() => setText(String(o.text ?? '')), [o.text]);
  const color = MEMO_COLORS[(o.color as keyof typeof MEMO_COLORS) ?? 'yellow'] ?? MEMO_COLORS.yellow;
  return (
    <div className="h-full px-3 pb-3 pt-0.5 flex">
      <textarea
        className="home-memo flex-1 w-full min-h-[64px] resize-none rounded-md border-0 px-3.5 py-3 text-[14px] leading-[1.6] outline-none focus-visible:outline-2 focus-visible:outline-primary"
        style={{ background: color.bg, color: color.fg }}
        value={text}
        maxLength={500}
        placeholder="메모를 적어 두세요 (이 홈에 저장돼요)"
        readOnly={editing}
        aria-label="메모"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== (o.text ?? '') && setOption('text', text)}
      />
    </div>
  );
}

export const SHORTCUTS = [
  { key: 'write', label: '글쓰기', to: '/write', glyph: '✎' },
  { key: 'channels', label: '채널 둘러보기', to: '/channels', glyph: '◎' },
  { key: 'myChannels', label: '내 채널', to: '/me/channels', glyph: '★' },
  { key: 'myPosts', label: '내 글', to: '/me/posts', glyph: '≡' },
  { key: 'points', label: '포인트', to: '/me/points', glyph: 'P' },
  { key: 'pet', label: '펫', to: '/me/pet', glyph: '◕' },
  { key: 'settings', label: '설정', to: '/me/settings', glyph: '⚙' },
  { key: 'newChannel', label: '채널 만들기', to: '/channels/new', glyph: '+' },
] as const;

function ShortcutsBody({ o }: WidgetProps) {
  const list = SHORTCUTS.filter((s) => o[s.key]);
  if (!list.length) return <Empty>설정에서 바로가기를 골라 주세요</Empty>;
  return (
    <ul className="list-none m-0 px-3 pb-3 grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-1.5">
      {list.map((s) => (
        <li key={s.key}>
          <Link to={s.to} className="flex flex-col items-center gap-1 px-1 py-2.5 rounded-md text-center transition-colors hover:bg-field">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-primary-weak text-primary text-[16px] font-bold" aria-hidden>
              {s.glyph}
            </span>
            <span className="w-full truncate text-[13px] font-medium text-fg">{s.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ───────── 목록 ───────── */

const COUNT = (values: number[]) => values.map((v) => ({ value: v, label: `${v}개` }));
/** 미리보기 위젯(인기 글 · 팔로우한 채널 · 인기 채널)의 높이 반응형: 켜면 높이 = 내용 (최소 크기는 지킨다) */
const AUTO_H: OptionDef = {
  key: 'autoH',
  label: '높이 반응형',
  kind: 'switch',
  def: true,
  help: '켜면 카드 높이가 내용만큼 자동으로 맞춰져요 (최소 크기보다 작아지지 않고, 꾸미기에서 더 늘릴 수 없어요). 끄면 정한 높이 그대로예요',
};
const VIEW: OptionDef = { key: 'view', label: '보기', kind: 'select', def: 'list', choices: [{ value: 'list', label: '목록' }, { value: 'grid', label: '아이콘 바둑판' }] };

export const WIDGETS: WidgetDef[] = [
  {
    type: 'feed',
    label: '전체 글',
    desc: '모든 채널의 새 글을 끝없이 이어 봐요',
    glyph: '≡',
    size: { w: 6, h: 10 },
    min: { w: 4, h: 4 },
    fit: true,
    title: () => '전체 글',
    options: [
      {
        key: 'excerpt',
        label: '본문 미리보기',
        kind: 'select',
        def: 'auto',
        choices: [
          { value: 'auto', label: '설정 따르기' },
          { value: 'on', label: '보이기' },
          { value: 'off', label: '숨기기' },
        ],
      },
    ],
    Body: FeedBody,
  },
  {
    type: 'popular',
    label: '인기 글',
    desc: '최근 7일 동안 반응이 많은 글 (전체 또는 채널 하나)',
    glyph: '♛',
    size: { w: 3, h: 6 },
    min: { w: 3, h: 3 },
    multi: true,
    preview: true,
    title: () => '지금 인기 있는 글',
    options: [
      { key: 'channel', label: '범위', kind: 'channel', def: '', allowAll: true },
      { key: 'count', label: '개수', kind: 'select', def: 5, choices: COUNT([3, 4, 5]) },
      AUTO_H,
    ],
    Body: PopularBody,
  },
  {
    type: 'discovery',
    label: '오늘의 발견',
    desc: '반응은 적어도 흥미로운 글을 매일 하나 골라 소개해요',
    glyph: '✦',
    size: { w: 3, h: 5 },
    min: { w: 3, h: 3 },
    preview: true,
    title: () => '오늘의 발견',
    options: [{ key: 'past', label: '지난 발견도 보기', kind: 'switch', def: true }, AUTO_H],
    Body: DiscoveryBody,
  },
  {
    type: 'weather',
    label: '커뮤니티 날씨',
    desc: '최근 24시간의 반응으로 정한 커뮤니티 분위기',
    glyph: '☀',
    size: { w: 3, h: 4 },
    min: { w: 3, h: 3 },
    preview: true,
    title: () => '커뮤니티 날씨',
    options: [{ key: 'bars', label: '감정 비율 보기', kind: 'switch', def: true }, AUTO_H],
    Body: WeatherBody,
  },
  {
    type: 'followed',
    label: '팔로우한 채널',
    desc: '내가 팔로우한 관심 채널 (북마크한 채널 먼저)',
    glyph: '♥',
    size: { w: 3, h: 4 },
    min: { w: 2, h: 2 },
    login: true,
    preview: true,
    title: () => '팔로우한 채널',
    more: () => '/me/channels',
    options: [VIEW, { key: 'owned', label: '내가 만든 채널도', kind: 'switch', def: false }, AUTO_H],
    Body: FollowedBody,
  },
  {
    type: 'hotChannels',
    label: '인기 채널',
    desc: '최근 7일 활동이 많은 채널 순위',
    glyph: '▲',
    size: { w: 3, h: 6 },
    min: { w: 2, h: 3 },
    preview: true,
    title: () => '인기 채널 · 최근 7일',
    more: () => '/channels',
    options: [VIEW, { key: 'count', label: '개수', kind: 'select', def: 5, choices: COUNT([3, 5, 8, 10]) }, AUTO_H],
    Body: HotChannelsBody,
  },
  {
    type: 'notifications',
    label: '알림',
    desc: '내 글의 댓글 · 답글 · 공감 · 공지 소식',
    glyph: '◔',
    size: { w: 4, h: 5 },
    min: { w: 3, h: 3 },
    login: true,
    title: () => '알림',
    options: [
      { key: 'unread', label: '안 읽은 것만', kind: 'switch', def: false },
      { key: 'count', label: '개수', kind: 'select', def: 5, choices: COUNT([3, 5, 10, 20]) },
    ],
    Body: NotificationsBody,
  },
  {
    type: 'activity',
    label: '내 활동',
    desc: '내 글 · 댓글 · 포인트 · 배지를 한눈에',
    glyph: '◆',
    size: { w: 3, h: 3 },
    min: { w: 3, h: 3 },
    login: true,
    title: () => '내 활동',
    Body: ActivityBody,
  },
  {
    type: 'channel',
    label: '채널 새 글',
    desc: '고른 채널의 최신 글. 여러 개 놓아 게시판을 모아 보세요',
    glyph: '#',
    size: { w: 4, h: 6 },
    min: { w: 3, h: 3 },
    multi: true,
    title: () => '채널 새 글',
    more: (o) => (o.channel ? `/c/${o.channel}` : undefined),
    options: [
      { key: 'channel', label: '채널', kind: 'channel', def: '' },
      { key: 'count', label: '개수', kind: 'select', def: 5, choices: COUNT([3, 5, 8, 10]) },
      { key: 'excerpt', label: '본문 한 줄', kind: 'switch', def: false },
    ],
    Body: ChannelPostsBody,
  },
  {
    type: 'pet',
    label: '내 펫',
    desc: '펫의 레벨과 경험치, 바로 쓰다듬기',
    glyph: '◕',
    size: { w: 3, h: 3 },
    min: { w: 3, h: 3 },
    login: true,
    title: () => '내 펫',
    more: () => '/me/pet',
    Body: PetBody,
  },
  {
    type: 'makeChannel',
    label: '채널 만들기',
    desc: '새 채널을 만드는 바로가기 카드',
    glyph: '+',
    size: { w: 3, h: 3 },
    min: { w: 2, h: 3 },
    title: () => '나만의 채널을 만들어 보세요',
    Body: MakeChannelBody,
  },
  {
    type: 'greeting',
    label: '인사 · 시계',
    desc: '시간대에 맞는 인사와 오늘 날짜 · 시계',
    glyph: '☀',
    size: { w: 12, h: 2 },
    min: { w: 3, h: 2 },
    title: () => '',
    options: [
      { key: 'message', label: '인사말 (비우면 시간대에 맞게)', kind: 'text', def: '', max: 40, placeholder: '예) 오늘도 한 걸음' },
      { key: 'date', label: '날짜', kind: 'switch', def: true },
      { key: 'clock', label: '시계', kind: 'switch', def: true },
      { key: 'seconds', label: '초까지', kind: 'switch', def: false },
      {
        key: 'align',
        label: '정렬',
        kind: 'select',
        def: 'side',
        choices: [
          { value: 'side', label: '양옆' },
          { value: 'center', label: '가운데' },
        ],
      },
    ],
    Body: GreetingBody,
  },
  {
    type: 'memo',
    label: '메모',
    desc: '홈에 붙여 두는 메모. 여러 장 붙일 수 있어요',
    glyph: '✎',
    size: { w: 3, h: 3 },
    min: { w: 2, h: 2 },
    multi: true,
    title: () => '메모',
    options: [
      {
        key: 'color',
        label: '색',
        kind: 'select',
        def: 'yellow',
        choices: Object.entries(MEMO_COLORS).map(([value, c]) => ({ value, label: c.label })),
      },
    ],
    Body: MemoBody,
  },
  {
    type: 'shortcuts',
    label: '바로가기',
    desc: '자주 가는 곳을 버튼으로',
    glyph: '↗',
    size: { w: 4, h: 2 },
    min: { w: 2, h: 2 },
    multi: true,
    title: () => '바로가기',
    options: SHORTCUTS.map((s, i) => ({ key: s.key, label: s.label, kind: 'switch' as const, def: i < 4 })),
    Body: ShortcutsBody,
  },
];

export const WIDGET = Object.fromEntries(WIDGETS.map((w) => [w.type, w])) as Record<HomeWidgetType, WidgetDef>;

/* ───────── 모든 위젯 공통 설정 ───────── */

export const COMMON: OptionDef[] = [
  { key: 'title', label: '제목 (비우면 기본 제목)', kind: 'text', def: '', max: 30 },
  { key: 'hideTitle', label: '제목 줄 숨기기', kind: 'switch', def: false },
  {
    key: 'style',
    label: '모양',
    kind: 'select',
    def: 'card',
    choices: [
      { value: 'card', label: '카드' },
      { value: 'plain', label: '테두리 없이' },
      { value: 'tint', label: '포인트 색' },
      { value: 'glass', label: '유리' },
    ],
  },
  { key: 'fit', label: '내용만큼 늘리기', kind: 'switch', def: false, help: '끄면 정한 높이에 맞추고 넘치는 내용은 안에서 스크롤해요' },
  { key: 'sticky', label: '스크롤해도 따라오기', kind: 'switch', def: false, help: '아래에 다른 위젯이 없을 때만 화면에 붙어 따라와요' },
  { key: 'hideMobile', label: '좁은 화면에서 숨기기', kind: 'switch', def: false },
];

/** 위젯 설정 + 기본값 */
export function optionsOf(widget: HomeWidget): Options {
  const def = WIDGET[widget.type];
  const out: Options = {};
  for (const opt of [...COMMON, ...(def.options ?? [])]) out[opt.key] = opt.def;
  if (def.fit) out.fit = true;
  return { ...out, ...widget.o };
}

/** 높이가 내용으로 정해지는 위젯 (높이 반응형을 켠 미리보기 위젯): 보기 · 꾸미기 모두 높이 = 내용, 최소 크기는 지킨다 */
export const isAutoHeight = (widget: HomeWidget, o: Options = optionsOf(widget)) => !!WIDGET[widget.type].preview && o.autoH !== false;

/** 기본값과 같은 설정은 저장하지 않는다 (배치 JSON 을 작게) */
export function compactOptions(widget: HomeWidget, o: Options): Options | undefined {
  const defaults = optionsOf({ ...widget, o: undefined });
  const entries = Object.entries(o).filter(([k, v]) => defaults[k] !== v);
  return entries.length ? Object.fromEntries(entries) : undefined;
}
