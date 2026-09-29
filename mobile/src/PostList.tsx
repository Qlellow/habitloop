import { memo, useCallback, type ReactElement } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { compact, timeAgo, type CursorPage, type PostSummary } from '@loop/shared';
import { Empty, Loading, Skeleton, Button } from './ui';
import { makeStyles, useColors } from './theme';

export type Badge = 'channel' | 'category';

export const PostRow = memo(function PostRow({ post, badge = 'channel' }: { post: PostSummary; badge?: Badge }) {
  const s = useStyles();
  const c = useColors();
  const label = badge === 'channel' ? post.channelName : post.categoryName;
  return (
    <Pressable
      onPress={() => router.push(`/post/${post.id}`)}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
      accessibilityRole="button"
    >
      <View style={s.meta}>
        {label ? <Text style={s.badge}>{label}</Text> : null}
        <Text style={s.metaText} numberOfLines={1}>
          {label ? ' · ' : ''}
          {post.authorNickname} · {timeAgo(post.createdAt)}
        </Text>
      </View>
      <Text style={s.title} numberOfLines={2}>
        {post.title}
      </Text>
      {post.excerpt ? (
        <Text style={s.excerpt} numberOfLines={2}>
          {post.excerpt}
        </Text>
      ) : null}
      <View style={s.stats}>
        <Ionicons name="heart-outline" size={14} color={c.weak} />
        <Text style={s.statText}>{compact(post.likeCount)}</Text>
        <Ionicons name="chatbubble-outline" size={13} color={c.weak} style={{ marginLeft: 10 }} />
        <Text style={s.statText}>{compact(post.commentCount)}</Text>
        <Text style={[s.statText, { marginLeft: 10 }]}>조회 {compact(post.viewCount)}</Text>
      </View>
    </Pressable>
  );
});

export function PostSkeleton() {
  const s = useStyles();
  return (
    <View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={s.row}>
          <Skeleton width={120} height={13} />
          <Skeleton width="75%" height={19} style={{ marginTop: 10 }} />
          <Skeleton width="95%" height={15} style={{ marginTop: 8 }} />
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
export function PostFeed({
  query,
  header,
  empty,
  badge,
}: {
  query: FeedQuery;
  header?: ReactElement;
  empty: string;
  badge?: Badge;
}) {
  const s = useStyles();
  const c = useColors();
  const posts = query.data?.pages.flatMap((p) => p.items) ?? [];
  const renderItem = useCallback(({ item }: { item: PostSummary }) => <PostRow post={item} badge={badge} />, [badge]);

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => String(p.id)}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View style={s.separator} />}
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
      ListFooterComponent={query.isFetchingNextPage ? <Loading /> : <View style={{ height: 32 }} />}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.6}
      refreshControl={
        <RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => query.refetch()} tintColor={c.primary} />
      }
      style={{ backgroundColor: c.surface }}
      contentContainerStyle={{ backgroundColor: c.surface }}
      initialNumToRender={8}
      maxToRenderPerBatch={10}
      windowSize={9}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
    />
  );
}

const useStyles = makeStyles((c) => ({
  row: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: c.surface },
  pressed: { backgroundColor: c.pressed },
  separator: { height: 1, backgroundColor: c.line, marginHorizontal: 20 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  badge: { fontSize: 13, fontWeight: '600', color: c.primary },
  metaText: { flexShrink: 1, fontSize: 13, color: c.weak },
  title: { marginTop: 6, fontSize: 17, lineHeight: 24, fontWeight: '600', color: c.textStrong },
  excerpt: { marginTop: 4, fontSize: 15, lineHeight: 21, color: c.sub },
  stats: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: 13, color: c.weak },
}));
