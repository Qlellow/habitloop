import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/authStore';
import { BackIcon, SearchIcon, UserIcon } from './Icons';
import { preload } from '../lib/preload';
import s from './Layout.module.css';

export function MainHeader() {
  const { isLoggedIn } = useAuth();
  return (
    <header className={s.header}>
      <div className={s.headerInner}>
        <Link to="/" className={s.logo} aria-label="루프 홈">
          <span className={s.logoMark} />
          루프
        </Link>
        <Link to="/search" className={s.iconButton} aria-label="검색" onPointerEnter={preload.search}>
          <SearchIcon />
        </Link>
        <Link
          to={isLoggedIn ? '/me' : '/login'}
          className={s.iconButton}
          aria-label={isLoggedIn ? '내 정보' : '로그인'}
          onPointerEnter={isLoggedIn ? preload.me : preload.login}
        >
          <UserIcon />
        </Link>
      </div>
    </header>
  );
}

export function SubHeader({ title, right, backTo }: { title?: string; right?: ReactNode; backTo?: string }) {
  const navigate = useNavigate();
  const goBack = () => {
    // 외부에서 바로 들어온 경우 뒤로 갈 곳이 없으니 홈으로
    if (backTo) navigate(backTo);
    else if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/', { replace: true });
  };
  return (
    <header className={s.header}>
      <div className={s.subHeaderInner}>
        <button type="button" className={s.iconButton} onClick={goBack} aria-label="뒤로 가기">
          <BackIcon />
        </button>
        <span className={s.subTitle}>{title}</span>
        {right}
      </div>
    </header>
  );
}

export function Main({ children }: { children: ReactNode }) {
  return <main className={s.main}>{children}</main>;
}

export { s as layoutStyles };
