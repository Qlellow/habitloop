import { memo, useCallback, type ReactElement } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { compact, timeAgo, type CursorPage, type PostSummary } from '@loop/shared';
import { Empty, Loading, Skeleton, Button } from './ui';
import { useColors } from './theme';

export type Badge = 'channel' | 'category';

export const PostRow = memo(function PostRow({ post, badge = 'channel' }: { post: PostSummary; badge?: Badge }) {
  const c = useColors();
  const label = badge === 'channel' ? post.channelName : post.categoryName;
  return (
    <Pressable
      onPress={() => router.push(`/post/${post.id}`)}
      className="px-5 py-4 bg-surface active:bg-pressed"
      accessibilityRole="button"
    >
      <View className="flex-row items-center">
        {label ? <Text className="text-[13px] font-semibold text-primary">{label}</Text> : null}
        <Text className="shrink text-[13px] text-fg-weak" numberOfLines={1}>
          {label ? ' · ' : ''}
          {post.authorNickname} · {timeAgo(post.createdAt)}
        </Text>
      </View>
      <Text className="mt-1.5 text-[17px] leading-6 font-semibold text-fg-strong" numberOfLines={2}>
        {post.title}
      </Text>
      {post.excerpt ? (
        <Text className="mt-1 text-[15px] leading-[21px] text-fg-sub" numberOfLines={2}>
          {post.excerpt}
        </Text>
      ) : null}
      <View className="mt-2.5 flex-row items-center gap-[3px]">
        <Ionicons name="heart-outline" size={14} color={c.weak} />
        <Text className="text-[13px] text-fg-weak">{compact(post.likeCount)}</Text>
        <Ionicons name="chatbubble-outline" size={13} color={c.weak} className="ml-2.5" />
        <Text className="text-[13px] text-fg-weak">{compact(post.commentCount)}</Text>
        <Text className="ml-2.5 text-[13px] text-fg-weak">조회 {compact(post.viewCount)}</Text>
      </View>
    </Pressable>
  );
});

export function PostSkeleton() {
  return (
    <View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} className="px-5 py-4 bg-surface">
          <Skeleton width={120} height={13} />
          <Skeleton width="75%" height={19} className="mt-2.5" />
          <Skeleton width="95%" height={15} className="mt-2" />
        </View>
      ))}
    </View>
  );
}

type FeedQuery = UseInfiniteQueryResult<InfiniteData<CursorPage<PostSummary>>>;

/**
 * 무한 스크롤 글 목록.
 * FlatList 가상화 + 화면 밖 뷰 떼어내기로 긴 목록에서도 메모리와 렌더 비용을 일정하게 유지한다.
 */
export function PostFeed({ query, header, empty, badge }: { query: FeedQuery; header?: ReactElement; empty: string; badge?: Badge }) {
  const c = useColors();
  const posts = query.data?.pages.flatMap((p) => p.items) ?? [];
  const renderItem = useCallback(({ item }: { item: PostSummary }) => <PostRow post={item} badge={badge} />, [badge]);

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => String(p.id)}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View className="h-px bg-line mx-5" />}
      ListEmptyComponent={
        query.isPending ? (
          <PostSkeleton />
        ) : query.isError ? (
          <Empty action={<Button title="다시 시도" variant="secondary" size="sm" onPress={() => query.refetch()} />}>
            불러오지 못했어요
          </Empty>
        ) : (
          <Empty>{empty}</Empty>
        )
      }
      ListFooterComponent={query.isFetchingNextPage ? <Loading /> : <View className="h-8" />}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.6}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => query.refetch()}
          tintColor={c.primary}
        />
      }
      className="bg-surface"
      contentContainerClassName="bg-surface"
      initialNumToRender={8}
      maxToRenderPerBatch={10}
      windowSize={9}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
    />
  );
}
