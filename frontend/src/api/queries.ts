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
  ChannelCategory,
  ChannelDetail,
  ChannelInput,
  ChannelSummary,
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
      retry: (count, error) =>
        count < 2 && !(error instanceof Error && 'status' in error && (error as { status: number }).status < 500),
      refetchOnWindowFocus: false,
    },
  },
});

export interface FeedFilter {
  channel?: string;
  category?: number;
  q?: string;
  authorId?: number;
}

export const keys = {
  posts: ['posts'] as const,
  feed: (f: FeedFilter) => ['posts', 'feed', f] as const,
  popular: (channel?: string) => ['posts', 'popular', channel ?? '*'] as const,
  post: (id: number) => ['post', id] as const,
  comments: (postId: number) => ['comments', postId] as const,
  bestComments: (postId: number) => ['comments', postId, 'best'] as const,
  channels: (q = '') => ['channels', q] as const,
  channel: (slug: string) => ['channel', slug] as const,
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

export function usePopular(channel?: string) {
  return useQuery({
    queryKey: keys.popular(channel),
    queryFn: ({ signal }) => api<PostSummary[]>('/api/posts/popular', { query: { channel }, signal }),
    staleTime: 60_000,
  });
}

/* ───────── 채널 ───────── */

export function useChannels(q = '') {
  const keyword = q.trim();
  return useQuery({
    queryKey: keys.channels(keyword),
    queryFn: ({ signal }) => api<ChannelSummary[]>('/api/channels', { query: { q: keyword }, signal }),
    staleTime: keyword ? 30_000 : 60_000,
    placeholderData: (prev) => prev, // 검색어가 바뀌는 동안 이전 결과를 유지해 깜빡임을 없앤다
  });
}

export function useChannel(slug: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.channel(slug ?? ''),
    queryFn: ({ signal }) => api<ChannelDetail>(`/api/channels/${encodeURIComponent(slug!)}`, { signal }),
    enabled: !!slug,
    // 채널 목록에서 들어오면 이미 아는 이름·소개로 헤더를 먼저 그린다
    placeholderData: () => {
      for (const [, list] of qc.getQueriesData<ChannelSummary[]>({ queryKey: ['channels'] })) {
        const hit = list?.find((c) => c.slug === slug);
        if (hit) return { ...hit, createdAt: '', mine: false, categories: [] };
      }
      return undefined;
    },
  });
}

export function useSaveChannel(slug?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChannelInput) =>
      slug
        ? api<ChannelDetail>(`/api/channels/${encodeURIComponent(slug)}`, {
            method: 'PUT',
            body: { name: input.name, description: input.description },
          })
        : api<ChannelDetail>('/api/channels', { method: 'POST', body: input }),
    onSuccess: (channel) => {
      qc.setQueryData(keys.channel(channel.slug), channel);
      qc.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

/** 카테고리 관리. 서버가 바뀐 뒤의 전체 목록을 돌려주므로 채널 캐시에 그대로 덮어쓴다. */
export function useCategoryMutation(slug: string) {
  const qc = useQueryClient();
  const base = `/api/channels/${encodeURIComponent(slug)}/categories`;
  const setCategories = (categories: ChannelCategory[]) =>
    qc.setQueryData<ChannelDetail>(keys.channel(slug), (c) => c && { ...c, categories });

  return useMutation({
    mutationFn: (
      action:
        | { type: 'create'; name: string; ownerOnly: boolean }
        | { type: 'update'; id: number; name: string; ownerOnly: boolean }
        | { type: 'delete'; id: number }
        | { type: 'reorder'; ids: number[] },
    ) => {
      switch (action.type) {
        case 'create':
          return api<ChannelCategory[]>(base, { method: 'POST', body: action });
        case 'update':
          return api<ChannelCategory[]>(`${base}/${action.id}`, { method: 'PUT', body: action });
        case 'delete':
          return api<ChannelCategory[]>(`${base}/${action.id}`, { method: 'DELETE' });
        case 'reorder':
          return api<ChannelCategory[]>(`${base}/order`, { method: 'PUT', body: { ids: action.ids } });
      }
    },
    // 순서 바꾸기는 누르는 즉시 화면에 반영한다
    onMutate: (action) => {
      const prev = qc.getQueryData<ChannelDetail>(keys.channel(slug));
      if (action.type === 'reorder' && prev) {
        const byId = new Map(prev.categories.map((c) => [c.id, c]));
        setCategories(action.ids.map((id) => byId.get(id)!).filter(Boolean));
      }
      return { prev };
    },
    onError: (_e, _a, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.channel(slug), ctx.prev);
    },
    onSuccess: (categories, action) => {
      setCategories(categories);
      // 이름이 바뀌거나 지워지면 목록의 카테고리 표시도 달라진다
      if (action.type !== 'create' && action.type !== 'reorder') {
        qc.invalidateQueries({ queryKey: keys.posts });
        qc.removeQueries({ queryKey: ['post'] });
      }
    },
  });
}

/* ───────── 게시글 ───────── */

export function usePost(id: number, placeholder?: PostSummary) {
  return useQuery({
    queryKey: keys.post(id),
    queryFn: ({ signal }) => api<PostDetail>(`/api/posts/${id}`, { signal }),
    // 목록에서 넘어온 경우 이미 아는 정보(제목, 작성자 등)로 먼저 그려서 체감 속도를 높인다
    placeholderData: placeholder
      ? () => ({
          id: placeholder.id,
          channel: { slug: placeholder.channelSlug, name: placeholder.channelName },
          category: undefined,
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

/** 목록 캐시는 지우지 않고 stale 표시만 해서, 다음에 볼 때 백그라운드로 갱신되게 한다. */
function markListsStale(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: keys.posts, refetchType: 'none' });
  qc.invalidateQueries({ queryKey: ['channel'], refetchType: 'none' });
  qc.invalidateQueries({ queryKey: ['channels'], refetchType: 'none' });
}

export function useSavePost(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PostInput) =>
      id
        ? api<PostDetail>(`/api/posts/${id}`, {
            method: 'PUT',
            body: { categoryId: input.categoryId ?? null, title: input.title, content: input.content },
          })
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
      qc.setQueriesData<PostSummary[]>({ queryKey: ['posts', 'popular'] }, (list) =>
        list?.filter((it) => it.id !== id),
      );
      markListsStale(qc);
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
      qc.invalidateQueries({ queryKey: keys.posts, refetchType: 'none' });
    },
  });
}

/* ───────── 댓글 ───────── */

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

export function useBestComments(postId: number) {
  return useQuery({
    queryKey: keys.bestComments(postId),
    queryFn: ({ signal }) => api<Comment[]>(`/api/posts/${postId}/comments/best`, { signal }),
  });
}

type CommentPages = InfiniteData<CursorPage<Comment>>;

/** 댓글 목록과 베스트 댓글 캐시에 들어 있는 같은 댓글을 한 번에 고친다 */
function patchComment(qc: QueryClient, postId: number, commentId: number, patch: (c: Comment) => Comment) {
  qc.setQueryData<CommentPages>(keys.comments(postId), (data) =>
    data && {
      ...data,
      pages: data.pages.map((p) => ({ ...p, items: p.items.map((c) => (c.id === commentId ? patch(c) : c)) })),
    },
  );
  qc.setQueryData<Comment[]>(keys.bestComments(postId), (list) =>
    list?.map((c) => (c.id === commentId ? patch(c) : c)),
  );
}

export function useToggleCommentLike(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, like }: { commentId: number; like: boolean }) =>
      api<LikeResponse>(`/api/posts/${postId}/comments/${commentId}/like`, { method: like ? 'POST' : 'DELETE' }),
    onMutate: async ({ commentId, like }) => {
      await qc.cancelQueries({ queryKey: keys.comments(postId) });
      const prevPages = qc.getQueryData<CommentPages>(keys.comments(postId));
      const prevBest = qc.getQueryData<Comment[]>(keys.bestComments(postId));
      patchComment(qc, postId, commentId, (c) => ({ ...c, liked: like, likeCount: c.likeCount + (like ? 1 : -1) }));
      return { prevPages, prevBest };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(keys.comments(postId), ctx?.prevPages);
      qc.setQueryData(keys.bestComments(postId), ctx?.prevBest);
    },
    onSuccess: (res, { commentId }) => {
      patchComment(qc, postId, commentId, (c) => ({ ...c, ...res }));
      // 좋아요 수가 바뀌면 베스트 댓글 순위가 달라질 수 있으니 그것만 다시 받는다
      qc.invalidateQueries({ queryKey: keys.bestComments(postId) });
    },
  });
}

function bumpCommentCount(qc: QueryClient, postId: number, delta: number) {
  qc.setQueryData<PostDetail>(keys.post(postId), (p) => p && { ...p, commentCount: p.commentCount + delta });
  qc.invalidateQueries({ queryKey: keys.posts, refetchType: 'none' });
}

export function useAddComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api<Comment>(`/api/posts/${postId}/comments`, { method: 'POST', body: { content } }),
    onSuccess: (comment) => {
      const cache = qc.getQueryData<CommentPages>(keys.comments(postId));
      const last = cache?.pages.at(-1);
      // 모든 댓글을 다 불러온 상태면 마지막 페이지에 붙이고, 아니면 다음 페이지 로드 때 자연스럽게 보이게 둔다
      if (cache && last && last.nextCursor == null) {
        qc.setQueryData<CommentPages>(keys.comments(postId), {
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
      qc.setQueryData<CommentPages>(keys.comments(postId), (data) =>
        data && {
          ...data,
          pages: data.pages.map((p) => ({ ...p, items: p.items.filter((c) => c.id !== commentId) })),
        },
      );
      qc.setQueryData<Comment[]>(keys.bestComments(postId), (list) => list?.filter((c) => c.id !== commentId));
      bumpCommentCount(qc, postId, -1);
    },
  });
}

/* ───────── 인증 ───────── */

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
      qc.removeQueries({ queryKey: ['channel'] });
    },
  });
}
