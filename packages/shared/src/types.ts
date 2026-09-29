export interface User {
  id: number;
  email: string;
  nickname: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor?: number;
}

export interface ChannelSummary {
  id: number;
  slug: string;
  name: string;
  description: string;
  postCount: number;
  memberCount: number;
}

/** 채널 목록용: 채널 + 최근 글 미리보기(최대 8개) */
export interface ChannelPreview extends ChannelSummary {
  /** 보는 사람이 가입했는지 (비로그인은 false) */
  joined: boolean;
  recentPosts: PostSummary[];
}

/** 내가 가입한 채널 (owner: 내가 만든 채널) */
export interface MyChannel extends ChannelSummary {
  owner: boolean;
}

export interface MembershipResponse {
  joined: boolean;
  memberCount: number;
}

export interface ChannelCategory {
  id: number;
  name: string;
  /** 채널 관리자만 글을 쓸 수 있는 카테고리 (공지사항 등) */
  ownerOnly: boolean;
}

export interface ChannelDetail extends ChannelSummary {
  ownerNickname?: string;
  createdAt: string;
  mine: boolean;
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
}

export interface PostSummary {
  id: number;
  channelSlug: string;
  channelName: string;
  categoryName?: string;
  title: string;
  excerpt: string;
  authorNickname: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
}

export interface PostDetail {
  id: number;
  channel: { slug: string; name: string };
  category?: { id: number; name: string };
  title: string;
  content: string;
  author: { id: number; nickname: string };
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  liked: boolean;
  mine: boolean;
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
  content: string;
  likeCount: number;
  liked: boolean;
  createdAt: string;
  mine: boolean;
}

export interface LikeResponse {
  liked: boolean;
  likeCount: number;
}
