import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError, noticeDate, useSiteNotice } from '@loop/shared';
import { Markdown } from '../../src/Markdown';
import { Empty, Loading } from '../../src/ui';
import { NoticeTag } from '../../src/NoticeTag';

/** 공지 하나: 본문(마크다운) + 이전 · 다음 공지 */
export default function NoticeScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data: n, error } = useSiteNotice(id);
  if (error instanceof ApiError && error.status === 404) return <Empty>없거나 지워진 공지예요</Empty>;
  if (!n) return <Loading />;
  return (
    <ScrollView className="bg-surface" contentContainerClassName="pb-10">
      <View className="p-5 border-b border-line gap-2">
        <View className="flex-row items-center gap-1.5">
          <NoticeTag kind={n.kind} />
          {n.version ? <Text className="text-[13px] font-semibold text-fg-weak">{n.version}</Text> : null}
        </View>
        <Text className="text-[22px] leading-[30px] font-bold text-fg-strong">{n.title}</Text>
        <Text className="text-[13px] text-fg-weak">{noticeDate(n.createdAt)}</Text>
      </View>
      <View className="p-5">
        <Markdown source={n.body} />
      </View>
      {[
        ['다음 공지', n.next],
        ['이전 공지', n.prev],
      ].map(([label, link]) =>
        link && typeof link === 'object' ? (
          <Pressable key={label as string} onPress={() => router.replace(`/notices/${link.id}`)} className="flex-row gap-3 px-5 py-3.5 border-t border-line active:bg-pressed">
            <Text className="text-[13px] font-semibold text-fg-weak">{label as string}</Text>
            <Text className="flex-1 text-sm text-fg-strong" numberOfLines={1}>
              {link.title}
            </Text>
          </Pressable>
        ) : null,
      )}
    </ScrollView>
  );
}
