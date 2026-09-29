import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { authStore, configureApi, queryClient, verifySession } from '@loop/shared';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/global.css';
import App from './App';

// 웹은 같은 도메인의 /api 로 요청한다 (개발: Vite 프록시, 운영: Nginx 프록시)
configureApi({ baseUrl: import.meta.env.VITE_API_URL ?? '' });
// localStorage 는 동기라 첫 렌더 전에 로그인 상태가 복원된다
authStore.init({
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
  removeItem: (k) => localStorage.removeItem(k),
});
// 서버 DB 가 바뀌었거나 계정이 없어졌으면 저장된 로그인을 정리한다 (첫 화면 렌더는 막지 않는다)
void verifySession();
// 다른 탭에서 로그인/로그아웃하면 따라간다
window.addEventListener('storage', (e) => {
  if (e.key === 'loop.auth') authStore.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
