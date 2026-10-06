import { lazy, Suspense, type ReactNode } from 'react';
import { useRunPendingSignOut } from './lib/authNav';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation } from 'react-router-dom';
import { useAuth } from '@loop/shared';
import { MobileTabBar, SiteFooter, SiteHeader } from './components/Layout';
import { Toaster } from './components/Toast';
import { loaders } from './lib/preload';
import { useReturnTo } from './lib/authNav';
import HomePage from './pages/HomePage';

// 첫 화면(홈)만 메인 번들에 넣고 나머지 화면은 라우트 단위로 쪼개서 필요할 때 받는다
const PostDetailPage = lazy(loaders.post);
const UserPage = lazy(loaders.user);
const InvitePage = lazy(loaders.invite);
const WritePage = lazy(loaders.write);
const LoginPage = lazy(loaders.login);
const SignupPage = lazy(loaders.signup);
const ResetPasswordPage = lazy(loaders.resetPassword);
const MyLayout = lazy(loaders.me);
const MyPostsPage = lazy(loaders.myPosts);
const MyChannelsPage = lazy(loaders.myChannels);
const ProfilePage = lazy(loaders.profile);
const SettingsPage = lazy(loaders.settings);
const PointsPage = lazy(loaders.points);
const ChannelPage = lazy(loaders.channel);
const ChannelsPage = lazy(loaders.channels);
const ChannelFormPage = lazy(loaders.channelForm);
const ChannelManagePage = lazy(loaders.channelManage);
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const OAuthCallbackPage = lazy(() => import('./pages/OAuthCallbackPage'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const { pathname, search } = useLocation();
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: pathname + search }} replace />;
  return children;
}

/**
 * 로그인 · 회원가입 · 비밀번호 찾기는 로그인하지 않은 사람만. 로그인한 채로 주소를 직접 쳐서 들어오면
 * 돌아갈 곳(없으면 홈)으로 보낸다. 로그인에 성공한 순간에도 같은 곳으로 간다.
 */
function GuestOnly({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const to = useReturnTo();
  if (isLoggedIn) return <Navigate to={to} replace />;
  return children;
}

function Root() {
  useRunPendingSignOut();
  return (
    <>
      {/* 폰에서는 하단 탭바 높이만큼 아래를 비워 둔다 (--tabbar-h, global.css) */}
      <div className="flex flex-col min-h-dvh pb-[var(--tabbar-h)]">
        <SiteHeader />
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
        <SiteFooter />
        <MobileTabBar />
      </div>
      <ScrollRestoration />
      <Toaster />
    </>
  );
}

const auth = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;
const guest = (el: ReactNode) => <GuestOnly>{el}</GuestOnly>;

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <HomePage /> },
      // 예전 글 검색 주소는 채널 검색으로
      { path: '/search', element: <Navigate to="/channels" replace /> },
      { path: '/posts/:id', element: <PostDetailPage /> },
      // 작성자 프로필
      { path: '/u/:id', element: <UserPage /> },
      // 비공개 채널 초대 링크 · QR
      { path: '/invite/:code', element: <InvitePage /> },
      { path: '/posts/:id/edit', element: auth(<WritePage />) },
      { path: '/write', element: auth(<WritePage />) },
      { path: '/channels', element: <ChannelsPage /> },
      { path: '/channels/new', element: auth(<ChannelFormPage />) },
      { path: '/c/:slug', element: <ChannelPage /> },
      { path: '/c/:slug/edit', element: auth(<ChannelFormPage />) },
      { path: '/c/:slug/manage', element: auth(<ChannelManagePage />) },
      { path: '/login', element: guest(<LoginPage />) },
      { path: '/signup', element: guest(<SignupPage />) },
      { path: '/password/reset', element: guest(<ResetPasswordPage />) },
      // 소셜 로그인에서 돌아오는 곳
      { path: '/oauth/callback', element: <OAuthCallbackPage /> },
      {
        path: '/me',
        element: auth(<MyLayout />),
        children: [
          { index: true, element: <Navigate to="/me/profile" replace /> },
          { path: 'posts', element: <MyPostsPage /> },
          { path: 'channels', element: <MyChannelsPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'points', element: <PointsPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
