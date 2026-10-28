import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { NOTICE_KIND_LABEL, noticeDate, useSiteNotices, type NoticeKind, type NoticeSummary } from '@loop/shared';
import { Chip, Empty, Loading } from '../../src/ui';
import { NoticeTag } from '../../src/NoticeTag';

function Row({ n }: { n: NoticeSummary }) {
  return (
    <Pressable onPress={() => router.push(`/notices/${n.id}`)} accessibilityRole="button" className="px-5 py-4 bg-surface active:bg-pressed gap-1.5">
      <View className="flex-row items-center gap-1.5">
        {n.pinned ? <Text className="text-xs">📌</Text> : null}
        <NoticeTag kind={n.kind} />
        {n.version ? <Text className="text-xs font-semibold text-fg-weak">{n.version}</Text> : null}
        <Text className="ml-auto text-xs text-fg-weak">{noticeDate(n.createdAt)}</Text>
      </View>
      <Text className="text-base font-semibold leading-[22px] text-fg-strong" numberOfLines={2}>
        {n.title}
      </Text>
      {n.excerpt ? (
        <Text className="text-sm leading-5 text-fg-sub" numberOfLines={2}>
          {n.excerpt}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** 루프 공지사항 · 업데이트 소식 (고정 공지가 맨 위) */
export default function NoticesScreen() {
  const [kind, setKind] = useState<NoticeKind>();
  const q = useSiteNotices(kind);
  const pinned = q.data?.pages[0]?.pinned ?? [];
  const items = [...pinned, ...(q.data?.pages.flatMap((p) => p.items) ?? []).filter((n) => !pinned.some((p) => p.id === n.id))];
  return (
    <FlatList
      data={items}
      keyExtractor={(n) => String(n.id)}
      renderItem={({ item }) => <Row n={item} />}
      ItemSeparatorComponent={() => <View className="h-px bg-line mx-5" />}
      ListHeaderComponent={
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="bg-surface border-b border-line" contentContainerClassName="gap-2 px-4 py-3">
          <Chip label="전체" selected={!kind} onPress={() => setKind(undefined)} />
          {(Object.keys(NOTICE_KIND_LABEL) as NoticeKind[]).map((k) => (
            <Chip key={k} label={NOTICE_KIND_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </ScrollView>
      }
      ListEmptyComponent={q.isPending ? <Loading /> : <Empty>아직 공지가 없어요</Empty>}
      ListFooterComponent={q.isFetchingNextPage ? <Loading /> : <View className="h-8" />}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
      onEndReachedThreshold={0.5}
      className="bg-surface"
    />
  );
}
