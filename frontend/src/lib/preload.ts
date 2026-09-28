// 라우트 청크 로더. React.lazy 와 같은 import() 를 공유하므로
// 링크에 마우스를 올리거나 터치하는 순간 미리 받아 두면 클릭 시 대기 없이 전환된다.
export const loaders = {
  home: () => import('../pages/HomePage'),
  post: () => import('../pages/PostDetailPage'),
  write: () => import('../pages/WritePage'),
  search: () => import('../pages/SearchPage'),
  login: () => import('../pages/LoginPage'),
  signup: () => import('../pages/SignupPage'),
  me: () => import('../pages/MyPage'),
  channel: () => import('../pages/ChannelPage'),
  channels: () => import('../pages/ChannelsPage'),
  channelForm: () => import('../pages/ChannelFormPage'),
};

export const preload = Object.fromEntries(
  Object.entries(loaders).map(([k, load]) => [k, () => void load()]),
) as Record<keyof typeof loaders, () => void>;
