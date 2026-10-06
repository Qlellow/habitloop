import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@loop/shared';
import { useConfirmSignOut } from '../../components/ConfirmDialog';
import { SlideHover } from '../../components/SlideHover';
import { UserAvatar } from '../../components/UserAvatar';
import { Page } from '../../components/Layout';
import { preload } from '../../lib/preload';
import { ui } from '../../components/ui';
import s from './my.styles';
import { cn } from '../../lib/cn';

const MENU = [
  { to: '/me/profile', label: '내 정보 수정', preload: preload.profile },
  { to: '/me/channels', label: '내 채널', preload: preload.myChannels },
  { to: '/me/posts', label: '내가 쓴 글', preload: preload.myPosts },
  { to: '/me/settings', label: '설정', preload: preload.settings },
];

/** 마이페이지: 왼쪽 메뉴 + 오른쪽 내용(중첩 라우트) */
export default function MyLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const logout = useConfirmSignOut(() => navigate('/', { replace: true }));
  if (!user) return null;

  return (
    <Page
      variant="nav"
      left={
        <nav className={cn(ui.card, s.side)} aria-label="마이페이지 메뉴">
          <div className={s.me}>
            <UserAvatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={40} />
            <div className={s.meText}>
              <div className={s.nickname}>{user.nickname}</div>
              <div className={s.email}>{user.email}</div>
            </div>
          </div>
          {/* 메뉴를 옮겨 다니면 hover 상자가 이전 항목에서 미끄러져 온다 */}
          <SlideHover>
            <ul className={s.menu}>
              {MENU.map((m) => (
                <li key={m.to}>
                  <NavLink to={m.to} className={s.link} onPointerEnter={m.preload}>
                    {m.label}
                  </NavLink>
                </li>
              ))}
              <li className={s.logout}>
                {/* 로그아웃은 빨강 (다크 테마에서는 밝은 빨강), 한 번 더 확인한다 */}
                <button type="button" className={cn(s.link, s.logoutButton)} onClick={logout.ask}>
                  로그아웃
                </button>
              </li>
            </ul>
          </SlideHover>
          {logout.dialog}
        </nav>
      }
    >
      <Outlet />
    </Page>
  );
}
