export type Category = 'FREE' | 'QUESTION' | 'INFO' | 'DAILY';

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

export interface PostSummary {
  id: number;
  category: Category;
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
  category: Category;
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
  category: Category;
  title: string;
  content: string;
}

export interface Comment {
  id: number;
  authorId: number;
  authorNickname: string;
  content: string;
  createdAt: string;
  mine: boolean;
}

export interface LikeResponse {
  liked: boolean;
  likeCount: number;
}
