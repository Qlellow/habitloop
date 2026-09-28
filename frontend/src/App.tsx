import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, ScrollRestoration, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth/authStore';
import { Toaster } from './components/Toast';
import { loaders } from './lib/preload';
import HomePage from './pages/HomePage';

// 첫 화면(홈)만 메인 번들에 넣고 나머지 화면은 라우트 단위로 쪼개서 필요할 때 받는다
const PostDetailPage = lazy(loaders.post);
const WritePage = lazy(loaders.write);
const SearchPage = lazy(loaders.search);
const LoginPage = lazy(loaders.login);
const SignupPage = lazy(loaders.signup);
const MyPage = lazy(loaders.me);
const ChannelPage = lazy(loaders.channel);
const ChannelsPage = lazy(loaders.channels);
const ChannelFormPage = lazy(loaders.channelForm);
const ChannelManagePage = lazy(loaders.channelManage);
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const { pathname } = useLocation();
  if (!isLoggedIn) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  return children;
}

function Root() {
  return (
    <>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
      <ScrollRestoration />
      <Toaster />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/posts/:id', element: <PostDetailPage /> },
      { path: '/posts/:id/edit', element: <RequireAuth><WritePage /></RequireAuth> },
      { path: '/write', element: <RequireAuth><WritePage /></RequireAuth> },
      { path: '/channels', element: <ChannelsPage /> },
      { path: '/channels/new', element: <RequireAuth><ChannelFormPage /></RequireAuth> },
      { path: '/c/:slug', element: <ChannelPage /> },
      { path: '/c/:slug/edit', element: <RequireAuth><ChannelFormPage /></RequireAuth> },
      { path: '/c/:slug/manage', element: <RequireAuth><ChannelManagePage /></RequireAuth> },
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/me', element: <RequireAuth><MyPage /></RequireAuth> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
