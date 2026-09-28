import {
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from './client';
import type {
  AuthResponse,
  Category,
  Comment,
  CursorPage,
  LikeResponse,
  PostDetail,
  PostInput,
  PostSummary,
} from './types';
import { authStore } from '../auth/authStore';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30초 안에 같은 화면으로 돌아오면 요청 없이 캐시로 즉시 렌더
      gcTime: 5 * 60_000,
      retry: (count, error) => count < 2 && !(error instanceof Error && 'status' in error && (error as { status: number }).status < 500),
      refetchOnWindowFocus: false,
    },
  },
});

export interface FeedFilter {
  category?: Category;
  q?: string;
  authorId?: number;
}

export const keys = {
  posts: ['posts'] as const,
  feed: (f: FeedFilter) => ['posts', 'feed', f] as const,
  popular: ['posts', 'popular'] as const,
  post: (id: number) => ['post', id] as const,
  comments: (postId: number) => ['comments', postId] as const,
};

const PAGE_SIZE = 20;

export function useFeed(filter: FeedFilter, enabled = true) {
  return useInfiniteQuery({
    queryKey: keys.feed(filter),
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<PostSummary>>('/api/posts', {
        query: { ...filter, cursor: pageParam, size: PAGE_SIZE },
        signal,
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });
}

export function usePopular() {
  return useQuery({
    queryKey: keys.popular,
    queryFn: ({ signal }) => api<PostSummary[]>('/api/posts/popular', { signal }),
    staleTime: 60_000,
  });
}

export function usePost(id: number, placeholder?: PostSummary) {
  return useQuery({
    queryKey: keys.post(id),
    queryFn: ({ signal }) => api<PostDetail>(`/api/posts/${id}`, { signal }),
    // 목록에서 넘어온 경우 이미 아는 정보(제목, 작성자 등)로 먼저 그려서 체감 속도를 높인다
    placeholderData: placeholder
      ? () => ({
          id: placeholder.id,
          category: placeholder.category,
          title: placeholder.title,
          content: '',
          author: { id: 0, nickname: placeholder.authorNickname },
          likeCount: placeholder.likeCount,
          commentCount: placeholder.commentCount,
          viewCount: placeholder.viewCount,
          createdAt: placeholder.createdAt,
          updatedAt: placeholder.createdAt,
          liked: false,
          mine: false,
        })
      : undefined,
  });
}

export function useComments(postId: number) {
  return useInfiniteQuery({
    queryKey: keys.comments(postId),
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<Comment>>(`/api/posts/${postId}/comments`, {
        query: { cursor: pageParam, size: 30 },
        signal,
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** 목록 캐시는 지우지 않고 stale 표시만 해서, 다음에 볼 때 백그라운드로 갱신되게 한다. */
function markListsStale(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: keys.posts, refetchType: 'none' });
}

export function useSavePost(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PostInput) =>
      id
        ? api<PostDetail>(`/api/posts/${id}`, { method: 'PUT', body: input })
        : api<PostDetail>('/api/posts', { method: 'POST', body: input }),
    onSuccess: (post) => {
      qc.setQueryData(keys.post(post.id), post);
      markListsStale(qc);
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/posts/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: keys.post(id) });
      qc.removeQueries({ queryKey: keys.comments(id) });
      // 삭제된 글이 목록에 남아 보이지 않도록 즉시 캐시에서 빼 준다
      qc.setQueriesData<InfiniteData<CursorPage<PostSummary>>>({ queryKey: ['posts', 'feed'] }, (data) =>
        data && {
          ...data,
          pages: data.pages.map((p) => ({ ...p, items: p.items.filter((it) => it.id !== id) })),
        },
      );
      qc.setQueryData<PostSummary[]>(keys.popular, (list) => list?.filter((it) => it.id !== id));
    },
  });
}

/** 좋아요는 낙관적 업데이트: 누르는 즉시 반영하고 실패하면 되돌린다. */
export function useToggleLike(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (like: boolean) =>
      api<LikeResponse>(`/api/posts/${postId}/like`, { method: like ? 'POST' : 'DELETE' }),
    onMutate: async (like) => {
      await qc.cancelQueries({ queryKey: keys.post(postId) });
      const prev = qc.getQueryData<PostDetail>(keys.post(postId));
      if (prev) {
        qc.setQueryData<PostDetail>(keys.post(postId), {
          ...prev,
          liked: like,
          likeCount: prev.likeCount + (like ? 1 : -1),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.post(postId), ctx.prev);
    },
    onSuccess: (res) => {
      qc.setQueryData<PostDetail>(keys.post(postId), (p) => p && { ...p, ...res });
      markListsStale(qc);
    },
  });
}

function bumpCommentCount(qc: QueryClient, postId: number, delta: number) {
  qc.setQueryData<PostDetail>(keys.post(postId), (p) => p && { ...p, commentCount: p.commentCount + delta });
  markListsStale(qc);
}

export function useAddComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api<Comment>(`/api/posts/${postId}/comments`, { method: 'POST', body: { content } }),
    onSuccess: (comment) => {
      const cache = qc.getQueryData<InfiniteData<CursorPage<Comment>>>(keys.comments(postId));
      const last = cache?.pages.at(-1);
      // 모든 댓글을 다 불러온 상태면 마지막 페이지에 붙이고, 아니면 다음 페이지 로드 때 자연스럽게 보이게 둔다
      if (cache && last && last.nextCursor == null) {
        qc.setQueryData<InfiniteData<CursorPage<Comment>>>(keys.comments(postId), {
          ...cache,
          pages: [...cache.pages.slice(0, -1), { ...last, items: [...last.items, comment] }],
        });
      }
      bumpCommentCount(qc, postId, 1);
    },
  });
}

export function useDeleteComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) =>
      api<void>(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: (_, commentId) => {
      qc.setQueryData<InfiniteData<CursorPage<Comment>>>(keys.comments(postId), (data) =>
        data && {
          ...data,
          pages: data.pages.map((p) => ({ ...p, items: p.items.filter((c) => c.id !== commentId) })),
        },
      );
      bumpCommentCount(qc, postId, -1);
    },
  });
}

export function useAuthMutation(mode: 'login' | 'signup') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string; nickname?: string }) =>
      api<AuthResponse>(`/api/auth/${mode}`, { method: 'POST', body }),
    onSuccess: (res) => {
      authStore.signIn(res);
      // liked / mine 같은 사용자별 필드가 바뀌므로 상세 캐시는 버린다
      qc.removeQueries({ queryKey: ['post'] });
      qc.removeQueries({ queryKey: ['comments'] });
    },
  });
}
