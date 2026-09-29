import { useDeferredValue, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { compact, useAuth, useChannels, type ChannelSummary } from '@loop/shared';
import { ChannelIcon, Empty, Input, Loading, Button } from '../../src/ui';
import { makeStyles, useColors } from '../../src/theme';

export default function ChannelsScreen() {
  const s = useStyles();
  const c = useColors();
  const { isLoggedIn } = useAuth();
  const navigation = useNavigation();
  const [input, setInput] = useState('');
  const q = useDeferredValue(input);
  const { data, isPending } = useChannels(q);
  const create = () => router.push(isLoggedIn ? '/channel-form' : '/login');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Text onPress={create} style={s.headerAction}>
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
      style={{ backgroundColor: c.surface }}
      ListHeaderComponent={
        <View style={s.searchWrap}>
          <Input placeholder="채널 이름이나 주소로 찾기" value={input} onChangeText={setInput} returnKeyType="search" clearButtonMode="while-editing" />
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/c/${item.slug}`)} style={({ pressed }) => [s.row, pressed && s.pressed]}>
          <ChannelIcon slug={item.slug} name={item.name} size={42} />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{item.name}</Text>
            <Text style={s.desc} numberOfLines={1}>
              {item.description || `c/${item.slug}`}
            </Text>
          </View>
          <Text style={s.count}>글 {compact(item.postCount)}</Text>
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

const useStyles = makeStyles((c) => ({
  headerAction: { marginRight: 16, fontSize: 16, fontWeight: '600', color: c.primary },
  searchWrap: { padding: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 },
  pressed: { backgroundColor: c.pressed },
  name: { fontSize: 16, fontWeight: '600', color: c.textStrong },
  desc: { marginTop: 2, fontSize: 14, color: c.sub },
  count: { fontSize: 13, color: c.weak },
}));
