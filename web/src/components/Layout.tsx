import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useSignOut } from '@loop/shared';
import { ChannelSearch } from './ChannelSearch';
import { preload } from '../lib/preload';
import { GridIcon, HomeIcon, PencilIcon, UserIcon } from './Icons';
import { ui } from './ui';
import { cn } from '../lib/cn';
import s from './Layout.styles';

function UserMenu() {
  const { user } = useAuth();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
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
        <span className={s.avatar} aria-hidden>
          {user.nickname.slice(0, 1)}
        </span>
        <span className={s.userName}>{user.nickname}</span>
      </button>
      {open && (
        <div className={s.menu} role="menu">
          <div className={s.menuHead}>
            <div className={s.menuName}>{user.nickname}</div>
            <div className={s.menuEmail}>{user.email}</div>
          </div>
          <Link to="/me" className={s.menuItem} role="menuitem" onPointerEnter={preload.me}>
            마이페이지
          </Link>
          <Link to="/me/channels" className={s.menuItem} role="menuitem">
            내 채널
          </Link>
          <Link to="/channels/new" className={s.menuItem} role="menuitem" onPointerEnter={preload.channelForm}>
            채널 만들기
          </Link>
          <button
            type="button"
            className={s.menuItem}
            role="menuitem"
            onClick={() => {
              signOut();
              navigate('/');
            }}
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

export function SiteHeader() {
  const { isLoggedIn } = useAuth();
  const { pathname, search } = useLocation();
  const next = encodeURIComponent(pathname + search);

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
              <Link to={`/login?next=${next}`} className={cn(ui.button, ui.text)} onPointerEnter={preload.login} draggable={false}>
                로그인
              </Link>
              <Link to={`/signup?next=${next}`} className={cn(ui.button, ui.primary)} onPointerEnter={preload.signup} draggable={false}>
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
  const { pathname, search } = useLocation();
  const slug = pathname.match(/^\/c\/([^/]+)/)?.[1];
  const tabs = [
    { to: '/', label: '홈', icon: <HomeIcon />, active: pathname === '/' },
    { to: '/channels', label: '채널', icon: <GridIcon />, active: pathname.startsWith('/channels') || !!slug },
    { to: slug ? `/write?channel=${slug}` : '/write', label: '글쓰기', icon: <PencilIcon />, active: pathname.startsWith('/write') },
    {
      to: isLoggedIn ? '/me' : `/login?next=${encodeURIComponent(pathname + search)}`,
      label: isLoggedIn ? '내 정보' : '로그인',
      icon: <UserIcon />,
      active: pathname.startsWith('/me') || pathname === '/login',
    },
  ];
  return (
    <nav className={s.tabBar} aria-label="하단 메뉴">
      {tabs.map((t) => (
        <Link key={t.label} to={t.to} className={s.tab} aria-current={t.active ? 'page' : undefined}>
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

type Variant = 'three' | 'twoRight' | 'nav' | 'single' | 'wide' | 'narrow';

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
  return (
    <div className={cn(s.page, variant === 'nav' ? s.withNav : s[variant])}>
      {(variant === 'three' || variant === 'nav') && (
        <aside className={cn(s.side, variant === 'three' && s.leftInThree)}>{left}</aside>
      )}
      <main className={s.main}>{children}</main>
      {(variant === 'three' || variant === 'twoRight') && <aside className={s.side}>{right}</aside>}
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
