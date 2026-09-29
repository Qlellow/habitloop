import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { compact, usePopular } from '@loop/shared';
import { SectionTitle } from './ui';

/** 인기글 5개 (전체 또는 채널별) */
export function PopularBlock({ channel }: { channel?: string }) {
  const { data } = usePopular(channel);
  if (!data?.length) return null;
  return (
    <View className="bg-surface mb-3 pb-3">
      <SectionTitle>지금 인기 있는 글</SectionTitle>
      {data.map((p, i) => (
        <Pressable
          key={p.id}
          onPress={() => router.push(`/post/${p.id}`)}
          className="flex-row items-center gap-3.5 px-5 py-[11px] active:bg-pressed"
        >
          <Text className="w-[18px] text-base font-bold text-primary text-center">{i + 1}</Text>
          <Text className="flex-1 text-[15px] font-medium text-fg-strong" numberOfLines={1}>
            {p.title}
          </Text>
          <Text className="text-[13px] text-fg-weak">♥ {compact(p.likeCount)}</Text>
        </Pressable>
      ))}
    </View>
  );
}
