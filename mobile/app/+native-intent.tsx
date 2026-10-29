/**
 * 앱 밖에서 들어온 주소를 앱 화면 주소로 바꾼다 (expo-router 가 화면을 고르기 전에 부른다).
 * 꼭 필요한 것만 바꾸고 나머지는 그대로 둔다 (expo-router 가 웹 링크 · 개발용 앱 주소를 알아서 처리한다)
 *  - 웹 글 링크 https://사이트/posts/12 → 앱 글 화면 /post/12 (채널 · 프로필 · 공지 · 초대는 웹과 앱 주소가 같다)
 *  - loop://oauth?code=… → 소셜 로그인 마무리 화면 /oauth?code=… (app/oauth.tsx)
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const post = path.match(/^https?:\/\/[^/]+\/posts\/(\d+)\/?(?:[?#].*)?$/);
  if (post) return `/post/${post[1]}`;
  const oauth = path.match(/^loop:\/\/oauth\/?(\?.*)?$/);
  if (oauth) return `/oauth${oauth[1] ?? ''}`;
  return path;
}
