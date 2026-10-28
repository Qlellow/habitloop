import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { timeAgo, useAuth, useNotifications, useReadNotifications, type NotificationItem } from '@loop/shared';
import { Avatar, Button, Empty, Loading } from '../src/ui';
import { cn } from '../src/cn';
import { useColors } from '../src/theme';

const name = (n: NotificationItem) => n.actor?.nickname ?? '알 수 없는 사용자';

/** 알림 한 줄의 문장 (웹과 같은 말) */
function Message({ n }: { n: NotificationItem }) {
  const b = (s: string) => <Text className="font-semibold text-fg-strong">{s}</Text>;
  switch (n.type) {
    case 'comment':
      return <>{b(name(n))}님이 내 글에 댓글을 달았어요</>;
    case 'reply':
      return <>{b(name(n))}님이 내 댓글에 답글을 달았어요</>;
    case 'like':
      return n.count > 1 ? (
        <>
          {b(name(n))}님 외 {(n.count - 1).toLocaleString()}명이 내 글에 공감했어요
        </>
      ) : (
        <>{b(name(n))}님이 내 글에 공감했어요</>
      );
    case 'notice':
      return <>{b(n.post.channelName)}에 새 공지가 올라왔어요</>;
    case 'discovery':
      return <>내 글이 {b('오늘의 발견')}에 뽑혔어요 (+30P)</>;
  }
}

function Row({ n, onPress }: { n: NotificationItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className={cn('flex-row gap-3 px-5 py-4 active:bg-pressed', !n.read && 'bg-primary-weak/40')}>
      {n.type === 'discovery' ? (
        <View className="w-10 h-10 rounded-full items-center justify-center bg-primary-weak">
          <Text className="text-primary text-lg">✦</Text>
        </View>
      ) : (
        <Avatar name={n.type === 'notice' ? n.post.channelName : name(n)} uri={n.type === 'notice' ? undefined : n.actor?.avatarUrl} size={40} />
      )}
      <View className="flex-1">
        <Text className="text-[15px] leading-[21px] text-fg">
          <Message n={n} />
        </Text>
        <Text className="mt-0.5 text-[13px] text-fg-weak" numberOfLines={1}>
          {n.comment ? `“${n.comment.excerpt}”` : n.post.title}
        </Text>
        <Text className="mt-0.5 text-xs text-fg-weak">
          {n.post.channelName} · {timeAgo(n.createdAt)}
        </Text>
      </View>
      {!n.read ? <View className="mt-2 w-2 h-2 rounded-full bg-primary" accessibilityLabel="안 읽음" /> : null}
    </Pressable>
  );
}

/** 알림 목록. 누르면 읽음으로 바꾸고 그 글로 간다 */
export default function NotificationsScreen() {
  const c = useColors();
  const { isLoggedIn } = useAuth();
  const list = useNotifications(isLoggedIn);
  const read = useReadNotifications();
  const navigation = useNavigation();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = items.some((n) => !n.read);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: unread
        ? () => (
            <Text className="text-[15px] font-semibold text-primary" onPress={() => read.mutate(undefined)}>
              모두 읽음
            </Text>
          )
        : undefined,
    });
  }, [navigation, unread, read]);

  if (!isLoggedIn) {
    return <Empty action={<Button title="로그인" onPress={() => router.push('/login')} />}>로그인하면 알림을 받을 수 있어요</Empty>;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => String(n.id)}
      renderItem={({ item }) => (
        <Row
          n={item}
          onPress={() => {
            if (!item.read) read.mutate(item.id);
            router.push(`/post/${item.post.id}`);
          }}
        />
      )}
      ItemSeparatorComponent={() => <View className="h-px bg-line mx-5" />}
      ListEmptyComponent={list.isPending ? <Loading /> : <Empty>아직 알림이 없어요</Empty>}
      ListFooterComponent={list.isFetchingNextPage ? <Loading /> : <View className="h-8" />}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => list.refetch()} tintColor={c.primary} />}
      className="bg-surface"
    />
  );
}
