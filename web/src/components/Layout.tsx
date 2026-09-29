import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useSignOut } from '@loop/shared';
import { SearchIcon } from './Icons';
import { preload } from '../lib/preload';
import ui from './ui.module.css';
import s from './Layout.module.css';

function SearchBox() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [q, setQ] = useState(pathname === '/search' ? (params.get('q') ?? '') : '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const keyword = q.trim();
    if (keyword) navigate(`/search?q=${encodeURIComponent(keyword)}`);
  };

  return (
    <form className={s.search} role="search" onSubmit={submit}>
      <SearchIcon />
      <input
        className={ui.input}
        type="search"
        placeholder="글 제목 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={preload.search}
        aria-label="글 검색"
      />
    </form>
  );
}

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
          <Link to="/me" className={s.menuItem} role="menuitem">
            내 글
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
        <SearchBox key={pathname === '/search' ? 'search' : 'other'} />
        <div className={s.actions}>
          {/* 글은 채널 안에서만 쓰므로 글쓰기 버튼은 각 채널 페이지에 있다 */}
          {isLoggedIn ? (
            <UserMenu />
          ) : (
            <>
              <Link to={`/login?next=${next}`} className={`${ui.button} ${ui.text}`} onPointerEnter={preload.login}>
                로그인
              </Link>
              <Link to={`/signup?next=${next}`} className={`${ui.button} ${ui.primary}`} onPointerEnter={preload.signup}>
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

type Variant = 'three' | 'twoRight' | 'single' | 'wide' | 'narrow';

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
    <div className={`${s.page} ${s[variant]}`}>
      {variant === 'three' && <aside className={s.left}>{left}</aside>}
      <main className={s.main}>{children}</main>
      {(variant === 'three' || variant === 'twoRight') && <aside className={s.right}>{right}</aside>}
    </div>
  );
}

export function Footer() {
  return <p className={s.footer}>© 루프 커뮤니티</p>;
}

export { s as layoutStyles };
