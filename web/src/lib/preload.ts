// 라우트 청크 로더. React.lazy 와 같은 import() 를 공유하므로
// 링크에 마우스를 올리거나 터치하는 순간 미리 받아 두면 클릭 시 대기 없이 전환된다.
export const loaders = {
  home: () => import('../pages/HomePage'),
  post: () => import('../pages/PostDetailPage'),
  write: () => import('../pages/WritePage'),
  login: () => import('../pages/LoginPage'),
  signup: () => import('../pages/SignupPage'),
  me: () => import('../pages/my/MyLayout'),
  myPosts: () => import('../pages/my/MyPostsPage'),
  myChannels: () => import('../pages/my/MyChannelsPage'),
  profile: () => import('../pages/my/ProfilePage'),
  settings: () => import('../pages/my/SettingsPage'),
  channel: () => import('../pages/ChannelPage'),
  channels: () => import('../pages/ChannelsPage'),
  channelForm: () => import('../pages/ChannelFormPage'),
  channelManage: () => import('../pages/ChannelManagePage'),
};

export const preload = Object.fromEntries(
  Object.entries(loaders).map(([k, load]) => [k, () => void load()]),
) as Record<keyof typeof loaders, () => void>;
