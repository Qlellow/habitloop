export interface User {
  id: number;
  email: string;
  nickname: string;
  /** 2단계 인증: 켜면 로그인할 때 이메일로 받은 인증번호를 한 번 더 입력한다 */
  twoFactorEnabled?: boolean;
  /** 설정에서 생년월일로 나이를 확인했는지 */
  ageChecked?: boolean;
  /** 만 19세 이상 (19세 이상 채널·카테고리를 볼 수 있다) */
  adult?: boolean;
}

/** 로그인한 기기 (마이페이지 > 설정 > 로그인한 기기) */
export interface LoginSession {
  id: string;
  /** "Chrome · Windows" 처럼 사람이 알아볼 이름 */
  device: string;
  createdAt: string;
  lastUsedAt: string;
  /** 지금 이 기기 */
  current: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * 로그인 결과. 2단계 인증이 꺼져 있으면 token·user 가,
 * 켜져 있으면 twoFactorRequired 와 번호 입력용 challenge, 가린 이메일이 온다.
 */
export interface LoginResponse {
  token?: string;
  user?: User;
  twoFactorRequired: boolean;
  challenge?: string;
  maskedEmail?: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor?: number;
}

/**
 * 채널 운영진 역할. 닉네임 옆 배지로 보여 준다 (일반 멤버는 역할 없음 = undefined)
 * - OWNER 소유자 · ADMIN 관리자(채널 관리) · MANAGER 매니저(글·댓글 정리)
 */
export type ChannelRole = 'OWNER' | 'ADMIN' | 'MANAGER';

export interface ChannelSummary {
  id: number;
  /** 고리: 채널 주소(/c/고리)에 쓰이는 짧은 이름 */
  slug: string;
  name: string;
  /** 마크다운 */
  description: string;
  postCount: number;
  memberCount: number;
  /** 0 보다 크면 프로필 이미지가 있다 (channelIconUrl 로 주소를 만든다) */
  iconVersion: number;
  /** 이미지가 없을 때 프로필 색 번호 (CHANNEL_COLORS). 없으면 고리로 정한 색 */
  color?: number | null;
  /** public: 누구나 / private: 초대로만 팔로우, 팔로워만 볼 수 있다 */
  visibility?: 'public' | 'private';
  /** 만 19세 이상만 */
  adult?: boolean;
}

/** 채널 목록용: 채널 + 최근 글 미리보기(최대 8개) */
export interface ChannelPreview extends ChannelSummary {
  /** 보는 사람이 가입했는지 (비로그인은 false) */
  joined: boolean;
  recentPosts: PostSummary[];
}

/** 내가 팔로우한 채널 (owner: 내가 만든 채널) */
export interface MyChannel extends ChannelSummary {
  owner: boolean;
  role?: ChannelRole;
}

/** 운영진 목록 · 멤버 검색 결과 (role 이 'MEMBER' 면 일반 멤버) */
export interface StaffMember {
  userId: number;
  nickname: string;
  role: ChannelRole | 'MEMBER';
}

export interface MembershipResponse {
  joined: boolean;
  memberCount: number;
}

export interface ChannelCategory {
  id: number;
  name: string;
  /** 운영진(소유자·관리자·매니저)만 글을 쓸 수 있는 카테고리 (공지사항 등) */
  ownerOnly: boolean;
  /** 만 19세 이상만 볼 수 있는 카테고리 */
  adult?: boolean;
}

export interface ChannelDetail extends ChannelSummary {
  /** 볼 수 없는 채널: private(초대 필요) · adult(나이 확인 필요). 이때는 이름·프로필만 온다 */
  locked?: 'private' | 'adult';
  /** 운영진(관리)에게만: 비공개 채널 초대 코드 */
  inviteCode?: string;
  ownerNickname?: string;
  createdAt: string;
  /** 소유자인지 */
  mine: boolean;
  /** 보는 사람의 운영진 역할 (일반 멤버·비회원은 없음) */
  myRole?: ChannelRole;
  /** 채널 관리(정보·프로필·카테고리)를 할 수 있는지: 소유자·관리자 */
  canManage: boolean;
  /** 운영진 전용 카테고리에 글을 쓸 수 있는지: 소유자·관리자·매니저 */
  staff: boolean;
  /** 가입해야 글을 쓸 수 있다 (보기·공감·댓글은 가입 없이 가능) */
  joined: boolean;
  /** 북마크 (가입과 별개) */
  bookmarked: boolean;
  categories: ChannelCategory[];
}

export interface ChannelInput {
  slug?: string;
  name: string;
  description: string;
  /** 기본 프로필 색 번호 */
  color?: number;
  visibility?: 'public' | 'private';
  adult?: boolean;
}

/** 초대 화면에 보이는 채널 정보 */
export interface InviteInfo {
  slug: string;
  name: string;
  iconVersion: number;
  color: number | null;
  memberCount: number;
  adult: boolean;
  joined: boolean;
}

export interface PostSummary {
  id: number;
  channelSlug: string;
  channelName: string;
  categoryName?: string;
  title: string;
  excerpt: string;
  authorId: number;
  authorNickname: string;
  authorRole?: ChannelRole;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
}

/** 번호 페이지 목록 (채널 글 목록) */
export interface PostPage {
  items: PostSummary[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/** 작성자 프로필 (공개 정보만) */
export interface UserProfile {
  id: number;
  nickname: string;
  createdAt: string;
  postCount: number;
  commentCount: number;
}

export interface PostDetail {
  id: number;
  channel: { slug: string; name: string; iconVersion: number; color?: number | null };
  category?: { id: number; name: string };
  title: string;
  content: string;
  author: { id: number; nickname: string; role?: ChannelRole };
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  liked: boolean;
  mine: boolean;
  /** 보는 사람이 작성자보다 높은 채널 운영진이라 이 글을 지울 수 있는지 */
  canModerate: boolean;
}

export interface PostInput {
  /** 새 글일 때만 필요 (채널은 옮길 수 없음) */
  channel?: string;
  categoryId?: number | null;
  title: string;
  content: string;
}

export interface Comment {
  id: number;
  authorId: number;
  authorNickname: string;
  authorRole?: ChannelRole;
  content: string;
  likeCount: number;
  liked: boolean;
  createdAt: string;
  mine: boolean;
  /** 내 댓글이거나, 내가 작성자보다 높은 채널 운영진이라 지울 수 있는지 */
  deletable: boolean;
}

export interface LikeResponse {
  liked: boolean;
  likeCount: number;
}
