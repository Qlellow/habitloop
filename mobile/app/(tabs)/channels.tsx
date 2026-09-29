import { useDeferredValue, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { compact, useAuth, useChannels, type ChannelSummary } from '@loop/shared';
import { ChannelIcon, Empty, Input, Loading, Button } from '../../src/ui';

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
        <View className="p-4 pb-2">
          <Input
            placeholder="채널 이름이나 주소로 찾기"
            value={input}
            onChangeText={setInput}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/c/${item.slug}`)} className="flex-row items-center gap-3.5 px-5 py-3 active:bg-pressed">
          <ChannelIcon slug={item.slug} name={item.name} size={42} />
          <View className="flex-1">
            <Text className="text-base font-semibold text-fg-strong">{item.name}</Text>
            <Text className="mt-0.5 text-sm text-fg-sub" numberOfLines={1}>
              {item.description || `c/${item.slug}`}
            </Text>
          </View>
          <Text className="text-[13px] text-fg-weak">글 {compact(item.postCount)}</Text>
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
