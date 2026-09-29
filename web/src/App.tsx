import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation } from 'react-router-dom';
import { useAuth } from '@loop/shared';
import { SiteHeader } from './components/Layout';
import { Toaster } from './components/Toast';
import { loaders } from './lib/preload';
import HomePage from './pages/HomePage';

// 첫 화면(홈)만 메인 번들에 넣고 나머지 화면은 라우트 단위로 쪼개서 필요할 때 받는다
const PostDetailPage = lazy(loaders.post);
const WritePage = lazy(loaders.write);
const SearchPage = lazy(loaders.search);
const LoginPage = lazy(loaders.login);
const SignupPage = lazy(loaders.signup);
const MyLayout = lazy(loaders.me);
const MyPostsPage = lazy(loaders.myPosts);
const MyChannelsPage = lazy(loaders.myChannels);
const ProfilePage = lazy(loaders.profile);
const SettingsPage = lazy(loaders.settings);
const ChannelPage = lazy(loaders.channel);
const ChannelsPage = lazy(loaders.channels);
const ChannelFormPage = lazy(loaders.channelForm);
const ChannelManagePage = lazy(loaders.channelManage);
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const { pathname, search } = useLocation();
  if (!isLoggedIn) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  return children;
}

function Root() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
      <ScrollRestoration />
      <Toaster />
    </>
  );
}

const auth = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/posts/:id', element: <PostDetailPage /> },
      { path: '/posts/:id/edit', element: auth(<WritePage />) },
      { path: '/write', element: auth(<WritePage />) },
      { path: '/channels', element: <ChannelsPage /> },
      { path: '/channels/new', element: auth(<ChannelFormPage />) },
      { path: '/c/:slug', element: <ChannelPage /> },
      { path: '/c/:slug/edit', element: auth(<ChannelFormPage />) },
      { path: '/c/:slug/manage', element: auth(<ChannelManagePage />) },
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      {
        path: '/me',
        element: auth(<MyLayout />),
        children: [
          { index: true, element: <Navigate to="/me/posts" replace /> },
          { path: 'posts', element: <MyPostsPage /> },
          { path: 'channels', element: <MyChannelsPage /> },
          { path: 'profile', element: <ProfilePage /> },
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
