import {
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api, ApiError, apiUrl } from './client';
import type {
  AuthResponse,
  LoginResponse,
  LoginSession,
  InviteInfo,
  AttendanceResult,
  MyInvite,
  PointLog,
  NotificationItem,
  ReportReason,
  ReportGroup,
  ReportAction,
  PostPage,
  UserProfile,
  ChannelCategory,
  ChannelDetail,
  ChannelInput,
  ChannelPreview,
  ChannelSummary,
  MembershipResponse,
  MyChannel,
  StaffMember,
  Comment,
  CursorPage,
  LikeResponse,
  PostDetail,
  PostInput,
  PostSummary,
  User,
} from './types';
import { authStore } from './auth';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30초 안에 같은 화면으로 돌아오면 요청 없이 캐시로 즉시 렌더
      gcTime: 5 * 60_000,
      // 네트워크 끊김(0)이나 서버 오류(5xx)만 재시도하고, 404 같은 요청 오류는 바로 보여 준다
      retry: (count, error) =>
        count < 2 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
      refetchOnWindowFocus: false,
    },
  },
});

export interface FeedFilter {
  channel?: string;
  category?: number;
  q?: string;
  /** 작성자 UUID */
  authorId?: string;
}

export const keys = {
  posts: ['posts'] as const,
  feed: (f: FeedFilter) => ['posts', 'feed', f] as const,
  popular: (channel?: string) => ['posts', 'popular', channel ?? '*'] as const,
  post: (id: number) => ['post', id] as const,
  comments: (postId: number) => ['comments', postId] as const,
  bestComments: (postId: number) => ['comments', postId, 'best'] as const,
  channels: (q = '') => ['channels', q] as const,
  channelPreviews: (q = '') => ['channels', 'previews', q] as const,
  myChannels: ['channels', 'mine'] as const,
  bookmarkedChannels: ['channels', 'bookmarks'] as const,
  channel: (slug: string) => ['channel', slug] as const,
  staff: (slug: string) => ['channel', slug, 'staff'] as const,
  memberSearch: (slug: string, q: string) => ['channel', slug, 'members', q] as const,
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

export type PostSort = 'latest' | 'likes' | 'comments' | 'views';

export interface ChannelPostsFilter {
  channel: string;
  category?: number;
  q?: string;
  sort?: PostSort;
  page?: number;
  /** 전체 탭: 위에 고정한 공지는 목록에서 뺀다 */
  excludeNotices?: boolean;
}

/** 채널 글 목록 (번호 페이지 20개씩 · 검색 · 정렬). 페이지를 넘기는 동안 이전 페이지를 보여 준다 */
export function useChannelPosts(filter: ChannelPostsFilter, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['posts', 'page', filter] as const,
    queryFn: ({ signal }) =>
      api<PostPage>('/api/posts/page', {
        query: { ...filter, q: filter.q?.trim() || undefined, excludeNotices: filter.excludeNotices ? 'true' : undefined, size: PAGE_SIZE },
        signal,
      }),
    placeholderData: (prev) => prev,
  });
}

/** 채널 공지 (운영진 전용 카테고리 글): 전체 탭 위에 고정 */
export function useNotices(channel: string, enabled = true) {
  return useQuery({
    queryKey: ['posts', 'notices', channel] as const,
    queryFn: ({ signal }) => api<PostSummary[]>('/api/posts/notices', { query: { channel }, signal }),
    enabled,
  });
}

/** 작성자 프로필 */
/** 사용자 UUID 모양인지 */
export const isUserId = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function useUserProfile(id: string) {
  return useQuery({
    queryKey: ['user', id] as const,
    queryFn: ({ signal }) => api<UserProfile>(`/api/users/${encodeURIComponent(id)}`, { signal }),
    enabled: isUserId(id),
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

/**
 * 채널 목록 + 채널마다 최근 글 미리보기. 서버가 한 번의 요청으로 모든 채널의 글을 묶어서 준다.
 * 키가 ['channels', ...] 아래라 글을 쓰거나 지우면 함께 stale 처리된다.
 */
export function useChannelPreviews(q = '', postsPerChannel = 8) {
  const keyword = q.trim();
  return useQuery({
    queryKey: keys.channelPreviews(keyword),
    queryFn: ({ signal }) =>
      api<ChannelPreview[]>('/api/channels/previews', { query: { q: keyword, size: postsPerChannel }, signal }),
    placeholderData: (prev) => prev, // 검색어가 바뀌는 동안 이전 결과를 유지해 깜빡임을 없앤다
  });
}

export function useChannel(slug: string | undefined) {
  const qc = useQueryClient();
  return useQuery<ChannelDetail>({
    queryKey: keys.channel(slug ?? ''),
    queryFn: ({ signal }) => api<ChannelDetail>(`/api/channels/${encodeURIComponent(slug!)}`, { signal }),
    enabled: !!slug,
    // 채널 목록에서 들어오면 이미 아는 이름·소개로 헤더를 먼저 그린다
    placeholderData: (): ChannelDetail | undefined => {
      for (const [, list] of qc.getQueriesData<ChannelSummary[]>({ queryKey: ['channels'] })) {
        const hit = list?.find((c) => c.slug === slug);
        if (hit)
          return { ...hit, createdAt: '', mine: false, canManage: false, staff: false, joined: false, bookmarked: false, categories: [] };
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
            body: { name: input.name, description: input.description, color: input.color, visibility: input.visibility, adult: input.adult },
          })
        : api<ChannelDetail>('/api/channels', { method: 'POST', body: input }),
    onSuccess: (channel) => {
      qc.setQueryData(keys.channel(channel.slug), channel);
      qc.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

/**
 * 채널 프로필 이미지 올리기/지우기 (소유자·관리자).
 * 새 버전 번호를 채널 캐시에 바로 넣어 이미지가 곧장 바뀌고, 목록에 보이는 채널도 다시 받는다.
 */
export function useChannelIcon(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (image: Blob | null) =>
      image
        ? api<{ iconVersion: number }>(`/api/channels/${encodeURIComponent(slug)}/icon`, { method: 'PUT', blob: image })
        : api<void>(`/api/channels/${encodeURIComponent(slug)}/icon`, { method: 'DELETE' }).then(() => ({ iconVersion: 0 })),
    onSuccess: ({ iconVersion }) => {
      qc.setQueryData<ChannelDetail>(keys.channel(slug), (c) => (c ? { ...c, iconVersion } : c));
      qc.invalidateQueries({ queryKey: ['channels'] });
      qc.invalidateQueries({ queryKey: ['post'] });
    },
  });
}

/** 운영진 목록 (소유자 → 관리자 → 매니저) */
export function useStaff(slug: string) {
  return useQuery({
    queryKey: keys.staff(slug),
    queryFn: ({ signal }) => api<StaffMember[]>(`/api/channels/${encodeURIComponent(slug)}/staff`, { signal }),
  });
}

/** 운영진으로 지정할 멤버를 닉네임으로 찾기 (소유자만) */
export function useMemberSearch(slug: string, q: string) {
  const keyword = q.trim();
  return useQuery({
    queryKey: keys.memberSearch(slug, keyword),
    queryFn: ({ signal }) =>
      api<StaffMember[]>(`/api/channels/${encodeURIComponent(slug)}/members`, { query: { q: keyword }, signal }),
    enabled: keyword.length > 0,
    placeholderData: (prev) => prev,
  });
}

/** 멤버를 관리자·매니저로 지정하거나 일반 멤버로 되돌린다 (소유자만). 배지가 보이는 글·댓글도 다시 받는다 */
export function useChangeRole(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: StaffMember['role'] }) =>
      api<StaffMember[]>(`/api/channels/${encodeURIComponent(slug)}/members/${userId}/role`, { method: 'PUT', body: { role } }),
    onSuccess: (staff) => {
      qc.setQueryData(keys.staff(slug), staff);
      qc.invalidateQueries({ queryKey: ['channel', slug, 'members'] });
      qc.invalidateQueries({ queryKey: keys.posts });
      qc.removeQueries({ queryKey: ['post'] });
      qc.removeQueries({ queryKey: ['comments'] });
    },
  });
}

/** 내가 팔로우한 채널, 북마크한 채널이 먼저 (로그인했을 때만) */
export function useMyChannels(enabled: boolean) {
  return useQuery({
    queryKey: keys.myChannels,
    queryFn: ({ signal }) => api<MyChannel[]>('/api/me/channels', { signal }),
    enabled,
  });
}

/** 채널 팔로우/팔로우 취소. 채널 화면은 즉시 바꾸고, 채널 목록·내 채널은 다시 받는다. */
export function useMembership(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    /** code: 비공개 채널의 초대 코드 */
    mutationFn: (join: boolean | { code: string }) =>
      api<MembershipResponse>(`/api/channels/${encodeURIComponent(slug)}/members${join ? '' : '/me'}`, {
        method: join ? 'POST' : 'DELETE',
        body: typeof join === 'object' ? join : undefined,
      }),
    onSuccess: (res, join) => {
      qc.setQueryData<ChannelDetail>(keys.channel(slug), (c) => c && { ...c, ...res });
      qc.invalidateQueries({ queryKey: ['channels'] });
      // 잠겨 있던 비공개 채널: 팔로우했으니 소개·카테고리·글을 다시 받는다
      if (typeof join === 'object') qc.invalidateQueries({ queryKey: keys.channel(slug) });
    },
  });
}

/** 초대 링크 화면: 채널 이름·프로필 */
export function useInvite(code: string) {
  return useQuery({
    queryKey: ['invite', code] as const,
    queryFn: ({ signal }) => api<InviteInfo>(`/api/invites/${encodeURIComponent(code)}`, { signal }),
    retry: false,
  });
}

/** 초대 코드로 팔로우 */
export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api<{ slug: string }>(`/api/invites/${encodeURIComponent(code.trim())}`, { method: 'POST' }),
    onSuccess: ({ slug }) => {
      qc.invalidateQueries({ queryKey: keys.channel(slug) });
      qc.invalidateQueries({ queryKey: ['channels'] });
      qc.invalidateQueries({ queryKey: ['invite'] });
    },
  });
}

/** 초대 코드 새로 만들기 (예전 링크·코드·QR 은 막힌다) */
export function useRegenerateInvite(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ inviteCode: string }>(`/api/channels/${encodeURIComponent(slug)}/invite`, { method: 'POST' }),
    onSuccess: ({ inviteCode }) => qc.setQueryData<ChannelDetail>(keys.channel(slug), (c) => c && { ...c, inviteCode }),
  });
}

/** 프로필 사진 · 배너 · 포인트: 바뀐 내 정보로 로그인 상태를 고치고, 사진이 보이는 글·댓글을 새로 받는다 */
function useMeMutation<T>(fn: (input: T) => Promise<User>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (user) => {
      authStore.updateUser(user);
      qc.invalidateQueries({ queryKey: keys.posts });
      qc.invalidateQueries({ queryKey: ['post'] });
      qc.invalidateQueries({ queryKey: ['comments'] });
      qc.invalidateQueries({ queryKey: ['user', user.id] });
      qc.invalidateQueries({ queryKey: ['points'] });
    },
  });
}

/** 프로필 사진: 올린 이미지 id (null 이면 기본) */
export const useSetAvatar = () => useMeMutation((imageId: string | null) => api<User>('/api/me/avatar', { method: 'PUT', body: { imageId } }));

/** 배너: 'p:기본배너' · 'i:이미지id' · null */
export const useSetBanner = () => useMeMutation((banner: string | null) => api<User>('/api/me/banner', { method: 'PUT', body: { banner } }));

/** 커스텀 배너 열기 (포인트 사용) */
export const useUnlockBanner = () => useMeMutation(() => api<User>('/api/me/banner/unlock', { method: 'POST' }));

/** 포인트 내역 필터: 최신순/오래된순, 전체/적립/사용 */
export interface PointLogFilter {
  order: 'latest' | 'oldest';
  type?: 'earn' | 'spend';
}

/** 포인트 내역 (더 보기로 이어 받는다) */
export function usePointLogs(filter: PointLogFilter, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['points', filter],
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<PointLog>>('/api/me/points', { query: { ...filter, cursor: pageParam, size: 30 }, signal }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });
}

/** 안 읽은 알림 수 (헤더 종의 빨간 점). 창을 보고 있는 동안 30초마다, 창으로 돌아올 때 새로 받는다 */
export function useUnreadNotifications(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: ({ signal }) => api<{ count: number }>('/api/me/notifications/unread', { signal }),
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** 내 알림 목록 (최신순) */
export function useNotifications(enabled = true) {
  return useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<NotificationItem>>('/api/me/notifications', { query: { cursor: pageParam, size: 20 }, signal }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });
}

/** 알림 읽음 표시: id 가 없으면 모두 읽음 */
export function useReadNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id?: number) =>
      api<void>(id == null ? '/api/me/notifications/read' : `/api/me/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

/** 오늘 출석 체크 (하루 한 번 포인트). 포인트가 쌓였으면 내 정보도 새로 받는다 */
export async function checkAttendance() {
  const result = await api<AttendanceResult>('/api/me/attendance', { method: 'POST' });
  if (result.awarded) await verifySession();
  return result;
}

/** 내 초대 코드와 초대한 사람 수 */
export function useMyInvite(enabled = true) {
  return useQuery({ queryKey: ['my-invite'], queryFn: ({ signal }) => api<MyInvite>('/api/me/invite', { signal }), enabled });
}

/** 닉네임을 쓸 수 있는지 한 번 확인 (내 정보 수정의 저장 버튼) */
export function checkNickname(nickname: string) {
  return api<{ available: boolean; reason?: string }>('/api/auth/nickname', { query: { nickname } });
}

/** 나이 확인: 생년월일 저장 (테스트 중이라 다시 바꿀 수 있다) */
export function useVerifyAge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (birthDate: string) => api<User>('/api/me/age', { method: 'PUT', body: { birthDate } }),
    onSuccess: (user) => {
      authStore.updateUser(user);
      // 19세 이상 채널·글이 새로 보일 수 있다
      qc.invalidateQueries({ queryKey: ['channels'] });
      qc.invalidateQueries({ queryKey: ['channel'] });
      qc.invalidateQueries({ queryKey: keys.posts });
    },
  });
}

/** 내가 북마크한 채널 */
export function useBookmarkedChannels(enabled: boolean) {
  return useQuery({
    queryKey: keys.bookmarkedChannels,
    queryFn: ({ signal }) => api<ChannelSummary[]>('/api/me/bookmarks/channels', { signal }),
    enabled,
  });
}

/** 채널 북마크 켜기/끄기 (누르는 즉시 반영) */
export function useBookmark(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) =>
      api<{ bookmarked: boolean }>(`/api/channels/${encodeURIComponent(slug)}/bookmark`, {
        method: on ? 'PUT' : 'DELETE',
      }),
    onMutate: (on) => {
      const prev = qc.getQueryData<ChannelDetail>(keys.channel(slug));
      qc.setQueryData<ChannelDetail>(keys.channel(slug), (c) => c && { ...c, bookmarked: on });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.channel(slug), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.bookmarkedChannels });
      // 팔로우한 채널 목록은 북마크한 채널을 앞에 두므로 순서가 바뀐다
      qc.invalidateQueries({ queryKey: keys.myChannels });
    },
  });
}

/** 카테고리 관리. 서버가 바뀐 뒤의 전체 목록을 돌려주므로 채널 캐시에 그대로 덮어쓴다. */
/** 카테고리별 글 수 (채널 관리에서 카테고리를 지울 때) */
export function useCategoryPostCounts(slug: string, enabled = true) {
  return useQuery({
    queryKey: ['category-post-counts', slug],
    queryFn: ({ signal }) => api<Record<number, number>>(`/api/channels/${encodeURIComponent(slug)}/categories/post-counts`, { signal }),
    enabled,
  });
}

export function useCategoryMutation(slug: string) {
  const qc = useQueryClient();
  const base = `/api/channels/${encodeURIComponent(slug)}/categories`;
  const setCategories = (categories: ChannelCategory[]) =>
    qc.setQueryData<ChannelDetail>(keys.channel(slug), (c) => c && { ...c, categories });

  return useMutation({
    mutationFn: (
      action:
        | { type: 'create'; name: string; ownerOnly: boolean; adult?: boolean }
        | { type: 'update'; id: number; name: string; ownerOnly: boolean; adult?: boolean }
        /** moveTo: 이 카테고리의 글을 옮길 카테고리 */
        | { type: 'delete'; id: number; moveTo?: number }
        | { type: 'reorder'; ids: number[] },
    ) => {
      switch (action.type) {
        case 'create':
          return api<ChannelCategory[]>(base, { method: 'POST', body: action });
        case 'update':
          return api<ChannelCategory[]>(`${base}/${action.id}`, { method: 'PUT', body: action });
        case 'delete':
          return api<ChannelCategory[]>(`${base}/${action.id}`, { method: 'DELETE', query: action.moveTo ? { moveTo: String(action.moveTo) } : undefined });
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
      if (action.type === 'delete') qc.invalidateQueries({ queryKey: ['category-post-counts', slug] });
    },
  });
}

/* ───────── 게시글 ───────── */

/** ['posts', ...] 아래 캐시 모양: 무한 스크롤 목록 · 번호 페이지 · 인기글/공지 배열 */
type PostsCache = InfiniteData<CursorPage<PostSummary>> | PostPage | PostSummary[];

/** 목록·인기글 캐시에 이미 있는 글 요약을 찾는다 (상세 화면을 먼저 그리는 데 쓴다) */
function findCachedSummary(qc: QueryClient, id: number): PostSummary | undefined {
  for (const [, data] of qc.getQueriesData<PostsCache>({ queryKey: keys.posts })) {
    if (!data) continue;
    const items = Array.isArray(data) ? data : 'pageParams' in data ? data.pages.flatMap((p) => p.items) : data.items;
    const hit = items.find((p) => p.id === id);
    if (hit) return hit;
  }
  // 채널 목록의 최근 글 미리보기에서 들어온 경우
  for (const [, list] of qc.getQueriesData<ChannelPreview[]>({ queryKey: ['channels', 'previews'] })) {
    const hit = list?.flatMap((c) => c.recentPosts).find((p) => p.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * 상세를 받아 오면 목록·인기글·채널 미리보기 캐시에 있는 같은 글의 숫자(조회·좋아요·댓글)도 맞춘다.
 * 그래야 뒤로 가기로 목록에 돌아왔을 때 새로고침 없이 방금 늘어난 조회수가 보인다.
 */
function syncCachedSummary(qc: QueryClient, post: PostDetail) {
  const patch = (p: PostSummary): PostSummary =>
    p.id !== post.id ||
    (p.viewCount === post.viewCount && p.likeCount === post.likeCount && p.commentCount === post.commentCount)
      ? p
      : { ...p, viewCount: post.viewCount, likeCount: post.likeCount, commentCount: post.commentCount };
  // 바뀐 게 없으면 원래 참조를 그대로 돌려줘서 불필요한 리렌더를 막는다
  const patchList = <T extends PostSummary>(list: T[]): T[] => {
    const next = list.map((p) => patch(p) as T);
    return next.some((p, i) => p !== list[i]) ? next : list;
  };

  qc.setQueriesData<PostsCache>({ queryKey: keys.posts }, (data) => {
    if (!data) return data;
    if (Array.isArray(data)) return patchList(data);
    if (!('pageParams' in data)) {
      const items = patchList(data.items);
      return items === data.items ? data : { ...data, items };
    }
    const pages = data.pages.map((page) => {
      const items = patchList(page.items);
      return items === page.items ? page : { ...page, items };
    });
    return pages.some((page, i) => page !== data.pages[i]) ? { ...data, pages } : data;
  });
  qc.setQueriesData<ChannelPreview[]>({ queryKey: ['channels', 'previews'] }, (list) => {
    if (!list) return list;
    const next = list.map((c) => {
      const recentPosts = patchList(c.recentPosts);
      return recentPosts === c.recentPosts ? c : { ...c, recentPosts };
    });
    return next.some((c, i) => c !== list[i]) ? next : list;
  });
}

export function usePost(id: number, placeholder?: PostSummary) {
  const qc = useQueryClient();
  return useQuery<PostDetail>({
    queryKey: keys.post(id),
    queryFn: async ({ signal }) => {
      const post = await api<PostDetail>(`/api/posts/${id}`, { signal });
      syncCachedSummary(qc, post);
      return post;
    },
    // 목록에서 넘어온 경우 이미 아는 정보(제목, 작성자 등)로 먼저 그려서 체감 속도를 높인다
    placeholderData: (): PostDetail | undefined => {
      const summary = placeholder ?? findCachedSummary(qc, id);
      if (!summary) return undefined;
      return {
        id: summary.id,
        channel: { slug: summary.channelSlug, name: summary.channelName, iconVersion: 0 },
        category: undefined,
        title: summary.title,
        content: '',
        author: { id: summary.authorId, nickname: summary.authorNickname, avatarUrl: summary.authorAvatar ?? undefined, role: summary.authorRole },
        likeCount: summary.likeCount,
        commentCount: summary.commentCount,
        viewCount: summary.viewCount,
        createdAt: summary.createdAt,
        updatedAt: summary.createdAt,
        liked: false,
        mine: false,
        canModerate: false,
      };
    },
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
      // 되돌린 값이 틀릴 수도 있으니(예: 동시에 눌려 서버엔 이미 반영) 서버의 실제 상태를 다시 받는다
      qc.invalidateQueries({ queryKey: keys.post(postId) });
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
  // 답글은 댓글의 replies 안에 있다
  const apply = (c: Comment): Comment =>
    c.id === commentId ? patch(c) : c.replies?.length ? { ...c, replies: c.replies.map(apply) } : c;
  qc.setQueryData<CommentPages>(keys.comments(postId), (data) =>
    data && {
      ...data,
      pages: data.pages.map((p) => ({ ...p, items: p.items.map(apply) })),
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
      qc.invalidateQueries({ queryKey: keys.comments(postId) });
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

/** 댓글 달기 (parentId 가 있으면 답글). 답글이 각 댓글 아래에 붙으므로 목록을 다시 받는다 */
export function useAddComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { content: string; parentId?: number }) =>
      api<Comment>(`/api/posts/${postId}/comments`, { method: 'POST', body: typeof input === 'string' ? { content: input } : input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.comments(postId) });
      bumpCommentCount(qc, postId, 1);
    },
  });
}

/** 댓글 고치기 (쓴 사람만) */
export function useEditComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      api<Comment>(`/api/posts/${postId}/comments/${id}`, { method: 'PUT', body: { content } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.comments(postId) }),
  });
}

export function useDeleteComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => api<void>(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      // 답글까지 함께 지워지므로 글의 댓글 수는 다시 받는다
      qc.invalidateQueries({ queryKey: keys.comments(postId) });
      qc.invalidateQueries({ queryKey: keys.post(postId) });
      markListsStale(qc);
    },
  });
}

/* ───────── 신고 ───────── */

/** 글(commentId 없음) 또는 댓글 신고 */
export function useReport() {
  return useMutation({
    mutationFn: ({ postId, commentId, reason, detail }: { postId: number; commentId?: number; reason: ReportReason; detail?: string }) =>
      api<void>(commentId ? `/api/posts/${postId}/comments/${commentId}/report` : `/api/posts/${postId}/report`, {
        method: 'POST',
        body: { reason, detail: detail?.trim() || undefined },
      }),
  });
}

/** 채널 신고함 (운영진만). open: 처리 전 / done: 처리한 것 */
export function useChannelReports(slug: string, status: 'open' | 'done') {
  return useQuery({
    queryKey: ['channel', slug, 'reports', status],
    queryFn: ({ signal }) => api<ReportGroup[]>(`/api/channels/${slug}/reports`, { query: { status }, signal }),
  });
}

/** 신고 처리: 숨기기 · 숨김 풀기 · 지우기 · 문제 없음. 처리하면 신고함 · 채널(신고 수) · 글 목록을 새로 받는다 */
export function useReportAction(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { postId: number; commentId?: number; action: ReportAction }) =>
      api<void>(`/api/channels/${slug}/reports/action`, { method: 'POST', body: input }),
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ['channel', slug] });
      qc.invalidateQueries({ queryKey: keys.post(input.postId) });
      qc.invalidateQueries({ queryKey: keys.comments(input.postId) });
      markListsStale(qc);
    },
  });
}

/* ───────── 인증 ───────── */

/** 앱을 열 때 한 번: 저장된 로그인이 아직 유효한지 확인 (무효면 자동 로그아웃) */
export function verifySession() {
  return authStore.verify(() => api<User>('/api/me'));
}

/** liked / mine 같은 사용자별 필드가 들어 있는 캐시를 버린다 */
function clearUserScopedCache(qc: QueryClient) {
  qc.removeQueries({ queryKey: ['post'] });
  qc.removeQueries({ queryKey: ['comments'] });
  qc.removeQueries({ queryKey: ['channel'] });
  // 가입 여부(joined)·내 채널이 들어 있다
  qc.removeQueries({ queryKey: ['channels'] });
  qc.removeQueries({ queryKey: ['sessions'] });
}

/**
 * 로그아웃: 서버에서 이 기기의 토큰(세션)을 폐기하고, 저장된 토큰을 지운다.
 * 요청은 지금 토큰을 실어 바로 보내고(api 는 호출하는 순간 헤더를 만든다) 응답은 기다리지 않는다.
 * 네트워크가 끊겨 폐기를 못 해도 이 기기에서는 로그아웃되고, 남은 세션은 설정의 "로그인한 기기"에서 지울 수 있다.
 */
export function useSignOut() {
  const qc = useQueryClient();
  return () => {
    if (authStore.getToken()) void api<void>('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    authStore.signOut();
    clearUserScopedCache(qc);
  };
}

/** 닉네임 변경. 서버가 새 토큰을 주므로 로그인 상태를 갱신하고, 닉네임이 보이는 캐시를 새로 받는다. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { nickname: string }) => api<AuthResponse>('/api/me/profile', { method: 'PUT', body }),
    onSuccess: (res) => {
      authStore.signIn(res);
      qc.invalidateQueries({ queryKey: keys.posts });
      qc.removeQueries({ queryKey: ['post'] });
      qc.removeQueries({ queryKey: ['comments'] });
      qc.removeQueries({ queryKey: ['channel'] });
    },
  });
}

/** 비밀번호 변경. 서버가 지금 기기만 남기고 다른 기기를 모두 로그아웃한다 */
export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api<void>('/api/me/password', { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

/** 로그인한 기기 목록 (지금 기기가 맨 위) */
export function useLoginSessions(enabled = true) {
  return useQuery({ queryKey: ['sessions'], queryFn: () => api<LoginSession[]>('/api/me/sessions'), enabled });
}

/** 다른 기기 로그아웃: id 를 주면 그 기기만, 없으면 지금 기기를 뺀 전부 */
export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) =>
      api<void>(id ? `/api/me/sessions/${encodeURIComponent(id)}` : '/api/me/sessions', { method: 'DELETE' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

/** 글 본문 이미지 올리기 (이미지 바이트를 그대로). 돌려받은 url 을 마크다운 ![](url) 로 넣는다 */
export function uploadPostImage(image: Blob) {
  return api<{ id: string; url: string }>('/api/images', { method: 'POST', blob: image });
}

/** 회원가입: 닉네임을 쓸 수 있는지 (이미 누가 쓰는지). 입력이 멈춘 뒤의 값으로 부른다 */
export function useNicknameAvailability(nickname: string, enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'nickname', nickname],
    queryFn: ({ signal }) =>
      api<{ available: boolean; reason?: string }>('/api/auth/nickname', { query: { nickname }, signal }),
    enabled: enabled && nickname.length > 0,
    staleTime: 10_000,
  });
}

/** 회원가입 1단계: 이메일로 인증번호 받기 */
export function useSignupCode() {
  return useMutation({
    mutationFn: (email: string) => api<void>('/api/auth/signup/code', { method: 'POST', body: { email } }),
  });
}

/* ───────── 소셜 로그인 (Google · Kakao · Naver) ───────── */

export type OAuthProvider = 'google' | 'kakao' | 'naver';

/** 키가 설정되어 켜진 소셜 로그인 */
export function useOAuthProviders() {
  return useQuery({
    queryKey: ['oauth-providers'],
    queryFn: ({ signal }) => api<OAuthProvider[]>('/api/auth/oauth/providers', { signal }),
    staleTime: 5 * 60_000,
  });
}

/** 소셜 로그인 시작 주소 (브라우저를 이 주소로 보낸다). next: 로그인 뒤 돌아갈 곳, ref: 초대 코드 */
export function oauthStartUrl(provider: OAuthProvider, next: string, ref?: string) {
  const query = new URLSearchParams({ next });
  if (ref) query.set('ref', ref);
  return apiUrl(`/api/auth/oauth/${provider}/start?${query}`);
}

/** 설정 → 소셜 로그인 연동: 켜진 소셜 로그인 · 내가 연결한 것 · 비밀번호가 있는지 */
export interface Identities {
  enabled: OAuthProvider[];
  linked: { provider: OAuthProvider; createdAt: string }[];
  hasPassword: boolean;
}

export function useIdentities() {
  return useQuery({ queryKey: ['identities'], queryFn: ({ signal }) => api<Identities>('/api/me/identities', { signal }) });
}

/** 연결: 연결 토큰이 든 시작 주소를 받아 그 주소로 이동한다 (제공자 화면을 거쳐 설정으로 돌아온다) */
export function useLinkIdentity() {
  return useMutation({
    mutationFn: (provider: OAuthProvider) => api<{ url: string }>(`/api/me/identities/${provider}/link`, { method: 'POST' }),
    onSuccess: ({ url }) => window.location.assign(apiUrl(url)),
  });
}

export function useUnlinkIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: OAuthProvider) => api<Identities>(`/api/me/identities/${provider}`, { method: 'DELETE' }),
    onSuccess: (data) => qc.setQueryData(['identities'], data),
  });
}

/** 소셜 로그인에서 돌아와 받은 토큰으로 로그인을 마친다 */
export async function completeOAuthLogin(token: string) {
  const res = await fetch(apiUrl('/api/me'), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ApiError(res.status, '로그인을 마치지 못했어요. 다시 시도해 주세요');
  authStore.signIn({ token, user: (await res.json()) as User });
  clearUserScopedCache(queryClient);
}

/** 회원가입 2단계: 이메일로 받은 번호와 함께 가입 */
export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    /** ref: 초대한 사람의 초대 코드 */
    mutationFn: (body: { email: string; password: string; nickname: string; code: string; ref?: string }) =>
      api<AuthResponse>('/api/auth/signup', { method: 'POST', body }),
    onSuccess: (res) => {
      authStore.signIn(res);
      clearUserScopedCache(qc);
    },
  });
}

/**
 * 로그인. 2단계 인증이 꺼져 있으면 바로 로그인되고,
 * 켜져 있으면 결과의 twoFactorRequired·challenge 로 번호 입력 화면을 띄운다 (useVerifyLogin).
 */
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<LoginResponse>('/api/auth/login', { method: 'POST', body }),
    onSuccess: (res) => {
      if (res.token && res.user) {
        authStore.signIn({ token: res.token, user: res.user });
        clearUserScopedCache(qc);
      }
    },
  });
}

/** 2단계 인증 로그인: 이메일로 받은 번호 확인 */
export function useVerifyLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { challenge: string; code: string }) =>
      api<AuthResponse>('/api/auth/login/verify', { method: 'POST', body }),
    onSuccess: (res) => {
      authStore.signIn(res);
      clearUserScopedCache(qc);
    },
  });
}

/** 2단계 인증 로그인: 번호 다시 받기 (새 challenge 를 돌려준다) */
export function useResendLoginCode() {
  return useMutation({
    mutationFn: (challenge: string) =>
      api<{ challenge: string }>('/api/auth/login/resend', { method: 'POST', body: { challenge } }),
  });
}

/**
 * 비밀번호 재설정: 이메일로 번호 받기(challenge) → 번호 확인(resetToken) → 새 비밀번호.
 * 2단계 인증을 켰는지와 상관없이 항상 이메일 인증을 거친다.
 */
export function usePasswordReset() {
  const sendCode = useMutation({
    mutationFn: (email: string) =>
      api<{ challenge: string; maskedEmail: string }>('/api/auth/password/code', { method: 'POST', body: { email } }),
  });
  const resend = useMutation({
    mutationFn: (challenge: string) =>
      api<{ challenge: string }>('/api/auth/password/resend', { method: 'POST', body: { challenge } }),
  });
  const verify = useMutation({
    mutationFn: (body: { challenge: string; code: string }) =>
      api<{ resetToken: string }>('/api/auth/password/verify', { method: 'POST', body }),
  });
  const reset = useMutation({
    mutationFn: (body: { resetToken: string; newPassword: string }) =>
      api<void>('/api/auth/password/reset', { method: 'POST', body }),
  });
  return { sendCode, resend, verify, reset };
}

/** 회원 탈퇴: 가입한 이메일로 번호 받기 → 번호 확인해서 탈퇴 (끝나면 이 기기도 로그아웃) */
export function useWithdraw() {
  const qc = useQueryClient();
  const sendCode = useMutation({
    mutationFn: () => api<{ maskedEmail?: string }>('/api/me/withdraw/code', { method: 'POST' }),
  });
  const withdraw = useMutation({
    mutationFn: (code: string) => api<void>('/api/me/withdraw', { method: 'POST', body: { code } }),
  });
  /** 탈퇴가 끝난 뒤 이 기기 로그아웃. 로그인이 필요한 화면을 먼저 떠난 다음에 부른다 */
  const finish = () => {
    authStore.signOut();
    clearUserScopedCache(qc);
  };
  return { sendCode, withdraw, finish };
}

/** 설정의 2단계 인증: 번호 받기 → 번호 확인해서 켜기, 비밀번호 확인해서 끄기 */
export function useTwoFactor() {
  const sendCode = useMutation({ mutationFn: () => api<void>('/api/me/2fa/code', { method: 'POST' }) });
  const enable = useMutation({
    mutationFn: (code: string) => api<User>('/api/me/2fa/enable', { method: 'POST', body: { code } }),
    onSuccess: (user) => authStore.updateUser(user),
  });
  const disable = useMutation({
    mutationFn: (password: string) => api<User>('/api/me/2fa/disable', { method: 'POST', body: { password } }),
    onSuccess: (user) => authStore.updateUser(user),
  });
  return { sendCode, enable, disable };
}
