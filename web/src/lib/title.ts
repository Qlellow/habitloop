import { useEffect, useLayoutEffect } from 'react';

/**
 * 브라우저 탭 제목: "글 제목 · 루프". 탭 여러 개 · 방문 기록 · 검색 결과에서 화면을 구분할 수 있게 한다.
 * 주소만 보고 정할 수 있는 화면은 아래 표로, 글 · 채널처럼 받아 온 내용이 필요한 화면은 그 화면에서 usePageTitle 로 정한다.
 */
const SITE = '루프 커뮤니티';
const format = (title?: string | null) => (title ? `${title} · 루프` : SITE);

const STATIC: [RegExp, string][] = [
  [/^\/channels\/?$/, '채널'],
  [/^\/channels\/new\/?$/, '채널 만들기'],
  [/^\/write\/?$/, '글쓰기'],
  [/^\/posts\/[^/]+\/edit\/?$/, '글 수정'],
  [/^\/c\/[^/]+\/edit\/?$/, '채널 수정'],
  [/^\/notices\/?$/, '공지사항'],
  [/^\/badges\/?$/, '배지 도감'],
  [/^\/sea\/?$/, '메시지 표류병'],
  [/^\/invite\//, '채널 초대'],
  [/^\/login\/?$/, '로그인'],
  [/^\/signup\/?$/, '회원가입'],
  [/^\/password\/reset\/?$/, '비밀번호 찾기'],
  [/^\/me\/?$/, '마이페이지'],
  [/^\/me\/posts\/?$/, '내가 쓴 글'],
  [/^\/me\/channels\/?$/, '내 채널'],
  [/^\/me\/profile\/?$/, '내 정보 수정'],
  [/^\/me\/points\/?$/, '포인트'],
  [/^\/me\/pet\/?$/, '펫'],
  [/^\/me\/settings\/?$/, '설정'],
];

/** 가장 바깥 레이아웃에서: 주소가 바뀔 때마다 기본 제목으로 맞춘다 (화면의 usePageTitle 이 그 뒤에 덮어쓴다) */
export function useRouteTitle(pathname: string) {
  // layout effect 는 화면들의 일반 effect 보다 먼저 돌아서, 화면이 정한 제목을 덮지 않는다
  useLayoutEffect(() => {
    document.title = format(STATIC.find(([re]) => re.test(pathname))?.[1]);
  }, [pathname]);
}

/** 받아 온 내용으로 제목을 정하는 화면에서 (아직 못 받았으면 undefined → 기본 제목 그대로) */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (title) document.title = format(title);
  }, [title]);
}

/** 없는 페이지: SPA 라 서버가 404 를 못 주므로, 검색엔진이 이 화면을 수집하지 않게 noindex 를 붙여 둔다 */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}
