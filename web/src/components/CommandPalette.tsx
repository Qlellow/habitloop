import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { compact, useAuth, useChannels, useFeed, useMyChannels, useUserSearch } from '@loop/shared';
import { ChannelIcon } from './ChannelIcon';
import { UserAvatar } from './UserAvatar';
import { useConfirmSignOut } from './ConfirmDialog';
import {
  ArrowRightIcon,
  BackIcon,
  ClockIcon,
  DocIcon,
  GearIcon,
  GridIcon,
  HomeIcon,
  LogoutIcon,
  MonitorIcon,
  MoonIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  SunIcon,
  TrophyIcon,
  UserIcon,
} from './Icons';
import { PERIODS, updateSettings, useSettings, type Period, type Settings } from '../lib/settings';
import { GlassFilter, glassFilterId, useClientSize } from '../lib/glass';
import { cn } from '../lib/cn';

/* ───────── 열기 ───────── */

const OPEN_EVENT = 'loop:command-palette';
/** 헤더의 단축키 버튼 등 어디서든 커맨드 팔레트 열기 */
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_EVENT));
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/* ───────── 찾기: 글자 그대로 + 한글 초성(ㄷㅋ → 다크) ───────── */

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const chosung = (s: string) =>
  [...s].map((c) => {
    const code = c.charCodeAt(0) - 0xac00;
    return code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : c;
  }).join('');
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');
function matches(query: string, ...texts: (string | undefined)[]) {
  const q = squash(query);
  if (!q) return true;
  const text = squash(texts.filter(Boolean).join(' '));
  return text.includes(q) || (/^[ㄱ-ㅎ]+$/.test(q) && chosung(text).includes(q));
}

/* ───────── 항목 ───────── */

interface Item {
  id: string;
  group: string;
  label: ReactNode;
  /** 오른쪽 작은 글씨 */
  hint?: ReactNode;
  icon: ReactNode;
  run: () => void;
  /** 지금 쓰는 설정 */
  current?: boolean;
}

interface Command {
  id: string;
  group: string;
  label: string;
  keywords: string;
  icon: ReactNode;
  run: () => void;
  hint?: string;
  current?: boolean;
  /** 검색했을 때만 보인다 (기본 목록이 너무 길어지지 않게) */
  searchOnly?: boolean;
}

const tile = (node: ReactNode) => <span className="cmdk-tile">{node}</span>;
const THEMES: { theme: Settings['theme']; label: string; keywords: string; icon: ReactNode }[] = [
  { theme: 'light', label: '라이트 모드', keywords: 'light theme 테마 밝게 밝은', icon: <SunIcon /> },
  { theme: 'dark', label: '다크 모드', keywords: 'dark theme 테마 어둡게 어두운 야간', icon: <MoonIcon /> },
  { theme: 'system', label: '시스템 설정 따르기', keywords: 'system auto theme 테마 기기', icon: <MonitorIcon /> },
  { theme: 'time', label: '시간대 테마', keywords: 'time theme 테마 시간 아침 낮 저녁 새벽 자동', icon: <ClockIcon /> },
];

const DEBOUNCE_MS = 150;
/** 목록 안쪽 여백 (global.css .cmdk-list 와 같게). 위 · 아래 여백이 곧 굴절 띠라 가만히 있을 때는 아무것도 휘지 않는다 */
const LIST_PAD_X = 8;
const LIST_PAD_Y = 16;
const RESULT_SIZE = 5;

/**
 * 커맨드 팔레트 (Ctrl/⌘ + K). 키보드만으로 채널 이동 · 글쓰기 · 테마 바꾸기 · 사용자/글 찾기.
 * Apple 의 Liquid Glass 처럼 뒤 화면이 흐리게 비치고 가장자리에 빛이 맺히는 유리 패널 (global.css .liquid-glass)
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const signOut = useConfirmSignOut();
  const { pathname } = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // 다른 화면으로 가면 닫는다 (뒤로 가기 등)
  useEffect(() => setOpen(false), [pathname]);

  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      {open && <Palette onClose={close} onSignOut={signOut.ask} />}
      {signOut.dialog}
    </>
  );
}

function Palette({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isLoggedIn } = useAuth();
  const settings = useSettings();
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  /** write: 글을 쓸 채널 고르기 */
  const [mode, setMode] = useState<'root' | 'write'>('root');
  const [active, setActive] = useState(0);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const t = setTimeout(() => setKeyword(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  // 닫는 애니메이션이 끝나면 없앤다
  const close = useCallback(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return onClose();
    setClosing(true);
  }, [onClose]);
  const run = (fn: () => void) => {
    onClose();
    fn();
  };
  const go = (to: string) => run(() => navigate(to));

  const searching = mode === 'root' && keyword.length > 0;
  const mine = useMyChannels(isLoggedIn);
  const channels = useChannels(searching ? keyword : '');
  const users = useUserSearch(searching ? keyword : '');
  const posts = useFeed({ q: keyword }, searching);
  const here = pathname.match(/^\/c\/([^/]+)/)?.[1];

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: 'home', group: '이동', label: '홈', keywords: 'home 처음 메인', icon: <HomeIcon />, run: () => go('/') },
      { id: 'channels', group: '이동', label: '채널 둘러보기', keywords: 'channels 채널 목록 찾기 탐색', icon: <GridIcon />, run: () => go('/channels') },
    ];
    if (isLoggedIn) {
      list.push(
        { id: 'me', group: '이동', label: '마이페이지', keywords: 'my page 내 정보 프로필', icon: <UserIcon />, run: () => go('/me') },
        { id: 'my-channels', group: '이동', label: '내 채널', keywords: 'my channels 팔로우 구독', icon: <StarIcon />, run: () => go('/me/channels'), searchOnly: true },
        { id: 'my-posts', group: '이동', label: '내가 쓴 글', keywords: 'my posts 내 글', icon: <DocIcon />, run: () => go('/me/posts'), searchOnly: true },
        { id: 'points', group: '이동', label: '포인트', keywords: 'points 포인트 배지 출석', icon: <TrophyIcon />, run: () => go('/me/points'), searchOnly: true },
        { id: 'settings', group: '이동', label: '설정', keywords: 'settings 설정 환경', icon: <GearIcon />, run: () => go('/me/settings') },
        {
          id: 'write',
          group: '만들기',
          label: '글 쓰기',
          keywords: 'write post new 글쓰기 작성 새 글',
          icon: <PencilIcon />,
          hint: here ? `c/${here}` : '채널 고르기',
          run: () => {
            if (here) return go(`/write?channel=${encodeURIComponent(here)}`);
            setMode('write');
            setInput('');
            setKeyword('');
            setActive(0);
          },
        },
        { id: 'new-channel', group: '만들기', label: '채널 만들기', keywords: 'new channel create 채널 개설', icon: <PlusIcon />, run: () => go('/channels/new') },
      );
    }
    for (const t of THEMES) {
      list.push({
        id: `theme-${t.theme}`,
        group: '테마',
        label: t.label,
        keywords: t.keywords,
        icon: t.icon,
        current: settings.theme === t.theme && (t.theme !== 'time' || settings.timeTheme === 'auto'),
        run: () => run(() => updateSettings(t.theme === 'time' ? { theme: 'time', timeTheme: 'auto' } : { theme: t.theme })),
      });
    }
    for (const [p, info] of Object.entries(PERIODS) as [Period, (typeof PERIODS)[Period]][]) {
      list.push({
        id: `time-${p}`,
        group: '테마',
        label: `시간대 테마: ${info.label}`,
        keywords: `time theme 테마 시간대 ${p} 고정`,
        hint: info.hours,
        icon: <ClockIcon />,
        current: settings.theme === 'time' && settings.timeTheme === p,
        searchOnly: true,
        run: () => run(() => updateSettings({ theme: 'time', timeTheme: p })),
      });
    }
    if (isLoggedIn) {
      list.push({ id: 'logout', group: '계정', label: '로그아웃', keywords: 'logout sign out 나가기', icon: <LogoutIcon />, run: () => run(onSignOut) });
    } else {
      list.push(
        { id: 'login', group: '계정', label: '로그인', keywords: 'login sign in', icon: <UserIcon />, run: () => go('/login') },
        { id: 'signup', group: '계정', label: '회원가입', keywords: 'signup join 가입', icon: <PlusIcon />, run: () => go('/signup') },
      );
    }
    return list;
    // go · run 은 매번 새로 만들어지지만 navigate · onClose 에만 기대므로 의존 목록에서 뺀다
  }, [isLoggedIn, settings.theme, settings.timeTheme, here, onSignOut]);

  const items = useMemo<Item[]>(() => {
    const q = input.trim();
    if (mode === 'write') {
      return (mine.data ?? [])
        .filter((c) => matches(q, c.name, c.slug))
        .map((c) => ({
          id: `write-${c.slug}`,
          group: '어느 채널에 쓸까요?',
          label: c.name,
          hint: `c/${c.slug}`,
          icon: <ChannelIcon channel={c} size={28} />,
          run: () => go(`/write?channel=${encodeURIComponent(c.slug)}`),
        }));
    }
    const out: Item[] = [];
    const cmd = commands.filter((c) => (q ? matches(q, c.label, c.keywords) : !c.searchOnly));
    if (!q && isLoggedIn) {
      for (const c of (mine.data ?? []).slice(0, RESULT_SIZE)) {
        out.push({
          id: `mine-${c.slug}`,
          group: '내 채널',
          label: c.name,
          hint: `c/${c.slug}`,
          icon: <ChannelIcon channel={c} size={28} />,
          run: () => go(`/c/${c.slug}`),
        });
      }
    }
    // 검색할 때는 명령을 맨 위 한 묶음으로
    for (const c of cmd) out.push({ ...c, group: q ? '명령' : c.group, icon: tile(c.icon), hint: c.current ? '사용 중' : c.hint });
    if (searching && keyword === q) {
      for (const c of (channels.data ?? []).slice(0, RESULT_SIZE)) {
        out.push({
          id: `ch-${c.slug}`,
          group: '채널',
          label: c.name,
          hint: `c/${c.slug} · 팔로워 ${compact(c.memberCount)}`,
          icon: <ChannelIcon channel={c} size={28} />,
          run: () => go(`/c/${c.slug}`),
        });
      }
      for (const u of (users.data ?? []).slice(0, RESULT_SIZE)) {
        out.push({ id: `u-${u.id}`, group: '사용자', label: u.nickname, hint: '프로필', icon: <UserAvatar nickname={u.nickname} avatarUrl={u.avatarUrl} size={28} />, run: () => go(`/u/${u.id}`) });
      }
      for (const p of (posts.data?.pages[0]?.items ?? []).slice(0, RESULT_SIZE)) {
        out.push({ id: `p-${p.id}`, group: '글', label: p.title, hint: p.channelName, icon: tile(<DocIcon />), run: () => go(`/posts/${p.id}`) });
      }
      out.push({
        id: 'all',
        group: '',
        label: `'${q}' 채널 검색 결과 모두 보기`,
        icon: tile(<ArrowRightIcon />),
        run: () => go(`/channels?q=${encodeURIComponent(q)}`),
      });
    }
    return out;
  }, [mode, input, keyword, searching, commands, isLoggedIn, mine.data, channels.data, users.data, posts.data]);

  const loading = searching && (keyword !== input.trim() || channels.isFetching || users.isFetching || posts.isFetching);

  // 목록이 바뀌면 첫 항목부터
  useEffect(() => setActive(0), [input, mode]);
  const current = Math.min(active, items.length - 1);

  // 고른 항목이 보이게 스크롤 + 유리 하이라이트를 그 자리로
  const [pill, setPill] = useState<{ top: number; height: number; instant: boolean }>();
  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`);
    if (!el) return setPill(undefined);
    el.scrollIntoView({ block: 'nearest' });
    setPill((prev) => ({ top: el.offsetTop, height: el.offsetHeight, instant: !prev }));
  }, [current, items]);

  const back = () => {
    setMode('root');
    setInput('');
    setKeyword('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => (items.length ? (Math.min(i, items.length - 1) + 1) % items.length : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => (items.length ? (Math.min(i, items.length - 1) - 1 + items.length) % items.length : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (!e.nativeEvent.isComposing) items[current]?.run();
        break;
      case 'Escape':
        e.preventDefault();
        if (mode !== 'root') back();
        else close();
        break;
      case 'Backspace':
        if (mode !== 'root' && !input) back();
        break;
      case 'Tab':
        e.preventDefault();
        break;
    }
  };

  // 굴절 유리 (lib/glass): 목록 위 · 아래 가장자리, 고른 항목 위의 렌즈
  const list = useClientSize(listRef);
  const edgeId = glassFilterId('cmdk-edge', list.w, list.h);
  const lensW = Math.max(0, list.w - LIST_PAD_X * 2);
  const lensH = pill?.height ?? 0;
  const lensId = glassFilterId('cmdk-lens', lensW, lensH);

  /** 결과 줄들. 렌즈 안에도 같은 줄을 한 벌 더 그려 굴절시킨다 (clone: 보이기만 하고 누를 수 없는 복제본) */
  const rows = (clone: boolean) => {
    let lastGroup: string | undefined; // 묶음 제목은 묶음이 바뀌는 곳에만
    return items.map((it, i) => {
      const heading = it.group && it.group !== lastGroup ? it.group : undefined;
      lastGroup = it.group;
      return (
        <div key={it.id} role={clone ? undefined : 'presentation'}>
          {heading && <div className="cmdk-group">{heading}</div>}
          <div
            {...(clone
              ? {}
              : {
                  id: `${listId}-${i}`,
                  'data-index': i,
                  role: 'option',
                  'aria-selected': i === current,
                  onPointerMove: () => i !== current && setActive(i),
                  onPointerDown: (e: React.PointerEvent) => e.preventDefault(), // 입력칸 포커스 유지
                  onClick: it.run,
                })}
            className={cn('cmdk-item', i === current && 'cmdk-item-active', !it.group && 'cmdk-item-all')}
          >
            <span className="cmdk-icon">{it.icon}</span>
            <span className="cmdk-label">{it.label}</span>
            {it.hint && <span className={cn('cmdk-hint', it.current && 'cmdk-hint-current')}>{it.hint}</span>}
          </div>
        </div>
      );
    });
  };

  return createPortal(
    <div
      className={cn('cmdk-backdrop', closing && 'cmdk-closing')}
      onPointerDown={(e) => e.target === e.currentTarget && close()}
      onAnimationEnd={(e) => closing && e.target === panelRef.current && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="커맨드 팔레트"
        className="cmdk liquid-glass"
      >
        <div className="cmdk-search">
          {mode === 'write' ? (
            <button type="button" className="cmdk-chip" onClick={back} aria-label="뒤로">
              <BackIcon />
              글 쓰기
            </button>
          ) : (
            <SearchIcon className="cmdk-search-icon" />
          )}
          <input
            ref={inputRef}
            autoFocus
            className="cmdk-input"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[current] ? `${listId}-${current}` : undefined}
            aria-autocomplete="list"
            placeholder={mode === 'write' ? '채널 이름으로 찾기' : '무엇을 할까요? 채널 · 사용자 · 글 · 명령 찾기'}
            value={input}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {loading && <span className="cmdk-spinner" aria-hidden />}
          <kbd className="cmdk-kbd">esc</kbd>
        </div>
        <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
          <GlassFilter id={edgeId} w={list.w} h={list.h} bezel={LIST_PAD_Y} axis="y" scale={18} />
          <GlassFilter id={lensId} w={lensW} h={lensH} radius={14} bezel={8} scale={14} />
        </svg>
        <div
          className="cmdk-list"
          id={listId}
          role="listbox"
          aria-label="결과"
          ref={listRef}
          style={list.w ? { filter: `url(#${edgeId})` } : undefined}
        >
          {rows(false)}
          {/* 고른 항목 위의 유리 렌즈: 아래 줄들을 복제해 가장자리에서 휘게 비춘다. 항목 사이를 출렁이며 옮겨 다닌다 */}
          {pill && (
            <div aria-hidden className={cn('cmdk-pill', pill.instant && 'cmdk-pill-instant')} style={{ transform: `translateY(${pill.top}px)`, height: pill.height }}>
              <div className="cmdk-lens">
                {/* 휘는 건 줄들만, 둥근 모서리 자르기는 바깥(.cmdk-lens)에서: 모서리가 굴절돼 각지지 않게 */}
                <div className="cmdk-lens-bend" style={lensW && lensH ? { filter: `url(#${lensId})` } : undefined}>
                  <div className="cmdk-lens-rows" style={{ transform: `translateY(${-pill.top}px)`, width: list.w || undefined }}>
                    {rows(true)}
                  </div>
                </div>
              </div>
            </div>
          )}
          {items.length === 0 && (
            <p className="cmdk-empty">
              {mode === 'write'
                ? mine.isLoading
                  ? '불러오는 중…'
                  : (mine.data?.length ?? 0) === 0
                    ? '팔로우한 채널이 없어요. 채널을 팔로우하면 글을 쓸 수 있어요'
                    : `'${input.trim()}'이(가) 들어간 채널이 없어요`
                : '찾는 중…'}
            </p>
          )}
        </div>
        <div className="cmdk-foot" aria-hidden>
          <span>
            <kbd className="cmdk-kbd">↑</kbd>
            <kbd className="cmdk-kbd">↓</kbd> 이동
          </span>
          <span>
            <kbd className="cmdk-kbd">↵</kbd> 실행
          </span>
          <span className="ml-auto">
            <kbd className="cmdk-kbd">{isMac ? '⌘' : 'Ctrl'}</kbd>
            <kbd className="cmdk-kbd">K</kbd> 열기 · 닫기
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
