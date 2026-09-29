import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useSignOut } from '@loop/shared';
import { ChannelSearch } from './ChannelSearch';
import { preload } from '../lib/preload';
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
        <Link to="/" className={s.logo} aria-label="루프 홈">
          <span className={s.logoMark} />
          루프
        </Link>
        <nav className={s.nav} aria-label="주요 메뉴">
          <NavLink to="/" end className={s.navLink}>
            홈
          </NavLink>
          <NavLink to="/channels" className={s.navLink} onPointerEnter={preload.channels}>
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
              <Link to={`/login?next=${next}`} className={cn(ui.button, ui.text)} onPointerEnter={preload.login}>
                로그인
              </Link>
              <Link to={`/signup?next=${next}`} className={cn(ui.button, ui.primary)} onPointerEnter={preload.signup}>
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
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

export function Footer() {
  return <p className={s.footer}>© 루프 커뮤니티</p>;
}

export { s as layoutStyles };
