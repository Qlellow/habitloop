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
}

/** 채널 목록용: 채널 + 최근 글 미리보기(최대 8개) */
export interface ChannelPreview extends ChannelSummary {
  recentPosts: PostSummary[];
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
