import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, useSignOut } from '@loop/shared';
import { Page } from '../../components/Layout';
import { preload } from '../../lib/preload';
import ui from '../../components/ui.module.css';
import s from './my.module.css';

const MENU = [
  { to: '/me/posts', label: '내가 쓴 글', preload: preload.myPosts },
  { to: '/me/channels', label: '가입 · 북마크 채널', preload: preload.myChannels },
  { to: '/me/profile', label: '내 정보 수정', preload: preload.profile },
  { to: '/me/settings', label: '설정', preload: preload.settings },
];

/** 마이페이지: 왼쪽 메뉴 + 오른쪽 내용(중첩 라우트) */
export default function MyLayout() {
  const { user } = useAuth();
  const signOut = useSignOut();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <Page
      variant="nav"
      left={
        <nav className={`${ui.card} ${s.side}`} aria-label="마이페이지 메뉴">
          <div className={s.me}>
            <span className={s.avatar} aria-hidden>
              {user.nickname.slice(0, 1)}
            </span>
            <div className={s.meText}>
              <div className={s.nickname}>{user.nickname}</div>
              <div className={s.email}>{user.email}</div>
            </div>
          </div>
          <ul className={s.menu}>
            {MENU.map((m) => (
              <li key={m.to}>
                <NavLink to={m.to} className={s.link} onPointerEnter={m.preload}>
                  {m.label}
                </NavLink>
              </li>
            ))}
            <li className={s.logout}>
              <button
                type="button"
                className={s.link}
                onClick={() => {
                  signOut();
                  navigate('/', { replace: true });
                }}
              >
                로그아웃
              </button>
            </li>
          </ul>
        </nav>
      }
    >
      <Outlet />
    </Page>
  );
}
