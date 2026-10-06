import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { checkAttendance, useAuth, verifySession } from '@loop/shared';
import { useConfirmSignOut } from './ConfirmDialog';
import { UserAvatar } from './UserAvatar';
import { toast } from './Toast';
import { ChannelSearch } from './ChannelSearch';
import { preload } from '../lib/preload';
import { GridIcon, HomeIcon, PencilIcon, UserIcon } from './Icons';
import { useAuthState } from '../lib/authNav';
import { ui } from './ui';
import { cn } from '../lib/cn';
import s from './Layout.styles';

/** 한국 시간 기준 오늘 (YYYY-MM-DD) */
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/** 로그인한 채로 사이트를 열면 하루 한 번 출석 체크 (+10P, 7일 연속마다 +50P) */
function useDailyAttendance(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    const key = `loop:attended:${userId}`;
    const today = kstToday();
    try {
      if (localStorage.getItem(key) === today) return;
    } catch {
      /* 저장소를 못 쓰면 서버가 하루 한 번만 주므로 그냥 부른다 */
    }
    checkAttendance()
      .then((r) => {
        try {
          localStorage.setItem(key, today);
        } catch {
          /* 무시 */
        }
        if (r.awarded) toast(r.earned > 10 ? `${r.streak}일 연속 출석! +${r.earned}P` : `출석 체크 +${r.earned}P · ${r.streak}일 연속`);
      })
      .catch(() => undefined);
  }, [userId]);
}

function UserMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const logout = useConfirmSignOut(() => navigate('/'));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useDailyAttendance(user?.id);

  useEffect(() => setOpen(false), [pathname]);
  // 메뉴를 열 때 포인트를 최신으로
  useEffect(() => {
    if (open) void verifySession();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  return (
    <div className={s.menuWrap} ref={ref}>
      <button
        type="button"
        className={s.userButton}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onPointerEnter={preload.me}
      >
        <UserAvatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={32} />
        <span className={s.userName}>{user.nickname}</span>
      </button>
      {open && (
        <div className={s.menu} role="menu">
          {/* 프로필 사진 · 닉네임 · 가진 포인트 (이메일은 보이지 않는다) */}
          <div className={cn(s.menuHead, 'flex items-center gap-2.5')}>
            <UserAvatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <div className={cn(s.menuName, 'truncate')}>{user.nickname}</div>
              <div className="text-[13px] font-semibold text-primary">{(user.points ?? 0).toLocaleString()}P</div>
            </div>
          </div>
          <Link to="/me" className={s.menuItem} role="menuitem" onPointerEnter={preload.me}>
            마이페이지
          </Link>
          <Link to="/me/channels" className={s.menuItem} role="menuitem">
            내 채널
          </Link>
          <Link to="/me/settings" className={s.menuItem} role="menuitem" onPointerEnter={preload.settings}>
            설정
          </Link>
          <button
            type="button"
            className={cn(s.menuItem, 'text-danger-text')}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout.ask();
            }}
          >
            로그아웃
          </button>
        </div>
      )}
      {logout.dialog}
    </div>
  );
}

export function SiteHeader() {
  const { isLoggedIn } = useAuth();
  // 로그인 · 회원가입 뒤 돌아올 곳은 주소가 아니라 state 로 넘긴다 (lib/authNav)
  const authState = useAuthState();

  return (
    <header className={s.header}>
      <div className={s.headerInner}>
        <Link to="/" className={s.logo} aria-label="루프 홈" draggable={false}>
          <LogoMark className={s.logoMark} />
          루프
        </Link>
        <nav className={s.nav} aria-label="주요 메뉴">
          <NavLink to="/" end className={s.navLink} draggable={false}>
            홈
          </NavLink>
          <NavLink to="/channels" className={s.navLink} onPointerEnter={preload.channels} draggable={false}>
            채널
          </NavLink>
        </nav>
        <ChannelSearch />
        <div className={s.actions}>
          {/* 글은 채널 안에서만 쓰므로 글쓰기 버튼은 각 채널 페이지에 있다 */}
          {isLoggedIn ? (
            <UserMenu />
          ) : (
            <>
              <Link to="/login" state={authState} className={cn(ui.button, ui.text)} onPointerEnter={preload.login} draggable={false}>
                로그인
              </Link>
              <Link to="/signup" state={authState} className={cn(ui.button, ui.primary)} onPointerEnter={preload.signup} draggable={false}>
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * 폰 하단 탭바 (520px 이하). 헤더의 '홈·채널' 메뉴가 숨는 대신 여기서 바로 갈 수 있다.
 * 글쓰기는 채널 안에서 하므로, 채널을 보고 있으면 그 채널 글쓰기로, 아니면 채널을 고르러 간다.
 */
export function MobileTabBar() {
  const { isLoggedIn } = useAuth();
  const { pathname } = useLocation();
  const authState = useAuthState();
  const slug = pathname.match(/^\/c\/([^/]+)/)?.[1];
  const tabs = [
    { to: '/', label: '홈', icon: <HomeIcon />, active: pathname === '/' },
    { to: '/channels', label: '채널', icon: <GridIcon />, active: pathname.startsWith('/channels') || !!slug },
    { to: slug ? `/write?channel=${slug}` : '/write', label: '글쓰기', icon: <PencilIcon />, active: pathname.startsWith('/write') },
    {
      to: isLoggedIn ? '/me' : '/login',
      state: isLoggedIn ? undefined : authState,
      label: isLoggedIn ? '내 정보' : '로그인',
      icon: <UserIcon />,
      active: pathname.startsWith('/me') || pathname === '/login',
    },
  ];
  return (
    <nav className={s.tabBar} aria-label="하단 메뉴">
      {tabs.map((t) => (
        <Link key={t.label} to={t.to} state={t.state} className={s.tab} aria-current={t.active ? 'page' : undefined}>
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

type Variant = 'three' | 'twoRight' | 'nav' | 'single' | 'wide' | 'narrow';

/**
 * 화면에 붙어 있는(sticky) 사이드바가 스크롤을 '천천히 따라오는' 느낌: 스크롤하면 본문과 함께 밀려났다가
 * (화면 밖으로 나가도 된다) 1~2초에 걸쳐 부드럽게 제자리로 돌아온다. 넓은 화면(사이드바가 붙는 폭)에서만, 움직임 줄이기 설정이면 끈다.
 */
function useFollowScroll(refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let last = window.scrollY;
    let offset = 0;
    let frame = 0;
    const apply = (v: number) => {
      for (const r of refs) if (r.current) r.current.style.transform = v ? `translate3d(0, ${v.toFixed(2)}px, 0)` : '';
    };
    const tick = () => {
      offset *= 0.955; // 천천히 제자리로 (화면 밖으로 나갔다가 1~2초에 걸쳐 따라온다)
      if (Math.abs(offset) < 0.15) {
        offset = 0;
        frame = 0;
        apply(0);
        return;
      }
      apply(offset);
      frame = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - last;
      last = y;
      if (window.innerWidth <= 860) return;
      // 스크롤한 만큼 본문과 함께 밀려났다가(화면 밖으로 나가도 된다) 천천히 따라온다
      const limit = window.innerHeight;
      offset = Math.max(-limit, Math.min(limit, offset - dy));
      if (!frame) frame = requestAnimationFrame(tick);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      apply(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** 페이지 그리드. left/right 는 넓은 화면에서만 옆에 붙고, 좁아지면 접히거나 아래로 내려간다. */
export function Page({
  variant = 'three',
  left,
  right,
  children,
}: {
  variant?: Variant;
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  const leftRef = useRef<HTMLElement>(null);
  const rightRef = useRef<HTMLElement>(null);
  // 마이페이지 메뉴(nav)는 붙어 있지 않으므로 따라오지 않는다
  useFollowScroll(variant === 'nav' ? [rightRef] : [leftRef, rightRef]);
  return (
    <div className={cn(s.page, variant === 'nav' ? s.withNav : s[variant])}>
      {(variant === 'three' || variant === 'nav') && (
        <aside ref={leftRef} className={cn(s.side, variant === 'three' && s.leftInThree, variant === 'nav' && s.sideStatic)}>
          {left}
        </aside>
      )}
      <main className={s.main}>{children}</main>
      {(variant === 'three' || variant === 'twoRight') && (
        <aside ref={rightRef} className={cn(s.side, 'will-change-transform')}>
          {right}
        </aside>
      )}
    </div>
  );
}

/**
 * 루프 로고: 무한대(∞). 두 고리가 겹치는 가운데에서 뒤로 지나가는 선을 살짝 끊어,
 * 입체로 볼 때 뒤쪽이 가려진 것처럼 보이게 한다. (앞 선 아래에 배경색 굵은 선을 깔아 틈을 만든다)
 */
export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  // inverted: 파란 배경 위에 놓을 때 (흰 바탕 + 파란 선)
  const bg = inverted ? '#fff' : 'var(--primary)';
  const fg = inverted ? 'var(--primary)' : '#fff';
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="6" fill={bg} />
      <g fill="none" strokeLinecap="round">
        <path
          d="M12 12C13 10 14 8.5 15.5 8.5a3.5 3.5 0 0 1 0 7C14 15.5 13 14 12 12S10 8.5 8.5 8.5a3.5 3.5 0 0 0 0 7C10 15.5 11 14 12 12Z"
          stroke={fg}
          strokeWidth="2"
        />
        <path
          d="M10.6 14.2C11.1 13.6 11.5 12.9 12 12S12.9 10.4 13.4 9.8"
          stroke={bg}
          strokeWidth="5"
          strokeLinecap="butt"
        />
        <path d="M8.5 15.5C10 15.5 11 14 12 12S14 8.5 15.5 8.5" stroke={fg} strokeWidth="2" />
      </g>
    </svg>
  );
}

/** 모든 페이지 맨 아래에 붙는 사이트 푸터 */
/** 문의 · 제안 · 버그 제보를 받는 노션 페이지 */
const CONTACT_URL = 'https://app.notion.com/p/3eae8a58bd17804a97e9d25b148c01fe';

/** 로그인 · 회원가입 · 비밀번호 찾기 화면은 큰 카드 하나로 채우므로 푸터를 숨긴다 */
const NO_FOOTER = ['/login', '/signup', '/password/reset'];

export function SiteFooter() {
  const { pathname } = useLocation();
  if (NO_FOOTER.includes(pathname)) return null;
  return (
    <footer className={s.footer}>
      <div className={s.footerInner}>
        <Link to="/" className={s.footerLogo} aria-label="루프 홈">
          <LogoMark className="w-5 h-5" />
          루프
        </Link>
        {/* 문의·제안·버그 제보는 노션 페이지로 모은다 */}
        <p className={s.contact}>
          궁금한 점이나 불편한 점이 있나요?
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className={s.contactLink}>
            노션에 문의 남기기 ↗
          </a>
        </p>
        <p className={s.copyright}>© 루프 커뮤니티</p>
      </div>
    </footer>
  );
}

export { s as layoutStyles };
