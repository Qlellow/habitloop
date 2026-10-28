import { useDeferredValue, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { compact, plainText, useAuth, useChannels, useMyChannels, type ChannelSummary } from '@loop/shared';
import { ChannelIcon, Empty, Input, Loading, Button } from '../../src/ui';

/** 내가 팔로우한 채널 (북마크한 채널이 먼저) */
function MyChannels() {
  const { data } = useMyChannels(true);
  if (!data?.length) return null;
  return (
    <View className="pb-2">
      <Text className="px-5 pt-2 pb-2 text-[13px] font-bold text-fg-weak">내 채널</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4 gap-3">
        {data.map((c) => (
          <Pressable key={c.slug} onPress={() => router.push(`/c/${c.slug}`)} className="w-[64px] items-center gap-1.5 active:opacity-60">
            <ChannelIcon slug={c.slug} name={c.name} color={c.color} iconVersion={c.iconVersion} size={52} />
            <Text className="text-xs text-fg-sub" numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text className="px-5 pt-4 pb-1 text-[13px] font-bold text-fg-weak">모든 채널</Text>
    </View>
  );
}

export default function ChannelsScreen() {
  const { isLoggedIn } = useAuth();
  const navigation = useNavigation();
  const [input, setInput] = useState('');
  const q = useDeferredValue(input);
  const { data, isPending } = useChannels(q);
  const create = () => router.push(isLoggedIn ? '/channel-form' : '/login');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Text onPress={create} className="mr-4 text-base font-semibold text-primary">
          만들기
        </Text>
      ),
    });
  });

  return (
    <FlatList<ChannelSummary>
      data={data ?? []}
      keyExtractor={(ch) => ch.slug}
      keyboardShouldPersistTaps="handled"
      className="bg-surface"
      ListHeaderComponent={
        <View className="pt-4 pb-2">
          <View className="px-4">
          <Input
            placeholder="채널 이름이나 주소로 찾기"
            value={input}
            onChangeText={setInput}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          </View>
          {isLoggedIn && !q ? <MyChannels /> : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/c/${item.slug}`)} className="flex-row items-center gap-3.5 px-5 py-3 active:bg-pressed">
          <ChannelIcon slug={item.slug} name={item.name} color={item.color} iconVersion={item.iconVersion} size={42} />
          <View className="flex-1">
            <Text className="text-base font-semibold text-fg-strong">{item.name}</Text>
            <Text className="mt-0.5 text-sm text-fg-sub" numberOfLines={1}>
              {plainText(item.description ?? '') || `c/${item.slug}`}
            </Text>
          </View>
          <Text className="text-[13px] text-fg-weak">팔로워 {compact(item.memberCount)}</Text>
        </Pressable>
      )}
      ListEmptyComponent={
        isPending ? (
          <Loading />
        ) : (
          <Empty action={<Button title="새 채널 만들기" variant="secondary" size="sm" onPress={create} />}>찾는 채널이 없어요</Empty>
        )
      }
    />
  );
}
